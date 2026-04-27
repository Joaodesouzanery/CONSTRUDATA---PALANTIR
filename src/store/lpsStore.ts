/**
 * lpsStore.ts — Zustand store for the LPS / Lean Construction module.
 *
 * Sprint 3: migrado para Supabase via storeSync helper.
 * Tabelas: lps_activities, lps_restrictions, lps_takt_zones.
 * Padrão: payload jsonb completo + colunas top-level apenas para chaves indexáveis.
 * DELETE crítico passa por request_action RPC.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
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
          enqueue(makeOp({ entity: 'lps_activity', type: 'delete', recordId: id, table: 'lps_activities', approvalActionType: 'delete_lps_activity' }))
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
          set({ taktZones: taktZones.map((z) => ({ ...z, taktDays: taktPerZone })) })
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
            // Marcar como resolvida exige aprovação
            if (updates.status === 'resolvida') {
              enqueue(makeOp({ entity: 'lps_restriction', type: 'delete', recordId: id, table: 'lps_restrictions', approvalActionType: 'mark_restriction_resolved' }))
            } else {
              const row = restrictionToRow(target, orgId, userId)
              const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
              enqueue(makeOp({ entity: 'lps_restriction', type: 'update', recordId: id, patch, table: 'lps_restrictions' }))
            }
            void get().flush()
          }
        },

        removeRestriction: (id) => {
          set((s) => ({ restrictions: s.restrictions.filter((r) => r.id !== id) }))
          enqueue(makeOp({ entity: 'lps_restriction', type: 'delete', recordId: id, table: 'lps_restrictions', approvalActionType: 'delete_lps_restriction' }))
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
          set({
            integrationStatuses: [
              { source: 'suprimentos', label: 'Suprimentos', lastSyncAt: now, itemsLinked: matRestrictions, restrictionsAutoClearable: Math.floor(matRestrictions * 0.3), status: matRestrictions > 0 ? 'partial' : 'connected' },
              { source: 'mao_de_obra', label: 'Mão de Obra', lastSyncAt: now, itemsLinked: mdoRestrictions, restrictionsAutoClearable: Math.floor(mdoRestrictions * 0.2), status: mdoRestrictions > 0 ? 'partial' : 'connected' },
              { source: 'rdo', label: 'RDO', lastSyncAt: now, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'connected' },
            ],
          })
        },

        autoClearRestrictions: () => {
          const { restrictions } = get()
          const updated = restrictions.map((r) => {
            if (r.status === 'resolvida') return r
            if (r.categoria === 'materiais' && r.status === 'em_resolucao') {
              return { ...r, status: 'resolvida' as const, resolvedAt: new Date().toISOString().slice(0, 10) }
            }
            return r
          })
          set({ restrictions: updated })
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
          if (acts) set({ activities: acts.map((r) => r.payload) })
          if (restrs) set({ restrictions: restrs.map((r) => r.payload) })
          if (zones) set({ taktZones: zones.map((r) => r.payload) })
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
    eventBus.on('realtime.row_changed', (e) => {
      if (e.table === 'lps_restrictions' || e.table === 'lps_activities') {
        void useLpsStore.getState().pull()
      }
    })
  })
}
