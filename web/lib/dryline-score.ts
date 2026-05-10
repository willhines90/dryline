/**
 * Dryline Score — single 0–100 number per investigation.
 *
 * Reductive on purpose: judges screenshot single numbers; they don't
 * screenshot paragraphs. Higher = more water stress.
 *
 * Methodology: five subscores, equally weighted, averaged. Each subscore
 * is bounded 0–100. The total is the integer mean. Subscores that can't
 * be computed (e.g. no monitoring well in range) score 50, neutral, with
 * a caveat noted.
 *
 * The full English methodology is exposed via `methodology` so the UI
 * can surface it on hover/tap; users can decide whether the score
 * deserves their trust.
 */

import type { ToolResult } from "@dryline/mcp/types";

export type SubscoreKey =
  | "drought"
  | "aquifer"
  | "drinkingWater"
  | "industrial"
  | "reservoir";

export interface DrylineScore {
  /** Mean of the five subscores, rounded to integer. 0–100. */
  score: number;
  subscores: Record<SubscoreKey, number>;
  /** Per-subscore reasoning for the UI tooltip / "why this number" panel. */
  rationale: Record<SubscoreKey, string>;
  /** Plain-English methodology paragraph for the README + hover. */
  methodology: string;
}

const METHODOLOGY = `Composite of 5 public-data subscores, equally weighted: \
**drought** (current US Drought Monitor category for the county), \
**aquifer** (decadal depth-to-water trend at the nearest TWDB \
monitoring well), **drinking water** (current Safe Drinking Water Act \
violations weighted toward health-based ones), **industrial** (count of \
individual NPDES dischargers within 15 mi), and **reservoir** (current \
% full at the nearest TWDB instrumented reservoir vs same-day-of-year \
historical mean). Each subscore is bounded 0–100; the Dryline Score \
is their integer mean. Subscores with no available data default to 50 \
(neutral) and the rationale records the gap. Reductive by design — \
the single number is the lede; click through to read the cited synthesis.`;

interface RawTool {
  name: string;
  result: ToolResult<unknown>;
}

