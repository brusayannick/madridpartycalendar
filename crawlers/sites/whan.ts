/**
 * Whan crawler (app.whan.es/explore).
 *
 * The explore page is a Vue SPA with infinite scroll backed by a public
 * JSON:API endpoint — we paginate it directly instead of scrolling:
 *
 *   GET https://app.whan.es/api/v1/public/explore?page[number]=N&page[size]=50
 *        → { data: [{ type, id, attributes: { name, mainImage,
 *             startDateTime, endDateTime, eventType, musicType,
 *             club: { name, province, city, timezone } } }],
 *            meta: { total, totalPages, … } }
 *
 * The list carries no prices/descriptions (the public API exposes none), so
 * events show without price until Whan exposes them. Public event page:
 * https://app.whan.es/event/{id} (redirects to the slug URL).
 * Images: https://app.whan.es/event/img/{id}?v={mainImage}&w=480
 */
import { fetchJson } from "../lib/http";
import { sleep, type CrawlerEvent, type SiteCrawler } from "../lib/types";

const API = "https://app.whan.es/api/v1/public/explore";
const PAGE_SIZE = 50;
const MAX_PAGES = 30;

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

export const whan: SiteCrawler = {
  id: "whan",
  label: "Whan",
  async run(): Promise<CrawlerEvent[]> {
    const out: CrawlerEvent[] = [];
    let page = 1;
    let totalPages = 1;

    for (; page <= totalPages && page <= MAX_PAGES; page++) {
      const res = await fetchJson<WhanResponse>(
        `${API}?page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`,
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

        out.push({
          source: "whan",
          externalId: `${item.id}|${dateKey}`,
          title: name.trim(),
          startsAt,
          endsAt: endDateTime ? new Date(endDateTime).toISOString() : undefined,
          url: `https://app.whan.es/event/${item.id}`,
          imageUrl: mainImage
            ? `https://app.whan.es/event/img/${item.id}?v=${encodeURIComponent(mainImage)}&w=480`
            : undefined,
          venueName: clubInfo.name?.trim() || undefined,
          city: "Madrid",
          genres: musicType ? [musicType] : [],
          currency: "EUR",
          raw: item.attributes,
        });
      }
      await sleep(400);
    }
    return out;
  },
};
