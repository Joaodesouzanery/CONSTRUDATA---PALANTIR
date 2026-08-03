/**
 * laudosStore — Compliance de Laudos (obrigações legais recorrentes do prédio).
 * Multi-tenant por organização, escopo opcional por obra; soft-delete. Espelha as
 * convenções do manutencoesStore (Supabase direto, ensureTenantScope, pull, upsert/update).
 * Tabela: public.predial_laudos.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useActiveObraStore } from '@/store/activeObraStore'

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

interface LaudosState {
  activeOrgId: string | null
  laudos: Laudo[]
  syncStatus: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'
  syncError: string | null
  lastSyncedAt: string | null
  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
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
      syncStatus: 'idle',
      syncError: null,
      lastSyncedAt: null,

      ensureTenantScope: (organizationId) => {
        if (!organizationId || get().activeOrgId === organizationId) return
        set({ activeOrgId: organizationId, laudos: [], syncStatus: 'idle', syncError: null, lastSyncedAt: null })
      },

      clearData: () => set({ activeOrgId: null, laudos: [], syncStatus: 'idle', syncError: null }),

      pull: async () => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        get().ensureTenantScope(orgId)
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
        set({ syncStatus: 'syncing', syncError: null })
        const { data, error } = await supabase
          .from('predial_laudos')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('validade', { ascending: true, nullsFirst: false })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set({
          laudos: ((data ?? []) as LaudoRow[]).map(asLaudo),
          syncStatus: 'idle',
          syncError: null,
          lastSyncedAt: new Date().toISOString(),
        })
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
        const row = { id, organization_id: orgId, ...toColumns(item), created_by: userId }
        const { error } = await supabase.from('predial_laudos').upsert(row as never, { onConflict: 'id' })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return null }
        set((s) => ({ laudos: [item, ...s.laudos.filter((l) => l.id !== id)] }))
        return id
      },

      updateLaudo: async (id, patch) => {
        const current = get().laudos.find((l) => l.id === id)
        if (!current) return false
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return false }
        const { error } = await supabase
          .from('predial_laudos')
          .update(toColumns(next) as never)
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return false }
        set((s) => ({ laudos: s.laudos.map((l) => (l.id === id ? next : l)) }))
        return true
      },

      deleteLaudo: async (id) => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const { error } = await supabase
          .from('predial_laudos')
          .update({ deleted_at: new Date().toISOString() } as never)
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({ laudos: s.laudos.filter((l) => l.id !== id) }))
      },
    }),
    {
      name: 'cdata-laudos',
      partialize: (state) => ({
        activeOrgId: state.activeOrgId,
        laudos: state.laudos,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
)
