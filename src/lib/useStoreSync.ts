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

// Após este nº de tentativas falhas, uma op é considerada "presa" e deixa de
// bloquear o pull do módulo (evita que 1 erro congele a sincronização inteira).
const STUCK_RETRIES = 5

export interface SyncableState {
  activeOrgId?: string | null
  pendingSync?: unknown[]
  syncStatus?: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error' | string
  syncError?: string | null
  lastSyncedAt?: string | null
  ensureTenantScope?: (organizationId: string) => void
  clearData?: () => void
  flush?: () => Promise<void> | void
  pull?: () => Promise<void> | void
}

export interface StoreSyncInfo {
  orgId: string | null
  syncStatus: SyncableState['syncStatus']
  syncError: string | null
  pending: number
  lastSyncedAt: string | null
  demo: boolean
}

export function useStoreSync<T extends SyncableState>(useStore: UseBoundStore<StoreApi<T>>): StoreSyncInfo {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const syncStatus = useStore((s) => s.syncStatus)
  const syncError = useStore((s) => s.syncError ?? null)
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
      // pull normalmente só quando a fila esvaziou — assim nunca sobrescrevemos
      // dado local que ainda não chegou ao servidor.
      // Resiliência: se TODAS as ops pendentes já estão "presas" (muitas
      // tentativas falhas — ex.: erro de RLS/permissão, tabela ausente), libera
      // o pull mesmo assim, para 1 op envenenada não congelar o módulo inteiro.
      // O pull por-tabela do store preserva as tabelas que ainda têm op pendente.
      const after = useStore.getState()
      const pend = after.pendingSync ?? []
      const allStuck = pend.length > 0 && pend.every((op) => (((op as { retries?: number }).retries) ?? 0) >= STUCK_RETRIES)
      if (pend.length === 0 || allStuck) {
        try { await after.pull?.() } catch { /* preserva local em caso de erro */ }
      }
    })()
    return () => { cancelled = true }
  }, [orgId, useStore])

  return { orgId, syncStatus, syncError, pending, lastSyncedAt: lastSyncedAt ?? null, demo: isDemoModeEnabled() }
}
