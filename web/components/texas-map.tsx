"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoLocation, Mode } from "@/lib/types";
import type { StyleSpecification } from "maplibre-gl";

type MapInstance = import("maplibre-gl").Map;
type MarkerInstance = import("maplibre-gl").Marker;
type PopupInstance = import("maplibre-gl").Popup;

const TEXAS_BOUNDS: [[number, number], [number, number]] = [
  [-106.7, 25.6],
  [-93.2, 36.8],
];

/**
 * Carto Voyager — clean, low-saturation basemap that lets our pins and
 * overlays read clearly. (OpenTopoMap was rate-limited and hard to
 * compose against.)
 */
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

/**
 * Curated set of major TX reservoirs we want pinned on the basemap as
 * permanent context. Lat/lng from TWDB; named after the lake itself.
 * Color = aquifer blue; capacity isn't shown live to keep the map
 * snappy on first paint.
 */
const RESERVOIR_PINS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Lake Travis", lat: 30.391869, lng: -97.907234 },
  { name: "Canyon Lake", lat: 29.86883, lng: -98.198898 },
  { name: "Lake Granger", lat: 30.7029, lng: -97.339 },
  { name: "Lake Buchanan", lat: 30.785, lng: -98.4178 },
  { name: "Lake LBJ", lat: 30.5519, lng: -98.3539 },
  { name: "Lake Conroe", lat: 30.4413, lng: -95.5747 },
  { name: "Lake Houston", lat: 29.9211, lng: -95.1402 },
  { name: "Lake Texoma", lat: 33.8316, lng: -96.7022 },
  { name: "Possum Kingdom Lake", lat: 32.8762, lng: -98.4283 },
  { name: "Lake Whitney", lat: 31.9332, lng: -97.3711 },
  { name: "Lake Tawakoni", lat: 32.8728, lng: -95.9569 },
  { name: "Sam Rayburn Reservoir", lat: 31.0606, lng: -94.1062 },
  { name: "Toledo Bend Reservoir", lat: 31.5739, lng: -93.7488 },
  { name: "Caddo Lake", lat: 32.7193, lng: -94.1149 },
  { name: "Choke Canyon Reservoir", lat: 28.4894, lng: -98.2519 },
  { name: "Falcon Lake", lat: 26.5566, lng: -99.1433 },
  { name: "Amistad Reservoir", lat: 29.4513, lng: -101.0297 },
  { name: "Red Bluff Reservoir", lat: 31.8967, lng: -103.9197 },
];

function modeMarker(mode: Mode | undefined, isLive: boolean | undefined): {
  fill: string;
  ring: string;
} {
  if (!isLive) return { fill: "#9ec5cf", ring: "#dde6e9" }; // spring + paper-deep
  if (mode === "transparency") return { fill: "#b58a52", ring: "#7a5a2c" }; // ochre + ochre-deep
  return { fill: "#0d3b6f", ring: "#9ec5cf" }; // aquifer + spring
}

type MapLocation = DemoLocation & {
  approxLatLng?: { lat: number; lng: number };
  live?: boolean;
};

interface TexasMapProps {
  locations: MapLocation[];
  /** When set, the map flies to this location's approxLatLng. */
  focusedLocation?: MapLocation | null;
  /** When true, draw a pulsing ring + 15mi search disk at the focused location. */
  investigationActive?: boolean;
  /** Click handler for any demo pin. */
  onLocationClick?: (loc: MapLocation) => void;
}

export function TexasMap({
  locations,
  focusedLocation,
  investigationActive,
  onLocationClick,
}: TexasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markersRef = useRef<Array<{ marker: MarkerInstance; popup: PopupInstance }>>([]);
  const reservoirMarkersRef = useRef<MarkerInstance[]>([]);
  const mapReadyRef = useRef(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const onLocationClickRef = useRef(onLocationClick);

  // Keep latest click handler accessible from inside the map "load" callback
  // without re-mounting the map every render.
  useEffect(() => {
    onLocationClickRef.current = onLocationClick;
  }, [onLocationClick]);

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

          // Reservoirs as permanent low-saturation context dots.
          for (const r of RESERVOIR_PINS) {
            const dot = document.createElement("div");
            dot.style.cssText =
              "width:10px;height:10px;border-radius:99px;background:#4a8aa8;border:2px solid #d6e4e6;box-shadow:0 0 0 1px rgba(7,23,31,0.18);";
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
            reservoirMarkersRef.current.push(marker);
          }

          // Demo address pins — bigger, mode-colored, clickable.
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
      reservoirMarkersRef.current.forEach((m) => m.remove());
      reservoirMarkersRef.current = [];
      mapReadyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locations]);

  // Camera control: flyTo when focused, fitBounds when cleared.
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

  // Investigation overlay: a 15mi disk + pulsing ring at the focused address.
  // Adds/removes a circle source + two layers from the map's style. Avoids
  // overlapping symbol IDs by mounting a single-feature GeoJSON source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = async () => {
      const maplibregl = await import("maplibre-gl");
      void maplibregl;
      const SRC = "dryline-active-radius";
      const FILL = "dryline-active-radius-fill";
      const STROKE = "dryline-active-radius-stroke";

      const cleanup = () => {
        try {
          if (map.getLayer(STROKE)) map.removeLayer(STROKE);
          if (map.getLayer(FILL)) map.removeLayer(FILL);
          if (map.getSource(SRC)) map.removeSource(SRC);
        } catch {
          /* not yet mounted */
        }
      };

      cleanup();
      if (!focusedLocation?.approxLatLng) return;

      const { lat, lng } = focusedLocation.approxLatLng;
      // Build a 64-vertex circle approximation in lat/lng space (15 mi radius).
      const milesToDeg = (mi: number, atLat: number) => ({
        dLat: mi / 69,
        dLng: mi / (69 * Math.cos((atLat * Math.PI) / 180)),
      });
      const { dLat, dLng } = milesToDeg(15, lat);
      const ring: [number, number][] = [];
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * 2 * Math.PI;
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
        paint: { "fill-color": "#0d3b6f", "fill-opacity": investigationActive ? 0.08 : 0.04 },
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

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-foam">
      <div ref={containerRef} className="dryline-map absolute inset-0" />

      {/* Title overlay */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[260px] rounded-none border border-rule bg-paper/95 px-3 py-2 backdrop-blur-sm shadow-paper">
        <p className="dryline-label">Texas water · live</p>
        <p className="font-serif text-[13.5px] text-ink leading-snug mt-1">
          Major reservoirs in tide blue. Demo addresses colored by mode.
        </p>
      </div>

      {/* Legend (bottom-left) */}
      <div className="pointer-events-none absolute left-4 bottom-4 rounded-none border border-rule bg-paper/95 px-3 py-2 backdrop-blur-sm shadow-paper">
        <p className="dryline-label mb-1.5">Legend</p>
        <ul className="space-y-1 text-[11px] font-serif text-ink/85">
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-spring" style={{ background: "#0d3b6f" }} />
            Personal mode address
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-ochre-deep" style={{ background: "#b58a52" }} />
            Transparency mode address
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-foam" style={{ background: "#4a8aa8" }} />
            TWDB-tracked reservoir
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border border-aquifer/60 bg-aquifer/10" />
            15 mi industrial-search radius
          </li>
        </ul>
      </div>

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
