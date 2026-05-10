"use client";

import * as React from "react";
import { useMultiInvestigation } from "./investigation-provider";
import { cn } from "@/lib/utils";

/**
 * Header switch for `?agent=1`. When ON, every fresh investigation
 * fires the real Responses-API tool-calling loop (the model decides
 * which tools to call) instead of the deterministic fan-out. Slower
 * + more variable, but the agent's judgment is on stage. Off by
 * default; persisted to localStorage.
 */
export function AgenticToggle({ className }: { className?: string }) {
  const { agenticMode, setAgenticMode } = useMultiInvestigation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={agenticMode}
      onClick={() => setAgenticMode(!agenticMode)}
      title={
        agenticMode
          ? "Agentic mode ON — the LLM picks tools each run. Slower (≈30 s) but visibly agentic."
          : "Agentic mode OFF — deterministic 7-tool fan-out (≈18 s, demo-stable)."
      }
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-rule",
        "font-mono text-[10px] tracking-[0.18em] uppercase",
        agenticMode
          ? "bg-aquifer text-paper border-aquifer"
          : "bg-transparent text-tideline hover:text-ink hover:border-ink/40",
        className,
      )}
    >
      <span aria-hidden>{agenticMode ? "●" : "○"}</span>
      Agentic
    </button>
  );
}
