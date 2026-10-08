-- 032_security_hardening.sql — fixes from the branch security review.
-- Safe for the app currently on main: every tenant_invites write there and
-- here already goes through the service role. Idempotent.

-- ── 1. tenant_invites: clients can read their own invites, never write ────
-- The old "for all using (owner_id = auth.uid())" policy had no WITH CHECK,
-- so any signed-in user could insert {contract_id: <anyone's>, used: true,
-- used_by: <self>} and pass every tenant-access check.
drop policy if exists tenant_invites_owner_all on public.tenant_invites;
drop policy if exists tenant_invites_owner_read on public.tenant_invites;
create policy tenant_invites_owner_read on public.tenant_invites for select to authenticated
  using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.tenant_invites from anon, authenticated;

-- Invites whose owner is not the contract's owner can only be forged rows.
delete from public.tenant_invites ti
using public.contracts c
where c.id = ti.contract_id and ti.owner_id <> c.owner_id;

-- Tenant read access additionally requires the invite to come from the contract's owner.
alter policy contracts_tenant_select on public.contracts to authenticated
  using (exists (
    select 1 from public.tenant_invites ti
    where ti.contract_id = contracts.id and ti.owner_id = contracts.owner_id
      and ti.used_by = (select auth.uid()) and ti.used = true));
alter policy properties_tenant_select on public.properties to authenticated
  using (exists (
    select 1 from public.tenant_invites ti
    join public.contracts c on c.id = ti.contract_id
    where c.property_id = properties.id and ti.owner_id = c.owner_id
      and ti.used_by = (select auth.uid()) and ti.used = true));

-- ── 2. Contract children: rows must belong to a contract you own ──────────
drop policy if exists custom_sections_all_own on public.contract_custom_sections;
create policy custom_sections_all_own on public.contract_custom_sections for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));

drop policy if exists contract_occupants_owner_only on public.contract_occupants;
create policy contract_occupants_owner_only on public.contract_occupants for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid())));

-- Attachments: also pin new storage paths to the owner's own folder.
drop policy if exists attachments_all_own on public.contract_attachments;
create policy attachments_all_own on public.contract_attachments for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = (select auth.uid()))
              and split_part(storage_path, '/', 1) = (select auth.uid())::text
              and position('..' in storage_path) = 0);

-- ── 3. Photo paths: only inside the owner's own folder ────────────────────
drop policy if exists maintenance_photos_owner on public.maintenance_photos;
create policy maintenance_photos_owner on public.maintenance_photos for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.maintenance_requests r where r.id = request_id and r.owner_id = (select auth.uid()))
              and split_part(path, '/', 1) = (select auth.uid())::text and position('..' in path) = 0);

drop policy if exists inspection_photos_owner on public.inspection_photos;
create policy inspection_photos_owner on public.inspection_photos for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and exists (select 1 from public.inspections i where i.id = inspection_id and i.owner_id = (select auth.uid()))
              and (item_id is null or exists (
                select 1 from public.inspection_items it where it.id = item_id and it.inspection_id = inspection_photos.inspection_id))
              and split_part(path, '/', 1) = (select auth.uid())::text and position('..' in path) = 0);

-- ── 4. Tenant-side evidence can only be written by the server ─────────────
-- Landlords may not set an inspection's tenant acknowledgment themselves.
create or replace function public.inspections_ack_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.tenant_acknowledged_at is not null or new.tenant_ack_name is not null or new.tenant_ack_ip is not null then
      raise exception 'tenant_ack_server_only';
    end if;
  elsif (new.tenant_acknowledged_at, new.tenant_ack_name, new.tenant_ack_ip)
        is distinct from (old.tenant_acknowledged_at, old.tenant_ack_name, old.tenant_ack_ip) then
    raise exception 'tenant_ack_server_only';
  end if;
  return new;
end;
$$;
drop trigger if exists inspections_ack_guard on public.inspections;
create trigger inspections_ack_guard before insert or update on public.inspections
  for each row execute function public.inspections_ack_guard();

-- Landlords can't attribute requests or timeline notes to the tenant.
-- New client-written requests are the landlord's; who filed one never changes.
create or replace function public.maintenance_kind_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' and new.submitted_by_kind <> 'landlord' then
    raise exception 'tenant_requests_server_only';
  end if;
  if tg_op = 'UPDATE' and (new.submitted_by_kind, new.submitted_by) is distinct from (old.submitted_by_kind, old.submitted_by) then
    raise exception 'tenant_requests_server_only';
  end if;
  return new;
end;
$$;
drop trigger if exists maintenance_kind_guard on public.maintenance_requests;
create trigger maintenance_kind_guard before insert or update on public.maintenance_requests
  for each row execute function public.maintenance_kind_guard();

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
              and author_kind <> 'tenant'
              and exists (select 1 from public.maintenance_requests r where r.id = request_id and r.owner_id = (select auth.uid())));
