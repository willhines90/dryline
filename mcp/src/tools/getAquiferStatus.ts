/**
 * get_aquifer_status — local aquifer name + monitoring well trend.
 *
 * Source: TWDB Groundwater Database (GWDB) snapshot, loaded into DuckDB.
 * Major aquifers we care about: Edwards, Trinity, Carrizo-Wilcox, Ogallala,
 * Hueco Bolson, Edwards-Trinity Plateau, Pecos Valley, Gulf Coast.
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - Snapshot loader in mcp/src/data/duckdb.ts pulls the GWDB pipe-delimited dumps.
 * - For a given lat/lng: identify the major aquifer beneath; find the nearest
 *   monitoring wells; compute decadal trend (linear regression on annual readings).
 * - Caveat: monitoring well coverage is uneven; a single nearby well may not
 *   represent the whole local aquifer.
 */

import { z } from "zod";
import type { DrylineTool } from "../types.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

type Input = z.infer<typeof inputSchema>;

interface AquiferStatusOutput {
  aquiferName: string;
  monitoringWell: {
    stateWellId: string;
    distanceMi: number;
    annualReadings: Array<{ year: number; depthToWaterFt: number }>;
    decadalTrendFtPerYear: number;
  } | null;
}

export const getAquiferStatus: DrylineTool<Input, AquiferStatusOutput> = {
  name: "get_aquifer_status",
  description:
    "Identify the major aquifer beneath a Texas location and report the trend at the nearest TWDB monitoring well over the last decade.",
  inputSchema,
  run: async () => {
    return {
      data: null,
      caveats: [
        {
          severity: "warning",
          category: "quality",
          message:
            "get_aquifer_status is not yet implemented. Requires TWDB GWDB DuckDB snapshot. See file header.",
        },
      ],
      sources: [],
    };
  },
};
