-- =============================================
-- Migration 005: Property counts, late fee system, contract snapshots
-- =============================================

-- ── Properties: bathroom + parking (canonical, reusable across contracts) ──
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS bathroom_count    integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parking_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking_count     integer;  -- NULL = no parking

-- ── Contracts: late fee penalty system ──
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS late_fee_type                text NOT NULL DEFAULT 'fixed'
    CHECK (late_fee_type IN ('fixed', 'daily', 'both')),
  ADD COLUMN IF NOT EXISTS late_fee_grace_period_days   integer NOT NULL DEFAULT 0
    CHECK (late_fee_grace_period_days >= 0),
  ADD COLUMN IF NOT EXISTS late_fee_fixed_amount        numeric(10,2) NOT NULL DEFAULT 0
    CHECK (late_fee_fixed_amount >= 0),
  ADD COLUMN IF NOT EXISTS late_fee_daily_amount        numeric(10,2) NOT NULL DEFAULT 0
    CHECK (late_fee_daily_amount >= 0);

-- ── Contracts: immutable snapshots for legal/audit ──
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS tenant_snapshot   jsonb,
  ADD COLUMN IF NOT EXISTS property_snapshot jsonb;

-- ── Tenants: expanded personal/employment fields ──
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS date_of_birth           date,
  ADD COLUMN IF NOT EXISTS employer_name           text,
  ADD COLUMN IF NOT EXISTS employer_phone          text,
  ADD COLUMN IF NOT EXISTS monthly_income          numeric(10,2),
  ADD COLUMN IF NOT EXISTS emergency_contact_name  text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- ── Contract occupants (co-tenants / guarantors — contract-scoped) ──
CREATE TABLE IF NOT EXISTS contract_occupants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES contracts(id)  ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'co_tenant'
    CHECK (role IN ('co_tenant', 'guarantor', 'emergency_contact')),
  full_name       text NOT NULL,
  email           text,
  phone           text,
  ssn_last4       text,
  license_number  text,
  current_address text,
  date_of_birth   date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contract_occupants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_occupants_owner_only" ON contract_occupants
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS contract_occupants_contract_idx ON contract_occupants(contract_id);
CREATE INDEX IF NOT EXISTS contract_occupants_owner_idx    ON contract_occupants(owner_id);

-- ── Storage bucket for generated contract PDFs ──
-- Run this separately in the Supabase dashboard if the bucket doesn't exist:
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('contracts', 'contracts', false)
--   ON CONFLICT (id) DO NOTHING;
