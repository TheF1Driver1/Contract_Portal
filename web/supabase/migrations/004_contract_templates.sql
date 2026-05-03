-- =============================================
-- Contract Templates
-- Each landlord can upload their own .docx template.
-- Contracts can reference a specific template; fallback is the default template.
-- =============================================

CREATE TABLE IF NOT EXISTS contract_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  file_url    text NOT NULL,
  contract_type text NOT NULL DEFAULT 'all'
    CHECK (contract_type IN ('all', 'lease', 'rental', 'addendum')),
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_templates_owner_only" ON contract_templates
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS contract_templates_owner_idx
  ON contract_templates(owner_id);

-- Only one default per owner+type combination.
-- Enforced via trigger below.
CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_one_default_per_type
  ON contract_templates(owner_id, contract_type)
  WHERE is_default = true;

-- Add template FK to contracts
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES contract_templates(id) ON DELETE SET NULL;
