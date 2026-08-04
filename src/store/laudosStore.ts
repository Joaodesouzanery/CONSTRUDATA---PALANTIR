/**
 * laudosStore — Compliance de Laudos (obrigações legais recorrentes do prédio).
 * Multi-tenant por organização, escopo opcional por obra; soft-delete.
 * LOCAL-FIRST: as escritas atualizam o estado local OTIMISTA e enfileiram a op em
 * `pendingSync`; o `flush()` drena a fila (com retry) via a engine compartilhada
 * (storeSync). Assim, offline/erro NÃO perde a criação/edição — o dado fica salvo no
 * aparelho e reenvia sozinho ao reconectar. Tabela: public.predial_laudos.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useActiveObraStore } from '@/store/activeObraStore'
import { flushQueue, mergePull, makeOp, changedColumns, type PendingOp } from '@/lib/storeSync'

const TABLE = 'predial_laudos'

export interface Laudo {
  id: string
  tipo: string
  titulo?: string
  constructionSiteId: string | null
  projectId: string | null
  ultimaExecucao?: string      // yyyy-MM-dd
  validade?: string            // yyyy-MM-dd
  periodicidadeMeses?: number
  responsavel?: string
  documentoPath?: string       // arquivo no bucket `predial-ativos`
  observacoes?: string
  createdAt: string
  updatedAt: string
}

type LaudoRow = {
  id: string
  organization_id: string
  project_id: string | null
  construction_site_id: string | null
  tipo: string
  titulo: string | null
  ultima_execucao: string | null
  validade: string | null
  periodicidade_meses: number | null
  responsavel: string | null
  documento_path: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

function getContext() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? null, userId: user?.id ?? null }
}

function asLaudo(row: LaudoRow): Laudo {
  return {
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo ?? undefined,
    constructionSiteId: row.construction_site_id,
    projectId: row.project_id,
    ultimaExecucao: row.ultima_execucao ?? undefined,
    validade: row.validade ?? undefined,
    periodicidadeMeses: row.periodicidade_meses ?? undefined,
    responsavel: row.responsavel ?? undefined,
    documentoPath: row.documento_path ?? undefined,
    observacoes: row.observacoes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Colunas do banco a partir de um Laudo (campos vazios viram null). */
function toColumns(l: Partial<Laudo>) {
  const s = (v?: string) => (v && v.trim() ? v : null)
  return {
    project_id: l.projectId ?? null,
    construction_site_id: l.constructionSiteId ?? null,
    tipo: l.tipo ?? 'Outro',
    titulo: s(l.titulo),
    ultima_execucao: s(l.ultimaExecucao),
    validade: s(l.validade),
    periodicidade_meses: l.periodicidadeMeses ?? null,
    responsavel: s(l.responsavel),
    documento_path: s(l.documentoPath),
    observacoes: s(l.observacoes),
  }
}

/** Row completo (para o op de insert e para o diff do update). */
function laudoRow(l: Laudo, orgId: string, userId: string): Record<string, unknown> {
  return { id: l.id, organization_id: orgId, ...toColumns(l), created_by: userId }
}

interface LaudosState {
  activeOrgId: string | null
  laudos: Laudo[]
  pendingSync: PendingOp[]
  syncStatus: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'
  syncError: string | null
  lastSyncedAt: string | null
  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
  addLaudo: (payload: Partial<Laudo>) => Promise<string | null>
  updateLaudo: (id: string, patch: Partial<Laudo>) => Promise<boolean>
  deleteLaudo: (id: string) => Promise<void>
}

