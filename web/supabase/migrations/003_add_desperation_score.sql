-- Applied manually in Supabase SQL editor 2026-04-27
-- Adds seller motivation columns to rea.zillow_unique
-- Note: scraper (ensure_zillow_schema_and_tables) also adds these via ADD COLUMN IF NOT EXISTS on each run

ALTER TABLE rea.zillow_unique
  ADD COLUMN IF NOT EXISTS original_price       NUMERIC,
  ADD COLUMN IF NOT EXISTS num_price_cuts       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price_cut      NUMERIC,
  ADD COLUMN IF NOT EXISTS price_cut_pct        NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS daily_price_cut_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS last_cut_date        DATE,
  ADD COLUMN IF NOT EXISTS desperation_score    NUMERIC(5,2);

-- Update zillow_market view to expose new columns + fix camelCase passthrough
CREATE OR REPLACE VIEW public.zillow_market AS
SELECT
  id, price, beds, baths, street, city, state, zipcode,
  latitude, longitude,
  "imgSrc", "detailUrl", "homeType", "homeStatus", "daysOnZillow",
  last_updated_date,
  original_price, num_price_cuts, total_price_cut,
  price_cut_pct, daily_price_cut_rate, last_cut_date, desperation_score
FROM rea.zillow_unique;
