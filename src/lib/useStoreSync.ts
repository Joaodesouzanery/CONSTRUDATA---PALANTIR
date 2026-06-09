/**
 * useStoreSync — bootstrap de sincronização para um store tenant-scoped.
 *
 * Ao montar o módulo (e quando a organização ativa muda), executa:
 *   1) ensureTenantScope(orgId)  → carimba o store na organização ativa,
 *      limpando dados de outra organização (sem misturar empresas).
 *   2) flush()                   → empurra ops locais ainda não sincronizadas
 *      (inclui recuperação de ops criadas antes do perfil carregar).
 *   3) pull()                    → SÓ se a fila esvaziou, recarrega do servidor.
 *      Isso evita sobrescrever/perder dados locais que ainda não subiram.
 *
 * Retorna o estado de sync para alimentar o <SyncBadge>.
 */
import { useEffect } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { useAuth } from './auth'
import { isDemoModeEnabled } from './runtimeMode'
import { getTenantMarker } from './tenantCache'

export interface SyncableState {
  activeOrgId?: string | null
  pendingSync?: unknown[]
  syncStatus?: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error' | string
  lastSyncedAt?: string | null
  ensureTenantScope?: (organizationId: string) => void
  clearData?: () => void
  flush?: () => Promise<void> | void
  pull?: () => Promise<void> | void
}

export interface StoreSyncInfo {
  orgId: string | null
  syncStatus: SyncableState['syncStatus']
  pending: number
  lastSyncedAt: string | null
  demo: boolean
}

export function useStoreSync<T extends SyncableState>(useStore: UseBoundStore<StoreApi<T>>): StoreSyncInfo {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const syncStatus = useStore((s) => s.syncStatus)
  const pending = useStore((s) => s.pendingSync?.length ?? 0)
  const lastSyncedAt = useStore((s) => s.lastSyncedAt ?? null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    void (async () => {
      const st = useStore.getState()
      if (st.ensureTenantScope) {
        st.ensureTenantScope(orgId)
      } else {
        // Sem ensureTenantScope: guarda central anti-mistura. Se o marcador de
        // tenant aponta para outra organização, limpa o local antes de sincronizar
        // (evita empurrar dados de uma empresa para outra).
        const marker = getTenantMarker()
        if (marker && marker !== orgId) st.clearData?.()
      }
      // flush primeiro: sobe o que é local-only (re-carimbando org pendente)
      try { await st.flush?.() } catch { /* mantém na fila; será re-tentado */ }
      if (cancelled) return
      // pull só quando não há nada pendente — assim nunca sobrescrevemos dado
      // local que ainda não chegou ao servidor.
      const after = useStore.getState()
      if ((after.pendingSync?.length ?? 0) === 0) {
        try { await after.pull?.() } catch { /* preserva local em caso de erro */ }
      }
    })()
    return () => { cancelled = true }
  }, [orgId, useStore])

  return { orgId, syncStatus, pending, lastSyncedAt: lastSyncedAt ?? null, demo: isDemoModeEnabled() }
}
