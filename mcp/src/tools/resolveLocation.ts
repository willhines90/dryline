/**
 * resolve_location — geocode an address and enrich with watershed/county/GCD/PWS context.
 *
 * Foundation tool: every other tool downstream uses this output.
 *
 * Live providers used:
 *   - Nominatim (OpenStreetMap) for geocoding [free, requires User-Agent]
 *   - Census Geocoder for county FIPS [free, no key]
 *
 * Stretch enrichments (TODO — fill in as snapshots are loaded):
 *   - HUC-12 watershed lookup (USGS Watershed Boundary Dataset → DuckDB)
 *   - GCD lookup (TWDB GCD list → DuckDB, county-aware)
 *   - PWS ID lookup (EPA SDWIS via ECHO; can be inferred from address service area)
 */

import { z } from "zod";
import type { DrylineTool, ResolvedLocation } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";

const inputSchema = z.object({
  address: z.string().min(3).describe("Free-text Texas address. e.g. '123 RR 12, Wimberley, TX 78676'"),
});

type Input = z.infer<typeof inputSchema>;

/**
 * Texas county-name → 5-digit FIPS map. Used as a fallback when Census
 * Geocoder is unavailable (it 5xxs under load). Covers the seven demo
 * counties plus the seven "in-the-chamber" locations from
 * fixtures/demo-addresses.json. Expand as needed.
 *
 * Names are lowercase, with no "County" suffix and no Texas-style
 * abbreviations.
 */
const TX_COUNTY_FIPS: Record<string, string> = {
  hays: "48209",
  williamson: "48491",
  pecos: "48371",
  harris: "48201",
  lubbock: "48303",
  "el paso": "48141",
  bexar: "48029",
  travis: "48453",
  dallas: "48113",
  tarrant: "48439",
  denton: "48121",
  collin: "48085",
  galveston: "48167",
  midland: "48329",
  ector: "48135",
  reeves: "48389",
  brewster: "48043",
  presidio: "48377",
  jeff_davis: "48243",
  hudspeth: "48229",
};

function countyKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+county\s*$/i, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

async function fetchCensusCounty(
  url: URL,
): Promise<{ geoid: string; name: string } | null> {
  // Census 502s under load. Three attempts with exponential backoff.
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastErr = `Census ${res.status}`;
        if (res.status < 500) break; // 4xx won't fix itself
        continue;
      }
      const json = (await res.json()) as {
        result?: { geographies?: { Counties?: Array<{ GEOID?: string; NAME?: string }> } };
      };
      const county = json.result?.geographies?.Counties?.[0];
      if (county?.GEOID && county.NAME) {
        return { geoid: county.GEOID, name: county.NAME };
      }
      lastErr = "Census returned no county";
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  if (lastErr) {
    console.warn(`[resolve_location] Census fallback (${lastErr})`);
  }
  return null;
}

export const resolveLocation: DrylineTool<Input, ResolvedLocation> = {
  name: "resolve_location",
  description:
    "Resolve a Texas address to lat/lng and enrich with county FIPS, watershed (HUC-12), groundwater conservation district, and public water system ID. Foundation for all other tools.",
  inputSchema,
  run: async ({ address }) => {
    // Build sources as we go so partial-failure paths still cite what worked.
    const sources: ReturnType<typeof source>[] = [];
    try {
      // 1. Nominatim geocoding (one-shot; rate-limit: 1 req/s, set UA from env).
      const ua = process.env.NOMINATIM_USER_AGENT ?? "Dryline/0.0.1";
      const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
      nominatimUrl.searchParams.set("q", address);
      nominatimUrl.searchParams.set("format", "jsonv2");
      nominatimUrl.searchParams.set("addressdetails", "1");
      nominatimUrl.searchParams.set("countrycodes", "us");
      nominatimUrl.searchParams.set("limit", "1");

      // Defensive 8s timeout — Nominatim's free tier occasionally hangs
      // for 30+s under load, which can drag a whole investigation to the
      // edge of the function timeout. Fail fast instead.
      const geoRes = await fetch(nominatimUrl, {
        headers: { "User-Agent": ua },
        signal: AbortSignal.timeout(8000),
      });
      if (!geoRes.ok) throw new Error(`Nominatim ${geoRes.status}`);
      sources.push(
        source({ title: "Nominatim — geocoding", url: nominatimUrl.toString(), publisher: "OpenStreetMap" }),
      );
      const geoJson = (await geoRes.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
        address?: { state?: string; county?: string };
      }>;
      const top = geoJson[0];
      if (!top) {
        return {
          data: null,
          caveats: [{ severity: "error", category: "inference", message: "Geocoder returned no results for that address." }],
          sources,
        };
      }
      if (top.address?.state !== "Texas") {
        return {
          data: null,
          caveats: [{ severity: "error", category: "bounds", message: "Address resolved outside Texas. Dryline only covers TX." }],
          sources,
        };
      }

      const lat = Number(top.lat);
      const lng = Number(top.lon);

      // 2. Census Geocoder for county FIPS (Nominatim doesn't always include
      // it cleanly). 3-retry exponential backoff; fall back to a TX-only
      // county-name → FIPS lookup using Nominatim's address.county when
      // Census is sustainedly unavailable.
      const censusUrl = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
      censusUrl.searchParams.set("x", String(lng));
      censusUrl.searchParams.set("y", String(lat));
      censusUrl.searchParams.set("benchmark", "Public_AR_Current");
      censusUrl.searchParams.set("vintage", "Current_Current");
      censusUrl.searchParams.set("layers", "Counties");
      censusUrl.searchParams.set("format", "json");

      let countyFips: string | null = null;
      let countyName: string | null = null;
      const censusResult = await fetchCensusCounty(censusUrl);
      const censusCaveats: typeof errorCaveat extends never ? never : ReturnType<typeof boundsCaveat>[] = [];
      if (censusResult) {
        countyFips = censusResult.geoid;
        countyName = censusResult.name.replace(/ County$/i, "");
        sources.push(
          source({
            title: "Census Geocoder — county FIPS",
            url: censusUrl.toString(),
            publisher: "U.S. Census Bureau",
          }),
        );
      } else if (top.address?.county) {
        // Fallback: Nominatim already gave us the county name; map TX → FIPS.
        const key = countyKey(top.address.county);
        const fips = TX_COUNTY_FIPS[key];
        if (fips) {
          countyFips = fips;
          countyName = top.address.county.replace(/ County$/i, "");
          censusCaveats.push(
            boundsCaveat(
              `Census Geocoder unreachable; resolved county FIPS via Nominatim's '${top.address.county}' field against Dryline's Texas county table.`,
              "warning",
            ),
          );
        }
      }
      if (!countyFips || !countyName) {
        throw new Error("Could not resolve county FIPS via Census or Nominatim fallback.");
      }

      const data: ResolvedLocation = {
        lat,
        lng,
        formattedAddress: top.display_name,
        countyFips,
        countyName,
        stateAbbr: "TX",
        // TODO: HUC-12, GCD, PWS lookups via DuckDB snapshots.
        // Add freshness caveats when those snapshots are wired in.
      };

      return {
        data,
        caveats: [
          freshnessCaveat({ asOf: new Date().toISOString().slice(0, 10), cadence: "live (geocoder)" }),
          ...censusCaveats,
          boundsCaveat("Watershed (HUC-12), GCD, and PWS enrichment are not yet wired in."),
        ],
        sources,
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "resolve_location failed")],
        sources,
      };
    }
  },
};
