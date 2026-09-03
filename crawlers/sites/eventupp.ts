/**
 * esnupm.org crawler — the Drupal site embeds EventUpp, so we go straight to
 * the platform's open API:
 *
 *   GET https://api.eventupp.eu/events/shared/{orgId}/all?active=true
 *        → active events of the organization (list may be empty between
 *          semesters — ESN sections publish events when the term starts)
 *   GET https://api.eventupp.eu/events/{orgId}/{eventId}
 *        → full event detail (public, no auth): name, datetime (epoch ms),
 *          datetimeEnd, location, regularPrice, esnCardPrice, description,
 *          imageURL, seatsRemaining, esnCardRequired
 *
 * Public event page: https://eventupp.eu/iframes/event-details/{orgId}/{id}
 * Images: https://api.eventupp.eu/uploads/{imageURL}
 */
import { fetchJson } from "../lib/http";
import { htmlToText } from "../lib/time";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";

const API = "https://api.eventupp.eu";
const ORG_ID = "64c4bbff814ca42aed5e846b"; // ESN UPM (from the esnupm.org iframe)
const DELAY_MS = 500;

interface EventUppEvent {
  _id?: string;
  name?: string;
  datetime?: number; // epoch ms
  datetimeEnd?: number;
  location?: string;
  regularPrice?: number | null;
  esnCardPrice?: number | null;
  briefDescription?: string;
  description?: string;
  imageURL?: string;
  seatsRemaining?: number;
  esnCardRequired?: boolean;
  organization?: string;
  active?: boolean;
}

export const esnUpm: SiteCrawler = {
  id: "esnupm",
  label: "ESN UPM",
  async run(): Promise<CrawlerEvent[]> {
    const list = await fetchJson<EventUppEvent[]>(
      `${API}/events/shared/${ORG_ID}/all?active=true`,
    );

    const out: CrawlerEvent[] = [];
    for (const ev of list ?? []) {
      if (!ev?._id || !ev.name || !ev.datetime) continue;
      try {
        await sleep(DELAY_MS);
        // The detail endpoint carries the full record (prices, description).
        const detail = await fetchJson<EventUppEvent>(`${API}/events/${ORG_ID}/${ev._id}`);
        const full: EventUppEvent = { ...ev, ...detail };

        const startsAt = new Date(full.datetime ?? ev.datetime).toISOString();
        const endsAt = full.datetimeEnd
          ? new Date(full.datetimeEnd).toISOString()
          : undefined;

        const tiers: PriceTier[] = [];
        if (full.esnCardPrice != null) {
          tiers.push({ name: "ESN Card holder", price: full.esnCardPrice, currency: "EUR" });
        }
        if (full.regularPrice != null) {
          tiers.push({ name: "Regular", price: full.regularPrice, currency: "EUR" });
        }

        const description = htmlToText(full.description || full.briefDescription);
        const withCardNote =
          full.esnCardRequired && description
            ? `${description}\n\nESNcard required.`
            : description;

        out.push({
          source: "esnupm",
          externalId: ev._id,
          title: (full.name ?? ev.name).trim(),
          description: withCardNote,
          startsAt,
          endsAt,
          url: `https://eventupp.eu/iframes/event-details/${ORG_ID}/${full._id}`,
          imageUrl: full.imageURL ? `${API}/uploads/${full.imageURL}` : undefined,
          venueName: full.location?.trim() || undefined,
          city: "Madrid",
          genres: [], // inferred from title/description by finalizeEvents
          tiers,
          currency: "EUR",
          raw: full,
        });
      } catch (error) {
        console.warn(`  [esnupm] skipping ${ev.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return out;
  },
};
