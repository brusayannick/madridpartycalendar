/**
 * erasmusmadrid.org crawler — WordPress + The Events Calendar (TEC).
 *
 * The site's TEC REST API is enabled and authoritative:
 *   GET /wp-json/tribe/events/v1/events?per_page=100&start_date=<today>
 * It returns each event *series* once with its NEXT occurrence only (no
 * recurrence rules), so recurring pubcrawls show up one week at a time —
 * run the crawler regularly to keep the calendar filled.
 *
 * Ticket tiers (names + prices) are not in the REST API; each event page's
 * TEC Tickets Commerce form has them (`data-ticket-price` rows).
 * Venues are not structured either — extracted via a known-clubs dictionary
 * plus regex fallbacks over the description text.
 */
import * as cheerio from "cheerio";
import { fetchJson, fetchText } from "../lib/http";
import { htmlToText, madridToUtc, madridToday, parsePrice } from "../lib/time";
import { sleep, type CrawlerEvent, type PriceTier, type SiteCrawler } from "../lib/types";
import { inferGenres } from "../lib/genres";
import { parseSaleOpens } from "../lib/saleOpens";

const BASE = "https://erasmusmadrid.org";
const API = `${BASE}/wp-json/tribe/events/v1/events`;
const DELAY_MS = 600;

interface TecEvent {
  id: number;
  url: string;
  title: string;
  description: string;
  image?: { url?: string; sizes?: Record<string, { url?: string }> };
  start_date?: string; // "2026-09-02 23:00:00" (site local)
  end_date?: string;
  utc_start_date?: string; // "2026-09-02 21:00:00"
  utc_end_date?: string;
  categories?: Array<{ name: string; slug: string }>;
}

/** TEC category slug → genre. */
const CATEGORY_GENRES: Record<string, string> = {
  "pubcrawl-tour": "Pub Crawl",
  pubcrawl: "Pub Crawl",
  "pool-party": "Pool Party",
  poolparty: "Pool Party",
  "language-exchange": "Language Exchange",
  "live-music": "Live Music",
  concert: "Live Music",
  karaoke: "Karaoke",
};

/**
 * Madrid venues these events happen at (pubcrawl final clubs etc.).
 * Edit freely — first case-insensitive match in title/description wins.
 */
const KNOWN_VENUES = [
  "Teatro Kapital",
  "Teatro Barceló",
  "Space of Sound",
  "La Riviera",
  "Sala Clamores",
  "Café La Palma",
  "Calle 365",
  "Houdinni",
  "Fitz",
  "Shoko",
  "Teresa",
  "Icon",
  "Joël",
  "Babylon",
  "Kapital",
  "Fabrik",
  "Greta",
  "Studio 76",
  "Opal",
  "Medias Puri",
  "Momo",
  "Boite",
  "El Sol",
  "Azul",
  "Costello",
  "Chapandaz",
  "Dubliners",
  "O'Connell",
  "The James Joyce",
  "THO",
  "KU Madrid",
  "WoW! Room",
  "Groove",
  "New Garamond",
  "Velvet",
  "Gamboa",
  "Selina",
  "Amazula",
  "Panta Rhei",
  "Gruta 77",
  "X Mansion",
  "Mucca",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "🟩 WEDNESDAY — … | Erasmus Madrid" → "WEDNESDAY — …" */
function cleanTitle(title: string): string {
  return title
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s*[|·•]\s*Erasmus Madrid\s*$/i, "")
    .replace(/\s+Erasmus Madrid\s*$/i, "")
    .trim();
}

