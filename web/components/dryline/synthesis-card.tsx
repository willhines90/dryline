"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import { Markdown } from "@/lib/markdown";

export function SynthesisCard() {
  const { synthesis } = useInvestigation();
  if (!synthesis) return null;

  return (
    <article className="rounded-lg border border-border bg-arid-50 px-5 py-4 shadow-sm">
      <Markdown text={synthesis.markdown} />
      {synthesis.sources.length > 0 ? (
        <div className="mt-5 pt-3 border-t border-border/70">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            All sources
          </div>
          <ol className="text-xs space-y-1 list-decimal pl-5">
            {synthesis.sources.map((s, i) => (
              <li key={`${s.url}-${i}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-reservoir-700 underline decoration-reservoir-300 underline-offset-2 hover:bg-reservoir-50 rounded px-0.5"
                  title={`Retrieved ${s.retrievedAt.slice(0, 10)}`}
                >
                  {s.title}
                </a>
                {s.publisher ? (
                  <span className="text-muted-foreground"> — {s.publisher}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}
