import { create } from 'zustand'
import { addDays, format, parseISO } from 'date-fns'
import type { DailyReport, ActivityStatus, ReportPhoto } from '@/types'
import { initialReports } from '@/data/mockRelatorio360'

interface Relatorio360State {
  reports: Record<string, DailyReport>
  currentDate: string

  // Navigation
  goToDate: (date: string) => void
  goToPrevDay: () => void
  goToNextDay: () => void

  // Activity / Kanban
  moveActivity: (activityId: string, newStatus: ActivityStatus) => void
  reorderActivity: (activeId: string, overId: string) => void

  // Photos
  addPhoto: (photo: ReportPhoto) => void
  removePhoto: (photoId: string) => void
  updatePhotoLabel: (photoId: string, label: string) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useRelatorio360Store = create<Relatorio360State>((set, get) => ({
  reports: initialReports,
  currentDate: Object.keys(initialReports)[0],

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

  addPhoto: (photo) => {
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
      }
    })
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
      }
    })
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
    set({ reports: {} }),
}))
