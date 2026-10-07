-- 013_reliability.sql (Plan 25) — apply at merge.

-- One "sent" reminder per contract, trigger and channel, even if two cron runs overlap.
create unique index if not exists contract_notification_logs_sent_once
  on public.contract_notification_logs (contract_id, trigger_id, channel)
  where status = 'sent' and trigger_id is not null;

-- Every scheduled job run is recorded so failures are visible.
create table if not exists public.cron_runs (
  id          bigint generated always as identity primary key,
  job         text        not null,
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  ok          boolean     not null,
  summary     jsonb       not null default '{}'::jsonb
);
create index if not exists cron_runs_job_started on public.cron_runs (job, started_at desc);
alter table public.cron_runs enable row level security;   -- service role only
revoke all on public.cron_runs from anon, authenticated;

-- Stripe webhook idempotency: each event id is processed once.
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security; -- service role only
revoke all on public.stripe_events from anon, authenticated;
