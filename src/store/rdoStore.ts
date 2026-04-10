/**
 * rdoStore.ts — Zustand store for the RDO (Relatório Diário de Obras) module.
 *
 * Sprint 2: migrado para local-first com sync para Supabase.
 *
 * - Persistência localStorage via persist middleware (chave 'cdata-rdo')
 * - Mutações são otimistas + enfileiradas em pendingSync[]
 * - Quando online + autenticado, dispara flush() para o Supabase
 * - DELETE de RDO passa por request_action('delete_rdo', ...) — vira pending_action
 *
 * A API pública (addRdo/updateRdo/removeRdo/financialEntries/etc.) é a mesma
 * da v0 — componentes existentes continuam funcionando sem mudança.
 *
 * Apenas a entidade `rdo` sincroniza com o banco. Financial entries continuam
 * só em memória/localStorage por enquanto (Sprint 3 cria tabela própria).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  RDO, RdoTab, RdoFinancialEntry, RdoTrechoEntry,
} from '@/types'
import {
  MOCK_RDOS,
  MOCK_RDO_FINANCIAL_ENTRIES,
  MOCK_RDO_BUDGET_BRL,
} from '@/data/mockRdo'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { eventBus } from '@/lib/eventBus'

// ─── Mapeamento RDO ↔ Row ────────────────────────────────────────────────────
interface RdoRow {
  id:               string
  organization_id:  string
  number:           number
  date:             string
  responsible:      string | null
  project_id:       string | null
  contract_no:      string | null
  service_order_no: string | null
  payload:          Record<string, unknown>
  closed:           boolean
  created_by:       string
  created_at:       string
  updated_at:       string
  deleted_at:       string | null
}

function rdoToRow(rdo: RDO, orgId: string, userId: string): Omit<RdoRow, 'created_at' | 'updated_at' | 'deleted_at'> {
  // payload contém tudo o que não é campo plano
  const payload = {
    weather:                   rdo.weather,
    manpower:                  rdo.manpower,
    equipment:                 rdo.equipment,
    services:                  rdo.services,
    trechos:                   rdo.trechos,
    photos:                    rdo.photos,
    geolocation:               rdo.geolocation,
    observations:              rdo.observations,
    incidents:                 rdo.incidents,
    logoId:                    rdo.logoId,
    local:                     rdo.local,
    gerenteContrato:           rdo.gerenteContrato,
    tecnicoSeguranca:          rdo.tecnicoSeguranca,
    nomeEmpreiteira:           rdo.nomeEmpreiteira,
    servicoExecutar:           rdo.servicoExecutar,
    ocorrencias:               rdo.ocorrencias,
    funcionariosDiretos:       rdo.funcionariosDiretos,
    funcionariosIndiretos:     rdo.funcionariosIndiretos,
    qtdEquipamentosFerramentas: rdo.qtdEquipamentosFerramentas,
    climaManha:                rdo.climaManha,
    climaTarde:                rdo.climaTarde,
    climaNoite:                rdo.climaNoite,
  }
  return {
    id:               rdo.id,
    organization_id:  orgId,
    number:           rdo.number,
    date:             rdo.date,
    responsible:      rdo.responsible || null,
    project_id:       (rdo as { projectId?: string | null }).projectId ?? null,
    contract_no:      rdo.numeroContrato ?? null,
    service_order_no: rdo.numeroOS ?? null,
    payload,
    closed:           false,
    created_by:       userId,
  }
}

function rowToRdo(row: RdoRow): RDO {
  const p = (row.payload ?? {}) as Record<string, unknown>
  return {
    id:           row.id,
    number:       row.number,
    date:         row.date,
    responsible:  row.responsible ?? '',
    weather:      (p.weather as RDO['weather'])         ?? { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 25 },
    manpower:     (p.manpower as RDO['manpower'])       ?? { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
    equipment:    (p.equipment as RDO['equipment'])     ?? [],
    services:     (p.services  as RDO['services'])      ?? [],
    trechos:      (p.trechos   as RDO['trechos'])       ?? [],
    geolocation:  (p.geolocation as RDO['geolocation']) ?? null,
    observations: (p.observations as string)            ?? '',
    incidents:    (p.incidents as string)               ?? '',
    photos:       (p.photos    as RDO['photos'])        ?? [],
    logoId:       (p.logoId    as string | undefined),
    local:                       p.local                       as string | undefined,
    gerenteContrato:             p.gerenteContrato             as string | undefined,
    tecnicoSeguranca:            p.tecnicoSeguranca            as string | undefined,
    nomeEmpreiteira:             p.nomeEmpreiteira             as string | undefined,
    servicoExecutar:             p.servicoExecutar             as string | undefined,
    ocorrencias:                 p.ocorrencias                 as string | undefined,
    funcionariosDiretos:         p.funcionariosDiretos         as number | undefined,
    funcionariosIndiretos:       p.funcionariosIndiretos       as number | undefined,
    qtdEquipamentosFerramentas:  p.qtdEquipamentosFerramentas  as number | undefined,
    numeroOS:                    row.service_order_no ?? undefined,
    numeroContrato:              row.contract_no      ?? undefined,
    climaManha:                  p.climaManha                  as string | undefined,
    climaTarde:                  p.climaTarde                  as string | undefined,
    climaNoite:                  p.climaNoite                  as string | undefined,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }
}

// ─── State ────────────────────────────────────────────────────────────────────
interface RdoState {
  activeTab:        RdoTab
  rdos:             RDO[]
  financialEntries: RdoFinancialEntry[]
  budgetBRL:        number

  // Sync
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  // Navigation
  setActiveTab: (tab: RdoTab) => void

  // RDO CRUD
  addRdo:    (rdo: Omit<RDO, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateRdo: (id: string, updates: Partial<RDO>) => void
  removeRdo: (id: string) => void

  // Financial (local-only v1)
  addFinancialEntry:    (e: Omit<RdoFinancialEntry, 'id'>) => void
  updateFinancialEntry: (id: string, updates: Partial<Omit<RdoFinancialEntry, 'id'>>) => void
  removeFinancialEntry: (id: string) => void
  setBudget:            (brl: number) => void

  // Cross-module sync
  loadTrechosFromPlanejamento: () => Promise<RdoTrechoEntry[]>
  syncExecutionToPlanejamento: () => void

  // Demo / Clear
  loadDemoData: () => void
  clearData:    () => void

  // Sync
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useRdoStore = create<RdoState>()(
  persist(
    (set, get) => ({
      activeTab:        'dashboard',
      rdos:             [],
      financialEntries: [],
      budgetBRL:        0,

      pendingSync:  [],
      syncStatus:   'idle',
      lastSyncedAt: null,
      syncError:    null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      addRdo: (rdo) => {
        const now = new Date().toISOString()
        const nextNumber = get().rdos.length > 0
          ? Math.max(...get().rdos.map((r) => r.number)) + 1
          : 1
        const newRdo: RDO = {
          ...rdo,
          id:        crypto.randomUUID(),
          number:    nextNumber,
          createdAt: now,
          updatedAt: now,
        }

        // Mapeia para row aqui pra capturar o estado exato no momento da criação
        const { profile, user } = useAuth.getState()
        const orgId  = profile?.organization_id ?? 'pending'
        const userId = user?.id ?? 'pending'
        const row    = rdoToRow(newRdo, orgId, userId)

        set((s) => ({
          rdos: [...s.rdos, newRdo],
          pendingSync: [
            ...s.pendingSync,
            makeOp({ entity: 'rdo', type: 'insert', recordId: newRdo.id, row, table: 'rdo' }),
          ],
        }))
        // Domain event: outros stores podem reagir (planejamentoStore re-pulls trechos)
        eventBus.emit({
          type: 'rdo.closed',
          rdoId: newRdo.id,
          projectId: row.project_id,
          date: newRdo.date,
        })
        setTimeout(() => get().syncExecutionToPlanejamento(), 0)
        void get().flush()
      },

      updateRdo: (id, updates) => {
        set((s) => {
          const updatedRdos = s.rdos.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r,
          )
          // Recalcula o row inteiro com o novo estado para mandar payload completo
          const updated = updatedRdos.find((r) => r.id === id)
          const { profile, user } = useAuth.getState()
          const orgId  = profile?.organization_id ?? 'pending'
          const userId = user?.id ?? 'pending'
          const row    = updated ? rdoToRow(updated, orgId, userId) : undefined
          // Para update, mandamos só o payload + campos planos relevantes (sem id/created_by/org_id)
          const patch: Record<string, unknown> | undefined = row
            ? {
                date:             row.date,
                responsible:      row.responsible,
                contract_no:      row.contract_no,
                service_order_no: row.service_order_no,
                payload:          row.payload,
              }
            : undefined

          return {
            rdos: updatedRdos,
            pendingSync: [
              ...s.pendingSync,
              makeOp({ entity: 'rdo', type: 'update', recordId: id, patch, table: 'rdo' }),
            ],
          }
        })
        setTimeout(() => get().syncExecutionToPlanejamento(), 0)
        void get().flush()
      },

      removeRdo: (id) => {
        set((s) => ({
          rdos: s.rdos.filter((r) => r.id !== id),
          pendingSync: [
            ...s.pendingSync,
            makeOp({
              entity: 'rdo',
              type: 'delete',
              recordId: id,
              table: 'rdo',
              approvalActionType: 'delete_rdo',
            }),
          ],
        }))
        void get().flush()
      },

      addFinancialEntry: (e) =>
        set((s) => ({
          financialEntries: [...s.financialEntries, { ...e, id: crypto.randomUUID() }],
        })),

      updateFinancialEntry: (id, updates) =>
        set((s) => ({
          financialEntries: s.financialEntries.map((fe) =>
            fe.id === id ? { ...fe, ...updates } : fe,
          ),
        })),

      removeFinancialEntry: (id) =>
        set((s) => ({
          financialEntries: s.financialEntries.filter((fe) => fe.id !== id),
        })),

      setBudget: (brl) => set({ budgetBRL: Math.max(0, brl) }),

      loadTrechosFromPlanejamento: () =>
        import('./planejamentoStore')
          .then(({ usePlanejamentoStore }) => {
            type PlanTrecho = { id: string; code: string; description: string; lengthM: number; executedMeters?: number; executionStatus?: string }
            const state = usePlanejamentoStore.getState() as { trechos: PlanTrecho[] }
            const trechos: PlanTrecho[] = state.trechos ?? []
            return trechos.map((t): RdoTrechoEntry => ({
              id:                crypto.randomUUID(),
              trechoCode:        t.code,
              trechoDescription: t.description,
              plannedMeters:     t.lengthM,
              executedMeters:    t.executedMeters ?? 0,
              status:            (t.executionStatus as RdoTrechoEntry['status']) ?? 'not_started',
              source:            'rdo',
            }))
          })
          .catch(() => [] as RdoTrechoEntry[]),

      syncExecutionToPlanejamento: () => {
        const { rdos } = get()
        const execMap = new Map<string, { executedMeters: number; date: string }>()
        const sortedRdos = [...rdos].sort((a, b) => a.date.localeCompare(b.date))
        for (const rdo of sortedRdos) {
          for (const t of rdo.trechos) {
            const prev = execMap.get(t.trechoCode)
            execMap.set(t.trechoCode, {
              executedMeters: Math.max(t.executedMeters, prev?.executedMeters ?? 0),
              date: rdo.date,
            })
          }
        }
        const entries = Array.from(execMap.entries()).map(([code, data]) => ({
          trechoCode: code,
          executedMeters: data.executedMeters,
          date: data.date,
        }))
        if (entries.length === 0) return
        import('./planejamentoStore')
          .then(({ usePlanejamentoStore }) => {
            usePlanejamentoStore.getState().syncExecutionFromRdo(entries)
          })
          .catch(() => {})
      },

      loadDemoData: () =>
        set({
          rdos:             MOCK_RDOS,
          financialEntries: MOCK_RDO_FINANCIAL_ENTRIES,
          budgetBRL:        MOCK_RDO_BUDGET_BRL,
        }),

      clearData: () =>
        set({
          rdos:             [],
          financialEntries: [],
          budgetBRL:        0,
          pendingSync:      [],
          syncError:        null,
        }),

      // ─── Sync ────────────────────────────────────────────────────────────
      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ syncStatus: 'offline' })
          return
        }
        const { profile } = useAuth.getState()
        if (!profile) {
          set({ syncStatus: 'unauth' })
          return
        }

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
        const rows = await pullTable<RdoRow>('rdo', { column: 'number', ascending: false })
        if (!rows) return
        set({
          rdos: rows.map(rowToRdo),
          syncStatus: 'idle',
          lastSyncedAt: new Date().toISOString(),
          syncError: null,
        })
      },
    }),
    {
      name: 'cdata-rdo',
      partialize: (s) => ({
        rdos:             s.rdos,
        financialEntries: s.financialEntries,
        budgetBRL:        s.budgetBRL,
        pendingSync:      s.pendingSync,
        lastSyncedAt:     s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useRdoStore.getState().flush()
  })
}

// ─── EVM helpers (pure, exported for components) ──────────────────────────────

export interface EvmMetrics {
  bac:  number
  ev:   number
  ac:   number
  pv:   number
  cpi:  number
  spi:  number
  cv:   number
  sv:   number
  eac:  number
  etc:  number
  vac:  number
  tcpi: number
}

export function computeEvm(
  bac: number,
  totalPlannedM: number,
  totalExecutedM: number,
  workDaysElapsed: number,
  totalWorkDays: number,
  financialEntries: RdoFinancialEntry[],
): EvmMetrics {
  const ev = totalPlannedM > 0 ? bac * (totalExecutedM / totalPlannedM) : 0
  const pv = totalWorkDays > 0 ? bac * (workDaysElapsed / totalWorkDays) : 0
  const ac = financialEntries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.valueBRL, 0)

  const cpi  = ac  > 0 ? ev / ac  : 0
  const spi  = pv  > 0 ? ev / pv  : 0
  const cv   = ev - ac
  const sv   = ev - pv
  const eac  = cpi > 0 ? bac / cpi : bac
  const etc  = eac - ac
  const vac  = bac - eac
  const denom = bac - ac
  const tcpi = denom !== 0 ? (bac - ev) / denom : 0

  return {
    bac, ev, ac, pv,
    cpi:  Math.round(cpi  * 1000) / 1000,
    spi:  Math.round(spi  * 1000) / 1000,
    cv:   Math.round(cv   * 100)  / 100,
    sv:   Math.round(sv   * 100)  / 100,
    eac:  Math.round(eac  * 100)  / 100,
    etc:  Math.round(etc  * 100)  / 100,
    vac:  Math.round(vac  * 100)  / 100,
    tcpi: Math.round(tcpi * 1000) / 1000,
  }
}

// supabase + RPC export é usado indiretamente via flushQueue/pullTable em storeSync
export { supabase }
