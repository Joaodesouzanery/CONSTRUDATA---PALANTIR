/**
 * manejoFinanceiroStore.ts — Zustand store tenant-synced para as abas
 * "Manejo Financeiro" (contratos/obrigações) e "Manejo Orçamento"
 * (autorizações por categoria) do módulo Financeiro.
 *
 * Segue o padrão local-first do evmStore: fila de pending ops por tenant
 * (makeOp/flushQueue/pullTable de @/lib/storeSync) contra as tabelas
 * financeiro_contratos e financeiro_orcamentos (payload jsonb).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { hojeLocalISO } from '@/lib/utils'
import type { ManejoContrato, ManejoOrcamentoItem } from '@/types'

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

function contratoToRow(c: ManejoContrato, orgId: string, userId: string) {
  return {
    id:              c.id,
    organization_id: orgId,
    payload:         c as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

function orcamentoToRow(o: ManejoOrcamentoItem, orgId: string, userId: string) {
  return {
    id:              o.id,
    organization_id: orgId,
    payload:         o as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

interface ManejoFinanceiroState {
  contratos: ManejoContrato[]
  orcamentos: ManejoOrcamentoItem[]

  // Contratos CRUD
  addContrato: (c: Omit<ManejoContrato, 'id' | 'createdAt'>) => void
  updateContrato: (id: string, patch: Partial<ManejoContrato>) => void
  removeContrato: (id: string) => void
  desobrigarContrato: (id: string) => void

  // Orçamento CRUD
  addOrcamento: (o: Omit<ManejoOrcamentoItem, 'id' | 'createdAt'>) => void
  updateOrcamento: (id: string, patch: Partial<ManejoOrcamentoItem>) => void
  removeOrcamento: (id: string) => void

  // Data management
  loadDemoData: () => void
  clearData: () => void

  // Sync
  activeOrgId:  string | null
  ensureTenantScope: (organizationId: string) => void
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

/* Dados demonstrativos plausíveis de contratos de construção. */
function buildDemoContratos(): ManejoContrato[] {
  const now = new Date().toISOString()
  const mk = (c: Omit<ManejoContrato, 'createdAt'>): ManejoContrato => ({ ...c, createdAt: now })
  return [
    mk({ id: crypto.randomUUID(), titulo: 'Execução de rede coletora — Bacia São Manoel', inicioContrato: '2024-03-11', fimPeriodoExecucao: '2026-09-30', valorTotalObrigado: 4_850_000, valorRestante: 1_980_000, status: 'ativo', sinalizadoPeloModelo: false, motivoSinalizacao: null, anexos: [{ id: crypto.randomUUID(), nome: 'Contrato-assinado.pdf' }, { id: crypto.randomUUID(), nome: 'Cronograma-fisico-financeiro.pdf' }], desobrigadoEm: null }),
    mk({ id: crypto.randomUUID(), titulo: 'Pavimentação e recomposição asfáltica — Lote 2', inicioContrato: '2024-07-02', fimPeriodoExecucao: '2025-12-19', valorTotalObrigado: 1_280_000, valorRestante: 312_500, status: 'ativo', sinalizadoPeloModelo: true, motivoSinalizacao: 'saldo-residual', anexos: [{ id: crypto.randomUUID(), nome: 'Medicao-12.pdf' }], desobrigadoEm: null }),
    mk({ id: crypto.randomUUID(), titulo: 'Estação elevatória de esgoto EE-04 — obra civil', inicioContrato: '2024-01-15', fimPeriodoExecucao: '2025-08-29', valorTotalObrigado: 2_310_000, valorRestante: 486_200, status: 'ativo', sinalizadoPeloModelo: true, motivoSinalizacao: 'periodo-encerrado', anexos: [{ id: crypto.randomUUID(), nome: 'ART-execucao.pdf' }, { id: crypto.randomUUID(), nome: 'Aditivo-01.pdf' }], desobrigadoEm: null }),
    mk({ id: crypto.randomUUID(), titulo: 'Locação de grua torre — 12 meses', inicioContrato: '2025-02-03', fimPeriodoExecucao: '2026-02-03', valorTotalObrigado: 720_000, valorRestante: 240_000, status: 'ativo', sinalizadoPeloModelo: false, motivoSinalizacao: null, anexos: [], desobrigadoEm: null }),
    mk({ id: crypto.randomUUID(), titulo: 'Fornecimento de tubos PEAD DN 200 — Pantanal Baixo', inicioContrato: '2024-05-20', fimPeriodoExecucao: '2025-05-20', valorTotalObrigado: 965_000, valorRestante: 58_900, status: 'ativo', sinalizadoPeloModelo: true, motivoSinalizacao: 'sem-movimentacao', anexos: [{ id: crypto.randomUUID(), nome: 'NF-recebimento-parcial.pdf' }], desobrigadoEm: null }),
    mk({ id: crypto.randomUUID(), titulo: 'Sondagem e contenção — Morro do Tetéu', inicioContrato: '2023-09-04', fimPeriodoExecucao: '2024-11-28', valorTotalObrigado: 1_540_000, valorRestante: 0, status: 'desobrigado', sinalizadoPeloModelo: false, motivoSinalizacao: null, anexos: [{ id: crypto.randomUUID(), nome: 'Termo-encerramento.pdf' }], desobrigadoEm: '2024-12-15' }),
    mk({ id: crypto.randomUUID(), titulo: 'Urbanização e drenagem — Vila dos Criadores', inicioContrato: '2023-04-10', fimPeriodoExecucao: '2024-08-30', valorTotalObrigado: 3_120_000, valorRestante: 145_300, status: 'desobrigado', sinalizadoPeloModelo: false, motivoSinalizacao: null, anexos: [], desobrigadoEm: '2025-01-22' }),
    mk({ id: crypto.randomUUID(), titulo: 'Ligações intradomiciliares — Vila Israel', inicioContrato: '2024-10-01', fimPeriodoExecucao: null, valorTotalObrigado: 1_870_000, valorRestante: 1_410_000, status: 'ativo', sinalizadoPeloModelo: false, motivoSinalizacao: null, anexos: [{ id: crypto.randomUUID(), nome: 'Ordem-de-servico.pdf' }], desobrigadoEm: null }),
  ]
}

