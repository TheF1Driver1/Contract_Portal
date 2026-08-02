-- 010_fix_search_profiles_scope.sql
-- Security fix (2026-08-02): search_profiles() is SECURITY DEFINER and was querying
-- profiles with no group-membership check, only `id != auth.uid()`. That bypasses the
-- profiles_member_read RLS policy ("id = auth.uid() OR shares_group_with(id)") entirely,
-- letting any authenticated user enumerate every other user's full_name/username/email
-- via the co-owner search box (CoOwnersModal.tsx), regardless of business group.
-- Fix: scope results to the same rule the RLS policy already enforces.

CREATE OR REPLACE FUNCTION public.search_profiles(query text)
 RETURNS TABLE(id uuid, full_name text, username text, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.full_name, p.username, p.email
  FROM profiles p
  WHERE p.id != auth.uid()
    AND shares_group_with(p.id)
    AND (
      p.username ILIKE '%' || query || '%'
      OR p.email  ILIKE '%' || query || '%'
    )
  ORDER BY p.username NULLS LAST, p.full_name
  LIMIT 10;
$function$;
