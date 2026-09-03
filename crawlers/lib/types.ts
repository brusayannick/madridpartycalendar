/**
 * Shared contract every site crawler implements.
 *
 * A crawler returns raw-but-normalized events; generic post-processing
 * (Madrid filter, price tier resolution, genre normalization, gmaps link)
 * lives in crawlers/lib/* so each site module stays thin.
 */

export interface PriceTier {
  /** Tier name exactly as sold, e.g. "First Release - Fast Pass + 1 Drink". */
  name: string;
  /** Price in major units (EUR). 0 = free entry. null = "pay at door"/unknown. */
  price: number | null;
  currency?: string;
}

export interface CrawlerEvent {
  /** Crawler id, e.g. 'nightlifemadrid' — matches the `source` DB column. */
  source: string;
  /** Stable id for the event within its source (used for upsert dedup). */
  externalId: string;
  title: string;
  /** Plain text (HTML stripped), reasonably trimmed. */
  description?: string;
  /** ISO 8601 with timezone offset, e.g. 2026-09-05T23:00:00+02:00. */
  startsAt: string;
  endsAt?: string;
  /** Public event/ticket page. */
  url: string;
  imageUrl?: string;
  venueName?: string;
  venueAddress?: string;
  /** Google Maps deep link; built by finalize() when missing. */
  gmapsUrl?: string;
  city?: string;
  genres: string[];
  /** Raw ticket tiers; resolved to prices by resolvePrices(). */
  tiers?: PriceTier[];
  priceEarly?: number | null;
  priceNormal?: number | null;
  /** Male/female prices when gender-specific tiers exist (guest lists). */
  priceEarlyMale?: number | null;
  priceNormalMale?: number | null;
  priceEarlyFemale?: number | null;
  priceNormalFemale?: number | null;
  /** When ticket sales open, if the source announces it (ISO). */
  ticketsSaleAt?: string;
  /** Raw sale-announcement text when a date could not be parsed. */
  ticketsSaleNote?: string;
  currency: string;
  /** Original payload kept in the `raw` column for debugging. */
  raw?: unknown;
}

export interface SiteCrawler {
  id: string;
  label: string;
  run(): Promise<CrawlerEvent[]>;
}

/** Helpers shared with the web app. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
