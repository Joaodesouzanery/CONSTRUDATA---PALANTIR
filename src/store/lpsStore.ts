/**
 * lpsStore.ts — Zustand store for the LPS / Lean Construction module.
 *
 * Sprint 3: migrado para Supabase via storeSync helper.
 * Tabelas: lps_activities, lps_restrictions, lps_takt_zones.
 * Padrão: payload jsonb completo + colunas top-level apenas para chaves indexáveis.
 * Exclusão é soft delete (deleted_at) direto. Resolver restrição é UPDATE — já passou por
 * request_action, e aquilo nunca gravou nada (só abria um pedido que ninguém podia aprovar).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type { LpsActivity, LpsWeeklyPPC, LpsTab, TaktZone, LpsRestriction, LpsAlert, StaffingDimension, IntegrationStatus } from '@/types'

// ─── ISO week helpers ─────────────────────────────────────────────────────────

function isoWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function weekOffset(base: Date, offset: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + offset * 7)
  return isoWeek(d)
}

function weekLabel(isoWeekStr: string): string {
  const [year, wPart] = isoWeekStr.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

export function computeWeeklyPPC(activities: LpsActivity[]): LpsWeeklyPPC[] {
  const map = new Map<string, { planned: number; completed: number }>()
  for (const a of activities) {
    if (!a.planned) continue
    const entry = map.get(a.week) ?? { planned: 0, completed: 0 }
    entry.planned += 1
    if (a.completed) entry.completed += 1
    map.set(a.week, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { planned, completed }]) => ({
      week,
      planned,
      completed,
      ppc: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    }))
}

export { weekLabel, isoWeek, weekOffset }

// ─── Mappers ──────────────────────────────────────────────────────────────────
function activityToRow(a: LpsActivity, orgId: string, userId: string) {
  return {
    id:              a.id,
    organization_id: orgId,
    week:            a.week,
    trecho_code:     a.trechoCode ?? null,
    ready_status:    a.readyStatus ?? null,
    payload:         a as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function restrictionToRow(r: LpsRestriction, orgId: string, userId: string) {
  return {
    id:              r.id,
    organization_id: orgId,
    tema:            r.tema,
    categoria:       r.categoria ?? null,
    status:          r.status,
    prazo_remocao:   r.prazoRemocao ?? null,
    resolved_at:     r.resolvedAt ?? null,
    payload:         r as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function taktZoneToRow(z: TaktZone, orgId: string, userId: string) {
  return {
    id:              z.id,
    organization_id: orgId,
    code:            z.code,
    payload:         z as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

// ─── State interface ──────────────────────────────────────────────────────────

interface LpsState {
  activeTab: LpsTab
  activities: LpsActivity[]
  taktZones: TaktZone[]
  taktTotalDays: number
  restrictions: LpsRestriction[]

  setActiveTab: (tab: LpsTab) => void

  addActivity: (a: Omit<LpsActivity, 'id'>) => void
  updateActivity: (id: string, updates: Partial<Omit<LpsActivity, 'id'>>) => void
  removeActivity: (id: string) => void

  updateTaktZone: (id: string, updates: Partial<Omit<TaktZone, 'id'>>) => void
  setTaktTotalDays: (days: number) => void
  recalculateTakt: () => void

  addRestriction: (r: Omit<LpsRestriction, 'id' | 'createdAt'>) => void
  updateRestriction: (id: string, updates: Partial<Omit<LpsRestriction, 'id'>>) => void
  removeRestriction: (id: string) => void

  alerts: LpsAlert[]
  staffingDimensions: StaffingDimension[]
  integrationStatuses: IntegrationStatus[]

  addAlert: (alert: Omit<LpsAlert, 'id'>) => void
  acknowledgeAlert: (id: string) => void
  computeStaffingDimensions: () => void
  refreshIntegrationStatus: () => void
  syncPlatformFlow: () => Promise<void>
  autoClearRestrictions: () => void

  loadDemoData: () => void
  clearData: () => void

  // Sync
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Demo data factories (kept for loadDemoData) ──────────────────────────────
const today = new Date()

function makeMockActivities(): LpsActivity[] {
  const trechos = [
    { code: 'T01', desc: 'Escavação Av. Principal', team: 'Equipe A' },
    { code: 'T02', desc: 'Assentamento DN200', team: 'Equipe A' },
    { code: 'T03', desc: 'Reaterro compactado', team: 'Equipe B' },
    { code: 'T04', desc: 'Poços de visita PV-01..04', team: 'Equipe B' },
    { code: 'T05', desc: 'Ramais domiciliares', team: 'Equipe C' },
    { code: 'T06', desc: 'Teste hidrostático T01-T03', team: 'Equipe A' },
  ]
  const activities: LpsActivity[] = []
  for (let wi = -6; wi <= 2; wi++) {
    const week = weekOffset(today, wi)
    trechos.forEach((t, ti) => {
      const planned = ti < 4 || wi >= -2
      const completed = wi < 0 && planned
      const notDone = wi < 0 && planned && !completed
      let readyStatus: LpsActivity['readyStatus'] = 'green'
      if (!planned) readyStatus = 'yellow'
      if (notDone) readyStatus = 'red'
      if (wi === 0 && ti === 2) readyStatus = 'yellow'
      activities.push({
        id: crypto.randomUUID(),
        week, trechoCode: t.code, description: t.desc,
        planned, completed: completed && Math.random() > 0.15,
        committed: planned && wi >= -1,
        readyStatus, responsibleTeam: t.team,
        plannedMeters: [80, 60, 90, 40, 50, 30][ti],
        executedMeters: completed ? [72, 58, 85, 38, 45, 30][ti] : undefined,
        cncCategory: notDone ? (['equipment', 'material', 'weather', 'labor'] as const)[ti % 4] : undefined,
        cncDescription: notDone ? 'Atraso na entrega de insumos' : undefined,
      })
    })
  }
  return activities
}

function makeMockTaktZones(): TaktZone[] {
  return [
    { id: crypto.randomUUID(), code: 'T01', lengthM: 320, taktDays: 8, actualDays: 7 },
    { id: crypto.randomUUID(), code: 'T02', lengthM: 280, taktDays: 8, actualDays: 9 },
    { id: crypto.randomUUID(), code: 'T03', lengthM: 200, taktDays: 8, actualDays: 8 },
    { id: crypto.randomUUID(), code: 'T04', lengthM: 150, taktDays: 8, actualDays: undefined },
    { id: crypto.randomUUID(), code: 'T05', lengthM: 180, taktDays: 8, actualDays: undefined },
    { id: crypto.randomUUID(), code: 'T06', lengthM: 90,  taktDays: 8, actualDays: undefined },
  ]
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLpsStore = create<LpsState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const ctx = () => {
        const { profile, user } = useAuth.getState()
        return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
      }
      return {
        activeTab: 'semaforo',
        activities: [],
        taktZones: [],
        taktTotalDays: 48,
        restrictions: [],
        alerts: [],
        staffingDimensions: [],
        integrationStatuses: [
          { source: 'suprimentos', label: 'Suprimentos', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
          { source: 'mao_de_obra', label: 'Mão de Obra', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
          { source: 'rdo', label: 'RDO', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
          { source: 'qualidade', label: 'Qualidade', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
          { source: 'equipamentos', label: 'Equipamentos', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
          { source: 'medicao', label: 'Medição', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
        ],

        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        setActiveTab: (tab) => set({ activeTab: tab }),

        addActivity: (a) => {
          const { orgId, userId } = ctx()
          const activity: LpsActivity = { ...a, id: crypto.randomUUID() }
          set((s) => ({ activities: [...s.activities, activity] }))
          enqueue(makeOp({ entity: 'lps_activity', type: 'insert', recordId: activity.id, row: activityToRow(activity, orgId, userId), table: 'lps_activities' }))
          void get().flush()
        },

        updateActivity: (id, updates) => {
          set((s) => ({ activities: s.activities.map((a) => a.id === id ? { ...a, ...updates } : a) }))
          const target = get().activities.find((a) => a.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            const row = activityToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'lps_activity', type: 'update', recordId: id, patch, table: 'lps_activities' }))
            void get().flush()
          }
        },

        removeActivity: (id) => {
          set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
          // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`: aquilo
          // só CRIA UM PEDIDO em pending_actions e não apaga nada. A op saía da fila como concluída
          // e a atividade voltava no pull seguinte — reaparecia no lookahead e no semáforo e voltava
          // a entrar na conta do PPC da semana (planejadas × concluídas), fazendo o percentual
          // mentir. A RLS aceita o soft delete direto (`lps_activities_update_role`).
          enqueue(makeOp({ entity: 'lps_activity', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'lps_activities' }))
          void get().flush()
        },

        updateTaktZone: (id, updates) => {
          set((s) => ({ taktZones: s.taktZones.map((z) => z.id === id ? { ...z, ...updates } : z) }))
          const target = get().taktZones.find((z) => z.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            const row = taktZoneToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'lps_takt_zone', type: 'update', recordId: id, patch, table: 'lps_takt_zones' }))
            void get().flush()
          }
        },

        setTaktTotalDays: (days) => {
          set({ taktTotalDays: days })
          get().recalculateTakt()
        },

        recalculateTakt: () => {
          const { taktZones, taktTotalDays } = get()
          const numZones = taktZones.length || 1
          const taktPerZone = Math.round(taktTotalDays / numZones)
          const updated = taktZones.map((z) => ({ ...z, taktDays: taktPerZone }))
          set({ taktZones: updated })
          // Persistir as zonas recalculadas (antes só ficava no localStorage).
          const changed = updated.filter((z, i) => z.taktDays !== taktZones[i]?.taktDays)
          if (changed.length) {
            const { orgId, userId } = ctx()
            for (const z of changed) {
              const row = taktZoneToRow(z, orgId, userId)
              const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
              enqueue(makeOp({ entity: 'lps_takt_zone', type: 'update', recordId: z.id, patch, table: 'lps_takt_zones' }))
            }
            void get().flush()
          }
        },

        addRestriction: (r) => {
          const { orgId, userId } = ctx()
          const restriction: LpsRestriction = { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString().slice(0, 10) }
          set((s) => ({ restrictions: [...s.restrictions, restriction] }))
          enqueue(makeOp({ entity: 'lps_restriction', type: 'insert', recordId: restriction.id, row: restrictionToRow(restriction, orgId, userId), table: 'lps_restrictions' }))
          void get().flush()
        },

        updateRestriction: (id, updates) => {
          set((s) => ({ restrictions: s.restrictions.map((r) => r.id === id ? { ...r, ...updates } : r) }))
          const target = get().restrictions.find((r) => r.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            // Resolver uma restrição é um UPDATE, e sempre foi.
            //
            // Antes, `status === 'resolvida'` enfileirava `type: 'delete'` com
            // `approvalActionType: 'mark_restriction_resolved'` — o `type: 'delete'` era só o
            // veículo para chamar o RPC de aprovação, a intenção nunca foi apagar a restrição.
            // O efeito prático era que resolver uma restrição não gravava nada: criava um pedido
            // numa fila que ninguém enxerga (a tela de aprovações não tem link em menu nenhum) e
            // que o próprio autor não pode aprovar. A restrição voltava para "em resolução" no
            // pull seguinte. Agora grava o que o usuário fez, como qualquer outra edição.
            const row = restrictionToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'lps_restriction', type: 'update', recordId: id, patch, table: 'lps_restrictions' }))
            void get().flush()
          }
        },

        removeRestriction: (id) => {
          set((s) => ({ restrictions: s.restrictions.filter((r) => r.id !== id) }))
          // Mesma correção de `removeActivity`: o caminho de aprovação não apagava nada e a restrição
          // reaparecia no pull — voltava a bloquear a atividade no gate operacional e a ser contada
          // como restrição em aberto no painel de saúde da obra. `lps_restrictions_update_role`
          // aceita o soft delete direto.
          enqueue(makeOp({ entity: 'lps_restriction', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'lps_restrictions' }))
          void get().flush()
        },

        addAlert: (alert) => set((s) => ({ alerts: [...s.alerts, { ...alert, id: crypto.randomUUID() }] })),
        acknowledgeAlert: (id) => set((s) => ({
          alerts: s.alerts.map((a) => a.id === id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a),
        })),

        computeStaffingDimensions: () => {
          import('@/store/maoDeObraStore').then(({ useMaoDeObraStore }) => {
            const mdo = useMaoDeObraStore.getState()
            const { activities } = get()
            const teamReqs = new Map<string, number>()
            for (const act of activities) {
              if (act.planned && !act.completed && act.responsibleTeam) {
                teamReqs.set(act.responsibleTeam, (teamReqs.get(act.responsibleTeam) ?? 0) + 1)
              }
            }
            const dims: StaffingDimension[] = []
            for (const [team, count] of teamReqs) {
              const crew = mdo.crews.find((c) => c.name === team)
              const available = crew
                ? mdo.workers.filter((w) => w.crewId === crew.id && w.status === 'active').length
                : 0
              const required = count * 3
              const gap = required - available
              dims.push({
                id: crypto.randomUUID(),
                activityName: `${team} — ${count} atividades`,
                requiredTeams: Math.ceil(count / 3),
                requiredWorkers: required,
                role: 'Geral',
                availableFromMaoDeObra: available,
                gap,
                status: gap <= 0 ? 'ok' : 'deficit',
              })
            }
            set({ staffingDimensions: dims })
          })
        },

        refreshIntegrationStatus: () => {
          const now = new Date().toISOString()
          const { restrictions } = get()
          const matRestrictions = restrictions.filter((r) => r.categoria === 'materiais' && r.status !== 'resolvida').length
          const mdoRestrictions = restrictions.filter((r) => r.categoria === 'mao_de_obra' && r.status !== 'resolvida').length
          const eqRestrictions = restrictions.filter((r) => r.categoria === 'equipamentos' && r.status !== 'resolvida').length
          const qualityRestrictions = restrictions.filter((r) => r.tags?.includes('qualidade') && r.status !== 'resolvida').length
          const medicaoRestrictions = restrictions.filter((r) => r.tags?.includes('medicao') && r.status !== 'resolvida').length
          set({
            integrationStatuses: [
              { source: 'suprimentos', label: 'Suprimentos', lastSyncAt: now, itemsLinked: matRestrictions, restrictionsAutoClearable: Math.floor(matRestrictions * 0.3), status: matRestrictions > 0 ? 'partial' : 'connected' },
              { source: 'mao_de_obra', label: 'Mão de Obra', lastSyncAt: now, itemsLinked: mdoRestrictions, restrictionsAutoClearable: Math.floor(mdoRestrictions * 0.2), status: mdoRestrictions > 0 ? 'partial' : 'connected' },
              { source: 'rdo', label: 'RDO', lastSyncAt: now, itemsLinked: get().activities.filter((a) => a.executedMeters !== undefined).length, restrictionsAutoClearable: 0, status: 'connected' },
              { source: 'qualidade', label: 'Qualidade', lastSyncAt: now, itemsLinked: qualityRestrictions, restrictionsAutoClearable: 0, status: qualityRestrictions > 0 ? 'partial' : 'connected' },
              { source: 'equipamentos', label: 'Equipamentos', lastSyncAt: now, itemsLinked: eqRestrictions, restrictionsAutoClearable: Math.floor(eqRestrictions * 0.2), status: eqRestrictions > 0 ? 'partial' : 'connected' },
              { source: 'medicao', label: 'Medição', lastSyncAt: now, itemsLinked: medicaoRestrictions, restrictionsAutoClearable: 0, status: medicaoRestrictions > 0 ? 'partial' : 'connected' },
            ],
          })
        },

        syncPlatformFlow: async () => {
          const now = new Date().toISOString()
          const todayIso = now.slice(0, 10)
          const current = get()
          const nextRestrictions = [...current.restrictions]
          const known = new Set(nextRestrictions.map((r) => `${r.tags.join('|')}|${r.tema}`))
          const addRestriction = (restriction: Omit<LpsRestriction, 'id' | 'createdAt'>) => {
            const key = `${restriction.tags.join('|')}|${restriction.tema}`
            if (known.has(key)) return
            known.add(key)
            nextRestrictions.push({ ...restriction, id: crypto.randomUUID(), createdAt: todayIso })
          }

          const [
            { useRdoStore },
            { readLocalRdoSabesp },
            { getRdoSabespExecutedServices },
            { useQualidadeStore },
            { useSuprimentosStore },
            { useGestaoEquipamentosStore },
            { useMedicaoBillingStore },
          ] = await Promise.all([
            import('@/store/rdoStore'),
            import('@/features/rdo-sabesp/lib/rdoSabespLocalStore'),
            import('@/features/rdo-sabesp/lib/rdoSabespUtils'),
            import('@/store/qualidadeStore'),
            import('@/store/suprimentosStore'),
            import('@/store/gestaoEquipamentosStore'),
            import('@/store/medicaoBillingStore'),
          ])

          const executedByCode = new Map<string, number>()
          for (const rdo of useRdoStore.getState().rdos ?? []) {
            for (const trecho of rdo.trechos ?? []) {
              if (trecho.trechoCode) executedByCode.set(trecho.trechoCode, trecho.executedMeters)
            }
          }
          for (const rdo of readLocalRdoSabesp().filter((item) => item.status !== 'draft')) {
            for (const service of getRdoSabespExecutedServices(rdo)) {
              const code = service.service_id.split('-')[0]
              if (code) executedByCode.set(code, (executedByCode.get(code) ?? 0) + service.quantity)
            }
          }

          const nextActivities = current.activities.map((activity) => {
            const executed = executedByCode.get(activity.trechoCode)
            if (executed === undefined) return activity
            const completed = activity.plannedMeters ? executed >= activity.plannedMeters : executed > 0
            return {
              ...activity,
              executedMeters: executed,
              completed,
              readyStatus: completed ? 'green' as const : activity.committed ? 'red' as const : activity.readyStatus,
              cncCategory: completed ? undefined : activity.cncCategory ?? 'planning' as const,
              cncDescription: completed ? undefined : activity.cncDescription ?? 'Execução real do RDO abaixo do prometido no LPS.',
            }
          })

          const qualidade = useQualidadeStore.getState()
          for (const nc of qualidade.nonConformities ?? []) {
            const status = String((nc as any).status ?? '').toLowerCase()
            if (['fechada', 'resolvida', 'closed', 'resolved'].includes(status)) continue
            addRestriction({
              tema: `NC Qualidade - ${(nc as any).title ?? (nc as any).titulo ?? nc.id}`,
              categoria: 'projeto_engenharia',
              descricao: (nc as any).description ?? (nc as any).descricao ?? 'Não conformidade aberta bloqueando liberação operacional.',
              impacto: 'Bloqueia atividade no LPS, medição e fechamento até liberação da qualidade.',
              responsavel: (nc as any).responsible ?? (nc as any).responsavel ?? 'Qualidade',
              prazoRemocao: (nc as any).deadline ?? (nc as any).prazo ?? todayIso,
              acoesNecessarias: 'Tratar NC, anexar evidência e liberar qualidade.',
              tags: ['qualidade', 'gate_operacional', `nc:${nc.id}`],
              status: 'identificada',
            })
          }

          for (const fvs of qualidade.fvss ?? []) {
            const pending = (fvs as any).items?.some((item: any) => item.conformity === null) || (fvs as any).ncRequired
            if (!pending) continue
            addRestriction({
              tema: `FVS pendente - ${(fvs as any).identificationNo ?? (fvs as any).number ?? fvs.id}`,
              categoria: 'projeto_engenharia',
              descricao: 'FVS pendente ou com NC exigida antes da liberação do serviço.',
              impacto: 'Bloqueia RDO finalizado, medição e fechamento vinculados ao serviço/frente.',
              responsavel: (fvs as any).responsibleLeader ?? 'Qualidade',
              prazoRemocao: (fvs as any).date ?? todayIso,
              acoesNecessarias: 'Concluir FVS e registrar decisão de conformidade.',
              tags: ['qualidade', 'fvs', 'gate_operacional', `fvs:${fvs.id}`],
              status: 'identificada',
            })
          }

          for (const alert of useSuprimentosStore.getState().supplyChainAlerts ?? []) {
            if (!['aberto', 'em_analise'].includes(alert.status)) continue
            addRestriction({
              tema: alert.titulo,
              categoria: alert.tipoRisco === 'ruptura_estoque' || alert.tipoRisco === 'atraso_fornecedor' ? 'materiais' : 'externo',
              descricao: alert.visaoGeral,
              impacto: 'Pode impedir promessa semanal ou sequência planejada.',
              responsavel: 'Suprimentos',
              acoesNecessarias: 'Regularizar material, fornecedor ou plano de abastecimento.',
              tags: ['suprimentos', `alerta:${alert.id}`, alert.tipoRisco],
              status: alert.prioridade === 'crítica' ? 'identificada' : 'em_resolucao',
            })
          }

          for (const order of useGestaoEquipamentosStore.getState().orders ?? []) {
            if (!['scheduled', 'open', 'in_progress'].includes(String(order.status))) continue
            addRestriction({
              tema: `Equipamento indisponível - ${(order as any).title ?? (order as any).equipmentName ?? order.id}`,
              categoria: 'equipamentos',
              descricao: (order as any).description ?? 'Ordem de manutenção aberta pode afetar disponibilidade de máquina.',
              impacto: 'Pode impedir compromisso semanal por falta de equipamento.',
              responsavel: (order as any).assignee ?? 'Equipamentos',
              prazoRemocao: (order as any).scheduledDate ?? todayIso,
              acoesNecessarias: 'Concluir manutenção ou realocar equipamento.',
              tags: ['equipamentos', `ordem:${order.id}`],
              status: 'identificada',
            })
          }

          const boletim = useMedicaoBillingStore.getState().getActiveBoletim()
          const blockedLines = boletim?.subempreiteiros.flatMap((sub) => sub.memoria ?? []).filter((line) => line.status === 'bloqueado' || line.status === 'glosado') ?? []
          for (const line of blockedLines) {
            addRestriction({
              tema: `Medição bloqueada - ${line.nPreco || line.descricao}`,
              categoria: 'projeto_engenharia',
              descricao: line.descricao,
              impacto: 'Item não deve entrar no fechamento até liberação técnica.',
              responsavel: 'Qualidade / Medição',
              prazoRemocao: line.data ?? todayIso,
              acoesNecessarias: 'Liberar qualidade, evidência e vínculo de medição.',
              tags: ['medicao', 'qualidade', `memoria:${line.id}`],
              status: 'identificada',
            })
          }

          set({ activities: nextActivities, restrictions: nextRestrictions })
          get().refreshIntegrationStatus()

          // Persistir o que a integração gerou/alterou. Idempotente: o dedup por
          // tags+tema já evita recriar restrição, e enfileiramos só o DELTA
          // (restrição nova / atividade que mudou) — sem op-storm a cada RDO finalizado.
          const { orgId, userId } = ctx()
          const prevActById = new Map(current.activities.map((a) => [a.id, a]))
          for (const act of nextActivities) {
            const prev = prevActById.get(act.id)
            if (prev && JSON.stringify(prev) === JSON.stringify(act)) continue
            const row = activityToRow(act, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'lps_activity', type: 'update', recordId: act.id, patch, table: 'lps_activities' }))
          }
          const prevRestrIds = new Set(current.restrictions.map((r) => r.id))
          for (const r of nextRestrictions) {
            if (prevRestrIds.has(r.id)) continue
            enqueue(makeOp({ entity: 'lps_restriction', type: 'insert', recordId: r.id, row: restrictionToRow(r, orgId, userId), table: 'lps_restrictions' }))
          }
          void get().flush()
        },

        autoClearRestrictions: () => {
          const { restrictions } = get()
          const resolvedIds: string[] = []
          const updated = restrictions.map((r) => {
            if (r.status === 'resolvida') return r
            if (r.categoria === 'materiais' && r.status === 'em_resolucao') {
              resolvedIds.push(r.id)
              return { ...r, status: 'resolvida' as const, resolvedAt: new Date().toISOString().slice(0, 10) }
            }
            return r
          })
          set({ restrictions: updated })
          // Mesma op de "resolver" do caminho manual (updateRestriction status='resolvida'):
          // UPDATE de verdade, não o falso `delete` com aprovação que existia aqui.
          const { orgId, userId } = ctx()
          for (const id of resolvedIds) {
            const alvo = get().restrictions.find((r) => r.id === id)
            if (!alvo) continue
            const row = restrictionToRow(alvo, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'lps_restriction', type: 'update', recordId: id, patch, table: 'lps_restrictions' }))
          }
          if (resolvedIds.length) void get().flush()
        },

        loadDemoData: () => set({
          activities: makeMockActivities(),
          taktZones: makeMockTaktZones(),
          taktTotalDays: 48,
          restrictions: [],
          alerts: [],
          staffingDimensions: [],
        }),

        clearData: () => set({
          activities: [], taktZones: [], taktTotalDays: 48, restrictions: [],
          alerts: [], staffingDimensions: [],
          pendingSync: [], syncError: null,
        }),

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
          const acts = await pullTable<{ payload: LpsActivity }>('lps_activities')
          const restrs = await pullTable<{ payload: LpsRestriction }>('lps_restrictions')
          const zones = await pullTable<{ payload: TaktZone }>('lps_takt_zones')
          set((s) => ({ activities: mergePull(acts?.map((r) => r.payload) ?? null, s.activities, s.pendingSync, 'lps_activities') }))
          set((s) => ({ restrictions: mergePull(restrs?.map((r) => r.payload) ?? null, s.restrictions, s.pendingSync, 'lps_restrictions') }))
          set((s) => ({ taktZones: mergePull(zones?.map((r) => r.payload) ?? null, s.taktZones, s.pendingSync, 'lps_takt_zones') }))
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-lps',
      partialize: (s) => ({
        activities:    s.activities,
        taktZones:     s.taktZones,
        taktTotalDays: s.taktTotalDays,
        restrictions:  s.restrictions,
        pendingSync:   s.pendingSync,
        lastSyncedAt:  s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useLpsStore.getState().flush()
  })

  // Cross-module listeners (Sprint Ontologia Unificada)
  // Quando FVS NC é aberta, o trigger SQL insere uma lps_restriction.
  // Re-pull aqui para mostrar a nova restrição na UI sem F5.
  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('fvs.nc_opened', () => {
      void useLpsStore.getState().pull()
    })
    eventBus.on('measurement.approved', () => {
      void useLpsStore.getState().pull()
    })
    eventBus.on('measurement.blocked', () => {
      void useLpsStore.getState().pull()
    })
    eventBus.on('lps.commitment_updated', () => {
      void useLpsStore.getState().pull()
    })
    // RDO finalizado/editado → o LPS puxa a execução automaticamente (antes só no botão manual).
    eventBus.on('rdo.finalized', () => {
      void useLpsStore.getState().syncPlatformFlow?.()
    })
    // Integração: um plano de Execução alimenta o lookahead do LPS (uma LpsActivity por atividade).
    eventBus.on('planning.activity_imported', (e) => {
      void import('@/store/planoExecucaoStore').then(({ usePlanoExecucaoStore }) => {
        const plano = usePlanoExecucaoStore.getState().planos.find((p) => p.id === e.activityId)
        if (!plano || !plano.atividades?.length || !plano.periodoInicio) return
        const week = isoWeek(new Date(`${plano.periodoInicio}T00:00:00`))
        const store = useLpsStore.getState()
        for (const a of plano.atividades) {
          const key = `${plano.id}:${a.id}`
          const match = useLpsStore.getState().activities.find((x) => x.sourceExecucaoId === key)
          const fields = {
            week, trechoCode: (a.nome || 'EXE').slice(0, 24), description: a.nome || plano.servico || 'Serviço',
            planned: true, completed: false, readyStatus: 'yellow' as const,
            plannedMeters: a.areaM2 || 0, sourceExecucaoId: key, obraId: plano.siteId ?? null,
          }
          if (match) {
            if (match.description !== fields.description || match.week !== fields.week || match.plannedMeters !== fields.plannedMeters) store.updateActivity(match.id, fields)
          } else store.addActivity(fields)
        }
      })
    })
    eventBus.on('realtime.row_changed', (e) => {
      if (
        e.table === 'lps_restrictions'
        || e.table === 'lps_activities'
        || e.table === 'measurement_sources'
        || e.table === 'measurement_memory_lines'
        || e.table === 'plan_trechos'
      ) {
        void useLpsStore.getState().pull()
      }
    })
  })
}
