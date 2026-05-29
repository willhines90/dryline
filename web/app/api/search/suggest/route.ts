/**
 * Address autocomplete for the header search bar.
 *
 * Queries two geocoders and merges them, Texas-only:
 *   1. US Census geocoder — authoritative US street-address coverage
 *      (house-number level). Runs only when the query contains a digit
 *      (i.e. looks like a street address); Census is weak on bare city
 *      names. Census matches rank FIRST — they're the precise hits.
 *   2. Nominatim (OpenStreetMap) — good fuzzy / city / place coverage,
 *      but patchy on US house numbers, so it backs up Census rather than
 *      leading. We over-fetch and post-filter to state === Texas.
 *
 * This matches what the Investigate path already does (Nominatim + Census),
 * so a real address no longer reads as "No Texas matches" in the dropdown
 * while still being investigable. Cached in-memory for 5 minutes per query.
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
  source: "census" | "nominatim";
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

interface CensusMatch {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  addressComponents?: { city?: string; state?: string; zip?: string };
  geographies?: { Counties?: Array<{ NAME?: string; BASENAME?: string }> };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const memCache = new Map<string, { at: number; suggestions: Suggestion[] }>();

function regionFromCounty(county: string | undefined): string {
  if (!county) return "Texas";
  const c = county.replace(/ County$/i, "").trim();
  return c ? `${c} County` : "Texas";
}

// Census returns the matched address in ALL CAPS ("14106 HEATHERHILL PL,
// HOUSTON, TX, 77077"). Title-case it for display, keep the state code
// upper, and collapse the comma before the ZIP so it reads naturally.
function tidyCensusLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bTx\b/g, "TX")
    .replace(/, TX, /g, ", TX ");
}

async function fetchNominatim(q: string): Promise<Suggestion[]> {
  const ua = process.env.NOMINATIM_USER_AGENT ?? "Dryline/0.0.1 (autocomplete)";
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("limit", "12");
  const res = await fetch(url, {
    headers: { "User-Agent": ua, Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];
  const out: Suggestion[] = [];
  for (const h of hits) {
    if (h.address?.state !== "Texas") continue;
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const city =
      h.address?.city ?? h.address?.town ?? h.address?.village ?? h.address?.hamlet ?? "";
    const county = (h.address?.county ?? "").replace(/ County$/i, "");
    const label = (h.display_name ?? "").split(",").slice(0, 3).map((s) => s.trim()).join(", ");
    out.push({
      label: label || h.display_name || `${city || "Address"}, TX`,
      city: city || "Texas",
      county: county || "",
      region: regionFromCounty(h.address?.county),
      lat,
      lng,
      placeId: String(h.place_id ?? `${lat},${lng}`),
      source: "nominatim",
    });
  }
  return out;
}

async function fetchCensus(q: string): Promise<Suggestion[]> {
  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress",
  );
  url.searchParams.set("address", q);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");
  const res = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) throw new Error(`Census ${res.status}`);
  const data = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
  const matches = data.result?.addressMatches ?? [];
  const out: Suggestion[] = [];
  for (const m of matches) {
    if ((m.addressComponents?.state ?? "").toUpperCase() !== "TX") continue;
    const lat = Number(m.coordinates?.y);
    const lng = Number(m.coordinates?.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const co = m.geographies?.Counties?.[0];
    const county = (co?.BASENAME ?? "").trim();
    const city = m.addressComponents?.city
      ? tidyCensusLabel(m.addressComponents.city)
      : "Texas";
    out.push({
      label: tidyCensusLabel(m.matchedAddress ?? "") || `${city}, TX`,
      city,
      county,
      region: co?.NAME ?? regionFromCounty(county),
      lat,
      lng,
      placeId: `census:${lat.toFixed(5)},${lng.toFixed(5)}`,
      source: "census",
    });
  }
  return out;
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

  // Census only when the query looks like a street address (has a house
  // number); it returns nothing useful for bare city names, which
  // Nominatim and the local city list already cover.
  const hasHouseNumber = /\d/.test(q);
  const [census, nominatim] = await Promise.all([
    hasHouseNumber ? fetchCensus(q).catch(() => [] as Suggestion[]) : Promise.resolve([] as Suggestion[]),
    fetchNominatim(q).catch(() => [] as Suggestion[]),
  ]);

  // Census first (precise street hits), then Nominatim, deduped on a
  // normalized label so the same place doesn't appear twice.
  const seen = new Set<string>();
  const merged: Suggestion[] = [];
  for (const s of [...census, ...nominatim]) {
    const norm = s.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(norm)) continue;
    seen.add(norm);
    merged.push(s);
    if (merged.length >= 8) break;
  }

  memCache.set(key, { at: Date.now(), suggestions: merged });
  return Response.json({ suggestions: merged });
}
