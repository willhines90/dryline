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

type MapInstance = import("maplibre-gl").Map;
type MarkerInstance = import("maplibre-gl").Marker;
type PopupInstance = import("maplibre-gl").Popup;

const TEXAS_BOUNDS: [[number, number], [number, number]] = [
  [-106.7, 25.6],
  [-93.2, 36.8],
];

const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    base: {
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
  },
  layers: [{ id: "base", type: "raster", source: "base" }],
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
  { key: "reservoirs", label: "Reservoirs", swatch: "#4a8aa8", hint: "Major TWDB-instrumented reservoirs." },
  { key: "rivers", label: "Major rivers", swatch: "#0d3b6f", hint: "Coming soon — main-stem TX rivers." , disabled: true },
  { key: "aquifers", label: "Aquifer regions", swatch: "#1f4d4a", hint: "Coming soon — TWDB major aquifer polygons.", disabled: true },
  { key: "gauges", label: "Stream gauges", swatch: "#2566a8", hint: "Coming soon — USGS NWIS active gauges." , disabled: true },
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

  useEffect(() => {
    onLocationClickRef.current = onLocationClick;
  }, [onLocationClick]);

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
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

        map.on("error", (e) => {
          // eslint-disable-next-line no-console
          console.warn("[TexasMap] tile/source error:", e?.error ?? e);
        });

        map.on("load", () => {
          map.fitBounds(TEXAS_BOUNDS, { padding: 36, duration: 0 });
          mapReadyRef.current = true;
          setMapReadyState(true);

          // Reservoirs (bottom of marker stack)
          for (const r of RESERVOIR_PINS) {
            const dot = document.createElement("div");
            dot.style.cssText =
              "width:10px;height:10px;border-radius:99px;background:#4a8aa8;border:2px solid #d6e4e6;box-shadow:0 0 0 1px rgba(7,23,31,0.18);transition:transform 200ms ease, box-shadow 200ms ease;";
            dot.title = r.name;
            const popup = new maplibregl.Popup({
              offset: 14,
              closeButton: false,
              closeOnClick: false,
              className: "dryline-reservoir-popup",
            }).setHTML(
              `<div style="padding:6px 10px"><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">Reservoir</div><div style="font-family:'Newsreader',serif;font-size:14px;color:#07171f;margin-top:2px">${r.name}</div></div>`,
            );
            const marker = new maplibregl.Marker({ element: dot, anchor: "center" })
              .setLngLat([r.lng, r.lat])
              .addTo(map);
            dot.addEventListener("mouseenter", () => popup.setLngLat([r.lng, r.lat]).addTo(map));
            dot.addEventListener("mouseleave", () => popup.remove());
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
              `<div style="padding:8px 12px;max-width:240px"><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:#4a6c78">${location.live ? "Live demo" : "In chamber"} · ${location.region}</div><div style="font-family:'Newsreader',serif;font-size:15px;color:#07171f;line-height:1.2;margin-top:4px">${location.label}</div><div style="font-family:'Newsreader',serif;font-style:italic;font-size:12.5px;color:#4a6c78;margin-top:6px;line-height:1.4">${(location as DemoLocation & { headlineStory?: string }).headlineStory ?? ""}</div><div style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#0d3b6f;margin-top:8px">Click pin to investigate ↗</div></div>`,
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
              "fill-opacity": 0.22,
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
    for (const { element } of reservoirMarkersRef.current) {
      element.style.display = layerState.reservoirs ? "" : "none";
    }
  }, [layerState.reservoirs, mapReadyState]);

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

      <div className="pointer-events-none absolute left-4 top-4 max-w-[260px] rounded-none border border-rule bg-paper/95 px-3 py-2 backdrop-blur-sm shadow-paper">
        <p className="dryline-label">Texas water · live</p>
        <p className="font-serif text-[13.5px] text-ink leading-snug mt-1">
          Drought polygon under everything; reservoirs and demo addresses on top.
        </p>
      </div>

      <LayerControl
        specs={LAYER_SPECS}
        state={layerState}
        onToggle={toggleLayer}
        className="pointer-events-auto absolute right-4 bottom-4 w-[220px]"
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
