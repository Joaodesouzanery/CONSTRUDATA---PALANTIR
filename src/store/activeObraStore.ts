/**
 * activeObraStore.ts — "obra ativa" global (análogo à empresa ativa).
 *
 * Propaga a obra selecionada para todos os módulos. `activeObraId === null`
 * significa "Todas as obras" (sem filtro). Ao trocar de empresa, a obra ativa é
 * zerada via ensureTenantScope (registrado no fan-out de auth.ts), evitando
 * obra órfã de outra organização.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ActiveObraState {
  activeObraId: string | null  // null = "Todas as obras"
  activeOrgId: string | null
  setActiveObra: (siteId: string | null) => void
  ensureTenantScope: (organizationId: string) => void
}

export const useActiveObraStore = create<ActiveObraState>()(
  persist(
    (set, get) => ({
      activeObraId: null,
      activeOrgId: null,
      setActiveObra: (siteId) => set({ activeObraId: siteId || null }),
      ensureTenantScope: (organizationId) => {
        if (!organizationId) return
        if (get().activeOrgId === organizationId) return
        // Troca de empresa → zera a obra ativa (não vaza obra entre empresas).
        set({ activeObraId: null, activeOrgId: organizationId })
      },
    }),
    {
      name: 'cdata-active-obra',
      partialize: (s) => ({ activeObraId: s.activeObraId, activeOrgId: s.activeOrgId }),
    },
  ),
)
