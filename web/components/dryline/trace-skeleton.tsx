"use client";

import * as React from "react";

/**
 * Skeleton frame shown for the first ~1 s of an investigation, before
 * the first tool_start event lands and ReasoningTrace takes over.
 * Three pulsing rows that feel like the trace about to populate.
 */
export function TraceSkeleton() {
  return (
    <div className="border-y border-rule bg-paper-deep -mx-6 px-6 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="dryline-label">Reasoning trace</span>
        <span className="font-mono text-[9.5px] tracking-[0.18em] text-tideline">
          starting…
        </span>
      </div>
      <ol className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="grid gap-3 grid-cols-[14px_1fr]" style={{ opacity: 1 - i * 0.25 }}>
            <span aria-hidden className="inline-block w-2 h-2 rounded-full mt-2 shrink-0 bg-tideline/60 animate-dryline-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            <div className="min-w-0 space-y-1.5">
              <div className="h-3 w-1/2 bg-rule animate-dryline-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              <div className="h-2 w-1/3 bg-rule-soft animate-dryline-pulse" style={{ animationDelay: `${i * 200 + 100}ms` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
