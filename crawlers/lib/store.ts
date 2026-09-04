/**
 * Supabase writer for crawlers — uses the SERVICE ROLE key (bypasses RLS).
 * Only ever run locally; never expose this key to the deployed app.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CrawlerEvent } from "./types";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const problems: string[] = [];
  if (!url || /YOUR-/.test(url)) problems.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key || /YOUR-/.test(key)) problems.push("SUPABASE_SERVICE_ROLE_KEY");
  if (problems.length > 0) {
    throw new Error(
      `${problems.join(" and ")} ${problems.length > 1 ? "are" : "is"} not set (or still the placeholder) in .env.local.\n` +
        "Find both in Supabase → Project Settings → API (the service_role key is the secret one).\n" +
        "Note: the crawler needs the service_role key, not the anon key.",
    );
  }
  // url/key are guaranteed real values here — placeholders threw above.
  client = createClient(url!, key!, { auth: { persistSession: false } });
  return client;
}

function toRow(e: CrawlerEvent) {
  return {
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
    raw: e.raw ?? null,
  };
}

/** Upsert in chunks; (source, external_id) is the conflict key. */
export async function upsertEvents(events: CrawlerEvent[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const rows = events.map(toRow);
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("events")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "source,external_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }
}

/** Remove a source's events that already started (housekeeping). */
export async function prunePastEvents(source: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .eq("source", source)
    .lt("starts_at", new Date().toISOString());
  if (error) throw new Error(`Prune failed: ${error.message}`);
  return count ?? 0;
}

/** Delete specific rows (source + external ids) — used for stale duplicates. */
export async function deleteEvents(source: string, externalIds: string[]): Promise<number> {
  if (externalIds.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  let deleted = 0;
  const CHUNK = 200;
  for (let i = 0; i < externalIds.length; i += CHUNK) {
    const { count, error } = await supabase
      .from("events")
      .delete({ count: "exact" })
      .eq("source", source)
      .in("external_id", externalIds.slice(i, i + CHUNK));
    if (error) throw new Error(`Delete failed: ${error.message}`);
    deleted += count ?? 0;
  }
  return deleted;
}
