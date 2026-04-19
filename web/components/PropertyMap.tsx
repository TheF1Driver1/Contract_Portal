"use client"
import dynamic from 'next/dynamic'

const Inner = dynamic(() => import('./PropertyMapInner'), {
  ssr: false,
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-xl" />,
})

export default function PropertyMap({ properties, allProperties }: { properties: any[]; allProperties: any[] }) {
  return <Inner properties={properties} allProperties={allProperties} />
}
