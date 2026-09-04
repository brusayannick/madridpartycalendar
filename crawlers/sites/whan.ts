/**
 * Whan crawler (app.whan.es/explore).
 *
 * The explore page is a Vue SPA with infinite scroll backed by a public
 * JSON:API endpoint — we paginate it directly instead of scrolling:
 *
 *   GET https://app.whan.es/api/v1/public/explore?page[number]=N&page[size]=50
 *        → { data: [{ type, id, attributes: { name, mainImage,
 *             startDateTime, endDateTime, musicType, club: {…} } }],
 *            meta: { totalPages } }
 *
 * Prices/descriptions live in a per-event detail endpoint (also public):
 *
 *   GET https://app.whan.es/api/v1/event/{id}?preview=1
 *        → description, slug, dressCode, club.locationLink (gmaps place),
 *           generalTicketsEnabled[].tiers[] (price phases, e.g. "1X18€"),
 *           publicEventLists[] (free guest lists). Tables/floor groups are
 *           deliberately ignored (VIP/table upsells).
 *
 * Public event page: https://app.whan.es/event/{slug}
 * Images: https://app.whan.es/event/img/{id}?v={mainImage}&w=480
 */
import { fetchJson } from "../lib/http";
import { htmlToText, parsePrice } from "../lib/time";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";

const EXPLORE_API = "https://app.whan.es/api/v1/public/explore";
const DETAIL_API = "https://app.whan.es/api/v1/event";
const PAGE_SIZE = 50;
const MAX_PAGES = 30;
const DELAY_MS = 300;

interface WhanItem {
  type: string;
  id: string;
  attributes: {
    name?: string;
    mainImage?: string | null;
    startDateTime?: string; // ISO with offset
    endDateTime?: string;
    eventType?: string;
    musicType?: string;
    club?: { name?: string; province?: string; city?: string };
  };
}

interface WhanResponse {
  data?: WhanItem[];
  meta?: { totalPages?: number };
}

interface WhanTicketTier {
  name?: string | null;
  price?: string | number | null;
  state?: string;
}

interface WhanDetail {
  slug?: string;
  description?: string | null;
  dressCode?: string | null;
  additionalInfo?: string | null;
  musicType?: string;
  club?: { name?: string; locationLink?: string | null; mainImage?: string | null };
  generalTicketsEnabled?: Array<{
    name?: string;
    price?: string | number | null;
    saleDisabled?: boolean;
    usesTiers?: boolean;
    tiers?: WhanTicketTier[];
  }>;
  publicEventLists?: Array<{ name?: string; price?: string | number | null; completed?: boolean }>;
}

export const whan: SiteCrawler = {
  id: "whan",
  label: "Whan",
  async run(): Promise<CrawlerEvent[]> {
    const out: CrawlerEvent[] = [];
    let page = 1;
    let totalPages = 1;

    for (; page <= totalPages && page <= MAX_PAGES; page++) {
      const res = await fetchJson<WhanResponse>(
        `${EXPLORE_API}?page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`,
      );
      totalPages = Math.min(res.meta?.totalPages ?? 1, MAX_PAGES);

      for (const item of res.data ?? []) {
        const { name, mainImage, startDateTime, endDateTime, musicType, club } =
          item.attributes ?? {};
        if (item.type !== "event" || !name || !startDateTime) {
          continue; // the list also contains club entries
        }
        // Madrid only (Whan covers all of Spain).
        const clubInfo = club ?? {};
        const isMadrid =
          /madrid/i.test(clubInfo.province ?? "") || /madrid/i.test(clubInfo.city ?? "");
        if (!isMadrid) continue;

        const startsAt = new Date(startDateTime).toISOString();
        // Recurring series appear as one entry per occurrence with the same
        // id — key by id + occurrence date so each night becomes its own row.
        const dateKey = startDateTime.slice(0, 10);

        // Prices, description, gmaps link and slug only exist in the detail.
        let tiers: PriceTier[] = [];
        let description: string | undefined;
        let gmapsUrl: string | undefined;
        let venueName = clubInfo.name?.trim();
        // The explore list often has mainImage: null even when the event page
        // shows one — the detail's club.mainImage fills the gap.
        let imageRef = mainImage ?? undefined;
        let url = `https://app.whan.es/event/${item.id}`;
        let genres = musicType ? [musicType] : [];
        try {
          await sleep(DELAY_MS);
          const detail = await fetchJson<WhanDetail>(`${DETAIL_API}/${item.id}?preview=1`);
          if (detail.slug) url = `https://app.whan.es/event/${detail.slug}`;
          if (detail.club?.name) venueName = detail.club.name.trim();
          if (!imageRef && detail.club?.mainImage) imageRef = detail.club.mainImage;
          gmapsUrl = detail.club?.locationLink ?? undefined;
          const genreTag = detail.musicType || musicType;
          genres = genreTag ? [genreTag] : [];
          description = htmlToText(
            [
              detail.description ?? "",
              detail.dressCode ? `Dress code: ${detail.dressCode}.` : "",
              detail.additionalInfo ?? "",
            ]
              .filter(Boolean)
              .join("\n\n"),
          );

          const ticketTiers: PriceTier[] = [];
          for (const ticket of detail.generalTicketsEnabled ?? []) {
            if (ticket.saleDisabled) continue;
            const inner = ticket.usesTiers && ticket.tiers?.length
              ? ticket.tiers
              : [{ name: ticket.name, price: ticket.price }];
            for (const tier of inner) {
              const price = parsePrice(String(tier.price ?? ""));
              if (price != null) {
                ticketTiers.push({
                  name: `${ticket.name ?? ""} ${tier.name ?? ""}`.trim() || "Ticket",
                  price,
                  currency: "EUR",
                });
              }
            }
          }
          // Free guest lists ("CHICAS GRATIS ANTES DE LA 01:30") count as
          // free entry; closed lists are ignored.
          for (const list of detail.publicEventLists ?? []) {
            if (list.completed || !list.name) continue;
            const price = parsePrice(String(list.price ?? ""));
            if (price != null) ticketTiers.push({ name: list.name, price, currency: "EUR" });
          }
          tiers = ticketTiers;
        } catch (error) {
          console.warn(
            `  [whan] detail failed for ${name}: ${error instanceof Error ? error.message : error}`,
          );
        }

        out.push({
          source: "whan",
          externalId: `${item.id}|${dateKey}`,
          title: name.trim(),
          description,
          startsAt,
          endsAt: endDateTime ? new Date(endDateTime).toISOString() : undefined,
          url,
          imageUrl: imageRef
            ? `https://app.whan.es/event/img/${item.id}?v=${encodeURIComponent(imageRef)}&w=480`
            : undefined,
          venueName: venueName || undefined,
          gmapsUrl,
          city: "Madrid",
          genres,
          tiers,
          currency: "EUR",
          raw: item.attributes,
        });
      }
      await sleep(200);
    }
    return out;
  },
};
