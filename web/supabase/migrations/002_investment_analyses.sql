-- Run in Supabase SQL editor
-- Investment analyses table — stores user inputs per watchlist property

CREATE TABLE IF NOT EXISTS investment_analyses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid REFERENCES auth.users NOT NULL,
  watchlist_id         uuid REFERENCES watchlist(id) ON DELETE CASCADE NOT NULL,

  -- Acquisition
  purchase_price       numeric NOT NULL,
  down_payment_pct     numeric NOT NULL DEFAULT 20,
  closing_cost_pct     numeric NOT NULL DEFAULT 3,

  -- Financing
  mortgage_rate_pct    numeric NOT NULL DEFAULT 7.0,
  loan_term_years      int    NOT NULL DEFAULT 30,

  -- Operating expenses (stored as annual %)
  annual_tax_pct       numeric NOT NULL DEFAULT 1.1,
  annual_insurance_pct numeric NOT NULL DEFAULT 0.8,
  maintenance_pct      numeric NOT NULL DEFAULT 1.0,

  -- Monthly fixed costs
  monthly_hoa          numeric NOT NULL DEFAULT 0,
  monthly_utilities    numeric NOT NULL DEFAULT 150,

  -- Income assumptions
  estimated_rent       numeric,
  vacancy_rate_pct     numeric NOT NULL DEFAULT 5,

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE investment_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only select" ON investment_analyses
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "owner only insert" ON investment_analyses
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner only update" ON investment_analyses
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "owner only delete" ON investment_analyses
  FOR DELETE USING (owner_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER investment_analyses_updated_at
  BEFORE UPDATE ON investment_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
