-- 033_dashboard_summary.sql (Plan 38): one source of truth for the dashboard
-- KPIs, so the iOS app stops duplicating the web's math. SECURITY INVOKER:
-- RLS applies, and every subquery is also filtered to the caller.
-- Mirrors app/(dashboard)/dashboard/page.tsx:
--   expected_rent  = rent of signed leases whose term covers the month
--   occupancy      = units with an active signed lease / total units (min 1 per property)
--   expiring       = signed leases ending within 60 days (inclusive)
--   ledger_*       = rent-ledger charges due / payments received this month (not voided)
create or replace function public.dashboard_summary(p_today date default (now() at time zone 'America/Puerto_Rico')::date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  bounds as (
    select date_trunc('month', p_today)::date as m_start,
           (date_trunc('month', p_today) + interval '1 month')::date as m_next
  ),
  signed as (
    select c.* from public.contracts c, me
    where c.owner_id = me.uid and c.status = 'signed' and c.lease_start is not null and c.lease_end is not null
  ),
  units as (
    select p.id, greatest(1, coalesce(p.unit_count, 1)) as units,
           least(greatest(1, coalesce(p.unit_count, 1)),
                 (select count(*) from signed s where s.property_id = p.id and s.lease_start <= p_today and p_today <= s.lease_end)) as occupied
    from public.properties p, me where p.owner_id = me.uid
  )
  select jsonb_build_object(
    'month', to_char(p_today, 'YYYY-MM'),
    'expected_rent', coalesce((select sum(s.rent_amount) from signed s, bounds b
                               where s.lease_start < b.m_next and s.lease_end >= b.m_start), 0),
    'leases_this_month', (select count(*) from signed s, bounds b where s.lease_start < b.m_next and s.lease_end >= b.m_start),
    'total_units', coalesce((select sum(units) from units), 0),
    'occupied_units', coalesce((select sum(occupied) from units), 0),
    'expiring_60', (select count(*) from signed s where s.lease_end >= p_today and s.lease_end <= p_today + 60),
    'drafts', (select count(*) from public.contracts c, me where c.owner_id = me.uid and c.status = 'draft'),
    'ledger_expected', coalesce((select sum(rc.amount) from public.rent_charges rc, me, bounds b
                                 where rc.owner_id = me.uid and rc.voided_at is null and rc.due_date >= b.m_start and rc.due_date < b.m_next), 0),
    'ledger_collected', coalesce((select sum(pm.amount) from public.payments pm, me, bounds b
                                  where pm.owner_id = me.uid and pm.voided_at is null and pm.received_on >= b.m_start and pm.received_on < b.m_next), 0)
  );
$$;

revoke all on function public.dashboard_summary(date) from public, anon;
grant execute on function public.dashboard_summary(date) to authenticated;
