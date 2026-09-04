/**
 * EntryOS crawler (app.entry-os.com/en-GB/events).
 *
 * The Discover page is an SPA whose infinite scroll is backed by a public,
 * unauthenticated JSON API (found via the page's own network traffic):
 *
 *   GET https://api.entry-os.com/v1/events?limit=50[&cursor=<last id>]
 *       → { data: [ { id, publicCode, name, startAtUtc, endAtUtc, timezone,
 *             venue: { name, address: { line1, city, state, postalCode,
 *             country } }, genres: [{ name }], assets: [{ assetUrl }],
 *             priceFrom (minor units), currency, ... } ],
 *           nextCursor: "<id>" | null }
 *
 * We follow `nextCursor` until exhausted (the cursor replaces scrolling).
 *
 * The list has no street address when `venue` is null, and Madrid venues
 * often report the district as city (e.g. city "Salamanca", state "Madrid"),
 * so Madrid filtering needs the per-event detail, which is also public:
 *
 *   GET https://api.entry-os.com/v1/events/{publicCode}
 *       → + description, address, lineup, ticketTiers[] (price minor units),
 *           ticketsOnSaleAt, status/visibility/isArchived
 *
 * Detail is only fetched for candidates (Spanish address, Europe/Madrid
 * timezone, or missing venue address — the full list is small). Tables are
 * skipped (VIP/table upsells); on-sale ticket tiers map to PriceTier.
 * Public event page: https://app.entry-os.com/en-GB/events/{publicCode}
 */
import { fetchJson } from "../lib/http";
import { htmlToText } from "../lib/time";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";

const API = "https://api.entry-os.com/v1";
const PAGE_LIMIT = 50;
const DELAY_MS = 350;

interface EntryAddress {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface EntryListItem {
  id: string;
  publicCode?: string;
  name?: string;
  startAtUtc?: string;
  endAtUtc?: string;
  timezone?: string;
  venue?: { name?: string | null; address?: EntryAddress | null } | null;
  venueName?: string | null;
  genres?: Array<{ name?: string }> | null;
  assets?: Array<{ assetUrl?: string }> | null;
  priceFrom?: number | null;
  currency?: string | null;
  ticketsOnSaleAt?: string | null;
}

interface EntryDetail extends EntryListItem {
  description?: string | null;
  ageLimit?: string | null;
  dressCode?: string | null;
  address?: EntryAddress | null;
  lineup?: Array<{ name?: string }> | null;
  status?: string;
  visibility?: string;
  isArchived?: boolean;
  salePhase?: string | null;
  ticketTiers?: Array<{
    name?: string | null;
    price?: number | null;
    onSale?: boolean;
    salesStartAt?: string | null;
  }> | null;
}

/** List-level pre-filter: keep anything that could plausibly be Madrid so the
 *  detail endpoint can decide precisely. The list is small; London rows (with
 *  a GB venue address) are skipped without a detail fetch. */
function isCandidate(item: EntryListItem): boolean {
  const country = item.venue?.address?.country;
  if (country === "ES") return true;
  if (!item.venue?.address) return true; // no address on list — verify via detail
  if (item.timezone === "Europe/Madrid") return true;
  return false;
}

/** Detail-level Madrid check. Madrid venues often put the district in `city`
 *  ("Salamanca") with state "Madrid" (or "MD"), so match state/city/street
 *  or a 28xxx postcode — but always within Spain. */
function isMadridAddress(address: EntryAddress | null | undefined): boolean {
  if (!address) return false;
  if (address.country !== "ES") return false;
  const text = [address.city, address.state, address.line1].filter(Boolean).join(" ");
  if (/madrid/i.test(text)) return true;
  if ((address.state ?? "").trim().toUpperCase() === "MD") return true;
  if (/^28\d{3}$/.test((address.postalCode ?? "").trim())) return true;
  return false;
}

export const entryos: SiteCrawler = {
  id: "entryos",
  label: "EntryOS",
  async run(): Promise<CrawlerEvent[]> {
    const out: CrawlerEvent[] = [];

    // 1) Walk the whole public listing via cursor pagination (replaces scroll).
    const items: EntryListItem[] = [];
    let cursor: string | null | undefined;
    for (;;) {
      const url = `${API}/events?limit=${PAGE_LIMIT}${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetchJson<{ data?: EntryListItem[]; nextCursor?: string | null }>(url);
      items.push(...(res.data ?? []));
      cursor = res.nextCursor;
      if (!cursor) break;
      await sleep(DELAY_MS);
    }

    // 2) Detail + map the Madrid candidates.
    for (const item of items) {
      if (!item.id || !item.name || !item.startAtUtc) continue;
      if (!isCandidate(item)) continue;
      const code = item.publicCode ?? item.id;

      await sleep(DELAY_MS);
      let detail: EntryDetail;
      try {
        detail = await fetchJson<EntryDetail>(`${API}/events/${code}`);
      } catch (error) {
        console.warn(
          `  [entryos] detail failed for ${item.name}: ${error instanceof Error ? error.message : error}`,
        );
        continue;
      }
      if (detail.isArchived) continue;
      if (!detail.name || !detail.startAtUtc) continue;
      if (detail.status && detail.status !== "approved") continue;
      if (detail.visibility && detail.visibility !== "public") continue;
      // Madrid only — the platform also sells London/Barcelona/Ibiza nights.
      if (!isMadridAddress(detail.address)) continue;

      const startsAt = new Date(detail.startAtUtc).toISOString();
      const endsAt = detail.endAtUtc ? new Date(detail.endAtUtc).toISOString() : undefined;

      // Ticket tiers (minor units → EUR); tables/bundles are VIP upsells.
      const currency = detail.currency ?? "EUR";
      const tiers: PriceTier[] = [];
      let saleFrom: string | null = null;
      for (const tier of detail.ticketTiers ?? []) {
        if (tier.price == null) continue;
        if (tier.onSale === false) continue;
        tiers.push({
          name: tier.name?.trim() || "Ticket",
          price: tier.price / 100,
          currency,
        });
        if (tier.salesStartAt && (saleFrom == null || tier.salesStartAt < saleFrom)) {
          saleFrom = tier.salesStartAt;
        }
      }
      if (tiers.length === 0 && detail.priceFrom != null) {
        tiers.push({ name: "From", price: detail.priceFrom / 100, currency });
      }

      const lineup = (detail.lineup ?? []).map((l) => l?.name?.trim()).filter(Boolean);
      const extras = [
        detail.ageLimit ? `${detail.ageLimit} event.` : "",
        detail.dressCode ? `Dress code: ${detail.dressCode}.` : "",
        lineup.length > 0 ? `Line-up: ${lineup.join(", ")}.` : "",
      ].filter(Boolean);
      const description = htmlToText(
        [detail.description ?? "", ...extras].filter(Boolean).join("\n\n"),
      );

      const address = detail.address;
      const venueAddress = address
        ? [address.line1, address.postalCode, address.city].filter(Boolean).join(", ") || undefined
        : undefined;

      out.push({
        source: "entryos",
        externalId: code,
        title: detail.name.trim(),
        description,
        startsAt,
        endsAt,
        url: `https://app.entry-os.com/en-GB/events/${code}`,
        imageUrl: (detail.assets ?? []).find((a) => a.assetUrl)?.assetUrl ?? undefined,
        venueName: detail.venue?.name?.trim() || detail.venueName?.trim() || undefined,
        venueAddress,
        city: "Madrid",
        genres: ((detail.genres ?? item.genres ?? []).map((g) => g.name?.trim()).filter(Boolean) as string[]),
        tiers,
        ticketsSaleAt: saleFrom ? new Date(saleFrom).toISOString() : undefined,
        currency,
        raw: { id: detail.id, priceFrom: detail.priceFrom, salePhase: detail.salePhase },
      });
    }
    return out;
  },
};
