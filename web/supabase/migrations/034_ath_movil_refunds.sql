-- 034_ath_movil_refunds.sql (Plan 33): landlord-initiated ATH Móvil refunds.
-- One row per refund attempt. Only the server writes; owners read their own.
-- A refund whose outcome is unknown (ATH didn't answer) blocks further refunds
-- of that payment until the landlord checks ATH Business and clears it.
create table if not exists public.ath_movil_refunds (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  payment_id       uuid not null references public.payments(id) on delete cascade,
  amount           numeric(10,2) not null check (amount > 0 and amount <= 1500),
  message          text check (char_length(message) <= 50),
  status           text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'unknown')),
  refund_reference text check (char_length(refund_reference) <= 100),
  error            text check (char_length(error) <= 300),
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists ath_movil_refunds_payment_idx on public.ath_movil_refunds (payment_id, created_at desc);
-- At most one refund in flight (or unresolved) per payment: no double refunds.
create unique index if not exists ath_movil_refunds_one_open
  on public.ath_movil_refunds (payment_id) where status in ('pending', 'unknown');

alter table public.ath_movil_refunds enable row level security;
drop policy if exists ath_movil_refunds_owner_read on public.ath_movil_refunds;
create policy ath_movil_refunds_owner_read on public.ath_movil_refunds for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.ath_movil_refunds from anon;
revoke insert, update, delete on public.ath_movil_refunds from authenticated;
grant select on public.ath_movil_refunds to authenticated;
