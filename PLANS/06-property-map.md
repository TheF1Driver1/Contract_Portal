# Task: Property Map (Landlord's Own Rentals)

## Files to modify
- `web/lib/types.ts`
- `web/app/(dashboard)/properties/page.tsx`

## Files to create
- `web/components/PropertyMapInner.tsx`
- `web/components/PropertyMap.tsx`
- `web/app/api/properties/geocode/route.ts`

## Install
```bash
cd Contract_Portal/web && npm install leaflet react-leaflet && npm install -D @types/leaflet
```

## Step 1: DB Migration
Run in Supabase SQL editor (project `worpdncyiozjfbguxukb`):
```sql
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude  numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
```

## Step 2: `web/lib/types.ts`
Add to `Property` interface:
```typescript
latitude?: number | null
longitude?: number | null
```

## Step 3: Create `web/components/PropertyMapInner.tsx`
```tsx
"use client"
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Required: fix webpack icon bug
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
})

interface Prop { id: string; address: string; latitude: number; longitude: number }

export default function PropertyMapInner({ properties }: { properties: Prop[] }) {
  return (
    <MapContainer center={[18.2208, -66.5901]} zoom={9} className="h-96 w-full rounded-xl">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {properties.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]}>
          <Popup>{p.address}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

## Step 4: Create `web/components/PropertyMap.tsx`
```tsx
"use client"
import dynamic from 'next/dynamic'
const Inner = dynamic(() => import('./PropertyMapInner'), {
  ssr: false,
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-xl" />,
})
export default function PropertyMap({ properties }: { properties: any[] }) {
  return <Inner properties={properties} />
}
```
**`ssr: false` is required** — Leaflet uses `window`, crashes on server.

## Step 5: Create `web/app/api/properties/geocode/route.ts`
```typescript
import { createServerClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { id, lat, lng } = await req.json()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("properties")
    .update({ latitude: lat, longitude: lng })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

## Step 6: `web/app/(dashboard)/properties/page.tsx`
Add geocoding effect + map render:
```tsx
import PropertyMap from "@/components/PropertyMap"

// After fetching properties:
const mapped = properties.filter(p => p.latitude && p.longitude)

// Add to JSX above property list:
{properties.length > 0 && <PropertyMap properties={mapped} />}
```

Geocoding (for unmapped properties) happens client-side inside `PropertyMapInner` via `useEffect`:
```typescript
useEffect(() => {
  const missing = allProperties.filter(p => !p.latitude)
  missing.forEach(async (p, i) => {
    await new Promise(r => setTimeout(r, i * 1100)) // 1 req/sec Nominatim limit
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(p.address + ', Puerto Rico')}`)
    const data = await res.json()
    if (data[0]) {
      await fetch('/api/properties/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, lat: data[0].lat, lng: data[0].lon }),
      })
    }
  })
}, [])
```

## Done
- Properties page shows Leaflet map above list
- Pins appear for properties with lat/lng in DB
- First load with no coords: pins appear after geocode completes and page refreshes
- No SSR crash (`window is not defined`)
