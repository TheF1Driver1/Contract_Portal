-- Plan 39: AI usage metering. One row per AI call, used for per-plan monthly
-- quotas. No prompt or document content is stored, only the feature name.
create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('receipt', 'clause_explain', 'translate', 'notice')),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_owner_month_idx
  on public.ai_usage_events (owner_id, feature, created_at desc);

alter table public.ai_usage_events enable row level security;

-- Owners can see their own usage; only the server (service role) writes.
drop policy if exists "ai usage: owner reads" on public.ai_usage_events;
create policy "ai usage: owner reads" on public.ai_usage_events
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.ai_usage_events from anon;
revoke insert, update, delete on public.ai_usage_events from authenticated;
grant select on public.ai_usage_events to authenticated;
