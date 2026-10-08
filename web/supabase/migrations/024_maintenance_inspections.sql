-- 024_maintenance_inspections.sql (Plan 36) — apply at merge, after 023.
-- Lease lifecycle: maintenance requests (with photos and a timeline) and
-- move-in / move-out inspections. Idempotent.
--
-- Access model: landlords read and write their own rows through RLS
-- (owner_id). Tenants never touch these tables directly: the portal goes
-- through server actions that first verify a redeemed invite
-- (tenant_invites.used_by = user and used = true) and then use the service
-- role, the same way the portal page reads contracts and rent.

-- ── Shared helpers ─────────────────────────────────────────────────────────
create or replace function public.lifecycle_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.lifecycle_touch_updated_at() from public, anon, authenticated;

-- ── Maintenance requests ───────────────────────────────────────────────────
create table if not exists public.maintenance_requests (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid references public.contracts(id) on delete cascade,
  property_id       uuid not null references public.properties(id) on delete cascade,
  owner_id          uuid not null references auth.users(id) on delete cascade,
  submitted_by      uuid references auth.users(id) on delete set null,
  submitted_by_kind text not null default 'landlord' check (submitted_by_kind in ('tenant', 'landlord')),
  title             text not null check (char_length(title) between 1 and 120),
  description       text check (char_length(description) <= 2000),
  category          text not null default 'other'
                    check (category in ('plumbing', 'electrical', 'appliance', 'ac', 'pest', 'structural', 'other')),
  urgency           text not null default 'normal' check (urgency in ('low', 'normal', 'urgent', 'emergency')),
  status            text not null default 'open'
                    check (status in ('open', 'scheduled', 'in_progress', 'resolved', 'cancelled')),
  vendor_name       text check (char_length(vendor_name) <= 120),
  vendor_phone      text check (char_length(vendor_phone) <= 30),
  scheduled_for     date,
  resolved_at       timestamptz,
  cost              numeric(10,2) check (cost is null or (cost >= 0 and cost <= 1000000)),
  expense_id        uuid references public.property_expenses(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists maintenance_requests_owner_status_idx on public.maintenance_requests (owner_id, status, urgency);
create index if not exists maintenance_requests_contract_idx on public.maintenance_requests (contract_id);
create index if not exists maintenance_requests_property_idx on public.maintenance_requests (property_id);
create unique index if not exists maintenance_requests_expense_once on public.maintenance_requests (expense_id) where expense_id is not null;

drop trigger if exists maintenance_requests_touch on public.maintenance_requests;
create trigger maintenance_requests_touch before update on public.maintenance_requests
  for each row execute function public.lifecycle_touch_updated_at();

create table if not exists public.maintenance_updates (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.maintenance_requests(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  author_kind   text not null check (author_kind in ('tenant', 'landlord', 'system')),
  note          text check (char_length(note) <= 2000),
  status_change text check (status_change in ('open', 'scheduled', 'in_progress', 'resolved', 'cancelled')),
  created_at    timestamptz not null default now(),
  check (note is not null or status_change is not null)
);
create index if not exists maintenance_updates_request_idx on public.maintenance_updates (request_id, created_at);
create index if not exists maintenance_updates_owner_idx on public.maintenance_updates (owner_id);

create table if not exists public.maintenance_photos (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.maintenance_requests(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  path        text not null unique check (char_length(path) <= 300),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists maintenance_photos_request_idx on public.maintenance_photos (request_id);
create index if not exists maintenance_photos_owner_idx on public.maintenance_photos (owner_id);

-- ── Inspections ────────────────────────────────────────────────────────────
create table if not exists public.inspections (
  id                     uuid primary key default gen_random_uuid(),
  contract_id            uuid not null references public.contracts(id) on delete cascade,
  owner_id               uuid not null references auth.users(id) on delete cascade,
  kind                   text not null check (kind in ('move_in', 'move_out')),
  status                 text not null default 'draft' check (status in ('draft', 'completed')),
  inspected_on           date not null default current_date,
  notes                  text check (char_length(notes) <= 4000),
  landlord_signed_at     timestamptz,
  tenant_acknowledged_at timestamptz,
  tenant_ack_name        text check (char_length(tenant_ack_name) <= 120),
  tenant_ack_ip          text check (char_length(tenant_ack_ip) <= 64),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check ((status = 'completed') = (landlord_signed_at is not null)),
  check (tenant_acknowledged_at is null or status = 'completed')
);
-- One move-in and one move-out per lease; the move-out compares against the move-in.
create unique index if not exists inspections_contract_kind on public.inspections (contract_id, kind);
create index if not exists inspections_owner_idx on public.inspections (owner_id);

drop trigger if exists inspections_touch on public.inspections;
create trigger inspections_touch before update on public.inspections
  for each row execute function public.lifecycle_touch_updated_at();

create table if not exists public.inspection_items (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  room          text not null check (char_length(room) between 1 and 60),
  item          text not null check (char_length(item) between 1 and 60),
  condition     text check (condition in ('good', 'fair', 'poor', 'damaged', 'na')),
  note          text check (char_length(note) <= 1000),
  sort          integer not null default 0,
  unique (inspection_id, room, item)
);
create index if not exists inspection_items_owner_idx on public.inspection_items (owner_id);

create table if not exists public.inspection_photos (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  item_id       uuid references public.inspection_items(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  path          text not null unique check (char_length(path) <= 300),
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists inspection_photos_inspection_idx on public.inspection_photos (inspection_id);
create index if not exists inspection_photos_item_idx on public.inspection_photos (item_id);
create index if not exists inspection_photos_owner_idx on public.inspection_photos (owner_id);

-- A completed inspection is a record: only the tenant acknowledgment may be
-- added afterwards (once), and its items and photos are frozen.
create or replace function public.inspections_completed_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' then raise exception 'inspection_completed'; end if;
    return old;
  end if;
  if old.status = 'completed' then
    if new.status is distinct from old.status
       or new.kind is distinct from old.kind
       or new.contract_id is distinct from old.contract_id
       or new.owner_id is distinct from old.owner_id
       or new.inspected_on is distinct from old.inspected_on
       or new.notes is distinct from old.notes
       or new.landlord_signed_at is distinct from old.landlord_signed_at
       or (old.tenant_acknowledged_at is not null and (
             new.tenant_acknowledged_at is distinct from old.tenant_acknowledged_at
             or new.tenant_ack_name is distinct from old.tenant_ack_name
             or new.tenant_ack_ip is distinct from old.tenant_ack_ip)) then
      raise exception 'inspection_completed';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.inspections_completed_guard() from public, anon, authenticated;
drop trigger if exists inspections_completed_guard on public.inspections;
create trigger inspections_completed_guard before update or delete on public.inspections
  for each row execute function public.inspections_completed_guard();

create or replace function public.inspection_children_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  parent uuid := case when tg_op = 'DELETE' then old.inspection_id else new.inspection_id end;
begin
  -- Deleting the whole (draft) inspection cascades; the parent row is already gone then.
  if exists (select 1 from public.inspections i where i.id = parent and i.status = 'completed') then
    raise exception 'inspection_completed';
  end if;
  if tg_op = 'UPDATE' and old.inspection_id is distinct from new.inspection_id then
    raise exception 'inspection_moved';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.inspection_children_guard() from public, anon, authenticated;
drop trigger if exists inspection_items_guard on public.inspection_items;
create trigger inspection_items_guard before insert or update or delete on public.inspection_items
  for each row execute function public.inspection_children_guard();
drop trigger if exists inspection_photos_guard on public.inspection_photos;
create trigger inspection_photos_guard before insert or update or delete on public.inspection_photos
  for each row execute function public.inspection_children_guard();

-- ── RLS: landlords own everything they file ────────────────────────────────
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_updates  enable row level security;
alter table public.maintenance_photos   enable row level security;
alter table public.inspections          enable row level security;
alter table public.inspection_items     enable row level security;
alter table public.inspection_photos    enable row level security;

drop policy if exists maintenance_requests_owner on public.maintenance_requests;
create policy maintenance_requests_owner on public.maintenance_requests for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))
    and (contract_id is null or exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.owner_id = (select auth.uid()) and c.property_id = property_id))
    and (expense_id is null or exists (
      select 1 from public.property_expenses e where e.id = expense_id and e.user_id = (select auth.uid())))
  );

drop policy if exists maintenance_updates_owner on public.maintenance_updates;
create policy maintenance_updates_owner on public.maintenance_updates for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.maintenance_requests r where r.id = request_id and r.owner_id = (select auth.uid())));

drop policy if exists maintenance_photos_owner on public.maintenance_photos;
create policy maintenance_photos_owner on public.maintenance_photos for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.maintenance_requests r where r.id = request_id and r.owner_id = (select auth.uid())));

