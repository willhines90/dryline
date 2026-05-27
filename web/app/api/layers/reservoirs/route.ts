/**
 * TWDB reservoir levels for the map's reservoir layer hover/click states.
 *
 * For each of the curated TX reservoirs we render as pins, this returns the
 * current % full, the same-day-of-year historical average, a 7-day trend,
 * and the last-reading date. The map uses these to:
 *   - color the pin by drought/full status,
 *   - show a richer hover tooltip,
 *   - render a 30-day sparkline in the click-detail card.
 *
 * Data source: TWDB Water Data for Texas REST.
 *   - /reservoirs/api/instantaneous — slug + lat/lng index (37 instrumented).
 *   - /reservoirs/individual/<slug>.csv — daily history.
 *
 * The CSVs are slow to fetch (~37 × ~50 KB), so we cache the entire payload
 * in-process for 1 hour. Daily updates from TWDB, so the staleness is fine.
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600; // 1 hr

const INSTANTANEOUS_URL =
  "https://www.waterdatafortexas.org/reservoirs/api/instantaneous";

interface ReservoirIndexEntry {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

interface ReservoirHistoryRow {
  date: string;
  percentFull: number;
}

export interface ReservoirObservation {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** Most recent percent_full (0..100). null when feed has no rows. */
  pctFull: number | null;
  /** Same calendar day-of-year average across all history. */
  historicalAvg: number | null;
  /** 7-day trajectory — sparkline-friendly. Most recent last. */
  series: Array<{ d: string; v: number }>;
  /** Percent_full change over the last 7 days (pos = filling). */
  trend7d: number | null;
  /** ISO date of the most recent reading. */
  lastUpdated: string | null;
}

interface CachePayload {
  generatedAt: string;
  reservoirs: ReservoirObservation[];
}

let memoryCache: { at: number; payload: CachePayload } | null = null;
const MEMORY_TTL_MS = 60 * 60 * 1000;

interface InstantaneousFeature {
  type: "Feature";
  geometry?: { type: "Point"; coordinates: [number, number] };
  properties?: {
    lake_url_name?: string;
    lake_full_name?: string;
    lake_short_name?: string;
    lake_condensed_name?: string;
  };
}

async function loadIndex(): Promise<ReservoirIndexEntry[]> {
  const res = await fetch(INSTANTANEOUS_URL, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TWDB instantaneous ${res.status}`);
  const json = (await res.json()) as { features?: InstantaneousFeature[] };
  return (json.features ?? [])
    .filter((f) => f.geometry?.coordinates && f.properties?.lake_url_name)
    .map((f) => ({
      slug: f.properties!.lake_url_name!,
      name:
        f.properties!.lake_full_name ??
        f.properties!.lake_short_name ??
        f.properties!.lake_condensed_name ??
        f.properties!.lake_url_name!,
      lng: f.geometry!.coordinates[0]!,
      lat: f.geometry!.coordinates[1]!,
    }));
}

function parseCsv(csv: string): ReservoirHistoryRow[] {
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

async function loadHistory(slug: string, attempt = 0): Promise<ReservoirHistoryRow[]> {
  const url = `https://www.waterdatafortexas.org/reservoirs/individual/${slug}.csv`;
  try {
    // Skip Next's fetch cache — some CSVs (e.g. Elephant Butte, 3MB) exceed the
    // 2MB per-item limit and would warn-spam. Our in-memory `memoryCache` of
    // the parsed payload handles caching across requests.
    const res = await fetch(url, {
      headers: { Accept: "text/csv" },
      cache: "no-store",
      // 25s timeout — TWDB occasionally hangs and a stuck connection
      // shouldn't drag down the whole batch.
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 400));
        return loadHistory(slug, attempt + 1);
      }
      return [];
    }
    const csv = await res.text();
    const rows = parseCsv(csv);
    if (rows.length === 0 && attempt < 1) {
      await new Promise((r) => setTimeout(r, 400));
      return loadHistory(slug, attempt + 1);
    }
    return rows;
  } catch {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 400));
      return loadHistory(slug, attempt + 1);
    }
    return [];
  }
}

/**
 * For a given calendar day, find the average percent_full across all historic
 * rows that fall on the same month/day (any year). The TWDB MCP tool uses
 * the same approach to surface "65% full vs 78% historical avg for May 26."
 */
function sameDayOfYearAverage(rows: ReservoirHistoryRow[], today: Date): number | null {
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const parts = r.date.split("-");
    if (parts.length !== 3) continue;
    const rm = Number(parts[1]) - 1;
    const rd = Number(parts[2]);
    if (rm === m && rd === d) {
      sum += r.percentFull;
      n++;
    }
  }
  return n > 0 ? sum / n : null;
}

async function computeForSlug(idx: ReservoirIndexEntry): Promise<ReservoirObservation> {
  try {
    const rows = await loadHistory(idx.slug);
    if (rows.length === 0) {
      return {
        slug: idx.slug,
        name: idx.name,
        lat: idx.lat,
        lng: idx.lng,
        pctFull: null,
        historicalAvg: null,
        series: [],
        trend7d: null,
        lastUpdated: null,
      };
    }
    // Sort ascending by date so the most recent row is last.
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const last = rows[rows.length - 1]!;
    // Pull the last 7 unique daily readings for the sparkline.
    const tail = rows.slice(-7).map((r) => ({ d: r.date, v: r.percentFull }));
    const trend7d =
      tail.length >= 2 ? tail[tail.length - 1]!.v - tail[0]!.v : null;
    const today = new Date();
    return {
      slug: idx.slug,
      name: idx.name,
      lat: idx.lat,
      lng: idx.lng,
      pctFull: last.percentFull,
      historicalAvg: sameDayOfYearAverage(rows, today),
      series: tail,
      trend7d,
      lastUpdated: last.date,
    };
  } catch {
    return {
      slug: idx.slug,
      name: idx.name,
      lat: idx.lat,
      lng: idx.lng,
      pctFull: null,
      historicalAvg: null,
      series: [],
      trend7d: null,
      lastUpdated: null,
    };
  }
}

async function buildPayload(): Promise<CachePayload> {
  const index = await loadIndex();
  // Concurrency cap — TWDB tolerates parallel hits, but unbounded fan-out
  // can occasionally trip their gateway. Six-at-a-time keeps us friendly.
  const out: ReservoirObservation[] = [];
  const queue = index.slice();
  const workers = new Array(6).fill(null).map(async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      out.push(await computeForSlug(next));
    }
  });
  await Promise.all(workers);
  return {
    generatedAt: new Date().toISOString(),
    reservoirs: out,
  };
}

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    // Don't trust a cached payload whose entries are all-null — a flaky
    // TWDB fetch can poison the cache for an hour otherwise. Re-fetch if
    // the cache looks empty.
    const cacheIsHealthy =
      memoryCache &&
      memoryCache.payload.reservoirs.some((r) => r.pctFull != null);
    if (!cacheIsHealthy || Date.now() - (memoryCache?.at ?? 0) > MEMORY_TTL_MS) {
      const payload = await buildPayload();
      // Only cache if the fetch actually returned data; otherwise leave
      // the old (possibly stale-but-non-empty) cache in place.
      if (payload.reservoirs.some((r) => r.pctFull != null)) {
        memoryCache = { at: Date.now(), payload };
      } else if (memoryCache) {
        // Keep the previous cache; the new payload is unusable.
      } else {
        // No prior cache and the fetch returned all-null — surface as 502
        // so the client can render the "live data not in feed" fallback
        // instead of pretending the data was simply missing.
        return new Response(JSON.stringify({ error: "TWDB returned empty payload" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify(memoryCache!.payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
