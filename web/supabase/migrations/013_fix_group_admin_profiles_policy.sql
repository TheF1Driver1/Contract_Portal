-- =============================================
-- Migration 013: Fix is_group_admin + profiles read policy
-- =============================================

-- Fix is_group_admin: was missing status = 'accepted' check
CREATE OR REPLACE FUNCTION is_group_admin(gid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_group_members
    WHERE group_id = gid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'accepted'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Allow group members to read other members' profiles
-- Previously profiles_select_own blocked the member list JOIN,
-- causing membersData to be empty and isAdmin to be false.
CREATE POLICY profiles_member_read ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM business_group_members bgm1
      JOIN business_group_members bgm2 ON bgm2.group_id = bgm1.group_id
      WHERE bgm1.user_id = auth.uid()
        AND bgm1.status = 'accepted'
        AND bgm2.user_id = profiles.id
    )
  );
