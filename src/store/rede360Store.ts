/**
 * rede360Store.ts — Zustand store for Rede 360 module.
 */
import { create } from 'zustand'
import type { Rede360Tab, NetworkAsset, Rede360ServiceOrder, Outage } from '@/types'
import { MOCK_ASSETS, MOCK_SERVICE_ORDERS, MOCK_OUTAGES } from '@/data/mockRede360'

interface Rede360State {
  activeTab: Rede360Tab
  assets: NetworkAsset[]
  serviceOrders: Rede360ServiceOrder[]
  outages: Outage[]
  selectedAssetId: string | null
  layerVisibility: Record<string, boolean>
  setActiveTab: (tab: Rede360Tab) => void
  setSelectedAssetId: (id: string | null) => void
  addServiceOrder: (order: Omit<Rede360ServiceOrder, 'id' | 'createdAt'>) => void
  updateServiceOrder: (id: string, updates: Partial<Rede360ServiceOrder>) => void
  removeServiceOrder: (id: string) => void
  updateAsset: (id: string, updates: Partial<NetworkAsset>) => void
  setLayerVisibility: (key: string, visible: boolean) => void
  loadDemoData: () => void
}

export const useRede360Store = create<Rede360State>((set) => ({
  activeTab: 'mapa',
  assets: MOCK_ASSETS,
  serviceOrders: MOCK_SERVICE_ORDERS,
  outages: MOCK_OUTAGES,
  selectedAssetId: null,
  layerVisibility: {
    assets: true,
    orders: true,
    outages: true,
    risk: false,
    sewer: true,
    water: true,
    drainage: true,
    civil: true,
    generic: true,
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  addServiceOrder: (order) => set((s) => ({
    serviceOrders: [...s.serviceOrders, { ...order, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
  })),
  updateServiceOrder: (id, updates) => set((s) => ({
    serviceOrders: s.serviceOrders.map((o) => o.id === id ? { ...o, ...updates } : o),
  })),
  removeServiceOrder: (id) => set((s) => ({
    serviceOrders: s.serviceOrders.filter((o) => o.id !== id),
  })),
  updateAsset: (id, updates) => set((s) => ({
    assets: s.assets.map((a) => a.id === id ? { ...a, ...updates } : a),
  })),
  setLayerVisibility: (key, visible) => set((s) => ({
    layerVisibility: { ...s.layerVisibility, [key]: visible },
  })),
  loadDemoData: () => set({ assets: MOCK_ASSETS, serviceOrders: MOCK_SERVICE_ORDERS, outages: MOCK_OUTAGES }),
}))
