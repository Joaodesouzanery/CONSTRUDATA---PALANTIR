/**
 * bimStore.ts — Zustand store for the BIM 3D/4D/5D module.
 * Manages loaded pipe-network project, segment selection, color modes,
 * 4D timeline scrubbing, and layer visibility.
 */
import { create } from 'zustand'
import type { BimProject, BimSegment, BimLayer, BimColorMode, BimTab } from '@/types'
import { MOCK_BIM_PROJECT } from '@/data/mockBim'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLength(vertices: [number, number, number][]): number {
  let len = 0
  for (let i = 1; i < vertices.length; i++) {
    const dx = vertices[i][0] - vertices[i - 1][0]
    const dy = vertices[i][1] - vertices[i - 1][1]
    const dz = vertices[i][2] - vertices[i - 1][2]
    len += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return Math.round(len * 10) / 10
}

function avgDepth(vertices: [number, number, number][]): number {
  if (vertices.length === 0) return 0
  const sum = vertices.reduce((acc, v) => acc + Math.abs(v[2]), 0)
  return Math.round((sum / vertices.length) * 100) / 100
}

// ─── Shapefile parsing ────────────────────────────────────────────────────────

async function parseShapefileToSegments(
  shp: ArrayBuffer,
  dbf: ArrayBuffer,
): Promise<BimSegment[]> {
  // Lazy import shpjs to avoid loading in main bundle
  const shpjs = await import('shpjs')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geometries: any[] = (shpjs as any).parseShp(shp)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributes: Record<string, string | number>[] = (shpjs as any).dbf.parseDbf(dbf)

  return geometries.map((geom, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coords: any[] = geom.coordinates ?? []
    const vertices: [number, number, number][] = coords.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0],
    )
    const attrs = attributes[i] ?? {}
    const diameter = Number(attrs['DIAMETER'] ?? attrs['DN'] ?? 200)
    const material = String(attrs['MATERIAL'] ?? 'PVC')
    const unitCost = 85
    const length = calcLength(vertices)

    return {
      id: crypto.randomUUID(),
      vertices,
      attributes: attrs,
      trechoCode: String(attrs['TRECHO'] ?? ''),
      lengthM: length,
      avgDepthM: avgDepth(vertices),
      diameter,
      material,
      unitCostBRL: unitCost,
      totalCostBRL: Math.round(length * unitCost),
      constructionDate: String(attrs['DATE'] ?? attrs['DATA'] ?? ''),
      phase: String(attrs['PHASE'] ?? attrs['FASE'] ?? ''),
    }
  })
}

// ─── Default timeline dates ───────────────────────────────────────────────────

function dateRangeFromSegments(segments: BimSegment[]): { start: string; end: string } {
  const dates = segments
    .map((s) => s.constructionDate)
    .filter((d): d is string => !!d && d.length === 10)
    .sort()
  return {
    start: dates[0] ?? '2025-01-01',
    end: dates[dates.length - 1] ?? '2025-12-31',
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

interface BimState {
  activeTab: BimTab
  project: BimProject | null
  selectedSegmentId: string | null
  colorMode: BimColorMode
  timelineDateRange: { start: string; end: string }
  activeDate: string
  layers: BimLayer[]
  isLoading: boolean
  loadError: string | null

  setActiveTab(tab: BimTab): void
  loadShapefile(shp: ArrayBuffer, dbf: ArrayBuffer): Promise<void>
  selectSegment(id: string | null): void
  setColorMode(mode: BimColorMode): void
  setActiveDate(date: string): void
  toggleLayer(id: string): void
  loadDemoData(): void
  clearData(): void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBimStore = create<BimState>((set, get) => ({
  activeTab: 'viewer',
  project: null,
  selectedSegmentId: null,
  colorMode: 'default',
  timelineDateRange: { start: '2025-01-01', end: '2025-12-31' },
  activeDate: '2025-06-01',
  layers: [],
  isLoading: false,
  loadError: null,

  setActiveTab(tab) {
    set({ activeTab: tab })
  },

  async loadShapefile(shp, dbf) {
    set({ isLoading: true, loadError: null })
    try {
      const segments = await parseShapefileToSegments(shp, dbf)
      const range = dateRangeFromSegments(segments)
      const project: BimProject = {
        id: crypto.randomUUID(),
        name: 'Shapefile importado',
        segments,
        layers: get().layers,
        uploadedAt: new Date().toISOString(),
        shapefileSourceName: 'importado.shp',
      }
      set({
        project,
        layers: MOCK_BIM_PROJECT.layers, // reuse layer definitions
        timelineDateRange: range,
        activeDate: range.start,
        selectedSegmentId: null,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false, loadError: String(err) })
    }
  },

  selectSegment(id) {
    set({ selectedSegmentId: id })
  },

  setColorMode(mode) {
    set({ colorMode: mode })
  },

  setActiveDate(date) {
    set({ activeDate: date })
  },

  toggleLayer(id) {
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    }))
  },

  loadDemoData() {
    const range = dateRangeFromSegments(MOCK_BIM_PROJECT.segments)
    set({
      project: MOCK_BIM_PROJECT,
      layers: MOCK_BIM_PROJECT.layers.map((l) => ({ ...l, visible: true })),
      timelineDateRange: range,
      activeDate: '2025-05-01',
      selectedSegmentId: null,
      colorMode: 'default',
      activeTab: 'viewer',
      isLoading: false,
      loadError: null,
    })
  },

  clearData() {
    set({
      project: null,
      layers: [],
      selectedSegmentId: null,
      colorMode: 'default',
      timelineDateRange: { start: '2025-01-01', end: '2025-12-31' },
      activeDate: '2025-06-01',
      isLoading: false,
      loadError: null,
      activeTab: 'viewer',
    })
  },
}))
