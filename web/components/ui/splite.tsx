'use client'

import { Component, Suspense, lazy, type ReactNode } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

// The scene is fetched from Spline's CDN at runtime. If that fails (outage,
// content blocker, no WebGL) render nothing rather than crash the page.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <SceneBoundary>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <span className="loader"></span>
          </div>
        }
      >
        <Spline scene={scene} className={className} />
      </Suspense>
    </SceneBoundary>
  )
}
