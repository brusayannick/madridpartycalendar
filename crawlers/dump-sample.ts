/**
 * Dev helper: run all crawlers and dump the finalized events as JSON so the
 * web app can render real data before Supabase is connected.
 *
 *   npx tsx crawlers/dump-sample.ts src/lib/sample-events.json
 */
import { writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { erasmusMadrid } from "./sites/erasmusmadrid";
import { nightlifeMadrid, pattFirstCircle } from "./sites/patt";
import { finalizeEvents } from "./lib/finalize";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const out = process.argv[2] ?? "src/lib/sample-events.json";

async function main() {
  const crawlers = [nightlifeMadrid, pattFirstCircle, erasmusMadrid];
  const rows: Array<Record<string, unknown>> = [];
  for (const crawler of crawlers) {
    const events = finalizeEvents(await crawler.run());
    console.log(`${crawler.id}: ${events.length} events`);
    for (const e of events) {
      rows.push({
        id: `${e.source}-${e.externalId}`,
        source: e.source,
        external_id: e.externalId,
        title: e.title,
        description: e.description ?? null,
        starts_at: e.startsAt,
        ends_at: e.endsAt ?? null,
        url: e.url,
        image_url: e.imageUrl ?? null,
        venue_name: e.venueName ?? null,
        venue_address: e.venueAddress ?? null,
        gmaps_url: e.gmapsUrl ?? null,
        city: e.city ?? "Madrid",
        genres: e.genres,
        price_early: e.priceEarly ?? null,
        price_normal: e.priceNormal ?? null,
        currency: e.currency ?? "EUR",
      });
    }
  }

  rows.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`wrote ${rows.length} events → ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
