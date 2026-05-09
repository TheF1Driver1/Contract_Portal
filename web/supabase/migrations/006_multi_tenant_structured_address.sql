-- =============================================
-- Migration 006: Multi-tenant, structured addresses
-- =============================================

-- ── Tenants: structured current + previous addresses ──
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS current_street   text,
  ADD COLUMN IF NOT EXISTS current_unit     text,
  ADD COLUMN IF NOT EXISTS current_city     text,
  ADD COLUMN IF NOT EXISTS current_state    text,
  ADD COLUMN IF NOT EXISTS current_zip      text,
  ADD COLUMN IF NOT EXISTS current_country  text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS previous_street  text,
  ADD COLUMN IF NOT EXISTS previous_unit    text,
  ADD COLUMN IF NOT EXISTS previous_city    text,
  ADD COLUMN IF NOT EXISTS previous_state   text,
  ADD COLUMN IF NOT EXISTS previous_zip     text,
  ADD COLUMN IF NOT EXISTS previous_country text DEFAULT 'US';

-- ── Properties: unit + country (street already exists as 'address' col) ──
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS unit    text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US';

-- ── Contract occupants: link to tenant record + capture signature ──
ALTER TABLE contract_occupants
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot  jsonb;

CREATE INDEX IF NOT EXISTS contract_occupants_tenant_idx ON contract_occupants(tenant_id);
