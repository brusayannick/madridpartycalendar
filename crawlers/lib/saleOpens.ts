/**
 * Parse "when do ticket sales open" announcements from free text
 * (tier names, event descriptions). Sources announce this in prose, e.g.:
 *
 *   "TICKET SALES OPEN THURSDAY, SEPTEMBER 3RD AT 18:00 (6PM)!"   (PATT tier)
 *   "Start sale: 8/26/2026 at 7:00pm"                             (TEC text)
 *   "Sales open on 15 Sep at 12:00"
 *
 * Returns a UTC ISO string (Madrid wall time assumed) and, when a
 * sale-related phrase was found but not parseable, the raw note instead.
 */
import { madridToUtc } from "./time";

export interface SaleOpens {
  at?: string;
  note?: string;
}

const WEEKDAYS =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun";
const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|" +
  "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

const MONTH_INDEX: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const TRIGGER_RE = new RegExp(
  `(?:sales?|tickets?)\\s+(?:open|opens|opening|start|starts|begin|begins|available)\\b` +
    `|\\b(?:start|begin)\\s+sale\\b|\\bsales?\\s+open\\b|\\bon\\s+sale\\s+(?:from|at)\\b`,
  "i",
);

function monthFromName(name: string): number {
  return MONTH_INDEX[name.toLowerCase().replace(/[^a-z]/g, "")] ?? 0;
}

/** "18:00", "6pm", "6:30 pm" → minutes since midnight (Madrid). */
function parseTime(h: string, m: string | undefined, ampm: string | undefined): number {
  let hour = Number(h);
  const minute = m ? Number(m) : 0;
  if (ampm?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (ampm?.toLowerCase() === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function toIso(y: number, m: number, d: number, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return madridToUtc(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    `${hh}:${mm}`,
  );
}

/**
 * @param text        haystack (tier name, description, …)
 * @param eventStart  ISO start of the event the announcement belongs to —
 *                    used to infer the year and sanity-check the result.
 */
export function parseSaleOpens(text: string, eventStart: string): SaleOpens | undefined {
  if (!text) return undefined;
  const trigger = text.match(TRIGGER_RE);
  if (!trigger) return undefined;

  const eventStartMs = new Date(eventStart).getTime();
  const eventYear = new Date(eventStart).getUTCFullYear();

  const tryCandidates = (dates: Array<{ y: number; m: number; d: number; min: number }>): string | undefined => {
    for (const { y, m, d, min } of dates) {
      const ms = new Date(toIso(y, m, d, min)).getTime();
      // Announcements point at a moment before (or shortly after) the event.
      if (ms <= eventStartMs + 24 * 60 * 60 * 1000) return toIso(y, m, d, min);
    }
    return undefined;
  };

  // Pattern 1: "SALES OPEN THURSDAY, SEPTEMBER 3RD AT 18:00 (6PM)"
  const p1 = new RegExp(
    `(?:sales?\\s+open|open)\\s+(?:on\\s+)?(?:${WEEKDAYS})\\s*,?\\s+(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:at|from|,)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?`,
    "i",
  );
  const m1 = text.match(p1);
  if (m1) {
    const month = monthFromName(m1[1]);
    const day = Number(m1[2]);
    const min = parseTime(m1[3], m1[4], m1[5]);
    const iso = tryCandidates(
      [{ y: eventYear, m: month, d: day, min }, { y: eventYear + 1, m: month, d: day, min }],
    );
    if (iso) return { at: iso };
  }

  // Pattern 2: "Start sale: 8/26/2026 at 7:00pm" or "sales open 26/08/2026 19:00"
  const p2 = new RegExp(
    `(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\s+(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?`,
    "i",
  );
  const m2 = text.match(p2);
  if (m2) {
    const a = Number(m2[1]);
    const b = Number(m2[2]);
    const yearRaw = m2[3] ? Number(m2[3]) : eventYear;
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const min = parseTime(m2[4], m2[5], m2[6]);
    // US style M/D when first ≤ 12 and second > 12, otherwise D/M.
    const useUS = a <= 12 && b > 12;
    const month = useUS ? a : b;
    const day = useUS ? b : a;
    const iso = tryCandidates([{ y: year, m: month, d: day, min }]);
    if (iso) return { at: iso };
  }

  // Pattern 3: "sales open on 15 Sep at 12:00" (day month)
  const p3 = new RegExp(
    `(?:sales?\\s+open|open)\\s+(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\s+(?:at|from)?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?`,
    "i",
  );
  const m3 = text.match(p3);
  if (m3) {
    const day = Number(m3[1]);
    const month = monthFromName(m3[2]);
    const min = parseTime(m3[3], m3[4], m3[5]);
    const iso = tryCandidates(
      [{ y: eventYear, m: month, d: day, min }, { y: eventYear + 1, m: month, d: day, min }],
    );
    if (iso) return { at: iso };
  }

  // Matched a sale-announcement phrase but could not parse a date — keep the sentence.
  const start = trigger.index ?? 0;
  const sentence = text
    .slice(start, start + 120)
    .split(/[.!?\n]/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return sentence.length > 3 ? { note: sentence } : undefined;
}
