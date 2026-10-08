-- 031_ath_movil.sql (Plan 33, ATH Móvil) — apply at merge, after 022.
-- Tenants pay rent from the portal with ATH Móvil straight into the
-- landlord's own ATH Business account (Evertec Payment Button API).
-- ContractOS never holds the money: it starts the payment with the
-- landlord's public token, authorizes it once the tenant confirms, and posts
-- the confirmed payment to the rent ledger (public.payments, source
-- 'ath_movil', external_id 'athm:<referenceNumber>').
--
-- Idempotent: safe to run more than once.

-- ── Landlord's ATH Business connection ──────────────────────────────────────
-- Tokens are stored only encrypted by the app (AES-GCM, FIELD_ENCRYPTION_KEY);
-- the app refuses to save them when no key is configured.
create table if not exists public.ath_movil_accounts (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  public_token_enc  text not null check (public_token_enc like 'enc:v1:%'),
  private_token_enc text check (private_token_enc is null or private_token_enc like 'enc:v1:%'),
  business_name     text check (char_length(business_name) <= 80),
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Service role only: no client policies at all. Landlords manage it through
-- server actions and read a safe status through ath_movil_status().
alter table public.ath_movil_accounts enable row level security;
revoke all on public.ath_movil_accounts from anon, authenticated;

create or replace function public.ath_movil_status()
returns table (connected boolean, business_name text, connected_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select true, a.business_name, a.connected_at
  from public.ath_movil_accounts a
  where a.owner_id = (select auth.uid())
  union all
  select false, null::text, null::timestamptz
  where not exists (select 1 from public.ath_movil_accounts a where a.owner_id = (select auth.uid()))
$$;

comment on function public.ath_movil_status() is
  'Whether the caller has ATH Móvil connected (never returns tokens). Plan 33.';

revoke all on function public.ath_movil_status() from public;
revoke all on function public.ath_movil_status() from anon;
grant execute on function public.ath_movil_status() to authenticated, service_role;

-- ── Payment attempts started from the tenant portal ─────────────────────────
create table if not exists public.ath_movil_payments (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  contract_id      uuid not null references public.contracts(id) on delete cascade,
  payer_user_id    uuid references auth.users(id) on delete set null,
  phone            text check (char_length(phone) <= 20),
  amount           numeric(10,2) not null check (amount >= 1 and amount <= 1500),
  ecommerce_id     text not null unique check (char_length(ecommerce_id) <= 100),
  auth_token_enc   text,
  status           text not null default 'open' check (status in ('open', 'confirm', 'completed', 'cancel', 'failed')),
  authorizing_at   timestamptz,          -- claim so only one request authorizes
  reference_number text check (char_length(reference_number) <= 100),
  payment_id       uuid references public.payments(id) on delete set null,
  error            text check (char_length(error) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ath_movil_payments_owner_idx on public.ath_movil_payments (owner_id, created_at desc);
create index if not exists ath_movil_payments_contract_idx on public.ath_movil_payments (contract_id, created_at desc);
create index if not exists ath_movil_payments_pending_idx on public.ath_movil_payments (created_at) where status in ('open', 'confirm');
create index if not exists ath_movil_payments_payment_idx on public.ath_movil_payments (payment_id) where payment_id is not null;

-- Landlords can see their own attempts; all writes go through the service role.
alter table public.ath_movil_payments enable row level security;
drop policy if exists ath_movil_payments_owner_read on public.ath_movil_payments;
create policy ath_movil_payments_owner_read on public.ath_movil_payments for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.ath_movil_payments from anon;
revoke insert, update, delete, truncate on public.ath_movil_payments from authenticated;
grant select on public.ath_movil_payments to authenticated;
