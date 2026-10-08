-- 025_tax_pack.sql (Plan 35) — apply at merge, after 022–024.
-- Puerto Rico tax and finance pack: the owner's tax residency (which report is
-- the default), CRIM account data per property, CRIM bills, and non-binding
-- depreciation inputs for the year-end package. Idempotent.

-- ── Owner tax profile ──────────────────────────────────────────────────────
-- 'pr_resident': bona fide PR resident (Hacienda, Planilla / Anejo N).
-- 'non_resident': reports on IRS Schedule E. NULL: not chosen yet.
alter table public.profiles add column if not exists tax_residency text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_tax_residency_check') then
    alter table public.profiles
      add constraint profiles_tax_residency_check check (tax_residency in ('pr_resident', 'non_resident'));
  end if;
end $$;
-- Profiles use column-level UPDATE grants (011, 021).
grant update (tax_residency) on public.profiles to authenticated;

-- ── CRIM account per property ──────────────────────────────────────────────
create table if not exists public.property_crim (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null unique references public.properties(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  catastro_number     text check (char_length(catastro_number) <= 40),
  account_number      text check (char_length(account_number) <= 40),
  municipality        text check (char_length(municipality) <= 60),
  assessed_value      numeric(12,2) check (assessed_value >= 0 and assessed_value <= 100000000),
  exemption_principal_residence boolean not null default false,
  exoneration_amount  numeric(12,2) check (exoneration_amount >= 0 and exoneration_amount <= 100000000),
  notes               text check (char_length(notes) <= 1000),
  -- Depreciation inputs for the year-end package (non-binding, owner-entered).
  purchase_price      numeric(12,2) check (purchase_price >= 0 and purchase_price <= 1000000000),
  building_pct        numeric(5,2) check (building_pct >= 0 and building_pct <= 100),
  placed_in_service   date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists property_crim_owner_idx on public.property_crim (owner_id);

-- ── CRIM bills ─────────────────────────────────────────────────────────────
-- CRIM bills by fiscal year (July–June) in installments; 1–4 allowed so the
-- app does not hard-code the billing calendar. Corrected by voiding.
create table if not exists public.crim_bills (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  owner_id          uuid not null references auth.users(id) on delete cascade,
  fiscal_year       text not null check (fiscal_year ~ '^[0-9]{4}-[0-9]{2}$'),
  installment       smallint not null check (installment between 1 and 4),
  amount            numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  due_date          date not null,
  paid_on           date,
  payment_reference text check (char_length(payment_reference) <= 100),
  expense_id        uuid references public.property_expenses(id) on delete set null,
  voided_at         timestamptz,
  void_reason       text check (char_length(void_reason) <= 300),
  created_at        timestamptz not null default now()
);
create unique index if not exists crim_bills_once
  on public.crim_bills (property_id, fiscal_year, installment) where voided_at is null;
create index if not exists crim_bills_owner_due_idx on public.crim_bills (owner_id, due_date);
create index if not exists crim_bills_property_idx on public.crim_bills (property_id);
create index if not exists crim_bills_expense_idx on public.crim_bills (expense_id) where expense_id is not null;

-- ── RLS: owners manage their own properties' CRIM data ─────────────────────
alter table public.property_crim enable row level security;
alter table public.crim_bills    enable row level security;

drop policy if exists property_crim_owner on public.property_crim;
create policy property_crim_owner on public.property_crim for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

drop policy if exists crim_bills_owner on public.crim_bills;
create policy crim_bills_owner on public.crim_bills for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))
              and (expense_id is null
                   or exists (select 1 from public.property_expenses e
                              where e.id = expense_id and e.user_id = (select auth.uid()) and e.property_id = crim_bills.property_id)));

revoke all on public.property_crim, public.crim_bills from anon;
grant select, insert, update on public.property_crim, public.crim_bills to authenticated;
-- Bills are evidence: corrected by voiding, never deleted.
revoke delete on public.property_crim, public.crim_bills from authenticated;
