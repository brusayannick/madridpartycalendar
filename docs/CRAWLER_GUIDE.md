# Adding a crawler for a new event source

This guide explains how the crawler pipeline works and how to plug in a new
Madrid event page (listing page, ticket shop, festival site, …) so its events
appear in the calendar.

## How the pipeline works

```
crawlers/sites/<site>.ts      site-specific extraction (HTTP → CrawlerEvent[])
crawlers/lib/finalize.ts      shared post-processing:
                              Madrid filter · future-only filter ·
                              price tier resolution · genre normalize/infer ·
                              gmaps link builder
crawlers/lib/store.ts         upsert into Supabase on (source, external_id)
crawlers/run.ts               CLI orchestration (--site, --dry, --prune)
```

Run everything locally with:

```bash
npm run crawl                # all sites → upsert into Supabase
npm run crawl -- --dry       # print normalized events, write nothing
npm run crawl -- --site=patt # substring match on crawler id/label
npm run crawl -- --prune     # also delete past events of crawled sources
```

Crawlers always run locally with the **service role key** (`.env.local`);
the deployed web app only ever holds the anon key (read-only via RLS).

## The `CrawlerEvent` contract

Every crawler returns an array of `CrawlerEvent` (`crawlers/lib/types.ts`):

| Field         | Required | Notes |
|---------------|----------|-------|
| `source`      | ✅ | Crawler id, equals the DB `source` column (e.g. `nightlifemadrid`). |
| `externalId`  | ✅ | Stable per-event id. Used for upsert dedup — for recurring series include the occurrence date (`${id}-${yyyymmdd}`). |
| `title`       | ✅ | Clean display title (no emoji spam, no site suffixes). |
| `description` |    | Plain text, HTML stripped, trimmed by `htmlToText`. |
| `startsAt`    | ✅ | ISO 8601 **with timezone info** (UTC `Z` or offset). Use `madridToUtc(date, time)` for wall-clock times. |
| `endsAt`      |    | Same format. |
| `url`         | ✅ | Public event/ticket page users are sent to. |
| `imageUrl`    |    | Hero image. Add new hosts to `images.remotePatterns` in `next.config.ts`. |
| `venueName` / `venueAddress` |  | If the source has no structured venue, extract heuristically (see `erasmusmadrid.ts`). |
| `city`        |    | Only events whose city matches Madrid are kept (`finalizeEvents`); missing city = kept. |
| `genres`      |    | Source tags if available; otherwise `finalizeEvents` infers from title+description. |
| `tiers`       |    | Raw ticket tiers `{name, price}` — resolved to `priceEarly`/`priceNormal` (see below). |
| `currency`    |    | Defaults to `EUR`. |
| `raw`         |    | Original payload stored in the `raw` jsonb column for debugging. Keep it small. |

## Price tier rules (early bird / normal, no VIP junk)

Product decision: events show a **normal** and an **early-bird** price — never
VIP/table/bottle upsells. `resolvePrices()` in `crawlers/lib/priceTiers.ts`:

1. Tiers whose name matches the exclude list are dropped:
   `vip, table(s), bottle(s), botella(s), mesa(s), reservado, dj table, premium,
   merch, t-shirt, unlimited pass, membership, monthly, weekly pass, package`.
2. A tier priced `0` (or named free/gratis) wins: `priceEarly = 0`, and
   `priceNormal` = most expensive remaining tier.
3. Otherwise `priceEarly` = cheapest kept tier (the early/first release) and
   `priceNormal` = most expensive kept tier (late/door phase).
4. `early` is never above `normal` (PATT lists phases out of order sometimes).

Tune the keyword lists in that file — no schema change needed.

