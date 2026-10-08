-- 030_referrals.sql (Plan 37) — apply at merge.
-- Referral loop: every landlord gets one shareable code; a signup that arrives
-- through it is recorded, converts on the referred user's first paid invoice,
-- and the referrer is rewarded with one free month (Stripe coupon, or manual).
-- Owners can read their own rows; every write goes through the service role.

create table if not exists public.referral_codes (
  owner_id   uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referrer_id      uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  code             text not null check (char_length(code) <= 16),
  status           text not null default 'signed_up' check (status in ('signed_up', 'converted', 'rewarded')),
  converted_at     timestamptz,
  reward_reference text check (char_length(reward_reference) <= 200),
  created_at       timestamptz not null default now(),
  check (referrer_id <> referred_user_id),
  check ((status = 'signed_up') = (converted_at is null))
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, status);

-- ── RLS: read-only for the owner ───────────────────────────────────────────
alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;

drop policy if exists referral_codes_owner_read on public.referral_codes;
create policy referral_codes_owner_read on public.referral_codes for select to authenticated
  using (owner_id = (select auth.uid()));

-- The referrer sees who they brought in (ids and status only); the referred
-- user has no policy, so they never learn who referred them.
drop policy if exists referrals_referrer_read on public.referrals;
create policy referrals_referrer_read on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()));

revoke all on public.referral_codes, public.referrals from anon;
revoke insert, update, delete, truncate on public.referral_codes, public.referrals from authenticated;
grant select on public.referral_codes, public.referrals to authenticated;
