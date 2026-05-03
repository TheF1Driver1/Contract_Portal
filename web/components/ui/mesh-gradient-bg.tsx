'use client'

import { MeshGradient } from '@paper-design/shaders-react'

export function MeshGradientBg() {
  return (
    <MeshGradient
      className="absolute inset-0 w-full h-full"
      colors={['#000000', '#0a0a0a', '#141414', '#0d0d0d']}
      speed={0.4}
    />
  )
}
