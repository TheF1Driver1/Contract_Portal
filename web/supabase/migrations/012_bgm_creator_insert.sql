-- =============================================
-- Migration 012: Fix group creator bootstrap
-- =============================================
-- bgm_admin_all FOR ALL blocks first INSERT because is_group_admin()
-- returns false when no member rows exist yet for a new group.
-- This policy lets the group creator insert themselves as owner.

CREATE POLICY bgm_creator_insert ON business_group_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND status = 'accepted'
    AND EXISTS (
      SELECT 1 FROM business_groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );
