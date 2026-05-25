# Plan 23 — Feature Roadmap: Payment Tracking, Schedule E, Act 60 Panel

Three distinct features for Propietario/Inversionista users. Each is scoped independently — implement in any order.

---

## Feature A — Tenant Payment Tracking

### Problem
Landlords have no way to record whether a tenant paid rent each month. They track this in spreadsheets or memory.

### Scope
**DB table: `rent_payments`**
```sql
CREATE TABLE rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id),
  due_date date NOT NULL,
  paid_date date,
  amount_due numeric(10,2) NOT NULL,
  amount_paid numeric(10,2),
  status text NOT NULL DEFAULT 'pending', -- pending | paid | partial | late
  notes text,
  created_at timestamptz DEFAULT now()
);
-- RLS: owner_id = auth.uid()
```

**API routes**
- `GET /api/rent-payments?contract_id=X` — list for a contract
- `POST /api/rent-payments` — log a payment
- `PATCH /api/rent-payments/[id]` — mark paid / update amount

**UI: `/contracts/[id]/payments` tab**
- Monthly calendar grid showing due date vs paid date
- "Mark as paid" button per row
- Late indicator (paid_date > due_date + grace period)
- Running total: collected vs expected YTD

**Cron integration**
- Daily cron (`/api/cron/notify`) already exists — extend it to flip `pending → late` when `due_date` passes without payment

### Plan gate
- Free: view only (read existing records)
- Propietario+: create/update

### Effort: ~6 hours

---

## Feature B — Schedule E Report Builder

### Problem
The `/reports/schedule-e` page exists but is likely a stub. Puerto Rico landlords filing IRS Schedule E need a pre-filled breakdown of rental income vs deductible expenses per property per year.

### Scope
**Report logic (`lib/schedule-e.ts`)**
- Aggregate `rent_payments` (income) and `expenses` (deductions) by property by calendar year
- Categorize expenses into IRS Schedule E lines:
  - Advertising, Auto, Cleaning, Depreciation, Insurance, Management fees, Mortgage interest, Other interest, Repairs, Supplies, Taxes, Utilities, Other

**UI: `/reports/schedule-e`**
- Year selector (default: current year)
- Property selector (or "All properties")
- Table: one row per property → income, total expenses, net income/loss
- Expense breakdown accordion (IRS line-item categories)
- "Export as PDF" button (uses existing docx/pdf pipeline or browser print)
- "Export as CSV" button

**Plan gate:** Inversionista only (already gated in nav)

### Effort: ~5 hours

---

## Feature C — Act 60 Portfolio Panel

### Problem
Act 60 investors managing multiple Puerto Rico rental properties need a high-level view of their portfolio performance — total income, occupancy rate, gross yield — aligned with Act 60 reporting needs.

### Scope
**Page: `/reports/act60` (new)**
- Portfolio summary card: total units, occupied %, total monthly income, gross yield %
- Per-property table: address, rent, occupancy, expenses, net income, yield
- Act 60 decree status field (stored in `properties.act60_decree_number`)
- Export to PDF button (browser print)

**DB addition**
```sql
ALTER TABLE properties ADD COLUMN IF NOT EXISTS act60_decree_number text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2);
```
Gross yield = (annual_rent / purchase_price) × 100

**UI additions**
- Add "Act 60 Decree #" and "Purchase Price" fields to the property edit form
- Add "Act 60 Panel" nav link (visible only to Inversionista/Enterprise)

**Plan gate:** Inversionista only

### Effort: ~4 hours

---

## Recommended implementation order
1. **Feature A** (Payment Tracking) — foundational; Schedule E depends on payment data
2. **Feature B** (Schedule E) — needs payment data from Feature A
3. **Feature C** (Act 60 Panel) — independent, can be done anytime

---

## Acceptance criteria (per feature)

### A — Payment Tracking
- [ ] Landlord can log a payment against a contract
- [ ] Overdue payments auto-flagged by cron
- [ ] YTD income visible per contract

### B — Schedule E
- [ ] Inversionista user can generate a year/property-filtered report
- [ ] Expense categories map to IRS Schedule E lines
- [ ] CSV export works

### C — Act 60 Panel
- [ ] Portfolio summary shows correct totals
- [ ] Gross yield calculated correctly from purchase price
- [ ] Decree number stored and displayed per property
