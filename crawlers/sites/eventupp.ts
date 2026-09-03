/**
 * esnupm.org crawler — the Drupal site embeds EventUpp, so we go straight to
 * the platform's open API. The iframe loads two lists:
 *
 *   GET https://api.eventupp.eu/events/{orgId}/all?active=true&shared=false
 *        &page=0&numRows=100   → this section's events (the real content)
 *   GET https://api.eventupp.eu/events/shared/{orgId}/all?active=true
 *        → global/shared events of other sections (usually empty)
 *
 * List items are full records (same shape as the detail endpoint):
 * name, datetime/datetimeEnd (epoch ms), location, regularPrice,
 * esnCardPrice, esnCardRequired, description (HTML), imageURL,
 * seatsRemaining, datetimeLimit (registration deadline).
 *
 * Public event page: https://eventupp.eu/iframes/event-details/{orgId}/{id}
 * Images: https://api.eventupp.eu/uploads/{imageURL}
 */
import { fetchJson } from "../lib/http";
import { htmlToText } from "../lib/time";
import type { CrawlerEvent, PriceTier, SiteCrawler } from "../lib/types";

const API = "https://api.eventupp.eu";
const ORG_ID = "64c4bbff814ca42aed5e846b"; // ESN UPM (from the esnupm.org iframe)
const PAGE_SIZE = 100;

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
}

async function fetchList(url: string): Promise<EventUppEvent[]> {
  try {
    return await fetchJson<EventUppEvent[]>(url);
  } catch (error) {
    console.warn(`  [esnupm] list failed (${url}): ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

export const esnUpm: SiteCrawler = {
  id: "esnupm",
  label: "ESN UPM",
  async run(): Promise<CrawlerEvent[]> {
    // Merge section events (paged) and shared/global events by id.
    const byId = new Map<string, EventUppEvent>();

    for (let page = 0; page < 5; page++) {
      const list = await fetchList(
        `${API}/events/${ORG_ID}/all?active=true&shared=false&page=${page}&numRows=${PAGE_SIZE}`,
      );
      for (const ev of list) if (ev?._id) byId.set(ev._id, ev);
      if (list.length < PAGE_SIZE) break;
    }
    for (const ev of await fetchList(`${API}/events/shared/${ORG_ID}/all?active=true`)) {
      if (ev?._id) byId.set(ev._id, ev);
    }

    const out: CrawlerEvent[] = [];
    for (const ev of byId.values()) {
      const { _id, name, datetime } = ev;
      if (!_id || !name || !datetime) continue;

      const tiers: PriceTier[] = [];
      if (ev.esnCardPrice != null) {
        tiers.push({ name: "ESN Card holder", price: ev.esnCardPrice, currency: "EUR" });
      }
      if (ev.regularPrice != null) {
        tiers.push({ name: "Regular", price: ev.regularPrice, currency: "EUR" });
      }

      const description = htmlToText(ev.description || ev.briefDescription);
      const withCardNote =
        ev.esnCardRequired && description
          ? `${description}\n\nESNcard required.`
          : description;

      out.push({
        source: "esnupm",
        externalId: _id,
        title: name.trim(),
        description: withCardNote,
        startsAt: new Date(datetime).toISOString(),
        endsAt: ev.datetimeEnd ? new Date(ev.datetimeEnd).toISOString() : undefined,
        url: `https://eventupp.eu/iframes/event-details/${ORG_ID}/${ev._id}`,
        imageUrl: ev.imageURL ? `${API}/uploads/${ev.imageURL}` : undefined,
        venueName: ev.location?.trim() || undefined,
        city: "Madrid",
        genres: [], // inferred from title/description by finalizeEvents
        tiers,
        currency: "EUR",
        raw: ev,
      });
    }
    return out;
  },
};
