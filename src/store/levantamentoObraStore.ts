import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'

export type LevantamentoStatus = 'rascunho' | 'levantamento_concluido' | 'orcamento_pronto' | 'aprovado'
export type TipoServicoLevantamento = 'PISO' | 'PAREDE' | 'TETO' | 'DEMARCAÇÃO DE VAGAS' | 'DEMARCAÇÕES ESPECIAIS'

export interface MedidaLinha {
  id: string
  item: number
  tipoServico: TipoServicoLevantamento | ''
  pavimentoLocal: string
  comprimento: number
  larguraAltura: number
  m2Calculado: number
  metroLinear: number
  quantidade: number
  observacoes: string
}

export interface MaoObraFuncao {
  id: string
  funcao: string
  salarioBruto: number
  vt: number
  va: number
  horasExtrasQtd: number
  horasExtrasValor: number
  custoMensal: number
  dias: number
  obrasSimultaneas: number
  custoDiario: number
  quantidadeObra: number
  diasObra: number
}

export interface OrcamentoLinha {
  id: string
  codigo: string
  descricao: string
  valor: number
  aliquota: number
  impostos: number
  observacoes: string
  tipo: 'faturamento' | 'despesa'
}

export interface RegistroFotoLinha {
  id: string
  pavimentoSuperficie: string
  fotos: { label: string; storagePath?: string; url?: string }[]
  estadoGeral: string
  data: string
  responsavelTecnico: string
  observacoes: string
}

export interface ResumoFinanceiroLevantamento {
  faturamentoTotal: number
  totalImpostos: number
  totalDespesas: number
  saldoLiquido: number
  margemLiquida: number
  custoMoPorM2Piso: number
}

export interface LevantamentoObra {
  id: string
  status: LevantamentoStatus
  obra: string
  contratante: string
  responsavel: string
  dataLevantamento: string
  endereco: string
  cidadeUf: string
  tecnicoResponsavel: string
  numeroOrcamento: string
  tipoServico: string
  sistemaAplicado: string
  produtoPrincipal: string
  prazoEstimadoDias: number
  medidas: MedidaLinha[]
  maoObra: MaoObraFuncao[]
  orcamento: OrcamentoLinha[]
  fotos: RegistroFotoLinha[]
  resumoFinanceiro: ResumoFinanceiroLevantamento | null
  observacoesGerais: string
  assinaturas: { papel: string; nome: string; cargo: string; data: string }[]
  createdAt: string
  updatedAt: string
}

interface LevantamentoState {
  activeOrgId: string | null
  levantamentos: LevantamentoObra[]
  activeId: string | null
  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  syncError: string | null
  lastSyncedAt: string | null
  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  setActiveId: (id: string | null) => void
  addLevantamento: (payload?: Partial<LevantamentoObra>) => string
  upsertLevantamento: (payload: Partial<LevantamentoObra>) => void
  updateLevantamento: (id: string, patch: Partial<LevantamentoObra>) => void
  deleteLevantamento: (id: string) => void
  flush: () => Promise<void>
  pull: () => Promise<void>
}

function emptyLevantamento(payload: Partial<LevantamentoObra> = {}): LevantamentoObra {
  const now = new Date().toISOString()
  return {
    id: payload.id ?? crypto.randomUUID(),
    status: payload.status ?? 'rascunho',
    obra: payload.obra ?? '',
    contratante: payload.contratante ?? '',
    responsavel: payload.responsavel ?? '',
    dataLevantamento: payload.dataLevantamento ?? now.slice(0, 10),
    endereco: payload.endereco ?? '',
    cidadeUf: payload.cidadeUf ?? '',
    tecnicoResponsavel: payload.tecnicoResponsavel ?? '',
    numeroOrcamento: payload.numeroOrcamento ?? '',
    tipoServico: payload.tipoServico ?? '',
    sistemaAplicado: payload.sistemaAplicado ?? '',
    produtoPrincipal: payload.produtoPrincipal ?? '',
    prazoEstimadoDias: payload.prazoEstimadoDias ?? 0,
    medidas: payload.medidas ?? [],
    maoObra: payload.maoObra ?? [],
    orcamento: payload.orcamento ?? [],
    fotos: payload.fotos ?? [],
    resumoFinanceiro: payload.resumoFinanceiro ?? null,
    observacoesGerais: payload.observacoesGerais ?? '',
    assinaturas: payload.assinaturas ?? [
      { papel: 'Tecnico Responsavel', nome: '', cargo: '', data: '' },
      { papel: 'Aprovacao Compizzo', nome: '', cargo: '', data: '' },
    ],
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
  }
}

function rowFor(item: LevantamentoObra, orgId: string, userId: string) {
  return {
    id: item.id,
    organization_id: orgId,
    obra: item.obra || 'Levantamento sem obra',
    contratante: item.contratante || null,
    numero_orcamento: item.numeroOrcamento || null,
    status: item.status,
    payload: item as unknown as Record<string, unknown>,
    created_by: userId,
  }
}

