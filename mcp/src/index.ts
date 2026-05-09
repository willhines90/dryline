#!/usr/bin/env node
/**
 * Dryline MCP server entry point.
 *
 * Speaks MCP over stdio (default) for use with Codex CLI / Claude Code, or
 * over HTTP if MCP_TRANSPORT=http (for the production web runtime).
 *
 * The tools live in ./tools/. The registry in ./tools/index.ts wires them up.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { tools } from "./tools/index.js";

const server = new Server(
  { name: "dryline-mcp", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    };
  }

  // Validate input. If validation fails, return as a text error — never throw.
  const parsed = tool.inputSchema.safeParse(request.params.arguments ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        { type: "text", text: `Invalid arguments: ${parsed.error.message}` },
      ],
    };
  }

  // Tools never throw at the boundary; they return ToolResult always.
  const result = await tool.run(parsed.data);

  // MCP needs string content. Stringify the structured result so the agent
  // can parse it on the other side. The skill teaches the agent that every
  // tool returns { data, caveats, sources } — it can rely on the contract.
  return {
    content: [
      { type: "text", text: JSON.stringify(result, null, 2) },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive while stdio is open.
  process.stderr.write("dryline-mcp ready (stdio)\n");
}

main().catch((err) => {
  process.stderr.write(`dryline-mcp fatal: ${String(err)}\n`);
  process.exit(1);
});

// ---- helpers ----

/**
 * Minimal zod → JSON Schema converter for MCP's inputSchema field.
 * Keeps things dependency-light. Not a complete implementation — extend
 * here if a tool needs schema features that aren't covered yet.
 */
function zodToJsonSchema(schema: z.ZodTypeAny): unknown {
  // The MCP SDK and most agents are lenient — a permissive object schema works
  // as a fallback. For tighter type checking on the agent side, consider
  // pulling in the `zod-to-json-schema` package later.
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value);
      if (!value.isOptional()) required.push(key);
    }
    return { type: "object", properties, required };
  }
  return { type: "object" };
}

function zodFieldToJsonSchema(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodOptional) return zodFieldToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodFieldToJsonSchema(schema.removeDefault());
  return { type: "string" };
}
