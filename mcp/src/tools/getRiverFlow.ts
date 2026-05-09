/**
 * get_river_flow — nearest USGS stream gauge, current vs normal.
 *
 * Source: USGS NWIS Water Services REST API.
 *   https://waterservices.usgs.gov/nwis/iv/?format=json&sites=<SITE_ID>&parameterCd=00060,00065
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - Find the nearest active gauge to a point (USGS site service is queryable
 *   by bounding box).
 * - Fetch instantaneous values (parameterCd 00060 = discharge, 00065 = stage).
 * - Compare to long-term median for the same calendar day to compute "vs normal."
 * - Caveat: gauges go offline; if the most recent reading is >24h old, surface that.
 */

import { z } from "zod";
import type { DrylineTool } from "../types.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

type Input = z.infer<typeof inputSchema>;

interface RiverFlowOutput {
  gauge: {
    siteNumber: string;
    siteName: string;
    distanceMi: number;
    lat: number;
    lng: number;
  };
  currentDischargeCfs: number | null;
  medianDischargeCfs: number | null;
  trend: "rising" | "falling" | "steady" | "unknown";
  lastReading: string;
}

export const getRiverFlow: DrylineTool<Input, RiverFlowOutput> = {
  name: "get_river_flow",
  description:
    "Return the nearest active USGS stream gauge with current discharge vs the long-term median for today's date.",
  inputSchema,
  run: async () => {
    return {
      data: null,
      caveats: [
        {
          severity: "warning",
          category: "quality",
          message:
            "get_river_flow is not yet implemented. See file header for USGS NWIS integration notes.",
        },
      ],
      sources: [],
    };
  },
};
