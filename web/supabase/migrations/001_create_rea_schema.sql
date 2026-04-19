-- Run this in Supabase SQL editor (project worpdncyiozjfbguxukb)
CREATE SCHEMA IF NOT EXISTS rea;

CREATE TABLE IF NOT EXISTS rea.zillow_unique (
    id             TEXT PRIMARY KEY,
    price          NUMERIC,
    beds           INTEGER,
    baths          NUMERIC,
    street         TEXT,
    city           TEXT,
    state          TEXT,
    zipcode        TEXT,
    latitude       NUMERIC(10, 7),
    longitude      NUMERIC(10, 7),
    img_src        TEXT,
    detail_url     TEXT,
    home_type      TEXT,
    home_status    TEXT,
    days_on_zillow INTEGER,
    last_updated   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rea.zillow_unique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON rea.zillow_unique
    FOR SELECT TO authenticated USING (true);

-- Also add lat/lng to properties table if not done yet
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude  numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
