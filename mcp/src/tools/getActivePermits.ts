/**
 * get_active_permits — currently-active CWA / NPDES permits near a point.
 *
 * Source: EPA ECHO Clean Water Act REST services (same endpoint as
 * get_big_users_nearby; this tool is the focused-on-permit-status view).
 *
 * Honest note: ECHO doesn't expose a clean "comment window open" field.
 * What this returns is the set of currently *effective* NPDES permits
 * within a radius, with the ECHO Detailed Facility Report URL so a user
 * can drill into the permit's docket page and check for comment-period
 * status manually. TCEQ-only state permits (RG-211 water rights, etc.)
 * are not in ECHO and are explicitly out of scope for the MVP.
 */

import { z } from "zod";
import type { Caveat, DrylineTool, Source } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";
import { haversineMiles } from "../lib/twdb.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(50).default(15),
  /** Only return permits whose first reporting cycle started within this many days of today. Default 730 (≈ 2 years). */
  freshDays: z.number().int().min(30).max(3650).default(730),
  limit: z.number().int().min(1).max(50).default(20),
});

type Input = z.infer<typeof inputSchema>;

type PermitCategory = "individual_npdes" | "general_permit" | "other";

interface ActivePermit {
  npdesId: string;
  facilityName: string;
  permitCategory: PermitCategory;
  permitStatus: string | null;
  /** Reported average flow in MGD; null for general permits. */
  actualAverageFlowMgd: number | null;
  city: string | null;
  county: string | null;
  state: string | null;
  lat: number;
  lng: number;
  distanceMi: number;
  detailedFacilityReportUrl: string | null;
}

interface ActivePermitsOutput {
  permits: ActivePermit[];
  /** ISO date used as the upper bound for freshDays filtering (today). */
  freshAsOf: string;
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
  geometry: { type: "Point"; coordinates: [number, number] } | null;
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
  features?: CwaFeature[];
}

async function echoJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    if (res.status < 500 || attempt === 1) throw new Error(`ECHO ${res.status}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`ECHO retries exhausted for ${url}`);
}

function bboxFor(lat: number, lng: number, mi: number) {
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
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const getActivePermits: DrylineTool<Input, ActivePermitsOutput> = {
  name: "get_active_permits",
  description:
    "Return currently-effective NPDES permits within radius of a Texas point, sorted by distance. Each permit returns its NPDES ID, current status, reported avg flow (when individual), and a link to the EPA ECHO Detailed Facility Report where comment-period status, recent enforcement actions, and DMR data can be reviewed. Note: TCEQ-only state water-rights permits are NOT in ECHO; this tool covers the federally-reportable set only.",
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
      const summaryErr = summary?.Results?.Error?.ErrorMessage;
      if (summaryErr) throw new Error(`ECHO get_facilities: ${summaryErr}`);
      if (!summary?.Results) {
        const snippet = JSON.stringify(summary).slice(0, 160);
        throw new Error(`ECHO get_facilities: unexpected response shape (no Results): ${snippet}`);
      }
      const qid = summary.Results.QueryID;
      if (!qid) throw new Error("ECHO get_facilities: missing QueryID");
      const version = summary.Results.Version ?? "CWA";

      const geojsonUrl = `${ECHO_BASE}/cwa_rest_services.get_geojson?qid=${encodeURIComponent(qid)}`;
      const geojson = await echoJson<GeoJsonResponse>(geojsonUrl);
      const features = geojson.features ?? [];

      const permits: ActivePermit[] = [];
      for (const feature of features) {
        const coords = feature.geometry?.coordinates;
        if (!coords) continue;
        const [fLng, fLat] = coords;
        const distance = haversineMiles({ lat, lng }, { lat: fLat, lng: fLng });
        if (distance > radiusMi) continue;
        const props = feature.properties ?? {};
        const npdesId = (props.SourceID ?? "").trim();
        if (!npdesId) continue;
        // Only "Effective" status counts as an active permit for this tool.
        const status = props.CWPPermitStatusDesc ?? null;
        if (status && status.toLowerCase() !== "effective") continue;
        permits.push({
          npdesId,
          facilityName: (props.CWPName ?? "").trim() || "(unnamed facility)",
          permitCategory: categorizePermit(npdesId),
          permitStatus: status,
          actualAverageFlowMgd: asNumberOrNull(props.CWPActualAverageFlowNmbr),
          city: props.CWPCity ?? null,
          county: props.CWPCounty ?? null,
          state: props.CWPState ?? null,
          lat: fLat,
          lng: fLng,
          distanceMi: Math.round(distance * 100) / 100,
          detailedFacilityReportUrl: `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(npdesId)}`,
        });
      }

      permits.sort((a, b) => a.distanceMi - b.distanceMi);
      const top = permits.slice(0, limit);

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
          "ECHO covers federally-reportable permits only. TCEQ-only state water-rights permits, GCD authorizations, and pending applications are NOT in this data — for a full picture, check the TCEQ Central Registry and the relevant Groundwater Conservation District directly.",
        ),
        boundsCaveat(
          "ECHO does not surface comment-period open/close dates in a machine-readable field. Click each permit's Detailed Facility Report URL to check the docket page for current comment-window status.",
        ),
      ];

      if (permits.length > top.length) {
        caveats.push(
          boundsCaveat(
            `Returned the closest ${top.length} of ${permits.length} effective permits within ${radiusMi} mi. Increase limit to see more.`,
          ),
        );
      }

      if (top.length === 0) {
        caveats.push(
          boundsCaveat(
            `No active CWA / NPDES permit within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
          ),
        );
      }

      const sources: Source[] = [
        source({
          title: `EPA ECHO CWA — effective permits within ${radiusMi} mi of (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          url: queryUrl,
          publisher: "U.S. EPA ECHO",
        }),
      ];
      for (const p of top) {
        if (p.detailedFacilityReportUrl) {
          sources.push(
            source({
              title: `EPA ECHO Detailed Facility Report — ${p.facilityName} (${p.npdesId})`,
              url: p.detailedFacilityReportUrl,
              publisher: "U.S. EPA ECHO",
            }),
          );
        }
      }

      return {
        data: {
          permits: top,
          freshAsOf: new Date().toISOString().slice(0, 10),
        },
        caveats,
        sources,
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_active_permits failed")],
        sources: [],
      };
    }
  },
};
