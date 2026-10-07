-- 012_plan_entitlements.sql (Plan 24)
-- One source of truth for plan limits, enforced in the database so writes made
-- straight from the browser client cannot skip them. Apply after the branch merges.

drop policy if exists "Users manage own subscription" on public.subscriptions;

create table if not exists public.plan_entitlements (
  plan                    text primary key
                          check (plan in ('free', 'propietario', 'inversionista', 'enterprise')),
  max_properties          integer,          -- null = unlimited
  max_contracts_per_month integer,          -- null = unlimited
  sms                     boolean not null default false,
  market                  boolean not null default false,
  templates               boolean not null default false,
  expense_export          boolean not null default false,
  schedule_e              boolean not null default false,
  managers                integer           -- null = unlimited
);

insert into public.plan_entitlements
  (plan, max_properties, max_contracts_per_month, sms, market, templates, expense_export, schedule_e, managers)
values
  ('free',          1,    3,    false, false, false, false, false, 0),
  ('propietario',   5,    null, true,  true,  true,  true,  false, 0),
  ('inversionista', null, null, true,  true,  true,  true,  true,  3),
  ('enterprise',    null, null, true,  true,  true,  true,  true,  null)
on conflict (plan) do update set
  max_properties = excluded.max_properties,
  max_contracts_per_month = excluded.max_contracts_per_month,
  sms = excluded.sms,
  market = excluded.market,
  templates = excluded.templates,
  expense_export = excluded.expense_export,
  schedule_e = excluded.schedule_e,
  managers = excluded.managers;

alter table public.plan_entitlements enable row level security;
create policy plan_entitlements_read on public.plan_entitlements
  for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.plan_entitlements from anon, authenticated;

-- The owner's entitlements row; profiles.plan is trustworthy since 011.
create or replace function public.entitlements_for(uid uuid)
returns public.plan_entitlements
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.*
  from public.plan_entitlements e
  where e.plan = coalesce((select p.plan from public.profiles p where p.id = uid), 'free');
$$;
revoke execute on function public.entitlements_for(uuid) from public, anon, authenticated;

create or replace function public.enforce_property_limit()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  ent public.plan_entitlements;
  n integer;
begin
  ent := public.entitlements_for(new.owner_id);
  if ent.max_properties is not null then
    select count(*) into n from public.properties where owner_id = new.owner_id;
    if n >= ent.max_properties then
      raise exception 'plan_limit_properties'
        using errcode = 'P0001', hint = 'upgrade', detail = ent.max_properties::text;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_plan_limit on public.properties;
create trigger properties_plan_limit
  before insert on public.properties
  for each row execute function public.enforce_property_limit();

create or replace function public.enforce_contract_limit()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  ent public.plan_entitlements;
  n integer;
begin
  ent := public.entitlements_for(new.owner_id);
  if ent.max_contracts_per_month is not null then
    select count(*) into n
    from public.contracts
    where owner_id = new.owner_id
      and created_at >= date_trunc('month', now());
    if n >= ent.max_contracts_per_month then
      raise exception 'plan_limit_contracts'
        using errcode = 'P0001', hint = 'upgrade', detail = ent.max_contracts_per_month::text;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_plan_limit on public.contracts;
create trigger contracts_plan_limit
  before insert on public.contracts
  for each row execute function public.enforce_contract_limit();

revoke execute on function public.enforce_property_limit() from public, anon, authenticated;
revoke execute on function public.enforce_contract_limit() from public, anon, authenticated;

-- Templates are private: owners read them through storage policies (owner_read),
-- and the server downloads them by storage path instead of a public URL.
update storage.buckets set public = false where id = 'contract-templates';
