/**
 * Genre taxonomy: normalize what sources provide (PATT `music_type`) and
 * infer genres from titles/descriptions for sources that have none
 * (erasmusmadrid). Edit the maps below to tune tags — no schema change needed.
 */

/** Canonical genres shown in the app's filter UI. */
export const GENRE_TAXONOMY = [
  "Techno",
  "House",
  "Tech House",
  "Afro House",
  "Melodic House",
  "Commercial House",
  "Latin House",
  "Commercial",
  "Amapiano",
  "Electronica",
  "EDM",
  "Trance",
  "Drum & Bass",
  "Reggaeton",
  "Latin",
  "Salsa & Bachata",
  "Hip-Hop",
  "R&B",
  "Pop",
  "Top 40",
  "Funk & Disco",
  "Jazz & Soul",
  "Rock",
  "Live Music",
  "Karaoke",
  "Pub Crawl",
  "Pool Party",
  "Language Exchange",
  "Party",
] as const;

export type Genre = (typeof GENRE_TAXONOMY)[number];

/** Map messy source tags onto the taxonomy; unmapped tags pass through. */
const NORMALIZE: Record<string, string> = {
  "commercial house": "Commercial House",
  commercial: "Commercial",
  comercial: "Commercial",
  "latin house": "Latin House",
  house: "House",
  "tech house": "Tech House",
  "afro house": "Afro House",
  afro: "Afro House",
  "melodic house": "Melodic House",
  melodic: "Melodic House",
  amapiano: "Amapiano",
  techno: "Techno",
  electronica: "Electronica",
  electronic: "Electronica",
  dance: "EDM",
  bachata: "Salsa & Bachata",
  salsa: "Salsa & Bachata",
  urban: "Hip-Hop",
  edm: "EDM",
  trance: "Trance",
  "drum and bass": "Drum & Bass",
  "drum n bass": "Drum & Bass",
  dnb: "Drum & Bass",
  reggaeton: "Reggaeton",
  regeton: "Reggaeton",
  latin: "Latin",
  latina: "Latin",
  "hip hop": "Hip-Hop",
  hiphop: "Hip-Hop",
  rap: "Hip-Hop",
  rnb: "R&B",
  "r&b": "R&B",
  pop: "Pop",
  "top 40": "Top 40",
  funk: "Funk & Disco",
  disco: "Funk & Disco",
  jazz: "Jazz & Soul",
  soul: "Jazz & Soul",
  rock: "Rock",
  live: "Live Music",
  "live music": "Live Music",
  "concert": "Live Music",
  karaoke: "Karaoke",
};

/** Keyword → genres, applied to title + description when a source has none. */
const INFER_RULES: Array<[RegExp, string[]]> = [
  [/\bpub\s*crawl|bar\s*crawl|botell[oó]n\s*tour\b/i, ["Pub Crawl"]],
  [/\bpool\s*party|beach\s*club\b/i, ["Pool Party"]],
  [/language\s*exchange|meet\s*&&?\s*speak|intercambio\b/i, ["Language Exchange"]],
  [/\btechno\b/i, ["Techno"]],
  [/\bafro\s*house|\bamapiano\b/i, ["Afro House", "Amapiano"]],
  [/\bmelodic\s*house\b/i, ["Melodic House"]],
  [/\btech\s*house\b/i, ["Tech House"]],
  [/\bcommercial\s*house\b/i, ["Commercial House"]],
  [/\bhouse\b(?!.*afro)/i, ["House"]],
  [/\breggaet[oó]n|perreo|latino\s*party|latin\s*party|bachata|salsa\b/i, ["Reggaeton", "Latin"]],
  [/\bhip\s*hop|rap\s*battle|\btrap\b/i, ["Hip-Hop"]],
  [/\br&b\b/i, ["R&B"]],
  [/\btop\s*40|commercial\s*(music|hits)\b/i, ["Top 40"]],
  [/\bfunk|\bdisco\b/i, ["Funk & Disco"]],
  [/\bjazz|\bsoul\b/i, ["Jazz & Soul"]],
  [/\brock\b(?!.*roller)/i, ["Rock"]],
  [/\blive\s*(band|music|concert|performance)\b|\bconcierto\b/i, ["Live Music"]],
  [/\bkaraoke\b/i, ["Karaoke"]],
  [/\bparty|fiesta|club\s*night|discoteca\b/i, ["Party"]],
];

function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "&")
    .replace(/\bDnb\b/g, "DnB")
    .replace(/\bEdm\b/g, "EDM")
    .replace(/\bR&b\b/g, "R&B");
}

/** Normalize an array of source-provided genre tags. */
export function normalizeGenres(tags: Array<string | null | undefined> | null | undefined): string[] {
  if (!tags) return [];
  const out = new Set<string>();
  for (const tag of tags) {
    if (!tag) continue;
    // Source tags arrive messy ("Pop ", "Italian:, Urban") — split, keep letters/&/-.
    const parts = tag.split(/[,/]/);
    for (const part of parts) {
      const cleaned = part.replace(/[^\p{L}\s&-]/gu, " ").replace(/\s+/g, " ").trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      out.add(NORMALIZE[key] ?? titleCase(cleaned));
    }
  }
  return [...out];
}

/** Infer genres from title/description text (sources without genre data). */
export function inferGenres(...texts: Array<string | null | undefined>): string[] {
  const text = texts.filter(Boolean).join(" \n ");
  if (!text) return [];
  const out = new Set<string>();
  for (const [re, genres] of INFER_RULES) {
    if (re.test(text)) genres.forEach((g) => out.add(g));
  }
  // A lone generic "Party" tag adds noise when something specific matched.
  if (out.size > 1) out.delete("Party");
  return [...out];
}
