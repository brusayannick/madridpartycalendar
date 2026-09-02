/**
 * Final post-processing applied to every crawler's output before it hits the
 * DB: Madrid-only filter, future-only filter, price resolution, genre
 * normalization/inference, gmaps link. Site modules stay dumb extractors.
 */
import type { CrawlerEvent } from "./types";
import { resolvePrices } from "./priceTiers";
import { normalizeGenres, inferGenres } from "./genres";
import { gmapsUrl } from "./gmaps";

const MADRID_RE = /\bmadrid\b/i;

function isMadrid(event: CrawlerEvent): boolean {
  if (!event.city) return true; // Source is Madrid-focused; only reject explicit elsewhere.
  const city = Array.isArray(event.city) ? event.city.join(",") : event.city;
  return MADRID_RE.test(String(city));
}

export function finalizeEvents(events: CrawlerEvent[]): CrawlerEvent[] {
  const now = Date.now() - 24 * 60 * 60 * 1000; // keep events that started < 24h ago

  return events
    .filter((e) => e.title && e.startsAt && e.url)
    .filter(isMadrid)
    .filter((e) => new Date(e.startsAt).getTime() >= now)
    .map((e) => {
      const prices = e.tiers?.length ? resolvePrices(e.tiers) : { early: e.priceEarly ?? null, normal: e.priceNormal ?? null };
      let genres = normalizeGenres(e.genres);
      if (genres.length === 0) genres = inferGenres(e.title, e.description);
      return {
        ...e,
        city: "Madrid",
        priceEarly: prices.early,
        priceNormal: prices.normal,
        genres,
        gmapsUrl: e.gmapsUrl ?? gmapsUrl(e.venueName),
      };
    });
}
