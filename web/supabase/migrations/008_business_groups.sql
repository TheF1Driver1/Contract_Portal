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

-- ── Members ───────────────────────────────────────────────────────────────────

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

-- ── Group properties ──────────────────────────────────────────────────────────

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

-- ── SECURITY DEFINER helpers (avoid recursive policy checks) ─────────────────
-- Self-referencing EXISTS on business_group_members causes infinite recursion.
-- SECURITY DEFINER bypasses RLS inside the function body.

CREATE OR REPLACE FUNCTION is_group_member(gid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_group_admin(gid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_group_members
    WHERE group_id = gid AND user_id = auth.uid() AND role IN ('owner','admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Policies ──────────────────────────────────────────────────────────────────

CREATE POLICY groups_member_select ON business_groups
  FOR SELECT USING (is_group_member(id));

CREATE POLICY bgm_member_select ON business_group_members
  FOR SELECT USING (is_group_member(group_id));

CREATE POLICY bgm_admin_all ON business_group_members
  FOR ALL USING (is_group_admin(group_id));

CREATE POLICY bgp_member_select ON business_group_properties
  FOR SELECT USING (is_group_member(group_id));

CREATE POLICY bgp_admin_write ON business_group_properties
  FOR ALL USING (is_group_admin(group_id));

CREATE POLICY gpo_member_select ON group_property_ownership
  FOR SELECT USING (is_group_member(group_id));

CREATE POLICY gpo_admin_write ON group_property_ownership
  FOR ALL USING (is_group_admin(group_id));
