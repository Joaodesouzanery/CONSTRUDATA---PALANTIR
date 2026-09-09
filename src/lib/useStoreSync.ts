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

const TTL_DO_PULL_MS = 30_000

export function sincronizouHaPouco(lastSyncedAt: string | null | undefined, agora = Date.now()): boolean {
  if (!lastSyncedAt) return false
  const t = new Date(lastSyncedAt).getTime()
  return Number.isFinite(t) && agora - t < TTL_DO_PULL_MS
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
      // ⚠️ O carimbo do TTL É LIDO AQUI, ANTES DO FLUSH — e a ordem é o conserto.
      // `flush()` grava `lastSyncedAt` sempre que a fila NÃO está vazia, mesmo tendo apenas
      // EMPURRADO, sem ler nada do servidor. Lendo depois, o TTL enxergava "sincronizou agora"
      // e pulava o pull; com uma op PRESA (papel sem permissão para aquela tabela, o caso que o
      // próprio auth.ts descreve) a tela parava de receber o que os colegas gravavam pelo resto
      // da sessão — o efeito só re-dispara em [orgId, useStore].
      const carimboAntesDoFlush = useStore.getState().lastSyncedAt
      // flush primeiro: sobe o que é local-only (re-carimbando org pendente)
      try { await st.flush?.() } catch { /* mantém na fila; será re-tentado */ }
      if (cancelled) return
      // pull SEMPRE, mesmo com fila pendente: quem protege o dado local não sincronizado
      // é o `mergePull` de storeSync (mantém os registros com op pendente e atualiza o
      // resto). Esperar a fila esvaziar — a política antiga — fazia UMA op presa congelar
      // o pull daquela tabela para sempre, e o painel envelhecia em silêncio.
      const after = useStore.getState()
      // ⚠️ TTL: o boot já puxou tudo (`syncAllTenantStores`); cada componente que monta puxava a
      // tabela inteira DE NOVO — dois painéis do mesmo store na mesma tela = dois pulls de 9
      // tabelas. Sincronizado há menos de 30 s = já está fresco. O realtime continua avisando
      // mudanças de colegas por fora, e o `flush` acima sempre roda.
      if (sincronizouHaPouco(carimboAntesDoFlush)) return
      try { await after.pull?.() } catch { /* preserva local em caso de erro */ }
    })()
    return () => { cancelled = true }
  }, [orgId, useStore])

  return { orgId, syncStatus, syncError, pending, lastSyncedAt: lastSyncedAt ?? null, demo: isDemoModeEnabled() }
}
