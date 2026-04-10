import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, format, parseISO } from 'date-fns'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type { DailyReport, ActivityStatus, ReportPhoto, Activity, Crew, Timecard, EquipmentLog, MaterialLog } from '@/types'
import { initialReports } from '@/data/mockRelatorio360'

interface Relatorio360State {
  reports: Record<string, DailyReport>
  currentDate: string

  // Sync (Sprint 3)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>

  // Navigation
  goToDate: (date: string) => void
  goToPrevDay: () => void
  goToNextDay: () => void

  // Activity / Kanban
  moveActivity: (activityId: string, newStatus: ActivityStatus) => void
  reorderActivity: (activeId: string, overId: string) => void
  updateActivity: (activityId: string, patch: Partial<Omit<Activity, 'id'>>) => void

  // Crews & timecards
  updateCrew: (crewId: string, patch: Partial<Pick<Crew, 'foremanName' | 'crewType'>>) => void
  addTimecard: (crewId: string, tc: Omit<Timecard, 'id'>) => void
  updateTimecard: (crewId: string, timecardId: string, patch: Partial<Omit<Timecard, 'id'>>) => void
  deleteTimecard: (crewId: string, timecardId: string) => void

  // Equipment & materials
  updateEquipmentLog: (logId: string, patch: Partial<Pick<EquipmentLog, 'utilizationHours'>>) => void
  updateMaterialLog: (logId: string, patch: Partial<Pick<MaterialLog, 'quantity'>>) => void

  // Photos
  addPhoto: (photo: ReportPhoto) => void
  removePhoto: (photoId: string) => void
  updatePhotoLabel: (photoId: string, label: string) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useRelatorio360Store = create<Relatorio360State>()(
  persist(
    (set, get) => ({
  reports: initialReports,
  currentDate: Object.keys(initialReports)[0],

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  goToDate: (date) => set({ currentDate: date }),

  goToPrevDay: () => {
    const prev = format(addDays(parseISO(get().currentDate), -1), 'yyyy-MM-dd')
    set({ currentDate: prev })
  },

  goToNextDay: () => {
    const next = format(addDays(parseISO(get().currentDate), 1), 'yyyy-MM-dd')
    set({ currentDate: next })
  },

  moveActivity: (activityId, newStatus) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            activities: report.activities.map((a) =>
              a.id === activityId ? { ...a, status: newStatus } : a
            ),
          },
        },
      }
    })
  },

  reorderActivity: (activeId, overId) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      const activities = [...report.activities]
      const activeIndex = activities.findIndex((a) => a.id === activeId)
      const overIndex = activities.findIndex((a) => a.id === overId)
      if (activeIndex === -1 || overIndex === -1) return state
      const [moved] = activities.splice(activeIndex, 1)
      activities.splice(overIndex, 0, moved)
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: { ...report, activities },
        },
      }
    })
  },

  updateActivity: (activityId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            activities: report.activities.map((a) =>
              a.id === activityId ? { ...a, ...patch } : a
            ),
          },
        },
      }
    }),

  updateCrew: (crewId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) => c.id === crewId ? { ...c, ...patch } : c),
          },
        },
      }
    }),

  addTimecard: (crewId, tc) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) =>
              c.id === crewId
                ? { ...c, timecards: [...c.timecards, { ...tc, id: crypto.randomUUID() }] }
                : c
            ),
          },
        },
      }
    }),

  updateTimecard: (crewId, timecardId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) =>
              c.id === crewId
                ? {
                    ...c,
                    timecards: c.timecards.map((t) =>
                      t.id === timecardId ? { ...t, ...patch } : t
                    ),
                  }
                : c
            ),
          },
        },
      }
    }),

  deleteTimecard: (crewId, timecardId) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) =>
              c.id === crewId
                ? { ...c, timecards: c.timecards.filter((t) => t.id !== timecardId) }
                : c
            ),
          },
        },
      }
    }),

  updateEquipmentLog: (logId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            equipmentLogs: report.equipmentLogs.map((l) =>
              l.id === logId ? { ...l, ...patch } : l
            ),
          },
        },
      }
    }),

  updateMaterialLog: (logId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            materialLogs: report.materialLogs.map((l) =>
              l.id === logId ? { ...l, ...patch } : l
            ),
          },
        },
      }
    }),

  addPhoto: (photo) => {
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            photos: [...report.photos, photo],
          },
        },
        pendingSync: [
          ...state.pendingSync,
          makeOp({
            entity: 'daily_report_photo',
            type:   'insert',
            recordId: photo.id,
            row: {
              id:              photo.id,
              organization_id: orgId,
              report_date:     state.currentDate,
              payload:         photo as unknown as Record<string, unknown>,
              created_by:      userId,
            },
            table: 'daily_report_photos',
          }),
        ],
      }
    })
    void get().flush()
  },

  removePhoto: (photoId) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            photos: report.photos.filter((p) => p.id !== photoId),
          },
        },
        pendingSync: [
          ...state.pendingSync,
          makeOp({
            entity: 'daily_report_photo',
            type:   'delete',
            recordId: photoId,
            table:    'daily_report_photos',
            approvalActionType: 'delete_daily_report_photo',
          }),
        ],
      }
    })
    void get().flush()
  },

  updatePhotoLabel: (photoId, label) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            photos: report.photos.map((p) =>
              p.id === photoId ? { ...p, label } : p
            ),
          },
        },
      }
    })
  },

  loadDemoData: () =>
    set({ reports: initialReports, currentDate: Object.keys(initialReports)[0] }),

  clearData: () =>
    set({ reports: {}, pendingSync: [], syncError: null }),

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
    // Sprint 3: pull genérico das 4 tabelas. Os dados retornam separadamente
    // por entidade — a hidratação completa do `reports` aninhado fica para
    // uma futura iteração. Por enquanto, marca timestamp para diagnóstico.
    await pullTable<{ payload: ReportPhoto }>('daily_report_photos')
    await pullTable<{ payload: Activity }>('daily_report_activities')
    await pullTable<{ payload: EquipmentLog }>('daily_report_equipment_logs')
    await pullTable<{ payload: MaterialLog }>('daily_report_material_logs')
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-relatorio360',
      partialize: (s) => ({
        reports:      s.reports,
        currentDate:  s.currentDate,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useRelatorio360Store.getState().flush()
  })
}
