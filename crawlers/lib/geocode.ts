/**
 * Venue geocoding via Nominatim (OpenStreetMap) — used by the crawlers to
 * attach coordinates to events so the web app can show maps.
 *
 * - Results (including "not found" nulls) are cached in crawlers/.geocache.json
 *   so repeat crawls don't re-query.
 * - Strictly rate-limited to ~1 request/second per Nominatim usage policy.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sleep } from "./types";

const CACHE_FILE = "crawlers/.geocache.json";
const MIN_INTERVAL_MS = 1100;

export interface Coords {
  lat: number;
  lng: number;
}

let cache: Record<string, Coords | null> = {};
try {
  if (existsSync(CACHE_FILE)) cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
} catch {
  cache = {};
}

let lastCall = 0;
let dirty = false;

function persist() {
  if (!dirty) return;
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn(`  [geocode] cache write failed: ${error instanceof Error ? error.message : error}`);
  }
}

/** Extract coords from a Google Maps link like …/@40.4187,-3.7053,17z… */
export function coordsFromGmapsUrl(url: string | undefined): Coords | undefined {
  if (!url) return undefined;
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

/**
 * Geocode a Madrid venue. `address` (when available) geocodes much better
 * than a club name. Returns undefined when nothing was found.
 */
export async function geocodeVenue(
  name: string | undefined,
  address?: string,
): Promise<Coords | undefined> {
  const label = (name ?? "").trim();
  if (!label && !address) return undefined;
  const key = `${label}|${address ?? ""}`.toLowerCase();
  if (key in cache) return cache[key] ?? undefined;

  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const query = [address, label, "Madrid", "Spain"].filter(Boolean).join(", ");
  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MadridPartyCalendarCrawler/1.0 (event calendar; contact via GitHub repo)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = hits?.[0];
    const value = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
    cache[key] = value;
    dirty = true;
    return value ?? undefined;
  } catch (error) {
    // Network hiccups are not cached as "not found" — retry next crawl.
    console.warn(`  [geocode] failed for "${label}": ${error instanceof Error ? error.message : error}`);
    return undefined;
  } finally {
    persist();
  }
}
