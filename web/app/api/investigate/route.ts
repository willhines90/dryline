/**
 * POST /api/investigate
 *
 * Body: { address: string, mode?: "personal" | "transparency" }
 * Response: text/event-stream (SSE) with the dryline contract event types:
 *   - tool_start    { toolName, args }
 *   - tool_result   { toolName, summary, data, sources, caveats }
 *   - synthesis     { markdown, sources }
 *   - artifact      { kind, title, markdown }
 *   - error         { message }
 *   - done          {}
 *
 * Architecture (see CLAUDE.md and the Phase 3 architectural note):
 *   The dryline MCP server is a public artifact for stdio agent runtimes
 *   (Claude Code, Codex, etc.). The web demo's hot path imports the SAME
 *   tool registry in-process and calls each tool deterministically,
 *   then hands the results to the model for synthesis only.
 *
 *   Why deterministic instead of agent tool-calling: every demo
 *   investigation runs all five MVP tools (resolve_location followed by
 *   the four parallel data tools). Letting the model "decide" added two
 *   model round-trips that pushed dense-metro investigations to ~50–70 s
 *   wall-clock. Pre-fetching keeps the cinematic trace identical from
 *   the user's side (we still emit tool_start/tool_result events as
 *   each tool resolves) while bringing every run inside the 25 s
 *   budget. The agent is still the demo's "front door" via the skill
 *   for any external runtime — Claude Code, Codex, Cursor — talking to
 *   the MCP server over stdio.
 */

import OpenAI from "openai";
import type { ResponseInput, ResponseStreamEvent } from "openai/resources/responses/responses";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tools as drylineTools } from "@dryline/mcp/tools";
import type { Caveat, Source, ToolResult } from "@dryline/mcp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  buffer: Uint8Array;
  expires: number;
}
const cache = new Map<string, CacheEntry>();

let skillPromptCache: string | null = null;
async function getSkillPrompt(): Promise<string> {
  if (skillPromptCache) return skillPromptCache;
  const candidates = [
    path.resolve(process.cwd(), "..", "skill", "SKILL.md"),
    path.resolve(process.cwd(), "skill", "SKILL.md"),
  ];
  for (const candidate of candidates) {
    try {
      const text = await fs.readFile(candidate, "utf-8");
      skillPromptCache = text;
      return text;
    } catch {
      /* try next */
    }
  }
  throw new Error("Could not locate skill/SKILL.md");
}

type Mode = "personal" | "transparency";

const MODE_FRAMING: Record<Mode, string> = {
  personal:
    "Mode: PERSONAL. The user is asking about their own situation at this address. Address them directly. Default artifact kind: watering_reminder or well_outlook_briefing. Avoid systemic editorializing unless the data forces it.",
  transparency:
    "Mode: TRANSPARENCY. The user is asking about systemic patterns at or near this address — large permitted users, regulatory context, historical pressure on the watershed. Default artifact kind: public_comment (when the data points to a permittee worth scrutinizing) or gcd_letter / pia_request (when groundwater or missing-data concerns dominate).",
};

const SYNTHESIS_INSTRUCTIONS = (mode: Mode) => `# Runtime instructions for this synthesis

You are running inside the Dryline web app's investigation flow. ${MODE_FRAMING[mode]}

The five MVP tools have ALREADY been run for this address; their full ToolResult shapes (data + caveats + sources) are provided below. Do not call any tools — only synthesize.

Emit your final assistant text in EXACTLY this structure:

\`\`\`
# Synthesis

<2–4 short paragraphs. Every fact-bearing sentence cites a source from a tool's sources[] using inline markdown links [Source Title](url). End with the required Dryline disclaimer paragraph.>

---
# Action artifact
KIND: <one of: public_comment | watering_reminder | gcd_letter | well_outlook_briefing | pia_request | weekly_briefing>
TITLE: <short title, no markdown>
BODY:
<the drafted artifact, markdown allowed. Include "Review before sending." at the top if the artifact is intended for a third party.>
\`\`\`

Hard rules: never claim causation; never predict personal impact; never overclaim. If a tool returned \`data: null\` or its caveats include a 'quality' severity 'error', say so explicitly in the synthesis and continue with what you do have. Cite at least three distinct sources inline.`;

interface DispatchResult {
  toolResult: ToolResult<unknown>;
  summary: string;
}

async function dispatchTool(name: string, args: unknown): Promise<DispatchResult> {
  const tool = drylineTools.find((t) => t.name === name);
  if (!tool) {
    const errResult: ToolResult<null> = {
      data: null,
      caveats: [{ severity: "error", category: "quality", message: `Unknown tool: ${name}` }],
      sources: [],
    };
    return { toolResult: errResult, summary: `unknown tool: ${name}` };
  }
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    const errResult: ToolResult<null> = {
      data: null,
      caveats: [
        {
          severity: "error",
          category: "inference",
          message: `Input validation failed for ${name}: ${parsed.error.message}`,
        },
      ],
      sources: [],
    };
    return { toolResult: errResult, summary: `invalid args for ${name}` };
  }
  const result = (await tool.run(parsed.data)) as ToolResult<unknown>;
  return { toolResult: result, summary: summarizeTool(name, result) };
}

