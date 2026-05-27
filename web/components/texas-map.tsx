"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoLocation, Mode, TraceEvent } from "@/lib/types";
import type { StyleSpecification } from "maplibre-gl";
import {
  LayerControl,
  useLayerToggles,
  type LayerSpec,
  type LayerKey,
} from "./dryline/layer-control";
import { useDarkMode } from "./dryline/dark-mode-toggle";
import { cn } from "@/lib/utils";

function Swatch({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 border border-ink/20" style={{ background: color }} />;
}

function Pin({ fill, ring }: { fill: string; ring: string }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full border-2"
      style={{ background: fill, borderColor: ring }}
    />
  );
}

type MapInstance = import("maplibre-gl").Map;
type PopupInstance = import("maplibre-gl").Popup;

const TEXAS_BOUNDS: [[number, number], [number, number]] = [
  [-106.7, 25.6],
  [-93.2, 36.8],
];

/**
 * Dual-basemap setup: both Voyager (paper) and Dark Matter (live) tiles
 * are loaded as sources. Dark mode flips layer visibility — no full
 * style swap, so all our overlays stay mounted across the toggle.
 */
const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "base-paper": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 19,
    },
    "base-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 19,
    },
  },
  layers: [
    { id: "base-paper", type: "raster", source: "base-paper" },
    {
      id: "base-dark",
      type: "raster",
      source: "base-dark",
      layout: { visibility: "none" },
    },
  ],
};

/**
 * Live-data shape returned by `/api/layers/reservoirs`. Same TS shape as the
 * route's `ReservoirObservation` — kept inline so the web layer doesn't
 * import server-only code.
 */
interface ReservoirObservation {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  pctFull: number | null;
  historicalAvg: number | null;
  series: Array<{ d: string; v: number }>;
  trend7d: number | null;
  lastUpdated: string | null;
}

/**
 * Pick a fill color for the reservoir lake glyph based on how its current
 * percent_full compares to the same-day-of-year historical average.
 * Same color logic the synthesis card uses, kept in sync by hand.
 *
 * `tier` is a stable identifier (no spaces) used by the symbol layer's
 * `icon-image` match expression to pick the right rasterized icon.
 */
type ReservoirTier =
  | "nodata"
  | "critical"
  | "low"
  | "below-avg"
  | "moderate"
  | "near-full";
function reservoirFill(pct: number | null, hist: number | null): {
  fill: string;
  stroke: string;
  label: string;
  tier: ReservoirTier;
} {
  if (pct == null) return { fill: "#9ec5cf", stroke: "#4a6c78", label: "no data", tier: "nodata" };
  if (pct < 30) return { fill: "#6f1d10", stroke: "#3a0d05", label: "critical", tier: "critical" };
  if (pct < 50) return { fill: "#a85a35", stroke: "#7a3d21", label: "low", tier: "low" };
  if (hist != null && pct < hist - 10) return { fill: "#b58a52", stroke: "#7a5a2c", label: "below avg", tier: "below-avg" };
  if (pct < 75) return { fill: "#4a8aa8", stroke: "#2566a8", label: "moderate", tier: "moderate" };
  return { fill: "#0d3b6f", stroke: "#061f3d", label: "near full", tier: "near-full" };
}

/**
 * Rasterize an SVG markup string into an HTMLImageElement we can hand
 * to MapLibre's `map.addImage`. Returns a 2x-density image so it stays
 * crisp on retina displays.
 */
function svgToImage(svgString: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  });
}

/** Build a 2x retina SVG of a lake glyph for the given tier. Returns the
 *  full SVG document string, ready for svgToImage. */
function lakeIconSvg(tier: ReservoirTier): string {
  // Tier → matching fill/stroke. We can't call reservoirFill directly
  // because pct/hist aren't known here — invert the table.
  const swatch: Record<ReservoirTier, { fill: string; stroke: string }> = {
    nodata: { fill: "#9ec5cf", stroke: "#4a6c78" },
    critical: { fill: "#6f1d10", stroke: "#3a0d05" },
    low: { fill: "#a85a35", stroke: "#7a3d21" },
    "below-avg": { fill: "#b58a52", stroke: "#7a5a2c" },
    moderate: { fill: "#4a8aa8", stroke: "#2566a8" },
    "near-full": { fill: "#0d3b6f", stroke: "#061f3d" },
  };
  const { fill, stroke } = swatch[tier];
  // 44×32 = 2× the visible 22×16 logical size. addImage with
  // pixelRatio: 2 maps it back. A subtle drop shadow gives the icon
  // weight against busy basemaps.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="36" viewBox="0 0 48 36">
    <defs>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="0.5" flood-color="#07171f" flood-opacity="0.32"/>
      </filter>
    </defs>
    <g filter="url(#s)" transform="translate(2, 2)">
      <path d="M 8 18 C 3 14, 3.6 9, 9 7 C 13 5.4, 18 6.4, 22 6 C 26.4 5.6, 31 3.6, 35 6 C 40 8.8, 42 14, 40 19 C 38 24, 33 26.4, 28 26.4 C 23 26.4, 18 27.6, 13 26 C 8 24.4, 5 21.6, 8 18 Z"
            fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 12 15 Q 16 13, 20 15 T 28 15 T 34 15"
            fill="none" stroke="#eef2f3" stroke-opacity="0.85" stroke-width="1.6" stroke-linecap="round"/>
    </g>
  </svg>`;
}

/**
 * Build an inline SVG sparkline as an HTML string so we can drop it into
 * the popup's `setHTML`. Mirrors the SparkLine component used in the side
 * panel — straight polyline through 7-day percent_full readings with the
 * historical average as a dashed reference line.
 */
function sparklineSvg(
  series: Array<{ d: string; v: number }>,
  reference: number | null,
  opts: { w?: number; h?: number; color?: string } = {},
): string {
  const w = opts.w ?? 120;
  const h = opts.h ?? 28;
  const color = opts.color ?? "#0d3b6f";
  if (!series.length) {
    return `<svg width="${w}" height="${h}" aria-label="No data"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#9ec5cf" stroke-width="1" stroke-dasharray="2 2"/></svg>`;
  }
  const padX = 1;
  const padY = 3;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const vs = series.map((p) => p.v);
  let vmin = Math.min(...vs);
  let vmax = Math.max(...vs);
  if (typeof reference === "number") {
    vmin = Math.min(vmin, reference);
    vmax = Math.max(vmax, reference);
  }
  if (vmin === vmax) {
    vmin -= 0.5;
    vmax += 0.5;
  }
  const span = vmax - vmin;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;
  const xAt = (i: number) => padX + i * step;
  const yAt = (v: number) => padY + innerH * (1 - (v - vmin) / span);
  const d = series.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.v).toFixed(2)}`).join(" ");
  const last = series[series.length - 1]!;
  const refLine =
    typeof reference === "number"
      ? `<line x1="${padX}" x2="${w - padX}" y1="${yAt(reference).toFixed(2)}" y2="${yAt(reference).toFixed(2)}" stroke="#b58a52" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="2 2"/>`
      : "";
  return `<svg width="${w}" height="${h}" aria-label="7-day trend">${refLine}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${xAt(series.length - 1).toFixed(2)}" cy="${yAt(last.v).toFixed(2)}" r="2.2" fill="${color}"/></svg>`;
}

/**
 * Lake-body glyph. An irregular blob outline (a stylized lake shoreline
 * seen from above) rather than a perfect ellipse so it reads as a
 * water body rather than a colored sticker. A single highlight ripple
 * inside hints at the surface without becoming a graphic-design tat.
 */
function lakeGlyphHtml(fill: string, stroke: string): string {
  return `<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
    <path d="M 4 9 C 1.5 7, 1.8 4.5, 4.5 3.5 C 6.5 2.7, 9 3.2, 11 3 C 13.2 2.8, 15.5 1.8, 17.5 3 C 20 4.4, 21 7, 20 9.5 C 19 12, 16.5 13.2, 14 13.2 C 11.5 13.2, 9 13.8, 6.5 13 C 4 12.2, 2.5 10.8, 4 9 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M 6 7.5 Q 8 6.5, 10 7.5 T 14 7.5 T 17 7.5" fill="none" stroke="#eef2f3" stroke-opacity="0.85" stroke-width="0.9" stroke-linecap="round"/>
  </svg>`;
}

/** Teardrop map-pin glyph for demo addresses. Color = mode/live.
 *  Kept for the legend swatch only — pins on the map render via the
 *  WebGL symbol layer (teardropIconSvg below). */
function teardropPinHtml(fill: string, ring: string): string {
  return `<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
    <path d="M 9 1.5 C 4.5 1.5 1.5 4.8 1.5 9 C 1.5 14.5 9 20.5 9 20.5 C 9 20.5 16.5 14.5 16.5 9 C 16.5 4.8 13.5 1.5 9 1.5 Z" fill="${fill}" stroke="${ring}" stroke-width="1.4"/>
    <circle cx="9" cy="9" r="2.6" fill="#eef2f3"/>
  </svg>`;
}

/** Teardrop pin icon for the demo-address WebGL symbol layer. Renders at
 *  2× density (36×44) so it stays crisp on retina. icon-anchor:bottom
 *  aligns the tip with the lat/lng. */
