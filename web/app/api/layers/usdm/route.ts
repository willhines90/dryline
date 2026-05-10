/**
 * USDM (U.S. Drought Monitor) drought polygons, filtered to Texas.
 *
 * The upstream JSON at usdm_current.json is ~17 MB (CONUS-wide). We
 * fetch once, walk the MultiPolygon coords, drop rings whose bounding
 * boxes don't intersect Texas, and return a much smaller GeoJSON.
 * Cached for 24 h via Next's revalidate so we don't re-fetch on every
 * page load.
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const revalidate = 86400; // 24 h

const TX_BBOX = { minLng: -106.7, minLat: 25.6, maxLng: -93.2, maxLat: 36.8 };

interface RingBBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function ringBBox(ring: number[][]): RingBBox {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const pt of ring) {
    const lng = pt[0]!;
    const lat = pt[1]!;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

function bboxOverlapsTexas(b: RingBBox): boolean {
  return !(
    b.maxLng < TX_BBOX.minLng ||
    b.minLng > TX_BBOX.maxLng ||
    b.maxLat < TX_BBOX.minLat ||
    b.minLat > TX_BBOX.maxLat
  );
}

interface UsdmFeature {
  type: "Feature";
  id?: number | string;
  properties: Record<string, unknown> & { DM?: number; OBJECTID?: number };
  geometry: {
    type: "MultiPolygon" | "Polygon";
    coordinates: number[][][][] | number[][][];
  } | null;
}

interface UsdmFC {
  type: "FeatureCollection";
  features: UsdmFeature[];
}

let memoryCache: { generatedAt: number; payload: UsdmFC } | null = null;
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchAndFilter(): Promise<UsdmFC> {
  if (memoryCache && Date.now() - memoryCache.generatedAt < MEMORY_TTL_MS) {
    return memoryCache.payload;
  }
  const res = await fetch("https://droughtmonitor.unl.edu/data/json/usdm_current.json", {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`USDM upstream ${res.status}`);
  const fc = (await res.json()) as UsdmFC;

  const out: UsdmFeature[] = [];
  for (const feat of fc.features ?? []) {
    if (!feat.geometry) continue;
    const polys: number[][][][] =
      feat.geometry.type === "MultiPolygon"
        ? (feat.geometry.coordinates as number[][][][])
        : [feat.geometry.coordinates as number[][][]];

    const keptPolys: number[][][][] = [];
    for (const poly of polys) {
      // poly = array of rings (outer + holes). Test outer ring's bbox.
      const outer = poly[0];
      if (!outer) continue;
      if (bboxOverlapsTexas(ringBBox(outer))) {
        keptPolys.push(poly);
      }
    }
    if (keptPolys.length === 0) continue;

    out.push({
      type: "Feature",
      id: feat.id,
      properties: { DM: feat.properties.DM ?? 0 },
      geometry:
        keptPolys.length === 1
          ? { type: "Polygon", coordinates: keptPolys[0]! }
          : { type: "MultiPolygon", coordinates: keptPolys },
    });
  }

  const payload: UsdmFC = { type: "FeatureCollection", features: out };
  memoryCache = { generatedAt: Date.now(), payload };
  return payload;
}

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const fc = await fetchAndFilter();
    return new Response(JSON.stringify(fc), {
      headers: {
        "Content-Type": "application/geo+json",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
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
