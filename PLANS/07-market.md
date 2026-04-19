# Task: Market Feature (Zillow Data on Map)

## Files to modify
- `web/lib/types.ts`
- `web/components/Sidebar.tsx`
- `Real-Estate-Search-Automation/.env`
- `Real-Estate-Search-Automation/back_end/postgresql_db.py`

## Files to create
- `web/supabase/migrations/001_create_rea_schema.sql`
- `web/app/api/market/properties/route.ts`
- `web/components/MarketMap.tsx`
- `web/components/MapFilters.tsx`
- `web/app/(dashboard)/market/page.tsx`

## Install
Leaflet already installed from Feature 6. Nothing new.

---

## Step 1: SQL Migration
Run in Supabase SQL editor (project `worpdncyiozjfbguxukb`):
```sql
CREATE SCHEMA IF NOT EXISTS rea;
CREATE TABLE rea.zillow_unique (
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
```

## Step 2: Python .env
**File:** `Real-Estate-Search-Automation/.env` — replace DB vars:
```ini
DB_HOST=aws-1-us-east-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.worpdncyiozjfbguxukb
DB_PASS=<Supabase dashboard → project worpdncyiozjfbguxukb → Settings → Database → password>
DB_SCHEMA=rea
```

## Step 3: Python DB writer
**File:** `Real-Estate-Search-Automation/back_end/postgresql_db.py`
- Change all schema refs: `"REA"` → `rea`
- Apply PEP8: snake_case, docstrings, 79-char lines, no bare `except:`

## Step 4: `web/lib/types.ts`
Append:
```typescript
export interface MarketProperty {
  id: string; price: number | null; beds: number | null; baths: number | null
  street: string | null; city: string | null; state: string | null; zipcode: string | null
  latitude: number; longitude: number
  img_src: string | null; detail_url: string | null
  home_type: string | null; home_status: string | null
}
```

## Step 5: `web/app/api/market/properties/route.ts`
```typescript
import { createServerClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = createServerClient()
  let query = supabase.schema("rea").from("zillow_unique")
    .select("id,price,beds,baths,street,city,state,zipcode,latitude,longitude,img_src,detail_url,home_type,home_status")
    .not("latitude", "is", null).not("longitude", "is", null)
  if (searchParams.get("city")) query = query.ilike("city", `%${searchParams.get("city")}%`)
  if (searchParams.get("min_price")) query = query.gte("price", searchParams.get("min_price"))
  if (searchParams.get("max_price")) query = query.lte("price", searchParams.get("max_price"))
  if (searchParams.get("beds")) query = query.gte("beds", searchParams.get("beds"))
  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

## Step 6: `web/components/MapFilters.tsx`
```tsx
"use client"
import { useState } from "react"

interface Filters { city: string; min_price: string; max_price: string; beds: string }
interface Props { onSearch: (f: Filters) => void }

export default function MapFilters({ onSearch }: Props) {
  const [f, setF] = useState<Filters>({ city: "", min_price: "", max_price: "", beds: "" })
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <select value={f.city} onChange={e => setF({ ...f, city: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm">
        <option value="">All Cities</option>
        {["San Juan","Ponce","Aguadilla","Carolina","Mayaguez"].map(c =>
          <option key={c} value={c}>{c}</option>)}
      </select>
      <input placeholder="Min price" value={f.min_price}
        onChange={e => setF({ ...f, min_price: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm w-28" />
      <input placeholder="Max price" value={f.max_price}
        onChange={e => setF({ ...f, max_price: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm w-28" />
      <select value={f.beds} onChange={e => setF({ ...f, beds: e.target.value })}
        className="border rounded-md px-3 py-2 bg-background text-sm">
        <option value="">Any beds</option>
        {["1","2","3","4"].map(n => <option key={n} value={n}>{n}+</option>)}
      </select>
      <button onClick={() => onSearch(f)}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm">
        Search
      </button>
    </div>
  )
}
```

## Step 7: `web/components/MarketMap.tsx`
```tsx
"use client"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { MarketProperty } from "@/lib/types"

const Map = dynamic(() => import("./MarketMapInner"), { ssr: false,
  loading: () => <div className="h-full bg-muted animate-pulse" /> })

export default function MarketMap({ filters }: { filters: any }) {
  const [properties, setProperties] = useState<MarketProperty[]>([])
  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v))
    fetch(`/api/market/properties?${params}`).then(r => r.json()).then(setProperties)
  }, [filters])
  return <Map properties={properties} />
}
```

Create `web/components/MarketMapInner.tsx` (same Leaflet icon fix pattern as Feature 6):
- `MapContainer` centered `[18.2208, -66.5901]` zoom 9
- Each property: `Marker` with `Popup` showing price, beds/baths, address, link to `detail_url`

## Step 8: `web/app/(dashboard)/market/page.tsx`
```tsx
"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import MapFilters from "@/components/MapFilters"

const MarketMap = dynamic(() => import("@/components/MarketMap"), { ssr: false })

export default function MarketPage() {
  const [filters, setFilters] = useState({})
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Property Market</h1>
      <MapFilters onSearch={setFilters} />
      <div className="h-[600px] rounded-lg overflow-hidden border">
        <MarketMap filters={filters} />
      </div>
    </div>
  )
}
```

## Step 9: `web/components/Sidebar.tsx`
Add to nav links array:
```typescript
{ href: "/market", icon: Map, label: "Market" }
```
`Map` is in lucide-react — add to imports.

## Step 10: Seed data
```bash
cd Real-Estate-Search-Automation && python main.py
```

## Done
- `/market` route exists and loads
- Map shows pins for Zillow listings in DB
- Filter controls narrow results
- Python scraper writes to `rea.zillow_unique` in project `worpdncyiozjfbguxukb`
