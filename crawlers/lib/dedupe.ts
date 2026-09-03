/**
 * Cross-source deduplication.
 *
 * The same event can be sold by several promoters on the same platform:
 * nightlifemadrid and First Circle both list "Irreverente Rooftop" with the
 * identical PATT event id. When two crawled events share an externalId and
 * start time, keep only the row from the preferred source (first entry wins).
 */
import type { CrawlerEvent } from "./types";

/** Preferred source for the same underlying event, best first. */
const SOURCE_PRIORITY = ["nightlifemadrid", "patt_firstcircle"];

export interface DedupeResult {
  kept: CrawlerEvent[];
  /** Dropped rows — also deleted from the DB so old duplicates disappear. */
  removed: CrawlerEvent[];
}

export function dedupeAcrossSources(events: CrawlerEvent[]): DedupeResult {
  const priority = (source: string) => {
    const index = SOURCE_PRIORITY.indexOf(source);
    return index === -1 ? SOURCE_PRIORITY.length : index;
  };

  const groups = new Map<string, CrawlerEvent[]>();
  for (const event of events) {
    const key = `${event.externalId}|${event.startsAt}`;
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  }

  const kept: CrawlerEvent[] = [];
  const removed: CrawlerEvent[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      kept.push(list[0]);
      continue;
    }
    list.sort((a, b) => priority(a.source) - priority(b.source));
    kept.push(list[0]);
    removed.push(...list.slice(1));
  }
  return { kept, removed };
}
