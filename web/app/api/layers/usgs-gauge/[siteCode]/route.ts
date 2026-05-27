/**
 * Per-gauge 7-day discharge series for the gauge hover/click detail card.
 *
 * Returns ~672 readings (15-min intervals × 7 days) downsampled to one
 * point every 4 hours so the sparkline payload stays small. USGS NWIS
 * Instantaneous Values service is used with `period=P7D`.
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const revalidate = 900; // 15 min

interface NwisTimeSeries {
  sourceInfo?: {
    siteName?: string;
    siteCode?: Array<{ value?: string }>;
    geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } };
  };
  variable?: { unit?: { unitCode?: string } };
  values?: Array<{
    value?: Array<{ value?: string; dateTime?: string; qualifiers?: string[] }>;
  }>;
}

interface NwisResponse {
  value?: { timeSeries?: NwisTimeSeries[] };
}

export interface GaugeDetail {
  siteCode: string;
  siteName: string;
  lat: number;
  lng: number;
  unit: string;
  currentCfs: number | null;
  /** Min/max over the window, useful for sparkline scaling. */
  min: number | null;
  max: number | null;
  median: number | null;
  series: Array<{ t: string; v: number | null }>;
  lastUpdated: string | null;
}

const memCache = new Map<string, { at: number; payload: GaugeDetail }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ siteCode: string }> },
): Promise<Response> {
  const { siteCode } = await ctx.params;
  if (!/^\d{6,15}$/.test(siteCode)) {
    return Response.json({ error: "Invalid site code" }, { status: 400 });
  }
  const cached = memCache.get(siteCode);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Response.json(cached.payload);
  }
  try {
    const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
    url.searchParams.set("format", "json");
    url.searchParams.set("sites", siteCode);
    url.searchParams.set("parameterCd", "00060");
    url.searchParams.set("period", "P7D");
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      return Response.json({ error: `USGS NWIS ${res.status}` }, { status: 502 });
    }
    const json = (await res.json()) as NwisResponse;
    const ts = json.value?.timeSeries?.[0];
    if (!ts) {
      return Response.json({ error: "No series for site" }, { status: 404 });
    }
    const values = ts.values?.[0]?.value ?? [];
    // Downsample to one point per 4-hour window so the sparkline payload is
    // bounded (~42 points/week vs ~672 raw). Pick the most recent reading
    // inside each window so spikes are preserved.
    const bucketMs = 4 * 60 * 60 * 1000;
    const buckets = new Map<number, { t: string; v: number | null }>();
    for (const v of values) {
      if (!v.dateTime) continue;
      const t = Date.parse(v.dateTime);
      if (!Number.isFinite(t)) continue;
      const bucket = Math.floor(t / bucketMs);
      const raw = v.value;
      let num: number | null = null;
      if (raw != null && raw !== "") {
        const n = Number(raw);
        if (Number.isFinite(n) && n > -10000) num = n;
      }
      buckets.set(bucket, { t: v.dateTime, v: num });
    }
    const series = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, x]) => x);
    const numbers = series.map((s) => s.v).filter((x): x is number => x != null);
    numbers.sort((a, b) => a - b);
    const median =
      numbers.length === 0
        ? null
        : numbers.length % 2 === 1
          ? numbers[Math.floor(numbers.length / 2)]!
          : (numbers[numbers.length / 2 - 1]! + numbers[numbers.length / 2]!) / 2;
    const currentCfs = series.length ? series[series.length - 1]?.v ?? null : null;
    const payload: GaugeDetail = {
      siteCode,
      siteName: ts.sourceInfo?.siteName ?? `USGS ${siteCode}`,
      lat: ts.sourceInfo?.geoLocation?.geogLocation?.latitude ?? 0,
      lng: ts.sourceInfo?.geoLocation?.geogLocation?.longitude ?? 0,
      unit: ts.variable?.unit?.unitCode ?? "ft3/s",
      currentCfs,
      min: numbers.length ? numbers[0]! : null,
      max: numbers.length ? numbers[numbers.length - 1]! : null,
      median,
      series,
      lastUpdated: series.length ? series[series.length - 1]?.t ?? null : null,
    };
    memCache.set(siteCode, { at: Date.now(), payload });
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
