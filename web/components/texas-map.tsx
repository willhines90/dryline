"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoLocation } from "@/lib/types";
import type { StyleSpecification } from "maplibre-gl";

type MapInstance = import("maplibre-gl").Map;
type MarkerInstance = import("maplibre-gl").Marker;
type PopupInstance = import("maplibre-gl").Popup;

const TEXAS_BOUNDS: [[number, number], [number, number]] = [
  [-106.7, 25.6],
  [-93.2, 36.8],
];

const TOPO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    opentopomap: {
      type: "raster",
      tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '&copy; <a href="https://viewfinderpanoramas.org">SRTM</a> | ' +
        '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxzoom: 17,
    },
  },
  layers: [
    {
      id: "opentopomap",
      type: "raster",
      source: "opentopomap",
    },
  ],
};

function buildPopupMarkup(location: DemoLocation) {
  return `
    <div class="px-4 py-3">
      <p class="font-serif text-sm text-reservoir-700">${location.city}</p>
      <p class="mt-1 text-sm font-medium">${location.label}</p>
      <p class="mt-2 text-xs text-slate-600">${location.region}</p>
    </div>
  `;
}

type MapLocation = DemoLocation & {
  approxLatLng?: {
    lat: number;
    lng: number;
  };
};

interface TexasMapProps {
  locations: MapLocation[];
  /** When set, the map flies to this location's approxLatLng. */
  focusedLocation?: MapLocation | null;
}

export function TexasMap({ locations, focusedLocation }: TexasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markersRef = useRef<Array<{ marker: MarkerInstance; popup: PopupInstance }>>([]);
  const mapReadyRef = useRef(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [tilesFailing, setTilesFailing] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    async function mountMap() {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: TOPO_STYLE,
          center: [-99.2, 31.1],
          zoom: 5.25,
          minZoom: 4.25,
          maxZoom: 14,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

        map.on("error", (e) => {
          // eslint-disable-next-line no-console
          console.warn("[TexasMap] tile/source error:", e?.error ?? e);
          setTilesFailing(true);
        });

        map.on("load", () => {
          map.fitBounds(TEXAS_BOUNDS, { padding: 36, duration: 0 });
          mapReadyRef.current = true;
          for (const location of locations) {
            if (!location.approxLatLng) continue;
            const markerNode = document.createElement("button");
            markerNode.type = "button";
            markerNode.setAttribute("aria-label", location.label);
            markerNode.className =
              "h-3.5 w-3.5 rounded-full border-2 border-arid-50 bg-reservoir-500 shadow-[0_0_0_6px_rgba(250,246,238,0.22)] transition-transform";
            const popup = new maplibregl.Popup({
              offset: 18,
              closeButton: false,
              closeOnClick: false,
            }).setHTML(buildPopupMarkup(location));
            const marker = new maplibregl.Marker({ element: markerNode, anchor: "center" })
              .setLngLat([location.approxLatLng.lng, location.approxLatLng.lat])
              .addTo(map);
            markerNode.addEventListener("mouseenter", () => {
              popup.setLngLat([location.approxLatLng!.lng, location.approxLatLng!.lat]).addTo(map);
              markerNode.style.transform = "scale(1.15)";
            });
            markerNode.addEventListener("mouseleave", () => {
              popup.remove();
              markerNode.style.transform = "scale(1)";
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
      mapReadyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locations]);

  // Drive the camera from focusedLocation. flyTo when set; reset to bounds when cleared.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (focusedLocation?.approxLatLng) {
        map.flyTo({
          center: [focusedLocation.approxLatLng.lng, focusedLocation.approxLatLng.lat],
          zoom: 9.5,
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

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden bg-reservoir-100">
      <div ref={containerRef} className="dryline-map absolute inset-0" />
      <div className="pointer-events-none absolute left-5 top-5 max-w-xs rounded-md border border-border/80 bg-card/90 px-4 py-3 backdrop-blur-sm">
        <p className="font-serif text-sm text-reservoir-700">Texas basemap</p>
        <p className="mt-1 text-xs text-muted-foreground">
          OpenTopoMap tiles with the seven demo locations staged for the investigation flow.
        </p>
      </div>
      {mountError ? (
        <div className="absolute inset-x-6 bottom-6 rounded-md border border-red-300 bg-red-50/95 px-4 py-3 text-xs text-red-900 shadow-md">
          <div className="font-semibold uppercase tracking-[0.18em] mb-1">Map failed to mount</div>
          <div className="font-mono">{mountError}</div>
        </div>
      ) : tilesFailing ? (
        <div className="absolute inset-x-6 bottom-6 rounded-md border border-amber-300 bg-amber-50/95 px-4 py-3 text-xs text-amber-900 shadow-md">
          Basemap tile source returned an error (probably an upstream rate-limit). The map view
          may show fewer tiles than expected. Markers are still positioned correctly.
        </div>
      ) : null}
    </div>
  );
}
