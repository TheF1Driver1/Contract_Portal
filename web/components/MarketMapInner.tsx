"use client"
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import type { MarketProperty } from '@/lib/types'
import { MotivationBadge } from '@/components/market/MotivationBadge'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Leaflet paints popups white by default; repaint them with tokens so dark mode works.
// leaflet.css is unlayered, so these overrides need the `!` (important) modifier.
const POPUP_CLASS =
  '[&_.leaflet-popup-content-wrapper]:bg-surface! [&_.leaflet-popup-content-wrapper]:text-foreground! ' +
  '[&_.leaflet-popup-content-wrapper]:rounded-lg! [&_.leaflet-popup-content-wrapper]:shadow-md! ' +
  '[&_.leaflet-popup-tip]:bg-surface! [&_.leaflet-popup-close-button]:text-subtle-foreground!'

export default function MarketMapInner({ properties }: { properties: MarketProperty[] }) {
  const t = useTranslations('market')
  const f = useFormatter()
  return (
    <MapContainer center={[18.2208, -66.5901]} zoom={9} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {properties.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]}>
          <Popup className={POPUP_CLASS}>
            <div className="min-w-44 space-y-1 text-sm text-foreground">
              <p className="tabular text-base font-semibold">{p.price ? f.number(p.price, 'money') : '—'}</p>
              <p className="text-muted-foreground">{t('bedsBaths', { beds: p.beds ?? '—', baths: p.baths ?? '—' })}</p>
              <p>{[p.street, p.city].filter(Boolean).join(', ')}</p>
              <MotivationBadge score={p.desperation_score} />
              <div className="flex gap-3 pt-1">
                <Link href={`/market/${p.id}`} className="font-medium text-primary! underline underline-offset-2">
                  {t('map.details')}
                </Link>
                {p.detailUrl && (
                  <a href={p.detailUrl} target="_blank" rel="noopener noreferrer"
                    className="text-primary! underline underline-offset-2">{t('map.listing')}</a>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
