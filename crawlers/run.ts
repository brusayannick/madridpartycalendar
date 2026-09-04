/**
 * Crawler CLI — run locally:
 *
 *   npm run crawl                      # all sites → upsert into Supabase
 *   npm run crawl -- --dry             # print what would be stored, write nothing
 *   npm run crawl -- --site=patt       # filter by site id (substring match)
 *   npm run crawl -- --prune           # also delete past events of crawled sources
 */
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { erasmusMadrid } from "./sites/erasmusmadrid";
import { nightlifeMadrid, pattFirstCircle } from "./sites/patt";
import { esnUpm } from "./sites/eventupp";
import { whan } from "./sites/whan";
import { fourvenuesErasmusTouch } from "./sites/fourvenues";
import { entryos } from "./sites/entryos";
import { raMadrid } from "./sites/ra";
import { dedupeAcrossSources } from "./lib/dedupe";
import { finalizeEvents } from "./lib/finalize";
import { deleteEvents, prunePastEvents, upsertEvents } from "./lib/store";
import type { CrawlerEvent, SiteCrawler } from "./lib/types";

/**
 * Load .env.local (wins) then .env, without letting a placeholder value
 * shadow a real one from the other file. Never overrides real process env.
 */
function loadEnvFiles(paths: string[]): void {
  const merged: Record<string, string> = {};
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parse(readFileSync(path)))) {
      const isPlaceholder = /YOUR-/.test(value);
      if (!isPlaceholder || !(key in merged)) merged[key] = value;
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFiles([".env", ".env.local"]);

const CRAWLERS: SiteCrawler[] = [
  nightlifeMadrid,
  pattFirstCircle,
  erasmusMadrid,
  esnUpm,
  whan,
  fourvenuesErasmusTouch,
  entryos,
  raMadrid,
];

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
    const sale = e.ticketsSaleAt
      ? `  sales-open: ${e.ticketsSaleAt.slice(0, 16).replace("T", " ")}`
      : e.ticketsSaleNote
        ? `  sales-open: "${e.ticketsSaleNote}"`
        : "";
    console.log(
      `  ${date}  ${price.padEnd(11)} ${(e.venueName ?? "?").padEnd(22)} ${e.title.slice(0, 58)}` +
        `\n            genres: [${e.genres.join(", ")}]${sale}  url: ${e.url}`,
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

  // 1) Crawl every source and collect normalized events.
  const collected: CrawlerEvent[] = [];
  for (const crawler of selected) {
    console.log(`\n▶ ${crawler.label} (${crawler.id})`);
    try {
      const raw = await crawler.run();
      const events = await finalizeEvents(raw);
      collected.push(...events);
      console.log(`  ${raw.length} fetched, ${events.length} after filters (Madrid, future, valid)`);
    } catch (error) {
      console.error(`  ✗ ${crawler.id} failed: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }

  // 2) Drop the same event listed by several promoters (e.g. nightlifemadrid
  //    and First Circle both sell "Irreverente Rooftop").
  const { kept, removed } = dedupeAcrossSources(collected);
  kept.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (removed.length > 0) {
    console.log(`\n⨯ dropped ${removed.length} cross-listed duplicate(s)`);
  }

  // 3) Write (or preview).
  if (args.dry) {
    preview(kept);
    return;
  }

  if (kept.length > 0) {
    await upsertEvents(kept);
    console.log(`\n✓ upserted ${kept.length} events`);
  }

  // Remove duplicate rows from previous runs (lower-priority source copies).
  const removedBySource = new Map<string, string[]>();
  for (const event of removed) {
    const ids = removedBySource.get(event.source) ?? [];
    ids.push(event.externalId);
    removedBySource.set(event.source, ids);
  }
  for (const [source, ids] of removedBySource) {
    const deleted = await deleteEvents(source, ids);
    if (deleted > 0) console.log(`  ✓ deleted ${deleted} stale ${source} duplicate(s)`);
  }

  if (args.prune) {
    for (const crawler of selected) {
      const pruned = await prunePastEvents(crawler.id);
      if (pruned > 0) console.log(`  ✓ pruned ${pruned} past ${crawler.id} events`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
