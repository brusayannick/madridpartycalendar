# Madrid Party Calendar

A lightweight, mobile-first calendar aggregating Madrid nightlife events from
multiple sources — club nights, pubcrawls, pool parties — in one clean app.

- **Web app**: Next.js (App Router) + Tailwind CSS + shadcn/ui + motion, deployed on **Vercel**
- **Database**: **Supabase** (Postgres, public read via RLS)
- **Crawlers**: local Node scripts (HTTP-only, no headless browser) that push events into Supabase

## Current sources

| Source | Page | How it's crawled |
|---|---|---|
| Nightlife Madrid | <https://tickets.nightlifemadrid.com/en> | PATT backend API (list + ticket tiers per event) |
| First Circle | <https://events.patt.club/crew/FirstCircle> | Same PATT backend, promoter `FirstCircle` |
| Erasmus Madrid | <https://erasmusmadrid.org/events/> | The Events Calendar REST API + event pages for ticket tiers |
| ESN UPM | <https://esnupm.org/es/eventos> | EventUpp API (the Drupal site embeds eventupp.eu) |
| Whan | <https://app.whan.es/explore> | Whan public explore API (paginated — replaces the site's infinite scroll) |
| Erasmus Touch | <https://site.fourvenues.com/en/erasmustouch/events> | Fourvenues API with the site's public token (Madrid-filtered — the microsite also sells other cities) |

Each event stores: date, start/end time, early-bird & normal price (VIP/table
tiers filtered out), ticket-sale start when announced, ticket URL, genres,
venue + Google Maps link, description and image. Madrid-only.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase credentials
```

### 1. Create the Supabase table

Create a project at [supabase.com](https://supabase.com), open the SQL editor
and run [`supabase/schema.sql`](supabase/schema.sql).

### 2. Configure environment

In Supabase → *Project settings → API* copy the values into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY      # web app (read-only via RLS)
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY  # crawlers only — never commit/deploy
```

### 3. Crawl

```bash
npm run crawl                 # all sources → upsert into Supabase
npm run crawl -- --dry        # preview without writing
npm run crawl -- --site=patt  # only matching sources
npm run crawl -- --prune      # also remove past events
```

Run the crawler regularly (daily is plenty) — recurring event series publish
their next occurrence one week at a time. See
[`docs/CRAWLER_GUIDE.md`](docs/CRAWLER_GUIDE.md) for how to add new sources.

### 4. Run the app

```bash
npm run dev
```

Without Supabase credentials the app renders the bundled demo snapshot
(`src/lib/sample-events.json`, regenerate with
`npx tsx crawlers/dump-sample.ts`). A small “demo data” hint appears in the
header while that fallback is active.

## Deploy to Vercel

```bash
npm i -g vercel && vercel
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
Vercel project env vars. **Do not** add the service-role key — crawlers stay
local by design. The page revalidates every 5 minutes.

## Project structure

```
src/app/            Next.js app router (page, layout, manifest)
src/components/     calendar view, day strip, event card/sheet, filters
src/lib/            event types/helpers, supabase client, demo snapshot
crawlers/           local crawler CLI (sites/, lib/, run.ts) — see docs/CRAWLER_GUIDE.md
supabase/schema.sql events table + RLS policies
docs/               crawler guide
```
