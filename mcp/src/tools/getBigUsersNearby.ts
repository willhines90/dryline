/**
 * get_big_users_nearby — federally-reportable Clean Water Act dischargers
 * near a point.
 *
 * Source: EPA ECHO Clean Water Act REST services.
 *   https://echodata.epa.gov/echo/cwa_rest_services.get_facilities  → QID
 *   https://echodata.epa.gov/echo/cwa_rest_services.get_geojson      → features (with lat/lng)
 *
 * ECHO's CWA endpoint takes a bounding-box spatial filter, not point+radius,
 * so we expand the input lat/lng + radius into a bbox, query, then prune to
 * the true radius client-side via haversine distance.
 *
 * Two CWA permit categories worth distinguishing on the response:
 *   - Individual NPDES (TX-prefixed, 7 digits) — actual discharge permits with
 *     reported avg flow.
 *   - General-permit covered (TXR-prefixed) — construction stormwater, MSGP,
 *     CGP, etc. No reported flow but still on-site as a permittee.
 *
 * NOTE on coverage: NPDES regulates DISCHARGE, not water DRAW. A large fab
 * pulling groundwater appears here only if it also has a discharge permit.
 * Dryline's TCEQ water-rights data path is not yet implemented.
 */

import { z } from "zod";
import type { Caveat, DrylineTool } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";
import { haversineMiles } from "../lib/twdb.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(50).default(15),
  limit: z.number().int().min(1).max(200).default(20),
});

type Input = z.infer<typeof inputSchema>;

type PermitCategory = "individual_npdes" | "general_permit" | "other";

interface Facility {
  name: string;
  npdesId: string;
  permitCategory: PermitCategory;
  permitStatus: string | null;
  /** Reported average flow in millions of gallons per day. Individual NPDES only; null otherwise. */
  actualAverageFlowMgd: number | null;
  city: string | null;
  county: string | null;
  state: string | null;
  lat: number;
  lng: number;
  distanceMi: number;
}

interface BigUsersOutput {
  facilities: Facility[];
}

const ECHO_BASE = "https://echodata.epa.gov/echo";

interface QuerySummary {
  Results: {
    Version?: string;
    QueryRows?: string;
    QueryID?: string;
    Error?: { ErrorMessage?: string };
  };
}

interface CwaFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  } | null;
  properties: {
    CWPName?: string | null;
    SourceID?: string | null;
    CWPCity?: string | null;
    CWPCounty?: string | null;
    CWPState?: string | null;
    CWPPermitStatusDesc?: string | null;
    CWPActualAverageFlowNmbr?: number | string | null;
  };
}

interface GeoJsonResponse {
  type: "FeatureCollection";
  features?: CwaFeature[];
}

