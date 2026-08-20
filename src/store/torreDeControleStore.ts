/**
 * torreDeControleStore.ts — Sprint 6: migrado para Supabase via storeSync.
 * Tabela: construction_sites. Risks ficam no payload (subarray).
 * Excluir obra é soft delete (`deleted_at`) — ver `deleteSite`.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { changedColumns, flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { MOCK_OBRAS } from '@/data/mockTorreDeControle'
import { predialDemoSite } from '@/data/mockPredial'
import type { ConstructionSite, ConstructionRisk } from '@/types'

interface EditingRisk {
  siteId: string
  riskId: string | 'new'
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function siteToRow(s: ConstructionSite, orgId: string, userId: string) {
  return {
    id:              s.id,
    organization_id: orgId,
    // Coluna FK sempre null: o trigger enforce_projects_torre_gestao_tenant rejeita a obra
    // quando project_id aponta para um projeto ausente/de outra org. O projectId real
    // fica preservado no payload (que é o que o app lê no pull), então nada se perde.
    project_id:      null,
    code:            (s as { code?: string }).code ?? null,
    name:            s.name ?? null,
    status:          (s as { status?: string }).status ?? null,
    city:            (s as { city?: string }).city ?? null,
    state:           (s as { state?: string }).state ?? null,
    lat:             (s as { lat?: number }).lat ?? null,
    lng:             (s as { lng?: number }).lng ?? null,
    // '' → null: colunas date/uuid rejeitam string vazia no Postgres.
    start_date:      (s as { startDate?: string }).startDate || null,
    expected_end:    (s as { expectedEnd?: string }).expectedEnd || null,
    // Coluna REAL para o lookup da RPC anônima do QR público (o app lê do payload; a RPC, da coluna).
    public_slug:     (s as { publicSlug?: string }).publicSlug || null,
    payload:         s as unknown as Record<string, unknown>,  // inclui risks[]
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

/** Slug curto url-safe (8 chars) para o QR público — aleatório via crypto. */
function genPublicSlug(len = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

interface TorreState {
  activeOrgId: string | null
  sites: ConstructionSite[]
  selectedId: string | null
  editingId: string | null
  editingRisk: EditingRisk | null

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
}

interface TorreActions {
  ensureTenantScope: (organizationId: string) => void
  addSite: (payload: Omit<ConstructionSite, 'id'>) => void
  updateSite: (id: string, patch: Partial<Omit<ConstructionSite, 'id'>>) => void
  /** Garante um slug do QR público para o prédio (gera na 1ª vez); devolve o slug. */
  ensurePublicSlug: (id: string) => string | null
  deleteSite: (id: string) => void
  resyncSites: () => void
  updateLocation: (id: string, lat: number, lng: number) => void
  selectSite: (id: string | null) => void
  setEditing: (id: string | null) => void
  setEditingRisk: (args: EditingRisk | null) => void
  addRisk: (siteId: string, risk: Omit<ConstructionRisk, 'id'>) => void
  updateRisk: (siteId: string, riskId: string, patch: Partial<Omit<ConstructionRisk, 'id'>>) => void
  deleteRisk: (siteId: string, riskId: string) => void
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useTorreStore = create<TorreState & TorreActions>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const enqueueUpdateOf = (siteId: string) => {
        const target = get().sites.find((s) => s.id === siteId)
        if (!target) return
        const { orgId, userId } = ctxAuth()
        const row = siteToRow(target, orgId, userId)
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
        enqueue(makeOp({ entity: 'site', type: 'update', recordId: siteId, patch, table: 'construction_sites' }))
        void get().flush()
      }
      return {
        activeOrgId: null,
        sites: [],
        selectedId: null,
        editingId: null,
        editingRisk: null,
        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        ensureTenantScope: (organizationId) => {
          if (!organizationId || get().activeOrgId === organizationId) return
          // Preserva pendingSync: obras criadas e ainda não sincronizadas não podem
          // ser descartadas na troca de empresa (o flush do login sobe antes do pull).
          set({
            activeOrgId: organizationId,
            sites: [],
            selectedId: null,
            editingId: null,
            editingRisk: null,
            syncStatus: 'idle',
            syncError: null,
          })
        },

        addSite: (payload) => {
          const id = crypto.randomUUID()
          const newSite = { ...payload, id } as ConstructionSite
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            sites: [...s.sites, newSite],
            selectedId: id,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'site', type: 'insert', recordId: id, row: siteToRow(newSite, orgId, userId), table: 'construction_sites' })],
          }))
          void get().flush()
        },

        updateSite: (id, patch) => {
          const prev = get().sites.find((s) => s.id === id)
          set((s) => ({ sites: s.sites.map((site) => (site.id === id ? { ...site, ...patch } : site)) }))
          const target = get().sites.find((s) => s.id === id)
          if (target && prev) {
            const { orgId, userId } = ctxAuth()
            // patch de campo: só as colunas que mudaram (anti-clobber concorrente)
            const changed = changedColumns(siteToRow(prev, orgId, userId), siteToRow(target, orgId, userId))
            if (Object.keys(changed).length > 0) {
              enqueue(makeOp({ entity: 'site', type: 'update', recordId: id, patch: changed, table: 'construction_sites' }))
              void get().flush()
            }
          }
        },

        ensurePublicSlug: (id) => {
          const site = get().sites.find((s) => s.id === id)
          if (!site) return null
          if (site.publicSlug) return site.publicSlug
          const slug = genPublicSlug()
          get().updateSite(id, { publicSlug: slug } as Partial<Omit<ConstructionSite, 'id'>>)
          return slug
        },

        deleteSite: (id) => {
          set((s) => {
            const remaining = s.sites.filter((site) => site.id !== id)
            return {
              sites: remaining,
              selectedId: remaining[0]?.id ?? null,
              editingId: null,
              // Era `type: 'delete'` com `approvalActionType: 'delete_construction_site'`, que chama
              // o RPC `request_action`: aquilo só CRIA UM PEDIDO em `pending_actions`, não apaga a
              // obra. A op saía da fila como concluída e a obra voltava no pull seguinte — arrastando
              // atrás dela tudo que aponta pra ela (RDOs, medições, restrições, chamados do Predial
              // pelo `site_id`), e a obra "excluída" reaparecia no mapa da Torre. Como a empresa usa
              // uma conta só, não existia um segundo aprovador para destravar o pedido.
              // O soft delete aqui é exatamente o que `approve_pending_action` faria
              // (0034_sprint6_rpcs.sql: `UPDATE construction_sites SET deleted_at = now()`),
              // e a RLS aceita direto por `sites_update_role`.
              pendingSync: [...s.pendingSync, makeOp({ entity: 'site', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'construction_sites' })],
            }
          })
          void get().flush()
        },

        updateLocation: (id, lat, lng) => {
          set((s) => ({ sites: s.sites.map((site) => (site.id === id ? { ...site, lat, lng } : site)) }))
          enqueueUpdateOf(id)
        },

        selectSite: (id) => set({ selectedId: id }),
        setEditing: (id) => set({ editingId: id }),
        setEditingRisk: (args) => set({ editingRisk: args }),

        addRisk: (siteId, risk) => {
          set((s) => ({
            sites: s.sites.map((site) =>
              site.id === siteId
                ? { ...site, risks: [...site.risks, { ...risk, id: crypto.randomUUID() }] }
                : site
            ),
          }))
          enqueueUpdateOf(siteId)
        },

        updateRisk: (siteId, riskId, patch) => {
          set((s) => ({
            sites: s.sites.map((site) =>
              site.id === siteId
                ? { ...site, risks: site.risks.map((r) => (r.id === riskId ? { ...r, ...patch } : r)) }
                : site
            ),
          }))
          enqueueUpdateOf(siteId)
        },

        deleteRisk: (siteId, riskId) => {
          set((s) => ({
            sites: s.sites.map((site) =>
              site.id === siteId
                ? { ...site, risks: site.risks.filter((r) => r.id !== riskId) }
                : site
            ),
          }))
          enqueueUpdateOf(siteId)
        },

        // Reempurra TODAS as obras locais como upsert (onConflict id) carimbando a org
        // ativa atual — cura obras que nunca subiram ao Supabase ou foram carimbadas
        // com a org errada. Basta rodar logado na empresa correta.
        resyncSites: () => {
          const { orgId, userId } = ctxAuth()
          if (orgId === 'pending') return
          const ops = get().sites.map((site) => makeOp({ entity: 'site', type: 'insert', recordId: site.id, row: siteToRow(site, orgId, userId), table: 'construction_sites' }))
          if (ops.length === 0) return
          // Descarta ops antigas de construction_sites (possivelmente malformadas/travadas)
          // e reenfileira upserts limpos das obras atuais.
          set((s) => ({ pendingSync: [...s.pendingSync.filter((op) => op.table !== 'construction_sites'), ...ops] }))
          void get().flush()
        },

        loadDemoData: () => { const sites = [...MOCK_OBRAS, predialDemoSite()]; set({ sites, selectedId: sites[0]?.id ?? null }) },
        clearData: () => set({ activeOrgId: null, sites: [], selectedId: null, pendingSync: [], syncError: null }),

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
          const { profile } = useAuth.getState()
          if (!profile) {
            set({ syncStatus: 'unauth' })
            return
          }
          get().ensureTenantScope(profile.organization_id)
          // Mescla com o servidor preservando as obras com op pendente (ainda não
          // sincronizadas) — em vez de congelar a tabela inteira quando há QUALQUER op.
          const rows = await pullTable<{ payload: ConstructionSite }>('construction_sites')
          set((s) => {
            const sites = mergePull(rows?.map((r) => r.payload) ?? null, s.sites, s.pendingSync, 'construction_sites')
            return rows ? { sites, selectedId: sites[0]?.id ?? null } : { sites }
          })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-torre-controle',
      partialize: (s) => ({
        activeOrgId: s.activeOrgId,
        sites:        s.sites,
        selectedId:   s.selectedId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useTorreStore.getState().flush()
  })

  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('measurement.draft_created', () => {
      void useTorreStore.getState().pull()
    })
    eventBus.on('measurement.blocked', () => {
      void useTorreStore.getState().pull()
    })
    eventBus.on('measurement.approved', () => {
      void useTorreStore.getState().pull()
    })
    eventBus.on('realtime.row_changed', (event) => {
      if (
        event.table === 'construction_sites'
        || event.table === 'projects'
        || event.table === 'measurement_sources'
        || event.table === 'measurement_memory_lines'
        || event.table === 'plan_trechos'
        || event.table === 'lps_restrictions'
      ) {
        void useTorreStore.getState().pull()
      }
    })
  })
}