PATT models escalating releases as separate tier rows ("First Release 25",
then 30 when sold out), which is why min/max works there. Erasmus Madrid's
tier names ("TICKET 1 — Early Bird", "Standard", "Last Minute", "30-Day
Unlimited Pass") come from the TEC ticket form on each event page.

## Genre taxonomy

`crawlers/lib/genres.ts` owns:

- `GENRE_TAXONOMY` — canonical genre list (used by the UI filters).
- `NORMALIZE` — maps messy source tags (`"Pop "`, `"Italian:"`, `"commercial"`)
  onto the taxonomy; unknown tags pass through title-cased.
- `INFER_RULES` — keyword→genre regexes used when a source provides no genres
  (pub crawl, pool party, techno, reggaeton, …).

Edit these maps freely; the filter UI derives its chips from the data.

## Step-by-step: add a new source

1. **Investigate the page first.** Check whether data is:
   - server-rendered HTML → parse with `cheerio`,
   - a JSON API (check the Network tab of the site, or `wp-json`) → best case,
   - client-rendered with an open backend (like the PATT frontends) → call the
     backend directly,
   - Cloudflare-protected with no API → see *Playwright fallback* below.
2. **Create `crawlers/sites/<yoursite>.ts`** using the template below.
3. **Register it** in the `CRAWLERS` array of `crawlers/run.ts`.
4. **Register the source in the UI**: add a label + accent dot to
   `SOURCE_META` in `src/lib/events.ts`.
5. **Test**: `npm run crawl -- --dry --site=<id>` — verify dates are correct
   Madrid times, prices look sane, VIP tiers are gone, genres are reasonable.
6. **Run for real**: `npm run crawl -- --site=<id>` (writes to Supabase).
7. If the source serves images from a new host, allow it in
   `next.config.ts → images.remotePatterns`.

### Template

```ts
// crawlers/sites/example.ts
import { fetchJson, fetchText } from "../lib/http";
import { htmlToText, madridToUtc } from "../lib/time";
import type { CrawlerEvent, PriceTier, SiteCrawler } from "../lib/types";

const BASE = "https://example-madrid-site.com";
const DELAY_MS = 500; // be polite between requests

export const exampleSite: SiteCrawler = {
  id: "example",
  label: "Example Madrid",
  async run(): Promise<CrawlerEvent[]> {
    // 1. fetch the listing (API or HTML)
    const html = await fetchText(`${BASE}/events`);
    // 2. extract: id, title, dates, venue, genres, tiers, image, url …
    const items = parseListing(html); // your cheerio/JSON extraction
    // 3. map to CrawlerEvent
    return items.map((it) => ({
      source: "example",
      externalId: it.id,
      title: it.title.trim(),
      description: htmlToText(it.descriptionHtml),
      startsAt: madridToUtc(it.date, it.startTime), // or new Date(it.iso).toISOString()
      endsAt: it.endIso ? new Date(it.endIso).toISOString() : undefined,
      url: it.url,
      imageUrl: it.image,
      venueName: it.venueName,
      city: it.city ?? "Madrid",
      genres: it.tags ?? [],
      tiers: it.tiers as PriceTier[],
      currency: "EUR",
    }));
  },
};
```

Helpers you should reuse:

- `fetchJson` / `fetchText` (`lib/http.ts`) — identified UA, retries, timeouts.
  Add `await sleep(DELAY_MS)` between per-event requests.
- `htmlToText`, `parsePrice`, `toIsoString`, `madridToUtc` (`lib/time.ts`).
- Venue extraction example (`KNOWN_VENUES` dictionary + regex fallback) in
  `erasmusmadrid.ts` — copy the pattern if your source lacks venue data.

## Scheduling & recurring events

- The site only needs events that start in the future; `finalizeEvents`
  drops anything older than 24h.
- Recurring series: The Events Calendar exposes each series once with its
  *next* occurrence, so each crawl adds the new week's row
  (`externalId = ${id}-${date}`) and the calendar fills over time —
  **run `npm run crawl` regularly (daily is plenty)**.
- `--prune` deletes rows whose `starts_at` has passed. Run it occasionally.
- The crawlers are intentionally local-only per project decision. If you later
  want automation, a GitHub Action or Vercel Cron hitting `crawlers/run.ts`
  works — but then the service-role key lives in that environment.

## Playwright fallback (only when there is no API)

If a future site renders everything client-side *and* has no open backend:

1. `npm i -D playwright` and `npx playwright install chromium`.
2. In the site module, load the page, wait for the event list selector, and
   read the DOM (or intercept the XHR responses, which often reveals a clean
   JSON API — prefer that).
3. Keep the same `CrawlerEvent` output so nothing else changes.

Everything else (finalize, upsert, UI) is source-agnostic.

## Etiquette

- One identifying `User-Agent` (already set in `lib/http.ts`).
- ~0.4–0.6s delay between requests; retry with backoff, never parallel hammer.
- Only crawl what the calendar needs (upcoming Madrid events), cache `--dry`
  output while developing instead of re-fetching.
- Respect `robots.txt`; if a site forbids crawling, don't add it.
