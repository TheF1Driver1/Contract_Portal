'use client'

import Link from 'next/link'
import { Spotlight } from '@/components/ui/spotlight'
import { SplineScene } from '@/components/ui/splite'
import { MeshGradientBg } from '@/components/ui/mesh-gradient-bg'

export function LandingPage() {
  return (
    <main className="min-h-screen w-full relative overflow-hidden">
      {/* Background layers */}
      <MeshGradientBg />
      <SplineScene
        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
        className="absolute inset-0 w-full h-full"
      />

      {/* Cursor spotlight */}
      <Spotlight size={150} springOptions={{ stiffness: 60, damping: 20, mass: 1 }} />

      {/* Foreground content */}
      <div className="pointer-events-none relative z-10 flex items-center h-screen px-12">
        <div className="pointer-events-auto flex flex-col gap-6 max-w-lg">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            Modern Lease<br />Management
          </h1>

          <p className="text-neutral-400 text-lg leading-relaxed">
            Generate, sign, and deliver rental contracts — all in one place. Built for landlords.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/login"
              className="px-6 py-3 rounded-lg bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
