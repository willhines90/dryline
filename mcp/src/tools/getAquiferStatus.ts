/**
 * get_aquifer_status — major aquifer beneath a Texas point + a monitoring
 * well's 20-year decadal trend.
 *
 * Source: TWDB Groundwater Database (GWDBDownload.zip), filtered to the
 * seven demo counties and shipped as a curated JSON snapshot under
 * `mcp/src/data/aquifers.json`. Build script lives in /tmp/gwdb (not in
 * the repo) — to refresh, re-run against a fresh GWDB nightly pull.
 *
 * Inference: a single nearby monitoring well does not necessarily speak
 * for an entire aquifer — coverage is uneven, readings are sensitive to
 * pumping conditions and the time of year, and well integrity varies.
 * Surface this explicitly via caveats so the synthesis stays honest.
 */

import { z } from "zod";
import type { Caveat, DrylineTool, Source } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";
import { haversineMiles } from "../lib/twdb.js";
import aquifersSnapshot from "../data/aquifers.json" with { type: "json" };

interface SnapshotWell {
  stateWellId: string;
  county: string;
  aquifer: string;
  lat: number;
  lng: number;
  annualReadings: Array<{ year: number; meanDepthFt: number }>;
}

interface Snapshot {
  generatedAt: string;
  source: string;
  yearWindow: { from: number; to: number };
  counties: string[];
  minYearsOfHistory: number;
  wells: SnapshotWell[];
}

const SNAPSHOT = aquifersSnapshot as Snapshot;

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(50).default(20),
});

type Input = z.infer<typeof inputSchema>;

interface AnnualReading {
  year: number;
  depthToWaterFt: number;
}

interface MonitoringWell {
  stateWellId: string;
  aquifer: string;
  lat: number;
  lng: number;
  distanceMi: number;
  annualReadings: AnnualReading[];
  /**
   * Linear-regression slope of depth-to-water vs year over the available
   * record. Positive = depth increasing = water level falling. Reported in
   * feet per year (multiply by 10 for a decadal figure).
   */
  decadalTrendFtPerYear: number;
}

interface AquiferStatusOutput {
  /** The aquifer name reported by the chosen well, or null if no well is in range. */
  aquiferName: string | null;
  /** Aquifers represented by all wells within the search radius, with their well counts. */
  aquifersInRadius: Array<{ aquifer: string; wellCount: number }>;
  /** Nearest qualifying monitoring well, or null when none is in range. */
  monitoringWell: MonitoringWell | null;
}

/** Slope of y vs x via least squares. Returns 0 when data is degenerate. */
function linearSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
    sumXY += xs[i]! * ys[i]!;
    sumX2 += xs[i]! * xs[i]!;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export const getAquiferStatus: DrylineTool<Input, AquiferStatusOutput> = {
  name: "get_aquifer_status",
  description:
    "Identify the major aquifer beneath a Texas location and report the 20-year depth-to-water trend at the nearest TWDB monitoring well within the radius. Useful for groundwater stress narratives (Trinity decline, Ogallala depletion, Edwards-Trinity Plateau, etc.). Single-well readings should not be cited as whole-aquifer truth — coverage is uneven.",
  inputSchema,
  run: async ({ lat, lng, radiusMi }) => {
    try {
      const here = { lat, lng };
      const wellsInRadius = SNAPSHOT.wells
        .map((w) => ({
          well: w,
          distanceMi: haversineMiles(here, { lat: w.lat, lng: w.lng }),
        }))
        .filter((entry) => entry.distanceMi <= radiusMi)
        .sort((a, b) => a.distanceMi - b.distanceMi);

      const aquiferCounts = new Map<string, number>();
      for (const { well } of wellsInRadius) {
        aquiferCounts.set(well.aquifer, (aquiferCounts.get(well.aquifer) ?? 0) + 1);
      }
      const aquifersInRadius = [...aquiferCounts.entries()]
        .map(([aquifer, wellCount]) => ({ aquifer, wellCount }))
        .sort((a, b) => b.wellCount - a.wellCount);

      const sources: Source[] = [
        source({
          title: "TWDB Groundwater Database — well metadata + water-level history",
          url: "https://www.twdb.texas.gov/groundwater/data/gwdbrpt.asp",
          publisher: "Texas Water Development Board",
        }),
      ];

      const caveats: Caveat[] = [
        freshnessCaveat({
          asOf: SNAPSHOT.generatedAt.slice(0, 10),
          cadence: `from a curated snapshot of TWDB GWDB (${SNAPSHOT.yearWindow.from}–${SNAPSHOT.yearWindow.to})`,
        }),
        boundsCaveat(
          `Snapshot covers seven Dryline demo counties (${SNAPSHOT.counties.join(", ")}). Outside these counties this tool returns no result.`,
        ),
        boundsCaveat(
          "TWDB notes well locations are not state-verified; readings reflect pumping conditions at the time of measurement. A single nearby well does not speak for an entire aquifer.",
        ),
      ];

      if (wellsInRadius.length === 0) {
        caveats.push(
          boundsCaveat(
            `No monitoring well with at least ${SNAPSHOT.minYearsOfHistory} years of GWDB history within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
          ),
        );
        return {
          data: { aquiferName: null, aquifersInRadius: [], monitoringWell: null },
          caveats,
          sources,
        };
      }

      const nearest = wellsInRadius[0]!;
      const readings: AnnualReading[] = nearest.well.annualReadings.map((r) => ({
        year: r.year,
        depthToWaterFt: r.meanDepthFt,
      }));
      const xs = readings.map((r) => r.year);
      const ys = readings.map((r) => r.depthToWaterFt);
      const slope = linearSlope(xs, ys);
      const trend = Math.round(slope * 100) / 100;

      const monitoringWell: MonitoringWell = {
        stateWellId: nearest.well.stateWellId,
        aquifer: nearest.well.aquifer,
        lat: nearest.well.lat,
        lng: nearest.well.lng,
        distanceMi: Math.round(nearest.distanceMi * 100) / 100,
        annualReadings: readings,
        decadalTrendFtPerYear: trend,
      };

      caveats.push({
        severity: "info",
        category: "inference",
        message: `Trend is the linear-regression slope of mean annual depth-to-water vs year (${readings.length} years of data). Positive values indicate the water table is falling.`,
      });

      // Surface ambiguity when more than one aquifer is represented in the radius.
      if (aquifersInRadius.length > 1) {
        const summary = aquifersInRadius
          .slice(0, 4)
          .map((a) => `${a.aquifer} (${a.wellCount})`)
          .join("; ");
        caveats.push({
          severity: "info",
          category: "bounds",
          message: `Multiple aquifers have monitoring wells within this radius: ${summary}. The nearest well's aquifer is reported as 'aquiferName'; consult 'aquifersInRadius' for the full picture.`,
        });
      }

      return {
        data: {
          aquiferName: nearest.well.aquifer,
          aquifersInRadius,
          monitoringWell,
        },
        caveats,
        sources,
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_aquifer_status failed")],
        sources: [],
      };
    }
  },
};
