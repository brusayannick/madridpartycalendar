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
    "\\bbackstage\\b",
  ].join("|"),
  "i",
);

/** Gender-specific tier names (guest lists, "CHICAS GRATIS", "GIRLS LIST"…). */
const FEMALE_RE =
  /\b(chicas?|girls?|women|female|se\u00f1oritas?|senoritas?|damas?|mujeres?|ladies)\b/i;
const MALE_RE = /\b(chicos?|boys?|men|male|hombres?|caballeros?|gentlemen)\b/i;

const FREE_RE = /\bfree\b|entrada\s*libre|gratis/i;

/**
 * Tiers that are announcements, not sellable tickets — e.g. PATT promoters
 * add "TICKET SALES OPEN THURSDAY … AT 18:00!" as a price-0 display row.
 * Dropped from price resolution (parsed as sale info by the crawler instead).
 */
export const SALE_INFO_RE = /sales?\s+open|tickets?\s+open|opens?\s+on\s+(mon|tue|wed|thu|fri|sat|sun)/i;

// Marker for early/first-release tiers, kept for future per-tier display.
export const EARLY_RE =
  /\b(early\s*bird|first\s*release|second\s*release|third\s*release|pre-?sale|advance|early)\b/i;

export interface ResolvedPrices {
  /** Default (any gender): cheapest/most expensive across all kept tiers. */
  early: number | null;
  normal: number | null;
  /** Men: neutral ∪ male tiers; null when no gender-specific tiers exist. */
  maleEarly: number | null;
  maleNormal: number | null;
  /** Women: neutral ∪ female tiers; null when no gender-specific tiers exist. */
  femaleEarly: number | null;
  femaleNormal: number | null;
}

/**
 * Resolve tiers → price pairs.
 *
 * - Tiers with excluded names (VIP/tables/bottles/passes/backstage) are dropped.
 * - Free entry (price 0) wins as the cheapest tier.
 * - early = cheapest kept tier, normal = most expensive kept tier.
 * - Gender-specific tiers ("GIRLS LIST (FREE BEFORE 1:00AM)", "CHICOS GRATIS")
 *   only apply to their gender: male/female prices are computed from the
 *   neutral tiers plus that gender's tiers.
 */
export function resolvePrices(tiers: PriceTier[]): ResolvedPrices {
  const kept = tiers
    .filter((t) => t.name == null || (!EXCLUDE_RE_.test(t.name) && !SALE_INFO_RE.test(t.name)))
    .map((t) => ({ ...t, price: t.price ?? (FREE_RE.test(t.name ?? "") ? 0 : null) }))
    .filter((t): t is PriceTier & { price: number } => t.price != null);

  const resolve = (
    set: Array<PriceTier & { price: number }>,
  ): { early: number | null; normal: number | null } => {
    if (set.length === 0) return { early: null, normal: null };
    const free = set.find((t) => t.price === 0);
    if (free) {
      const rest = set.filter((t) => t.price > 0);
      return { early: 0, normal: rest.length ? Math.max(...rest.map((t) => t.price)) : 0 };
    }
    const prices = set.map((t) => t.price);
    const early = Math.min(...prices);
    let normal = Math.max(...prices);
    // Phases can be listed out of order — never present early above normal.
    if (normal < early) normal = early;
    return { early, normal };
  };

  const overall = resolve(kept);

  const isFemale = (t: PriceTier) => t.name != null && FEMALE_RE.test(t.name) && !MALE_RE.test(t.name);
  const isMale = (t: PriceTier) => t.name != null && MALE_RE.test(t.name) && !FEMALE_RE.test(t.name);
  const gendered = kept.filter((t) => isFemale(t) || isMale(t));

  if (gendered.length === 0) {
    return { ...overall, maleEarly: null, maleNormal: null, femaleEarly: null, femaleNormal: null };
  }

  const neutral = kept.filter((t) => !isFemale(t) && !isMale(t));
  const male = resolve([...neutral, ...kept.filter(isMale)]);
  const female = resolve([...neutral, ...kept.filter(isFemale)]);
  return {
    ...overall,
    maleEarly: male.early,
    maleNormal: male.normal,
    femaleEarly: female.early,
    femaleNormal: female.normal,
  };
}

/** Collapse "7 – 39" listing ranges when no named tiers are available. */
export function pricesFromRange(min: number | null, max: number | null): ResolvedPrices {
  return {
    early: min,
    normal: max ?? min,
    maleEarly: null,
    maleNormal: null,
    femaleEarly: null,
    femaleNormal: null,
  };
}
