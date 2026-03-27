/// <reference types="vite/client" />

declare module 'cobe' {
  interface GlobeOptions {
    devicePixelRatio?: number
    width: number
    height: number
    phi?: number
    theta?: number
    dark?: number
    diffuse?: number
    mapSamples?: number
    mapBrightness?: number
    baseColor?: [number, number, number]
    markerColor?: [number, number, number]
    glowColor?: [number, number, number]
    markerElevation?: number
    markers?: { location: [number, number]; size: number }[]
    arcs?: unknown[]
    opacity?: number
    onRender?: (state: Record<string, unknown>) => void
  }

  interface Globe {
    update: (opts: Partial<GlobeOptions>) => void
    destroy: () => void
  }

  export default function createGlobe(canvas: HTMLCanvasElement, options: GlobeOptions): Globe
}
