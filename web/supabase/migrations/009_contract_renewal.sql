-- =============================================
-- Migration 009: Contract renewal + alert tracking
-- =============================================

-- Link renewal contracts to their originals
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS parent_contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_renewal         boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contracts_parent_idx ON contracts(parent_contract_id);

-- Track expiry alert emails sent per contract to prevent duplicates
CREATE TABLE contract_alerts (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid  NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id    uuid  NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  alert_type  text  NOT NULL
                CHECK (alert_type IN ('expiry_60','expiry_30','expiry_14','renewal_sent')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  UNIQUE (contract_id, alert_type)
);

CREATE INDEX contract_alerts_contract_idx ON contract_alerts(contract_id);
CREATE INDEX contract_alerts_owner_idx    ON contract_alerts(owner_id);

ALTER TABLE contract_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_owner_all ON contract_alerts
  FOR ALL USING (owner_id = auth.uid());
