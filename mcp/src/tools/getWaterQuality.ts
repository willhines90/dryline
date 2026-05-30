/**
 * get_water_quality — current USGS water-quality sensor readings near a point.
 *
 * Source: USGS NWIS Instantaneous Values service (same service get_river_flow
 * uses for discharge), queried for the supply-relevant water-quality
 * parameter codes:
 *
 *   00095  Specific conductance (µS/cm)  — salinity / brackishness
 *   99133  Nitrate (mg/L as N)           — ag / septic influence
 *   00300  Dissolved oxygen (mg/L)
 *   00400  pH (standard units)
 *   00010  Water temperature (°C)
 *   63680  Turbidity (FNU)
 *
 * NWIS has no point+radius query, so we expand lat/lng into a bbox, fetch
 * active sensors, group the per-parameter time series by site, and prune to
 * the true radius via haversine.
 *
 * Scope note: this is the *continuous in-situ sensor* subset of USGS water
 * quality — current, but spatially sparse. Discrete laboratory samples
 * (nitrate grab samples, E. coli, metals) live in the USGS/EPA Water Quality
 * Portal and are a deliberate future extension; they're months-to-years old
 * and slow to query, which doesn't fit the live "conditions now" framing.
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

// Parameter code → human label. NWIS echoes a variableName too, but it's
// verbose ("Specific conductance, water, unfiltered, …"); these are tidier.
const PARAM_LABEL: Record<string, string> = {
  "00095": "Specific conductance",
  "99133": "Nitrate",
  "00300": "Dissolved oxygen",
  "00400": "pH",
  "00010": "Water temperature",
  "63680": "Turbidity",
};
const PARAM_CODES = Object.keys(PARAM_LABEL);

interface Measurement {
  parameter: string;
  code: string;
  value: number | null;
  unit: string;
  readingAt: string | null;
}

interface QualitySite {
  siteCode: string;
  siteName: string;
  lat: number;
  lng: number;
  distanceMi: number;
  measurements: Measurement[];
}

interface WaterQualityOutput {
  sites: QualitySite[];
}

interface NwisTimeSeries {
  sourceInfo?: {
    siteName?: string;
    siteCode?: Array<{ value?: string }>;
    geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } };
  };
  variable?: {
    variableCode?: Array<{ value?: string }>;
    variableName?: string;
    unit?: { unitCode?: string };
  };
  values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
}

interface NwisResponse {
  value?: { timeSeries?: NwisTimeSeries[] };
}

function bboxFor(lat: number, lng: number, mi: number) {
  const dLat = mi / 69;
  const dLng = mi / (69 * Math.cos((lat * Math.PI) / 180));
  return { minLng: lng - dLng, minLat: lat - dLat, maxLng: lng + dLng, maxLat: lat + dLat };
}

export const getWaterQuality: DrylineTool<Input, WaterQualityOutput> = {
  name: "get_water_quality",
  description:
    "Return current USGS water-quality sensor readings (NWIS instantaneous values) at monitoring sites within radius of a Texas point: specific conductance (salinity), nitrate, dissolved oxygen, pH, water temperature, and turbidity, where each site measures them. The supply-relevant signals are specific conductance (brackish/saline water) and nitrate (ag/septic influence). Source: USGS NWIS. Covers continuous in-situ sensors only — NOT discrete laboratory samples — so coverage is sparse. A single reading is not a regulatory determination.",
  inputSchema,
  run: async ({ lat, lng, radiusMi, limit }) => {
    try {
      const bbox = bboxFor(lat, lng, radiusMi);
      const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
      url.searchParams.set("format", "json");
      url.searchParams.set(
        "bBox",
        [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat].map((n) => n.toFixed(6)).join(","),
      );
      url.searchParams.set("parameterCd", PARAM_CODES.join(","));
      url.searchParams.set("siteStatus", "active");

      // Defensive timeout. NWIS multi-parameter queries usually return in
      // ~3-5s but are variable under load; 12s keeps a slow one from hanging
      // the parallel fan-out without tripping on normal latency. It still
      // sits inside the investigation's wall-clock budget.
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`USGS NWIS ${res.status}`);
      const json = (await res.json()) as NwisResponse;

      const series = json.value?.timeSeries ?? [];
      const here = { lat, lng };
      const bySite = new Map<string, QualitySite>();

      for (const ts of series) {
        const siteCode = ts.sourceInfo?.siteCode?.[0]?.value;
        const siteName = ts.sourceInfo?.siteName;
        const gLat = ts.sourceInfo?.geoLocation?.geogLocation?.latitude;
        const gLng = ts.sourceInfo?.geoLocation?.geogLocation?.longitude;
        if (!siteCode || !siteName || gLat == null || gLng == null) continue;
        const distance = haversineMiles(here, { lat: gLat, lng: gLng });
        if (distance > radiusMi) continue;

        const code = ts.variable?.variableCode?.[0]?.value;
        if (!code) continue;
        const latest = ts.values?.[0]?.value?.[0];
        const raw = latest?.value;
        let value: number | null = null;
        if (raw != null && raw !== "") {
          const n = Number(raw);
          // NWIS no-data sentinels are large negatives (e.g. -999999).
          if (Number.isFinite(n) && n > -99999) value = n;
        }

        let site = bySite.get(siteCode);
        if (!site) {
          site = {
            siteCode,
            siteName,
            lat: gLat,
            lng: gLng,
            distanceMi: Math.round(distance * 100) / 100,
            measurements: [],
          };
          bySite.set(siteCode, site);
        }
        site.measurements.push({
          parameter: PARAM_LABEL[code] ?? ts.variable?.variableName ?? code,
          code,
          value,
          unit: ts.variable?.unit?.unitCode ?? "",
          readingAt: latest?.dateTime ?? null,
        });
      }

      const sites = [...bySite.values()]
        // Keep only sites with at least one real (non-null) reading.
        .filter((s) => s.measurements.some((m) => m.value != null))
        .sort((a, b) => a.distanceMi - b.distanceMi);
      const top = sites.slice(0, limit);

      const caveats: Caveat[] = [
        freshnessCaveat({
          asOf: new Date().toISOString().slice(0, 10),
          cadence: "live (USGS NWIS, ~15 min–1 hr refresh per sensor)",
        }),
        {
          severity: "info",
          category: "quality",
          message:
            "Values are provisional USGS sensor readings. A single instantaneous reading is not a regulatory determination, a violation, or a chronic condition — for compliance, see get_drinking_water.",
        },
        boundsCaveat(
          "Covers continuous in-situ USGS sensors only (a sparse subset of sites). Discrete laboratory samples — nitrate grab samples, E. coli, metals — live in the USGS/EPA Water Quality Portal and are not included here.",
        ),
      ];

      if (sites.length > top.length) {
        caveats.push(
          boundsCaveat(
            `Returned the closest ${top.length} of ${sites.length} water-quality sites within ${radiusMi} mi. Increase limit to see more.`,
          ),
        );
      }
      if (top.length === 0) {
        caveats.push(
          boundsCaveat(
            `No USGS continuous water-quality sensor reporting within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)}). This is common — the sensor network is sparse; it does not mean the water is unmonitored or unsafe.`,
          ),
        );
      }

      const sources: Source[] = [
        source({
          title: `USGS NWIS — water-quality sensors within ${radiusMi} mi`,
          url: url.toString(),
          publisher: "U.S. Geological Survey",
        }),
      ];

      return { data: { sites: top }, caveats, sources };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_water_quality failed")],
        sources: [],
      };
    }
  },
};
