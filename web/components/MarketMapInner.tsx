"use client"
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { MarketProperty } from '@/lib/types'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function MarketMapInner({ properties }: { properties: MarketProperty[] }) {
  return (
    <MapContainer center={[18.2208, -66.5901]} zoom={9} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {properties.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]}>
          <Popup>
            <div className="text-sm space-y-1">
              <p className="font-semibold">{p.price ? `$${p.price.toLocaleString()}` : '—'}</p>
              <p>{p.beds ?? '—'} bd · {p.baths ?? '—'} ba</p>
              <p>{p.street}, {p.city}</p>
              {p.detail_url && (
                <a href={p.detail_url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 underline">View listing</a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
