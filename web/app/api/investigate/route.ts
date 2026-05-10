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
import type {
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses";
import { zodToJsonSchema } from "zod-to-json-schema";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tools as drylineTools } from "@dryline/mcp/tools";
import type { Caveat, Source, ToolResult } from "@dryline/mcp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const SYNTHESIS_TIMEOUT_MS = 60_000;
const AGENTIC_TIMEOUT_MS = 50_000;
const AGENTIC_MAX_ITERATIONS = 8;

const PUBLISHED_TOOL_NAMES = new Set([
  "resolve_location",
  "get_drought_status",
  "get_reservoirs",
  "get_drinking_water",
  "get_big_users_nearby",
  "get_aquifer_status",
]);

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
    "Mode: PERSONAL. The user is asking about their own situation at this address. Address them directly (\"your address\", \"your utility\"). Default artifact kind: watering_reminder when drought / utility action dominates, or well_outlook_briefing when groundwater / private-well stress dominates. Lead the synthesis with the lived-experience hook — typically the aquifer trend at the nearest monitoring well, then drinking-water status, then drought stage and what it forbids.",
  transparency:
    "Mode: TRANSPARENCY. The user is asking about systemic patterns at or near this address — large permitted users, regulatory context, historical pressure on the watershed. Lead with a TENSION FLAG that pairs two facts (e.g., 'reservoir below historical average AND large permitted draw nearby'). Default artifact kind: public_comment when the data points to a specific permittee worth scrutinizing (cite the NPDES permit ID from get_big_users_nearby in the body — do not invent docket numbers; if no specific open comment window is known, include 'verify the comment window is open at echo.epa.gov/detailed-facility-report' in the draft); gcd_letter when groundwater stress + a named GCD is in scope; pia_request when the gap in public data is itself the story.",
};

const SYNTHESIS_INSTRUCTIONS = (
  mode: Mode,
  headlineStory: string | null,
  humanScaleHook: string | null,
) =>
  `# Runtime instructions for this synthesis

You are running inside the Dryline web app's investigation flow. ${MODE_FRAMING[mode]}

${
  headlineStory
    ? `Background context the user came in with (treat as the framing, land it concretely in the data):\n> ${headlineStory}\n\n`
    : ""
}${
    humanScaleHook
      ? `**Required: weave the following human-scale framing into the synthesis.** The exact wording is yours — but the *number* and the *concrete comparison* MUST appear:\n> ${humanScaleHook}\n\n`
      : ""
  }The MVP tools (resolve_location, get_drought_status, get_reservoirs, get_drinking_water, get_big_users_nearby, and get_aquifer_status when the address is in a covered demo county) have ALREADY been run for this address; their full ToolResult shapes (data + caveats + sources) are provided below. Do not call any tools — only synthesize.

Emit your final assistant text in EXACTLY this structure:

\`\`\`
# Synthesis

<2–4 short paragraphs, ~120–280 words total. Every fact-bearing sentence cites a source from a tool's sources[] using inline markdown links [Source Title](url). End with the required Dryline disclaimer paragraph.>

---
# Action artifact
KIND: <one of: public_comment | watering_reminder | gcd_letter | well_outlook_briefing | pia_request | weekly_briefing>
TITLE: <short title, no markdown>
BODY:
<the drafted artifact, markdown allowed, ~120–250 words. Include "Review before sending." at the top if the artifact is intended for a third party.>
\`\`\`

Hard rules — every one is non-negotiable:
1. Never claim causation. "Aquifer is declining AND a permit was filed nearby" is a flagged tension, not a causal claim.
2. Never predict personal impact. Do NOT use "your well may run dry," "your water could become unsafe," "your property value may fall," or any probabilistic-future-tense phrasing. State the data. Let the user interpret.
3. Avoid hedging language: "could be," "might affect," "may impact," "appears to suggest." If the data is uncertain, that uncertainty belongs in a structured caveat, not in fuzzy synthesis prose.
4. If get_aquifer_status returned a monitoring well: lead the synthesis with the trend ("the nearest TWDB monitoring well — <stateWellId>, <distance> mi away in the <aquifer> — has shown depth-to-water moving <X> ft/yr over the last decade"). Note that a single well does not speak for the whole aquifer.
5. For public_comment artifacts, cite the actual NPDES permit ID(s) from get_big_users_nearby. Do not invent TCEQ docket numbers.
6. If a tool returned \`data: null\` or its caveats include a 'quality' severity 'error', say so explicitly in the synthesis and continue with what you do have.
7. Cite at least three distinct sources inline.`;

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

