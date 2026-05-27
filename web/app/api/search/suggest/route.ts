/**
 * Nominatim-backed address autocomplete for the header search bar.
 *
 * Returns up to 8 Texas-only suggestions for a free-text query. Cached
 * in-memory for 5 minutes per query (Nominatim's policy is 1 req/sec
 * per user, and typeahead would blow through that without caching).
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

interface Suggestion {
  label: string;
  city: string;
  county: string;
  region: string;
  lat: number;
  lng: number;
  placeId: string;
}

interface NominatimHit {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const memCache = new Map<string, { at: number; suggestions: Suggestion[] }>();

function regionFromCounty(county: string | undefined): string {
  if (!county) return "Texas";
  // Rough geographic banding — same buckets the curated demo addresses use.
  const c = county.replace(/ County$/i, "").trim();
  return c ? `${c} County` : "Texas";
}

export async function GET(req: NextRequest): Promise<Response> {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return Response.json({ suggestions: [] });
  }
  const key = q.toLowerCase();
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Response.json({ suggestions: cached.suggestions });
  }
  try {
    const ua = process.env.NOMINATIM_USER_AGENT ?? "Dryline/0.0.1 (autocomplete)";
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("limit", "12");
    // Nominatim doesn't support a `state=` filter, so we over-fetch and
    // post-filter for state === Texas to give the UI ~8 hits.
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return Response.json({ suggestions: [], error: `Nominatim ${res.status}` }, { status: 502 });
    }
    const hits = (await res.json()) as NominatimHit[];
    const suggestions: Suggestion[] = [];
    for (const h of hits) {
      if (h.address?.state !== "Texas") continue;
      const lat = Number(h.lat);
      const lng = Number(h.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const city =
        h.address?.city ?? h.address?.town ?? h.address?.village ?? h.address?.hamlet ?? "";
      const county = (h.address?.county ?? "").replace(/ County$/i, "");
      // Shorten display_name to first 3 comma-separated parts for a compact label.
      const label = (h.display_name ?? "").split(",").slice(0, 3).map((s) => s.trim()).join(", ");
      suggestions.push({
        label: label || h.display_name || `${city || "Address"}, TX`,
        city: city || "Texas",
        county: county || "",
        region: regionFromCounty(h.address?.county),
        lat,
        lng,
        placeId: String(h.place_id ?? `${lat},${lng}`),
      });
      if (suggestions.length >= 8) break;
    }
    memCache.set(key, { at: Date.now(), suggestions });
    return Response.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ suggestions: [], error: message }, { status: 502 });
  }
}