function summarizeTool(name: string, result: ToolResult<unknown>): string {
  if (!result.data) {
    const err = result.caveats.find((c) => c.severity === "error");
    return err ? err.message : "no data returned";
  }
  const d = result.data as Record<string, unknown>;
  switch (name) {
    case "resolve_location": {
      const r = d as { formattedAddress?: string; countyName?: string; countyFips?: string };
      return `${r.formattedAddress ?? "(address)"} — ${r.countyName ?? "?"} County, FIPS ${r.countyFips ?? "?"}`;
    }
    case "get_drought_status": {
      const r = d as { category?: string; asOf?: string };
      return `Drought ${r.category ?? "?"} as of ${r.asOf ?? "?"}`;
    }
    case "get_reservoirs": {
      const r = d as { reservoirs?: Array<{ name: string; currentPct: number; historicalAvgPct: number | null }> };
      const list = r.reservoirs ?? [];
      if (list.length === 0) return "no major reservoirs in radius";
      return list
        .slice(0, 3)
        .map((x) => `${x.name} ${x.currentPct}%${x.historicalAvgPct == null ? "" : ` (hist ${x.historicalAvgPct}%)`}`)
        .join("; ") + (list.length > 3 ? `; +${list.length - 3} more` : "");
    }
    case "get_drinking_water": {
      const r = d as {
        systems?: Array<{
          pwsName: string;
          populationServed: number;
          compliance: { healthBasedCurrent: boolean; rulesViolatedLast3yr: number };
        }>;
      };
      const list = r.systems ?? [];
      if (list.length === 0) return "no PWS matched";
      return list
        .slice(0, 2)
        .map(
          (s) =>
            `${s.pwsName} pop ${s.populationServed} · 3yr violations ${s.compliance.rulesViolatedLast3yr}${s.compliance.healthBasedCurrent ? " · health-based current" : ""}`,
        )
        .join("; ") + (list.length > 2 ? `; +${list.length - 2} more` : "");
    }
    case "get_big_users_nearby": {
      const r = d as { facilities?: Array<{ permitCategory: string; actualAverageFlowMgd: number | null }> };
      const list = r.facilities ?? [];
      const ind = list.filter((f) => f.permitCategory === "individual_npdes");
      const flowed = ind.filter((f) => f.actualAverageFlowMgd != null);
      return `${list.length} permittees · ${ind.length} individual NPDES · ${flowed.length} with reported flow`;
    }
    default:
      return "tool returned";
  }
}

interface SynthesisParts {
  synthesis: string;
  artifact: { kind: string; title: string; markdown: string } | null;
}

function parseFinalText(text: string): SynthesisParts {
  const idx = text.indexOf("# Action artifact");
  if (idx === -1) return { synthesis: text.trim(), artifact: null };
  let synthesis = text.slice(0, idx).trim();
  synthesis = synthesis.replace(/\n*-{3,}\s*$/g, "").trim();
  const artifactRaw = text.slice(idx + "# Action artifact".length).trim();
  const kindMatch = /^KIND:\s*(\S+)/m.exec(artifactRaw);
  const titleMatch = /^TITLE:\s*(.+)$/m.exec(artifactRaw);
  const bodyIdx = artifactRaw.indexOf("BODY:");
  const body = bodyIdx >= 0 ? artifactRaw.slice(bodyIdx + "BODY:".length).trim() : artifactRaw;
  const kind = kindMatch?.[1]?.trim();
  const title = titleMatch?.[1]?.trim();
  if (!kind || !title) return { synthesis, artifact: null };
  return { synthesis, artifact: { kind, title, markdown: body } };
}

