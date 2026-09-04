"use client";

import { useEffect, useRef } from "react";
import { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { useTheme } from "@/components/theme-provider";

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
const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

/**
 * Interactive map (MapLibre + CARTO free basemap, no API key).
 * Basemap follows the app theme; renders one tappable pin per point.
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
  const styleLoaded = useRef(false);
  const appliedStyle = useRef<string | null>(null);
  const ready = useRef<Promise<void> | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const first = points[0];
    const url = theme === "dark" ? STYLES.dark : STYLES.light;
    appliedStyle.current = url;
    const instance = new MlMap({
      container: container.current,
      style: url,
      center: first ? [first.lng, first.lat] : MADRID,
      zoom,
      interactive,
      attributionControl: { compact: true },
    });
    map.current = instance;

    // Resolves once the map is usable — guarding against the load event
    // having already fired before later effects subscribe.
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
      styleLoaded.current = false;
      appliedStyle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap when the app theme changes (pins are DOM, they survive).
  // Guarded: setStyle before the initial load completes would cancel the
  // first "load" event and markers would never render.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const url = theme === "dark" ? STYLES.dark : STYLES.light;
    const apply = () => {
      styleLoaded.current = true;
      if (appliedStyle.current === url) return;
      appliedStyle.current = url;
      m.setStyle(url);
    };
    if (styleLoaded.current || m.isStyleLoaded()) apply();
    else m.once("load", apply);
  }, [theme]);

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
