/**
 * Timezone + text utilities. All source sites express times in Europe/Madrid
 * wall time (some already as UTC ISO strings, some as "23:00" + date).
 */

const MADRID_TZ = "Europe/Madrid";

function tzOffsetMs(utcDate: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(utcDate)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
  return asUtc - utcDate.getTime();
}

/**
 * Convert Madrid wall time to a UTC ISO string.
 * Input: "2026-09-05T23:00" or { date: "2026-09-05", time: "23:00" }.
 */
export function madridToUtc(date: string, time = "00:00"): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ts = naive;
  for (let i = 0; i < 3; i++) {
    ts = naive - tzOffsetMs(new Date(ts), MADRID_TZ);
  }
  return new Date(ts).toISOString();
}

/** Current time in Madrid as "YYYY-MM-DD". */
export function madridToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MADRID_TZ }).format(new Date());
}

/** Strip HTML → plain text, collapse whitespace, trim to maxLen chars. */
export function htmlToText(html: string | null | undefined, maxLen = 1500): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ ?\n ?/g, "\n")
    .trim();
  if (!text) return undefined;
  return text.length > maxLen ? `${text.slice(0, maxLen).trimEnd()}…` : text;
}

/** "12,50 €" | "12.50€" | "€12.50" | "7" → 12.5 */
export function parsePrice(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // European format "12,50" → 12.5; keep the last separator as decimal.
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/,/g, "") // "1.234,50"
      : cleaned.replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/** "2026-09-05T23:00:00+02:00" | "2026-09-05 23:00" → ISO string or null. */
export function toIsoString(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Already ISO with offset/Z.
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }
  // ISO date + time without offset → assume Madrid wall time.
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) return madridToUtc(m[1], m[2]);
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