const AGENT_INSTRUCTIONS = (mode: Mode, headlineStory: string | null) =>
  `# Runtime instructions for this investigation

You are running inside the Dryline web app's investigation flow with full tool-calling agency. ${MODE_FRAMING[mode]}

${
  headlineStory
    ? `Background context the user came in with (treat as the framing, land it concretely in the data):\n> ${headlineStory}\n\n`
    : ""
}You have access to six water-data tools. ALWAYS call resolve_location first to get lat/lng + countyFips for downstream tools. Then choose tools based on what the address and the framing call for; you do not have to call all of them. Aim to finish in 6 or fewer tool calls.

When you have enough data, emit your final assistant text in EXACTLY this structure:

\`\`\`
# Synthesis

<2–4 short paragraphs, ~120–280 words total. Every fact-bearing sentence cites a source from a tool's sources[] using inline markdown links [Source Title](url). End with the required Dryline disclaimer paragraph.>

---
# Action artifact
KIND: <one of: public_comment | watering_reminder | gcd_letter | well_outlook_briefing | pia_request | weekly_briefing>
TITLE: <short title, no markdown>
BODY:
<the drafted artifact, markdown allowed, ~120–250 words. Include "Review before sending." at the top if the artifact is intended for a third party.>
\`\`\`

Hard rules — every one is non-negotiable:
1. Never claim causation. Tensions are flags, not causal claims.
2. Never predict personal impact. Do NOT use "your well may run dry," "your water could become unsafe," or any probabilistic-future-tense phrasing. State the data.
3. Avoid hedging language ("could be," "might affect"). Uncertainty belongs in caveats, not in fuzzy synthesis prose.
4. For public_comment artifacts, cite the actual NPDES permit ID(s) from get_big_users_nearby. Do not invent TCEQ docket numbers.
5. If a tool returns data: null or an error caveat, say so explicitly in the synthesis and continue with what you do have.
6. Cite at least three distinct sources inline.`;

function buildOpenAITools(): Tool[] {
  return drylineTools
    .filter((t) => PUBLISHED_TOOL_NAMES.has(t.name))
    .map((t) => {
      const parameters = zodToJsonSchema(t.inputSchema, {
        $refStrategy: "none",
        target: "openApi3",
      }) as Record<string, unknown>;
      delete parameters.$schema;
      delete parameters.definitions;
      return {
        type: "function",
        name: t.name,
        description: t.description,
        parameters,
        strict: false,
      } as Tool;
    });
}

async function runAgentic(
  address: string,
  mode: Mode,
  headlineStory: string | null,
  writer: StreamWriter,
): Promise<InvestigationCompletion> {
  if (!process.env.OPENAI_API_KEY) {
    writer.emit("error", { message: "OPENAI_API_KEY not set on the server. Add it to web/.env.local." });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const skill = await getSkillPrompt();
  const tools = buildOpenAITools();

  let inputItems: ResponseInput = [
    {
      role: "system",
      content: `${skill}\n\n---\n\n${AGENT_INSTRUCTIONS(mode, headlineStory)}`,
    },
    {
      role: "user",
      content: `Investigate the water situation at this Texas address: ${address}`,
    },
  ];

  const collected: ToolResult<unknown>[] = [];
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), AGENTIC_TIMEOUT_MS);
  let timedOut = false;
  let finalText = "";

  try {
    iterations: for (let iter = 0; iter < AGENTIC_MAX_ITERATIONS; iter++) {
      const stream = (await client.responses.create(
        { model: MODEL, input: inputItems, tools, stream: true, parallel_tool_calls: true },
        { signal: ac.signal },
      )) as unknown as AsyncIterable<ResponseStreamEvent>;

      const pendingCalls = new Map<string, { name: string; argsBuffer: string; emittedStart: boolean }>();
      const newItems: ResponseInputItem[] = [];
      const completedCalls: ResponseFunctionToolCall[] = [];
      let textForThisIter = "";

      for await (const event of stream) {
        switch (event.type) {
          case "response.output_item.added": {
            if (event.item.type === "function_call") {
              pendingCalls.set(event.item.id ?? event.item.call_id, {
                name: event.item.name,
                argsBuffer: "",
                emittedStart: false,
              });
            }
            break;
          }
          case "response.function_call_arguments.delta": {
            const c = pendingCalls.get(event.item_id);
            if (c) c.argsBuffer += event.delta;
            break;
          }
          case "response.function_call_arguments.done": {
            const c = pendingCalls.get(event.item_id);
            if (c && !c.emittedStart) {
              let args: unknown = {};
              try {
                args = c.argsBuffer ? JSON.parse(c.argsBuffer) : {};
              } catch {
                args = c.argsBuffer;
              }
              writer.emit("tool_start", { toolName: c.name, args });
              c.emittedStart = true;
              c.argsBuffer = event.arguments;
            }
            break;
          }
          case "response.output_item.done": {
            if (event.item.type === "function_call") {
              completedCalls.push(event.item);
              newItems.push(event.item);
            } else if (event.item.type === "message") {
              newItems.push(event.item);
            }
            break;
          }
          case "response.output_text.delta":
            textForThisIter += event.delta;
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

      if (completedCalls.length === 0) {
        finalText = textForThisIter || finalText;
        break iterations;
      }

      const dispatched = await Promise.all(
        completedCalls.map(async (call) => {
          let args: unknown = {};
          try {
            args = call.arguments ? JSON.parse(call.arguments) : {};
          } catch {
            args = {};
          }
          const result = await dispatchTool(call.name, args);
          collected.push(result.toolResult);
          writer.emit("tool_result", {
            toolName: call.name,
            summary: result.summary,
            data: result.toolResult.data,
            sources: result.toolResult.sources,
            caveats: result.toolResult.caveats,
          });
          return { call, result };
        }),
      );

      for (const { call, result } of dispatched) {
        newItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result.toolResult),
        });
      }

      inputItems = [...inputItems, ...newItems];
    }
  } catch (err) {
    if (ac.signal.aborted) {
      timedOut = true;
    } else {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      writer.emit("error", { message: `Agentic loop error: ${message}` });
      writer.emit("done", {});
      writer.close();
      return { cacheable: false };
    }
  }
  clearTimeout(timeoutId);

  if (timedOut) {
    writer.emit("error", {
      message: `Agentic loop exceeded ${AGENTIC_TIMEOUT_MS / 1000}s. Drop the ?agent=1 flag to use the deterministic path.`,
    });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
  }

  if (!finalText) {
    writer.emit("error", { message: "Agent produced no synthesis text." });
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
  return { cacheable: true };
}

