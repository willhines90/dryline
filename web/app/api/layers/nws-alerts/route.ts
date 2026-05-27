/**
 * Active NWS weather alerts in Texas. Proxies https://api.weather.gov/alerts
 * (which is rate-limited and requires a contact User-Agent) and reshapes
 * the response into a compact GeoJSON FeatureCollection the map can
 * render directly.
 *
 * Cached in-process for 2 minutes. The NWS server-side cache is ~5 min
 * so we stay well under their guidance.
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const revalidate = 120;

interface NwsFeature {
  id?: string;
  geometry?: { type: string; coordinates: unknown };
  properties?: {
    event?: string;
    severity?: string;
    urgency?: string;
    headline?: string;
    description?: string;
    areaDesc?: string;
    effective?: string;
    expires?: string;
    onset?: string;
    ends?: string;
    senderName?: string;
  };
}

interface NwsResponse {
  features?: NwsFeature[];
}

let memCache: { at: number; payload: unknown } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

/** Map NWS event names to a coarse severity bucket the styling key uses. */
function bucketFor(event: string | undefined): "tornado" | "severe" | "flood" | "winter" | "heat" | "other" {
  const e = (event ?? "").toLowerCase();
  if (e.includes("tornado")) return "tornado";
  if (e.includes("severe thunderstorm") || e.includes("hurricane") || e.includes("tropical")) return "severe";
  if (e.includes("flood") || e.includes("flash")) return "flood";
  if (e.includes("winter") || e.includes("snow") || e.includes("ice") || e.includes("blizzard")) return "winter";
  if (e.includes("heat") || e.includes("fire") || e.includes("red flag") || e.includes("excessive")) return "heat";
  return "other";
}

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    if (memCache && Date.now() - memCache.at < CACHE_TTL_MS) {
      return Response.json(memCache.payload);
    }
    const ua = process.env.NWS_USER_AGENT ?? "Dryline/0.0.1 (mail@willhin.es)";
    // ?area=TX restricts to Texas alerts; ?status=actual filters out tests.
    const url = "https://api.weather.gov/alerts/active?area=TX&status=actual";
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/geo+json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return Response.json({ type: "FeatureCollection", features: [], error: `NWS ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as NwsResponse;
    const feats = (data.features ?? [])
      .filter((f) => f.geometry && f.geometry.type) // some alerts ship without polygons (county-level fallback only)
      .map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry as { type: string; coordinates: unknown },
        properties: {
          event: f.properties?.event ?? "Alert",
          severity: f.properties?.severity ?? "Unknown",
          urgency: f.properties?.urgency ?? "Unknown",
          headline: f.properties?.headline ?? "",
          areaDesc: f.properties?.areaDesc ?? "",
          effective: f.properties?.effective ?? null,
          expires: f.properties?.expires ?? null,
          senderName: f.properties?.senderName ?? "",
          bucket: bucketFor(f.properties?.event),
        },
      }));
    const payload = { type: "FeatureCollection" as const, features: feats };
    memCache = { at: Date.now(), payload };
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ type: "FeatureCollection", features: [], error: message }, { status: 502 });
  }
}
