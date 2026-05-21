-- 1. Role column on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'landlord'
  CHECK (role IN ('landlord', 'tenant'));

CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- 2. Invite tokens table
CREATE TABLE IF NOT EXISTS tenant_invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text        NOT NULL UNIQUE,
  contract_id  uuid        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_email text        NOT NULL,
  tenant_name  text        NOT NULL DEFAULT '',
  used         boolean     NOT NULL DEFAULT false,
  used_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at      timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_invites_owner_all" ON tenant_invites
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS tenant_invites_token_idx    ON tenant_invites(token);
CREATE INDEX IF NOT EXISTS tenant_invites_contract_idx ON tenant_invites(contract_id);
CREATE INDEX IF NOT EXISTS tenant_invites_owner_idx    ON tenant_invites(owner_id);

-- 3. RLS: tenants can SELECT the contract they've accepted an invite for
CREATE POLICY "contracts_tenant_select" ON contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_invites ti
      WHERE ti.contract_id = contracts.id
        AND ti.used_by = auth.uid()
        AND ti.used = true
    )
  );

-- 4. RLS: tenants can read properties linked to their contract
CREATE POLICY "properties_tenant_select" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_invites ti
      JOIN contracts c ON c.id = ti.contract_id
      WHERE c.property_id = properties.id
        AND ti.used_by = auth.uid()
        AND ti.used = true
    )
  );
