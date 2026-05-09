/**
 * get_reservoirs — nearby major reservoirs with current levels and trend.
 *
 * Source: TWDB Water Data for Texas (waterdatafortexas.org).
 * The site exposes JSON endpoints for the 122 major TX reservoirs.
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - List endpoint: https://www.waterdatafortexas.org/reservoirs/individual.json
 *   (verify path; the site offers per-reservoir JSON via .json suffix on each
 *   reservoir page; e.g. /reservoirs/individual/canyon.json)
 * - Pre-load reservoir lat/lng + capacity into DuckDB once at server start so
 *   "nearby" filtering doesn't require an HTTP fan-out per query.
 * - For each candidate, fetch current_storage_pct and historical_avg_pct.
 * - Set a `caveat` if any reservoir's data is older than 7 days.
 */

import { z } from "zod";
import type { DrylineTool } from "../types.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(200).default(50),
});

type Input = z.infer<typeof inputSchema>;

interface ReservoirObservation {
  name: string;
  lat: number;
  lng: number;
  /** % of conservation capacity currently stored, 0–100. */
  currentPct: number;
  /** Long-term historical average for this date, 0–100. */
  historicalAvgPct: number;
  trend: "rising" | "falling" | "steady";
  lastUpdated: string;
}

interface ReservoirsOutput {
  reservoirs: ReservoirObservation[];
}

export const getReservoirs: DrylineTool<Input, ReservoirsOutput> = {
  name: "get_reservoirs",
  description:
    "List major Texas reservoirs within a radius of a point, with current % full vs historical average and a recent trend.",
  inputSchema,
  run: async () => {
    return {
      data: null,
      caveats: [
        {
          severity: "warning",
          category: "quality",
          message:
            "get_reservoirs is not yet implemented. See file header for TWDB Water Data for Texas integration notes.",
        },
      ],
      sources: [],
    };
  },
};
