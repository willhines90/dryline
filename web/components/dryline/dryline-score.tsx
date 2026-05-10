"use client";

import * as React from "react";
import type { ScorePayload, SubscoreKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DrylineScoreProps {
  score: ScorePayload;
  className?: string;
}

const SUBSCORE_LABELS: Record<SubscoreKey, string> = {
  drought: "Drought",
  aquifer: "Aquifer",
  drinkingWater: "Drinking water",
  industrial: "Industrial",
  reservoir: "Reservoir",
};

/** 0–30 cool blue, 30–60 amber, 60–100 rust. */
function bandColors(value: number): { bar: string; chip: string; text: string } {
  if (value >= 60) return { bar: "bg-rust", chip: "bg-rust/15 text-rust", text: "text-rust" };
  if (value >= 30) return { bar: "bg-ochre", chip: "bg-ochre/15 text-ochre-deep", text: "text-ochre-deep" };
  return { bar: "bg-tide", chip: "bg-tide/15 text-tide", text: "text-tide" };
}

export function DrylineScore({ score, className }: DrylineScoreProps) {
  const [open, setOpen] = React.useState(false);
  const total = score.score;
  const totalColors = bandColors(total);

  const order: SubscoreKey[] = ["drought", "aquifer", "drinkingWater", "industrial", "reservoir"];

  return (
    <section
      className={cn(
        "border border-rule bg-card px-4 py-3",
        "shadow-paper",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <div className="dryline-label mb-1">Dryline Score</div>
          <div
            className={cn(
              "font-serif font-medium leading-none tracking-[-0.025em]",
              "text-[56px]",
              totalColors.text,
            )}
            aria-label={`Dryline Score ${total} out of 100`}
          >
            {total}
            <span className="font-mono text-tideline text-[15px] tracking-[0.02em] ml-1">/100</span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase mt-1 text-tideline">
            {total >= 60 ? "High stress" : total >= 30 ? "Moderate stress" : "Low stress"}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {order.map((k) => {
            const v = score.subscores[k];
            const colors = bandColors(v);
            return (
              <div key={k} className="text-[12px]">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-tideline">
                    {SUBSCORE_LABELS[k]}
                  </span>
                  <span className={cn("font-mono text-[11px]", colors.text)}>
                    {v}
                  </span>
                </div>
                <div className="h-2 bg-paper-deep overflow-hidden">
                  <div
                    className={cn("h-full", colors.bar)}
                    style={{ width: `${v}%` }}
                    title={score.rationale[k]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 font-mono text-[9.5px] tracking-[0.16em] uppercase text-tideline hover:text-ink underline-offset-2 underline decoration-dotted"
        aria-expanded={open}
      >
        {open ? "Hide methodology ↑" : "Why this number? ↓"}
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-dashed border-rule pt-3">
          <p
            className="font-serif text-[13.5px] leading-relaxed text-ink/85 [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{
              __html: score.methodology.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
            }}
          />
          <div className="space-y-1.5">
            {order.map((k) => (
              <div key={k} className="text-[12.5px] leading-snug">
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-tideline mr-1.5">
                  {SUBSCORE_LABELS[k]}
                </span>
                <span className="font-serif text-ink/85">{score.rationale[k]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
