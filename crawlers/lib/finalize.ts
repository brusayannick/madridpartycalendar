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
import { coordsFromGmapsUrl, geocodeVenue } from "./geocode";

const MADRID_RE = /\bmadrid\b/i;

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
    // otherwise geocode the venue once (cached).
    let { latitude, longitude } = e;
    if (latitude == null || longitude == null) {
      const coords =
        coordsFromGmapsUrl(e.gmapsUrl) ??
        (await geocodeVenue(e.venueName, e.venueAddress));
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    out.push({
      ...e,
      city: "Madrid",
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
