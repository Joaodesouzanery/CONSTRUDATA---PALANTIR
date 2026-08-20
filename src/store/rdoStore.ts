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
import { canWriteRdo } from '@/lib/roles'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { createSafeJSONStorage } from '@/lib/safeStorage'
import { attachBlobSync } from '@/lib/blobSync'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { uploadRdoPhoto, leanPhotosForPersist } from '@/features/rdo/utils/rdoPhotoStorage'
import { parseLocaleNumber } from '@/lib/numberFormat'

// Sincroniza as entradas financeiras do RDO (local-only) via app_state.
let pullRdoFinBlob: (() => Promise<void>) | null = null
let retryingPhotos = false   // reentrância do retryPhotoUploads
import { getTenantMarker } from '@/lib/tenantCache'
import { eventBus } from '@/lib/eventBus'
import { useActiveObraStore } from '@/store/activeObraStore'
import { buildOperationalKey } from '@/lib/operationalKey'

/**
 * RDO finalizado alimenta os módulos (planejamento, financeiro, medição, LPS,
 * estoque). Rascunho NÃO alimenta — permite salvar o avanço e continuar depois.
 * Ausência de `status` = finalizado (RDOs regulares antigos).
 */
export function isRdoFinalized(rdo: Pick<RDO, 'status'>): boolean {
  return rdo.status !== 'rascunho'
}

// ─── Mapeamento RDO ↔ Row ────────────────────────────────────────────────────
interface RdoRow {
  id:               string
  organization_id:  string
  number:           number
  date:             string
  responsible:      string | null
  project_id:       string | null
  site_id:          string | null
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
    title:                     rdo.title,
    manpower:                  rdo.manpower,
    equipment:                 rdo.equipment,
    services:                  rdo.services.map((service) => ({
      ...service,
      code: service.contractItemCode,
      codigo: service.contractItemCode,
      descricao: service.description,
      quantidade: service.quantity,
      unidade: service.unit,
    })),
    materials:                 rdo.materials ?? [],
    trechos:                   rdo.trechos,
    status:                    rdo.status,
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
    localTipo:                 rdo.localTipo,
    epiUtilizado:              rdo.epiUtilizado,
    qualityChecklist:          rdo.qualityChecklist,
    stoppages:                 rdo.stoppages,
    activityHours:             rdo.activityHours,
    workforceRows:             rdo.workforceRows,
    template:                  rdo.template,
    compizzo:                  rdo.compizzo,
    siteId:                    rdo.siteId,
  }
  return {
    id:               rdo.id,
    organization_id:  orgId,
    number:           rdo.number,
    date:             rdo.date,
    responsible:      rdo.responsible || null,
    project_id:       (rdo as { projectId?: string | null }).projectId ?? null,
    site_id:          rdo.siteId ?? null,
    contract_no:      rdo.numeroContrato ?? null,
    service_order_no: rdo.numeroOS ?? null,
    payload,
    closed:           true,
    created_by:       userId,
  }
}

