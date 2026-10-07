-- 015_access_token_hook.sql (Plan 28) — apply at merge, then enable it in
-- Dashboard → Authentication → Hooks → Customize Access Token (JWT) Claims,
-- and switch to asymmetric JWT signing keys (Settings → JWT Keys).
-- Adds app_role, plan and locale claims so proxy.ts needs no database query.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  p record;
begin
  select role, plan, locale into p
    from public.profiles
   where id = (event->>'user_id')::uuid;

  claims := claims
    || jsonb_build_object('app_role', coalesce(p.role, 'landlord'))
    || jsonb_build_object('plan', coalesce(p.plan, 'free'))
    || jsonb_build_object('locale', coalesce(p.locale, 'es'));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table public.profiles to supabase_auth_admin;
create policy "auth_admin_reads_profiles_for_hook" on public.profiles
  as permissive for select to supabase_auth_admin using (true);
