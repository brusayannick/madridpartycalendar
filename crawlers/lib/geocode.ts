/**
 * Venue geocoding via Nominatim (OpenStreetMap) — used by the crawlers to
 * attach coordinates to events so the web app can show maps.
 *
 * - Results (including "not found" nulls) are cached in crawlers/.geocache.json
 *   so repeat crawls don't re-query.
 * - Strictly rate-limited to ~1 request/second per Nominatim usage policy.
 * - Venue names from providers are noisy ("Manama NL", "LA FLACA | TARDEO",
 *   ALL-CAPS, misspellings) so names are normalized and several query
 *   variants are tried before giving up.
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

/**
 * Extract coords from Google Maps links. Handles:
 * - …/@40.4187,-3.7053,17z… (share links)
 * - …!3d40.4187!4d-3.7053… (embedded place data in /place/ URLs)
 * - ?query=40.4187,-3.7053 (search links with raw coords)
 */
export function coordsFromGmapsUrl(url: string | undefined): Coords | undefined {
  if (!url) return undefined;
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  const embedded = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (embedded) {
    const lat = Number(embedded[1]);
    const lng = Number(embedded[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  const query = url.match(/[?&](?:query|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (query) {
    const lat = Number(query[1]);
    const lng = Number(query[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return undefined;
}

/** True for goo.gl / maps.app.goo.gl short links (no coords in the URL itself). */
export function isShortGmapsUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /goo\.gl|maps\.app\.goo\.gl/.test(url);
}

/**
 * Resolve a goo.gl short link by following redirects, then parse coords
 * from the destination URL. Returns undefined on any failure (consent
 * walls, network issues) — callers fall back to geocoding.
 */
export async function coordsFromShortGmapsUrl(url: string | undefined): Promise<Coords | undefined> {
  if (!url || !isShortGmapsUrl(url)) return undefined;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MadridPartyCalendarCrawler/1.0 (event calendar)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    // response.url is the final URL after redirects.
    return coordsFromGmapsUrl(res.url);
  } catch {
    return undefined;
  }
}

/** Query aliases for venues Nominatim can't find under their listed name. */
const VENUE_ALIASES: Array<{ match: RegExp; queries: string[] }> = [
  // Not in OSM under its name — but the street address geocodes fine.
  { match: /^houdinni$/i, queries: ["Houdini Club Madrid", "Calle de Serrano 41, Madrid, Spain"] },
  { match: /^manama/i, queries: ["Sala Manama, Madrid"] },
  { match: /^icon$/i, queries: ["Icon Club Madrid, Calle de Toledo"] },
  { match: /^rubicon$/i, queries: ["Rubicon Madrid", "Calle del Cid 7, Madrid, Spain"] },
  { match: /^la flaca/i, queries: ["La Flaca Madrid", "Calle de Serrano 43, Madrid, Spain"] },
  { match: /^irreverente/i, queries: ["Irreverente Madrid", "Calle de Sagasta 22, Madrid, Spain"] },
  { match: /^autocine.*race/i, queries: ["Autocine Madrid"] },
  { match: /tu bar de copas|\(tbc\)/i, queries: ["Tu Bar de Copas, Calle de las Huertas 41, Madrid"] },
  { match: /^okume pub$/i, queries: ["Okume Pub, Calle de Coslada 14, Madrid"] },
  { match: /^casa suecia/i, queries: ["Casa Suecia, Calle del Marqués de Casa Riera 4, Madrid"] },
  { match: /^saint club/i, queries: ["Saint Club Madrid"] },
  { match: /^salvaje$/i, queries: ["Salvaje Club, Madrid"] },
  { match: /^villa panthera/i, queries: ["Panthera Club, Madrid"] },
];

/** Looks like a street address rather than a venue name. */
export function looksLikeAddress(text: string): boolean {
  return /\d/.test(text) && /(calle|c\/\.?|avenida|av\.?|plaza|paseo|p\.º|traves|280\d\d|madrid)/i.test(text);
}

/**
 * Normalize a noisy provider venue name for geocoding:
 * - "Manama NL" → "Manama" (promoter suffix)
 * - "LA FLACA | TARDEO" → "LA FLACA"
 * - "Tu Bar de Copas (TBC)" → "Tu Bar de Copas"
 * - ALL-CAPS → Title Case (Nominatim handles lowercase better)
 */
export function normalizeVenueName(name: string | undefined): string {
  let s = (name ?? "").trim();
  if (!s) return "";
  // Promoter suffix ("Manama NL", "Calle 365 NL").
  s = s.replace(/\s+NL\s*$/i, "").trim();
  // Pipe suffixes ("LA FLACA | TARDEO", "Macera | Tardes").
  s = s.split("|")[0].trim();
  // Parenthetical nicknames ("Tu Bar de Copas (TBC)" → keep base; alias table
  // maps the full string too, but the base geocodes better on its own).
  s = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  // ALL-CAPS → Title Case.
  if (s.length > 3 && s === s.toUpperCase()) {
    s = s.toLowerCase().replace(/(?:^|\s|[-(["'])(\p{L})/gu, (m) => m.toUpperCase());
  }
  return s;
}

/** Build query variants, most-specific first. */
function buildQueries(name: string, address?: string): string[] {
  const queries: string[] = [];
  const clean = normalizeVenueName(name);
  // If the "name" is actually an address, lead with it as the address.
  const addr = address?.trim() || (looksLikeAddress(clean) ? clean : undefined);

  if (addr && clean && !looksLikeAddress(clean)) {
    queries.push(`${addr}, ${clean}, Madrid, Spain`);
    queries.push(`${clean}, ${addr}, Madrid, Spain`);
  }
  if (addr) queries.push(`${addr}${/madrid/i.test(addr) ? "" : ", Madrid"}, Spain`);
  if (clean && !looksLikeAddress(clean)) {
    queries.push(`${clean}, Madrid, Spain`);
    for (const { match, queries: aliasQueries } of VENUE_ALIASES) {
      if (match.test(name ?? "") || match.test(clean)) {
        queries.push(...aliasQueries);
        break;
      }
    }
    // Last resort: nudge Nominatim towards nightlife venues.
    if (!/discoteca|sala|club/i.test(clean)) {
      queries.push(`Discoteca ${clean}, Madrid, Spain`);
    }
  }
  return [...new Set(queries)];
}

/** Rough Madrid-metro bounding box — rejects same-named venues elsewhere. */
const MADRID_BBOX = { minLat: 40.1, maxLat: 40.75, minLng: -4.1, maxLng: -3.4 };

function inMadrid(c: Coords): boolean {
  return c.lat >= MADRID_BBOX.minLat && c.lat <= MADRID_BBOX.maxLat && c.lng >= MADRID_BBOX.minLng && c.lng <= MADRID_BBOX.maxLng;
}

async function nominatim(query: string): Promise<Coords | undefined> {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=es` +
    `&viewbox=${MADRID_BBOX.minLng},${MADRID_BBOX.maxLat},${MADRID_BBOX.maxLng},${MADRID_BBOX.minLat}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "MadridPartyCalendarCrawler/1.0 (event calendar; contact via GitHub repo)",
      "Accept-Language": "en",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
  // Prefer hits inside the Madrid metro area — Nominatim often ranks a
  // same-named street elsewhere in Spain first.
  const ordered = [...hits].sort((a, b) => {
    const ai = inMadrid({ lat: Number(a.lat), lng: Number(a.lon) }) ? 0 : 1;
    const bi = inMadrid({ lat: Number(b.lat), lng: Number(b.lon) }) ? 0 : 1;
    return ai - bi;
  });
  const hit = ordered[0];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : undefined;
}

/**
 * Geocode a Madrid venue. `address` (when available) geocodes much better
 * than a club name. Tries several normalized query variants before giving
 * up. Returns undefined when nothing was found.
 */
export async function geocodeVenue(
  name: string | undefined,
  address?: string,
): Promise<Coords | undefined> {
  const label = (name ?? "").trim();
  if (!label && !address) return undefined;
  const key = `${label}|${address ?? ""}`.toLowerCase();
  if (key in cache) return cache[key] ?? undefined;

  try {
    for (const query of buildQueries(label, address)) {
      try {
        const coords = await nominatim(query);
        if (coords && inMadrid(coords)) {
          cache[key] = coords;
          dirty = true;
          return coords;
        }
      } catch (error) {
        console.warn(`  [geocode] query failed for "${query}": ${error instanceof Error ? error.message : error}`);
      }
    }
    cache[key] = null;
    dirty = true;
    return undefined;
  } catch (error) {
    // Network hiccups are not cached as "not found" — retry next crawl.
    console.warn(`  [geocode] failed for "${label}": ${error instanceof Error ? error.message : error}`);
    return undefined;
  } finally {
    persist();
  }
}
