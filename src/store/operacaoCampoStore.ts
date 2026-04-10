/**
 * operacaoCampoStore.ts — Zustand store for Operação e Campo module.
 *
 * Sprint 3: migrado para Supabase via storeSync helper.
 * Tabelas: operacao_campo_activities, operacao_campo_days.
 * Padrão: payload jsonb completo + colunas top-level apenas para chaves indexáveis.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  OperacaoCampoTab, FieldCalendarActivity, FieldCalendarDay,
  WeeklyPpcResult, NotableServiceCurve, TrendPoint,
} from '@/types'
import { computeAllWeeklyPpc, computeTrendFromDays, computeNotableServiceData } from '@/features/operacao-campo/utils/fieldEngine'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function dayToRow(d: FieldCalendarDay, orgId: string, userId: string) {
  return {
    id:              (d as { id?: string }).id ?? `${d.date}_${d.activityId}`,
    organization_id: orgId,
    date:            d.date,
    activity_id:    (d.activityId && /^[0-9a-f-]{36}$/i.test(d.activityId)) ? d.activityId : null,
    payload:         d as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

interface OperacaoCampoState {
  activeTab: OperacaoCampoTab
  activities: FieldCalendarActivity[]
  calendarDays: FieldCalendarDay[]
  viewMode: '15d' | 'monthly'
  selectedDate: string
  weeklyPpcResults: WeeklyPpcResult[]
  notableServiceCurves: NotableServiceCurve[]
  trendPoints: TrendPoint[]

  // Sync (Sprint 3)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  setActiveTab: (tab: OperacaoCampoTab) => void
  setViewMode: (mode: '15d' | 'monthly') => void
  setSelectedDate: (date: string) => void
  updateCalendarDay: (date: string, activityId: string, updates: Partial<FieldCalendarDay>) => void
  recompute: () => void
  loadDemoData: () => void
  clearData: () => void

  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useOperacaoCampoStore = create<OperacaoCampoState>()(
  persist(
    (set, get) => ({
      activeTab: 'calendario',
      activities: [],
      calendarDays: [],
      viewMode: '15d',
      selectedDate: new Date().toISOString().slice(0, 10),
      weeklyPpcResults: [],
      notableServiceCurves: [],
      trendPoints: [],

      pendingSync:  [],
      syncStatus:   'idle',
      lastSyncedAt: null,
      syncError:    null,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSelectedDate: (date) => set({ selectedDate: date }),

      updateCalendarDay: (date, activityId, updates) => {
        const { profile, user } = useAuth.getState()
        const orgId  = profile?.organization_id ?? 'pending'
        const userId = user?.id ?? 'pending'
        set((s) => {
          const days = s.calendarDays.map((d) =>
            d.date === date && d.activityId === activityId ? { ...d, ...updates } : d
          )
          const target = days.find((d) => d.date === date && d.activityId === activityId)
          if (!target) return { calendarDays: days }
          const row = dayToRow(target, orgId, userId)
          return {
            calendarDays: days,
            pendingSync: [
              ...s.pendingSync,
              makeOp({ entity: 'operacao_campo_day', type: 'insert', recordId: row.id, row, table: 'operacao_campo_days' }),
            ],
          }
        })
        get().recompute()
        void get().flush()
      },

      recompute: () => {
        const { calendarDays, activities } = get()
        set({
          weeklyPpcResults: computeAllWeeklyPpc(calendarDays),
          trendPoints: computeTrendFromDays(calendarDays),
          notableServiceCurves: computeNotableServiceData(calendarDays, activities),
        })
      },

      loadDemoData: () => {
        import('@/data/mockOperacaoCampo').then((m) => {
          set({
            activities: structuredClone(m.MOCK_FIELD_ACTIVITIES),
            calendarDays: structuredClone(m.MOCK_CALENDAR_DAYS),
            notableServiceCurves: structuredClone(m.MOCK_NOTABLE_CURVES),
            trendPoints: structuredClone(m.MOCK_TREND_POINTS),
          })
          const { calendarDays, activities } = get()
          set({
            weeklyPpcResults: computeAllWeeklyPpc(calendarDays),
            trendPoints: computeTrendFromDays(calendarDays),
            notableServiceCurves: computeNotableServiceData(calendarDays, activities),
          })
        })
      },

      clearData: () => set({
        activities: [],
        calendarDays: [],
        weeklyPpcResults: [],
        notableServiceCurves: [],
        trendPoints: [],
        pendingSync: [],
        syncError:   null,
      }),

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ syncStatus: 'offline' }); return
        }
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
        const acts = await pullTable<{ payload: FieldCalendarActivity }>('operacao_campo_activities')
        const days = await pullTable<{ payload: FieldCalendarDay }>('operacao_campo_days')
        if (acts) set({ activities: acts.map((r) => r.payload) })
        if (days) set({ calendarDays: days.map((r) => r.payload) })
        get().recompute()
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      },
    }),
    {
      name: 'cdata-operacao-campo',
      partialize: (s) => ({
        activities:   s.activities,
        calendarDays: s.calendarDays,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useOperacaoCampoStore.getState().flush()
  })
}

