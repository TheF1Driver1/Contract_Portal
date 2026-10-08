-- 022_rent_ledger.sql (Plan 33) — apply at merge, after 021.
-- A rent ledger per lease: monthly charges, late fees from the lease's policy,
-- and payments. Rent goes straight to the landlord; ContractOS never holds it.

-- Turning the ledger on for a lease (kept outside `contracts`, whose signed
-- rows are immutable). Charges are posted from `started_on` forward, so
-- enabling it never back-fills years of "overdue" rent.
create table if not exists public.rent_ledgers (
  contract_id uuid primary key references public.contracts(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  started_on  date not null,
  late_fees   boolean not null default true,   -- post late fees automatically
  created_at  timestamptz not null default now()
);
create index if not exists rent_ledgers_owner_idx on public.rent_ledgers (owner_id);

create table if not exists public.rent_charges (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('rent', 'late_fee', 'other')),
  period      date,                            -- first day of the month (rent, late_fee)
  due_date    date not null,
  amount      numeric(10,2) not null check (amount > 0 and amount <= 1000000),
  description text check (char_length(description) <= 200),
  voided_at   timestamptz,
  void_reason text check (char_length(void_reason) <= 300),
  created_at  timestamptz not null default now(),
  check ((kind = 'other') = (period is null))
);
-- One rent charge and one late fee per lease and month, even if jobs overlap.
create unique index if not exists rent_charges_once
  on public.rent_charges (contract_id, kind, period) where kind in ('rent', 'late_fee');
create index if not exists rent_charges_owner_due_idx on public.rent_charges (owner_id, due_date);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  number       bigint generated always as identity unique,   -- receipt number
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  amount       numeric(10,2) not null check (amount > 0 and amount <= 1000000),
  method       text not null check (method in ('ath_movil', 'ach', 'card', 'cash', 'check', 'transfer', 'other')),
  received_on  date not null,
  reference    text check (char_length(reference) <= 100),
  note         text check (char_length(note) <= 500),
  source       text not null default 'manual' check (source in ('manual', 'ath_movil', 'stripe')),
  external_id  text unique,                    -- provider transaction id (idempotent webhooks)
  receipt_sent_at timestamptz,
  voided_at    timestamptz,
  void_reason  text check (char_length(void_reason) <= 300),
  created_at   timestamptz not null default now()
);
create index if not exists payments_contract_idx on public.payments (contract_id, received_on);
create index if not exists payments_owner_received_idx on public.payments (owner_id, received_on);

-- ── RLS: landlords manage their own books ──────────────────────────────────
alter table public.rent_ledgers enable row level security;
alter table public.rent_charges enable row level security;
alter table public.payments     enable row level security;

drop policy if exists rent_ledgers_owner on public.rent_ledgers;
create policy rent_ledgers_owner on public.rent_ledgers for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));

drop policy if exists rent_charges_owner on public.rent_charges;
create policy rent_charges_owner on public.rent_charges for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));

drop policy if exists payments_owner on public.payments;
create policy payments_owner on public.payments for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));

-- Books are corrected by voiding, never by deleting.
revoke delete on public.rent_charges, public.payments from anon, authenticated;
revoke all on public.rent_ledgers, public.rent_charges, public.payments from anon;

-- ── Running balance per lease ──────────────────────────────────────────────
create or replace view public.contract_ledger with (security_invoker = true) as
select contract_id, owner_id, entry_date, kind, entry_id, description, charge, payment,
       sum(charge - payment) over (partition by contract_id order by entry_date, sort, entry_id) as balance
from (
  select contract_id, owner_id, due_date as entry_date, kind, id::text as entry_id, description,
         amount as charge, 0::numeric as payment, 0 as sort
  from public.rent_charges where voided_at is null
  union all
  select contract_id, owner_id, received_on, 'payment', id::text, method, 0, amount, 1
  from public.payments where voided_at is null
) e;
grant select on public.contract_ledger to authenticated;
