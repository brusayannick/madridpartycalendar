/**
 * Ticket tier classification.
 *
 * Goal per product decision: keep "normal / early bird" entry prices and drop
 * upsell junk (VIP, tables, bottles, DJ tables, merch bundles…).
 */
import type { PriceTier } from "./types";

/** Tier names we refuse to import as the event's price. */
const EXCLUDE_RE_ = new RegExp(
  [
    "\\bvip\\b",
    "\\btable?s?\\b",
    "\\bbott?les?\\b",
    "\\bbotella(s)?\\b",
    "\\bmesa(s)?\\b",
    "\\breservad[ao]\\b",
    "\\bdj\\s*table\\b",
    "\\bpremium\\b",
    "\\bmerch\\b",
    "\\bt-?shirt\\b",
    "\\bunlimited\\s+pass\\b",
    "\\bmembership\\b",
    "\\bmonthly\\b",
    "\\bweekly\\s+pass\\b",
    "\\bpack(age)?\\b",
  ].join("|"),
  "i",
);

const FREE_RE = /\bfree\b|entrada\s*libre|gratis/i;

// Marker for early/first-release tiers, kept for future per-tier display.
export const EARLY_RE =
  /\b(early\s*bird|first\s*release|second\s*release|third\s*release|pre-?sale|advance|early)\b/i;

export interface ResolvedPrices {
  early: number | null;
  normal: number | null;
}

/**
 * Resolve tiers → (priceEarly, priceNormal).
 *
 * - Tiers with excluded names (VIP/tables/bottles/passes) are dropped.
 * - Free entry (price 0) wins as the cheapest tier.
 * - priceEarly = cheapest kept tier (the early-bird/first release).
 * - priceNormal = most expensive kept tier (the late/door price).
 */
export function resolvePrices(tiers: PriceTier[]): ResolvedPrices {
  const kept = tiers
    .filter((t) => t.name == null || !EXCLUDE_RE_.test(t.name))
    .map((t) => ({ ...t, price: t.price ?? (FREE_RE.test(t.name ?? "") ? 0 : null) }))
    .filter((t): t is PriceTier & { price: number } => t.price != null);

  if (kept.length === 0) return { early: null, normal: null };

  const free = kept.find((t) => t.price === 0);
  if (free) {
    const rest = kept.filter((t) => t.price > 0);
    return { early: 0, normal: rest.length ? Math.max(...rest.map((t) => t.price)) : 0 };
  }

  const prices = kept.map((t) => t.price);
  const early = Math.min(...prices);
  let normal = Math.max(...prices);
  // Phases can be listed out of order (e.g. "First Release" 25 above a 20
  // private tier) — never present an early price above the normal one.
  if (normal < early) normal = early;

  return { early, normal };
}

/** Collapse "7 – 39" listing ranges when no named tiers are available. */
export function pricesFromRange(min: number | null, max: number | null): ResolvedPrices {
  return { early: min, normal: max ?? min };
}
