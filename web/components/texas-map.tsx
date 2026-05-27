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
type MarkerInstance = import("maplibre-gl").Marker;
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
 */
function reservoirFill(pct: number | null, hist: number | null): {
  fill: string;
  stroke: string;
  label: string;
} {
  if (pct == null) return { fill: "#9ec5cf", stroke: "#4a6c78", label: "no data" };
  if (pct < 30) return { fill: "#6f1d10", stroke: "#3a0d05", label: "critical" };
  if (pct < 50) return { fill: "#a85a35", stroke: "#7a3d21", label: "low" };
  if (hist != null && pct < hist - 10) return { fill: "#b58a52", stroke: "#7a5a2c", label: "below avg" };
  if (pct < 75) return { fill: "#4a8aa8", stroke: "#2566a8", label: "moderate" };
  return { fill: "#0d3b6f", stroke: "#061f3d", label: "near full" };
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

/** Teardrop map-pin glyph for demo addresses. Color = mode/live. */
function teardropPinHtml(fill: string, ring: string): string {
  return `<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
    <path d="M 9 1.5 C 4.5 1.5 1.5 4.8 1.5 9 C 1.5 14.5 9 20.5 9 20.5 C 9 20.5 16.5 14.5 16.5 9 C 16.5 4.8 13.5 1.5 9 1.5 Z" fill="${fill}" stroke="${ring}" stroke-width="1.4"/>
    <circle cx="9" cy="9" r="2.6" fill="#eef2f3"/>
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
  { key: "samples", label: "Sample addresses", swatch: "#0d3b6f", hint: "The seven curated demo addresses (Wimberley, Taylor/Samsung, Fort Stockton, Houston, Lubbock, El Paso, San Antonio)." },
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
  const markersRef = useRef<
    Array<{
      slug: string;
      marker: MarkerInstance;
      popup: PopupInstance;
      dot: HTMLDivElement;
      pings: HTMLDivElement[];
    }>
  >([]);
  const reservoirMarkersRef = useRef<
    Array<{
      slug: string;
      marker: MarkerInstance;
      popup: PopupInstance;
      element: HTMLDivElement;
      lat: number;
      lng: number;
      name: string;
    }>
  >([]);
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

          // Reservoirs — lake-pebble glyph, colored later by live %-full
          // status, click triggers a full investigation centered on the
          // reservoir. We render with neutral colors here and refresh
          // glyph + tooltip in a second useEffect once TWDB data arrives.
          for (const r of RESERVOIR_PINS) {
            const wrap = document.createElement("button");
            wrap.type = "button";
            wrap.setAttribute("aria-label", `${r.name} — reservoir`);
            wrap.style.cssText =
              "background:transparent;border:none;cursor:pointer;padding:0;position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:18px;";
            const glyph = document.createElement("div");
            glyph.style.cssText =
              "width:22px;height:14px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 0 rgba(7,23,31,0.25));transition:transform 200ms ease;";
            const initial = reservoirFill(null, null);
            glyph.innerHTML = lakeGlyphHtml(initial.fill, initial.stroke);
            wrap.appendChild(glyph);
            const popup = new maplibregl.Popup({
              anchor: "bottom",
              offset: 14,
              closeButton: false,
              closeOnClick: false,
              className: "dryline-reservoir-popup",
            }).setHTML(
              `<div style="padding:6px 10px"><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Reservoir</div><div style="font-family:'Newsreader',serif;font-size:14px;color:#07171f;margin-top:2px">${r.name}</div><div style="font-family:'Geist Mono',monospace;font-size:9.5px;color:#4a6c78;margin-top:4px">Loading live data…</div></div>`,
            );
            const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
              .setLngLat([r.lng, r.lat])
              .addTo(map);
            wrap.addEventListener("mouseenter", () => {
              popup.setLngLat([r.lng, r.lat]).addTo(map);
              glyph.style.transform = "scale(1.15)";
            });
            wrap.addEventListener("mouseleave", () => {
              popup.remove();
              glyph.style.transform = "scale(1)";
            });
            wrap.addEventListener("click", (e) => {
              e.preventDefault();
              // Build a synthetic location so the existing investigation
              // pipeline can be triggered without special-casing the
              // payload shape. resolve_location will refine the address.
              const synth: MapLocation = {
                id: `reservoir:${r.slug}`,
                label: `${r.name}`,
                city: r.name.replace(/\b(Lake|Reservoir)\b/gi, "").trim(),
                county: "",
                region: "TX reservoir",
                mode: "transparency",
                headlineStory: `Investigation centered on ${r.name}.`,
                approxLatLng: { lat: r.lat, lng: r.lng },
                live: true,
              };
              onLocationClickRef.current?.(synth);
            });
            reservoirMarkersRef.current.push({
              slug: r.slug,
              marker,
              popup,
              element: glyph,
              lat: r.lat,
              lng: r.lng,
              name: r.name,
            });
          }

          // Demo address pins (top of marker stack) — teardrop shape so
          // they're visually distinct from the reservoir lake-glyphs and
          // the small circular gauges below them in the stack.
          for (const location of locations) {
            if (!location.approxLatLng) continue;
            const colors = modeMarker(location.mode, location.live);
            const wrap = document.createElement("button");
            wrap.type = "button";
            wrap.setAttribute("aria-label", location.label);
            wrap.style.cssText =
              "background:transparent;border:none;cursor:pointer;padding:0;position:relative;display:flex;align-items:flex-end;justify-content:center;width:22px;height:26px;";

            // Ping rings — three staggered, hidden until the pin
            // is the focused-active one. CSS keyframes handle the
            // expanding-fade animation; we just toggle a class.
            const pingHost = document.createElement("div");
            pingHost.style.cssText = "position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;";
            const pings: HTMLDivElement[] = [];
            for (let i = 0; i < 3; i++) {
              const ring = document.createElement("div");
              ring.className = `dryline-focus-ping${i === 1 ? " delay-1" : i === 2 ? " delay-2" : ""}`;
              ring.style.background = colors.fill;
              ring.style.opacity = "0";
              pingHost.appendChild(ring);
              pings.push(ring);
            }
            wrap.appendChild(pingHost);

            const dot = document.createElement("div");
            dot.style.cssText = `width:18px;height:22px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 1px rgba(7,23,31,0.35));transition:transform 200ms ease;position:relative;z-index:1;`;
            dot.innerHTML = teardropPinHtml(colors.fill, colors.ring);
            wrap.appendChild(dot);

            const popup = new maplibregl.Popup({
              anchor: "bottom",
              offset: 14,
              closeButton: false,
              closeOnClick: false,
              className: "dryline-demo-popup",
            }).setHTML(
              `<div style="padding:8px 12px;max-width:240px"><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Sample address · ${location.region}</div><div style="font-family:'Newsreader',serif;font-size:15px;color:#07171f;line-height:1.2;margin-top:4px">${location.label}</div><div style="font-family:'Newsreader',serif;font-style:italic;font-size:12.5px;color:#4a6c78;margin-top:6px;line-height:1.4">${(location as DemoLocation & { headlineStory?: string }).headlineStory ?? ""}</div><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:8px">Click pin to investigate ↗</div></div>`,
            );
            // anchor: "bottom" pins the teardrop's *tip* (not its center)
            // to the lat/lng. Without this the visual tip floats ~10px
            // south of the actual location and the popup sits awkwardly
            // far above the pin.
            const marker = new maplibregl.Marker({ element: wrap, anchor: "bottom" })
              .setLngLat([location.approxLatLng.lng, location.approxLatLng.lat])
              .addTo(map);
            wrap.addEventListener("mouseenter", () => {
              popup.setLngLat([location.approxLatLng!.lng, location.approxLatLng!.lat]).addTo(map);
              dot.style.transform = "scale(1.12)";
            });
            wrap.addEventListener("mouseleave", () => {
              popup.remove();
              dot.style.transform = "scale(1)";
            });
            wrap.addEventListener("click", (e) => {
              e.preventDefault();
              onLocationClickRef.current?.(location);
            });
            markersRef.current.push({ slug: location.id, marker, popup, dot, pings });
          }
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
      markersRef.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      markersRef.current = [];
      reservoirMarkersRef.current.forEach(({ marker }) => marker.remove());
      reservoirMarkersRef.current = [];
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

  // ---- 2a. Focused address pulse ----
  // While an investigation is active, the focused pin "pings" — three
  // staggered expanding rings — and its dot gets a slightly stronger
  // halo. When idle (no investigation), the focused dot still reads
  // as larger so users see what they clicked.
  useEffect(() => {
    const focusedId = focusedLocation?.id;
    for (const entry of markersRef.current) {
      const isFocused = !!focusedId && entry.slug === focusedId;
      const running = isFocused && !!investigationActive;
      for (const ring of entry.pings) {
        ring.classList.toggle("is-running", running);
        ring.style.opacity = running ? "" : "0";
      }
      if (isFocused) {
        entry.dot.style.transform = running ? "scale(1.32)" : "scale(1.15)";
        entry.dot.style.boxShadow = running
          ? "0 0 0 4px rgba(13,59,111,0.28), 0 0 0 1px rgba(7,23,31,0.55)"
          : "0 0 0 2px rgba(13,59,111,0.22), 0 0 0 1px rgba(7,23,31,0.5)";
      } else {
        entry.dot.style.transform = "scale(1)";
        entry.dot.style.boxShadow = "0 0 0 1px rgba(7,23,31,0.45)";
      }
    }
  }, [focusedLocation, investigationActive]);

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

  // ---- 4b. Reservoir markers: hydrate with live TWDB data ----
  //
  // When the TWDB payload arrives (or the markers re-mount after a hot
  // reload), walk every reservoir marker and update its glyph color +
  // hover tooltip in place. Keeps the markers cheap to create and
  // cleanly separates the "render shape" path from the "fetch data"
  // path.
  useEffect(() => {
    if (!mapReadyState) return;
    for (const entry of reservoirMarkersRef.current) {
      // Slug normalization: our hardcoded list uses underscores
      // (`red_bluff`) while TWDB uses hyphens (`red-bluff`); the fetch
      // effect indexes both forms so either lookup hits.
      const live =
        reservoirData.get(entry.slug) ??
        reservoirData.get(entry.slug.replace(/_/g, "-"));
      // Update glyph color.
      const colors = reservoirFill(live?.pctFull ?? null, live?.historicalAvg ?? null);
      entry.element.innerHTML = lakeGlyphHtml(colors.fill, colors.stroke);
      // Update popup HTML.
      const name = live?.name ?? entry.name;
      let body: string;
      if (live && live.pctFull != null) {
        const pct = live.pctFull;
        const hist = live.historicalAvg ?? null;
        const t = live.trend7d ?? null;
        const arrow = t == null ? "" : t > 0.3 ? "↗" : t < -0.3 ? "↘" : "→";
        const trendLabel =
          t == null
            ? ""
            : `<span style="color:${t > 0 ? "#0d3b6f" : t < 0 ? "#a85a35" : "#4a6c78"}">${arrow} ${t > 0 ? "+" : ""}${t.toFixed(1)} pts / 7d</span>`;
        const spark = sparklineSvg(live.series, hist, { w: 130, h: 28 });
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
          <div style="font-family:'Geist Mono',monospace;font-size:9.5px;color:#4a6c78;margin-top:4px;display:flex;justify-content:space-between;gap:6px"><span>${trendLabel}</span><span>${live.lastUpdated ?? ""}</span></div>
        `;
      } else {
        body = `<div style="font-family:'Geist Mono',monospace;font-size:9.5px;color:#4a6c78;margin-top:2px">${live ? "No live readings published yet." : "Live data not in TWDB instantaneous feed."}</div>`;
      }
      entry.popup.setHTML(`<div style="padding:10px 12px;min-width:200px">
        <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Reservoir</div>
        <div style="font-family:'Newsreader',serif;font-size:15px;color:#07171f;margin-top:2px;line-height:1.2">${name}</div>
        ${body}
        <div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:8px;border-top:1px solid #c8d6da;padding-top:6px">Click to investigate ↗</div>
      </div>`);
    }
  }, [reservoirData, mapReadyState]);

  // ---- 5. Reservoir visibility toggle ----
  useEffect(() => {
    for (const { marker } of reservoirMarkersRef.current) {
      const el = marker.getElement();
      if (el) el.style.display = layerState.reservoirs ? "" : "none";
    }
  }, [layerState.reservoirs, mapReadyState]);

  // ---- 5-bis. Sample-address visibility toggle ----
  // The 7 demo address pins (Wimberley, Taylor, Fort Stockton, etc.)
  // can be hidden to declutter the map when a user is focused on the
  // live data layers (gauges, reservoirs).
  useEffect(() => {
    for (const { marker } of markersRef.current) {
      const el = marker.getElement();
      if (el) el.style.display = layerState.samples ? "" : "none";
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
  useEffect(() => {
    if (!traces || traces.length === 0) return;
    const map = mapRef.current;
    if (!map) return;
    // Only react to the LATEST event we haven't seen.
    const latest = traces[traces.length - 1];
    if (!latest || latest.type !== "tool_result") return;

    if (latest.toolName === "get_reservoirs") {
      // Pulse markers whose slug matches one returned by the tool.
      const data = latest.data as { reservoirs?: Array<{ slug?: string }> } | null;
      const slugs = new Set((data?.reservoirs ?? []).map((r) => r.slug ?? "").filter(Boolean));
      for (const { slug, element } of reservoirMarkersRef.current) {
        if (slugs.has(slug)) {
          element.style.transform = "scale(1.6)";
          element.style.boxShadow = "0 0 0 4px rgba(13,59,111,0.35)";
          window.setTimeout(() => {
            element.style.transform = "scale(1)";
            element.style.boxShadow = "0 0 0 1px rgba(7,23,31,0.18)";
          }, 1400);
        }
      }
    }
  }, [traces]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-foam">
      <div ref={containerRef} className="dryline-map absolute inset-0" />

      {/* Branded multi-section legend (bottom-left). Editorial card with
          drought ramp, gauge color stops, and pin-key — spelled out so a
          first-time viewer doesn't have to guess what they're looking at. */}
      <div
        className={cn(
          "pointer-events-none absolute left-4 bottom-4 max-w-[260px]",
          "border backdrop-blur-sm shadow-paper",
          dark
            ? "border-aquifer/50 bg-[rgba(8,14,22,0.85)] text-spring"
            : "border-rule bg-paper/95 text-ink",
        )}
      >
        <div
          className={cn(
            "px-3 py-2 border-b font-mono text-[10px] tracking-[0.18em] uppercase",
            dark ? "border-aquifer/40 text-spring/80" : "border-rule text-tideline",
          )}
        >
          Legend · Texas water
        </div>
        <div className="px-3 py-2.5 space-y-3">
          {/* Drought ramp */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              Drought · USDM
            </div>
            <div className="flex h-2.5">
              {DROUGHT_COLORS.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className={cn(
              "flex justify-between font-mono text-[8.5px] tracking-[0.16em] uppercase mt-0.5",
              dark ? "text-spring/60" : "text-tideline",
            )}>
              <span>D0</span><span>D1</span><span>D2</span><span>D3</span><span>D4</span>
            </div>
          </div>
          {/* Stream gauge stops */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              Stream gauges · cfs
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px]">
              <Swatch color={dark ? "#3a4d56" : "#4a6c78"} />
              <span className={dark ? "text-spring/80" : "text-ink/85"}>dry · &lt; 0.5</span>
              <Swatch color={dark ? "#d6a06a" : "#b58a52"} />
              <span className={dark ? "text-spring/80" : "text-ink/85"}>low · &lt; 50</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] mt-0.5">
              <Swatch color={dark ? "#7ad6e9" : "#4a8aa8"} />
              <span className={dark ? "text-spring/80" : "text-ink/85"}>normal · &lt; 500</span>
              <Swatch color={dark ? "#5fc7ff" : "#0d3b6f"} />
              <span className={dark ? "text-spring/80" : "text-ink/85"}>high · 500+</span>
            </div>
          </div>
          {/* Pin key — every shape here matches the actual glyph rendered
              on the map. Click any pin to investigate the location. */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              Pins · click to investigate
            </div>
            <ul className="space-y-1 text-[10.5px] leading-snug">
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-flex items-center"
                  style={{ width: 22, height: 14 }}
                  dangerouslySetInnerHTML={{ __html: teardropPinHtml("#0d3b6f", "#9ec5cf") }}
                />
                <span className={dark ? "text-spring/85" : "text-ink/90"}>Sample address</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-flex items-center"
                  style={{ width: 22, height: 14 }}
                  dangerouslySetInnerHTML={{ __html: lakeGlyphHtml("#0d3b6f", "#061f3d") }}
                />
                <span className={dark ? "text-spring/85" : "text-ink/90"}>Reservoir · live data</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="relative inline-block"
                  style={{ width: 12, height: 12 }}
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
                    style={{
                      width: 4,
                      height: 4,
                      background: "#4a8aa8",
                      top: 4,
                      left: 4,
                    }}
                  />
                </span>
                <span className={dark ? "text-spring/85" : "text-ink/90"}>USGS gauge · cfs</span>
              </li>
            </ul>
            <div className={cn(
              "mt-1.5 font-serif italic text-[10px] leading-tight",
              dark ? "text-spring/60" : "text-tideline",
            )}>
              Reservoir color = drought severity (full ↔ critical).
            </div>
          </div>
        </div>
      </div>

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