function extractVenue(text: string): string | undefined {
  for (const venue of KNOWN_VENUES) {
    if (new RegExp(`(^|[^\\p{L}])${escapeRe(venue)}([^\\p{L}]|$)`, "iu").test(text)) {
      return venue;
    }
  }
  const m =
    text.match(/final(?:\s+(?:club|stop))?\s*:\s*[*✨\s]*([\p{L}&.\-' ]{3,40})/iu) ??
    text.match(/(?:VIP\s+)?entry\s+(?:to|into)\s+(?:the\s+)?([\p{L}&.\-' ]{3,40}?\s*Club)/iu);
  if (m) {
    const name = m[1]
      .replace(/\s*(Club|VIP|Madrid)\s*$/i, "")
      .replace(/[*✨]/g, "")
      .trim();
    if (name.length >= 3) return name;
  }
  return undefined;
}

function tecDateToIso(utc: string | undefined, local: string | undefined): string | undefined {
  if (utc) {
    // "2026-09-02 21:00:00" → ISO UTC.
    const m = utc.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (m) return new Date(`${m[1]}T${m[2]}:00Z`).toISOString();
  }
  if (local) {
    const m = local.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (m) return madridToUtc(m[1], m[2]);
  }
  return undefined;
}

/** Trim marketing bloat: cut at gallery/membership sections, keep it readable. */
function cleanDescription(html: string): string | undefined {
  const text = htmlToText(html, 4000);
  if (!text) return undefined;
  const cut = text.search(/\n\s*(PACKAGES MEMBERSHIP|PHOTOS)\b/);
  return htmlToText(cut > 0 ? text.slice(0, cut) : text, 1200);
}

function parseTiers(html: string): PriceTier[] {
  const $ = cheerio.load(html);
  const tiers: PriceTier[] = [];
  $("div.tribe-tickets__tickets-item[data-ticket-price]").each((_, el) => {
    const name = $(el).find(".tribe-tickets__tickets-item-content-title").text().trim();
    const price = parsePrice($(el).attr("data-ticket-price"));
    if (name) tiers.push({ name, price });
  });
  return tiers;
}

export const erasmusMadrid: SiteCrawler = {
  id: "erasmusmadrid",
  label: "Erasmus Madrid",
  async run(): Promise<CrawlerEvent[]> {
    // 1) List upcoming events via TEC REST.
    const events: TecEvent[] = [];
    let page = 1;
    for (;;) {
      const data = await fetchJson<{ events?: TecEvent[]; total_pages?: number }>(
        `${API}?per_page=100&start_date=${madridToday()}&page=${page}`,
      );
      events.push(...(data.events ?? []));
      if (page >= (data.total_pages ?? 1)) break;
      page += 1;
      await sleep(DELAY_MS);
    }

    // 2) Fetch each event page for ticket tiers (price names live only there).
    const out: CrawlerEvent[] = [];
    for (const ev of events) {
      if (!ev.start_date && !ev.utc_start_date) continue;
      const startsAt = tecDateToIso(ev.utc_start_date, ev.start_date);
      if (!startsAt) continue;
      const endsAt = tecDateToIso(ev.utc_end_date, ev.end_date);
      const dateKey = (ev.start_date ?? "").slice(0, 10).replace(/-/g, "");

      let tiers: PriceTier[] = [];
      try {
        await sleep(DELAY_MS);
        const html = await fetchText(ev.url);
        tiers = parseTiers(html);
      } catch (error) {
        console.warn(`  [erasmusmadrid] tier fetch failed for ${ev.url}: ${error instanceof Error ? error.message : error}`);
      }

      const description = cleanDescription(ev.description ?? "");
      const searchText = `${ev.title}\n${description ?? ""}`;
      // Sale announcements live in pasted ticket text ("Start sale: 8/26/2026
      // at 7:00pm") or tier names ("TICKET 1 — Early Bird …").
      const sale = parseSaleOpens(
        `${tiers.map((t) => t.name).join("\n")}\n${ev.description ?? ""}`,
        startsAt,
      );
      const genreSet = new Set<string>(
        (ev.categories ?? [])
          .map((c) => CATEGORY_GENRES[c.slug] ?? CATEGORY_GENRES[c.name.toLowerCase()] )
          .filter((g): g is string => Boolean(g)),
      );
      inferGenres(searchText).forEach((g) => genreSet.add(g));
      if (genreSet.has("Party")) genreSet.delete("Party"); // generic; categories already say it

      out.push({
        source: "erasmusmadrid",
        externalId: `${ev.id}-${dateKey}`,
        title: cleanTitle(ev.title),
        description,
        startsAt,
        endsAt,
        url: ev.url,
        imageUrl: ev.image?.sizes?.large?.url ?? ev.image?.url,
        venueName: extractVenue(searchText),
        city: "Madrid",
        genres: [...genreSet],
        tiers,
        ticketsSaleAt: sale?.at,
        ticketsSaleNote: sale?.note,
        currency: "EUR",
        raw: { id: ev.id, start_date: ev.start_date, categories: ev.categories?.map((c) => c.slug) },
      });
    }
    return out;
  },
};
