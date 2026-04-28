# Plan 15 — Seller Desperation Score

## Status: TODO

## Goal
Surface seller motivation score (0–100) on market listings and detail pages.
Logic already built in Real-Estate-Search-Automation (`modules/seller_metrics.py`).
DB columns don't exist yet in `rea.zillow_unique` — need migration + UI.

## What Was Built (scraper side)
`calculate_desperation_score(current_price, original_price, days_on_market, num_price_cuts, days_since_last_cut)`

Score formula:
- `velocity = price_cut_pct / days_on_market × 100` (core driver)
- `+20/12/6/0` recency bonus (cut within 7/14/30/30+ days)
- `+min(num_cuts × 4, 20)` frequency bonus
- `-10` stale penalty (>90 days, zero cuts)
- Clamped 0–100

## Missing DB Columns
`rea.zillow_unique` needs migration:
```sql
ALTER TABLE rea.zillow_unique
  ADD COLUMN IF NOT EXISTS original_price     NUMERIC,
  ADD COLUMN IF NOT EXISTS num_price_cuts     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price_cut    NUMERIC,
  ADD COLUMN IF NOT EXISTS price_cut_pct      NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS daily_price_cut_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS last_cut_date      DATE,
  ADD COLUMN IF NOT EXISTS desperation_score  NUMERIC(5,2);
```

## Files to Change

### 1. New migration: `web/supabase/migrations/002_add_desperation_score.sql`
Add columns above.

### 2. Market List page (`/market`)
- New column/badge: "Motivation" with color scale
  - 0–20: gray (no signal)
  - 21–40: yellow (mild)
  - 41–60: orange (moderate)
  - 61–100: red (high motivation)
- Show `price_cut_pct` and `num_price_cuts` as sub-labels

### 3. Market Detail page (`/market/[id]`)
- Add "Seller Signals" card:
  - Desperation Score gauge (0–100)
  - Original Price vs Current Price delta
  - # of price cuts
  - Days since last cut
  - Days on market

### 4. Market Analytics (`/market` stats widget)
- Add: avg desperation score by city
- "Most motivated sellers" top-5 list

### 5. API route update: `web/app/api/market/stats/route.ts`
- Include `desperation_score`, `price_cut_pct`, `original_price` in select

### 6. Watchlist
- Show desperation score badge on saved properties

## Notes
- Scraper populates columns — portal is read-only
- Score = 0 for new listings (no price history) — expected
- Rename in UI: "Seller Motivation" (less aggressive than "desperation" for user-facing)
- Tooltip: explain scoring methodology

## Effort: ~4 hrs
