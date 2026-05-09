/**
 * get_drought_status — current U.S. Drought Monitor category for a county.
 *
 * USDM publishes a county-level statistics REST API and weekly GeoJSON.
 * Endpoint shape (verify in implementation):
 *   https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent
 *     ?aoi=<5-digit FIPS>&startdate=<MM/DD/YYYY>&enddate=<MM/DD/YYYY>&statisticsType=1
 *
 * Returns the highest current drought category and the percent area in each.
 * Skill should treat the category as ordinal (None < D0 < D1 < D2 < D3 < D4)
 * and never claim causation between drought stage and any specific outcome.
 */

import { z } from "zod";
import type { DrylineTool, DroughtCategory } from "../types.js";
import { source, freshnessCaveat, errorCaveat } from "../lib/sources.js";

const inputSchema = z.object({
  countyFips: z
    .string()
    .regex(/^\d{5}$/)
    .describe("5-digit county FIPS code, from resolve_location.countyFips"),
});

type Input = z.infer<typeof inputSchema>;

interface DroughtStatusOutput {
  category: DroughtCategory;
  /** Date the latest USDM map was published (Tuesdays). */
  asOf: string;
  /** Percent of county area in each category, 0–100. */
  areaPercent: Record<DroughtCategory, number>;
}

export const getDroughtStatus: DrylineTool<Input, DroughtStatusOutput> = {
  name: "get_drought_status",
  description:
    "Return the current U.S. Drought Monitor classification for a Texas county, including the area percentage in each drought category. Updated weekly (Thursdays).",
  inputSchema,
  run: async ({ countyFips }) => {
    try {
      // Pull a 30-day window so we always get the latest published map.
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      const fmt = (d: Date) =>
        `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

      const url = new URL(
        "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent"
      );
      url.searchParams.set("aoi", countyFips);
      url.searchParams.set("startdate", fmt(startDate));
      url.searchParams.set("enddate", fmt(now));
      url.searchParams.set("statisticsType", "1");

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`USDM ${res.status}`);
      const rows = (await res.json()) as Array<{
        MapDate: string;
        None: string; D0: string; D1: string; D2: string; D3: string; D4: string;
      }>;
      const latest = rows.at(-1);
      if (!latest) throw new Error("USDM returned no rows");

      const areaPercent: Record<DroughtCategory, number> = {
        None: Number(latest.None),
        D0: Number(latest.D0),
        D1: Number(latest.D1),
        D2: Number(latest.D2),
        D3: Number(latest.D3),
        D4: Number(latest.D4),
      };

      // Highest category that has > 0% area is the headline classification.
      const order: DroughtCategory[] = ["D4", "D3", "D2", "D1", "D0", "None"];
      const category = order.find((c) => areaPercent[c] > 0) ?? "None";

      return {
        data: {
          category,
          asOf: latest.MapDate,
          areaPercent,
        },
        caveats: [
          freshnessCaveat({ asOf: latest.MapDate, cadence: "weekly (Thursdays)" }),
          {
            severity: "info",
            category: "bounds",
            message:
              "Headline category is the most-severe class with any area present in this county; refer to areaPercent for the full distribution.",
          },
        ],
        sources: [
          source({
            title: `U.S. Drought Monitor — county FIPS ${countyFips}`,
            url: url.toString(),
            publisher: "National Drought Mitigation Center, UNL",
          }),
        ],
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_drought_status failed")],
        sources: [],
      };
    }
  },
};