export const useLaudosStore = create<LaudosState>()(
  persist(
    (set, get) => ({
      activeOrgId: null,
      laudos: [],
      pendingSync: [],
      syncStatus: 'idle',
      syncError: null,
      lastSyncedAt: null,

      ensureTenantScope: (organizationId) => {
        if (!organizationId || get().activeOrgId === organizationId) return
        set({ activeOrgId: organizationId, laudos: [], pendingSync: [], syncStatus: 'idle', syncError: null, lastSyncedAt: null })
      },

      clearData: () => set({ activeOrgId: null, laudos: [], pendingSync: [], syncStatus: 'idle', syncError: null }),

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        set({ syncStatus: 'syncing', syncError: null })
        const res = await flushQueue(queue)
        set((s) => {
          const remaining = s.pendingSync.filter((op) => !res.completed.includes(op.id))
          const offline = typeof navigator !== 'undefined' && !navigator.onLine
          return {
            pendingSync: remaining,
            syncStatus: res.errored.length ? 'error' : offline && remaining.length ? 'offline' : 'idle',
            syncError: res.lastError ?? null,
          }
        })
      },

      pull: async () => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        get().ensureTenantScope(orgId)
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
        // Tenta drenar pendências antes de puxar (reenvia o que ficou de uma sessão offline).
        if (get().pendingSync.length) await get().flush()
        set({ syncStatus: 'syncing', syncError: null })
        // Snapshot das pendências ANTES do fetch: se uma escrita local for enfileirada e drenada
        // enquanto o select (que pode levar até 20s) está em voo, o servidor volta sem a linha nova.
        // Preservar esses ids no merge evita a linha sumir da tela nessa janela (a próxima pull reconcilia).
        const pendingSnapshot = get().pendingSync
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('validade', { ascending: true, nullsFirst: false })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        const server = ((data ?? []) as LaudoRow[]).map(asLaudo)
        set((s) => ({
          // mergePull NÃO apaga registros com op pendente (ainda não confirmados no servidor).
          laudos: mergePull(server, s.laudos, [...s.pendingSync, ...pendingSnapshot], TABLE),
          syncStatus: s.pendingSync.length ? s.syncStatus : 'idle',
          syncError: null,
          lastSyncedAt: new Date().toISOString(),
        }))
      },

      addLaudo: async (payload) => {
        const { orgId, userId } = getContext()
        if (!orgId || !userId) { set({ syncStatus: 'unauth' }); return null }
        get().ensureTenantScope(orgId)
        const id = payload.id ?? crypto.randomUUID()
        const now = new Date().toISOString()
        const item: Laudo = {
          id,
          tipo: payload.tipo ?? 'Outro',
          titulo: payload.titulo,
          // undefined = não informado → default p/ obra ativa; null explícito = Corporativo/Geral (respeita a escolha).
          constructionSiteId: payload.constructionSiteId !== undefined ? payload.constructionSiteId : (useActiveObraStore.getState().activeObraId ?? null),
          projectId: payload.projectId ?? null,
          ultimaExecucao: payload.ultimaExecucao,
          validade: payload.validade,
          periodicidadeMeses: payload.periodicidadeMeses,
          responsavel: payload.responsavel,
          documentoPath: payload.documentoPath,
          observacoes: payload.observacoes,
          createdAt: now,
          updatedAt: now,
        }
        // Otimista: estado local + enfileira o insert. O dado já está salvo no aparelho.
        set((s) => ({
          laudos: [item, ...s.laudos.filter((l) => l.id !== id)],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'laudo', type: 'insert', recordId: id, row: laudoRow(item, orgId, userId), table: TABLE })],
        }))
        void get().flush()
        return id
      },

      updateLaudo: async (id, patch) => {
        const current = get().laudos.find((l) => l.id === id)
        if (!current) return false
        const { orgId, userId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return false }
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const changed = changedColumns(laudoRow(current, orgId, userId ?? ''), laudoRow(next, orgId, userId ?? ''))
        set((s) => ({
          laudos: s.laudos.map((l) => (l.id === id ? next : l)),
          pendingSync: Object.keys(changed).length
            ? [...s.pendingSync, makeOp({ entity: 'laudo', type: 'update', recordId: id, patch: changed, table: TABLE })]
            : s.pendingSync,
        }))
        void get().flush()
        return true
      },

      deleteLaudo: async (id) => {
        // Soft-delete otimista: remove local + enfileira update de deleted_at.
        set((s) => ({
          laudos: s.laudos.filter((l) => l.id !== id),
          pendingSync: [...s.pendingSync, makeOp({ entity: 'laudo', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: TABLE })],
        }))
        void get().flush()
      },
    }),
    {
      name: 'cdata-laudos',
      partialize: (state) => ({
        activeOrgId: state.activeOrgId,
        laudos: state.laudos,
        pendingSync: state.pendingSync,   // a fila sobrevive ao reload (não perde escrita offline)
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
)

// Reenvia a fila ao reconectar (escritas feitas offline sobem sozinhas).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void useLaudosStore.getState().flush() })
}
