"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  idle: "READY",
  streaming: "INVESTIGATING",
  done: "INVESTIGATION COMPLETE",
  error: "INVESTIGATION ERROR",
};

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Bottom strip showing investigation phase, source count, and date — pulled
 * from the design's StatusFooter. Sticks to the page bottom and uses the
 * same backdrop-blur as the top bar.
 */
export function StatusFooter() {
  const { status, traces, synthesis } = useInvestigation();
  const sourceCount =
    synthesis?.sources.length ??
    traces.reduce((n, t) => (t.type === "tool_result" ? n + t.sources.length : n), 0);
  const phase = PHASE_LABEL[status] ?? "READY";
  const isActive = status === "streaming";

  return (
    <footer
      className={cn(
        "border-t border-border bg-background/95 backdrop-blur-sm",
        "px-6 py-2 flex items-center justify-between",
        "font-mono text-[10px] tracking-[0.16em] text-muted-foreground",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "w-1.5 h-1.5 rounded-full bg-aquifer",
            isActive ? "animate-dryline-pulse" : "",
          )}
        />
        <span>{phase}</span>
      </div>
      <div>
        {sourceCount} SOURCE{sourceCount === 1 ? "" : "S"} · CITED
      </div>
      <div className="hidden sm:block">PUBLIC TEXAS WATER DATA · {TODAY}</div>
    </footer>
  );
}
