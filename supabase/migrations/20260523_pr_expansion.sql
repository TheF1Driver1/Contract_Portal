-- PR Expansion: jurisdiction, governing_law, i18n locale, subscription tiers, property managers

-- 1. Properties: add jurisdiction
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS jurisdiction text NOT NULL DEFAULT 'pr'
    CHECK (jurisdiction IN ('pr', 'us_mainland', 'other'));

-- 2. Contracts: add governing law and template version snapshot
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS governing_law text
    CHECK (governing_law IN ('ley_14_2022', 'ley_464', 'other')),
  ADD COLUMN IF NOT EXISTS template_version text;

-- 3. Contract templates: add system flag, jurisdiction, version
ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS jurisdiction text
    CHECK (jurisdiction IN ('pr', 'us_mainland', 'other', 'all')),
  ADD COLUMN IF NOT EXISTS template_version text NOT NULL DEFAULT '1.0.0';

-- Allow system templates to have null owner_id
ALTER TABLE contract_templates
  ALTER COLUMN owner_id DROP NOT NULL;

-- 4. Profiles: add locale and subscription plan
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es'
    CHECK (locale IN ('es', 'en')),
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'propietario', 'inversionista', 'enterprise'));

-- 5. Property expenses: mortgage interest flag for Schedule E
ALTER TABLE property_expenses
  ADD COLUMN IF NOT EXISTS is_mortgage_interest boolean NOT NULL DEFAULT false;

-- 6. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'propietario', 'inversionista', 'enterprise')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscription"
  ON subscriptions FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 7. Property managers table
CREATE TABLE IF NOT EXISTS property_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_email text NOT NULL,
  property_ids uuid[] NOT NULL DEFAULT '{}',
  permissions jsonb NOT NULL DEFAULT '{"view": true, "create_contracts": true, "sign_contracts": false}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  invite_token text UNIQUE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE property_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their property managers"
  ON property_managers FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Managers can view their own record"
  ON property_managers FOR SELECT
  USING (manager_user_id = auth.uid());

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_id ON subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_managers_owner ON property_managers(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_managers_token ON property_managers(invite_token);
CREATE INDEX IF NOT EXISTS idx_contracts_governing_law ON contracts(governing_law);
CREATE INDEX IF NOT EXISTS idx_properties_jurisdiction ON properties(jurisdiction);
