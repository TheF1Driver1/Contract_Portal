-- 019_tenant_locale.sql (Plan 30) — apply at merge.
-- A tenant's language drives invites, the portal, reminders and receipts,
-- independent of the landlord's interface language.
alter table public.tenants
  add column if not exists preferred_locale text not null default 'es'
  check (preferred_locale in ('es', 'en'));
