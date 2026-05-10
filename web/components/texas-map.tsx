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

/** Curated set of major TX reservoirs we want pinned on the basemap. */
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
  { key: "drought", label: "Drought (USDM)", swatch: "#a85a35", hint: "Current week's U.S. Drought Monitor polygons, filtered to Texas." },
  { key: "rivers", label: "Major rivers", swatch: "#0d3b6f", hint: "Twelve TX river main stems (simplified centerlines)." },
  { key: "reservoirs", label: "Reservoirs", swatch: "#4a8aa8", hint: "Major TWDB-instrumented reservoirs." },
  { key: "gauges", label: "Stream gauges", swatch: "#2566a8", hint: "USGS NWIS active discharge gauges, ~500 across Texas." },
  { key: "aquifers", label: "Aquifer regions", swatch: "#1f4d4a", hint: "Coming soon — TWDB major aquifer polygons.", disabled: true },
];

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
  const markersRef = useRef<Array<{ marker: MarkerInstance; popup: PopupInstance }>>([]);
  const reservoirMarkersRef = useRef<
    Array<{ slug: string; marker: MarkerInstance; element: HTMLDivElement }>
  >([]);
  const mapReadyRef = useRef(false);
  const [mapReadyState, setMapReadyState] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const onLocationClickRef = useRef(onLocationClick);

  const { state: layerState, toggle: toggleLayer } = useLayerToggles(LAYER_SPECS);
  const { dark } = useDarkMode();

  useEffect(() => {
    onLocationClickRef.current = onLocationClick;
  }, [onLocationClick]);

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
        // Attribution moved to top-right (compact "i") so it doesn't sit
        // on top of our bottom-right LayerControl. NavigationControl
        // (zoom +/-) intentionally omitted — uncluttered demo chrome.
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

        map.on("error", (e) => {
          // eslint-disable-next-line no-console
          console.warn("[TexasMap] tile/source error:", e?.error ?? e);
        });

        map.on("load", () => {
          map.fitBounds(TEXAS_BOUNDS, { padding: 36, duration: 0 });
          mapReadyRef.current = true;
          setMapReadyState(true);

          // Reservoirs (bottom of marker stack). Two-layer marker:
          // an outer water-tinted halo + a crisp inner dot. The halo
          // is wider so that at low (state-level) zoom the lakes
          // still read as discrete water bodies rather than dust.
          for (const r of RESERVOIR_PINS) {
            const wrap = document.createElement("div");
            wrap.style.cssText =
              "position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;";
            const halo = document.createElement("div");
            halo.style.cssText =
              "position:absolute;width:22px;height:22px;border-radius:99px;background:radial-gradient(circle, rgba(74,138,168,0.45) 0%, rgba(74,138,168,0.0) 70%);transition:transform 200ms ease, opacity 200ms ease;";
            const dot = document.createElement("div");
            dot.style.cssText =
              "width:9px;height:9px;border-radius:99px;background:#4a8aa8;border:2px solid #ecf3f5;box-shadow:0 0 0 1px rgba(7,23,31,0.28);transition:transform 200ms ease, box-shadow 200ms ease;";
            wrap.appendChild(halo);
            wrap.appendChild(dot);
            wrap.title = r.name;
            const popup = new maplibregl.Popup({
              offset: 14,
              closeButton: false,
              closeOnClick: false,
              className: "dryline-reservoir-popup",
            }).setHTML(
              `<div style="padding:6px 10px"><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Major reservoir</div><div style="font-family:'Newsreader',serif;font-size:14px;color:#07171f;margin-top:2px">${r.name}</div></div>`,
            );
            const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
              .setLngLat([r.lng, r.lat])
              .addTo(map);
            wrap.addEventListener("mouseenter", () => {
              popup.setLngLat([r.lng, r.lat]).addTo(map);
              halo.style.transform = "scale(1.4)";
              dot.style.transform = "scale(1.3)";
            });
            wrap.addEventListener("mouseleave", () => {
              popup.remove();
              halo.style.transform = "scale(1)";
              dot.style.transform = "scale(1)";
            });
            reservoirMarkersRef.current.push({ slug: r.slug, marker, element: dot });
          }

          // Demo address pins (top of marker stack)
          for (const location of locations) {
            if (!location.approxLatLng) continue;
            const colors = modeMarker(location.mode, location.live);
            const wrap = document.createElement("button");
            wrap.type = "button";
            wrap.setAttribute("aria-label", location.label);
            wrap.style.cssText =
              "background:transparent;border:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:22px;height:22px;";

            const halo = document.createElement("div");
            halo.style.cssText = `position:absolute;width:22px;height:22px;border-radius:99px;background:${colors.fill};opacity:0.18;`;
            const dot = document.createElement("div");
            dot.style.cssText = `width:12px;height:12px;border-radius:99px;background:${colors.fill};border:2px solid ${colors.ring};box-shadow:0 0 0 1px rgba(7,23,31,0.45);transition:transform 160ms ease;`;
            wrap.appendChild(halo);
            wrap.appendChild(dot);

            const popup = new maplibregl.Popup({
              offset: 18,
              closeButton: false,
              closeOnClick: false,
              className: "dryline-demo-popup",
            }).setHTML(
              `<div style="padding:8px 12px;max-width:240px"><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Sample address · ${location.region}</div><div style="font-family:'Newsreader',serif;font-size:15px;color:#07171f;line-height:1.2;margin-top:4px">${location.label}</div><div style="font-family:'Newsreader',serif;font-style:italic;font-size:12.5px;color:#4a6c78;margin-top:6px;line-height:1.4">${(location as DemoLocation & { headlineStory?: string }).headlineStory ?? ""}</div><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:8px">Click pin to investigate ↗</div></div>`,
            );
            const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
              .setLngLat([location.approxLatLng.lng, location.approxLatLng.lat])
              .addTo(map);
            wrap.addEventListener("mouseenter", () => {
              popup.setLngLat([location.approxLatLng!.lng, location.approxLatLng!.lat]).addTo(map);
              dot.style.transform = "scale(1.18)";
            });
            wrap.addEventListener("mouseleave", () => {
              popup.remove();
              dot.style.transform = "scale(1)";
            });
            wrap.addEventListener("click", (e) => {
              e.preventDefault();
              onLocationClickRef.current?.(location);
            });
            markersRef.current.push({ marker, popup });
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

  // ---- 3. Active investigation overlay (radius disk) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const SRC = "dryline-active-radius";
      const FILL = "dryline-active-radius-fill";
      const STROKE = "dryline-active-radius-stroke";
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
          "fill-opacity": investigationActive ? 0.08 : 0.04,
        },
      });
      map.addLayer({
        id: STROKE,
        type: "line",
        source: SRC,
        paint: {
          "line-color": "#0d3b6f",
          "line-opacity": investigationActive ? 0.55 : 0.3,
          "line-width": investigationActive ? 1.5 : 1,
          "line-dasharray": investigationActive ? [1, 0] : [3, 3],
        },
      });
    };
    if (mapReadyRef.current) apply();
    else map.once("load", apply);
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
        map.addLayer(
          {
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
              "fill-opacity": 0.18,
              "fill-outline-color": "#7a5a2c",
            },
          },
          // Insert above the base raster but below any subsequent layers
          undefined,
        );
        // Move drought to bottom of overlay stack so reservoir/address pins sit above
        // (markers are HTML elements, drawn above all canvas layers regardless).
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] drought layer failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [layerState.drought, mapReadyState]);

  // ---- 5. Reservoir visibility toggle ----
  useEffect(() => {
    for (const { marker } of reservoirMarkersRef.current) {
      const el = marker.getElement();
      if (el) el.style.display = layerState.reservoirs ? "" : "none";
    }
  }, [layerState.reservoirs, mapReadyState]);

  // ---- 5a. Texas state outline — permanent, always visible. Draws a
  // thick aquifer-blue (or cyan in dark mode) outline of the state to
  // make it clear the surface is TX-focused.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyState) return;
    let cancelled = false;
    const SRC = "dryline-tx-bounds";
    const LINE = "dryline-tx-bounds-line";
    const GLOW = "dryline-tx-bounds-glow";

    const cleanup = () => {
      try {
        if (map.getLayer(LINE)) map.removeLayer(LINE);
        if (map.getLayer(GLOW)) map.removeLayer(GLOW);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        /* idempotent */
      }
    };

    (async () => {
      try {
        const res = await fetch("/tx-bounds.geojson", { cache: "force-cache" });
        if (cancelled || !res.ok) return;
        const fc = await res.json();
        if (cancelled) return;
        cleanup();
        if (map.getSource(SRC)) return;
        map.addSource(SRC, { type: "geojson", data: fc });
        map.addLayer({
          id: GLOW,
          type: "line",
          source: SRC,
          paint: {
            "line-color": dark ? "#5fc7ff" : "#0d3b6f",
            "line-opacity": dark ? 0.45 : 0.18,
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
            "line-opacity": dark ? 0.95 : 0.7,
            "line-width": dark ? 1.6 : 1.4,
            "line-dasharray": [4, 2],
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] TX bounds layer failed:", err);
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
        // Stash the handlers on the map instance so cleanup can detach them.
        const handlers = { onMove, onLeave, popup };
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
          };
        }
      ).__riverHandlers;
      if (handlers) {
        try {
          map.off("mousemove", LINE, handlers.onMove);
          map.off("mouseleave", LINE, handlers.onLeave);
          handlers.popup.remove();
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
    const cleanup = () => {
      try {
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
              dark ? 3 : 2,
              8,
              dark ? 4.5 : 3,
              10,
              dark ? 6 : 4.5,
            ],
            // Color by current cfs (step expression on a coalesced number):
            //   < 0.5 cfs (no reading or dry) → muted gray
            //   0.5–49 cfs                    → ochre (low flow)
            //   50–499 cfs                    → river (normal)
            //   ≥ 500 cfs                     → aquifer (high)
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
            "circle-stroke-color": dark ? "#0a0e16" : "#eef2f3",
            "circle-stroke-width": 1,
            "circle-opacity": dark ? 0.95 : 0.85,
            "circle-blur": dark ? 0.15 : 0,
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[TexasMap] gauges layer failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [layerState.gauges, mapReadyState, dark]);

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
          {/* Pin key — kept intentionally short. The two pin colors
              encode the address's default mode (personal/transparency)
              but a first-time viewer doesn't need that nuance. */}
          <div>
            <div className={cn(
              "font-mono text-[9.5px] tracking-[0.18em] uppercase mb-1",
              dark ? "text-spring/70" : "text-tideline",
            )}>
              Pins · click to investigate
            </div>
            <ul className="space-y-0.5 text-[10.5px] leading-snug">
              <li className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5">
                  <Pin fill="#0d3b6f" ring="#9ec5cf" />
                  <Pin fill="#b58a52" ring="#7a5a2c" />
                </span>
                <span className={dark ? "text-spring/85" : "text-ink/90"}>Sample address</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: "#4a8aa8", borderColor: dark ? "#0a0e16" : "#d6e4e6" }}
                />
                <span className={dark ? "text-spring/85" : "text-ink/90"}>Major reservoir (18)</span>
              </li>
            </ul>
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
