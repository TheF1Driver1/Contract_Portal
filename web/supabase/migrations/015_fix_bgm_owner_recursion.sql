-- =============================================
-- Migration 015: Fix infinite recursion in bgm_owner_all
-- =============================================
-- bgm_owner_all directly queried business_group_members from within
-- a policy on business_group_members → infinite recursion.
-- profiles_member_read also triggered the recursion chain indirectly.

-- SECURITY DEFINER helper for owner check (bypasses RLS internally)
CREATE OR REPLACE FUNCTION is_group_owner(gid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_group_members
    WHERE group_id = gid
      AND user_id = auth.uid()
      AND role = 'owner'
      AND status = 'accepted'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace self-referencing policy
DROP POLICY IF EXISTS bgm_owner_all ON business_group_members;

CREATE POLICY bgm_owner_all ON business_group_members
  FOR ALL USING (is_group_owner(group_id));

-- SECURITY DEFINER helper so profiles_member_read sub-query
-- on business_group_members doesn't trigger its own RLS policies
CREATE OR REPLACE FUNCTION shares_group_with(other_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_group_members bgm1
    JOIN business_group_members bgm2 ON bgm2.group_id = bgm1.group_id
    WHERE bgm1.user_id = auth.uid()
      AND bgm1.status = 'accepted'
      AND bgm2.user_id = other_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS profiles_member_read ON profiles;

CREATE POLICY profiles_member_read ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR shares_group_with(id)
  );
