-- 018_investment_analyses.sql (Plan 28) — apply at merge.
-- Migration 002 was never applied to production, so the investment calculator
-- (/watchlist/[id]/analyze, /api/investment/[watchlistId]) fails there today.
-- Same table as 002, with initplan-friendly policies scoped to authenticated.

create table if not exists public.investment_analyses (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users on delete cascade,
  watchlist_id         uuid not null references public.watchlist(id) on delete cascade,
  purchase_price       numeric not null check (purchase_price > 0),
  down_payment_pct     numeric not null default 20,
  closing_cost_pct     numeric not null default 3,
  mortgage_rate_pct    numeric not null default 7.0,
  loan_term_years      int     not null default 30,
  annual_tax_pct       numeric not null default 1.1,
  annual_insurance_pct numeric not null default 0.8,
  maintenance_pct      numeric not null default 1.0,
  monthly_hoa          numeric not null default 0,
  monthly_utilities    numeric not null default 150,
  estimated_rent       numeric,
  vacancy_rate_pct     numeric not null default 5,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (owner_id, watchlist_id)
);

create index if not exists investment_analyses_watchlist_idx on public.investment_analyses (watchlist_id);

alter table public.investment_analyses enable row level security;
create policy investment_analyses_own on public.investment_analyses
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger investment_analyses_updated_at
  before update on public.investment_analyses
  for each row execute function public.touch_updated_at();