type DemoIconKey = "personal-live" | "personal-staged" | "transparency-live" | "transparency-staged";
function demoIconSvg(key: DemoIconKey): string {
  const palette: Record<DemoIconKey, { fill: string; ring: string }> = {
    "personal-live": { fill: "#0d3b6f", ring: "#9ec5cf" },
    "personal-staged": { fill: "#9ec5cf", ring: "#dde6e9" },
    "transparency-live": { fill: "#b58a52", ring: "#7a5a2c" },
    "transparency-staged": { fill: "#cdb38a", ring: "#9c7a52" },
  };
  const { fill, ring } = palette[key];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <defs>
      <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="0.9" flood-color="#07171f" flood-opacity="0.42"/>
      </filter>
    </defs>
    <g filter="url(#s)">
      <path d="M 18 3 C 9 3 3 9.6 3 18 C 3 29 18 41 18 41 C 18 41 33 29 33 18 C 33 9.6 27 3 18 3 Z"
            fill="${fill}" stroke="${ring}" stroke-width="2.8" stroke-linejoin="round"/>
      <circle cx="18" cy="18" r="5.2" fill="#eef2f3"/>
    </g>
  </svg>`;
}

/** Curated set of major TX reservoirs we used to hard-code; now superseded
 *  by the live TWDB feed but kept for emergency fallback if the feed fails. */
const RESERVOIR_PINS: Array<{ name: string; slug: string; lat: number; lng: number }> = [
  { name: "Lake Travis", slug: "travis", lat: 30.391869, lng: -97.907234 },
  { name: "Canyon Lake", slug: "canyon", lat: 29.86883, lng: -98.198898 },
  { name: "Lake Granger", slug: "granger", lat: 30.7029, lng: -97.339 },
  { name: "Lake Buchanan", slug: "buchanan", lat: 30.785, lng: -98.4178 },
  { name: "Lake LBJ", slug: "lbj", lat: 30.5519, lng: -98.3539 },
  { name: "Lake Conroe", slug: "conroe", lat: 30.4413, lng: -95.5747 },
  { name: "Lake Houston", slug: "houston", lat: 29.9211, lng: -95.1402 },
  { name: "Lake Texoma", slug: "texoma", lat: 33.8316, lng: -96.7022 },
  { name: "Possum Kingdom Lake", slug: "possum_kingdom", lat: 32.8762, lng: -98.4283 },
  { name: "Lake Whitney", slug: "whitney", lat: 31.9332, lng: -97.3711 },
  { name: "Lake Tawakoni", slug: "tawakoni", lat: 32.8728, lng: -95.9569 },
  { name: "Sam Rayburn Reservoir", slug: "sam_rayburn", lat: 31.0606, lng: -94.1062 },
  { name: "Toledo Bend Reservoir", slug: "toledo_bend", lat: 31.5739, lng: -93.7488 },
  { name: "Caddo Lake", slug: "caddo", lat: 32.7193, lng: -94.1149 },
  { name: "Choke Canyon Reservoir", slug: "choke_canyon", lat: 28.4894, lng: -98.2519 },
  { name: "Falcon Lake", slug: "falcon", lat: 26.5566, lng: -99.1433 },
  { name: "Amistad Reservoir", slug: "amistad", lat: 29.4513, lng: -101.0297 },
  { name: "Red Bluff Reservoir", slug: "red_bluff", lat: 31.8967, lng: -103.9197 },
];

function modeMarker(mode: Mode | undefined, isLive: boolean | undefined): {
  fill: string;
  ring: string;
} {
  if (!isLive) return { fill: "#9ec5cf", ring: "#dde6e9" };
  if (mode === "transparency") return { fill: "#b58a52", ring: "#7a5a2c" };
  return { fill: "#0d3b6f", ring: "#9ec5cf" };
}

const DROUGHT_COLORS = ["#cdd9b4", "#cfb27a", "#a85a35", "#6f1d10", "#4a0d05"];
// DM 0=D0(abnormal), 1=D1(moderate), 2=D2(severe), 3=D3(extreme), 4=D4(exceptional)

const LAYER_SPECS: LayerSpec[] = [
  { key: "samples", label: "Sample addresses", swatch: "#0d3b6f", hint: "Seven sample Texas addresses spanning Hill Country, the I-35 corridor, Trans-Pecos, the Coast, the Panhandle, Far West Texas, and the Edwards recharge zone." },
  { key: "drought", label: "Drought (USDM)", swatch: "#a85a35", hint: "Current week's U.S. Drought Monitor polygons, clipped to Texas." },
  { key: "rivers", label: "Major rivers", swatch: "#0d3b6f", hint: "Twelve TX river main stems (simplified centerlines)." },
  { key: "reservoirs", label: "Reservoirs", swatch: "#4a8aa8", hint: "Major TWDB-instrumented reservoirs with live % full + 7-day trend." },
  { key: "gauges", label: "Stream gauges", swatch: "#2566a8", hint: "USGS NWIS active discharge gauges, ~500 across Texas." },
  { key: "aquifers", label: "Major aquifers", swatch: "#1f4d4a", hint: "TWDB major aquifer outcrop polygons (Ogallala, Edwards, Trinity, Carrizo, Gulf Coast, Edwards-Trinity, Pecos Valley, Seymour, Hueco-Bolson)." },
];

// Per-aquifer fill colors. Earth-tone family so they sit below all
// the blue water layers without competing for the eye.
const AQUIFER_COLORS: Record<string, string> = {
  OGALLALA: "#c9a36a",
  "EDWARDS-TRINITY": "#7a9b6b",
  TRINITY: "#a7794a",
  EDWARDS: "#4a8a72",
  CARRIZO: "#b58a52",
  "GULF_COAST": "#9bb5a8",
  "PECOS VALLEY": "#cdb38a",
  SEYMOUR: "#8a7a52",
  "HUECO_BOLSON": "#9c7a52",
};
const AQUIFER_LABELS: Record<string, string> = {
  OGALLALA: "Ogallala",
  "EDWARDS-TRINITY": "Edwards-Trinity (Plateau)",
  TRINITY: "Trinity",
  EDWARDS: "Edwards (Balcones FZ)",
  CARRIZO: "Carrizo-Wilcox",
  "GULF_COAST": "Gulf Coast",
  "PECOS VALLEY": "Pecos Valley",
  SEYMOUR: "Seymour",
  "HUECO_BOLSON": "Hueco-Bolson",
};

/**
 * Curated one-paragraph briefing per major TX aquifer. Used in the
 * hover popup so a viewer who doesn't know which aquifer is which can
 * still understand the stakes at a glance. Sources are the TWDB major
 * aquifer report (2022) and the cause-area press the dataset is
 * referenced in (Sierra Club, Texas Living Waters, etc.).
 */
interface AquiferFact {
  extent: string;
  status: string;
  story: string;
}
const AQUIFER_FACTS: Record<string, AquiferFact> = {
  OGALLALA: {
    extent: "Texas Panhandle / High Plains (8 states total)",
    status: "Declining — irrigation depletion",
    story:
      "The canonical American aquifer-depletion story. Saturated thickness has dropped 30–50 ft across much of the TX High Plains since 1950, driven mostly by cotton irrigation. Recharge is negligible at human timescales.",
  },
  "EDWARDS-TRINITY": {
    extent: "West-central Texas / Edwards Plateau",
    status: "Mixed — local stress in Hill Country",
    story:
      "The plateau-side cousin of Edwards proper. Less regulated and less productive than Edwards (Balcones FZ); supports many Hill Country wells. Drought-of-record sensitivity is high.",
  },
  TRINITY: {
    extent: "Hill Country + Cross Timbers / Fort Worth metro",
    status: "Declining — heavy DFW pumping",
    story:
      "Multi-layered (Glen Rose, Hensell, Hosston). DFW and Hill Country growth has pulled levels down ~1.5 ft/yr in several monitoring wells. Hays Trinity GCD and others have limited regulatory authority.",
  },
  EDWARDS: {
    extent: "Balcones Fault Zone — Austin/San Marcos/San Antonio",
    status: "Regulated — best-managed major aquifer in TX",
    story:
      "Most-regulated aquifer in Texas via the Edwards Aquifer Authority. J-17 well (San Antonio) is the public benchmark — pumping rules trigger off its elevation. Comal/San Marcos springs depend on it.",
  },
  CARRIZO: {
    extent: "Wedge across East-Central Texas",
    status: "Mixed — large; significant municipal + ag use",
    story:
      "Carrizo-Wilcox is the largest aquifer system in TX by area. Supplies Austin's south side, Bryan-College Station, and many smaller towns. Some sub-units stressed; others stable.",
  },
  GULF_COAST: {
    extent: "Coastal Plain — Houston, Beaumont, Corpus Christi",
    status: "Subsidence + saltwater intrusion",
    story:
      "Over-pumping caused dramatic subsidence in Houston-Galveston (>10 ft in places); the Harris-Galveston Subsidence District forced conversion to surface water. Saltwater intrusion threatens coastal portions.",
  },
  "PECOS VALLEY": {
    extent: "Trans-Pecos — Pecos and Reeves counties",
    status: "Stressed — irrigation + Republic Water shipments",
    story:
      "Sits beneath the Pecos River basin. The same aquifer Comanche Springs (Fort Stockton) tapped before 1950s irrigation dried them up. Republic Water permits to ship to El Paso are the active fight.",
  },
  SEYMOUR: {
    extent: "Rolling Plains / NW Texas",
    status: "Locally stressed — small but heavily relied on",
    story:
      "A shallow, narrow aquifer along the Brazos and Wichita drainages. Quality issues (nitrate, salinity) limit some areas. Small in extent but critical for the communities atop it.",
  },
  "HUECO_BOLSON": {
    extent: "El Paso + Ciudad Juárez border region",
    status: "Stable — thanks to desalination + treaty water",
    story:
      "Shared with Mexico. The Kay Bailey Hutchison desalination plant (largest inland desal in the U.S.) plus Rio Grande treaty water and aggressive conservation have stabilized levels in recent years — a rare positive story.",
  },
};

type MapLocation = DemoLocation & {
  approxLatLng?: { lat: number; lng: number };
  live?: boolean;
};

interface TexasMapProps {
  locations: MapLocation[];
  focusedLocation?: MapLocation | null;
  investigationActive?: boolean;
  onLocationClick?: (loc: MapLocation) => void;
  /** Tool-result events from the active investigation drive map storytelling. */
  traces?: TraceEvent[];
}

export function TexasMap({
  locations,
  focusedLocation,
  investigationActive,
  onLocationClick,
  traces,
}: TexasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  // Note: demo address pins AND reservoirs are both WebGL symbol
  // layers now (effects 1c + 4b). No per-marker ref needed.
  const mapReadyRef = useRef(false);
  const [mapReadyState, setMapReadyState] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const onLocationClickRef = useRef(onLocationClick);
  // Live TWDB observations keyed by slug. Used to color reservoir glyphs
  // and to render rich hover tooltips with sparklines + historical avg.
  const [reservoirData, setReservoirData] = useState<Map<string, ReservoirObservation>>(
    () => new Map(),
  );

  const { state: layerState, toggle: toggleLayer } = useLayerToggles(LAYER_SPECS);
  const { dark } = useDarkMode();

  useEffect(() => {
    onLocationClickRef.current = onLocationClick;
  }, [onLocationClick]);

  // One-shot fetch of live TWDB reservoir state. The Map is keyed by slug
  // so renderers can look up rich data without juggling array indices.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/layers/reservoirs", { cache: "no-store" });
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn("[reservoirs] api not ok", res.status);
          return;
        }
        const payload = (await res.json()) as { reservoirs?: ReservoirObservation[] };
        if (cancelled || !payload.reservoirs) return;
        const map = new Map<string, ReservoirObservation>();
        for (const r of payload.reservoirs) {
          map.set(r.slug, r);
          // Some local pin slugs use `_` where TWDB uses `-` (e.g.
          // `red_bluff` vs `red-bluff`); index both forms so the renderer
          // can match either.
          map.set(r.slug.replace(/-/g, "_"), r);
        }
        // eslint-disable-next-line no-console
        console.log("[reservoirs] loaded", payload.reservoirs.length, "travis-entry=", JSON.stringify(map.get("travis")), "first-entry=", JSON.stringify(payload.reservoirs[0]));
        setReservoirData(map);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[reservoirs] fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flip basemap visibility when dark mode toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    try {
      map.setLayoutProperty("base-paper", "visibility", dark ? "none" : "visible");
      map.setLayoutProperty("base-dark", "visibility", dark ? "visible" : "none");
    } catch {
      /* layer not yet mounted; safe */
    }
  }, [dark, mapReadyState]);

  // ---- 1. Map mount + permanent markers ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    async function mountMap() {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: BASE_STYLE,
          center: [-99.2, 31.1],
          zoom: 5.25,
          minZoom: 4.25,
          maxZoom: 14,
          attributionControl: false,
        });
        mapRef.current = map;
        // Attribution as a compact "i" in top-right.
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
        // Zoom +/- and compass on the top-left (out of the way of the
        // bottom-left legend and bottom-right layer panel). The
        // visualizePitch flag draws a tilt indicator when the user
        // rotates with right-click drag.
        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: false,
          }),
          "top-left",
        );
        // Scale bar (km on top, mi on bottom would be ideal but
        // maplibre only supports one unit at a time; "imperial" is
        // what most visitors expect here).
        map.addControl(
          new maplibregl.ScaleControl({ maxWidth: 90, unit: "imperial" }),
          "top-left",
        );

        map.on("error", (e) => {
          // eslint-disable-next-line no-console
          console.warn("[TexasMap] tile/source error:", e?.error ?? e);
        });

        // MapLibre measures its container exactly once at construction.
        // If the container's first layout pass is wrong (a common SSR/
        // hydration hiccup in this app's h-screen + flex layout), the
        // canvas freezes at that small size and leaves whitespace below
        // until a window resize wakes it up. A ResizeObserver on the
        // container forces map.resize() whenever the slot actually
        // changes size — covers both first-paint and any future layout
        // shift (sidebar open/close, viewport resize).
        const containerEl = containerRef.current;
        if (containerEl && typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(() => {
            try {
              map.resize();
            } catch {
              /* map may be torn down */
            }
          });
          ro.observe(containerEl);
          (map as MapInstance & { __ro?: ResizeObserver }).__ro = ro;
        }
        // Belt-and-suspenders: one explicit resize on the next two
        // animation frames in case the container is still settling.
        requestAnimationFrame(() => {
          try { map.resize(); } catch {}
          requestAnimationFrame(() => {
            try { map.resize(); } catch {}
          });
        });

        map.on("load", () => {
          map.fitBounds(TEXAS_BOUNDS, { padding: 36, duration: 0 });
          mapReadyRef.current = true;
          setMapReadyState(true);

          // Reservoirs are no longer HTML markers — they're a MapLibre
          // symbol layer added by a separate useEffect once the TWDB
          // payload arrives. Symbol layers project through the same
          // WebGL pipeline as drought / rivers / aquifers / gauges, so
          // they don't lag behind those layers during zoom animations.

          // Demo address pins are now a WebGL symbol layer too — see
          // effect 1c below. Keeping them in the same pipeline as
          // reservoirs guarantees zero drift across zoom animations.
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[TexasMap] mount failed:", err);
        setMountError(err instanceof Error ? err.message : String(err));
      }
    }

    mountMap();

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      const ro = (mapRef.current as (MapInstance & { __ro?: ResizeObserver }) | null)?.__ro;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locations]);

  // ---- 2. Camera control ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (focusedLocation?.approxLatLng) {
        map.flyTo({
          center: [focusedLocation.approxLatLng.lng, focusedLocation.approxLatLng.lat],
          zoom: 9.25,
          duration: 1400,
          essential: true,
        });
      } else {
        map.fitBounds(TEXAS_BOUNDS, { padding: 36, duration: 900 });
      }
    };
    if (mapReadyRef.current) apply();
    else map.once("load", apply);
  }, [focusedLocation]);

  // ---- 1c. Demo address pin SYMBOL LAYER ----
  //
  // Same WebGL approach as the reservoir layer. Eliminates the JS-
  // frame lag that made HTML demo markers visibly drift during zoom
  // animations. icon-anchor:bottom puts the teardrop tip exactly on
  // the lat/lng (no popup-vs-pin alignment math).
  const demoHandlersRef = useRef<{
    onClick?: (e: import("maplibre-gl").MapMouseEvent) => void;
    onEnter?: (e: import("maplibre-gl").MapMouseEvent) => void;
    onLeave?: () => void;
    popup?: PopupInstance;
  }>({});
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    const SRC = "dryline-demo-pins";
    const LAYER = "dryline-demo-pins-symbols";
    let cancelled = false;

    type DemoEvt = import("maplibre-gl").MapMouseEvent & {
      features?: import("maplibre-gl").MapGeoJSONFeature[];
    };

    (async () => {
      const ml = await import("maplibre-gl");

      // Register icon variants once. 4 keys = mode × live/staged so
      // a not-yet-live demo can render in a faded variant if needed.
      const keys: DemoIconKey[] = [
        "personal-live",
        "personal-staged",
        "transparency-live",
        "transparency-staged",
      ];
      for (const k of keys) {
        const name = `dryline-demo-${k}`;
        if (map.hasImage(name)) continue;
        try {
          const img = await svgToImage(demoIconSvg(k));
          if (cancelled) return;
          if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
        } catch {
          /* swallow */
        }
      }

      // Build features from the locations prop. Store the full location
      // payload in JSON form on each feature so the click + hover
      // handlers can hand it straight back to handlePick.
      const features = locations
        .filter((l) => l.approxLatLng)
        .map((l) => {
          const mode = l.mode ?? "personal";
          const live = l.live === false ? "staged" : "live";
          const iconKey: DemoIconKey = `${mode}-${live}` as DemoIconKey;
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [l.approxLatLng!.lng, l.approxLatLng!.lat],
            },
            properties: {
              id: l.id,
              label: l.label,
              region: l.region,
              headlineStory:
                (l as DemoLocation & { headlineStory?: string }).headlineStory ?? "",
              mode,
              iconKey,
              // Round-trip the full location through the feature so the
              // click handler can reconstruct it without a lookup.
              payload: JSON.stringify(l),
            },
          };
        });

      const fc = { type: "FeatureCollection" as const, features };
      const existing = map.getSource(SRC) as
        | (import("maplibre-gl").GeoJSONSource & { setData: (d: unknown) => void })
        | undefined;
      if (existing) {
        existing.setData(fc);
      } else {
        map.addSource(SRC, { type: "geojson", data: fc });
      }

      if (!map.getLayer(LAYER)) {
        map.addLayer({
          id: LAYER,
          type: "symbol",
          source: SRC,
          layout: {
            "icon-image": [
              "match",
              ["get", "iconKey"],
              "personal-live", "dryline-demo-personal-live",
              "personal-staged", "dryline-demo-personal-staged",
              "transparency-live", "dryline-demo-transparency-live",
              "transparency-staged", "dryline-demo-transparency-staged",
              "dryline-demo-personal-live",
            ],
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4, 0.55,
              7, 0.75,
              10, 0.95,
              13, 1.1,
            ],
          },
        });
      }

      // Demo pins sit on TOP of all other layers (above the mask, above
      // the outline). They're the primary call-to-action so they win
      // z-order even when overlapping.
      // (Default layer order: newly-added layer is on top, so no move
      // needed unless we mounted before another layer — handled below.)

      const popup =
        demoHandlersRef.current.popup ??
        new ml.Popup({
          anchor: "bottom",
          offset: 28,
          closeButton: false,
          closeOnClick: false,
          className: "dryline-demo-popup",
        });

      const onEnter = (e: DemoEvt) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
        const p = f.properties as {
          label?: string;
          region?: string;
          headlineStory?: string;
        };
        map.getCanvas().style.cursor = "pointer";
        const html = `<div style="padding:8px 12px;max-width:240px">
          <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Sample address · ${p.region ?? ""}</div>
          <div style="font-family:'Newsreader',serif;font-size:15px;color:#07171f;line-height:1.2;margin-top:4px">${p.label ?? ""}</div>
          <div style="font-family:'Newsreader',serif;font-style:italic;font-size:12.5px;color:#4a6c78;margin-top:6px;line-height:1.4">${p.headlineStory ?? ""}</div>
          <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:8px">Click pin to investigate ↗</div>
        </div>`;
        popup.setLngLat(coords).setHTML(html).addTo(map);
      };
      const onLeave = () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      };
      const onClick = (e: DemoEvt) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { payload?: string };
        if (!p.payload) return;
        try {
          const loc = JSON.parse(p.payload) as MapLocation;
          onLocationClickRef.current?.(loc);
        } catch {
          /* malformed */
        }
      };

      const prev = demoHandlersRef.current;
      if (prev.onClick) map.off("click", LAYER, prev.onClick);
      if (prev.onEnter) map.off("mouseenter", LAYER, prev.onEnter);
      if (prev.onLeave) map.off("mouseleave", LAYER, prev.onLeave);

      map.on("click", LAYER, onClick);
      map.on("mouseenter", LAYER, onEnter);
      map.on("mouseleave", LAYER, onLeave);
      demoHandlersRef.current = { onClick, onEnter, onLeave, popup };
    })();

    return () => {
      cancelled = true;
    };
  }, [locations, mapReadyState]);

  // ---- 2a. Focused address pulse (WebGL replacement for HTML rings) ----
  //
  // Single GeoJSON source with one point (the focused location). A
  // circle layer pulses radius + opacity via requestAnimationFrame so
  // the active pin reads as "investigating" without any DOM markup.
  // Hidden when no focused location or when an investigation isn't
  // active.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    const SRC = "dryline-focus-pulse";
    const LAYER = "dryline-focus-pulse-circles";
    const focused = focusedLocation?.approxLatLng;
    let frame: number | null = null;
    const cleanup = () => {
      if (frame) cancelAnimationFrame(frame);
      try {
        if (map.getLayer(LAYER)) map.removeLayer(LAYER);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* idempotent */
      }
    };
    if (!focused) return cleanup;
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [focused.lng, focused.lat] },
          properties: {},
        },
      ],
    };
    const existing = map.getSource(SRC) as
      | (import("maplibre-gl").GeoJSONSource & { setData: (d: unknown) => void })
      | undefined;
    if (existing) {
      existing.setData(fc);
    } else {
      map.addSource(SRC, { type: "geojson", data: fc });
    }
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": 14,
          "circle-color": "#0d3b6f",
          "circle-opacity": 0.18,
          "circle-stroke-color": "#0d3b6f",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.4,
        },
      });
    }

    // Place the pulse layer BELOW the demo pin symbols so the teardrop
    // stays on top.
    try {
      if (map.getLayer("dryline-demo-pins-symbols")) {
        map.moveLayer(LAYER, "dryline-demo-pins-symbols");
      }
    } catch {
      /* idempotent */
    }

    if (!investigationActive) {
      // Static glow when focused but idle.
      try {
        map.setPaintProperty(LAYER, "circle-radius", 14);
        map.setPaintProperty(LAYER, "circle-opacity", 0.18);
        map.setPaintProperty(LAYER, "circle-stroke-opacity", 0.45);
      } catch {
        /* layer may not be mounted yet */
      }
      return cleanup;
    }

    // Active investigation: 1.8s sine-driven pulse.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      try {
        map.setPaintProperty(LAYER, "circle-radius", 22);
        map.setPaintProperty(LAYER, "circle-opacity", 0.22);
      } catch {
        /* idempotent */
      }
      return cleanup;
    }

    const start = performance.now();
    const tick = (ts: number) => {
      const phase = ((ts - start) / 1800) * 2 * Math.PI;
      const k = (Math.sin(phase) + 1) / 2; // 0..1
      try {
        map.setPaintProperty(LAYER, "circle-radius", 14 + k * 22); // 14..36
        map.setPaintProperty(LAYER, "circle-opacity", 0.12 + (1 - k) * 0.18); // 0.30..0.12
        map.setPaintProperty(LAYER, "circle-stroke-opacity", 0.5 - k * 0.3);
      } catch {
        cancelAnimationFrame(frame!);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Don't remove the layer when transitioning between idle/active —
      // only the outer cleanup (no focused location) removes it.
    };
  }, [focusedLocation, investigationActive, mapReadyState]);

  // ---- 3. Active investigation overlay (radius disk) ----
  // While an investigation runs we pulse the disk's fill-opacity and
  // line-width on a sine-wave loop so the map reads as "thinking."
  // When idle, we revert to a static dashed ring at lower opacity.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let pulseFrame: number | null = null;
    const cancelPulse = () => {
      if (pulseFrame != null) {
        cancelAnimationFrame(pulseFrame);
        pulseFrame = null;
      }
    };
    const apply = () => {
      const SRC = "dryline-active-radius";
      const FILL = "dryline-active-radius-fill";
      const STROKE = "dryline-active-radius-stroke";
      cancelPulse();
      try {
        if (map.getLayer(STROKE)) map.removeLayer(STROKE);
        if (map.getLayer(FILL)) map.removeLayer(FILL);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* not yet */
      }
      if (!focusedLocation?.approxLatLng) return;
      const { lat, lng } = focusedLocation.approxLatLng;
      const dLat = 15 / 69;
      const dLng = 15 / (69 * Math.cos((lat * Math.PI) / 180));
      const ring: [number, number][] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * 2 * Math.PI;
        ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
      }
      map.addSource(SRC, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {},
        },
      });
      map.addLayer({
        id: FILL,
        type: "fill",
        source: SRC,
        paint: {
          "fill-color": "#0d3b6f",
          "fill-opacity": investigationActive ? 0.1 : 0.04,
        },
      });
      map.addLayer({
        id: STROKE,
        type: "line",
        source: SRC,
        paint: {
          "line-color": "#0d3b6f",
          "line-opacity": investigationActive ? 0.6 : 0.3,
          "line-width": investigationActive ? 1.6 : 1,
          "line-dasharray": investigationActive ? [1, 0] : [3, 3],
        },
      });
      if (!investigationActive) return;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;
      const start = performance.now();
      const tick = (ts: number) => {
        // 2.4s breathing cycle. sin returns [-1,1] → normalize to [0,1].
        const phase = ((ts - start) / 2400) * 2 * Math.PI;
        const k = (Math.sin(phase) + 1) / 2;
        try {
          map.setPaintProperty(FILL, "fill-opacity", 0.07 + k * 0.09); // 0.07–0.16
          map.setPaintProperty(STROKE, "line-opacity", 0.45 + k * 0.35); // 0.45–0.80
          map.setPaintProperty(STROKE, "line-width", 1.4 + k * 1.1);   // 1.4–2.5
        } catch {
          cancelPulse();
          return;
        }
        pulseFrame = requestAnimationFrame(tick);
      };
      pulseFrame = requestAnimationFrame(tick);
    };
    if (mapReadyRef.current) apply();
    else map.once("load", apply);
    return () => {
      cancelPulse();
    };
  }, [focusedLocation, investigationActive]);

  // ---- 4. Drought layer (USDM) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    let cancelled = false;
    const SRC = "dryline-usdm";
    const FILL = "dryline-usdm-fill";

    const cleanup = () => {
      try {
        if (map.getLayer(FILL)) map.removeLayer(FILL);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* idempotent */
      }
    };

    if (!layerState.drought) {
      cleanup();
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/layers/usdm", { cache: "force-cache" });
        if (cancelled || !res.ok) return;
        const fc = await res.json();
        if (cancelled) return;

        cleanup();
        if (map.getSource(SRC)) return;
        map.addSource(SRC, { type: "geojson", data: fc });
        map.addLayer({
          id: FILL,
          type: "fill",
          source: SRC,
          paint: {
            "fill-color": [
              "match",
              ["coalesce", ["get", "DM"], 0],
              0,
              DROUGHT_COLORS[0]!,
              1,
              DROUGHT_COLORS[1]!,
              2,
              DROUGHT_COLORS[2]!,
              3,
              DROUGHT_COLORS[3]!,
              4,
              DROUGHT_COLORS[4]!,
              DROUGHT_COLORS[0]!,
            ],
            // Opacity ramps with DM severity so D3/D4 read strongly
            // and D0/D1 stay quiet. Without this the polygons drown in
            // the cream basemap inside the TX mask hole.
            "fill-opacity": [
              "match",
              ["coalesce", ["get", "DM"], 0],
              0, 0.32,
              1, 0.42,
              2, 0.5,
              3, 0.6,
              4, 0.7,
              0.4,
            ],
            "fill-outline-color": "#7a5a2c",
          },
        });
        // Keep drought BELOW the outside-TX mask so the mask hides any
        // drought polygon that pokes past the state line. The mask
        // useEffect also re-positions data layers when *it* mounts —
        // both directions are needed because either layer can win the
        // network race.
        try {
          if (map.getLayer("dryline-outside-tx-mask-fill")) {
            map.moveLayer(FILL, "dryline-outside-tx-mask-fill");
          }
        } catch {
          /* layer ordering best-effort */
        }

        // Hover popup naming the DM level. The DM number alone is
        // unintelligible to first-time viewers — labeling it as
        // "Severe", "Extreme", etc. makes the layer self-explaining.
        const ml = await import("maplibre-gl");
        const popup = new ml.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 8,
          className: "dryline-drought-popup",
        });
        type MoveEvt = import("maplibre-gl").MapMouseEvent & {
          features?: import("maplibre-gl").MapGeoJSONFeature[];
        };
        const DM_LABELS = [
          "D0 · Abnormally dry",
          "D1 · Moderate drought",
          "D2 · Severe drought",
          "D3 · Extreme drought",
          "D4 · Exceptional drought",
        ];
        const onMove = (e: MoveEvt) => {
          const f = e.features?.[0];
          if (!f) return;
          const dm = (f.properties as { DM?: number } | null)?.DM ?? 0;
          const label = DM_LABELS[Math.max(0, Math.min(4, dm))] ?? DM_LABELS[0];
          const color = DROUGHT_COLORS[Math.max(0, Math.min(4, dm))] ?? DROUGHT_COLORS[0];
          map.getCanvas().style.cursor = "help";
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="padding:5px 9px;display:flex;align-items:center;gap:6px">
                <span style="width:9px;height:9px;display:inline-block;background:${color};border:1px solid rgba(7,23,31,0.25)"></span>
                <span style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#07171f">${label}</span>
              </div>`,
            )
            .addTo(map);
        };
        const onLeave = () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        };
        map.on("mousemove", FILL, onMove);
        map.on("mouseleave", FILL, onLeave);
        const handlers = { onMove, onLeave, popup };
        (map as MapInstance & { __droughtHandlers?: typeof handlers }).__droughtHandlers = handlers;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] drought layer failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      type MoveEvt = import("maplibre-gl").MapMouseEvent & {
        features?: import("maplibre-gl").MapGeoJSONFeature[];
      };
      const handlers = (
        map as MapInstance & {
          __droughtHandlers?: {
            onMove: (e: MoveEvt) => void;
            onLeave: () => void;
            popup: PopupInstance;
          };
        }
      ).__droughtHandlers;
      if (handlers) {
        try {
          map.off("mousemove", FILL, handlers.onMove);
          map.off("mouseleave", FILL, handlers.onLeave);
          handlers.popup.remove();
        } catch {
          /* idempotent */
        }
        delete (map as MapInstance & { __droughtHandlers?: unknown }).__droughtHandlers;
      }
      cleanup();
    };
  }, [layerState.drought, mapReadyState]);

  // ---- 4b. Reservoir SYMBOL LAYER (WebGL-rendered) ----
  //
  // Reservoirs are rendered as a MapLibre symbol layer so they project
  // through the same WebGL pipeline as the drought / rivers / aquifers
  // layers — no JS-frame lag during zoom animations, no DOM marker
  // drift, no rich-interactivity tax for 37 pins.
  //
  // - 6 raster icon variants (one per drought tier) registered on first
  //   mount via `map.addImage`. Idempotent — survives HMR.
  // - GeoJSON source rebuilt whenever the TWDB payload changes.
  // - Hover popup rebuilt from feature properties on the fly so it
  //   carries the rich sparkline + trend body.
  // - Click triggers the same investigation pipeline as a demo pin.
  const reservoirHandlersRef = useRef<{
    onClick?: (e: import("maplibre-gl").MapMouseEvent) => void;
    onEnter?: (e: import("maplibre-gl").MapMouseEvent) => void;
    onLeave?: () => void;
    popup?: PopupInstance;
  }>({});
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    const SRC = "dryline-reservoirs";
    const LAYER = "dryline-reservoirs-symbols";
    let cancelled = false;

    type ResEvt = import("maplibre-gl").MapMouseEvent & {
      features?: import("maplibre-gl").MapGeoJSONFeature[];
    };

    (async () => {
      const ml = await import("maplibre-gl");

      // 1. Register icons once.
      const tiers: ReservoirTier[] = ["nodata", "critical", "low", "below-avg", "moderate", "near-full"];
      for (const tier of tiers) {
        const name = `dryline-reservoir-${tier}`;
        if (map.hasImage(name)) continue;
        try {
          const img = await svgToImage(lakeIconSvg(tier));
          if (cancelled) return;
          if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
        } catch {
          /* icon load failed; layer will fall back to nodata */
        }
      }

      // 2. Build GeoJSON features from reservoirData. If empty, render
      //    nothing — the data-fetch effect will trigger us again.
      const features = Array.from(reservoirData.values())
        // Dedupe: the fetch effect indexes each reservoir under both
        // hyphen + underscore slug variants; Map.values() yields each
        // twice. Filter by canonical slug.
        .filter((r, i, arr) => arr.findIndex((x) => x.slug === r.slug) === i)
        .map((r) => {
          const tier = reservoirFill(r.pctFull, r.historicalAvg).tier;
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
            properties: {
              slug: r.slug,
              name: r.name,
              tier,
              pctFull: r.pctFull,
              historicalAvg: r.historicalAvg,
              trend7d: r.trend7d,
              series: JSON.stringify(r.series),
              lastUpdated: r.lastUpdated,
            },
          };
        });

      // 3. Add or update the source.
      const existing = map.getSource(SRC) as
        | (import("maplibre-gl").GeoJSONSource & { setData: (d: unknown) => void })
        | undefined;
      const fc = { type: "FeatureCollection" as const, features };
      if (existing) {
        existing.setData(fc);
      } else {
        map.addSource(SRC, { type: "geojson", data: fc });
      }

      // 4. Add the symbol layer (idempotent).
      if (!map.getLayer(LAYER)) {
        map.addLayer({
          id: LAYER,
          type: "symbol",
          source: SRC,
          layout: {
            "icon-image": [
              "match",
              ["get", "tier"],
              "critical", "dryline-reservoir-critical",
              "low", "dryline-reservoir-low",
              "below-avg", "dryline-reservoir-below-avg",
              "moderate", "dryline-reservoir-moderate",
              "near-full", "dryline-reservoir-near-full",
              "dryline-reservoir-nodata",
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "center",
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4, 0.7,
              7, 0.85,
              10, 1.0,
              13, 1.15,
            ],
          },
        });
      }

      // 5. Position below the outside-TX mask so reservoirs stay clipped
      //    to the state visually (consistent with the other data layers).
      try {
        if (map.getLayer("dryline-outside-tx-mask-fill")) {
          map.moveLayer(LAYER, "dryline-outside-tx-mask-fill");
        }
      } catch {
        /* idempotent */
      }

      // 6. Wire interactivity. Reuse one popup instance.
      const popup =
        reservoirHandlersRef.current.popup ??
        new ml.Popup({
          anchor: "bottom",
          offset: 18,
          closeButton: false,
          closeOnClick: false,
          className: "dryline-reservoir-popup",
        });

      const renderPopupHtml = (p: {
        slug?: string;
        name?: string;
        tier?: string;
        pctFull?: number | null;
        historicalAvg?: number | null;
        trend7d?: number | null;
        series?: string;
        lastUpdated?: string | null;
      }) => {
        const tier = (p.tier ?? "nodata") as ReservoirTier;
        const fillForTier: Record<ReservoirTier, { fill: string; label: string }> = {
          nodata: { fill: "#4a6c78", label: "no data" },
          critical: { fill: "#6f1d10", label: "critical" },
          low: { fill: "#a85a35", label: "low" },
          "below-avg": { fill: "#b58a52", label: "below avg" },
          moderate: { fill: "#4a8aa8", label: "moderate" },
          "near-full": { fill: "#0d3b6f", label: "near full" },
        };
        const colors = fillForTier[tier] ?? fillForTier.nodata;
        const pct = p.pctFull;
        const hist = p.historicalAvg ?? null;
        const t = p.trend7d ?? null;
        let series: Array<{ d: string; v: number }> = [];
        if (typeof p.series === "string" && p.series.length > 0) {
          try {
            series = JSON.parse(p.series);
          } catch {
            series = [];
          }
        }
        let body: string;
        if (typeof pct === "number") {
          const arrow = t == null ? "" : t > 0.3 ? "↗" : t < -0.3 ? "↘" : "→";
          const trendLabel =
            t == null
              ? ""
              : `<span style="color:${t > 0 ? "#0d3b6f" : t < 0 ? "#a85a35" : "#4a6c78"}">${arrow} ${t > 0 ? "+" : ""}${t.toFixed(1)} pts / 7d</span>`;
          const spark = sparklineSvg(series, hist, { w: 130, h: 28 });
          const histLine =
            hist != null
              ? `<div style="font-family:'Geist Mono',monospace;font-size:9.5px;color:#4a6c78;margin-top:2px">Hist. avg for today: ${hist.toFixed(1)}%</div>`
              : "";
          body = `
            <div style="display:flex;align-items:baseline;gap:8px">
              <div style="font-family:'Newsreader',serif;font-size:24px;color:${colors.fill};font-weight:600;line-height:1">${pct.toFixed(1)}<span style="font-size:14px;color:#4a6c78;font-weight:400">%</span></div>
              <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#4a6c78;padding-top:2px">${colors.label}</div>
            </div>
            ${histLine}
            <div style="margin-top:6px">${spark}</div>
            <div style="font-family:'Geist Mono',monospace;font-size:9.5px;color:#4a6c78;margin-top:4px;display:flex;justify-content:space-between;gap:6px"><span>${trendLabel}</span><span>${p.lastUpdated ?? ""}</span></div>
          `;
        } else {
          body = `<div style="font-family:'Geist Mono',monospace;font-size:9.5px;color:#4a6c78;margin-top:2px">No live readings published.</div>`;
        }
        return `<div style="padding:10px 12px;min-width:200px">
          <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Reservoir</div>
          <div style="font-family:'Newsreader',serif;font-size:15px;color:#07171f;margin-top:2px;line-height:1.2">${p.name ?? "—"}</div>
          ${body}
          <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:8px;border-top:1px solid #c8d6da;padding-top:6px">Click to investigate ↗</div>
        </div>`;
      };

      const onEnter = (e: ResEvt) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
        const p = f.properties as Parameters<typeof renderPopupHtml>[0];
        map.getCanvas().style.cursor = "pointer";
        popup.setLngLat(coords).setHTML(renderPopupHtml(p)).addTo(map);
      };
      const onLeave = () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      };
      const onClick = (e: ResEvt) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
        const p = f.properties as { slug?: string; name?: string };
        if (!p.name) return;
        const synth: MapLocation = {
          id: `reservoir:${p.slug}`,
          label: p.name,
          city: p.name.replace(/\b(Lake|Reservoir)\b/gi, "").trim(),
          county: "",
          region: "TX reservoir",
          mode: "transparency",
          headlineStory: `Investigation centered on ${p.name}.`,
          approxLatLng: { lat: coords[1], lng: coords[0] },
          live: true,
        };
        onLocationClickRef.current?.(synth);
      };

      // Detach prior handlers (HMR) before reattaching.
      const prev = reservoirHandlersRef.current;
      if (prev.onClick) map.off("click", LAYER, prev.onClick);
      if (prev.onEnter) map.off("mouseenter", LAYER, prev.onEnter);
      if (prev.onLeave) map.off("mouseleave", LAYER, prev.onLeave);

      map.on("click", LAYER, onClick);
      map.on("mouseenter", LAYER, onEnter);
      map.on("mouseleave", LAYER, onLeave);
      reservoirHandlersRef.current = { onClick, onEnter, onLeave, popup };
    })();

    return () => {
      cancelled = true;
    };
  }, [reservoirData, mapReadyState]);

  // ---- 5. Reservoir visibility toggle (symbol layer) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    try {
      if (map.getLayer("dryline-reservoirs-symbols")) {
        map.setLayoutProperty(
          "dryline-reservoirs-symbols",
          "visibility",
          layerState.reservoirs ? "visible" : "none",
        );
      }
    } catch {
      /* layer not mounted yet — the symbol-layer effect will sync on next render */
    }
  }, [layerState.reservoirs, mapReadyState]);

  // ---- 5-bis. Sample-address visibility toggle (symbol layer) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    try {
      if (map.getLayer("dryline-demo-pins-symbols")) {
        map.setLayoutProperty(
          "dryline-demo-pins-symbols",
          "visibility",
          layerState.samples ? "visible" : "none",
        );
      }
    } catch {
      /* layer not mounted yet */
    }
  }, [layerState.samples, mapReadyState]);

  // ---- 5a. Texas state outline + outside-TX soft mask.
  //
  // We render two things from the same source data:
  //   1. An outside-TX fill that dims everything beyond the state line
  //      so when the user zooms out the data overlays visually stay
  //      anchored to Texas instead of sprawling across the continent.
  //   2. A dashed state outline (with a soft glow underlayer) so the
  //      border itself reads as deliberate cartography, not a hard
  //      edge of the data clip.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    let cancelled = false;
    const SRC = "dryline-tx-bounds";
    const MASK_SRC = "dryline-outside-tx-mask";
    const LINE = "dryline-tx-bounds-line";
    const GLOW = "dryline-tx-bounds-glow";
    const MASK = "dryline-outside-tx-mask-fill";

    const cleanup = () => {
      try {
        if (map.getLayer(LINE)) map.removeLayer(LINE);
        if (map.getLayer(GLOW)) map.removeLayer(GLOW);
        if (map.getLayer(MASK)) map.removeLayer(MASK);
        if (map.getSource(SRC)) map.removeSource(SRC);
        if (map.getSource(MASK_SRC)) map.removeSource(MASK_SRC);
      } catch {
        /* idempotent */
      }
    };

    (async () => {
      try {
        const res = await fetch("/tx-bounds-precise.geojson", { cache: "force-cache" });
        if (cancelled || !res.ok) return;
        const fc = (await res.json()) as {
          type: "FeatureCollection";
          features: Array<{
            type: "Feature";
            properties: Record<string, unknown>;
            geometry:
              | { type: "Polygon"; coordinates: number[][][] }
              | { type: "MultiPolygon"; coordinates: number[][][][] };
          }>;
        };
        if (cancelled) return;
        const first = fc.features[0];
        if (!first) return;
        // Collect each polygon's outer ring (any holes are intentionally
        // ignored — TX has none anyway). Used both as holes in the
        // outside-TX mask polygon and as the source for the outline.
        const txOuterRings: number[][][] =
          first.geometry.type === "Polygon"
            ? [first.geometry.coordinates[0]!]
            : first.geometry.coordinates.map((p) => p[0]!);
        // World polygon (lng/lat). MapLibre projects this via Web
        // Mercator and clamps lat near the poles; the slightly
        // shrunken band keeps us out of singularities.
        const worldOuter: number[][] = [
          [-180, -85],
          [180, -85],
          [180, 85],
          [-180, 85],
          [-180, -85],
        ];
        const maskGeometry = {
          type: "Polygon" as const,
          // First ring = exterior, subsequent rings = holes. Each TX
          // outer ring becomes a hole, so the fill stops at the TX
          // border on every side.
          coordinates: [worldOuter, ...txOuterRings],
        };

        cleanup();
        if (map.getSource(SRC) || map.getSource(MASK_SRC)) return;

        // Mask first (will sit below the outline strokes).
        map.addSource(MASK_SRC, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: maskGeometry,
            properties: {},
          },
        });
        map.addLayer({
          id: MASK,
          type: "fill",
          source: MASK_SRC,
          paint: {
            "fill-color": dark ? "#040810" : "#ece5d8",
            "fill-opacity": dark ? 0.78 : 0.65,
            "fill-antialias": true,
          },
        });

        // Outline (precise boundary).
        map.addSource(SRC, { type: "geojson", data: fc });
        map.addLayer({
          id: GLOW,
          type: "line",
          source: SRC,
          paint: {
            "line-color": dark ? "#5fc7ff" : "#0d3b6f",
            "line-opacity": dark ? 0.45 : 0.22,
            "line-width": dark ? 8 : 6,
            "line-blur": dark ? 4 : 2,
          },
        });
        map.addLayer({
          id: LINE,
          type: "line",
          source: SRC,
          paint: {
            "line-color": dark ? "#9ec5cf" : "#0d3b6f",
            "line-opacity": dark ? 0.95 : 0.78,
            "line-width": dark ? 1.6 : 1.4,
            "line-dasharray": [4, 2],
          },
        });
        // If any data layers (drought, rivers, gauges, aquifers) were
        // added BEFORE the mask finished loading, they ended up above
        // the mask in the stack — which means they're visible outside
        // Texas. Pull each one below the mask now.
        const dataLayerIds = [
          "dryline-usdm-fill",
          "dryline-rivers-line-glow",
          "dryline-rivers-line",
          "dryline-rivers-line-flow",
          "dryline-gauges-circles",
          "dryline-aquifers-fill",
          "dryline-aquifers-line",
        ];
        for (const layerId of dataLayerIds) {
          try {
            if (map.getLayer(layerId)) map.moveLayer(layerId, MASK);
          } catch {
            /* idempotent */
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] TX bounds + mask layer failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mapReadyState, dark]);

  // ---- 5b. Rivers layer (static GeoJSON) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    let cancelled = false;
    const SRC = "dryline-rivers";
    const LINE = "dryline-rivers-line";
    const cleanup = () => {
      try {
        if (map.getLayer(LINE)) map.removeLayer(LINE);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* idempotent */
      }
    };
    if (!layerState.rivers) {
      cleanup();
      return;
    }
    (async () => {
      try {
        const res = await fetch("/tx-rivers.geojson", { cache: "force-cache" });
        if (cancelled || !res.ok) return;
        const fc = await res.json();
        if (cancelled) return;
        cleanup();
        if (map.getSource(SRC)) return;
        map.addSource(SRC, { type: "geojson", data: fc });
        // Wide soft glow underlayer — gives the rivers a "lit aquifer"
        // feel in dark mode; subtle paper halo in light mode so the
        // strokes read against the basemap at low zoom.
        map.addLayer({
          id: `${LINE}-glow`,
          type: "line",
          source: SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": dark ? "#7ad6e9" : "#cfe1e7",
            "line-opacity": dark ? 0.55 : 0.5,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              dark ? 4.5 : 3,
              8,
              dark ? 9 : 6,
              11,
              dark ? 14 : 9,
            ],
            "line-blur": dark ? 4 : 2.5,
          },
        });
        // Crisp center stroke. Width scales with zoom so the rivers
        // stay visible at the state-level fit and grow into proper
        // ribbons when you zoom into a watershed.
        map.addLayer({
          id: LINE,
          type: "line",
          source: SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": dark ? "#bfe5ee" : "#0d3b6f",
            "line-opacity": dark ? 0.98 : 0.78,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              dark ? 1.4 : 1.1,
              8,
              dark ? 2.6 : 2,
              11,
              dark ? 4.5 : 3.4,
            ],
          },
        });
        // Flow overlay: a thin, sparse, light-toned dash drawn ON TOP
        // of the solid river stroke. We animate `line-dasharray` in
        // small steps so the dashes drift downstream — gives the
        // rivers a faint sense of motion without breaking the solid
        // line look. Skip if the user prefers reduced motion.
        const reduceMotion =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        map.addLayer({
          id: `${LINE}-flow`,
          type: "line",
          source: SRC,
          layout: { "line-cap": "butt", "line-join": "round" },
          paint: {
            "line-color": dark ? "#e8fbff" : "#cfe1e7",
            "line-opacity": dark ? 0.65 : 0.55,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              0.6,
              8,
              1.2,
              11,
              2,
            ],
            "line-dasharray": [0, 4, 3],
          },
        });
        // Pull rivers below the outside-TX mask so they don't extend
        // visibly past the state line. Best-effort if the mask layer
        // hasn't mounted yet — the bounds useEffect will re-order then.
        try {
          if (map.getLayer("dryline-outside-tx-mask-fill")) {
            map.moveLayer(`${LINE}-glow`, "dryline-outside-tx-mask-fill");
            map.moveLayer(LINE, "dryline-outside-tx-mask-fill");
            map.moveLayer(`${LINE}-flow`, "dryline-outside-tx-mask-fill");
          }
        } catch {
          /* idempotent */
        }
        let flowFrame: number | null = null;
        if (!reduceMotion) {
          // Build a 7-step sequence: a 7-length dash window with a
          // single dash sliding through it. The 7th frame loops back
          // to the 0th so the cycle is seamless.
          const seq: number[][] = [
            [0, 4, 3],
            [0.5, 4, 2.5],
            [1, 4, 2],
            [1.5, 4, 1.5],
            [2, 4, 1],
            [2.5, 4, 0.5],
            [3, 4, 0],
          ];
          let lastStep = -1;
          let lastTs = performance.now();
          const tick = (ts: number) => {
            // Step every ~110ms — slow enough to read as drift, not
            // jitter. Wall-clock so it's smooth across throttled tabs.
            if (ts - lastTs > 110) {
              const step = (lastStep + 1) % seq.length;
              try {
                map.setPaintProperty(`${LINE}-flow`, "line-dasharray", seq[step]!);
              } catch {
                /* layer removed mid-frame; cleanup will cancel us */
              }
              lastStep = step;
              lastTs = ts;
            }
            flowFrame = requestAnimationFrame(tick);
          };
          flowFrame = requestAnimationFrame(tick);
        }
        // Hover-only river name label. We attach a popup via the line
        // hit target rather than full symbol layer (no font glyph
        // dependency on raster basemap).
        const ml = await import("maplibre-gl");
        const popup = new ml.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 8,
          className: "dryline-river-popup",
        });
        type MoveEvt = import("maplibre-gl").MapMouseEvent & {
          features?: import("maplibre-gl").MapGeoJSONFeature[];
        };
        const onMove = (e: MoveEvt) => {
          const f = e.features?.[0];
          if (!f) return;
          const name =
            (f.properties as { name?: string; NAME?: string } | null)?.name ??
            (f.properties as { name?: string; NAME?: string } | null)?.NAME ??
            "River";
          map.getCanvas().style.cursor = "pointer";
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="padding:5px 9px;font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f">${name}</div>`,
            )
            .addTo(map);
        };
        const onLeave = () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        };
        map.on("mousemove", LINE, onMove);
        map.on("mouseleave", LINE, onLeave);
        // Stash the handlers + flow frame id on the map instance so
        // cleanup can detach them on layer toggle / dark mode flip.
        const handlers = { onMove, onLeave, popup, flowFrame };
        (map as MapInstance & { __riverHandlers?: typeof handlers }).__riverHandlers = handlers;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] rivers layer failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      type MoveEvt = import("maplibre-gl").MapMouseEvent & {
        features?: import("maplibre-gl").MapGeoJSONFeature[];
      };
      const handlers = (
        map as MapInstance & {
          __riverHandlers?: {
            onMove: (e: MoveEvt) => void;
            onLeave: () => void;
            popup: PopupInstance;
            flowFrame: number | null;
          };
        }
      ).__riverHandlers;
      if (handlers) {
        try {
          map.off("mousemove", LINE, handlers.onMove);
          map.off("mouseleave", LINE, handlers.onLeave);
          handlers.popup.remove();
          if (handlers.flowFrame != null) cancelAnimationFrame(handlers.flowFrame);
        } catch {
          /* idempotent */
        }
        delete (
          map as MapInstance & {
            __riverHandlers?: unknown;
          }
        ).__riverHandlers;
      }
      cleanup();
      try {
        if (map.getLayer(`${LINE}-flow`)) map.removeLayer(`${LINE}-flow`);
        if (map.getLayer(`${LINE}-glow`)) map.removeLayer(`${LINE}-glow`);
      } catch {
        /* idempotent */
      }
    };
  }, [layerState.rivers, mapReadyState, dark]);

  // ---- 5c. USGS gauges layer (live data) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    let cancelled = false;
    const SRC = "dryline-gauges";
    const CIRCLES = "dryline-gauges-circles";
    const CENTER = "dryline-gauges-center";
    const cleanup = () => {
      try {
        if (map.getLayer(CENTER)) map.removeLayer(CENTER);
        if (map.getLayer(CIRCLES)) map.removeLayer(CIRCLES);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* idempotent */
      }
    };
    if (!layerState.gauges) {
      cleanup();
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/layers/usgs-gauges", { cache: "force-cache" });
        if (cancelled || !res.ok) return;
        const payload = (await res.json()) as {
          gauges?: Array<{
            siteCode: string;
            siteName: string;
            lat: number;
            lng: number;
            currentCfs: number | null;
            latestReadingAt: string | null;
          }>;
        };
        const gauges = payload.gauges ?? [];
        if (cancelled || gauges.length === 0) return;
        const features = gauges.map((g) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] },
          properties: {
            siteCode: g.siteCode,
            siteName: g.siteName,
            cfs: g.currentCfs,
            ts: g.latestReadingAt,
          },
        }));
        cleanup();
        if (map.getSource(SRC)) return;
        map.addSource(SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
        // Outer ring: thicker stroke, no fill — reads as a "site marker"
        // ring rather than a generic colored dot.
        map.addLayer({
          id: CIRCLES,
          type: "circle",
          source: SRC,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              dark ? 4 : 3.2,
              8,
              dark ? 5.5 : 4.5,
              10,
              dark ? 7 : 6,
            ],
            // Color by current cfs (step expression on a coalesced number):
            //   < 0.5 cfs (no reading or dry) → muted gray
            //   0.5–49 cfs                    → ochre (low flow)
            //   50–499 cfs                    → river (normal)
            //   ≥ 500 cfs                     → aquifer (high)
            "circle-color": dark ? "#0a0e16" : "#eef2f3",
            "circle-stroke-color": [
              "step",
              ["coalesce", ["to-number", ["get", "cfs"]], -1],
              dark ? "#3a4d56" : "#4a6c78",
              0.5,
              dark ? "#d6a06a" : "#b58a52",
              50,
              dark ? "#7ad6e9" : "#4a8aa8",
              500,
              dark ? "#5fc7ff" : "#0d3b6f",
            ],
            "circle-stroke-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              dark ? 1.6 : 1.4,
              10,
              dark ? 2.2 : 1.8,
            ],
            "circle-opacity": dark ? 0.95 : 1,
          },
        });
        // Center dot: small filled circle in the same cfs color, drawn on
        // top of the hollow ring. Together they read as a target /
        // measurement-station icon (◎) rather than a generic point.
        map.addLayer({
          id: CENTER,
          type: "circle",
          source: SRC,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              dark ? 1.2 : 1,
              10,
              dark ? 2.4 : 2,
            ],
            "circle-color": [
              "step",
              ["coalesce", ["to-number", ["get", "cfs"]], -1],
              dark ? "#3a4d56" : "#4a6c78",
              0.5,
              dark ? "#d6a06a" : "#b58a52",
              50,
              dark ? "#7ad6e9" : "#4a8aa8",
              500,
              dark ? "#5fc7ff" : "#0d3b6f",
            ],
            "circle-opacity": 1,
          },
        });
        // Pull gauge layers below the outside-TX mask.
        try {
          if (map.getLayer("dryline-outside-tx-mask-fill")) {
            map.moveLayer(CIRCLES, "dryline-outside-tx-mask-fill");
            map.moveLayer(CENTER, "dryline-outside-tx-mask-fill");
          }
        } catch {
          /* idempotent */
        }

        // Click → popup with site name + current cfs + relative time.
        const ml = await import("maplibre-gl");
        const popup = new ml.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 10,
          className: "dryline-gauge-popup",
        });
        type ClickEvt = import("maplibre-gl").MapMouseEvent & {
          features?: import("maplibre-gl").MapGeoJSONFeature[];
        };
        const escape = (s: string) =>
          s.replace(/[&<>"']/g, (c) =>
            c === "&"
              ? "&amp;"
              : c === "<"
              ? "&lt;"
              : c === ">"
              ? "&gt;"
              : c === '"'
              ? "&quot;"
              : "&#39;",
          );
        const relativeTime = (iso: string | null): string => {
          if (!iso) return "no recent reading";
          const t = Date.parse(iso);
          if (!Number.isFinite(t)) return "unknown";
          const mins = Math.round((Date.now() - t) / 60000);
          if (mins < 1) return "just now";
          if (mins < 60) return `${mins} min ago`;
          const hrs = Math.round(mins / 60);
          if (hrs < 24) return `${hrs} hr ago`;
          const days = Math.round(hrs / 24);
          return `${days} d ago`;
        };
        const onClick = (e: ClickEvt) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as {
            siteName?: string;
            siteCode?: string;
            cfs?: number | null;
            ts?: string | null;
          };
          // Treat the click as an investigation trigger on the gauge's
          // location. The popup still appears briefly via map.on('click')
          // but the right-panel investigation is the primary action.
          const lat = (e.lngLat as { lat?: number }).lat;
          const lng = (e.lngLat as { lng?: number }).lng;
          if (typeof lat === "number" && typeof lng === "number" && p.siteName) {
            const synth: MapLocation = {
              id: `gauge:${p.siteCode ?? `${lat},${lng}`}`,
              label: p.siteName,
              city: p.siteName.replace(/[,].*$/, "").trim(),
              county: "",
              region: `USGS gauge ${p.siteCode ?? ""}`.trim(),
              mode: "personal",
              headlineStory:
                p.cfs != null
                  ? `Investigation centered on USGS gauge ${p.siteCode}: ${p.cfs.toLocaleString()} cfs currently.`
                  : `Investigation centered on USGS gauge ${p.siteCode}.`,
              approxLatLng: { lat, lng },
              live: true,
            };
            onLocationClickRef.current?.(synth);
          }
          const cfsText =
            p.cfs == null
              ? "<span style=\"color:#b13a1f\">no current reading</span>"
              : `<span style=\"font-family:'Geist Mono',monospace;font-size:14px;color:#0d3b6f\">${p.cfs.toLocaleString()} cfs</span>`;
          const html = `<div style="padding:8px 12px;max-width:240px">
            <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">USGS gauge · ${escape(p.siteCode ?? "—")}</div>
            <div style="font-family:'Newsreader',serif;font-size:13.5px;color:#07171f;line-height:1.25;margin-top:3px">${escape(p.siteName ?? "Unknown site")}</div>
            <div style="margin-top:6px">${cfsText}</div>
            <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.12em;color:#4a6c78;margin-top:4px">${escape(relativeTime(p.ts ?? null))}</div>
            <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:6px;border-top:1px solid #c8d6da;padding-top:4px">Investigating ↗</div>
          </div>`;
          popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        };
        const onEnter = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        const onLeaveCircles = () => {
          map.getCanvas().style.cursor = "";
        };
        map.on("click", CIRCLES, onClick);
        map.on("mouseenter", CIRCLES, onEnter);
        map.on("mouseleave", CIRCLES, onLeaveCircles);
        const handlers = { onClick, onEnter, onLeaveCircles, popup };
        (map as MapInstance & { __gaugeHandlers?: typeof handlers }).__gaugeHandlers = handlers;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] gauges layer failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      type ClickEvt = import("maplibre-gl").MapMouseEvent & {
        features?: import("maplibre-gl").MapGeoJSONFeature[];
      };
      const handlers = (
        map as MapInstance & {
          __gaugeHandlers?: {
            onClick: (e: ClickEvt) => void;
            onEnter: () => void;
            onLeaveCircles: () => void;
            popup: PopupInstance;
          };
        }
      ).__gaugeHandlers;
      if (handlers) {
        try {
          map.off("click", CIRCLES, handlers.onClick);
          map.off("mouseenter", CIRCLES, handlers.onEnter);
          map.off("mouseleave", CIRCLES, handlers.onLeaveCircles);
          handlers.popup.remove();
        } catch {
          /* idempotent */
        }
        delete (
          map as MapInstance & {
            __gaugeHandlers?: unknown;
          }
        ).__gaugeHandlers;
      }
      cleanup();
    };
  }, [layerState.gauges, mapReadyState, dark]);

  // ---- 5d. Aquifer regions (TWDB major aquifers, static GeoJSON) ----
  // Rendered with a low-opacity fill and a dotted outline. Color
  // family is earth-toned so the layer reads as "land underneath"
  // rather than competing with the blue water layers above.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    let cancelled = false;
    const SRC = "dryline-aquifers";
    const FILL = "dryline-aquifers-fill";
    const LINE = "dryline-aquifers-line";
    const cleanup = () => {
      try {
        if (map.getLayer(LINE)) map.removeLayer(LINE);
        if (map.getLayer(FILL)) map.removeLayer(FILL);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* idempotent */
      }
    };
    if (!layerState.aquifers) {
      cleanup();
      return;
    }
    (async () => {
      try {
        const res = await fetch("/tx-aquifers.geojson", { cache: "force-cache" });
        if (cancelled || !res.ok) return;
        const fc = await res.json();
        if (cancelled) return;
        cleanup();
        if (map.getSource(SRC)) return;
        map.addSource(SRC, { type: "geojson", data: fc });
        // match expression: map each AQ_NAME to its color.
        const matchPairs: (string | number)[] = [];
        for (const [name, color] of Object.entries(AQUIFER_COLORS)) {
          matchPairs.push(name, color);
        }
        map.addLayer({
          id: FILL,
          type: "fill",
          source: SRC,
          paint: {
            "fill-color": [
              "match",
              ["get", "AQ_NAME"],
              ...matchPairs,
              "#9a8a6e",
            ] as unknown as string,
            "fill-opacity": dark ? 0.22 : 0.18,
            "fill-antialias": true,
          },
        });
        map.addLayer({
          id: LINE,
          type: "line",
          source: SRC,
          paint: {
            "line-color": [
              "match",
              ["get", "AQ_NAME"],
              ...matchPairs,
              "#9a8a6e",
            ] as unknown as string,
            "line-opacity": dark ? 0.7 : 0.55,
            "line-width": 0.9,
            "line-dasharray": [2, 2],
          },
        });
        // Pull aquifer fill + line below the outside-TX mask.
        try {
          if (map.getLayer("dryline-outside-tx-mask-fill")) {
            map.moveLayer(FILL, "dryline-outside-tx-mask-fill");
            map.moveLayer(LINE, "dryline-outside-tx-mask-fill");
          }
        } catch {
          /* idempotent */
        }

        // Hover popup naming the aquifer.
        const ml = await import("maplibre-gl");
        const popup = new ml.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 8,
          className: "dryline-aquifer-popup",
        });
        type MoveEvt = import("maplibre-gl").MapMouseEvent & {
          features?: import("maplibre-gl").MapGeoJSONFeature[];
        };
        const escape = (s: string) =>
          s.replace(/[&<>"']/g, (c) =>
            c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
          );
        const onMove = (e: MoveEvt) => {
          const f = e.features?.[0];
          if (!f) return;
          const raw = (f.properties as { AQ_NAME?: string } | null)?.AQ_NAME ?? "Aquifer";
          const label = AQUIFER_LABELS[raw] ?? raw;
          const color = AQUIFER_COLORS[raw] ?? "#9a8a6e";
          const fact = AQUIFER_FACTS[raw];
          const factBody = fact
            ? `<div style="margin-top:6px;border-top:1px solid #c8d6da;padding-top:6px">
                <div style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#4a6c78">Extent</div>
                <div style="font-family:'Newsreader',serif;font-size:12.5px;color:#07171f;line-height:1.25;margin-top:1px">${escape(fact.extent)}</div>
                <div style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#4a6c78;margin-top:6px">Status</div>
                <div style="font-family:'Newsreader',serif;font-size:12.5px;color:${color};font-weight:500;line-height:1.25;margin-top:1px">${escape(fact.status)}</div>
                <div style="font-family:'Newsreader',serif;font-style:italic;font-size:12px;color:#4a6c78;line-height:1.4;margin-top:6px">${escape(fact.story)}</div>
              </div>`
            : "";
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="padding:8px 11px;max-width:260px">
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="width:10px;height:10px;display:inline-block;background:${color};border:1px solid rgba(7,23,31,0.25)"></span>
                  <span style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Aquifer</span>
                </div>
                <div style="font-family:'Newsreader',serif;font-size:14.5px;color:#07171f;margin-top:2px;line-height:1.2">${escape(label)}</div>
                ${factBody}
              </div>`,
            )
            .addTo(map);
        };
        const onLeave = () => popup.remove();
        map.on("mousemove", FILL, onMove);
        map.on("mouseleave", FILL, onLeave);
        const handlers = { onMove, onLeave, popup };
        (map as MapInstance & { __aquiferHandlers?: typeof handlers }).__aquiferHandlers = handlers;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] aquifer layer failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      type MoveEvt = import("maplibre-gl").MapMouseEvent & {
        features?: import("maplibre-gl").MapGeoJSONFeature[];
      };
      const handlers = (
        map as MapInstance & {
          __aquiferHandlers?: {
            onMove: (e: MoveEvt) => void;
            onLeave: () => void;
            popup: PopupInstance;
          };
        }
      ).__aquiferHandlers;
      if (handlers) {
        try {
          map.off("mousemove", FILL, handlers.onMove);
          map.off("mouseleave", FILL, handlers.onLeave);
          handlers.popup.remove();
        } catch {
          /* idempotent */
        }
        delete (map as MapInstance & { __aquiferHandlers?: unknown }).__aquiferHandlers;
      }
      cleanup();
    };
  }, [layerState.aquifers, mapReadyState, dark]);

  // ---- 6. Storytelling: react to tool_result events ----
  //
  // The previous version pulsed individual reservoir DOM markers when
  // the get_reservoirs tool fired. The reservoir layer is now WebGL-
  // rendered (symbol layer), so there are no DOM nodes to animate per
  // pin. The map's active-investigation radius disk (effect #3 below)
  // already provides "thinking" feedback; per-feature pulses would
  // require an additional animated circle layer and aren't worth it.
  useEffect(() => {
    /* no-op for now — see comment */
  }, [traces]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-foam">
      <div ref={containerRef} className="dryline-map absolute inset-0" />

      <MapLegend dark={dark} />


      <LayerControl
        specs={LAYER_SPECS}
        state={layerState}
        onToggle={toggleLayer}
        dark={dark}
        className="pointer-events-auto absolute right-4 bottom-4 w-[230px]"
      />

      {mountError ? (
        <div className="absolute inset-x-6 bottom-6 border border-rust bg-paper-warm px-4 py-3 text-xs text-ink shadow-paper">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-rust mb-1">
            Map failed to mount
          </div>
          <div className="font-mono">{mountError}</div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Collapsible map legend (bottom-left). Mirrors the Layers panel pattern:
 * a single header bar that toggles the body open/closed, with localStorage
 * persistence so it stays where you left it. Internally three sections:
 * Pins (what shapes mean), Drought ramp, Stream gauges by cfs.
 */
function MapLegend({ dark }: { dark: boolean }) {
  const LS_KEY = "dryline.legend-open.v1";
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === "0") setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);
  const onToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-4 bottom-4 w-[240px]",
        "border backdrop-blur-sm shadow-paper",
        dark
          ? "border-aquifer/50 bg-[rgba(8,14,22,0.85)] text-spring"
          : "border-rule bg-paper-deep/95 text-ink",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2",
          "font-mono text-[10px] tracking-[0.18em] uppercase",
          dark ? "text-spring hover:text-paper" : "text-tideline hover:text-ink",
        )}
        aria-expanded={open}
      >
        <span>Legend</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className={cn("border-t px-3 py-2.5 space-y-3", dark ? "border-aquifer/40" : "border-rule")}>
          {/* Section 1: Pins — what each shape means. Most important to surface first. */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1.5",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              What's on the map
            </div>
            <ul className="space-y-1.5 text-[11px] leading-snug">
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 18, height: 22 }}
                  dangerouslySetInnerHTML={{ __html: teardropPinHtml("#0d3b6f", "#9ec5cf") }}
                />
                <span className={dark ? "text-spring/90" : "text-ink/90"}>
                  <span className="font-serif">Sample address</span>
                  <span className={cn("block font-mono text-[9.5px] tracking-[0.04em]", dark ? "text-spring/60" : "text-tideline")}>
                    Click to investigate
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 22, height: 16 }}
                  dangerouslySetInnerHTML={{ __html: lakeGlyphHtml("#0d3b6f", "#061f3d") }}
                />
                <span className={dark ? "text-spring/90" : "text-ink/90"}>
                  <span className="font-serif">Reservoir</span>
                  <span className={cn("block font-mono text-[9.5px] tracking-[0.04em]", dark ? "text-spring/60" : "text-tideline")}>
                    Color = drought (full → critical)
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="relative inline-block shrink-0"
                  style={{ width: 14, height: 14, marginTop: 4 }}
                >
                  <span
                    className="absolute inset-0 rounded-full border-[1.6px]"
                    style={{
                      background: dark ? "#0a0e16" : "#eef2f3",
                      borderColor: "#4a8aa8",
                    }}
                  />
                  <span
                    className="absolute rounded-full"
                    style={{ width: 4, height: 4, background: "#4a8aa8", top: 5, left: 5 }}
                  />
                </span>
                <span className={dark ? "text-spring/90" : "text-ink/90"}>
                  <span className="font-serif">USGS stream gauge</span>
                  <span className={cn("block font-mono text-[9.5px] tracking-[0.04em]", dark ? "text-spring/60" : "text-tideline")}>
                    Color = current flow
                  </span>
                </span>
              </li>
            </ul>
          </div>

          {/* Section 2: Drought ramp */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              Drought severity (USDM)
            </div>
            <div className="flex h-2.5 border" style={{ borderColor: dark ? "rgba(158,197,207,0.3)" : "rgba(7,23,31,0.15)" }}>
              {DROUGHT_COLORS.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className={cn(
              "flex justify-between font-mono text-[8.5px] tracking-[0.04em] mt-0.5",
              dark ? "text-spring/60" : "text-tideline",
            )}>
              <span>Abnormal</span>
              <span>Exceptional</span>
            </div>
          </div>

          {/* Section 3: Gauge flow stops */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              Stream flow (cfs)
            </div>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
              <li className="flex items-center gap-1.5">
                <Swatch color={dark ? "#3a4d56" : "#4a6c78"} />
                <span className={dark ? "text-spring/80" : "text-ink/85"}>Dry · &lt; 0.5</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Swatch color={dark ? "#d6a06a" : "#b58a52"} />
                <span className={dark ? "text-spring/80" : "text-ink/85"}>Low · &lt; 50</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Swatch color={dark ? "#7ad6e9" : "#4a8aa8"} />
                <span className={dark ? "text-spring/80" : "text-ink/85"}>Normal · &lt; 500</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Swatch color={dark ? "#5fc7ff" : "#0d3b6f"} />
                <span className={dark ? "text-spring/80" : "text-ink/85"}>High · 500+</span>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
