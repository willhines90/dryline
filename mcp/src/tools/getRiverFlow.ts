/**
 * get_river_flow — nearby USGS stream gauges with current discharge.
 *
 * Source: USGS NWIS Instantaneous Values service.
 *   https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=...&parameterCd=00060
 *
 * NWIS doesn't natively support point+radius, so we expand the input
 * lat/lng into a bbox, fetch active gauges, then prune to the true
 * radius via haversine. Each gauge returns the most-recent provisional
 * discharge value (cfs).
 */

import { z } from "zod";
import type { Caveat, DrylineTool, Source } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";
import { haversineMiles } from "../lib/twdb.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(75).default(25),
  limit: z.number().int().min(1).max(20).default(5),
});

type Input = z.infer<typeof inputSchema>;

interface GaugeReading {
  siteCode: string;
  siteName: string;
  lat: number;
  lng: number;
  distanceMi: number;
  /** Discharge in cubic feet per second; null when no current value. */
  currentCfs: number | null;
  /** ISO-8601 timestamp of the latest reading. */
  latestReadingAt: string | null;
  /** USGS HUC-8 watershed code if reported. */
  huc8: string | null;
}

interface RiverFlowOutput {
  gauges: GaugeReading[];
}

interface NwisTimeSeries {
  sourceInfo?: {
    siteName?: string;
    siteCode?: Array<{ value?: string }>;
    geoLocation?: {
      geogLocation?: { latitude?: number; longitude?: number };
    };
    siteProperty?: Array<{ value?: string; name?: string }>;
  };
  values?: Array<{
    value?: Array<{ value?: string; dateTime?: string }>;
  }>;
}

interface NwisResponse {
  value?: { timeSeries?: NwisTimeSeries[] };
}

function bboxFor(lat: number, lng: number, mi: number) {
  const dLat = mi / 69;
  const dLng = mi / (69 * Math.cos((lat * Math.PI) / 180));
  return {
    minLng: lng - dLng,
    minLat: lat - dLat,
    maxLng: lng + dLng,
    maxLat: lat + dLat,
  };
}

export const getRiverFlow: DrylineTool<Input, RiverFlowOutput> = {
  name: "get_river_flow",
  description:
    "Return USGS stream gauges (NWIS) within radius of a Texas point, sorted by distance. Each gauge reports its most-recent provisional discharge in cubic feet per second (cfs), the reading timestamp, and its HUC-8 watershed code. Source: USGS NWIS Instantaneous Values. Updates roughly every 15 minutes per gauge.",
  inputSchema,
  run: async ({ lat, lng, radiusMi, limit }) => {
    try {
      const bbox = bboxFor(lat, lng, radiusMi);
      const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
      url.searchParams.set("format", "json");
      url.searchParams.set(
        "bBox",
        [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
          .map((n) => n.toFixed(6))
          .join(","),
      );
      url.searchParams.set("parameterCd", "00060");
      url.searchParams.set("siteStatus", "active");

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`USGS NWIS ${res.status}`);
      const json = (await res.json()) as NwisResponse;

      const series = json.value?.timeSeries ?? [];
      const here = { lat, lng };
      const gauges: GaugeReading[] = [];

      for (const ts of series) {
        const siteCode = ts.sourceInfo?.siteCode?.[0]?.value;
        const siteName = ts.sourceInfo?.siteName;
        const gLat = ts.sourceInfo?.geoLocation?.geogLocation?.latitude;
        const gLng = ts.sourceInfo?.geoLocation?.geogLocation?.longitude;
        if (!siteCode || !siteName || gLat == null || gLng == null) continue;
        const distance = haversineMiles(here, { lat: gLat, lng: gLng });
        if (distance > radiusMi) continue;
        const latest = ts.values?.[0]?.value?.[0];
        const rawCfs = latest?.value;
        let cfs: number | null = null;
        if (rawCfs != null && rawCfs !== "") {
          const n = Number(rawCfs);
          if (Number.isFinite(n) && n > -10000) cfs = n;
        }
        const huc8 =
          ts.sourceInfo?.siteProperty?.find((p) => p.name === "hucCd")?.value ?? null;
        gauges.push({
          siteCode,
          siteName,
          lat: gLat,
          lng: gLng,
          distanceMi: Math.round(distance * 100) / 100,
          currentCfs: cfs,
          latestReadingAt: latest?.dateTime ?? null,
          huc8,
        });
      }

      gauges.sort((a, b) => a.distanceMi - b.distanceMi);
      const top = gauges.slice(0, limit);

      const caveats: Caveat[] = [
        freshnessCaveat({
          asOf: new Date().toISOString().slice(0, 10),
          cadence: "live (USGS NWIS, ~15 min refresh per gauge)",
        }),
        {
          severity: "info",
          category: "quality",
          message:
            "USGS reports values as 'provisional' until reviewed; older readings may be revised after the fact.",
        },
        boundsCaveat(
          "Coverage is the active USGS NWIS network. Many TX gauges read 0 cfs in dry season — that's a real measurement, not a missing one.",
        ),
      ];

      if (gauges.length > top.length) {
        caveats.push(
          boundsCaveat(
            `Returned the closest ${top.length} of ${gauges.length} gauges within ${radiusMi} mi. Increase limit to see more.`,
          ),
        );
      }

      if (top.length === 0) {
        caveats.push(
          boundsCaveat(
            `No active USGS NWIS discharge gauge within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
          ),
        );
      }

      const sources: Source[] = [
        source({
          title: `USGS NWIS — discharge gauges within ${radiusMi} mi`,
          url: url.toString(),
          publisher: "U.S. Geological Survey",
        }),
      ];

      return { data: { gauges: top }, caveats, sources };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_river_flow failed")],
        sources: [],
      };
    }
  },
};
