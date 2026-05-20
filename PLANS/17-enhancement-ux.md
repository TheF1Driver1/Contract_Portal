# 17 — Enhancement UX

**Branch**: `enhancement-UX` (off `refinement-UX`)
**Status**: Planned — not yet executed

---

## Features

### 1. Page Caching Between Nav Tabs
Prefetch pages on sidebar hover so navigation feels instant.

**Approach**:
- `Sidebar.tsx`: add `useRouter()`, call `router.prefetch(href)` on `onMouseEnter` for each nav link
- Next.js App Router client-side route cache handles the rest (30s TTL for visited pages)

**Files**: `web/components/Sidebar.tsx`

---

### 2. Skeleton Pre-loading (UI Before Data)
Show shimmer skeleton immediately while server component fetches data.

**New files**:
- `web/components/ui/skeleton.tsx` — `<Skeleton>` base with shimmer animation matching CSS vars
- `web/app/(dashboard)/dashboard/loading.tsx`
- `web/app/(dashboard)/contracts/loading.tsx`
- `web/app/(dashboard)/properties/loading.tsx`
- `web/app/(dashboard)/tenants/loading.tsx`
- `web/app/(dashboard)/market/loading.tsx`
- `web/app/(dashboard)/watchlist/loading.tsx`

Skeleton style: `--surface-card` bg, shimmer `rgba(255,255,255,0.04→0.09→0.04)`.

---

### 3. Help/Readme Tooltip Icons
Small `?` icon on buttons/sections that shows description on hover.

**Install**: `npm install @radix-ui/react-tooltip` (in `web/`)

**New files**:
- `web/components/ui/help-tooltip.tsx` — `<HelpTooltip text="..." />` with Radix Tooltip

**Add to**:
- `Sidebar.tsx` nav items
- `AddPropertyModal` trigger
- `ContractBuilder.tsx` — step headers, late fee field, security deposit field
- `CashflowChart.tsx` — section header
- `InvestmentAnalyzer.tsx` — CAP rate, cash-on-cash, GRM, break-even metrics
- `RenewalModal.tsx` — key action buttons
- `properties/page.tsx` — map section header
- `dashboard/page.tsx` — stat cards

Tooltip style: dark glass card, 12px font, max-width 240px.

---

### 4. Expense Tracking
Record actual property expenses for tax deductions + net cashflow tracking.

#### 4a. DB Migration
File: `web/supabase/migrations/007_property_expenses.sql`
Apply via Supabase MCP `apply_migration` (project: `worpdncyiozjfbguxukb`)

```sql
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
```

#### 4b. TypeScript Type
Add to `web/lib/types.ts`:
```typescript
export interface PropertyExpense {
  id: string;
  property_id: string;
  user_id: string;
  category: 'maintenance'|'utilities'|'insurance'|'taxes'|'hoa'|
            'repairs'|'management'|'advertising'|'mortgage'|'other';
  amount: number;
  expense_date: string;
  description: string | null;
  vendor: string | null;
  is_tax_deductible: boolean;
  receipt_url: string | null;
  created_at: string;
}
```

#### 4c. API Routes
- `web/app/api/expenses/route.ts` — GET (filterable by `property_id`, `year`), POST
- `web/app/api/expenses/[id]/route.ts` — PATCH, DELETE

#### 4d. UI
- `web/app/(dashboard)/expenses/page.tsx` — list by property, year/category/property filters, totals
- `web/app/(dashboard)/expenses/AddExpenseModal.tsx` — property picker, category, amount, date, description, vendor, tax-deductible toggle
- `web/app/(dashboard)/expenses/loading.tsx` — skeleton

#### 4e. Net Cashflow
Per property:
- `annual_rent_income` = sum of `contracts.rent_amount * 12` for active contracts on property
- `annual_expenses` = sum of `property_expenses.amount` for current year
- `net_cashflow` = income - expenses

#### 4f. Properties Page Update
`web/app/(dashboard)/properties/page.tsx`: add per-property card badge showing YTD expenses + net cashflow.

#### 4g. Dashboard Widget
`web/app/(dashboard)/dashboard/page.tsx`: add income vs expenses bar chart per property (Recharts, existing pattern) + total tax-deductible for current year.

#### 4h. Sidebar Nav
`Sidebar.tsx`: add `{ href: "/expenses", label: "Expenses", icon: Receipt }` to `navItems`.

---

## File Change Summary

| File | Action |
|------|--------|
| `web/supabase/migrations/007_property_expenses.sql` | CREATE |
| `web/lib/types.ts` | EDIT — add `PropertyExpense` |
| `web/components/ui/skeleton.tsx` | CREATE |
| `web/components/ui/help-tooltip.tsx` | CREATE |
| `web/components/Sidebar.tsx` | EDIT — prefetch on hover + Expenses nav item |
| `web/app/(dashboard)/dashboard/loading.tsx` | CREATE |
| `web/app/(dashboard)/contracts/loading.tsx` | CREATE |
| `web/app/(dashboard)/properties/loading.tsx` | CREATE |
| `web/app/(dashboard)/tenants/loading.tsx` | CREATE |
| `web/app/(dashboard)/market/loading.tsx` | CREATE |
| `web/app/(dashboard)/watchlist/loading.tsx` | CREATE |
| `web/app/(dashboard)/expenses/page.tsx` | CREATE |
| `web/app/(dashboard)/expenses/loading.tsx` | CREATE |
| `web/app/(dashboard)/expenses/AddExpenseModal.tsx` | CREATE |
| `web/app/api/expenses/route.ts` | CREATE |
| `web/app/api/expenses/[id]/route.ts` | CREATE |
| `web/app/(dashboard)/dashboard/page.tsx` | EDIT — cashflow widget |
| `web/app/(dashboard)/properties/page.tsx` | EDIT — per-property expense summary |
| `web/components/ContractBuilder.tsx` | EDIT — HelpTooltip on key fields |
| `web/components/CashflowChart.tsx` | EDIT — HelpTooltip on header |
| `web/components/InvestmentAnalyzer.tsx` | EDIT — HelpTooltip on metric labels |

---

## Verification Checklist
- [ ] `npm run build` — no TS errors
- [ ] Sidebar hover triggers prefetch (Network tab shows RSC requests)
- [ ] Hard refresh shows skeleton, then content
- [ ] `?` icons hover shows correct tooltip text
- [ ] Add expense → row appears in Supabase `property_expenses`
- [ ] Properties page shows YTD expense + net cashflow per card
- [ ] Dashboard cashflow widget shows income vs expense bars
- [ ] RLS verified — expenses only visible to owner
