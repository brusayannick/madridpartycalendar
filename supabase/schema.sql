-- Madrid Party Calendar — events table
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  source text not null,                    -- crawler id, e.g. 'nightlifemadrid', 'patt_firstcircle', 'erasmusmadrid'
  external_id text not null,               -- source-unique id (stable across runs)
  title text not null,
  description text,
  starts_at timestamptz not null,          -- Europe/Madrid
  ends_at timestamptz,
  url text not null,                       -- event / ticket page
  image_url text,
  venue_name text,
  venue_address text,
  gmaps_url text,                          -- Google Maps search link for the venue
  latitude numeric(9,6),                   -- venue coords for map views
  longitude numeric(9,6),
  city text not null default 'Madrid',
  genres text[] not null default '{}',
  price_early numeric(8,2),                -- cheapest standard entry tier (0 = free entry)
  price_normal numeric(8,2),               -- regular / door tier
  price_early_male numeric(8,2),           -- men's price when gender-specific tiers exist
  price_normal_male numeric(8,2),
  price_early_female numeric(8,2),         -- women's price when gender-specific tiers exist
  price_normal_female numeric(8,2),
  tickets_sale_at timestamptz,             -- when ticket sales open (if announced)
  tickets_sale_note text,                  -- raw announcement text when not parseable
  currency text not null default 'EUR',
  raw jsonb,                               -- original crawler payload for debugging
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_genres_idx on public.events using gin (genres);

-- Migration for databases created before ticket-sale info existed:
-- alter table public.events
--   add column if not exists tickets_sale_at timestamptz,
--   add column if not exists tickets_sale_note text;

-- Migration for databases created before gender-specific prices existed:
-- alter table public.events
--   add column if not exists price_early_male numeric(8,2),
--   add column if not exists price_normal_male numeric(8,2),
--   add column if not exists price_early_female numeric(8,2),
--   add column if not exists price_normal_female numeric(8,2);

-- Migration for databases created before venue coordinates existed:
-- alter table public.events
--   add column if not exists latitude numeric(9,6),
--   add column if not exists longitude numeric(9,6);

-- Keep updated_at fresh on upserts.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

-- Public read-only access; only the service role (crawlers) can write.
alter table public.events enable row level security;

drop policy if exists "events are publicly readable" on public.events;
create policy "events are publicly readable"
  on public.events for select
  to anon, authenticated
  using (true);
