-- =============================================
-- Migration 008: Business groups
-- =============================================

CREATE TABLE business_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX business_groups_created_by_idx ON business_groups(created_by);

ALTER TABLE business_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_creator_all ON business_groups
  FOR ALL USING (created_by = auth.uid());

-- ── Members (created before member_select policy on business_groups) ──────────

CREATE TABLE business_group_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX bgm_group_idx ON business_group_members(group_id);
CREATE INDEX bgm_user_idx  ON business_group_members(user_id);

ALTER TABLE business_group_members ENABLE ROW LEVEL SECURITY;

-- Now safe to add member_select on business_groups (table exists)
CREATE POLICY groups_member_select ON business_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_group_members bgm
      WHERE bgm.group_id = id AND bgm.user_id = auth.uid()
    )
  );

CREATE POLICY bgm_admin_all ON business_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM business_group_members mgr
      WHERE mgr.group_id = group_id
        AND mgr.user_id = auth.uid()
        AND mgr.role IN ('owner','admin')
    )
  );

-- Any member: read membership list of groups they belong to
CREATE POLICY bgm_member_select ON business_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_group_members self
      WHERE self.group_id = group_id AND self.user_id = auth.uid()
    )
  );

-- ── Group properties ─────────────────────────────────────────────────────────

CREATE TABLE business_group_properties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  added_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, property_id)
);

CREATE INDEX bgp_group_idx    ON business_group_properties(group_id);
CREATE INDEX bgp_property_idx ON business_group_properties(property_id);

ALTER TABLE business_group_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY bgp_member_select ON business_group_properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_group_members bgm
      WHERE bgm.group_id = group_id AND bgm.user_id = auth.uid()
    )
  );

CREATE POLICY bgp_admin_write ON business_group_properties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM business_group_members bgm
      WHERE bgm.group_id = group_id
        AND bgm.user_id = auth.uid()
        AND bgm.role IN ('owner','admin')
    )
  );

-- ── Per-member ownership % per property in a group ───────────────────────────

CREATE TABLE group_property_ownership (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid        NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  property_id   uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ownership_pct numeric(5,2) NOT NULL DEFAULT 0
                               CHECK (ownership_pct >= 0 AND ownership_pct <= 100),
  UNIQUE (group_id, property_id, user_id)
);

CREATE INDEX gpo_group_idx    ON group_property_ownership(group_id);
CREATE INDEX gpo_property_idx ON group_property_ownership(property_id);
CREATE INDEX gpo_user_idx     ON group_property_ownership(user_id);

ALTER TABLE group_property_ownership ENABLE ROW LEVEL SECURITY;

CREATE POLICY gpo_member_select ON group_property_ownership
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_group_members bgm
      WHERE bgm.group_id = group_id AND bgm.user_id = auth.uid()
    )
  );

CREATE POLICY gpo_admin_write ON group_property_ownership
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM business_group_members bgm
      WHERE bgm.group_id = group_id
        AND bgm.user_id = auth.uid()
        AND bgm.role IN ('owner','admin')
    )
  );
