-- =============================================
-- Migration 011: Group member invite flow
-- =============================================

ALTER TABLE business_group_members
  ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'accepted'
                                       CHECK (status IN ('pending','accepted','declined')),
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now();

-- is_group_member must only count accepted members
CREATE OR REPLACE FUNCTION is_group_member(gid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_group_members
    WHERE group_id = gid AND user_id = auth.uid() AND status = 'accepted'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Invited users can see their own pending invite row (to accept/decline)
CREATE POLICY bgm_invitee_select ON business_group_members
  FOR SELECT USING (user_id = auth.uid());

-- Invited users can update their own pending invite (accept/decline)
CREATE POLICY bgm_invitee_update ON business_group_members
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');
