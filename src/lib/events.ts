/** Shared event types + display helpers (web app side). */

export interface EventRow {
  id: string;
  source: string;
  external_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  url: string;
  image_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  gmaps_url: string | null;
  city: string;
  genres: string[];
  price_early: number | null;
  price_normal: number | null;
  price_early_male: number | null;
  price_normal_male: number | null;
  price_early_female: number | null;
  price_normal_female: number | null;
  tickets_sale_at: string | null;
  tickets_sale_note: string | null;
  currency: string;
}

/** Selected audience for price display/filtering. */
export type Gender = "any" | "female" | "male";

export const SOURCE_META: Record<string, { label: string; dot: string }> = {
  nightlifemadrid: { label: "Nightlife Madrid", dot: "#22d3ee" },
  patt_firstcircle: { label: "First Circle", dot: "#a78bfa" },
  erasmusmadrid: { label: "Erasmus Madrid", dot: "#fb7185" },
  esnupm: { label: "ESN UPM", dot: "#fbbf24" },
  whan: { label: "Whan", dot: "#34d399" },
  fourvenues_erasmustouch: { label: "Erasmus Touch", dot: "#60a5fa" },
};

export function sourceMeta(source: string) {
  return SOURCE_META[source] ?? { label: source, dot: "#94a3b8" };
}

const TZ = "Europe/Madrid";

/** "2026-09-05" for a UTC ISO string, in Madrid time. */
export function dateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** "23:00" */
export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Sat 5 Sep" */
export function dayLabel(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${key}T12:00:00Z`));
}

/**
 * "Thu 3 Sep, 18:00" for an upcoming ticket-sale start; null when sales are
 * already open (start in the past) or not announced. Falls back to a raw note
 * when the source announced sales in prose we could not parse.
 */
export function saleOpensLabel(e: EventRow, now = Date.now()): string | null {
  if (!e.tickets_sale_at) return e.tickets_sale_note ?? null;
  const at = new Date(e.tickets_sale_at);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Price pair for the selected audience; falls back to the default pair. */
export function effectivePrices(
  e: EventRow,
  gender: Gender = "any",
): { early: number | null; normal: number | null } {
  if (gender === "female" && e.price_early_female != null) {
    return { early: e.price_early_female, normal: e.price_normal_female };
  }
  if (gender === "male" && e.price_early_male != null) {
    return { early: e.price_early_male, normal: e.price_normal_male };
  }
  return { early: e.price_early, normal: e.price_normal };
}

export function effectiveMinPrice(e: EventRow, gender: Gender = "any"): number | null {
  const { early, normal } = effectivePrices(e, gender);
  if (early != null) return early;
  return normal;
}

export function isFree(e: EventRow, gender: Gender = "any"): boolean {
  return effectiveMinPrice(e, gender) === 0;
}

/** Compact price for cards: "Free", "18€", "7–15€". */
export function priceLabel(e: EventRow, gender: Gender = "any"): string {
  const { early, normal } = effectivePrices(e, gender);
  if (early == null && normal == null) return "—";
  if (early === 0) return "Free";
  if (early == null) return `${normal}€`;
  if (normal == null || normal === early) return `${early}€`;
  return `${early}–${normal}€`;
}

export const PRICE_BUCKETS = [
  { id: "free", label: "Free", test: (min: number) => min === 0 },
  { id: "u10", label: "≤ 10€", test: (min: number) => min > 0 && min <= 10 },
  { id: "10-20", label: "10–20€", test: (min: number) => min > 10 && min <= 20 },
  { id: "20+", label: "20€+", test: (min: number) => min > 20 },
] as const;

export type PriceBucketId = (typeof PRICE_BUCKETS)[number]["id"];

export interface Filters {
  genres: Set<string>;
  priceBuckets: Set<PriceBucketId>;
  sources: Set<string>;
  gender: Gender;
}

export function emptyFilters(): Filters {
  return { genres: new Set(), priceBuckets: new Set(), sources: new Set(), gender: "any" };
}

export function activeFilterCount(f: Filters): number {
  return (
    f.genres.size + f.priceBuckets.size + f.sources.size + (f.gender === "any" ? 0 : 1)
  );
}

export function applyFilters(events: EventRow[], f: Filters): EventRow[] {
  if (activeFilterCount(f) === 0) return events;
  return events.filter((e) => {
    if (f.sources.size > 0 && !f.sources.has(e.source)) return false;
    if (f.genres.size > 0 && !e.genres.some((g) => f.genres.has(g))) return false;
    if (f.priceBuckets.size > 0) {
      const min = effectiveMinPrice(e, f.gender);
      if (min == null) return false;
      if (![...f.priceBuckets].some((id) => PRICE_BUCKETS.find((b) => b.id === id)!.test(min))) {
        return false;
      }
    }
    return true;
  });
}

/** Events grouped by Madrid date key, sorted. */
export function groupByDay(events: EventRow[]): Map<string, EventRow[]> {
  const map = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = dateKey(e.starts_at);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }
  return map;
}
