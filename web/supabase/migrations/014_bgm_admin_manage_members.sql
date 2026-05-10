-- =============================================
-- Migration 014: Scoped admin/owner RLS for member management
-- =============================================
-- bgm_admin_all FOR ALL had no WITH CHECK, allowing admins to set
-- any role including 'owner'. Split into scoped policies.

DROP POLICY IF EXISTS bgm_admin_all ON business_group_members;

-- Admins can invite (INSERT) new members but not owners
CREATE POLICY bgm_admin_insert ON business_group_members
  FOR INSERT WITH CHECK (
    is_group_admin(group_id)
    AND role IN ('admin', 'member')
  );

-- Admins can change roles but cannot promote to owner
CREATE POLICY bgm_admin_update ON business_group_members
  FOR UPDATE USING (is_group_admin(group_id))
  WITH CHECK (role IN ('admin', 'member'));

-- Admins can remove non-owner members
CREATE POLICY bgm_admin_delete ON business_group_members
  FOR DELETE USING (
    is_group_admin(group_id)
    AND role IN ('admin', 'member')
  );

-- Owner has full control over all rows in their group
CREATE POLICY bgm_owner_all ON business_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM business_group_members o
      WHERE o.group_id = business_group_members.group_id
        AND o.user_id = auth.uid()
        AND o.role = 'owner'
        AND o.status = 'accepted'
    )
  );
