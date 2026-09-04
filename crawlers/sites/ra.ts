/**
 * Resident Advisor crawler — Madrid only (RA area 41).
 *
 * ra.co event pages sit behind a DataDome challenge (plain GETs 403), but
 * the site's own frontend reads a public GraphQL endpoint that needs no
 * auth, cookies or login — just browser-origin headers:
 *
 *   POST https://ra.co/graphql
 *   { query: "query GET_EVENT_LISTINGS($filters: FilterInputDtoInput,
 *              $pageSize: Int, $page: Int) { eventListings(...) {...} }",
 *     variables: { filters: { areas: { eq: 41 },
 *                  listingDate: { gte: "YYYY-MM-DD", lte: "YYYY-MM-DD" } },
 *                  pageSize: 50, page: N } }
 *
 * Pagination replaces the site's infinite scroll: loop `page` until the
 * collected rows reach `totalResults`. The date range is capped at ~93 days
 * per query, so we walk forward in windows.
 *
 * Per event we get: title, date/startTime/endTime (venue-local wall time),
 * venue + address + coords, artists, genres, cost (single price string),
 * flyer images and the canonical contentUrl. Prices are single values, not
 * tiered releases — mapped to one tier so `resolvePrices` yields early=normal.
 * Public event page: https://ra.co/events/{id}
 */
import { fetchJson } from "../lib/http";
import { htmlToText, parsePrice, toIsoString } from "../lib/time";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";

const GRAPHQL = "https://ra.co/graphql";
const MADRID_AREA_ID = 41;
const PAGE_SIZE = 50;
const AHEAD_DAYS = 90;
const WINDOW_DAYS = 45;
const DELAY_MS = 400;
// Browser-origin headers — without these the endpoint rejects the call.
const HEADERS = {
  "Content-Type": "application/json",
  Origin: "https://ra.co",
  Referer: "https://ra.co/events",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

const QUERY = `
query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
    data {
      id
      listingDate
      event {
        id
        title
        date
        startTime
        endTime
        content
        contentUrl
        cost
        attending
        minimumAge
        venue {
          name
          address
          contentUrl
          location { latitude longitude }
          area { name }
        }
        artists { name }
        genres { name }
        images { filename }
      }
    }
    totalResults
  }
}`;

interface RaListing {
  id?: string;
  listingDate?: string;
  event?: {
    id?: string;
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    content?: string | null;
    contentUrl?: string | null;
    cost?: string | number | null;
    venue?: {
      name?: string | null;
      address?: string | null;
      location?: { latitude?: number | null; longitude?: number | null } | null;
    } | null;
    artists?: Array<{ name?: string }> | null;
    genres?: Array<{ name?: string }> | null;
    images?: Array<{ filename?: string }> | null;
  } | null;
}

/**
 * RA's `cost` is a free-text price hint, often a range or list:
 * "15", "18€", "13/15", "19-25", "20 - 23 €", "15€ - 18€", "16,18,20",
 * "" (unknown), "0" (free). Split into individual prices so min/max
 * resolution yields a sane early/normal pair.
 */
function parseCost(cost: string | number | null | undefined): number[] {
  if (cost == null) return [];
  if (typeof cost === "number") return Number.isFinite(cost) ? [cost] : [];
  const out: number[] = [];
  for (const part of cost.split(/[/,;|–—−-]/)) {
    const price = parsePrice(part);
    if (price != null) out.push(price);
  }
  return out;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

export const raMadrid: SiteCrawler = {
  id: "ra",
  label: "Resident Advisor",
  async run(): Promise<CrawlerEvent[]> {
    const out: CrawlerEvent[] = [];
    const seen = new Set<string>();
    const today = new Date();

    for (let offset = 0; offset < AHEAD_DAYS; offset += WINDOW_DAYS) {
      const gte = dayKey(addDays(today, offset));
      const lte = dayKey(addDays(today, Math.min(offset + WINDOW_DAYS, AHEAD_DAYS)));

      let page = 1;
      let total = Infinity;
      let fetched = 0;
      for (;;) {
        const res = await fetchJson<{
          data?: { eventListings?: { data?: RaListing[]; totalResults?: number } };
        }>(
          GRAPHQL,
          {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
              query: QUERY,
              variables: {
                filters: { areas: { eq: MADRID_AREA_ID }, listingDate: { gte, lte } },
                pageSize: PAGE_SIZE,
                page,
              },
            }),
          },
        );
        const listings = res.data?.eventListings?.data ?? [];
        total = res.data?.eventListings?.totalResults ?? listings.length;
        fetched += listings.length;

        for (const item of listings) {
          const ev = item.event;
          if (!ev?.id || !ev.title) continue;
          if (seen.has(ev.id)) continue;
          seen.add(ev.id);

          const startsAt = toIsoString(ev.startTime ?? ev.date);
          if (!startsAt) continue;
          const endsAt = toIsoString(ev.endTime) ?? undefined;

          const tiers: PriceTier[] = [];
          for (const price of parseCost(ev.cost)) {
            tiers.push({ name: "Ticket", price, currency: "EUR" });
          }

          const artists = (ev.artists ?? []).map((a) => a.name?.trim()).filter(Boolean) as string[];
          const lineup = artists.length > 0 ? `\n\nLine-up: ${artists.join(", ")}.` : "";
          const description = htmlToText(`${ev.content ?? ""}${lineup}`);

          const lat = ev.venue?.location?.latitude;
          const lng = ev.venue?.location?.longitude;
          const image = ev.images?.find((i) => i.filename)?.filename;

          out.push({
            source: "ra",
            externalId: ev.id,
            title: ev.title.trim(),
            description,
            startsAt,
            endsAt,
            url: ev.contentUrl ? `https://ra.co${ev.contentUrl}` : `https://ra.co/events/${ev.id}`,
            imageUrl: image ?? undefined,
            venueName: ev.venue?.name?.trim() || undefined,
            venueAddress: ev.venue?.address?.trim() || undefined,
            // RA returns 0,0 when it has no coords — leave those to geocoding.
            latitude: lat != null && lat !== 0 ? lat : undefined,
            longitude: lng != null && lng !== 0 ? lng : undefined,
            city: "Madrid",
            genres: (ev.genres ?? []).map((g) => g.name?.trim()).filter(Boolean) as string[],
            tiers,
            currency: "EUR",
            raw: { listingId: item.id, cost: ev.cost },
          });
        }

        if (fetched >= total || listings.length === 0) break;
        page += 1;
        await sleep(DELAY_MS);
      }
      await sleep(DELAY_MS);
    }
    return out;
  },
};
