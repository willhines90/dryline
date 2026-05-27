"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import type { Caveat, Source, ToolStartEvent, ToolResultEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Plain-English labels for each tool, per Phase 4.5 Section A3 — these
 * sit above the monospace `tool_name(...)` line so a non-technical viewer
 * can follow the trace without parsing the API.
 */
const TOOL_LABELS: Record<string, string> = {
  resolve_location: "Locating the address",
  get_drought_status: "Checking drought conditions",
  get_reservoirs: "Pulling nearby reservoir levels",
  get_drinking_water: "Looking up the public water system",
  get_big_users_nearby: "Finding industrial water permits nearby",
  get_aquifer_status: "Reading the aquifer beneath this address",
};

function formatArgs(args: unknown): string {
  if (args == null) return "";
  if (typeof args === "string") return args;
  try {
    const obj = args as Record<string, unknown>;
    const parts = Object.entries(obj).map(([k, v]) => {
      if (typeof v === "string") return `${k}: "${truncate(v, 32)}"`;
      if (typeof v === "number" || typeof v === "boolean") return `${k}: ${v}`;
      return `${k}: ${JSON.stringify(v)}`;
    });
    return parts.join(", ");
  } catch {
    return JSON.stringify(args);
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function severityColor(severity: Caveat["severity"]): string {
  if (severity === "error") return "text-rust border-rust bg-[#f3dcd2]";
  if (severity === "warning") return "text-ochre-deep border-ochre-deep bg-[#f1e3c6]";
  return "text-tideline border-rule bg-paper-deep";
}

/**
 * Plain-language label for each caveat category. The structured tag
 * (`freshness`, `bounds`, etc.) is useful in code but baffling on
 * screen — show a human phrase instead.
 */
function categoryLabel(c: Caveat["category"]): string {
  switch (c) {
    case "freshness":
      return "How fresh";
    case "quality":
      return "Data quality";
    case "bounds":
      return "Coverage limit";
    case "inference":
      return "What this does NOT say";
    case "other":
    case undefined:
    default:
      return "Note";
  }
}

/**
 * One-line tooltip describing a category so a curious user can still
 * see the underlying taxonomy.
 */
function categoryHint(c: Caveat["category"]): string {
  switch (c) {
    case "freshness":
      return "When the data was last refreshed by its source.";
    case "quality":
      return "Known data-quality limitations of this source.";
    case "bounds":
      return "What this dataset does or doesn't cover.";
    case "inference":
      return "An interpretation rule: e.g. correlation ≠ causation, permitted ≠ polluting.";
    case "other":
    case undefined:
    default:
      return "Additional context from the data source.";
  }
}

function severityDot(severity: Caveat["severity"]): string {
  if (severity === "error") return "bg-rust";
  if (severity === "warning") return "bg-ochre-deep";
  return "bg-tideline";
}

function CitationChip({ index, source }: { index: number; source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.title} · retrieved ${source.retrievedAt.slice(0, 10)}`}
      className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1 border border-rule bg-paper text-tide text-[10px] font-mono hover:border-tide hover:bg-foam transition-colors"
    >
      [{index}]
    </a>
  );
}

function ResultBlock({ result }: { result: ToolResultEvent }) {
  return (
    <div className="pl-6 mt-1 space-y-2">
      <div className="font-serif text-[14px] text-ink leading-snug">{result.summary}</div>
      {result.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="dryline-label mr-1">sources</span>
          {result.sources.map((s, i) => (
            <CitationChip key={`${s.url}-${i}`} index={i + 1} source={s} />
          ))}
        </div>
      ) : null}
      {result.caveats.length > 0 ? (
        <ul className="space-y-1.5">
          {result.caveats.map((c, i) => (
            <li
              key={i}
              className={cn(
                "border px-2 py-1.5 flex gap-2 items-start",
                severityColor(c.severity),
              )}
            >
              <span
                aria-hidden
                className={cn("inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", severityDot(c.severity))}
              />
              <span className="min-w-0 flex-1">
                <span
                  className="block font-mono text-[9.5px] tracking-[0.14em] uppercase"
                  title={categoryHint(c.category)}
                >
                  {categoryLabel(c.category)}
                </span>
                <span className="block font-serif text-[12.5px] text-ink/90 leading-snug mt-0.5">
                  {c.message}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusDot({ state }: { state: "running" | "done" | "pending" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block w-2 h-2 rounded-full mt-2 shrink-0",
        state === "done" && "bg-kelp",
        state === "running" && "bg-aquifer animate-dryline-pulse",
        state === "pending" && "bg-transparent border border-rule",
      )}
    />
  );
}

export function ReasoningTrace() {
  const { traces, status } = useInvestigation();

  // Pair tool_start with its tool_result.
  const grouped: Array<{ start: ToolStartEvent; result: ToolResultEvent | null }> = [];
  for (const ev of traces) {
    if (ev.type === "tool_start") {
      grouped.push({ start: ev, result: null });
    } else if (ev.type === "tool_result") {
      for (let i = grouped.length - 1; i >= 0; i--) {
        if (grouped[i]!.result == null && grouped[i]!.start.toolName === ev.toolName) {
          grouped[i]!.result = ev;
          break;
        }
      }
    }
  }

  if (traces.length === 0) {
    return (
      <div className="font-mono text-[11px] text-tideline border-y border-rule bg-paper-deep px-4 py-3">
        Waiting for the first tool call…
      </div>
    );
  }

  const doneCount = grouped.filter((g) => g.result != null).length;

  return (
    <div className="border-y border-rule bg-paper-deep -mx-6 px-6 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="dryline-label">Reasoning trace</span>
        <span className="font-mono text-[9.5px] tracking-[0.18em] text-tideline">
          {doneCount}/{grouped.length}
        </span>
      </div>
      <ol className="space-y-3">
        {grouped.map((g, i) => {
          const state = g.result
            ? "done"
            : status === "streaming" && i === grouped.length - 1
            ? "running"
            : "pending";
          const friendlyLabel = TOOL_LABELS[g.start.toolName] ?? g.start.toolName;
          return (
            <li
              key={i}
              className={cn(
                "grid gap-3",
                "grid-cols-[14px_1fr]",
                state === "pending" && "opacity-40",
              )}
            >
              <StatusDot state={state} />
              <div className="min-w-0">
                <div className="font-serif text-[15px] text-ink leading-tight">
                  {friendlyLabel}
                </div>
                <div className="font-mono text-[10.5px] text-tideline mt-0.5 truncate">
                  <span className="text-aquifer">{g.start.toolName}</span>
                  <span>({formatArgs(g.start.args)})</span>
                </div>
                {g.result ? <ResultBlock result={g.result} /> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
