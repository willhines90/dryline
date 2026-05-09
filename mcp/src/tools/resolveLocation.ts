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

export const resolveLocation: DrylineTool<Input, ResolvedLocation> = {
  name: "resolve_location",
  description:
    "Resolve a Texas address to lat/lng and enrich with county FIPS, watershed (HUC-12), groundwater conservation district, and public water system ID. Foundation for all other tools.",
  inputSchema,
  run: async ({ address }) => {
    try {
      // 1. Nominatim geocoding (one-shot; rate-limit: 1 req/s, set UA from env).
      const ua = process.env.NOMINATIM_USER_AGENT ?? "Dryline/0.0.1";
      const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
      nominatimUrl.searchParams.set("q", address);
      nominatimUrl.searchParams.set("format", "jsonv2");
      nominatimUrl.searchParams.set("addressdetails", "1");
      nominatimUrl.searchParams.set("countrycodes", "us");
      nominatimUrl.searchParams.set("limit", "1");

      const geoRes = await fetch(nominatimUrl, { headers: { "User-Agent": ua } });
      if (!geoRes.ok) throw new Error(`Nominatim ${geoRes.status}`);
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
          sources: [source({ title: "Nominatim", url: nominatimUrl.toString(), publisher: "OpenStreetMap" })],
        };
      }
      if (top.address?.state !== "Texas") {
        return {
          data: null,
          caveats: [{ severity: "error", category: "bounds", message: "Address resolved outside Texas. Dryline only covers TX." }],
          sources: [source({ title: "Nominatim", url: nominatimUrl.toString(), publisher: "OpenStreetMap" })],
        };
      }

      const lat = Number(top.lat);
      const lng = Number(top.lon);

      // 2. Census Geocoder for county FIPS (Nominatim doesn't always include it cleanly).
      const censusUrl = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
      censusUrl.searchParams.set("x", String(lng));
      censusUrl.searchParams.set("y", String(lat));
      censusUrl.searchParams.set("benchmark", "Public_AR_Current");
      censusUrl.searchParams.set("vintage", "Current_Current");
      censusUrl.searchParams.set("layers", "Counties");
      censusUrl.searchParams.set("format", "json");

      const censusRes = await fetch(censusUrl);
      if (!censusRes.ok) throw new Error(`Census ${censusRes.status}`);
      const censusJson = (await censusRes.json()) as {
        result?: { geographies?: { Counties?: Array<{ GEOID?: string; NAME?: string }> } };
      };
      const county = censusJson.result?.geographies?.Counties?.[0];
      if (!county?.GEOID || !county.NAME) {
        throw new Error("Census did not return a county for that point.");
      }

      const data: ResolvedLocation = {
        lat,
        lng,
        formattedAddress: top.display_name,
        countyFips: county.GEOID,
        countyName: county.NAME.replace(/ County$/i, ""),
        stateAbbr: "TX",
        // TODO: HUC-12, GCD, PWS lookups via DuckDB snapshots.
        // Add freshness caveats when those snapshots are wired in.
      };

      return {
        data,
        caveats: [
          freshnessCaveat({ asOf: new Date().toISOString().slice(0, 10), cadence: "live (geocoder)" }),
          boundsCaveat("Watershed (HUC-12), GCD, and PWS enrichment are not yet wired in."),
        ],
        sources: [
          source({ title: "Nominatim — geocoding", url: nominatimUrl.toString(), publisher: "OpenStreetMap" }),
          source({ title: "Census Geocoder — county FIPS", url: censusUrl.toString(), publisher: "U.S. Census Bureau" }),
        ],
      };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "resolve_location failed")],
        sources: [],
      };
    }
  },
};
