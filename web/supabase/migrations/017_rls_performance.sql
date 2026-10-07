-- 017_rls_performance.sql (Plan 28) — apply at merge.
-- 1. Wrap auth.uid() in (select ...) so Postgres evaluates it once per query
--    instead of once per row (advisor: auth_rls_initplan).
-- 2. Scope owner policies to the authenticated role. Anonymous flows
--    (invite pages) use the service-role client, so anon needs none of these.
-- 3. Index foreign keys the advisor flagged; drop a duplicate index.
-- Policy bodies are otherwise unchanged (generated from pg_policies).

alter policy bgm_creator_insert on public.business_group_members to authenticated
  with check (((user_id = (select auth.uid())) AND (role = 'owner'::text) AND (status = 'accepted'::text) AND (EXISTS ( SELECT 1
   FROM business_groups
  WHERE ((business_groups.id = business_group_members.group_id) AND (business_groups.created_by = (select auth.uid())))))));
alter policy bgm_invitee_select on public.business_group_members to authenticated
  using ((user_id = (select auth.uid())));
alter policy bgm_invitee_update on public.business_group_members to authenticated
  using (((user_id = (select auth.uid())) AND (status = 'pending'::text)));
alter policy groups_creator_all on public.business_groups to authenticated
  using ((created_by = (select auth.uid())));
alter policy alerts_owner_all on public.contract_alerts to authenticated
  using ((owner_id = (select auth.uid())));
alter policy attachments_all_own on public.contract_attachments to authenticated
  using (((select auth.uid()) = owner_id));
alter policy custom_sections_all_own on public.contract_custom_sections to authenticated
  using (((select auth.uid()) = owner_id));
alter policy contract_notification_logs_owner_only on public.contract_notification_logs to authenticated
  using (((select auth.uid()) = owner_id));
alter policy contract_occupants_owner_only on public.contract_occupants to authenticated
  using (((select auth.uid()) = owner_id));
alter policy contract_sections_owner on public.contract_sections to authenticated
  using ((EXISTS ( SELECT 1
   FROM contracts c
  WHERE ((c.id = contract_sections.contract_id) AND (c.owner_id = (select auth.uid()))))));
alter policy contract_templates_owner_only on public.contract_templates to authenticated
  using (((select auth.uid()) = owner_id));
alter policy contracts_all_own on public.contracts to authenticated
  using (((select auth.uid()) = owner_id));
alter policy contracts_tenant_select on public.contracts to authenticated
  using ((EXISTS ( SELECT 1
   FROM tenant_invites ti
  WHERE ((ti.contract_id = contracts.id) AND (ti.used_by = (select auth.uid())) AND (ti.used = true)))));
alter policy notification_triggers_owner_only on public.notification_triggers to authenticated
  using (((select auth.uid()) = owner_id));
alter policy profiles_member_read on public.profiles to authenticated
  using (((id = (select auth.uid())) OR shares_group_with(id)));
alter policy profiles_select_own on public.profiles to authenticated
  using (((select auth.uid()) = id));
alter policy properties_all_own on public.properties to authenticated
  using (((select auth.uid()) = owner_id));
alter policy properties_tenant_select on public.properties to authenticated
  using ((EXISTS ( SELECT 1
   FROM (tenant_invites ti
     JOIN contracts c ON ((c.id = ti.contract_id)))
  WHERE ((c.property_id = properties.id) AND (ti.used_by = (select auth.uid())) AND (ti.used = true)))));
alter policy co_owners_invitee_select on public.property_co_owners to authenticated
  using ((co_owner_id = (select auth.uid())));
alter policy co_owners_invitee_update on public.property_co_owners to authenticated
  using ((co_owner_id = (select auth.uid())));
alter policy co_owners_owner_all on public.property_co_owners to authenticated
  using ((owner_id = (select auth.uid())));
alter policy owner_access on public.property_expenses to authenticated
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy "Managers can view their own record" on public.property_managers to authenticated
  using ((manager_user_id = (select auth.uid())));
alter policy "Owners manage their property managers" on public.property_managers to authenticated
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));
alter policy tenant_invites_owner_all on public.tenant_invites to authenticated
  using (((select auth.uid()) = owner_id));
alter policy tenants_all_own on public.tenants to authenticated
  using (((select auth.uid()) = owner_id));
alter policy section_templates_all_own on public.user_section_templates to authenticated
  using (((select auth.uid()) = owner_id));
alter policy "owner only" on public.watchlist to authenticated
  using ((owner_id = (select auth.uid())));

alter policy expense_receipts_delete on storage.objects to authenticated
  using (((bucket_id = 'expense-receipts'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));
alter policy expense_receipts_insert on storage.objects to authenticated
  with check (((bucket_id = 'expense-receipts'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));
alter policy expense_receipts_select on storage.objects to authenticated
  using (((bucket_id = 'expense-receipts'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));
alter policy owner_delete on storage.objects to authenticated
  using (((bucket_id = 'contract-templates'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));
alter policy owner_read on storage.objects to authenticated
  using (((bucket_id = 'contract-templates'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));
alter policy owner_update on storage.objects to authenticated
  using (((bucket_id = 'contract-templates'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));
alter policy owner_upload on storage.objects to authenticated
  with check (((bucket_id = 'contract-templates'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

-- Foreign-key indexes
create index if not exists business_group_members_invited_by_idx on public.business_group_members (invited_by);
create index if not exists business_group_properties_added_by_idx on public.business_group_properties (added_by);
create index if not exists contract_attachments_owner_id_idx on public.contract_attachments (owner_id);
create index if not exists contract_custom_sections_owner_id_idx on public.contract_custom_sections (owner_id);
create index if not exists contract_notification_logs_trigger_id_idx on public.contract_notification_logs (trigger_id);
create index if not exists contracts_property_id_idx on public.contracts (property_id);
create index if not exists contracts_template_id_idx on public.contracts (template_id);
create index if not exists contracts_tenant_id_idx on public.contracts (tenant_id);
create index if not exists property_managers_manager_user_id_idx on public.property_managers (manager_user_id);
create index if not exists tenant_invites_used_by_idx on public.tenant_invites (used_by);
create index if not exists zillow_historical_property_id_idx on rea.zillow_historical (property_id);

drop index if exists public.contracts_parent_idx; -- duplicate of contracts_parent_contract_idx