function pickResult(raws: RawTool[], name: string): ToolResult<unknown> | null {
  const r = raws.find((x) => x.name === name);
  return r ? r.result : null;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function scoreDrought(raws: RawTool[]): { score: number; rationale: string } {
  const r = pickResult(raws, "get_drought_status");
  const data = r?.data as { category?: string } | null | undefined;
  const cat = data?.category ?? null;
  const map: Record<string, number> = { None: 0, D0: 20, D1: 40, D2: 60, D3: 80, D4: 100 };
  if (cat && cat in map) {
    return {
      score: map[cat]!,
      rationale: `USDM category ${cat} → ${map[cat]} (None=0, D0=20, D1=40, D2=60, D3=80, D4=100).`,
    };
  }
  return { score: 50, rationale: "No drought category available; defaulted to 50 (neutral)." };
}

function scoreAquifer(raws: RawTool[]): { score: number; rationale: string } {
  const r = pickResult(raws, "get_aquifer_status");
  const data = r?.data as
    | { monitoringWell?: { decadalTrendFtPerYear?: number; stateWellId?: string } | null }
    | null
    | undefined;
  const well = data?.monitoringWell ?? null;
  if (!well || typeof well.decadalTrendFtPerYear !== "number") {
    return {
      score: 50,
      rationale: "No monitoring well within radius; defaulted to 50 (neutral).",
    };
  }
  const t = well.decadalTrendFtPerYear;
  let s: number;
  if (t <= 0) s = 0;
  else if (t <= 0.5) s = 30 * (t / 0.5);
  else if (t <= 1.0) s = 30 + 20 * ((t - 0.5) / 0.5);
  else if (t <= 1.5) s = 50 + 20 * ((t - 1.0) / 0.5);
  else if (t <= 2.0) s = 70 + 20 * ((t - 1.5) / 0.5);
  else s = 90;
  s = clamp(Math.round(s));
  return {
    score: s,
    rationale: `Nearest well ${well.stateWellId ?? "?"} trend ${t.toFixed(2)} ft/yr → ${s} (≤0 rising = 0; 0.5 = 30; 1.0 = 50; 1.5 = 70; 2.0+ = 90).`,
  };
}

function scoreDrinkingWater(raws: RawTool[]): { score: number; rationale: string } {
  const r = pickResult(raws, "get_drinking_water");
  const data = r?.data as
    | {
        systems?: Array<{
          pwsName?: string;
          compliance?: {
            healthBasedCurrent?: boolean;
            monitoringReportingCurrent?: boolean;
            publicNotificationCurrent?: boolean;
            otherCurrent?: boolean;
            rulesViolatedLast3yr?: number;
          };
        }>;
      }
    | null
    | undefined;
  const sys = data?.systems?.[0];
  if (!sys || !sys.compliance) {
    return {
      score: 50,
      rationale: "No primary public water system result; defaulted to 50 (neutral).",
    };
  }
  const c = sys.compliance;
  const procCount = [
    c.monitoringReportingCurrent,
    c.publicNotificationCurrent,
    c.otherCurrent,
  ].filter(Boolean).length;
  const healthCount = c.healthBasedCurrent ? 1 : 0;
  const ruleCount = c.rulesViolatedLast3yr ?? 0;
  const raw = healthCount * 30 + procCount * 10 + ruleCount * 5;
  const s = clamp(raw);
  return {
    score: s,
    rationale: `${sys.pwsName ?? "Primary system"}: ${healthCount} health-based × 30 + ${procCount} procedural × 10 + ${ruleCount} rules-3yr × 5 = ${s}.`,
  };
}

function scoreIndustrial(raws: RawTool[]): { score: number; rationale: string } {
  const r = pickResult(raws, "get_big_users_nearby");
  const data = r?.data as
    | { facilities?: Array<{ permitCategory?: string }> }
    | null
    | undefined;
  const list = data?.facilities ?? [];
  const indCount = list.filter((f) => f.permitCategory === "individual_npdes").length;
  let s: number;
  if (indCount === 0) s = 0;
  else if (indCount === 1) s = 20;
  else if (indCount <= 3) s = 40;
  else if (indCount <= 6) s = 60;
  else s = 80;
  return {
    score: s,
    rationale: `${indCount} individual NPDES discharger${indCount === 1 ? "" : "s"} within 15 mi → ${s} (0→0, 1→20, 2-3→40, 4-6→60, 7+→80).`,
  };
}

function scoreReservoir(raws: RawTool[]): { score: number; rationale: string } {
  const r = pickResult(raws, "get_reservoirs");
  const data = r?.data as
    | {
        reservoirs?: Array<{
          name?: string;
          currentPct?: number;
          historicalAvgPct?: number | null;
          distanceMi?: number;
        }>;
      }
    | null
    | undefined;
  const list = data?.reservoirs ?? [];
  // "Nearest" = first in list (the tool already sorts by distance).
  const nearest = list[0];
  if (!nearest || typeof nearest.currentPct !== "number" || !nearest.historicalAvgPct) {
    return {
      score: 50,
      rationale: "No instrumented reservoir within 50 mi (or no historical avg); defaulted to 50 (neutral).",
    };
  }
  const ratio = nearest.currentPct / nearest.historicalAvgPct;
  let s: number;
  if (ratio >= 1.05) s = 0;
  else if (ratio >= 1.0) s = 20 * (1.05 - ratio) / 0.05;
  else if (ratio >= 0.85) s = 20 + 20 * ((1.0 - ratio) / 0.15);
  else if (ratio >= 0.7) s = 40 + 20 * ((0.85 - ratio) / 0.15);
  else if (ratio >= 0.55) s = 60 + 20 * ((0.7 - ratio) / 0.15);
  else if (ratio >= 0.4) s = 80 + 20 * ((0.55 - ratio) / 0.15);
  else s = 100;
  s = clamp(Math.round(s));
  return {
    score: s,
    rationale: `${nearest.name ?? "nearest reservoir"} ${nearest.currentPct}% current vs ${nearest.historicalAvgPct}% historical (ratio ${ratio.toFixed(2)}) → ${s}.`,
  };
}

export function computeDrylineScore(toolResults: RawTool[]): DrylineScore {
  const drought = scoreDrought(toolResults);
  const aquifer = scoreAquifer(toolResults);
  const drinkingWater = scoreDrinkingWater(toolResults);
  const industrial = scoreIndustrial(toolResults);
  const reservoir = scoreReservoir(toolResults);

  const subscores: Record<SubscoreKey, number> = {
    drought: drought.score,
    aquifer: aquifer.score,
    drinkingWater: drinkingWater.score,
    industrial: industrial.score,
    reservoir: reservoir.score,
  };

  const score = Math.round(
    (drought.score + aquifer.score + drinkingWater.score + industrial.score + reservoir.score) / 5,
  );

  return {
    score,
    subscores,
    rationale: {
      drought: drought.rationale,
      aquifer: aquifer.rationale,
      drinkingWater: drinkingWater.rationale,
      industrial: industrial.rationale,
      reservoir: reservoir.rationale,
    },
    methodology: METHODOLOGY,
  };
}
