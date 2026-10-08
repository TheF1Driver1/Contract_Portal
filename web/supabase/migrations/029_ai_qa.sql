-- Plan 39 (wave 3): landlord Q&A over their own data is metered like the
-- other AI features. Re-creates the feature check with 'qa' added.
-- Idempotent: safe to run more than once.
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_feature_check
  check (feature in ('receipt', 'clause_explain', 'translate', 'notice', 'qa'));
