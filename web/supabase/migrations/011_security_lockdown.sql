-- 011_security_lockdown.sql
-- Applied to production 2026-10-07 (Plan 24).
-- Closes two holes: users could update their own profiles.plan / profiles.role and
-- write their own subscriptions row (paywall bypass + role escalation), and the
-- security-definer views zillow_market / crim_tax_rates were writable by anon.

-- Profiles: users edit their own details, never plan or role.
-- Table-level REVOKE also clears column grants, so re-grant only editable columns.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, username, company_name, phone, locale) on public.profiles to authenticated;
alter policy profiles_update_own on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Subscriptions: owners read; only the Stripe webhook (service role) writes.
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = owner_id);
-- The old FOR ALL policy can no longer write (grants revoked); neutralized here and
-- dropped in 012 so no client-writable path remains even if grants change.
alter policy "Users manage own subscription" on public.subscriptions
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (false);

-- Market and CRIM views: read-only. CRIM rates are public data.
revoke all on public.zillow_market, public.crim_tax_rates from anon, authenticated;
grant select on public.zillow_market to authenticated;
grant select on public.crim_tax_rates to anon, authenticated;

-- Defense in depth: the scraper and the views run as the table owner and bypass RLS.
alter table rea.zillow_historical enable row level security;
alter table rea.crim_tax_rates enable row level security;

-- Username lookups need no anonymous access.
revoke execute on function public.is_username_taken(text) from public, anon;
grant execute on function public.is_username_taken(text) to authenticated;
