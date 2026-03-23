import { create } from 'zustand'
import { addWeeks, format, parseISO } from 'date-fns'
import type { AgendaTask, AgendaResource } from '@/types'
import { mockTasks, mockResources, INITIAL_VIEW_START, INITIAL_VISIBLE_WEEKS } from '@/data/mockAgenda'

interface AgendaState {
  tasks: AgendaTask[]
  resources: AgendaResource[]
  viewStart: string         // 'yyyy-MM-dd', always a Monday
  visibleWeeks: number
  selectedTaskId: string | null
  editingTaskId: string | null   // 'new' | task.id | null

  addTask: (task: Omit<AgendaTask, 'id'>) => void
  updateTask: (id: string, updates: Partial<Omit<AgendaTask, 'id'>>) => void
  deleteTask: (id: string) => void
  moveTask: (id: string, newStart: string, newEnd: string) => void

  panLeft: () => void
  panRight: () => void
  zoomIn: () => void
  zoomOut: () => void

  selectTask: (id: string | null) => void
  setEditingTask: (id: string | null) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useAgendaStore = create<AgendaState>((set) => ({
  tasks: mockTasks,
  resources: mockResources,
  viewStart: INITIAL_VIEW_START,
  visibleWeeks: INITIAL_VISIBLE_WEEKS,
  selectedTaskId: null,
  editingTaskId: null,

  addTask: (task) =>
    set((s) => ({
      tasks: [...s.tasks, { ...task, id: crypto.randomUUID() }],
    })),

  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  deleteTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      editingTaskId: s.editingTaskId === id ? null : s.editingTaskId,
    })),

  moveTask: (id, newStart, newEnd) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, startDate: newStart, endDate: newEnd } : t
      ),
    })),

  panLeft: () =>
    set((s) => ({
      viewStart: format(addWeeks(parseISO(s.viewStart), -4), 'yyyy-MM-dd'),
    })),

  panRight: () =>
    set((s) => ({
      viewStart: format(addWeeks(parseISO(s.viewStart), 4), 'yyyy-MM-dd'),
    })),

  zoomIn: () =>
    set((s) => ({ visibleWeeks: Math.max(4, s.visibleWeeks - 2) })),

  zoomOut: () =>
    set((s) => ({ visibleWeeks: Math.min(26, s.visibleWeeks + 2) })),

  selectTask: (id) => set({ selectedTaskId: id }),
  setEditingTask: (id) => set({ editingTaskId: id }),

  loadDemoData: () =>
    set({ tasks: mockTasks, resources: mockResources }),

  clearData: () =>
    set({ tasks: [], resources: [] }),
}))

// Derived selectors
export function getUnscheduledCount(tasks: AgendaTask[]) {
  return tasks.filter((t) => t.status === 'unscheduled').length
}

export function getTasksForResource(tasks: AgendaTask[], resourceId: string) {
  return tasks.filter((t) => t.resourceId === resourceId)
}

export function useViewEnd(viewStart: string, visibleWeeks: number): string {
  return format(addWeeks(parseISO(viewStart), visibleWeeks), 'yyyy-MM-dd')
}
