-- 021_lifecycle_emails.sql (Plan 32) — apply at merge, after 020.
-- Onboarding emails on days 0/1/3/7 after signup, with one-click unsubscribe.

alter table public.profiles
  add column if not exists lifecycle_emails boolean not null default true;

-- One row per user and step: a step is never sent twice, even if runs overlap.
create table if not exists public.lifecycle_email_log (
  user_id  uuid not null references auth.users(id) on delete cascade,
  step     text not null check (step in ('welcome', 'first_property', 'first_contract', 'esign')),
  sent_at  timestamptz not null default now(),
  primary key (user_id, step)
);
alter table public.lifecycle_email_log enable row level security; -- service role only
revoke all on public.lifecycle_email_log from anon, authenticated;

-- Profiles use column-level UPDATE grants (011); let users manage this preference.
grant update (lifecycle_emails) on public.profiles to authenticated;
