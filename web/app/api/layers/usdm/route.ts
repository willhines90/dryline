/**
 * USDM (U.S. Drought Monitor) drought polygons, clipped to Texas.
 *
 * The upstream JSON at usdm_current.json is ~17 MB (CONUS-wide). We
 * fetch once, intersect every drought polygon with the Texas state
 * polygon (loaded from /public/tx-bounds-precise.geojson), and return
 * a much smaller GeoJSON containing only the Texas-clipped pieces.
 *
 * Note: an earlier version of this route only filtered by bounding-box
 * overlap, which kept entire polygons whose bbox touched Texas — so
 * drought areas visibly sprawled into Oklahoma, Louisiana, and Mexico.
 * The turf.intersect path actually cuts each polygon against the
 * Texas border so layer geometry stops at the state line.
 *
 * Cached for 24 h via Next's revalidate so we don't re-fetch on every
 * page load.
 */
import type { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { featureCollection, intersect, polygon as turfPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export const runtime = "nodejs";
export const revalidate = 86400; // 24 h

const TX_BBOX = { minLng: -106.7, minLat: 25.6, maxLng: -93.2, maxLat: 36.8 };

function ringBBox(ring: number[][]): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
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

function bboxOverlapsTexas(b: ReturnType<typeof ringBBox>): boolean {
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

let txClipFeature: Feature<Polygon | MultiPolygon> | null = null;
async function getTxClipFeature(): Promise<Feature<Polygon | MultiPolygon>> {
  if (txClipFeature) return txClipFeature;
  const fp = path.resolve(process.cwd(), "public", "tx-bounds-precise.geojson");
  const raw = await fs.readFile(fp, "utf-8");
  const fc = JSON.parse(raw) as { features: Array<Feature<Polygon | MultiPolygon>> };
  const first = fc.features[0];
  if (!first) throw new Error("tx-bounds-precise.geojson has no features");
  txClipFeature = first;
  return first;
}

let memoryCache: { generatedAt: number; payload: UsdmFC } | null = null;
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchAndClip(): Promise<UsdmFC> {
  if (memoryCache && Date.now() - memoryCache.generatedAt < MEMORY_TTL_MS) {
    return memoryCache.payload;
  }
  const [res, txFeature] = await Promise.all([
    fetch("https://droughtmonitor.unl.edu/data/json/usdm_current.json", {
      next: { revalidate: 86400 },
    }),
    getTxClipFeature(),
  ]);
  if (!res.ok) throw new Error(`USDM upstream ${res.status}`);
  const fc = (await res.json()) as UsdmFC;

  const out: UsdmFeature[] = [];
  for (const feat of fc.features ?? []) {
    if (!feat.geometry) continue;
    const polys: number[][][][] =
      feat.geometry.type === "MultiPolygon"
        ? (feat.geometry.coordinates as number[][][][])
        : [feat.geometry.coordinates as number[][][]];

    // Fast bbox cull first so we don't call turf for every poly in the US.
    const candidates: number[][][][] = [];
    for (const poly of polys) {
      const outer = poly[0];
      if (!outer) continue;
      if (bboxOverlapsTexas(ringBBox(outer))) candidates.push(poly);
    }
    if (candidates.length === 0) continue;

    // Real clip: intersect each candidate polygon against Texas.
    const clipped: (Polygon | MultiPolygon)[] = [];
    for (const poly of candidates) {
      const drought = turfPolygon(poly);
      try {
        const result = intersect(featureCollection([drought, txFeature]));
        if (result?.geometry) clipped.push(result.geometry);
      } catch {
        // Self-intersecting / topology-error inputs occasionally throw
        // from turf. Drop those — the polygon will be absent rather
        // than wrong; alternatives are worse.
      }
    }
    if (clipped.length === 0) continue;

    // Recombine clipped pieces into one Polygon/MultiPolygon feature.
    const allPolys: number[][][][] = [];
    for (const g of clipped) {
      if (g.type === "Polygon") allPolys.push(g.coordinates);
      else for (const p of g.coordinates) allPolys.push(p);
    }
    if (allPolys.length === 0) continue;

    out.push({
      type: "Feature",
      id: feat.id,
      properties: { DM: feat.properties.DM ?? 0 },
      geometry:
        allPolys.length === 1
          ? { type: "Polygon", coordinates: allPolys[0]! }
          : { type: "MultiPolygon", coordinates: allPolys },
    });
  }

  const payload: UsdmFC = { type: "FeatureCollection", features: out };
  memoryCache = { generatedAt: Date.now(), payload };
  return payload;
}

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const fc = await fetchAndClip();
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
