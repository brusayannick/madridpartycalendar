/**
 * Crawler CLI — run locally:
 *
 *   npm run crawl                      # all sites → upsert into Supabase
 *   npm run crawl -- --dry             # print what would be stored, write nothing
 *   npm run crawl -- --site=patt       # filter by site id (substring match)
 *   npm run crawl -- --prune           # also delete past events of crawled sources
 */
import { config as loadEnv } from "dotenv";
import { erasmusMadrid } from "./sites/erasmusmadrid";
import { nightlifeMadrid, pattFirstCircle } from "./sites/patt";
import { finalizeEvents } from "./lib/finalize";
import { prunePastEvents, upsertEvents } from "./lib/store";
import type { SiteCrawler } from "./lib/types";

// .env.local wins; .env is the fallback (dotenv keeps already-set vars).
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const CRAWLERS: SiteCrawler[] = [nightlifeMadrid, pattFirstCircle, erasmusMadrid];

function parseArgs(argv: string[]) {
  const args: { site?: string; dry: boolean; prune: boolean } = { dry: false, prune: false };
  for (const arg of argv) {
    if (arg === "--dry") args.dry = true;
    else if (arg === "--prune") args.prune = true;
    else if (arg.startsWith("--site=")) args.site = arg.slice(7).toLowerCase();
  }
  return args;
}

function preview(events: Awaited<ReturnType<SiteCrawler["run"]>>) {
  for (const e of events) {
    const date = new Date(e.startsAt).toISOString().slice(0, 16).replace("T", " ");
    const price = [e.priceEarly, e.priceNormal].some((p) => p != null)
      ? `${e.priceEarly ?? "?"}–${e.priceNormal ?? "?"} €`
      : "n/a";
    console.log(
      `  ${date}  ${price.padEnd(11)} ${(e.venueName ?? "?").padEnd(22)} ${e.title.slice(0, 58)}` +
        `\n            genres: [${e.genres.join(", ")}]  url: ${e.url}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = CRAWLERS.filter((c) => !args.site || c.id.includes(args.site) || c.label.toLowerCase().includes(args.site));
  if (selected.length === 0) {
    console.error(`No crawler matches --site=${args.site}. Known: ${CRAWLERS.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }

  for (const crawler of selected) {
    console.log(`\n▶ ${crawler.label} (${crawler.id})`);
    try {
      const raw = await crawler.run();
      const events = finalizeEvents(raw).sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
      console.log(`  ${raw.length} fetched, ${events.length} after filters (Madrid, future, valid)`);

      if (args.dry) {
        preview(events);
        continue;
      }
      await upsertEvents(events);
      console.log(`  ✓ upserted ${events.length} events`);
      if (args.prune) {
        const removed = await prunePastEvents(crawler.id);
        console.log(`  ✓ pruned ${removed} past events`);
      }
    } catch (error) {
      console.error(`  ✗ ${crawler.id} failed: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