function collectSourcesFromToolResults(results: ToolResult<unknown>[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const r of results) {
    for (const s of r.sources) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}

class StreamWriter {
  private chunks: Uint8Array[] = [];
  private encoder = new TextEncoder();
  private closed = false;
  constructor(private controller: ReadableStreamDefaultController<Uint8Array>) {}
  emit(name: string, data: unknown): void {
    if (this.closed) return;
    const chunk = this.encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    this.chunks.push(chunk);
    this.controller.enqueue(chunk);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.controller.close();
  }
  buffer(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}

async function dispatchAndEmit(
  name: string,
  args: unknown,
  writer: StreamWriter,
  results: ToolResult<unknown>[],
): Promise<DispatchResult> {
  writer.emit("tool_start", { toolName: name, args });
  const dispatched = await dispatchTool(name, args);
  results.push(dispatched.toolResult);
  writer.emit("tool_result", {
    toolName: name,
    summary: dispatched.summary,
    data: dispatched.toolResult.data,
    sources: dispatched.toolResult.sources,
    caveats: dispatched.toolResult.caveats,
  });
  return dispatched;
}

function formatToolResultsForSynthesis(
  results: { name: string; result: ToolResult<unknown> }[],
): string {
  const lines: string[] = [];
  for (const { name, result } of results) {
    lines.push(`## ${name}`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(result, null, 2));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

interface InvestigationCompletion {
  cacheable: boolean;
}

async function runInvestigation(
  address: string,
  mode: Mode,
  writer: StreamWriter,
): Promise<InvestigationCompletion> {
  if (!process.env.OPENAI_API_KEY) {
    writer.emit("error", { message: "OPENAI_API_KEY not set on the server. Add it to web/.env.local." });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
  }

  const collected: ToolResult<unknown>[] = [];

  // Phase 1: resolve_location must succeed before the others can run.
  const resolved = await dispatchAndEmit("resolve_location", { address }, writer, collected);
  const resolvedData = resolved.toolResult.data as
    | { lat: number; lng: number; countyFips: string }
    | null;
  const resolveOk = resolvedData != null;

  // Phase 2: parallel-fetch the four follow-on tools, deterministically.
  // We emit tool_start/tool_result as each resolves so the trace still
  // streams in real time. If resolve_location failed, fall back to a
  // best-effort run with the published label (most tools require lat/lng
  // or countyFips and will surface their own error caveats — that's OK,
  // the synthesis will explain).
  if (resolvedData) {
    const { lat, lng, countyFips } = resolvedData;
    await Promise.all([
      dispatchAndEmit("get_drought_status", { countyFips }, writer, collected),
      dispatchAndEmit(
        "get_reservoirs",
        { lat, lng, radiusMi: 50 },
        writer,
        collected,
      ),
      dispatchAndEmit(
        "get_drinking_water",
        { countyFips, limit: 5 },
        writer,
        collected,
      ),
      dispatchAndEmit(
        "get_big_users_nearby",
        { lat, lng, radiusMi: 15, limit: 100 },
        writer,
        collected,
      ),
    ]);
  }

  // Phase 3: synthesis-only model call.
  const skill = await getSkillPrompt();
  const labeledResults = collected.map((r, i) => ({
    name: ["resolve_location", "get_drought_status", "get_reservoirs", "get_drinking_water", "get_big_users_nearby"][i] ?? "tool",
    result: r,
  }));

  const userMessage = `Investigate the water situation at this Texas address: ${address}

Tool results (already gathered for you):

${formatToolResultsForSynthesis(labeledResults)}`;

  const input: ResponseInput = [
    { role: "system", content: `${skill}\n\n---\n\n${SYNTHESIS_INSTRUCTIONS(mode)}` },
    { role: "user", content: userMessage },
  ];

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let stream: AsyncIterable<ResponseStreamEvent>;
  try {
    stream = (await client.responses.create({
      model: MODEL,
      input,
      stream: true,
    })) as unknown as AsyncIterable<ResponseStreamEvent>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writer.emit("error", { message: `OpenAI call failed: ${message}` });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
  }

  let finalText = "";
  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        finalText += event.delta;
        break;
      case "error": {
        const message = (event as unknown as { error?: { message?: string }; message?: string })
          .error?.message ?? (event as unknown as { message?: string }).message ?? "OpenAI stream error";
        writer.emit("error", { message });
        break;
      }
      default:
        break;
    }
  }

  if (!finalText) {
    writer.emit("error", { message: "Model produced no synthesis text." });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
  }

  const { synthesis, artifact } = parseFinalText(finalText);
  const sourcesUnion = collectSourcesFromToolResults(collected);
  writer.emit("synthesis", { markdown: synthesis, sources: sourcesUnion });
  if (artifact) writer.emit("artifact", artifact);
  writer.emit("done", {});
  writer.close();
  return { cacheable: resolveOk };
}

export async function POST(req: Request): Promise<Response> {
  let address: string;
  let mode: Mode = "personal";
  try {
    const body = (await req.json()) as { address?: unknown; mode?: unknown };
    if (typeof body.address !== "string" || body.address.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Body must be { address: string, mode?: 'personal'|'transparency' }" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    address = body.address.trim();
    if (body.mode === "transparency" || body.mode === "personal") {
      mode = body.mode;
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cacheKey = `${mode}::${address.toLowerCase()}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > now) {
    const replay = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(cached.buffer);
        controller.close();
      },
    });
    return new Response(replay, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Dryline-Cache": "hit",
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writer = new StreamWriter(controller);
      let okToCache = true;
      try {
        const completion = await runInvestigation(address, mode, writer);
        okToCache = completion.cacheable;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writer.emit("error", { message });
        writer.emit("done", {});
        writer.close();
        okToCache = false;
      }
      // Only cache complete, well-formed runs. A run that bailed on a
      // resolve_location 5xx is not representative; the next visitor
      // deserves a fresh attempt.
      if (okToCache) {
        cache.set(cacheKey, {
          buffer: writer.buffer(),
          expires: Date.now() + CACHE_TTL_MS,
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Dryline-Cache": "miss",
    },
  });
}
