"use client";

import * as React from "react";
import { useMultiInvestigation } from "./investigation-provider";
import type { ScorePayload, SubscoreKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUBSCORE_LABELS: Record<SubscoreKey, string> = {
  drought: "Drought",
  aquifer: "Aquifer",
  drinkingWater: "Drinking",
  industrial: "Industrial",
  reservoir: "Reservoir",
};

function bandText(value: number): string {
  if (value >= 60) return "text-rust";
  if (value >= 30) return "text-ochre-deep";
  return "text-tide";
}

interface DeltaRow {
  key: SubscoreKey;
  primary: number;
  secondary: number;
  delta: number;
}

function deltas(p: ScorePayload, s: ScorePayload): DeltaRow[] {
  const keys: SubscoreKey[] = ["drought", "aquifer", "drinkingWater", "industrial", "reservoir"];
  return keys
    .map((k) => ({
      key: k,
      primary: p.subscores[k],
      secondary: s.subscores[k],
      delta: Math.abs(p.subscores[k] - s.subscores[k]),
    }))
    .sort((a, b) => b.delta - a.delta);
}

/**
 * The compare-mode hero strip. Renders above both InvestigationPanels
 * once both slots have a score. This is the screenshot a judge shares.
 */
export function ComparisonHero() {
  const { primary, secondary, compareMode } = useMultiInvestigation();
  if (!compareMode) return null;
  if (!primary.score || !secondary.score) return null;
  if (!primary.location || !secondary.location) return null;

  const ranked = deltas(primary.score, secondary.score);
  const topThree = ranked.slice(0, 3);

  return (
    <section
      className={cn(
        "border border-ink bg-paper px-5 py-4 shadow-paper",
        "animate-dryline-slide",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="dryline-label">Comparison</span>
        <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-tideline">
          Δ ranked
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_28px_1fr] items-center gap-3">
        <ScoreCell
          label={primary.location.city}
          sub={primary.location.county + " · " + (primary.mode ?? "personal")}
          score={primary.score.score}
        />
        <div className="flex items-center justify-center">
          <div className="h-px w-full bg-rule" aria-hidden />
          <span
            aria-hidden
            className="font-mono text-[10px] tracking-[0.16em] uppercase text-tideline px-1 bg-paper"
          >
            vs
          </span>
          <div className="h-px w-full bg-rule" aria-hidden />
        </div>
        <ScoreCell
          label={secondary.location.city}
          sub={secondary.location.county + " · " + (secondary.mode ?? "personal")}
          score={secondary.score.score}
          align="right"
        />
      </div>

      <div className="mt-4 pt-3 border-t border-dashed border-rule space-y-1.5">
        <div className="dryline-label">Biggest deltas</div>
        {topThree.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[80px_1fr_44px_1fr_44px] items-center gap-2 font-mono text-[11px]"
          >
            <span className="text-tideline tracking-[0.12em] uppercase">
              {SUBSCORE_LABELS[row.key]}
            </span>
            <Bar value={row.primary} align="right" />
            <span className={cn("text-right", bandText(row.primary))}>{row.primary}</span>
            <Bar value={row.secondary} align="left" />
            <span className={bandText(row.secondary)}>{row.secondary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoreCell({
  label,
  sub,
  score,
  align = "left",
}: {
  label: string;
  sub: string;
  score: number;
  align?: "left" | "right";
}) {
  return (
    <div className={cn(align === "right" ? "text-right" : "text-left")}>
      <div className="dryline-label truncate">{sub}</div>
      <div className="font-serif text-[20px] font-medium leading-tight tracking-[-0.01em] mt-0.5">
        {label}
      </div>
      <div
        className={cn(
          "font-serif font-medium tracking-[-0.02em] leading-none mt-2 text-[44px]",
          bandText(score),
        )}
      >
        {score}
        <span className="font-mono text-[14px] tracking-[0.02em] text-tideline ml-0.5">
          /100
        </span>
      </div>
    </div>
  );
}

function Bar({ value, align }: { value: number; align: "left" | "right" }) {
  const colors = bandText(value).replace("text-", "bg-");
  return (
    <div className={cn("h-1.5 bg-paper-deep", align === "right" ? "" : "")}>
      <div
        className={cn("h-full", colors)}
        style={{
          width: `${value}%`,
          marginLeft: align === "right" ? "auto" : 0,
        }}
      />
    </div>
  );
}