async function runInvestigation(
  address: string,
  mode: Mode,
  headlineStory: string | null,
  humanScaleHook: string | null,
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

  // Phase 2: parallel-fetch the follow-on tools, deterministically. We
  // emit tool_start/tool_result as each resolves so the trace still
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
      dispatchAndEmit(
        "get_aquifer_status",
        { lat, lng, radiusMi: 20 },
        writer,
        collected,
      ),
    ]);
  }

  // Phase 3: synthesis-only model call.
  const skill = await getSkillPrompt();
  const TOOL_ORDER = [
    "resolve_location",
    "get_drought_status",
    "get_reservoirs",
    "get_drinking_water",
    "get_big_users_nearby",
    "get_aquifer_status",
  ];
  const labeledResults = collected.map((r, i) => ({
    name: TOOL_ORDER[i] ?? "tool",
    result: r,
  }));

  const userMessage = `Investigate the water situation at this Texas address: ${address}

Tool results (already gathered for you):

${formatToolResultsForSynthesis(labeledResults)}`;

  const input: ResponseInput = [
    {
      role: "system",
      content: `${skill}\n\n---\n\n${SYNTHESIS_INSTRUCTIONS(mode, headlineStory, humanScaleHook)}`,
    },
    { role: "user", content: userMessage },
  ];

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // Hard timeout on the synthesis call. We've seen single OpenAI calls hang
  // for 2–3 minutes on otherwise-normal requests — unacceptable for a live
  // demo. Abort and emit a graceful error if the model has not finished
  // streaming within the budget.
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), SYNTHESIS_TIMEOUT_MS);

  let stream: AsyncIterable<ResponseStreamEvent>;
  try {
    stream = (await client.responses.create(
      {
        model: MODEL,
        input,
        stream: true,
      },
      { signal: ac.signal },
    )) as unknown as AsyncIterable<ResponseStreamEvent>;
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    writer.emit("error", { message: `OpenAI call failed: ${message}` });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
  }

  let finalText = "";
  let timedOut = false;
  try {
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
  } catch (err) {
    if (ac.signal.aborted) {
      timedOut = true;
    } else {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      writer.emit("error", { message: `Stream error: ${message}` });
      writer.emit("done", {});
      writer.close();
      return { cacheable: false };
    }
  }
  clearTimeout(timeoutId);

  if (timedOut) {
    writer.emit("error", {
      message: `Synthesis exceeded ${SYNTHESIS_TIMEOUT_MS / 1000}s. OpenAI is slow right now — retry in a few seconds, or hit cache from a prior run.`,
    });
    writer.emit("done", {});
    writer.close();
    return { cacheable: false };
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
  let headlineStory: string | null = null;
  let humanScaleHook: string | null = null;
  try {
    const body = (await req.json()) as {
      address?: unknown;
      mode?: unknown;
      headlineStory?: unknown;
      humanScaleHook?: unknown;
    };
    if (typeof body.address !== "string" || body.address.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "Body must be { address: string, mode?: 'personal'|'transparency', headlineStory?: string, humanScaleHook?: string }",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    address = body.address.trim();
    if (body.mode === "transparency" || body.mode === "personal") {
      mode = body.mode;
    }
    if (typeof body.headlineStory === "string" && body.headlineStory.trim().length > 0) {
      headlineStory = body.headlineStory.trim();
    }
    if (typeof body.humanScaleHook === "string" && body.humanScaleHook.trim().length > 0) {
      humanScaleHook = body.humanScaleHook.trim();
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const useAgentic = url.searchParams.get("agent") === "1";
  const cacheKey = `${useAgentic ? "agent" : "det"}::${mode}::${address.toLowerCase()}`;
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
        const completion = useAgentic
          ? await runAgentic(address, mode, headlineStory, writer)
          : await runInvestigation(address, mode, headlineStory, humanScaleHook, writer);
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
