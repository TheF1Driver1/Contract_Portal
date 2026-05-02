# Plan 14 — CRIM Tax Integration

## Status: DONE

## Goal
Replace generic PR: 0.30% flat rate in `investment.ts` with per-municipality CRIM rates
from `rea.crim_tax_rates` (already seeded by Real-Estate-Search-Automation scraper).

## Context
- `web/lib/investment.ts` line 13: `PR: 0.30` — flat placeholder, wrong
- CRIM actual rates: 8–12% on *assessed value* (assessed ≈ 45% of list price)
- All 78 municipalities already in Supabase `rea.crim_tax_rates`
- `estimate_crim_tax(price, city, assessment_ratio=0.45)` logic must be ported to TS

## CRIM Tax Formula
```
assessed_value = price × 0.45
annual_tax     = assessed_value × (inmueble_rate / 100)
monthly_tax    = annual_tax / 12
```

## Files to Change

### 1. `web/lib/investment.ts`
- Remove `PR: 0.30` from `STATE_TAX_RATES`
- Add `CRIM_ASSESSMENT_RATIO = 0.45`
- Update `calcMetrics()`: if `state === "PR"` and `city` provided → fetch from Supabase or accept pre-passed rate
- Add helper: `calcCrimMonthlyTax(price, inmuebleRatePct): number`

### 2. `web/lib/types.ts`
- Add optional `crim_rate_pct?: number` to `InvestmentAnalysis`

### 3. `web/components/InvestmentAnalyzer.tsx`
- When property is in PR: fetch CRIM rate from `rea.crim_tax_rates` by city
- Pass `crim_rate_pct` into `calcMetrics()`
- Show in UI: "Property Tax (CRIM — {Municipality} {rate}%)"

### 4. New API route: `web/app/api/crim-rate/route.ts`
```ts
GET /api/crim-rate?city=San+Juan&fiscal_year=2025-2026
→ { municipality, inmueble_rate, mueble_rate, assessed_value?, estimated_monthly_tax? }
```
Query: `SELECT * FROM rea.crim_tax_rates WHERE municipality ILIKE $city AND fiscal_year = $fy`

## Market Detail Page (`/market/[id]`)
- If property `state === "PR"`: show CRIM tax estimate in property detail cards
- Label: "Est. CRIM Tax / mo" with tooltip explaining assessment ratio

## Notes
- `rea.crim_tax_rates` table owned by scraper — read-only from portal
- City name matching: use `ILIKE` + strip accents (same unicode normalize logic as Python)
- Fallback: if city not found → show input field for manual rate
- assessment_ratio = 0.45 is an estimate; actual varies. Show disclaimer in UI.

## Effort: ~3 hrs
