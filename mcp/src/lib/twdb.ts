/**
 * TWDB Water Data for Texas — small client used by `get_reservoirs`.
 *
 * Two endpoints we rely on:
 *   1. `/reservoirs/api/instantaneous` (GeoJSON, 37 instrumented reservoirs).
 *      Gives us slug + name + lat/lng. No `percent_full`, only flood metrics.
 *   2. `/reservoirs/individual/<slug>.csv` (full daily history).
 *      Gives us `percent_full`, `conservation_storage`, etc., plus the
 *      calendar history needed for a same-day-of-year average.
 *
 * Both responses are cached in-process for the life of the server. The 122
 * major-reservoir list is larger than the 37 in the instantaneous feed; the
 * remaining ~85 are minor reservoirs without flood instrumentation. For the
 * hackathon scope (Hill Country / I-35 / coast), the 37 covers every demo
 * address; we surface a `bounds` caveat so the agent knows.
 */
import { source } from "./sources.js";
import type { Source } from "../types.js";

const INSTANTANEOUS_URL =
  "https://www.waterdatafortexas.org/reservoirs/api/instantaneous";

export interface ReservoirIndexEntry {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ReservoirHistoryRow {
  date: string; // YYYY-MM-DD
  percentFull: number; // 0..100
}

let indexCache: ReservoirIndexEntry[] | null = null;
const historyCache = new Map<string, ReservoirHistoryRow[]>();

interface InstantaneousFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    lake_url_name: string;
    lake_full_name?: string;
    lake_short_name?: string;
    lake_condensed_name?: string;
  };
}

export async function loadReservoirIndex(): Promise<ReservoirIndexEntry[]> {
  if (indexCache) return indexCache;
  const res = await fetch(INSTANTANEOUS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`TWDB instantaneous ${res.status}`);
  const json = (await res.json()) as { features: InstantaneousFeature[] };
  indexCache = json.features
    .filter((f) => f?.geometry?.coordinates && f.properties?.lake_url_name)
    .map((f) => ({
      slug: f.properties.lake_url_name,
      name:
        f.properties.lake_full_name ??
        f.properties.lake_short_name ??
        f.properties.lake_condensed_name ??
        f.properties.lake_url_name,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  return indexCache;
}

export function instantaneousSource(): Source {
  return source({
    title: "TWDB Water Data for Texas — instantaneous reservoir feed",
    url: INSTANTANEOUS_URL,
    publisher: "Texas Water Development Board",
  });
}

export function reservoirCsvUrl(slug: string): string {
  return `https://www.waterdatafortexas.org/reservoirs/individual/${slug}.csv`;
}

export function reservoirPageUrl(slug: string): string {
  return `https://www.waterdatafortexas.org/reservoirs/individual/${slug}`;
}

/**
 * Parse the TWDB per-reservoir CSV. Skips comment lines (`#`) and the header.
 * The schema we depend on is `date,...,percent_full,...` — column order varies
 * slightly by reservoir, so we resolve `date` and `percent_full` by header
 * name rather than positional index.
 */
function parseReservoirCsv(csv: string): ReservoirHistoryRow[] {
  const lines = csv.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("#")) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx < 0) return [];
  const headerLine = lines[headerIdx];
  if (!headerLine) return [];
  const header = headerLine.split(",").map((h) => h.trim());
  const dateCol = header.indexOf("date");
  const pctCol = header.indexOf("percent_full");
  if (dateCol < 0 || pctCol < 0) return [];

  const rows: ReservoirHistoryRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("#")) continue;
    const cols = line.split(",");
    const date = cols[dateCol];
    const pctRaw = cols[pctCol];
    if (!date || !pctRaw) continue;
    const pct = Number(pctRaw);
    if (!Number.isFinite(pct)) continue;
    rows.push({ date, percentFull: pct });
  }
  return rows;
}

export async function loadReservoirHistory(slug: string): Promise<ReservoirHistoryRow[]> {
  const cached = historyCache.get(slug);
  if (cached) return cached;
  const url = reservoirCsvUrl(slug);
  const res = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!res.ok) throw new Error(`TWDB ${slug}.csv ${res.status}`);
  const csv = await res.text();
  const parsed = parseReservoirCsv(csv);
  historyCache.set(slug, parsed);
  return parsed;
}

/** Great-circle distance in statute miles between two lat/lng points. */
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
