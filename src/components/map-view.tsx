"use client";

import { useEffect, useRef } from "react";
import { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** Marker accent (source color) */
  color?: string;
  /** Small label rendered inside the pin (e.g. price). */
  label?: string;
  title?: string;
}

const MADRID: [number, number] = [-3.7038, 40.4168];

/** Inline OSM raster style — no remote style fetch, no API key. */
const osmStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

/**
 * Interactive map (MapLibre + OSM raster basemap, no API key).
 * Dark mode is applied via a CSS filter on the canvas (see globals.css).
 * Renders one tappable pin per point.
 */
export function MapView({
  points,
  onSelect,
  className,
  zoom = 12.5,
  interactive = true,
}: {
  points: MapPoint[];
  onSelect?: (id: string) => void;
  className?: string;
  zoom?: number;
  interactive?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const selectRef = useRef(onSelect);
  const ready = useRef<Promise<void> | null>(null);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const first = points[0];
    const instance = new MlMap({
      container: container.current,
      style: osmStyle as never,
      center: first ? [first.lng, first.lat] : MADRID,
      zoom,
      interactive,
      attributionControl: { compact: true },
    });
    map.current = instance;

    // Resolves once the map is usable — safety timeout in case the
    // load event is delayed.
    ready.current = new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      if (instance.isStyleLoaded() && instance.loaded()) settle();
      instance.once("load", settle);
      setTimeout(settle, 2500);
    });

    return () => {
      markers.current = [];
      instance.remove();
      map.current = null;
      ready.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const render = () => {
      for (const marker of markers.current) marker.remove();
      markers.current = [];

      const withCoords = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      for (const p of withCoords) {
        const el = document.createElement("button");
        el.className = "mpc-marker group";
        el.setAttribute("aria-label", p.title ?? "Event");
        el.style.setProperty("--marker-color", p.color ?? "#ff6414");
        el.innerHTML = `<span>${p.label ?? ""}</span>`;
        el.onclick = (e) => {
          e.stopPropagation();
          selectRef.current?.(p.id);
        };
        markers.current.push(new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m));
      }

      if (withCoords.length > 1) {
        const lons = withCoords.map((p) => p.lng);
        const lats = withCoords.map((p) => p.lat);
        m.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: 56, maxZoom: 15, duration: 600 },
        );
      } else if (withCoords.length === 1) {
        m.jumpTo({ center: [withCoords[0].lng, withCoords[0].lat], zoom: 14.5 });
      }
    };

    void (async () => {
      if (ready.current) await ready.current;
      render();
    })();
  }, [points]);

  return <div ref={container} className={className} />;
}

export default MapView;
