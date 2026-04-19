# Task: Saved Properties / Watchlist

## Files to modify
- `web/lib/types.ts`
- `web/app/(dashboard)/market/[id]/page.tsx`

## Files to create
- `web/app/api/watchlist/route.ts`
- `web/app/(dashboard)/watchlist/page.tsx`
- `web/components/WatchlistButton.tsx`

## SQL — run in Supabase SQL editor (project worpdncyiozjfbguxukb)
```sql
CREATE TABLE IF NOT EXISTS public.watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zillow_id   TEXT NOT NULL,
  price       NUMERIC,
  beds        INTEGER,
  baths       NUMERIC,
  street      TEXT,
  city        TEXT,
  state       TEXT,
  img_src     TEXT,
  detail_url  TEXT,
  home_type   TEXT,
  home_status TEXT,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, zillow_id)
);
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON public.watchlist USING (owner_id = auth.uid());
```

## Context
Landlords want to save Zillow listings they're interested in (potential acquisitions).
Watchlist lives in `public.watchlist` so it's tied to their account.
Zillow data snapshot saved at time of save — doesn't depend on `rea` schema later.

## Changes

### `web/lib/types.ts`
Add:
```typescript
export interface WatchlistItem {
  id: string
  owner_id: string
  zillow_id: string
  price: number | null
  beds: number | null
  baths: number | null
  street: string | null
  city: string | null
  state: string | null
  img_src: string | null
  detail_url: string | null
  home_type: string | null
  home_status: string | null
  saved_at: string
}
```

### Create `web/app/api/watchlist/route.ts`
```typescript
import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { error } = await supabase.from("watchlist").upsert({ owner_id: user.id, ...body }, { onConflict: "owner_id,zillow_id" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { zillow_id } = await req.json()
  await supabase.from("watchlist").delete().eq("owner_id", user.id).eq("zillow_id", zillow_id)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data } = await supabase.from("watchlist").select("*").eq("owner_id", user.id).order("saved_at", { ascending: false })
  return NextResponse.json(data ?? [])
}
```

### Create `web/components/WatchlistButton.tsx`
Client component. Toggle save/unsave on market detail page:
```tsx
"use client"
import { useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WatchlistButton({ property, saved }: { property: any; saved: boolean }) {
  const [isSaved, setIsSaved] = useState(saved)

  async function toggle() {
    if (isSaved) {
      await fetch("/api/watchlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zillow_id: property.id }) })
    } else {
      await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zillow_id: property.id, price: property.price, beds: property.beds, baths: property.baths, street: property.street, city: property.city, state: property.state, img_src: property.img_src, detail_url: property.detail_url, home_type: property.home_type, home_status: property.home_status }) })
    }
    setIsSaved(!isSaved)
  }

  return (
    <Button variant={isSaved ? "default" : "outline"} onClick={toggle}>
      <Heart className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
      {isSaved ? "Saved" : "Save to Watchlist"}
    </Button>
  )
}
```

### `web/app/(dashboard)/market/[id]/page.tsx`
Check if already in watchlist, pass to WatchlistButton:
```typescript
const { data: { user } } = await supabase.auth.getUser()
const { data: saved } = await supabase.from("watchlist").select("id").eq("owner_id", user!.id).eq("zillow_id", params.id).single()
// Add <WatchlistButton property={data} saved={!!saved} /> to JSX
```

### Create `web/app/(dashboard)/watchlist/page.tsx`
Server component listing saved properties as cards. Same card style as MarketListView.

### Add "Watchlist" to Sidebar navItems
```typescript
{ href: "/watchlist", icon: Heart, label: "Watchlist" }
```
Import `Heart` from lucide-react in Sidebar.

## Done
- Market detail page has Save/Unsave button
- `/watchlist` page shows saved listings as cards
- Heart icon in sidebar nav
- Saving snapshots property data — works even if Zillow listing expires
