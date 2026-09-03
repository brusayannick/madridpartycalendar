/**
 * PATT platform crawler (Party All The Time).
 *
 * Both https://tickets.nightlifemadrid.com and https://events.patt.club are
 * client-rendered frontends for the same backend, which is open and needs no
 * auth. We bypass the frontends entirely:
 *
 *   GET  {API}/events/getpromoterevents/{promoter}?subdomain={sub}
 *        → full event list (title, ISO start/end, club, music_type, image…)
 *   POST {API}/tickets/geteventdetailss  {eventId, promoterName}
 *        → ticket tiers with prices (phases are separate rows)
 *
 * Public event page: {publicBase}/pass/{eventId}?handle={promoter}
 */
import { fetchJson } from "../lib/http";
import { htmlToText } from "../lib/time";
import { parseSaleOpens } from "../lib/saleOpens";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";

const API = "https://everywhereback.azurewebsites.net";

interface PattEvent {
  _id: string;
  eventName: string;
  dateAndHour: string;
  dateAndHourEnd?: string;
  timezone?: string;
  club?: { name?: string } | null;
  locationDisplayName?: string;
  city?: string[];
  country?: string;
  music_type?: string[];
  description?: string;
  image?: string;
  images?: string[];
  currency?: string;
}

interface PattTicket {
  ticketType?: string;
  price?: number;
  hidePrice?: boolean;
  displayOnly?: boolean;
  /** Sale-start of the tier: ISO string or epoch ms; usually null. */
  StartSale?: string | number | null;
}

interface PattListResponse {
  events?: PattEvent[];
}

interface PattDetailResponse {
  tickets?: PattTicket[];
}

const DELAY_MS = 400; // between detail requests, per crawler etiquette

function makePattCrawler(config: {
  id: string;
  label: string;
  promoter: string;
  subdomain?: string;
  publicBase: string;
}): SiteCrawler {
  return {
    id: config.id,
    label: config.label,
    async run(): Promise<CrawlerEvent[]> {
      const listUrl =
        `${API}/events/getpromoterevents/${encodeURIComponent(config.promoter)}` +
        (config.subdomain ? `?subdomain=${encodeURIComponent(config.subdomain)}` : "");
      const data = await fetchJson<PattListResponse>(listUrl);
      const events = data.events ?? [];

      const out: CrawlerEvent[] = [];
      for (const ev of events) {
        if (!ev._id || !ev.eventName || !ev.dateAndHour) continue;
        try {
          await sleep(DELAY_MS);
          const detail = await fetchJson<PattDetailResponse>(
            `${API}/tickets/geteventdetailss`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventId: ev._id,
                promoterName: config.promoter,
                ...(config.subdomain ? { subdomain: config.subdomain } : {}),
              }),
            },
          );

          const tiers: PriceTier[] = (detail.tickets ?? [])
            .filter((t) => t.ticketType && !t.displayOnly)
            .map((t) => ({
              name: t.ticketType as string,
              price: t.hidePrice ? null : (t.price ?? null),
              currency: ev.currency ?? "EUR",
            }));

          // Ticket-sale announcements: promoters either set a tier's StartSale
          // timestamp or add a display row like "TICKET SALES OPEN THURSDAY,
          // SEPTEMBER 3RD AT 18:00 (6PM)!".
          const startsAtIso = new Date(ev.dateAndHour).toISOString();
          let ticketsSaleAt: string | undefined;
          for (const t of detail.tickets ?? []) {
            const candidates: string[] = [];
            if (t.StartSale) {
              const d = new Date(typeof t.StartSale === "number" ? t.StartSale : String(t.StartSale));
              if (!Number.isNaN(d.getTime())) candidates.push(d.toISOString());
            }
            const parsed = parseSaleOpens(t.ticketType ?? "", startsAtIso);
            if (parsed?.at) candidates.push(parsed.at);
            for (const iso of candidates) {
              if (!ticketsSaleAt || iso < ticketsSaleAt) ticketsSaleAt = iso;
            }
          }
          const saleNote = (detail.tickets ?? [])
            .map((t) => parseSaleOpens(t.ticketType ?? "", startsAtIso))
            .find((p) => p?.note)?.note;

          out.push({
            source: config.id,
            externalId: ev._id,
            title: ev.eventName.trim(),
            description: htmlToText(ev.description),
            startsAt: new Date(ev.dateAndHour).toISOString(),
            endsAt: ev.dateAndHourEnd ? new Date(ev.dateAndHourEnd).toISOString() : undefined,
            url: `${config.publicBase}/pass/${ev._id}?handle=${encodeURIComponent(config.promoter)}`,
            imageUrl: ev.image || ev.images?.[0],
            venueName: ev.club?.name || ev.locationDisplayName || undefined,
            city: ev.city?.join(", "),
            genres: ev.music_type ?? [],
            tiers,
            ticketsSaleAt,
            ticketsSaleNote: saleNote,
            currency: ev.currency || "EUR",
            raw: ev,
          });
        } catch (error) {
          console.warn(`  [${config.id}] skipping ${ev.eventName}: ${error instanceof Error ? error.message : error}`);
        }
      }
      return out;
    },
  };
}

export const nightlifeMadrid = makePattCrawler({
  id: "nightlifemadrid",
  label: "Nightlife Madrid",
  promoter: "nightlifemadrid",
  subdomain: "nightlifemadrid",
  publicBase: "https://tickets.nightlifemadrid.com",
});

export const pattFirstCircle = makePattCrawler({
  id: "patt_firstcircle",
  label: "First Circle (PATT)",
  promoter: "FirstCircle",
  publicBase: "https://events.patt.club",
});
