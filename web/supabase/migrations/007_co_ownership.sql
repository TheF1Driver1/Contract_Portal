-- =============================================
-- Migration 007: Co-ownership & user discovery
-- =============================================

-- RPC: search other platform users by email (safe: returns limited fields only)
CREATE OR REPLACE FUNCTION search_profiles_by_email(search_email text)
RETURNS TABLE(id uuid, full_name text, email text) AS $$
  SELECT p.id, p.full_name, p.email
  FROM profiles p
  WHERE p.email ILIKE '%' || search_email || '%'
    AND p.id != auth.uid()
  ORDER BY p.full_name
  LIMIT 10;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Property co-owners junction table
CREATE TABLE property_co_owners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  co_owner_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ownership_pct numeric(5,2) NOT NULL CHECK (ownership_pct > 0 AND ownership_pct <= 100),
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','accepted','declined')),
  invited_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  UNIQUE (property_id, co_owner_id)
);

CREATE INDEX property_co_owners_property_idx  ON property_co_owners(property_id);
CREATE INDEX property_co_owners_owner_idx     ON property_co_owners(owner_id);
CREATE INDEX property_co_owners_co_owner_idx  ON property_co_owners(co_owner_id);

ALTER TABLE property_co_owners ENABLE ROW LEVEL SECURITY;

-- Property owner: full CRUD on invitations they sent
CREATE POLICY co_owners_owner_all ON property_co_owners
  FOR ALL USING (owner_id = auth.uid());

-- Co-owner: can see their own invitations
CREATE POLICY co_owners_invitee_select ON property_co_owners
  FOR SELECT USING (co_owner_id = auth.uid());

-- Co-owner: can accept/decline (update status + accepted_at only)
CREATE POLICY co_owners_invitee_update ON property_co_owners
  FOR UPDATE USING (co_owner_id = auth.uid());
