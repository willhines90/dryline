/**
 * One-off smoke runner. Imports a tool by name and prints its result.
 * Usage: pnpm tsx mcp/scripts/smoke.ts <tool_name> '<json_args>'
 *
 * Example:
 *   pnpm tsx mcp/scripts/smoke.ts resolve_location '{"address":"Wimberley, TX"}'
 */
import { tools } from "../src/tools/index.js";

async function main() {
  const [toolName, argsJson] = process.argv.slice(2);
  if (!toolName) {
    console.error("usage: smoke.ts <tool_name> <json_args>");
    process.exit(2);
  }
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    console.error(`unknown tool: ${toolName}`);
    console.error(`available: ${tools.map((t) => t.name).join(", ")}`);
    process.exit(2);
  }
  const args = argsJson ? JSON.parse(argsJson) : {};
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    console.error("input validation failed:", parsed.error.message);
    process.exit(2);
  }
  const result = await tool.run(parsed.data);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("smoke fatal:", err);
  process.exit(1);
});
