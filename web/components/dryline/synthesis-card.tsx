"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import { Markdown } from "@/lib/markdown";

/**
 * The cited synthesis card. Editorial layout per the design — small
 * uppercase mono label, Newsreader serif body, sources footer with a
 * dashed top border.
 */
export function SynthesisCard() {
  const { synthesis } = useInvestigation();
  if (!synthesis) return null;

  return (
    <article className="border border-rule bg-card px-6 py-5 shadow-paper">
      <div className="dryline-label mb-2">Synthesis</div>
      <div className="dryline-body">
        <Markdown text={synthesis.markdown} />
      </div>
      {synthesis.sources.length > 0 ? (
        <div className="mt-5 pt-3 border-t border-dashed border-rule">
          <div className="dryline-label mb-1.5">All sources</div>
          <ol className="font-serif text-[13.5px] leading-snug list-decimal pl-5 space-y-0.5">
            {synthesis.sources.map((s, i) => (
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
        </div>
      ) : null}
    </article>
  );
}