function rowToRdo(row: RdoRow): RDO {
  const p = (row.payload ?? {}) as Record<string, unknown>
  return {
    id:           row.id,
    number:       row.number,
    title:        (p.title as string | undefined),
    date:         row.date,
    responsible:  row.responsible ?? '',
    weather:      (p.weather as RDO['weather'])         ?? { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 25 },
    manpower:     (p.manpower as RDO['manpower'])       ?? { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
    equipment:    (p.equipment as RDO['equipment'])     ?? [],
    services:     ((p.services as RDO['services']) ?? []).map((service) => ({
      ...service,
      contractItemCode: service.contractItemCode ?? (service as unknown as { code?: string; codigo?: string }).code ?? (service as unknown as { codigo?: string }).codigo,
    })),
    materials:    (p.materials as RDO['materials'])      ?? [],
    trechos:      (p.trechos   as RDO['trechos'])       ?? [],
    status:       p.status as RDO['status'],
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
    localTipo:                   p.localTipo                   as string | undefined,
    epiUtilizado:                p.epiUtilizado                as boolean | undefined,
    qualityChecklist:            p.qualityChecklist            as RDO['qualityChecklist'],
    stoppages:                   p.stoppages                   as RDO['stoppages'],
    activityHours:               p.activityHours               as RDO['activityHours'],
    workforceRows:               p.workforceRows               as RDO['workforceRows'],
    template:                    p.template                    as RDO['template'],
    compizzo:                    p.compizzo                    as RDO['compizzo'],
    siteId:                      row.site_id ?? (p.siteId as string | null) ?? null,
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

  // Edição (qual RDO está aberto para editar no painel; ex.: RDO Compizzo)
  editingRdoId: string | null
  setEditingRdoId: (id: string | null) => void

  // Tenant scope (isolamento por organização)
  activeOrgId: string | null
  ensureTenantScope: (organizationId: string) => void

  // RDO CRUD
  addRdo:    (rdo: Omit<RDO, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => string
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
  /** Reenvia fotos capturadas offline (base64 sem storagePath) para o Storage. */
  retryPhotoUploads: () => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Ponte RDO → Apontamentos de Mão de Obra.
 *
 * ─── O DEFEITO QUE ISTO FECHA ─────────────────────────────────────────────────────────────────
 * Esta sincronização só era chamada de UM lugar: o botão "Salvar" do painel Compizzo. Consequência
 * medida: editar um RDO finalizado pelo Histórico refazia o Financeiro e o Planejamento, mas NÃO
 * refazia os apontamentos — a Mão de Obra ficava congelada no estado do último save feito por
 * aquele painel. E despromover para rascunho não removia apontamento nenhum, então o custo
 * continuava lançado num RDO que não alimenta mais nada.
 *
 * Agora ela mora aqui, ao lado da ponte do Financeiro, e roda nos dois caminhos — criar e editar.
 * Como o id do apontamento é derivado de (rdo, trabalhador), rodar de novo é upsert da mesma
 * linha, nunca duplicata.
 */
function sincronizarApontamentos(rdo: RDO) {
  void import('./maoDeObraStore').then(({ useMaoDeObraStore }) => {
    const mo = useMaoDeObraStore.getState()
    // Rascunho não alimenta nada — e se ERA finalizado e voltou a rascunho, o que já tinha sido
    // lançado precisa sair.
    if (!isRdoFinalized(rdo)) { mo.removeRdoTimecards(rdo.id); return }

    // RDO padrão: horas por linha de mão de obra. Compizzo: total do dia dividido pelo efetivo.
    const entradas = (rdo.workforceRows ?? []).flatMap((linha) =>
      (linha.workerIds ?? []).map((workerId) => ({
        workerId,
        horas: Number(linha.hoursWorked) || 0,
        descricao: linha.activityDescription || linha.role || undefined,
      })),
    ).filter((e) => e.horas > 0)

    const nomes = rdo.manpower.employeeNames ?? []
    if (entradas.length === 0 && nomes.length === 0) { mo.removeRdoTimecards(rdo.id); return }

    mo.syncRdoToTimecards({
      id: rdo.id,
      date: rdo.date,
      siteId: rdo.siteId ?? null,
      employeeNames: nomes,
      totalHoras: rdo.compizzo?.horasTrabalhadas ?? 0,
      activityLabel: rdo.title || rdo.local || 'RDO',
      entradas: entradas.length ? entradas : undefined,
    })
  })
}

export const useRdoStore = create<RdoState>()(
  persist(
    (set, get) => ({
      activeTab:        'dashboard',
      rdos:             [],
      financialEntries: [],
      budgetBRL:        0,
      editingRdoId:     null,
      activeOrgId:      null,

      pendingSync:  [],
      syncStatus:   'idle',
      lastSyncedAt: null,
      syncError:    null,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setEditingRdoId: (id) => set({ editingRdoId: id }),

      ensureTenantScope: (organizationId) => {
        if (!organizationId) return
        const cur = get().activeOrgId
        if (cur === organizationId) return
        if (cur == null) {
          const marker = getTenantMarker()
          if (marker && marker !== organizationId) get().clearData()
          set({ activeOrgId: organizationId })
          return
        }
        get().clearData()
        set({ activeOrgId: organizationId })
      },

      addRdo: (rdo) => {
        // Gate espelha a policy rdo_insert_with_role: papéis fora da lista não passam no
        // WITH CHECK do servidor — sem o gate, a criação viraria op presa no pendingSync.
        if (!canWriteRdo(useAuth.getState().profile?.role)) return ''
        const now = new Date().toISOString()
        const nextNumber = get().rdos.length > 0
          ? Math.max(...get().rdos.map((r) => r.number)) + 1
          : 1
        const newRdo: RDO = {
          ...rdo,
          id:        crypto.randomUUID(),
          number:    nextNumber,
          siteId:    rdo.siteId ?? useActiveObraStore.getState().activeObraId ?? null,
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
        // Domain events só p/ RDO FINALIZADO — rascunho não avisa outros módulos
        // (medição/LPS/suprimentos reagem a `rdo.finalized`). O estoque (trigger
        // de servidor) já é gated em payload.status='finalizado'.
        if (isRdoFinalized(newRdo)) {
          eventBus.emit({
            type: 'rdo.closed',
            rdoId: newRdo.id,
            projectId: row.project_id,
            date: newRdo.date,
          })
          eventBus.emit({
            type: 'rdo.finalized',
            rdoId: newRdo.id,
            projectId: row.project_id,
            date: newRdo.date,
            operationalKey: buildOperationalKey({
              contractNo: newRdo.numeroContrato ?? row.contract_no,
              projectId: row.project_id,
              nucleo: newRdo.localTipo,
              local: newRdo.local,
              serviceCode: newRdo.servicoExecutar ?? newRdo.services?.[0]?.contractItemCode,
              nPreco: newRdo.services?.[0]?.contractItemCode,
              period: newRdo.date.slice(0, 7),
            }),
          })
        }
        // Sempre reconcilia o planejamento (a função já filtra finalizados).
        setTimeout(() => get().syncExecutionToPlanejamento(), 0)
        // Ponte RDO → Financeiro (custos): posta se finalizado, reconcilia se rascunho.
        setTimeout(() => { void import('./financeiroStore').then(({ useFinanceiroStore }) => useFinanceiroStore.getState().syncRdoToFinanceiro(newRdo)) }, 0)
        setTimeout(() => sincronizarApontamentos(newRdo), 0)
        void get().flush()
        return newRdo.id
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
                site_id:          row.site_id,   // trocar/limpar a obra no edit tem que persistir
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
        // Editar um RDO FINALIZADO avisa os outros módulos (suprimentos, medição,
        // planejamento, LPS). Se virou/está rascunho, NÃO avisa — e o reconcile do
        // planejamento abaixo remove o que esse RDO havia lançado.
        const upd = get().rdos.find((r) => r.id === id)
        if (upd && isRdoFinalized(upd)) {
          eventBus.emit({ type: 'rdo.closed', rdoId: id, projectId: upd.siteId ?? null, date: upd.date })
          eventBus.emit({ type: 'rdo.finalized', rdoId: id, projectId: upd.siteId ?? null, date: upd.date })
        }
        setTimeout(() => get().syncExecutionToPlanejamento(), 0)
        // Ponte RDO → Financeiro: re-posta se finalizado, remove se virou rascunho.
        if (upd) setTimeout(() => { void import('./financeiroStore').then(({ useFinanceiroStore }) => useFinanceiroStore.getState().syncRdoToFinanceiro(upd)) }, 0)
        // Ponte RDO → Mão de Obra: refaz se finalizado, remove se virou rascunho. FALTAVA — era
        // a única das quatro pontes que não rodava na edição.
        if (upd) setTimeout(() => sincronizarApontamentos(upd), 0)
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
        // Excluir um RDO precisa reverter o executado que ele havia lançado no Planejamento.
        setTimeout(() => get().syncExecutionToPlanejamento(), 0)
        // NÃO remove os lançamentos do Financeiro aqui: a exclusão passa por APROVAÇÃO
        // (pending_action delete_rdo). Se negada, o RDO volta no pull — e os custos
        // precisam continuar lá. A limpeza acontece no pull (reconcile abaixo), quando o
        // RDO some de verdade do servidor.
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
        // Só RDOs FINALIZADOS contribuem. Rascunho conta zero → e a lógica de
        // "reconcilia sempre" abaixo zera contribuições que sumiram (rascunho,
        // re-link ou exclusão), sem dupla contagem.
        const rdos = get().rdos.filter(isRdoFinalized)
        type ExecData = { quantity: number; date: string; progressPct: number; status: string }
        const execMap = new Map<string, { executedMeters: number; date: string }>()
        // Global (comportamento legado) + por obra (evita contaminação entre obras que compartilham operationalKey).
        const globalMap = new Map<string, ExecData>()
        const perObra = new Map<string, Map<string, ExecData>>()
        const accumulate = (map: Map<string, ExecData>, key: string, service: RDO['services'][number], date: string) => {
          const prev = map.get(key)
          const quantity = (prev?.quantity ?? 0) + (Number(service.quantity) || 0)
          const progressPct = Math.max(prev?.progressPct ?? 0, Number(service.accumulatedProgressPct) || Number(service.dailyProgressPct) || 0)
          const status = service.qualityStatus === 'approved'
            ? 'completed'
            : quantity > 0 || progressPct > 0 ? 'in_progress' : 'not_started'
          map.set(key, { quantity, date, progressPct, status })
        }
        const sortedRdos = [...rdos].sort((a, b) => a.date.localeCompare(b.date))
        for (const rdo of sortedRdos) {
          for (const t of rdo.trechos) {
            const prev = execMap.get(t.trechoCode)
            execMap.set(t.trechoCode, {
              executedMeters: Math.max(t.executedMeters, prev?.executedMeters ?? 0),
              date: rdo.date,
            })
          }
          for (const service of rdo.services ?? []) {
            const key = service.planningActivityId || service.operationalKey
            if (!key) continue
            accumulate(globalMap, key, service, rdo.date)
            const siteId = rdo.siteId ?? null
            if (siteId) {
              let m = perObra.get(siteId)
              if (!m) { m = new Map(); perObra.set(siteId, m) }
              accumulate(m, key, service, rdo.date)
            }
          }
          // RDO Compizzo → Planejamento. Duas modalidades:
          //  (1) Várias atividades: cada linha de produção com planningActivityId avança
          //      a SUA atividade-mestre pela quantidade da linha.
          //  (2) Legada (vínculo único): sem linhas vinculadas, soma o m² no cz.planningActivityId.
          const cz = rdo.compizzo
          if (cz) {
            const siteId = rdo.siteId ?? null
            const bump = (activityId: string, qty: number) => {
              if (!activityId || qty <= 0) return
              const svc = { quantity: qty } as RDO['services'][number]
              accumulate(globalMap, activityId, svc, rdo.date)
              if (siteId) {
                let m = perObra.get(siteId)
                if (!m) { m = new Map(); perObra.set(siteId, m) }
                accumulate(m, activityId, svc, rdo.date)
              }
            }
            const linhasVinculadas = (cz.producao ?? []).filter((r) => r.planningActivityId)
            if (linhasVinculadas.length > 0) {
              for (const r of linhasVinculadas) bump(r.planningActivityId!, parseLocaleNumber(r.quantidade))
            } else if (cz.planningActivityId) {
              const m2 = (cz.producao ?? []).reduce((s, r) => (/m²|m2/i.test(r.servico) ? s + parseLocaleNumber(r.quantidade) : s), 0)
              bump(cz.planningActivityId, m2)
            }
          }
        }
        const entries = Array.from(execMap.entries()).map(([code, data]) => ({
          trechoCode: code,
          executedMeters: data.executedMeters,
          date: data.date,
        }))
        if (entries.length > 0) {
          import('./planejamentoStore')
            .then(({ usePlanejamentoStore }) => {
              usePlanejamentoStore.getState().syncExecutionFromRdo(entries)
            })
            .catch(() => {})
        }
        // Reconcilia SEMPRE (mesmo com globalMap vazio) — assim atividades que perderam o
        // vínculo com RDO (re-link de linha, ou exclusão do RDO) são zeradas em vez de
        // ficarem com executedQuantity/percentComplete obsoletos (dupla contagem).
        Promise.all([import('./planejamentoMestreStore'), import('./planoExecucaoStore')])
          .then(([{ usePlanejamentoMestreStore }, { usePlanoExecucaoStore }]) => {
            const store = usePlanejamentoMestreStore.getState()
            // Meta por obra (m²) do Plano de Execução — usada p/ % quando a atividade não tem plannedQuantity (caso Compizzo).
            const metaByObra = new Map<string, number>()
            for (const p of usePlanoExecucaoStore.getState().planos) {
              if (p.siteId && (p.areaM2 ?? 0) > 0) metaByObra.set(p.siteId, Math.max(metaByObra.get(p.siteId) ?? 0, p.areaM2))
            }
            for (const activity of store.activities) {
              // Atividade com obra: só recebe RDO da MESMA obra. Sem obra (legada): comportamento global.
              const obraTag = activity.obraId ?? null
              const src = obraTag ? perObra.get(obraTag) : globalMap
              let data = src?.get(activity.id) ?? (activity.operationalKey ? src?.get(activity.operationalKey) : undefined)
              // Fallback por ID (UUID único → sem contaminação cross-obra): RDO sem obra (siteId
              // null) que vinculou explicitamente esta atividade cai só no globalMap.
              if (!data && obraTag) data = globalMap.get(activity.id)
              if (!data) {
                // Perdeu o vínculo com RDO → zera o que veio de RDO. `lastRdoDate` marca a atividade
                // como movida por RDO; progresso manual (sem lastRdoDate) fica intacto.
                if (activity.lastRdoDate) {
                  store.updateActivity(activity.id, {
                    executedQuantity: 0, percentComplete: 0, physicalProgressPct: 0,
                    status: 'not_started', lastRdoDate: undefined,
                  })
                }
                continue
              }
              const planned = Number(activity.plannedQuantity) || 0
              const meta = obraTag ? (metaByObra.get(obraTag) ?? 0) : 0
              const percentComplete = planned > 0
                ? Math.min(100, Math.round((data.quantity / planned) * 10000) / 100)
                : meta > 0
                  ? Math.min(100, Math.round((data.quantity / meta) * 10000) / 100)   // Compizzo: m² executado ÷ meta da obra
                  : Math.min(100, Math.round(data.progressPct * 100) / 100)
              store.updateActivity(activity.id, {
                executedQuantity: data.quantity,
                lastRdoDate: data.date,
                percentComplete,
                physicalProgressPct: percentComplete,
                status: percentComplete >= 100 ? 'completed' : data.status as typeof activity.status,
              })
            }
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
          editingRdoId:     null,
          activeOrgId:      null,
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
        // Assim que as ops de 'rdo' saem da fila, reconcilia os números provisórios
        // com os que o servidor atribuiu (a trigger assign_rdo_number pode ter trocado
        // um número que colidia). O pull fica bloqueado enquanto houver op de 'rdo'
        // pendente, então só roda depois que a fila esvazia.
        const hadPendingRdo   = queue.some((p) => p.table === 'rdo')
        const stillPendingRdo = get().pendingSync.some((p) => p.table === 'rdo')
        if (hadPendingRdo && !stillPendingRdo) void get().pull()
        // Foto capturada offline pode subir agora que há conexão.
        void get().retryPhotoUploads()
      },

      pull: async () => {
        if (pullRdoFinBlob) await pullRdoFinBlob()   // entradas financeiras do RDO (app_state)
        // Fase 5 (mergePull): em vez de pular a tabela inteira quando há op de 'rdo' pendente,
        // atualiza os RDOs SEM op pendente com o servidor e PRESERVA os não-sincronizados —
        // assim uma op presa não congela mais o resto da lista nem apaga dado local.
        const rows = await pullTable<RdoRow>('rdo', { column: 'number', ascending: false })
        if (!rows) return
        set((s) => ({
          rdos: mergePull(rows.map(rowToRdo), s.rdos, s.pendingSync, 'rdo'),
          syncStatus: 'idle',
          lastSyncedAt: new Date().toISOString(),
          syncError: null,
        }))
        // Reconcile pós-pull: (a) uma exclusão APROVADA faz o RDO sumir do servidor → remove
        // os lançamentos que ele gerou no Financeiro (a exclusão local NÃO remove mais, pois
        // aguarda aprovação); (b) uma exclusão NEGADA ressuscita o RDO → re-sincroniza o
        // Planejamento (recompute total a partir da lista mesclada).
        setTimeout(() => {
          const ids = new Set(get().rdos.map((r) => r.id))
          void import('./financeiroStore').then(({ useFinanceiroStore }) => {
            const fin = useFinanceiroStore.getState()
            const orfaos = new Set(
              fin.entries
                .map((e) => e.sourceRdoId)
                .filter((rid): rid is string => !!rid && !ids.has(rid)),
            )
            orfaos.forEach((rid) => fin.removeRdoEntries(rid))
          })
          // Idem para os apontamentos de M.O. gerados pela ponte RDO→timecards.
          void import('./maoDeObraStore').then(({ useMaoDeObraStore }) => {
            const mo = useMaoDeObraStore.getState()
            const orfaos = new Set(
              mo.timecards
                .map((t) => t.sourceRdoId)
                .filter((rid): rid is string => !!rid && !ids.has(rid)),
            )
            orfaos.forEach((rid) => mo.removeRdoTimecards(rid))
          })
          get().syncExecutionToPlanejamento()
        }, 0)
        void get().retryPhotoUploads()
      },

      // Reenvia fotos que ficaram só em base64 (capturadas offline / upload falhou):
      // sobe pro Storage e enfileira um update do RDO com o payload já sem o base64.
      // Idempotente (só toca base64-sem-storagePath), guardado contra reentrância.
      retryPhotoUploads: async () => {
        if (retryingPhotos) return
        if (isNonProductionDataMode()) return
        if (typeof navigator !== 'undefined' && !navigator.onLine) return
        const { profile, user } = useAuth.getState()
        if (!profile) return
        const targets = get().rdos.filter((r) => r.photos.some((p) => p.base64 && !p.storagePath))
        if (targets.length === 0) return

        retryingPhotos = true
        let enqueuedAny = false
        try {
          for (const rdo of targets) {
            // Sobe cada foto pendente e coleta id → storagePath. NÃO trata a lista
            // do snapshot como verdade: no set() aplica os caminhos por id sobre as
            // fotos ATUAIS do RDO, preservando fotos adicionadas durante o upload.
            const snapshot = get().rdos.find((r) => r.id === rdo.id)?.photos ?? []
            const uploaded = new Map<string, string>()
            await Promise.all(
              snapshot.map(async (p) => {
                if (!p.base64 || p.storagePath) return
                try {
                  const blob = await fetch(p.base64).then((r) => r.blob())
                  uploaded.set(p.id, await uploadRdoPhoto(blob))
                } catch { /* ainda offline / falhou — mantém o base64 */ }
              }),
            )
            if (uploaded.size === 0) continue
            enqueuedAny = true
            set((s) => {
              const updatedRdos = s.rdos.map((r) => {
                if (r.id !== rdo.id) return r
                const photos = r.photos.map((p) =>
                  uploaded.has(p.id)
                    ? { id: p.id, label: p.label, uploadedAt: p.uploadedAt, storagePath: uploaded.get(p.id)! }
                    : p,
                )
                return { ...r, photos, updatedAt: new Date().toISOString() }
              })
              const updated = updatedRdos.find((r) => r.id === rdo.id)
              const orgId  = profile.organization_id ?? 'pending'
              const userId = user?.id ?? 'pending'
              const row    = updated ? rdoToRow(updated, orgId, userId) : undefined
              const patch  = row ? { payload: row.payload } : undefined
              return {
                rdos: updatedRdos,
                pendingSync: patch
                  ? [...s.pendingSync, makeOp({ entity: 'rdo', type: 'update', recordId: rdo.id, patch, table: 'rdo' })]
                  : s.pendingSync,
              }
            })
          }
        } finally {
          retryingPhotos = false
        }
        if (enqueuedAny) void get().flush()
      },
    }),
    {
      name: 'cdata-rdo',
      // Storage à prova de estouro de cota: se o blob (RDO + fotos) não couber no
      // localStorage, regrava sem as fotos em vez de perder tudo em silêncio.
      storage: createSafeJSONStorage(),
      partialize: (s) => ({
        activeOrgId:      s.activeOrgId,
        // Não persiste base64 das fotos já enviadas (mantém só o storagePath) — evita inflar o
        // localStorage e o custo de serialização a cada escrita. Fotos ainda não enviadas
        // (offline) mantêm o base64 como fallback até subirem. Estado em memória fica intacto.
        rdos:             s.rdos.map((r) => (r.photos?.length ? { ...r, photos: leanPhotosForPersist(r.photos) } : r)),
        financialEntries: s.financialEntries,
        budgetBRL:        s.budgetBRL,
        pendingSync:      s.pendingSync,
        lastSyncedAt:     s.lastSyncedAt,
      }),
    },
  ),
)

// Liga as entradas financeiras do RDO (local-only) ao app_state.
pullRdoFinBlob = attachBlobSync(useRdoStore, {
  key: 'rdo-financial',
  getSlice: (s) => ({ financialEntries: s.financialEntries, budgetBRL: s.budgetBRL }),
  applySlice: (b) => useRdoStore.setState(b as Partial<ReturnType<typeof useRdoStore.getState>>),
}).pullInto

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useRdoStore.getState().flush()
    void useRdoStore.getState().retryPhotoUploads()   // reenvia fotos capturadas offline
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
