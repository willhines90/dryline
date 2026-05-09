/**
 * get_reservoirs — nearby major reservoirs with current % full, trend, and a
 * same-calendar-day historical average.
 *
 * Source: TWDB Water Data for Texas (waterdatafortexas.org).
 *   - `/reservoirs/api/instantaneous` (GeoJSON) for slug + lat/lng index.
 *   - `/reservoirs/individual/<slug>.csv` for the daily history series.
 *
 * Trend is computed against the value 14 days prior; threshold ±0.5 pct
 * separates "rising" / "falling" from "steady". Historical average is the
 * mean of `percent_full` rows whose calendar day-of-year is within ±15 days
 * of today, across the full available record (typically back to the 1960s).
 */

import { z } from "zod";
import type { Caveat, DrylineTool, Source } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";
import {
  haversineMiles,
  instantaneousSource,
  loadReservoirHistory,
  loadReservoirIndex,
  reservoirPageUrl,
} from "../lib/twdb.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(200).default(50),
});

type Input = z.infer<typeof inputSchema>;

interface ReservoirObservation {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  /** Distance from the query point, statute miles. */
  distanceMi: number;
  /** % of conservation capacity currently stored, 0–100. */
  currentPct: number;
  /** Mean percent_full for this calendar day-of-year (±15 days), full record. */
  historicalAvgPct: number | null;
  trend: "rising" | "falling" | "steady";
  /** Date of the most recent daily reading, YYYY-MM-DD. */
  lastUpdated: string;
}

interface ReservoirsOutput {
  reservoirs: ReservoirObservation[];
}

const TREND_LOOKBACK_DAYS = 14;
const TREND_THRESHOLD_PCT = 0.5;
const HIST_WINDOW_DAYS = 15;
const STALE_DAYS = 7;

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff =
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

function circularDayDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 366 - raw);
}

export const getReservoirs: DrylineTool<Input, ReservoirsOutput> = {
  name: "get_reservoirs",
  description:
    "List major Texas reservoirs within a radius of a point, with current % full vs same-day-of-year historical average, recent trend, and last reading date. Source: TWDB Water Data for Texas. Call resolve_location first to get lat/lng.",
  inputSchema,
  run: async ({ lat, lng, radiusMi }) => {
    try {
      const index = await loadReservoirIndex();
      const candidates = index
        .map((entry) => ({ ...entry, distanceMi: haversineMiles({ lat, lng }, entry) }))
        .filter((entry) => entry.distanceMi <= radiusMi)
        .sort((a, b) => a.distanceMi - b.distanceMi);

      if (candidates.length === 0) {
        return {
          data: { reservoirs: [] },
          caveats: [
            boundsCaveat(
              `No instrumented major reservoirs within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)}). TWDB's instantaneous feed covers ~37 reservoirs; smaller minor-system reservoirs are not included.`,
            ),
          ],
          sources: [instantaneousSource()],
        };
      }

      const todayDoy = dayOfYear(new Date());
      const observations: ReservoirObservation[] = [];
      const perReservoirSources: Source[] = [];
      const partialFailures: string[] = [];
      const staleReservoirs: { name: string; lastUpdated: string }[] = [];

      const histories = await Promise.all(
        candidates.map(async (c) => {
          try {
            return {
              entry: c,
              history: await loadReservoirHistory(c.slug),
              error: null as null | string,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { entry: c, history: [], error: msg };
          }
        }),
      );

      for (const { entry, history, error } of histories) {
        if (error || history.length === 0) {
          partialFailures.push(entry.name);
          continue;
        }

        const last = history[history.length - 1];
        if (!last) {
          partialFailures.push(entry.name);
          continue;
        }

        let trend: ReservoirObservation["trend"] = "steady";
        const priorIdx = history.length - 1 - TREND_LOOKBACK_DAYS;
        const prior = priorIdx >= 0 ? history[priorIdx] : undefined;
        if (prior) {
          const delta = last.percentFull - prior.percentFull;
          if (delta > TREND_THRESHOLD_PCT) trend = "rising";
          else if (delta < -TREND_THRESHOLD_PCT) trend = "falling";
        }

        let histSum = 0;
        let histCount = 0;
        for (const row of history) {
          const d = new Date(row.date);
          if (Number.isNaN(d.getTime())) continue;
          if (circularDayDistance(dayOfYear(d), todayDoy) <= HIST_WINDOW_DAYS) {
            histSum += row.percentFull;
            histCount += 1;
          }
        }
        const historicalAvgPct = histCount > 0 ? histSum / histCount : null;

        const lastDate = new Date(last.date);
        if (!Number.isNaN(lastDate.getTime())) {
          const ageDays = (Date.now() - lastDate.getTime()) / 86_400_000;
          if (ageDays > STALE_DAYS) {
            staleReservoirs.push({ name: entry.name, lastUpdated: last.date });
          }
        }

        observations.push({
          name: entry.name,
          slug: entry.slug,
          lat: entry.lat,
          lng: entry.lng,
          distanceMi: Math.round(entry.distanceMi * 10) / 10,
          currentPct: last.percentFull,
          historicalAvgPct:
            historicalAvgPct == null ? null : Math.round(historicalAvgPct * 10) / 10,
          trend,
          lastUpdated: last.date,
        });

        perReservoirSources.push(
          source({
            title: `TWDB Water Data for Texas — ${entry.name}`,
            url: reservoirPageUrl(entry.slug),
            publisher: "Texas Water Development Board",
          }),
        );
      }

      const caveats: Caveat[] = [
        freshnessCaveat({ asOf: new Date().toISOString().slice(0, 10), cadence: "daily" }),
        boundsCaveat(
          "Coverage is the ~37 instrumented major reservoirs in TWDB's instantaneous feed; smaller minor-system reservoirs are not included.",
        ),
        {
          severity: "info",
          category: "inference",
          message: `Trend is the change in percent_full vs ${TREND_LOOKBACK_DAYS} days prior (±${TREND_THRESHOLD_PCT} pct deadband). Historical average is the mean of percent_full rows within ±${HIST_WINDOW_DAYS} calendar days of today across the full TWDB record.`,
        },
      ];

      if (staleReservoirs.length) {
        caveats.push({
          severity: "warning",
          category: "freshness",
          message: `Reading older than ${STALE_DAYS} days: ${staleReservoirs
            .map((s) => `${s.name} (${s.lastUpdated})`)
            .join(", ")}.`,
        });
      }

      if (partialFailures.length) {
        caveats.push({
          severity: "warning",
          category: "quality",
          message: `Could not load TWDB CSV for: ${partialFailures.join(", ")}.`,
        });
      }

      return {
        data: { reservoirs: observations },
        caveats,
        sources: [instantaneousSource(), ...perReservoirSources],
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_reservoirs failed")],
        sources: [],
      };
    }
  },
};
