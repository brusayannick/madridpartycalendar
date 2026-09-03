/**
 * Cross-source deduplication.
 *
 * Two duplicate classes, both within the PATT platform:
 *
 * 1. The same event id sold by several promoters — nightlifemadrid and First
 *    Circle both list "Irreverente Rooftop" with the identical id.
 * 2. The same night listed as SEPARATE event entries — "MUTUALS" and
 *    "Houdinni x First Circle" are different ids but same venue, same start,
 *    same prices. A venue cannot host two events at the same start time, so
 *    same normalized venue + exact start is treated as one night.
 *
 * Dropped rows are also deleted from the DB so old duplicates disappear.
 */
import type { CrawlerEvent } from "./types";

/** Preferred source for the same underlying event, best first. */
const SOURCE_PRIORITY = ["nightlifemadrid", "patt_firstcircle"];

/** Sources on the same platform whose listings overlap. */
const PATT_FAMILY = new Set(["nightlifemadrid", "patt_firstcircle"]);

export interface DedupeResult {
  kept: CrawlerEvent[];
  /** Dropped rows — also deleted from the DB so old duplicates disappear. */
  removed: CrawlerEvent[];
}

function priority(source: string): number {
  const index = SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? SOURCE_PRIORITY.length : index;
}

/** Normalized venue identity: lowercase, accent-free, alphanumeric. */
function venueKey(name: string | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pickOne(list: CrawlerEvent[]): CrawlerEvent {
  // Preferred source first; deterministic tie-break on title.
  return [...list].sort(
    (a, b) => priority(a.source) - priority(b.source) || a.title.localeCompare(b.title),
  )[0];
}

export function dedupeAcrossSources(events: CrawlerEvent[]): DedupeResult {
  // Pass 1: identical external id + start.
  const byId = new Map<string, CrawlerEvent[]>();
  for (const event of events) {
    const key = `${event.externalId}|${event.startsAt}`;
    const list = byId.get(key);
    if (list) list.push(event);
    else byId.set(key, [event]);
  }

  const afterPass1: CrawlerEvent[] = [];
  const removed: CrawlerEvent[] = [];
  for (const list of byId.values()) {
    if (list.length === 1) {
      afterPass1.push(list[0]);
      continue;
    }
    const winner = pickOne(list);
    afterPass1.push(winner);
    removed.push(...list.filter((e) => e !== winner));
  }

  // Pass 2: same venue + exact start within the same platform family
  // (same night under different event ids / titles).
  const byNight = new Map<string, CrawlerEvent[]>();
  for (const event of afterPass1) {
    if (!PATT_FAMILY.has(event.source) || !event.venueName) continue;
    const key = `${venueKey(event.venueName)}|${event.startsAt}`;
    const list = byNight.get(key);
    if (list) list.push(event);
    else byNight.set(key, [event]);
  }

  const dropped = new Set(removed);
  for (const list of byNight.values()) {
    if (list.length <= 1) continue;
    const winner = pickOne(list);
    for (const event of list) {
      if (event !== winner) dropped.add(event);
    }
  }

  const droppedSet = dropped;
  return {
    kept: afterPass1.filter((e) => !droppedSet.has(e)),
    removed: [...droppedSet],
  };
}
