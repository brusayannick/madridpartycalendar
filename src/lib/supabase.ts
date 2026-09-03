import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EventRow } from "./events";

export function hasSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !/YOUR-/.test(url) && !/YOUR-/.test(key));
}

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return cached;
}

/** Upcoming events (incl. ones that started < 12h ago), oldest first. */
export async function fetchUpcomingEvents(): Promise<EventRow[]> {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from("events")
    .select(
      "id,source,external_id,title,description,starts_at,ends_at,url,image_url,venue_name,venue_address,gmaps_url,city,genres,price_early,price_normal,price_early_male,price_normal_male,price_early_female,price_normal_female,tickets_sale_at,tickets_sale_note,currency",
    )
    .gte("starts_at", since)
    .order("starts_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data ?? []) as EventRow[];
}
