CREATE TABLE property_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  category text NOT NULL CHECK (category IN (
    'maintenance','utilities','insurance','taxes','hoa',
    'repairs','management','advertising','mortgage','other'
  )),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL,
  description text,
  vendor text,
  is_tax_deductible boolean DEFAULT true,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE property_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON property_expenses
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_expenses_property ON property_expenses(property_id);
CREATE INDEX idx_expenses_user_date ON property_expenses(user_id, expense_date DESC);
