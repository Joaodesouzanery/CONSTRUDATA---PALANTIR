/**
 * rede360Store.ts — Sprint 5: migrado para Supabase via storeSync.
 *
 * Tabelas:
 *   rede_ativos       — polimórfica via asset_type (network|circuit|device|...)
 *   rede_service_orders
 *   rede_outages      — local-only por enquanto (sem CRUD ainda no store)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  Rede360Tab, GridAssetTab, NetworkAsset, Rede360ServiceOrder, Outage,
  CircuitAsset, DeviceAsset, NWSWeatherStation, CustomerRecord,
  StructureAsset, VegetationPoint, HardeningPoint,
} from '@/types'
import {
  MOCK_ASSETS, MOCK_SERVICE_ORDERS, MOCK_OUTAGES,
  MOCK_CIRCUIT_ASSETS, MOCK_DEVICE_ASSETS, MOCK_WEATHER_STATIONS,
  MOCK_CUSTOMERS, MOCK_STRUCTURE_ASSETS, MOCK_VEGETATION_POINTS, MOCK_HARDENING_POINTS,
} from '@/data/mockRede360'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function networkAssetToRow(a: NetworkAsset, orgId: string, userId: string) {
  return {
    id:              a.id,
    organization_id: orgId,
    project_id:      null,
    asset_type:      'network',
    code:            (a as { code?: string }).code ?? null,
    name:            a.name ?? null,
    lat:             (a as { lat?: number }).lat ?? null,
    lng:             (a as { lng?: number }).lng ?? null,
    network_type:    (a as { networkType?: string }).networkType ?? null,
    status:          a.status ?? null,
    risk_level:      (a as { riskLevel?: string }).riskLevel ?? null,
    payload:         a as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function serviceOrderToRow(o: Rede360ServiceOrder, orgId: string, userId: string) {
  return {
    id:              o.id,
    organization_id: orgId,
    asset_id:        o.assetId ?? null,
    code:            o.code,
    status:          o.status,
    priority:        o.priority,
    scheduled_date:  o.scheduledDate ?? null,
    payload:         o as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface Rede360State {
  activeTab: Rede360Tab
  assets: NetworkAsset[]
  serviceOrders: Rede360ServiceOrder[]
  outages: Outage[]
  selectedAssetId: string | null
  selectedCircuitId: string | null
  circuitAssets: CircuitAsset[]
  deviceAssets: DeviceAsset[]
  weatherStations: NWSWeatherStation[]
  customers: CustomerRecord[]
  structureAssets: StructureAsset[]
  vegetationPoints: VegetationPoint[]
  hardeningPoints: HardeningPoint[]
  layerVisibility: Record<string, boolean>
  activeGridTab: GridAssetTab
  bottomPanelOpen: boolean
  searchQuery: string

  // Sync (Sprint 5)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  setActiveTab: (tab: Rede360Tab) => void
  setSelectedAssetId: (id: string | null) => void
  setSelectedCircuitId: (id: string | null) => void
  setActiveGridTab: (tab: GridAssetTab) => void
  setBottomPanelOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
  addServiceOrder: (order: Omit<Rede360ServiceOrder, 'id' | 'createdAt'>) => void
  updateServiceOrder: (id: string, updates: Partial<Rede360ServiceOrder>) => void
  removeServiceOrder: (id: string) => void
  updateAsset: (id: string, updates: Partial<NetworkAsset>) => void
  setLayerVisibility: (key: string, visible: boolean) => void
  loadDemoData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useRede360Store = create<Rede360State>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      return {
        activeTab: 'home',
        assets: [],
        serviceOrders: [],
        outages: [],
        selectedAssetId: null,
        selectedCircuitId: null,
        circuitAssets: [],
        deviceAssets: [],
        weatherStations: [],
        customers: [],
        structureAssets: [],
        vegetationPoints: [],
        hardeningPoints: [],
        layerVisibility: {
          assets: true, orders: true, outages: true, risk: false,
          sewer: true, water: true, drainage: true, civil: true, generic: true,
          circuits: true, riskLayers: false, serviceDistricts: false, landCover: false,
        },
        activeGridTab: 'circuit',
        bottomPanelOpen: true,
        searchQuery: '',

        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        setActiveTab: (tab) => set({ activeTab: tab }),
        setSelectedAssetId: (id) => set({ selectedAssetId: id, selectedCircuitId: null }),
        setSelectedCircuitId: (id) => set({ selectedCircuitId: id, selectedAssetId: null }),
        setActiveGridTab: (tab) => set({ activeGridTab: tab }),
        setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
        setSearchQuery: (q) => set({ searchQuery: q }),

        addServiceOrder: (order) => {
          const newOrder: Rede360ServiceOrder = { ...order, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            serviceOrders: [...s.serviceOrders, newOrder],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'rede_so', type: 'insert', recordId: newOrder.id, row: serviceOrderToRow(newOrder, orgId, userId), table: 'rede_service_orders' })],
          }))
          void get().flush()
        },

        updateServiceOrder: (id, updates) => {
          set((s) => ({ serviceOrders: s.serviceOrders.map((o) => o.id === id ? { ...o, ...updates } : o) }))
          const target = get().serviceOrders.find((o) => o.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = serviceOrderToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'rede_so', type: 'update', recordId: id, patch, table: 'rede_service_orders' }))
            void get().flush()
          }
        },

        removeServiceOrder: (id) => {
          set((s) => ({
            serviceOrders: s.serviceOrders.filter((o) => o.id !== id),
            pendingSync: [...s.pendingSync, makeOp({ entity: 'rede_so', type: 'delete', recordId: id, table: 'rede_service_orders', approvalActionType: 'delete_rede_service_order' })],
          }))
          void get().flush()
        },

        updateAsset: (id, updates) => {
          set((s) => ({ assets: s.assets.map((a) => a.id === id ? { ...a, ...updates } : a) }))
          const target = get().assets.find((a) => a.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = networkAssetToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'rede_ativo', type: 'update', recordId: id, patch, table: 'rede_ativos' }))
            void get().flush()
          }
        },

        setLayerVisibility: (key, visible) => set((s) => ({
          layerVisibility: { ...s.layerVisibility, [key]: visible },
        })),

        loadDemoData: () => set({
          assets: MOCK_ASSETS,
          serviceOrders: MOCK_SERVICE_ORDERS,
          outages: MOCK_OUTAGES,
          circuitAssets: MOCK_CIRCUIT_ASSETS,
          deviceAssets: MOCK_DEVICE_ASSETS,
          weatherStations: MOCK_WEATHER_STATIONS,
          customers: MOCK_CUSTOMERS,
          structureAssets: MOCK_STRUCTURE_ASSETS,
          vegetationPoints: MOCK_VEGETATION_POINTS,
          hardeningPoints: MOCK_HARDENING_POINTS,
        }),

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
          const ativos = await pullTable<{ asset_type: string; payload: NetworkAsset }>('rede_ativos')
          const sos    = await pullTable<{ payload: Rede360ServiceOrder }>('rede_service_orders')
          if (ativos) {
            // Por enquanto remapeia só os de asset_type='network' para o array assets[].
            const networkOnes = ativos.filter((r) => r.asset_type === 'network').map((r) => r.payload)
            set({ assets: networkOnes })
          }
          if (sos) set({ serviceOrders: sos.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-rede-360',
      partialize: (s) => ({
        assets:           s.assets,
        serviceOrders:    s.serviceOrders,
        outages:          s.outages,
        circuitAssets:    s.circuitAssets,
        deviceAssets:     s.deviceAssets,
        weatherStations:  s.weatherStations,
        customers:        s.customers,
        structureAssets:  s.structureAssets,
        vegetationPoints: s.vegetationPoints,
        hardeningPoints:  s.hardeningPoints,
        pendingSync:      s.pendingSync,
        lastSyncedAt:     s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useRede360Store.getState().flush()
  })
}