/* Autorizações demonstrativas por categoria. */
function buildDemoOrcamentos(): ManejoOrcamentoItem[] {
  const now = new Date().toISOString()
  const mk = (o: Omit<ManejoOrcamentoItem, 'createdAt'>): ManejoOrcamentoItem => ({ ...o, createdAt: now })
  const fundo1 = crypto.randomUUID()
  const fundo2 = crypto.randomUUID()
  const ie1 = crypto.randomUUID()
  const eo1 = crypto.randomUUID()
  const eo2 = crypto.randomUUID()
  const eo3 = crypto.randomUUID()
  return [
    mk({ id: fundo1, categoria: 'fundo', codigo: 'FD-2026-001', descricao: 'Recursos contrato saneamento — Bacia São Manoel', valorTotal: 6_036_000, valorAlocado: 5_410_000, vinculos: [] }),
    mk({ id: fundo2, categoria: 'fundo', codigo: 'FD-2026-002', descricao: 'Recursos próprios — obras de edificação', valorTotal: 870_000, valorAlocado: 655_000, vinculos: [] }),
    mk({ id: crypto.randomUUID(), categoria: 'fundo', codigo: 'FD-2026-003', descricao: 'Convênio infraestrutura urbana', valorTotal: 408_000, valorAlocado: 380_000, vinculos: [] }),
    mk({ id: ie1, categoria: 'interesse-especial', codigo: 'IE-2026-001', descricao: 'Condicionantes ambientais e monitoramento', valorTotal: 602_500, valorAlocado: 569_000, vinculos: [fundo1] }),
    mk({ id: eo1, categoria: 'elemento-orcamento', codigo: 'EO-2026-001', descricao: 'Mão de obra direta — frentes de rede', valorTotal: 2_600_000, valorAlocado: 2_600_000, vinculos: [fundo1] }),
    mk({ id: eo2, categoria: 'elemento-orcamento', codigo: 'EO-2026-002', descricao: 'Materiais hidráulicos e conexões', valorTotal: 1_880_000, valorAlocado: 1_544_000, vinculos: [fundo1] }),
    mk({ id: eo3, categoria: 'elemento-orcamento', codigo: 'EO-2026-003', descricao: 'Equipamentos e locações', valorTotal: 930_000, valorAlocado: 778_000, vinculos: [fundo2] }),
    mk({ id: crypto.randomUUID(), categoria: 'elemento-orcamento', codigo: 'EO-2026-004', descricao: 'Serviços topográficos e sondagem', valorTotal: 240_000, valorAlocado: 195_500, vinculos: [fundo2] }),
    mk({ id: crypto.randomUUID(), categoria: 'autorizacao-custo', codigo: 'AC-2026-001', descricao: 'Reparo emergencial — coletor tronco', valorTotal: 500_000, valorAlocado: 400_000, vinculos: [eo1, ie1] }),
    mk({ id: crypto.randomUUID(), categoria: 'autorizacao-custo', codigo: 'AC-2026-002', descricao: 'Recomposição de pavimento — Lote 2', valorTotal: 320_000, valorAlocado: 320_000, vinculos: [eo2] }),
    mk({ id: crypto.randomUUID(), categoria: 'autorizacao-custo', codigo: 'AC-2026-003', descricao: 'Mobilização de canteiro avançado', valorTotal: 180_000, valorAlocado: 96_000, vinculos: [eo3] }),
    mk({ id: crypto.randomUUID(), categoria: 'interesse-especial', codigo: 'IE-2026-002', descricao: 'Programa de segurança do trabalho', valorTotal: 350_000, valorAlocado: 312_000, vinculos: [fundo2] }),
  ]
}

