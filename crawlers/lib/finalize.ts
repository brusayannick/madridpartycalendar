/**
 * Final post-processing applied to every crawler's output before it hits the
 * DB: Madrid-only filter, future-only filter, price resolution, genre
 * normalization/inference, gmaps link, and venue geocoding for map views.
 * Site modules stay dumb extractors.
 */
import type { CrawlerEvent } from "./types";
import { resolvePrices } from "./priceTiers";
import { normalizeGenres, inferGenres } from "./genres";
import { gmapsUrl } from "./gmaps";
import {
  coordsFromGmapsUrl,
  coordsFromShortGmapsUrl,
  geocodeVenue,
  looksLikeAddress,
} from "./geocode";

const MADRID_RE = /\bmadrid\b/i;

/**
 * Pull a street address out of free-text descriptions. Providers often put
 * the real address in the description ("📍 WHERE: C. de las Huertas, 41",
 * "C. de Coslada, 14, Salamanca, 28028 Madrid") while venueName holds a
 * nickname. Returns the address fragment or undefined.
 */
export function extractAddressFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // Explicit "WHERE …" line, up to a newline.
  const where = text.match(/(?:WHERE|DÓNDE|DONDE|LUGAR)[:\s]+([^\n]{8,120})/i);
  if (where && looksLikeAddress(where[1])) return where[1].trim().replace(/[.,;]+$/, "");
  // Any fragment with a Madrid postcode.
  const postcode = text.match(/((?:Calle|C\.|Avda?\.?|Plaza|Paseo|Travesía)[^,\n]{0,60},\s*\d[^,\n]{0,40}280\d\d[^,\n]{0,40})/i);
  if (postcode) return postcode[1].trim();
  // Street + number without postcode ("C. de las Huertas, 41").
  const street = text.match(/((?:Calle|C\.|Avda?\.?|Plaza|Paseo)\s+[^\n,]{3,50},\s*\d+[^\n,]{0,20})/i);
  if (street) return street[1].trim();
  return undefined;
}

function isMadrid(event: CrawlerEvent): boolean {
  if (!event.city) return true; // Source is Madrid-focused; only reject explicit elsewhere.
  const city = Array.isArray(event.city) ? event.city.join(",") : event.city;
  return MADRID_RE.test(String(city));
}

export async function finalizeEvents(events: CrawlerEvent[]): Promise<CrawlerEvent[]> {
  const now = Date.now() - 24 * 60 * 60 * 1000; // keep events that started < 24h ago

  const out: CrawlerEvent[] = [];
  for (const e of events.filter((e) => e.title && e.startsAt && e.url).filter(isMadrid)) {
    if (new Date(e.startsAt).getTime() < now) continue;

    const prices = e.tiers?.length
      ? resolvePrices(e.tiers)
      : {
          early: e.priceEarly ?? null,
          normal: e.priceNormal ?? null,
          maleEarly: null,
          maleNormal: null,
          femaleEarly: null,
          femaleNormal: null,
        };
    let genres = normalizeGenres(e.genres);
    if (genres.length === 0) genres = inferGenres(e.title, e.description);

    // Coordinates: prefer exact ones from the source (e.g. Whan gmaps link),
    // otherwise resolve short links, otherwise geocode the venue once (cached).
    // venueAddress falls back to an address parsed from the description —
    // several providers keep nicknames in `location` and the street in text.
    let { latitude, longitude } = e;
    const venueAddress = e.venueAddress ?? extractAddressFromText(e.description);
    if (latitude == null || longitude == null) {
      const coords =
        coordsFromGmapsUrl(e.gmapsUrl) ??
        (await coordsFromShortGmapsUrl(e.gmapsUrl)) ??
        (await geocodeVenue(e.venueName, venueAddress));
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    out.push({
      ...e,
      city: "Madrid",
      venueAddress: venueAddress ?? e.venueAddress,
      priceEarly: prices.early,
      priceNormal: prices.normal,
      priceEarlyMale: prices.maleEarly,
      priceNormalMale: prices.maleNormal,
      priceEarlyFemale: prices.femaleEarly,
      priceNormalFemale: prices.femaleNormal,
      genres,
      gmapsUrl: e.gmapsUrl ?? gmapsUrl(e.venueName),
      latitude,
      longitude,
    });
  }
  return out;
}
