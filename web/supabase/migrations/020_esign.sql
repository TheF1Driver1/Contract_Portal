-- 020_esign.sql (Plan 31) — apply at merge, after 019.
-- Remote signing without an account, an append-only evidence log, sealed
-- PDFs, and signed contracts that cannot be edited (void and reissue instead).

-- ── Contract status: allow voiding ──────────────────────────────────────────
alter type public.contract_status add value if not exists 'cancelled';

alter table public.contracts
  add column if not exists document_sha256   text,
  add column if not exists sealed_pdf_path    text,
  add column if not exists sealed_pdf_sha256  text,
  add column if not exists sealed_at          timestamptz,
  add column if not exists voided_at          timestamptz,
  add column if not exists void_reason        text;

-- ── Signers ─────────────────────────────────────────────────────────────────
create table if not exists public.contract_signers (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid not null references public.contracts(id) on delete cascade,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  role             text not null check (role in ('tenant', 'co_tenant', 'guarantor')),
  name             text not null,
  email            text,
  phone            text,
  locale           text not null default 'es' check (locale in ('es', 'en')),
  sign_order       int  not null default 1,
  status           text not null default 'pending' check (status in ('pending', 'viewed', 'signed', 'declined', 'revoked')),
  token_hash       text not null unique,
  token_expires_at timestamptz not null,
  otp_hash         text,
  otp_expires_at   timestamptz,
  otp_attempts     int  not null default 0,
  otp_channel      text check (otp_channel in ('sms', 'email')),
  verified_at      timestamptz,
  consented_at     timestamptz,
  signed_at        timestamptz,
  signature_path   text,
  declined_reason  text,
  in_person        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists contract_signers_contract_idx on public.contract_signers (contract_id);
create index if not exists contract_signers_owner_idx on public.contract_signers (owner_id);

alter table public.contract_signers enable row level security;
-- Landlords read their signers (live status); every write goes through the server.
drop policy if exists contract_signers_owner_read on public.contract_signers;
create policy contract_signers_owner_read on public.contract_signers
  for select to authenticated using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.contract_signers from anon, authenticated;
-- Never expose token or code hashes: column-level grants only (a column
-- revoke has no effect while a table-level SELECT grant exists).
revoke select on public.contract_signers from anon, authenticated;
grant select (id, contract_id, owner_id, role, name, email, phone, locale, sign_order, status,
              token_expires_at, otp_channel, verified_at, consented_at, signed_at, declined_reason,
              in_person, created_at)
  on public.contract_signers to authenticated;

-- ── Evidence log (append-only) ──────────────────────────────────────────────
create table if not exists public.signature_events (
  id              bigint generated always as identity primary key,
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  signer_id       uuid references public.contract_signers(id) on delete set null,
  event           text not null check (event in (
                    'requested', 'sent', 'viewed', 'consented', 'otp_sent', 'otp_verified', 'otp_failed',
                    'signed', 'declined', 'landlord_signed', 'sealed', 'voided', 'reissued')),
  actor           text,            -- signer name / landlord email at the time
  ip              text,
  user_agent      text,
  document_sha256 text,
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists signature_events_contract_idx on public.signature_events (contract_id, created_at);
create index if not exists signature_events_signer_idx on public.signature_events (signer_id);

alter table public.signature_events enable row level security;
drop policy if exists signature_events_owner_read on public.signature_events;
create policy signature_events_owner_read on public.signature_events
  for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));
revoke insert, update, delete on public.signature_events from anon, authenticated;

create or replace function public.signature_events_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'signature_events is append-only';
end;
$$;
drop trigger if exists signature_events_no_update on public.signature_events;
create trigger signature_events_no_update
  before update or delete on public.signature_events
  for each row execute function public.signature_events_append_only();

-- ── Signed contracts are immutable ─────────────────────────────────────────
-- Once signed, only these may change: status (to expired/cancelled), void
-- fields, sealing fields, notification flags and document URLs.
create or replace function public.contracts_signed_immutable()
returns trigger language plpgsql set search_path = '' as $$
declare
  allowed text[] := array['status', 'voided_at', 'void_reason', 'sealed_pdf_path', 'sealed_pdf_sha256',
                          'sealed_at', 'document_sha256', 'suppress_notifications', 'updated_at',
                          'pdf_url', 'docx_url', 'opened_at'];
begin
  if old.status = 'signed' then
    if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
      raise exception 'signed_contract_immutable' using hint = 'Void the contract and issue a new version.';
    end if;
    if new.status not in ('signed', 'expired', 'cancelled') then
      raise exception 'signed_contract_immutable' using hint = 'A signed contract can only expire or be voided.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists contracts_signed_immutable on public.contracts;
create trigger contracts_signed_immutable
  before update on public.contracts
  for each row execute function public.contracts_signed_immutable();

-- ── Only the server's signing flow can sign or seal ─────────────────────────
-- Browser and app clients (anon/authenticated) cannot mark a contract signed,
-- write a tenant signature or set sealing fields; the e-sign service uses the
-- service role after verifying consent, a one-time code and the agreement hash.
create or replace function public.contracts_signing_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'signed' or new.tenant_signature is not null or new.sealed_pdf_path is not null then
      raise exception 'sign_via_esign' using hint = 'Tenants sign through the verified signing flow.';
    end if;
    return new;
  end if;
  if new.status = 'signed' and old.status is distinct from 'signed' then
    raise exception 'sign_via_esign' using hint = 'Tenants sign through the verified signing flow.';
  end if;
  if new.tenant_signature is distinct from old.tenant_signature and new.tenant_signature is not null then
    raise exception 'sign_via_esign';
  end if;
  if (new.sealed_pdf_path, new.sealed_pdf_sha256, new.sealed_at, new.document_sha256)
     is distinct from (old.sealed_pdf_path, old.sealed_pdf_sha256, old.sealed_at, old.document_sha256) then
    raise exception 'sign_via_esign';
  end if;
  return new;
end;
$$;
drop trigger if exists contracts_signing_guard on public.contracts;
create trigger contracts_signing_guard
  before insert or update on public.contracts
  for each row execute function public.contracts_signing_guard();

-- Co-tenant signatures follow the same rule.
create or replace function public.occupants_signing_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if new.signature is not null and (tg_op = 'INSERT' or new.signature is distinct from old.signature) then
    raise exception 'sign_via_esign';
  end if;
  return new;
end;
$$;
drop trigger if exists occupants_signing_guard on public.contract_occupants;
create trigger occupants_signing_guard
  before insert or update on public.contract_occupants
  for each row execute function public.occupants_signing_guard();

-- ── Private storage for signature images and sealed PDFs ───────────────────
insert into storage.buckets (id, name, public)
values ('signed-documents', 'signed-documents', false)
on conflict (id) do update set public = false;
-- No client policies: only the service role reads/writes; users get signed URLs.

-- ── Live status on the landlord's contract page ────────────────────────────
-- The page listens to new evidence events (no secrets there) and refetches signers.
do $$
begin
  alter publication supabase_realtime add table public.signature_events;
exception when duplicate_object or undefined_object then null;
end $$;
