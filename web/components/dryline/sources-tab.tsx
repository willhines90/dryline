"use client";

import * as React from "react";
import type { Source, TraceEvent } from "@/lib/types";

/**
 * Aggregated sources list across all tool_results in the active
 * investigation. De-duplicated by URL, ordered by the tool that
 * produced them. Lives as the third tab in the right panel so the
 * synthesis stays clean.
 */
export function SourcesTab({ traces }: { traces: TraceEvent[] }) {
  const grouped = React.useMemo(() => {
    const out: Array<{ toolName: string; summary: string; sources: Source[] }> = [];
    const seenUrls = new Set<string>();
    for (const ev of traces) {
      if (ev.type !== "tool_result") continue;
      const fresh = ev.sources.filter((s) => !seenUrls.has(s.url));
      for (const s of fresh) seenUrls.add(s.url);
      if (fresh.length === 0) continue;
      out.push({ toolName: ev.toolName, summary: ev.summary, sources: fresh });
    }
    return out;
  }, [traces]);

  if (grouped.length === 0) {
    return (
      <p className="font-serif italic text-tideline text-[14px]">
        No sources cited yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((g, gi) => (
        <section key={gi}>
          <div className="dryline-label">{g.toolName}</div>
          <p className="font-serif italic text-[12.5px] text-tideline leading-snug mt-0.5">
            {g.summary}
          </p>
          <ol className="font-serif text-[13.5px] leading-snug list-decimal pl-5 mt-1.5 space-y-1">
            {g.sources.map((s, i) => (
              <li key={`${s.url}-${i}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tide underline decoration-dotted underline-offset-2 hover:bg-foam"
                  title={`Retrieved ${s.retrievedAt.slice(0, 10)}`}
                >
                  {s.title}
                </a>
                {s.publisher ? (
                  <span className="text-tideline"> — {s.publisher}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