function enqueueUpsert(item: LevantamentoObra) {
  const { profile, user } = useAuth.getState()
  return makeOp({
    entity: 'obra_levantamento',
    type: 'insert',
    recordId: item.id,
    table: 'obra_levantamentos',
    row: rowFor(item, profile?.organization_id ?? 'pending', user?.id ?? 'pending'),
  })
}

export const useLevantamentoObraStore = create<LevantamentoState>()(
  persist(
    (set, get) => ({
      activeOrgId: null,
      levantamentos: [],
      activeId: null,
      pendingSync: [],
      syncStatus: 'idle',
      syncError: null,
      lastSyncedAt: null,

      ensureTenantScope: (organizationId) => {
        if (!organizationId || get().activeOrgId === organizationId) return
        set({
          activeOrgId: organizationId,
          levantamentos: [],
          activeId: null,
          pendingSync: [],
          syncStatus: 'idle',
          syncError: null,
          lastSyncedAt: null,
        })
      },

      clearData: () => set({ activeOrgId: null, levantamentos: [], activeId: null, pendingSync: [], syncError: null }),
      setActiveId: (id) => set({ activeId: id }),

      addLevantamento: (payload = {}) => {
        const item = emptyLevantamento(payload)
        set((s) => ({
          levantamentos: [item, ...s.levantamentos],
          activeId: item.id,
          pendingSync: [...s.pendingSync, enqueueUpsert(item)],
        }))
        void get().flush()
        return item.id
      },

      upsertLevantamento: (payload) => {
        const item = emptyLevantamento(payload)
        set((s) => ({
          levantamentos: [item, ...s.levantamentos.filter((current) => current.id !== item.id)],
          activeId: item.id,
          pendingSync: [...s.pendingSync, enqueueUpsert(item)],
        }))
        void get().flush()
      },

      updateLevantamento: (id, patch) => {
        const updatedAt = new Date().toISOString()
        set((s) => {
          const levantamentos = s.levantamentos.map((item) => item.id === id ? { ...item, ...patch, updatedAt } : item)
          const target = levantamentos.find((item) => item.id === id)
          return {
            levantamentos,
            pendingSync: target
              ? [...s.pendingSync, makeOp({
                entity: 'obra_levantamento',
                type: 'update',
                recordId: id,
                table: 'obra_levantamentos',
                patch: {
                  obra: target.obra || 'Levantamento sem obra',
                  contratante: target.contratante || null,
                  numero_orcamento: target.numeroOrcamento || null,
                  status: target.status,
                  payload: target as unknown as Record<string, unknown>,
                },
              })]
              : s.pendingSync,
          }
        })
        void get().flush()
      },

      deleteLevantamento: (id) => {
        set((s) => ({
          levantamentos: s.levantamentos.filter((item) => item.id !== id),
          activeId: s.activeId === id ? s.levantamentos.find((item) => item.id !== id)?.id ?? null : s.activeId,
          pendingSync: [...s.pendingSync, makeOp({ entity: 'obra_levantamento', type: 'delete', recordId: id, table: 'obra_levantamentos' })],
        }))
        void get().flush()
      },

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        const orgId = useAuth.getState().profile?.organization_id
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        get().ensureTenantScope(orgId)
        set({ syncStatus: 'syncing', syncError: null })
        const result = await flushQueue(queue)
        set((s) => ({
          pendingSync: s.pendingSync
            .filter((op) => !result.completed.includes(op.id))
            .map((op) => result.errored.includes(op.id) ? { ...op, retries: op.retries + 1 } : op),
          syncStatus: result.lastError ? 'error' : 'idle',
          syncError: result.lastError ?? null,
          lastSyncedAt: new Date().toISOString(),
        }))
      },

      pull: async () => {
        const orgId = useAuth.getState().profile?.organization_id
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const pendingTables = new Set(get().pendingSync.map((op) => op.table))
        get().ensureTenantScope(orgId)
        set({ syncStatus: 'syncing' })
        const rows = pendingTables.has('obra_levantamentos') ? null : await pullTable<{ payload: LevantamentoObra }>('obra_levantamentos', { column: 'updated_at', ascending: false })
        if (rows) {
          // só sobrescreve a lista local quando realmente puxou do servidor;
          // se a tabela tem op pendente (rows=null), preserva o estado local não-sincronizado.
          const levantamentos = rows.map((row) => emptyLevantamento(row.payload))
          set({
            levantamentos,
            activeId: levantamentos[0]?.id ?? null,
            syncStatus: 'idle',
            syncError: null,
            lastSyncedAt: new Date().toISOString(),
          })
        } else {
          set({ syncStatus: 'idle', syncError: null, lastSyncedAt: new Date().toISOString() })
        }
      },
    }),
    {
      name: 'cdata-levantamento-obra',
      partialize: (state) => ({
        activeOrgId: state.activeOrgId,
        levantamentos: state.levantamentos,
        activeId: state.activeId,
        pendingSync: state.pendingSync,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useLevantamentoObraStore.getState().flush()
  })
}
