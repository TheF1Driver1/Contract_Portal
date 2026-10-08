-- 023_messaging.sql (Plan 34) — apply at merge, after 022.
-- One log for every message ContractOS sends (email, SMS, WhatsApp) with its
-- delivery status, plus recorded consent for SMS/WhatsApp per tenant.
-- Writes come from the server (service role): sendMessage, the Twilio and
-- Resend webhooks, and the landlord's "attested consent" action after it has
-- verified ownership. Landlords read their own rows.
-- Future: move sends onto Supabase Queues (pgmq) for retries with backoff.

-- ── Daily digest preference ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists digest_emails boolean not null default true;
-- Profiles use column-level UPDATE grants (011).
grant update (digest_emails) on public.profiles to authenticated;

-- ── Message log ────────────────────────────────────────────────────────────
create table if not exists public.message_log (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  contract_id     uuid references public.contracts(id) on delete set null,
  direction       text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  recipient_kind  text not null check (recipient_kind in ('tenant', 'landlord', 'signer')),
  recipient_id    uuid,
  channel         text not null check (channel in ('email', 'sms', 'whatsapp')),
  template        text not null check (char_length(template) <= 60),
  locale          text not null default 'es' check (locale in ('es', 'en')),
  -- Full address so the landlord can see where it went; RLS keeps it owner-only.
  to_address      text not null check (char_length(to_address) <= 320),
  body            text check (char_length(body) <= 1600),          -- inbound text only
  -- Null for skipped sends, so a later attempt on another channel can still go out.
  idempotency_key text unique check (char_length(idempotency_key) <= 200),
  provider        text check (provider in ('resend', 'twilio')),
  provider_id     text check (char_length(provider_id) <= 100),
  status          text not null default 'queued'
                  check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received')),
  error           text check (char_length(error) <= 500),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
-- Status webhooks find a send by its provider id (Resend email id / Twilio SID).
create unique index if not exists message_log_provider_id_key
  on public.message_log (provider_id) where direction = 'outbound' and provider_id is not null;
create index if not exists message_log_contract_idx on public.message_log (contract_id, created_at desc);
create index if not exists message_log_owner_status_idx on public.message_log (owner_id, status, created_at desc);

alter table public.message_log enable row level security;
drop policy if exists message_log_owner_read on public.message_log;
create policy message_log_owner_read on public.message_log for select to authenticated
  using (owner_id = (select auth.uid()));
-- Evidence of what was sent: only the server writes, nobody deletes.
revoke all on public.message_log from anon;
revoke insert, update, delete, truncate on public.message_log from authenticated;
grant select on public.message_log to authenticated;

-- ── Messaging consent (SMS / WhatsApp; email is transactional) ─────────────
create table if not exists public.messaging_consents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  subject_kind  text not null check (subject_kind in ('tenant', 'landlord')),
  subject_id    uuid not null,
  channel       text not null check (channel in ('sms', 'whatsapp', 'email')),
  address       text not null check (char_length(address) <= 320),
  status        text not null check (status in ('opted_in', 'opted_out')),
  source        text not null check (source in ('lease_signing', 'portal', 'landlord_attested', 'inbound_stop', 'inbound_start')),
  consented_at  timestamptz not null default now(),   -- when the current status was recorded
  updated_at    timestamptz not null default now(),
  unique (subject_kind, subject_id, channel)
);
create index if not exists messaging_consents_owner_idx on public.messaging_consents (owner_id);
create index if not exists messaging_consents_address_idx on public.messaging_consents (address);

alter table public.messaging_consents enable row level security;
drop policy if exists messaging_consents_owner_read on public.messaging_consents;
create policy messaging_consents_owner_read on public.messaging_consents for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.messaging_consents from anon;
revoke insert, update, delete, truncate on public.messaging_consents from authenticated;
grant select on public.messaging_consents to authenticated;
