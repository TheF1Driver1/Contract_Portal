-- 009_security_hardening.sql
-- Security audit remediation (2026-07-07). See Obsidian: "Security Audit - Contract Portal 2026-07-07".
-- NOTE: Postgres grants EXECUTE to PUBLIC by default. anon/authenticated inherit that,
-- so revoking from anon alone does nothing — must revoke from PUBLIC then re-grant narrowly.

-- 1. CRITICAL: anon could dump all user emails via SECURITY DEFINER RPCs.
--    search_profiles stays callable by authenticated (co-owner search feature).
REVOKE EXECUTE ON FUNCTION public.search_profiles(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_profiles(text) TO authenticated;

--    search_profiles_by_email is unused by app code -> revoke from everyone.
REVOKE EXECUTE ON FUNCTION public.search_profiles_by_email(text) FROM PUBLIC, anon, authenticated;

-- Trigger fn / internal RLS helpers should never be part of the public API surface.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_owner(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_group_with(uuid) FROM PUBLIC, anon;

-- 2. WARN: pin search_path on SECURITY DEFINER / trigger functions.
ALTER FUNCTION public.update_updated_at()            SET search_path = public, pg_temp;
ALTER FUNCTION public.search_profiles(text)          SET search_path = public, pg_temp;
ALTER FUNCTION public.search_profiles_by_email(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_username_taken(text)        SET search_path = public, pg_temp;
ALTER FUNCTION public.is_group_member(uuid)          SET search_path = public, pg_temp;
ALTER FUNCTION public.is_group_admin(uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.is_group_owner(uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.shares_group_with(uuid)        SET search_path = public, pg_temp;
