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
import { esnUpm } from "./sites/eventupp";
import { whan } from "./sites/whan";
import { fourvenuesErasmusTouch } from "./sites/fourvenues";
import { dedupeAcrossSources } from "./lib/dedupe";
import { finalizeEvents } from "./lib/finalize";
import type { CrawlerEvent } from "./lib/types";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const out = process.argv[2] ?? "src/lib/sample-events.json";

async function main() {
  const crawlers = [nightlifeMadrid, pattFirstCircle, erasmusMadrid, esnUpm, whan, fourvenuesErasmusTouch];
  const collected: CrawlerEvent[] = [];
  for (const crawler of crawlers) {
    const events = await finalizeEvents(await crawler.run());
    console.log(`${crawler.id}: ${events.length} events`);
    collected.push(...events);
  }

  const { kept, removed } = dedupeAcrossSources(collected);
  console.log(`deduped ${removed.length} cross-listed duplicates`);

  const rows: Array<Record<string, unknown>> = kept.map((e) => ({
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
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
    city: e.city ?? "Madrid",
    genres: e.genres,
    price_early: e.priceEarly ?? null,
    price_normal: e.priceNormal ?? null,
    price_early_male: e.priceEarlyMale ?? null,
    price_normal_male: e.priceNormalMale ?? null,
    price_early_female: e.priceEarlyFemale ?? null,
    price_normal_female: e.priceNormalFemale ?? null,
    tickets_sale_at: e.ticketsSaleAt ?? null,
    tickets_sale_note: e.ticketsSaleNote ?? null,
    currency: e.currency ?? "EUR",
  }));

  rows.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`wrote ${rows.length} events → ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
