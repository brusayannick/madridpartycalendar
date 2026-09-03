/**
 * Fourvenues crawler — Erasmus Touch microsite.
 *
 * site.fourvenues.com sits behind Cloudflare, but its Angular app calls a
 * JSON API that accepts the platform's static public token (both shipped in
 * the site's own JS bundle):
 *
 *   GET https://cli-api-service.fourvenues.com/api/events
 *       ?slug=erasmustouch&startDate=<epoch s>&endDate=<epoch s>   (≤ 1 year)
 *   GET https://cli-api-service.fourvenues.com/api/events/{id}/tickets-types
 *       ?slug=erasmustouch        → named releases with prices + sale windows
 *
 * The microsite covers several cities (Madrid, Granada, Zaragoza…) — only
 * events whose address contains "Madrid" are kept.
 * Public event page: https://site.fourvenues.com/en/erasmustouch/events/{code}
 */
import { fetchJson } from "../lib/http";
import { htmlToText } from "../lib/time";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";

const API = "https://cli-api-service.fourvenues.com";
const AUTH = "Fv rhCep%JAF#%D*o#JS^DpAx%YM6z^*3K!"; // public static token from the site bundle
const MICROSITE = "erasmustouch";
const HEADERS = { Authorization: AUTH, "Accept-Language": "en" };
const DELAY_MS = 350;
const AHEAD_SECONDS = 120 * 24 * 60 * 60;

interface FvEvent {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  image?: string;
  genres?: string[];
  age?: number | null;
  slug?: string;
  organization?: { name?: string };
  location?: { addressComplete?: string };
  dates?: { start?: number; end?: number; canceled?: number | null };
}

interface FvTicketOption {
  name?: string | null;
  price?: number | null;
}

interface FvTicketType {
  name?: string;
  price?: number | null;
  isSoldOut?: boolean;
  dates?: { from?: number | null };
  options?: FvTicketOption[];
}

function init(): RequestInit {
  return { headers: HEADERS };
}

export const fourvenuesErasmusTouch: SiteCrawler = {
  id: "fourvenues_erasmustouch",
  label: "Erasmus Touch",
  async run(): Promise<CrawlerEvent[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const out: CrawlerEvent[] = [];

    // 1) Upcoming events (list is small; still follow pagination).
    let page = 1;
    for (;;) {
      const res = await fetchJson<{
        data?: FvEvent[];
        metadata?: { next?: string | null; totalPages?: number };
      }>(
        `${API}/api/events?slug=${MICROSITE}&startDate=${nowSec}&endDate=${nowSec + AHEAD_SECONDS}&page=${page}`,
        init(),
      );
      const events = res.data ?? [];

      for (const ev of events) {
        if (!ev.id || !ev.name || !ev.dates?.start) continue;
        if (ev.dates.canceled) continue;
        // Madrid only — the microsite also sells Granada/Zaragoza nights.
        const address = ev.location?.addressComplete ?? "";
        if (!/madrid/i.test(address)) continue;

        const startsAt = new Date(ev.dates.start * 1000).toISOString();
        const endsAt = ev.dates.end ? new Date(ev.dates.end * 1000).toISOString() : undefined;

        // 2) Ticket releases (prices + sale window) per event.
        const tiers: PriceTier[] = [];
        let saleFrom: number | null = null;
        try {
          await sleep(DELAY_MS);
          const tt = await fetchJson<{ data?: FvTicketType[] }>(
            `${API}/api/events/${ev.id}/tickets-types?slug=${MICROSITE}`,
            init(),
          );
          for (const type of tt.data ?? []) {
            if (type.dates?.from && type.dates.from * 1000 < Date.now() + 366 * 86400_000) {
              if (saleFrom == null || type.dates.from < saleFrom) saleFrom = type.dates.from;
            }
            const options = type.options?.length
              ? type.options
              : [{ name: null, price: type.price ?? null }];
            for (const option of options) {
              const price = option.price ?? type.price ?? null;
              if (price == null) continue;
              tiers.push({
                name: [type.name, option.name].filter(Boolean).join(" · "),
                price,
                currency: "EUR",
              });
            }
          }
        } catch (error) {
          console.warn(
            `  [fourvenues] ticket types failed for ${ev.name}: ${error instanceof Error ? error.message : error}`,
          );
        }

        const description = htmlToText(ev.description ?? "");
        const withAge = ev.age && ev.age > 0 ? `${description ?? ""}\n\n${ev.age}+ event.` : description;

        out.push({
          source: "fourvenues_erasmustouch",
          externalId: ev.id,
          title: ev.name.trim(),
          description: withAge,
          startsAt,
          endsAt,
          url: ev.code
            ? `https://site.fourvenues.com/en/${MICROSITE}/events/${ev.code}`
            : `https://site.fourvenues.com/en/${MICROSITE}/events`,
          imageUrl: ev.image,
          venueName: ev.organization?.name?.trim() || undefined,
          venueAddress: address || undefined,
          city: "Madrid",
          genres: ev.genres ?? [],
          tiers,
          ticketsSaleAt: saleFrom ? new Date(saleFrom * 1000).toISOString() : undefined,
          currency: "EUR",
          raw: ev,
        });
      }

      if (!res.metadata?.next || page >= (res.metadata.totalPages ?? 1)) break;
      page += 1;
      await sleep(DELAY_MS);
    }
    return out;
  },
};
