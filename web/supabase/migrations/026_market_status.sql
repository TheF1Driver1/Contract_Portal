-- 026_market_status.sql — Plan 40 (Market data 2.0)
--
-- 1. rea.scrape_runs: one row per run of the Zillow scraper
--    (Real-Estate-Search-Automation, back_end/postgresql_db.py creates the
--    same table idempotently; keep the two definitions in sync).
-- 2. public.market_data_updated_at(): SECURITY DEFINER function returning the
--    latest successful finished_at. The web app calls it as an RPC. We use a
--    function rather than a security_invoker view so `authenticated` never
--    needs SELECT on rea.scrape_runs (whose `error` column may hold
--    connection details); only one timestamp leaves the schema.
-- 3. public.zillow_market gains "rentZestimate" and "livingArea" (appended,
--    so CREATE OR REPLACE keeps grants) for rent comps and gross yield.
-- 4. Data hygiene: primary key on rea.zillow_historical, indexes for the
--    history lookup and the market filters, unaccent extension.
--
-- Idempotent: safe to run more than once. Skips sections whose rea tables do
-- not exist (e.g. a fresh project before the scraper's first run).
-- Future (not done here): PostGIS geography column + GiST index for radius comps.

create schema if not exists rea;

-- ---------------------------------------------------------------------------
-- 1. Scrape run log
-- ---------------------------------------------------------------------------
create table if not exists rea.scrape_runs (
  id             bigserial primary key,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  ok             boolean not null default false,
  pages          integer,
  rows_fetched   integer,
  rows_upserted  integer,
  rows_changed   integer,
  error          text
);

create index if not exists scrape_runs_ok_finished_idx
  on rea.scrape_runs (finished_at desc) where ok;

-- Written only by the scraper (table owner / service connection). No API
-- role reads it directly: RLS on with no policies, and no grants.
alter table rea.scrape_runs enable row level security;
revoke all on rea.scrape_runs from public;
revoke all on rea.scrape_runs from anon, authenticated;
revoke all on sequence rea.scrape_runs_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Freshness RPC
-- ---------------------------------------------------------------------------
create or replace function public.market_data_updated_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(finished_at) from rea.scrape_runs where ok
$$;

comment on function public.market_data_updated_at() is
  'Latest successful Zillow scrape (rea.scrape_runs). Plan 40.';

revoke all on function public.market_data_updated_at() from public;
revoke all on function public.market_data_updated_at() from anon;
grant execute on function public.market_data_updated_at() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Market view: expose rentZestimate and livingArea
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('rea.zillow_unique') is null then
    raise notice '026: rea.zillow_unique missing; skipping view and indexes';
    return;
  end if;

  -- Columns from 001 / the scraper's first run; make sure they exist before the view uses them.
  alter table rea.zillow_unique add column if not exists last_updated_date timestamptz default now();
  alter table rea.zillow_unique add column if not exists "rentZestimate" integer;
  alter table rea.zillow_unique add column if not exists "livingArea" integer;

  -- Same column list and order as the existing view, two columns appended.
  create or replace view public.zillow_market as
    select id, price, beds, baths, street, city, state, zipcode, latitude, longitude,
           "imgSrc", "detailUrl", "homeType", "homeStatus", "daysOnZillow",
           last_updated_date, original_price, num_price_cuts, total_price_cut,
           price_cut_pct, daily_price_cut_rate, last_cut_date, desperation_score,
           "rentZestimate", "livingArea"
      from rea.zillow_unique;

  revoke all on public.zillow_market from anon;
  grant select on public.zillow_market to authenticated;

  create index if not exists zillow_unique_city_idx on rea.zillow_unique (city);
  create index if not exists zillow_unique_home_status_idx on rea.zillow_unique ("homeStatus");
end
$$;

-- ---------------------------------------------------------------------------
-- 4. zillow_historical: primary key + lookup index
-- ---------------------------------------------------------------------------
-- The table is an append-only snapshot log keyed by property_id (FK to
-- zillow_unique.id); its "id" column repeats the Zillow id per snapshot, so
-- there is no natural key. Add a surrogate identity column as the PK.
do $$
begin
  if to_regclass('rea.zillow_historical') is null then
    raise notice '026: rea.zillow_historical missing; skipping';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'rea.zillow_historical'::regclass and contype = 'p'
  ) then
    alter table rea.zillow_historical
      add column if not exists row_id bigint generated by default as identity;
    alter table rea.zillow_historical
      add constraint zillow_historical_pkey primary key (row_id);
  end if;

  -- Serves: SELECT DISTINCT ON (property_id) ... WHERE property_id = ANY(:ids)
  --         ORDER BY property_id, last_updated_date DESC, last_updated_time DESC
  create index if not exists zillow_historical_property_updated_idx
    on rea.zillow_historical (property_id, last_updated_date desc, last_updated_time desc);
end
$$;

-- ---------------------------------------------------------------------------
-- 5. unaccent (for future accent-insensitive municipality search in SQL)
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
do $$
begin
  create extension if not exists unaccent with schema extensions;
exception when others then
  raise notice '026: unaccent not available (%); skipping', sqlerrm;
end
$$;
