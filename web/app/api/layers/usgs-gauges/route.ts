/**
 * USGS NWIS active stream gauges across Texas, with current discharge
 * (cfs) for each. Used by the map's "Stream gauges" layer.
 *
 * The full TX bbox query returns ~500 active gauges; payload is
 * ~150-300 KB once we strip to (siteCode, lat, lng, currentCfs,
 * latestReadingAt). Cached 15 minutes.
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const revalidate = 900; // 15 min

const TX_BBOX = { minLng: -106.65, minLat: 25.84, maxLng: -93.51, maxLat: 36.5 };

interface NwisTimeSeries {
  sourceInfo?: {
    siteName?: string;
    siteCode?: Array<{ value?: string }>;
    geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } };
  };
  values?: Array<{
    value?: Array<{ value?: string; dateTime?: string }>;
  }>;
}

interface NwisResponse {
  value?: { timeSeries?: NwisTimeSeries[] };
}

interface GaugeFeature {
  siteCode: string;
  siteName: string;
  lat: number;
  lng: number;
  currentCfs: number | null;
  latestReadingAt: string | null;
}

interface CachePayload {
  generatedAt: string;
  count: number;
  gauges: GaugeFeature[];
}

let memoryCache: { generatedAt: number; payload: CachePayload } | null = null;
const MEMORY_TTL_MS = 15 * 60 * 1000;

async function fetchAndPack(): Promise<CachePayload> {
  if (memoryCache && Date.now() - memoryCache.generatedAt < MEMORY_TTL_MS) {
    return memoryCache.payload;
  }
  // USGS NWIS rejects bboxes > ~25 sq°; Texas is ~130 sq°, so the
  // bbox query 400s. Use the stateCd filter instead — same active
  // discharge gauges, no size cap.
  const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
  url.searchParams.set("format", "json");
  url.searchParams.set("stateCd", "tx");
  url.searchParams.set("parameterCd", "00060");
  url.searchParams.set("siteStatus", "active");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`USGS NWIS ${res.status}`);
  const json = (await res.json()) as NwisResponse;
  const series = json.value?.timeSeries ?? [];

  const gauges: GaugeFeature[] = [];
  for (const ts of series) {
    const siteCode = ts.sourceInfo?.siteCode?.[0]?.value;
    const siteName = ts.sourceInfo?.siteName;
    const lat = ts.sourceInfo?.geoLocation?.geogLocation?.latitude;
    const lng = ts.sourceInfo?.geoLocation?.geogLocation?.longitude;
    if (!siteCode || !siteName || lat == null || lng == null) continue;
    const latest = ts.values?.[0]?.value?.[0];
    let cfs: number | null = null;
    const raw = latest?.value;
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n > -10000) cfs = n;
    }
    gauges.push({
      siteCode,
      siteName,
      lat,
      lng,
      currentCfs: cfs,
      latestReadingAt: latest?.dateTime ?? null,
    });
  }

  const payload: CachePayload = {
    generatedAt: new Date().toISOString(),
    count: gauges.length,
    gauges,
  };
  memoryCache = { generatedAt: Date.now(), payload };
  return payload;
}

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const payload = await fetchAndPack();
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
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