async function echoJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    if (res.status < 500 || attempt === 1) {
      throw new Error(`ECHO ${res.status} for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`ECHO retries exhausted for ${url}`);
}

/** Convert miles offset to a degree pair, accounting for latitude scaling on longitude. */
function bboxFor(lat: number, lng: number, mi: number): {
  c1lat: number;
  c1lon: number;
  c2lat: number;
  c2lon: number;
} {
  const dLat = mi / 69;
  const dLng = mi / (69 * Math.cos((lat * Math.PI) / 180));
  return {
    c1lat: lat - dLat,
    c1lon: lng - dLng,
    c2lat: lat + dLat,
    c2lon: lng + dLng,
  };
}

function categorizePermit(npdesId: string): PermitCategory {
  if (/^[A-Z]{2}\d{7}$/.test(npdesId)) return "individual_npdes";
  if (/^[A-Z]{2}R/.test(npdesId)) return "general_permit";
  return "other";
}

function asNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const getBigUsersNearby: DrylineTool<Input, BigUsersOutput> = {
  name: "get_big_users_nearby",
  description:
    "List federally-reportable Clean Water Act NPDES permittees near a point, ordered by distance. Includes both individual NPDES discharge permits (with reported average flow) and general-permit holders (construction stormwater, MSGP, etc.). Surfaces NPDES permit IDs, permit status, and reported volumes where available. Useful for transparency-mode questions like 'who's drinking your aquifer?' — but note NPDES regulates discharge, not draw.",
  inputSchema,
  run: async ({ lat, lng, radiusMi, limit }) => {
    try {
      const bbox = bboxFor(lat, lng, radiusMi);
      const params = new URLSearchParams({
        output: "JSON",
        p_c1lat: bbox.c1lat.toFixed(6),
        p_c1lon: bbox.c1lon.toFixed(6),
        p_c2lat: bbox.c2lat.toFixed(6),
        p_c2lon: bbox.c2lon.toFixed(6),
        p_act: "Y",
      });
      const queryUrl = `${ECHO_BASE}/cwa_rest_services.get_facilities?${params.toString()}`;

      const summary = await echoJson<QuerySummary>(queryUrl);
      const summaryErr = summary.Results?.Error?.ErrorMessage;
      if (summaryErr) throw new Error(`ECHO get_facilities: ${summaryErr}`);
      const qid = summary.Results.QueryID;
      if (!qid) throw new Error("ECHO get_facilities: missing QueryID");
      const version = summary.Results.Version ?? "CWA";

      const geojsonUrl = `${ECHO_BASE}/cwa_rest_services.get_geojson?qid=${encodeURIComponent(qid)}`;
      const geojson = await echoJson<GeoJsonResponse>(geojsonUrl);
      const features = geojson.features ?? [];

      const facilities: Facility[] = [];
      let droppedNoCoords = 0;

      for (const feature of features) {
        const coords = feature.geometry?.coordinates;
        if (!coords) {
          droppedNoCoords++;
          continue;
        }
        const [fLng, fLat] = coords;
        const distanceMi = haversineMiles({ lat, lng }, { lat: fLat, lng: fLng });
        if (distanceMi > radiusMi) continue;

        const props = feature.properties ?? {};
        const npdesId = (props.SourceID ?? "").trim();
        if (!npdesId) continue;

        facilities.push({
          name: (props.CWPName ?? "").trim() || "(unnamed facility)",
          npdesId,
          permitCategory: categorizePermit(npdesId),
          permitStatus: props.CWPPermitStatusDesc ?? null,
          actualAverageFlowMgd: asNumberOrNull(props.CWPActualAverageFlowNmbr),
          city: props.CWPCity ?? null,
          county: props.CWPCounty ?? null,
          state: props.CWPState ?? null,
          lat: fLat,
          lng: fLng,
          distanceMi: Math.round(distanceMi * 100) / 100,
        });
      }

      facilities.sort((a, b) => a.distanceMi - b.distanceMi);
      const top = facilities.slice(0, limit);

      // Construction General Permits (TXR15...) tend to dominate distance-sorted
      // results in development-active areas; surface that count so the agent
      // can decide whether to bump `limit` to reach permanent operational
      // permits behind them.
      const constructionPrefix = /^[A-Z]{2}R15/;
      const totalConstruction = facilities.filter((f) => constructionPrefix.test(f.npdesId)).length;

      const caveats: Caveat[] = [
        freshnessCaveat({
          asOf: new Date().toISOString().slice(0, 10),
          cadence: `from EPA ECHO snapshot ${version}; CWA data refreshes weekly`,
        }),
        {
          severity: "warning",
          category: "inference",
          message: "Permitted ≠ polluting. Active permit ≠ enforcement action.",
        },
        boundsCaveat(
          "ECHO covers federally-reportable facilities; smaller TCEQ-only permittees not present.",
        ),
        boundsCaveat(
          "NPDES regulates DISCHARGE, not water DRAW. Large industrial water consumers (e.g. fabs pulling groundwater) appear here only if they also hold a discharge permit. Water-rights / draw data is in TCEQ, not ECHO.",
        ),
        {
          severity: "info",
          category: "inference",
          message:
            "permitCategory: individual_npdes (TX-prefixed) is a discrete discharge permit with reported flow; general_permit (TXR-prefixed) covers stormwater under a general permit (CGP / MSGP) and typically has no reported flow.",
        },
      ];

      if (droppedNoCoords > 0) {
        caveats.push(
          boundsCaveat(
            `Dropped ${droppedNoCoords} permitted facility/facilities without geocoded coordinates from the result.`,
          ),
        );
      }

      if (facilities.length > top.length) {
        caveats.push(
          boundsCaveat(
            `Returned the closest ${top.length} of ${facilities.length} permittees within ${radiusMi} mi (${totalConstruction} of those are TXR15-prefixed Construction General Permits — temporary, not ongoing operations). Bump limit if a specific ongoing operator is expected and not present.`,
          ),
        );
      }

      if (top.length === 0) {
        caveats.push(
          boundsCaveat(
            `No active CWA permittees within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
          ),
        );
      }

      return {
        data: { facilities: top },
        caveats,
        sources: [
          source({
            title: `EPA ECHO CWA — facilities within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            url: queryUrl,
            publisher: "U.S. EPA ECHO",
          }),
          source({
            title: "EPA ECHO CWA — GeoJSON for the same query",
            url: geojsonUrl,
            publisher: "U.S. EPA ECHO",
          }),
        ],
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_big_users_nearby failed")],
        sources: [],
      };
    }
  },
};