-- Inspections: separate policies so a landlord can discard a draft but never a completed one.
drop policy if exists inspections_owner on public.inspections;
drop policy if exists inspections_owner_select on public.inspections;
drop policy if exists inspections_owner_insert on public.inspections;
drop policy if exists inspections_owner_update on public.inspections;
drop policy if exists inspections_owner_delete on public.inspections;
create policy inspections_owner_select on public.inspections for select to authenticated
  using (owner_id = (select auth.uid()));
create policy inspections_owner_insert on public.inspections for insert to authenticated
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));
create policy inspections_owner_update on public.inspections for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));
create policy inspections_owner_delete on public.inspections for delete to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft');

drop policy if exists inspection_items_owner on public.inspection_items;
create policy inspection_items_owner on public.inspection_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid())));

drop policy if exists inspection_photos_owner on public.inspection_photos;
create policy inspection_photos_owner on public.inspection_photos for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid()))
              and (item_id is null or exists (
                select 1 from public.inspection_items it where it.id = item_id and it.inspection_id = inspection_photos.inspection_id)));

-- Requests and their timeline are evidence: closed by status, never deleted.
revoke delete on public.maintenance_requests, public.maintenance_updates, public.maintenance_photos from anon, authenticated;
revoke update on public.maintenance_updates from anon, authenticated;
revoke all on public.maintenance_requests, public.maintenance_updates, public.maintenance_photos,
              public.inspections, public.inspection_items, public.inspection_photos from anon;

-- ── Private photo storage ──────────────────────────────────────────────────
-- Paths: <owner_id>/<maintenance|inspections>/<record id>/<uuid>.<ext>.
-- No client policies: the server verifies access, hands out signed upload
-- URLs, and serves photos through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maintenance-photos', 'maintenance-photos', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
