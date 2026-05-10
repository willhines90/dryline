"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import type { Caveat, Source, ToolStartEvent, ToolResultEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  if (severity === "error") return "text-red-700 bg-red-50";
  if (severity === "warning") return "text-amber-800 bg-amber-50";
  return "text-foreground/70 bg-arid-100";
}

function CitationChip({ index, source }: { index: number; source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.title} · retrieved ${source.retrievedAt.slice(0, 10)}`}
      className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded text-[10px] font-mono px-1 border border-reservoir-100 bg-reservoir-50 text-reservoir-700 hover:bg-reservoir-100 transition-colors"
    >
      [{index}]
    </a>
  );
}

function ResultBlock({ result }: { result: ToolResultEvent }) {
  return (
    <div className="pl-5 mt-1 space-y-1.5 text-xs">
      <div className="text-foreground/85">{result.summary}</div>
      {result.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mr-1">
            sources
          </span>
          {result.sources.map((s, i) => (
            <CitationChip key={`${s.url}-${i}`} index={i + 1} source={s} />
          ))}
        </div>
      ) : null}
      {result.caveats.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {result.caveats.map((c, i) => (
            <span
              key={i}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                severityColor(c.severity),
              )}
              title={c.message}
            >
              {c.severity}
              {c.category ? ` · ${c.category}` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReasoningTrace() {
  const { traces, status } = useInvestigation();
  const lastIsToolStart =
    traces.length > 0 && traces[traces.length - 1]!.type === "tool_start";
  const showActivePulse = status === "streaming" && lastIsToolStart;

  // Pair tool_start with its tool_result for rendering.
  const grouped: Array<{ start: ToolStartEvent; result: ToolResultEvent | null }> = [];
  for (const ev of traces) {
    if (ev.type === "tool_start") {
      grouped.push({ start: ev, result: null });
    } else if (ev.type === "tool_result") {
      // attach to the most-recent unresolved start with the same toolName
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
      <div className="font-mono text-xs text-muted-foreground">
        Waiting for the first tool call…
      </div>
    );
  }

  return (
    <ol className="space-y-3 font-mono text-xs">
      {grouped.map((g, i) => (
        <li key={i}>
          <div className="flex items-baseline gap-2">
            {g.result == null && showActivePulse && i === grouped.length - 1 ? (
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-reservoir-500 animate-pulse"
              />
            ) : (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            )}
            <span className="text-foreground">
              {g.start.toolName}
              <span className="text-muted-foreground">({formatArgs(g.start.args)})</span>
            </span>
          </div>
          {g.result ? <ResultBlock result={g.result} /> : null}
        </li>
      ))}
    </ol>
  );
}
