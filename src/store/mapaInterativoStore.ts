/**
 * mapaInterativoStore.ts — Zustand store for the Mapa Interativo module.
 * Manages nodes, segments, tools, layers, undo history, and basemap selection.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type { MapNode, MapSegment, MapLayer, MapTool, MapNetworkType } from '@/types'

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

// ─── Snapshot type for undo ────────────────────────────────────────────────

interface MapSnapshot {
  nodes: MapNode[]
  segments: MapSegment[]
}

// ─── Default layers ───────────────────────────────────────────────────────

const DEFAULT_LAYERS: MapLayer[] = [
  { id: 'sewer',   name: 'Esgoto',    color: '#f97316', visible: true },
  { id: 'water',   name: 'Água',      color: '#38bdf8', visible: true },
  { id: 'drainage',name: 'Drenagem',  color: '#4ade80', visible: true },
  { id: 'civil',   name: 'Civil',     color: '#94a3b8', visible: true },
  { id: 'generic', name: 'Genérico',  color: '#a78bfa', visible: true },
]

// ─── Demo data — rede de esgoto simulada em Salvador/BA ──────────────────

function makeDemoData(): { nodes: MapNode[]; segments: MapSegment[] } {
  // Base coords: Porto de Salvador area
  const baseLat = -12.9714
  const baseLng = -38.5014

  const nodes: MapNode[] = [
    { id: 'n01', lat: baseLat + 0.0000, lng: baseLng + 0.0000, label: 'PV-01', nodeType: 'junction' },
    { id: 'n02', lat: baseLat + 0.0012, lng: baseLng + 0.0010, label: 'PV-02', nodeType: 'junction' },
    { id: 'n03', lat: baseLat + 0.0024, lng: baseLng + 0.0020, label: 'PV-03', nodeType: 'junction' },
    { id: 'n04', lat: baseLat + 0.0036, lng: baseLng + 0.0010, label: 'PV-04', nodeType: 'junction' },
    { id: 'n05', lat: baseLat + 0.0048, lng: baseLng + 0.0000, label: 'PV-05', nodeType: 'junction' },
    { id: 'n06', lat: baseLat + 0.0060, lng: baseLng + 0.0015, label: 'PV-06', nodeType: 'junction' },
    { id: 'n07', lat: baseLat + 0.0036, lng: baseLng + 0.0030, label: 'PV-07', nodeType: 'junction' },
    { id: 'n08', lat: baseLat + 0.0012, lng: baseLng - 0.0010, label: 'PV-08', nodeType: 'junction' },
    { id: 'n09', lat: baseLat + 0.0024, lng: baseLng - 0.0020, label: 'PV-09', nodeType: 'junction' },
    { id: 'n10', lat: baseLat + 0.0000, lng: baseLng - 0.0015, label: 'EP-01', nodeType: 'endpoint' },
    { id: 'n11', lat: baseLat + 0.0072, lng: baseLng + 0.0025, label: 'PV-11', nodeType: 'junction' },
    { id: 'n12', lat: baseLat + 0.0060, lng: baseLng - 0.0010, label: 'PV-12', nodeType: 'junction' },
    { id: 'n13', lat: baseLat + 0.0048, lng: baseLng - 0.0020, label: 'PV-13', nodeType: 'junction' },
    { id: 'n14', lat: baseLat + 0.0024, lng: baseLng + 0.0040, label: 'PV-14', nodeType: 'junction' },
    { id: 'n15', lat: baseLat + 0.0048, lng: baseLng + 0.0045, label: 'PV-15', nodeType: 'junction' },
    { id: 'n16', lat: baseLat - 0.0012, lng: baseLng + 0.0010, label: 'PV-16', nodeType: 'junction' },
    { id: 'n17', lat: baseLat - 0.0024, lng: baseLng + 0.0020, label: 'EE-01', nodeType: 'structure', elevation: 5.2 },
    { id: 'n18', lat: baseLat + 0.0084, lng: baseLng + 0.0010, label: 'EP-02', nodeType: 'endpoint' },
    { id: 'n19', lat: baseLat + 0.0036, lng: baseLng - 0.0035, label: 'EP-03', nodeType: 'endpoint' },
    { id: 'n20', lat: baseLat + 0.0000, lng: baseLng + 0.0030, label: 'PV-20', nodeType: 'junction' },
    { id: 'n21', lat: baseLat - 0.0012, lng: baseLng + 0.0040, label: 'PV-21', nodeType: 'junction' },
    { id: 'n22', lat: baseLat + 0.0012, lng: baseLng + 0.0055, label: 'PV-22', nodeType: 'junction' },
    { id: 'n23', lat: baseLat + 0.0024, lng: baseLng - 0.0040, label: 'PV-23', nodeType: 'junction' },
    { id: 'n24', lat: baseLat + 0.0060, lng: baseLng + 0.0055, label: 'PV-24', nodeType: 'junction' },
    { id: 'n25', lat: baseLat + 0.0072, lng: baseLng - 0.0005, label: 'PV-25', nodeType: 'junction' },
    { id: 'n26', lat: baseLat + 0.0084, lng: baseLng + 0.0030, label: 'PV-26', nodeType: 'junction' },
    { id: 'n27', lat: baseLat - 0.0036, lng: baseLng + 0.0010, label: 'EP-04', nodeType: 'endpoint' },
    { id: 'n28', lat: baseLat + 0.0036, lng: baseLng + 0.0060, label: 'PV-28', nodeType: 'junction' },
    { id: 'n29', lat: baseLat + 0.0012, lng: baseLng + 0.0070, label: 'PV-29', nodeType: 'junction' },
    { id: 'n30', lat: baseLat + 0.0048, lng: baseLng + 0.0070, label: 'EP-05', nodeType: 'endpoint' },
    { id: 'n31', lat: baseLat - 0.0012, lng: baseLng - 0.0020, label: 'PV-31', nodeType: 'junction' },
    { id: 'n32', lat: baseLat - 0.0024, lng: baseLng - 0.0030, label: 'EP-06', nodeType: 'endpoint' },
    { id: 'n33', lat: baseLat + 0.0096, lng: baseLng + 0.0020, label: 'EP-07', nodeType: 'endpoint' },
    { id: 'n34', lat: baseLat + 0.0000, lng: baseLng + 0.0055, label: 'PV-34', nodeType: 'junction' },
    { id: 'n35', lat: baseLat + 0.0072, lng: baseLng + 0.0050, label: 'PV-35', nodeType: 'junction' },
    { id: 'n36', lat: baseLat + 0.0084, lng: baseLng + 0.0060, label: 'EP-08', nodeType: 'endpoint' },
    { id: 'n37', lat: baseLat - 0.0012, lng: baseLng + 0.0060, label: 'PV-37', nodeType: 'junction' },
    { id: 'n38', lat: baseLat - 0.0024, lng: baseLng + 0.0050, label: 'EE-02', nodeType: 'structure', elevation: 3.8 },
    { id: 'n39', lat: baseLat + 0.0060, lng: baseLng + 0.0080, label: 'EP-09', nodeType: 'endpoint' },
  ]

  const seg = (
    id: string, from: string, to: string,
    nt: MapNetworkType = 'sewer', diam = 200, mat = 'PVC'
  ): MapSegment => ({ id, fromNodeId: from, toNodeId: to, networkType: nt, diameter: diam, material: mat })

  const segments: MapSegment[] = [
    seg('s01', 'n01', 'n02'),
    seg('s02', 'n02', 'n03'),
    seg('s03', 'n03', 'n04'),
    seg('s04', 'n04', 'n05'),
    seg('s05', 'n05', 'n06'),
    seg('s06', 'n06', 'n11'),
    seg('s07', 'n04', 'n07'),
    seg('s08', 'n07', 'n14'),
    seg('s09', 'n14', 'n15'),
    seg('s10', 'n15', 'n24'),
    seg('s11', 'n01', 'n08'),
    seg('s12', 'n08', 'n09'),
    seg('s13', 'n09', 'n10'),
    seg('s14', 'n09', 'n13'),
    seg('s15', 'n13', 'n19'),
    seg('s16', 'n13', 'n12'),
    seg('s17', 'n12', 'n25'),
    seg('s18', 'n11', 'n18'),
    seg('s19', 'n11', 'n26'),
    seg('s20', 'n26', 'n33'),
    seg('s21', 'n01', 'n16'),
    seg('s22', 'n16', 'n17'),
    seg('s23', 'n17', 'n27'),
    seg('s24', 'n02', 'n20'),
    seg('s25', 'n20', 'n21'),
    seg('s26', 'n20', 'n22'),
    seg('s27', 'n22', 'n29'),
    seg('s28', 'n29', 'n34'),
    seg('s29', 'n29', 'n28'),
    seg('s30', 'n28', 'n35'),
    seg('s31', 'n35', 'n36'),
    seg('s32', 'n24', 'n35'),
    seg('s33', 'n35', 'n39'),
    seg('s34', 'n23', 'n09', 'drainage', 300, 'Concreto'),
    seg('s35', 'n31', 'n10', 'water', 150, 'PEAD'),
    seg('s36', 'n31', 'n32'),
    seg('s37', 'n21', 'n37'),
    seg('s38', 'n37', 'n38'),
  ]

  return { nodes, segments }
}

// ─── State interface ──────────────────────────────────────────────────────

interface MapaInterativoState {
  mapId: string  // identifica o "mapa" — 1 row em mapas_interativos
  nodes: MapNode[]
  segments: MapSegment[]
  activeTool: MapTool
  pendingConnectNodeId: string | null
  layers: MapLayer[]
  history: MapSnapshot[]
  basemap: 'satellite' | 'streets' | 'dark' | 'light' | 'outdoors'
  utmZone: string
  measurePoint1: { lat: number; lng: number } | null
  mapMode: 'saneamento' | 'construcao' | null
  selectedProjectId: string | null
  activeNetworkType: MapNetworkType

  // Sync (Sprint 5)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>

  // Actions
  addNode: (node: Omit<MapNode, 'id'>) => void
  removeNodes: (ids: string[]) => void
  addSegment: (segment: Omit<MapSegment, 'id'>) => void
  removeSegments: (ids: string[]) => void
  updateNode: (id: string, updates: Partial<Omit<MapNode, 'id'>>) => void
  setTool: (tool: MapTool) => void
  setPendingConnectNodeId: (id: string | null) => void
  setMeasurePoint1: (pt: { lat: number; lng: number } | null) => void
  undo: () => void
  clearAll: () => void
  setBasemap: (b: 'satellite' | 'streets' | 'dark' | 'light' | 'outdoors') => void
  setLayerVisible: (layerId: MapNetworkType, visible: boolean) => void
  importNodes: (nodes: MapNode[]) => void
  importSegments: (segments: MapSegment[]) => void
  loadDemoData: () => void
  clearData: () => void
  setMapMode: (mode: 'saneamento' | 'construcao' | null) => void
  setSelectedProjectId: (id: string | null) => void
  setActiveNetworkType: (t: MapNetworkType) => void
}

// ─── Helper: push undo snapshot ───────────────────────────────────────────

function pushHistory(history: MapSnapshot[], nodes: MapNode[], segments: MapSegment[]): MapSnapshot[] {
  const next = [...history, { nodes: [...nodes], segments: [...segments] }]
  return next.length > 20 ? next.slice(next.length - 20) : next
}

// ─── Store ────────────────────────────────────────────────────────────────

const { nodes: demoNodes, segments: demoSegments } = makeDemoData()

// Debounce do enqueue: evita flood de updates ao desenhar muitos nós em sequência.
let mapDebounce: ReturnType<typeof setTimeout> | null = null

export const useMapaInterativoStore = create<MapaInterativoState>()(
  persist(
    (set, get) => {
      const enqueueMapUpdate = () => {
        if (mapDebounce) clearTimeout(mapDebounce)
        mapDebounce = setTimeout(() => {
          const s = get()
          const { orgId, userId } = ctxAuth()
          // upsert via insert (idempotente — cliente garante mesmo id)
          const row = {
            id:              s.mapId,
            organization_id: orgId,
            project_id:      s.selectedProjectId,
            name:            'Mapa principal',
            map_mode:        s.mapMode,
            basemap:         s.basemap,
            payload:         { nodes: s.nodes, segments: s.segments, layers: s.layers },
            created_by:      userId,
          }
          const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
          set((st) => ({ pendingSync: [...st.pendingSync, makeOp({ entity: 'mapa', type: 'update', recordId: s.mapId, patch, table: 'mapas_interativos' })] }))
          void get().flush()
        }, 1000)
      }
      return {
  mapId: crypto.randomUUID(),
  nodes: demoNodes,
  segments: demoSegments,
  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  flush: async () => {
    const queue = get().pendingSync
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
    const { profile } = useAuth.getState()
    if (!profile) { set({ syncStatus: 'unauth' }); return }
    set({ syncStatus: 'syncing', syncError: null })
    const result = await flushQueue(queue)
    set((s) => ({
      pendingSync: s.pendingSync
        .filter((p) => !result.completed.includes(p.id))
        .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
      syncStatus:   result.lastError ? 'error' : 'idle',
      lastSyncedAt: new Date().toISOString(),
      syncError:    result.lastError ?? null,
    }))
  },

  pull: async () => {
    const rows = await pullTable<{ id: string; payload: { nodes: MapNode[]; segments: MapSegment[]; layers?: MapLayer[] } }>('mapas_interativos')
    if (rows && rows.length > 0) {
      const first = rows[0]
      set({
        mapId:    first.id,
        nodes:    first.payload?.nodes ?? [],
        segments: first.payload?.segments ?? [],
        layers:   first.payload?.layers ?? DEFAULT_LAYERS,
      })
    }
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },

  activeTool: 'idle',
  pendingConnectNodeId: null,
  layers: DEFAULT_LAYERS,
  history: [],
  basemap: 'satellite',
  utmZone: '24S',
  measurePoint1: null,
  mapMode: null,
  selectedProjectId: null,
  activeNetworkType: 'sewer',

  addNode: (node) => {
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: [...s.nodes, { ...node, id: crypto.randomUUID() }],
    }))
    enqueueMapUpdate()
  },

  removeNodes: (ids) => {
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: s.nodes.filter((n) => !ids.includes(n.id)),
      segments: s.segments.filter((seg) => !ids.includes(seg.fromNodeId) && !ids.includes(seg.toNodeId)),
    }))
    enqueueMapUpdate()
  },

  addSegment: (segment) => {
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      segments: [...s.segments, { ...segment, id: crypto.randomUUID() }],
    }))
    enqueueMapUpdate()
  },

  removeSegments: (ids) => {
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      segments: s.segments.filter((seg) => !ids.includes(seg.id)),
    }))
    enqueueMapUpdate()
  },

  updateNode: (id, updates) => {
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)) }))
    enqueueMapUpdate()
  },

  setTool: (tool) => set({ activeTool: tool, pendingConnectNodeId: null, measurePoint1: null }),

  setPendingConnectNodeId: (id) => set({ pendingConnectNodeId: id }),

  setMeasurePoint1: (pt) => set({ measurePoint1: pt }),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return {}
      const prev = s.history[s.history.length - 1]
      return {
        nodes: prev.nodes,
        segments: prev.segments,
        history: s.history.slice(0, -1),
      }
    }),

  clearAll: () =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: [],
      segments: [],
    })),

  setBasemap: (b) => set({ basemap: b }),

  setLayerVisible: (layerId, visible) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === layerId ? { ...l, visible } : l)),
    })),

  importNodes: (newNodes) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: [...s.nodes, ...newNodes],
    })),

  importSegments: (newSegments) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      segments: [...s.segments, ...newSegments],
    })),

  loadDemoData: () => {
    const { nodes, segments } = makeDemoData()
    set({ nodes, segments, history: [] })
  },

  clearData: () => set({ nodes: [], segments: [], history: [] }),

  setMapMode: (mode) => {
    const layerUpdates: Partial<MapaInterativoState> = { mapMode: mode }
    if (mode === 'saneamento') {
      layerUpdates.layers = DEFAULT_LAYERS.map((l) =>
        ['sewer', 'water', 'drainage'].includes(l.id)
          ? { ...l, visible: true }
          : { ...l, visible: false }
      )
    } else if (mode === 'construcao') {
      layerUpdates.layers = DEFAULT_LAYERS.map((l) =>
        ['civil', 'generic'].includes(l.id)
          ? { ...l, visible: true }
          : { ...l, visible: false }
      )
    }
    set(layerUpdates)
  },

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  setActiveNetworkType: (t) => set({ activeNetworkType: t }),
      }
    },
    {
      name: 'cdata-mapa-interativo',
      partialize: (s) => ({
        mapId:    s.mapId,
        nodes:    s.nodes,
        segments: s.segments,
        layers:   s.layers,
        basemap:  s.basemap,
        mapMode:  s.mapMode,
        selectedProjectId: s.selectedProjectId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useMapaInterativoStore.getState().flush()
  })
}