export const useManejoFinanceiroStore = create<ManejoFinanceiroState>()(
  persist(
    (set, get) => ({
      contratos: [],
      orcamentos: [],

      // ── Contratos CRUD ───────────────────────────────────────────────

      addContrato: (c) => {
        const id = crypto.randomUUID()
        const novo: ManejoContrato = { ...c, id, createdAt: new Date().toISOString() }
        const { orgId, userId } = ctxAuth()
        set((s) => ({
          contratos: [novo, ...s.contratos],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'manejo_contrato', type: 'insert', recordId: id, row: contratoToRow(novo, orgId, userId), table: 'financeiro_contratos' })],
        }))
        void get().flush()
      },

      updateContrato: (id, patch) => {
        set((s) => ({ contratos: s.contratos.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
        const target = get().contratos.find((c) => c.id === id)
        if (target) {
          set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'manejo_contrato', type: 'update', recordId: id, patch: { payload: target as unknown as Record<string, unknown> }, table: 'financeiro_contratos' })] }))
          void get().flush()
        }
      },

      removeContrato: (id) => {
        set((s) => ({
          contratos: s.contratos.filter((c) => c.id !== id),
          // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`: aquilo
          // só CRIA UM PEDIDO em `pending_actions` e não apaga nada. O contrato voltava no pull
          // seguinte e com ele o valor empenhado, bagunçando o saldo do manejo — sem que ninguém
          // fosse avisado. Como não existe um segundo aprovador na conta única do cliente, o pedido
          // nunca era aprovado. A RLS aceita o soft delete direto (`fin_contratos_update_role`).
          pendingSync: [...s.pendingSync, makeOp({ entity: 'manejo_contrato', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'financeiro_contratos' })],
        }))
        void get().flush()
      },

      desobrigarContrato: (id) => {
        // Data de calendário, não timestamp: `toISOString()` desobrigaria no dia seguinte
        // quando a ação fosse feita à noite.
        get().updateContrato(id, { status: 'desobrigado', desobrigadoEm: hojeLocalISO() })
      },

      // ── Orçamento CRUD ───────────────────────────────────────────────

      addOrcamento: (o) => {
        const id = crypto.randomUUID()
        const novo: ManejoOrcamentoItem = { ...o, id, createdAt: new Date().toISOString() }
        const { orgId, userId } = ctxAuth()
        set((s) => ({
          orcamentos: [...s.orcamentos, novo],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'manejo_orcamento', type: 'insert', recordId: id, row: orcamentoToRow(novo, orgId, userId), table: 'financeiro_orcamentos' })],
        }))
        void get().flush()
      },

      updateOrcamento: (id, patch) => {
        set((s) => ({ orcamentos: s.orcamentos.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
        const target = get().orcamentos.find((o) => o.id === id)
        if (target) {
          set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'manejo_orcamento', type: 'update', recordId: id, patch: { payload: target as unknown as Record<string, unknown> }, table: 'financeiro_orcamentos' })] }))
          void get().flush()
        }
      },

      removeOrcamento: (id) => {
        set((s) => ({
          orcamentos: s.orcamentos.filter((o) => o.id !== id),
          // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`: aquilo
          // só CRIA UM PEDIDO em `pending_actions` e não apaga nada. Pior aqui do que nas outras
          // tabelas: os vínculos dos itens vizinhos já tinham sido limpos logo abaixo, então o item
          // voltava no pull seguinte órfão, valendo de novo no total alocado e sem os vínculos que
          // o justificavam. A RLS aceita o soft delete direto (`fin_orcamentos_update_role`).
          pendingSync: [...s.pendingSync, makeOp({ entity: 'manejo_orcamento', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'financeiro_orcamentos' })],
        }))
        // Remove o id excluído dos vínculos dos demais itens.
        const afetados = get().orcamentos.filter((o) => o.vinculos.includes(id))
        for (const o of afetados) {
          get().updateOrcamento(o.id, { vinculos: o.vinculos.filter((v) => v !== id) })
        }
        void get().flush()
      },

      // ── Data management ──────────────────────────────────────────────

      loadDemoData: () => {
        set({ contratos: buildDemoContratos(), orcamentos: buildDemoOrcamentos() })
      },

      clearData: () => set({ contratos: [], orcamentos: [], pendingSync: [], syncError: null }),

      // ── Sync ─────────────────────────────────────────────────────────

      activeOrgId: null,

      ensureTenantScope: (organizationId) => {
        const current = get().activeOrgId
        if (current === organizationId) return
        set({
          activeOrgId: organizationId,
          ...(current === null ? {} : { contratos: [], orcamentos: [], pendingSync: [] }),
        })
      },

      pendingSync: [],
      syncStatus: 'idle',
      lastSyncedAt: null,
      syncError: null,

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
            .map((p) => (result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p)),
          syncStatus:   result.lastError ? 'error' : 'idle',
          lastSyncedAt: new Date().toISOString(),
          syncError:    result.lastError ?? null,
        }))
      },

      pull: async () => {
        const cs = await pullTable<{ payload: ManejoContrato }>('financeiro_contratos')
        const os = await pullTable<{ payload: ManejoOrcamentoItem }>('financeiro_orcamentos')
        set((s) => ({ contratos: mergePull(cs?.map((r) => r.payload) ?? null, s.contratos, s.pendingSync, 'financeiro_contratos') }))
        set((s) => ({ orcamentos: mergePull(os?.map((r) => r.payload) ?? null, s.orcamentos, s.pendingSync, 'financeiro_orcamentos') }))
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      },
    }),
    {
      name: 'cdata-manejo-financeiro',
      partialize: (s) => ({
        contratos:    s.contratos,
        orcamentos:   s.orcamentos,
        activeOrgId:  s.activeOrgId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useManejoFinanceiroStore.getState().flush()
  })
}
