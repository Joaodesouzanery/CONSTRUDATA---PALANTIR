/**
 * agendaStore.ts — Sprint 6: migrado para Supabase via storeSync.
 * Tabelas: agenda_tasks, agenda_resources.
 * UI state (viewMode, viewStart, etc) fica fora do partialize.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, format, parseISO } from 'date-fns'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type { AgendaTask, AgendaResource, AgendaViewMode, AgendaDisplayView } from '@/types'
import { mockTasks, mockResources, INITIAL_VIEW_START, INITIAL_VISIBLE_WEEKS } from '@/data/mockAgenda'

const PAN_DAYS: Record<AgendaViewMode, number> = {
  day:      7,
  week:     28,
  month:    90,
  quarter:  91,
  semester: 182,
  year:     365,
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function taskToRow(t: AgendaTask, orgId: string, userId: string) {
  return {
    id:                t.id,
    organization_id:   orgId,
    resource_id:       t.resourceId ?? null,
    start_date:        t.startDate ?? null,
    end_date:          t.endDate ?? null,
    status:            t.status ?? null,
    priority:          t.priority ?? null,
    linked_project_id: t.linkedProjectId ?? null,
    payload:           t as unknown as Record<string, unknown>,
    created_by:        userId,
  }
}
function resourceToRow(r: AgendaResource, orgId: string, userId: string) {
  return {
    id:              r.id,
    organization_id: orgId,
    code:            r.code ?? null,
    name:            r.name ?? null,
    type:            r.type ?? null,
    status:          r.status ?? null,
    payload:         r as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface AgendaState {
  tasks: AgendaTask[]
  resources: AgendaResource[]
  viewStart: string
  visibleWeeks: number
  viewMode: AgendaViewMode
  selectedTaskId: string | null
  editingTaskId: string | null
  displayView: AgendaDisplayView

  // Sync
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  addTask: (task: Omit<AgendaTask, 'id'>) => void
  updateTask: (id: string, updates: Partial<Omit<AgendaTask, 'id'>>) => void
  deleteTask: (id: string) => void
  moveTask: (id: string, newStart: string, newEnd: string) => void

  panLeft: () => void
  panRight: () => void
  zoomIn: () => void
  zoomOut: () => void
  setViewMode: (mode: AgendaViewMode) => void

  selectTask: (id: string | null) => void
  setEditingTask: (id: string | null) => void
  setDisplayView: (view: AgendaDisplayView) => void
  setVisibleWeeks: (n: number) => void
  setViewStart: (date: string) => void
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      return {
        tasks: [],
        resources: [],
        viewStart: INITIAL_VIEW_START,
        visibleWeeks: INITIAL_VISIBLE_WEEKS,
        viewMode: 'week',
        selectedTaskId: null,
        editingTaskId: null,
        displayView: 'gantt',
        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        addTask: (task) => {
          const id = crypto.randomUUID()
          const newTask: AgendaTask = { ...task, id }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            tasks: [...s.tasks, newTask],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'agenda_task', type: 'insert', recordId: id, row: taskToRow(newTask, orgId, userId), table: 'agenda_tasks' })],
          }))
          void get().flush()
        },

        updateTask: (id, updates) => {
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) }))
          const target = get().tasks.find((t) => t.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = taskToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'agenda_task', type: 'update', recordId: id, patch, table: 'agenda_tasks' }))
            void get().flush()
          }
        },

        deleteTask: (id) => {
          set((s) => ({
            tasks: s.tasks.filter((t) => t.id !== id),
            editingTaskId: s.editingTaskId === id ? null : s.editingTaskId,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'agenda_task', type: 'delete', recordId: id, table: 'agenda_tasks', approvalActionType: 'delete_agenda_task' })],
          }))
          void get().flush()
        },

        moveTask: (id, newStart, newEnd) => {
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, startDate: newStart, endDate: newEnd } : t)),
          }))
          const target = get().tasks.find((t) => t.id === id)
          if (target) {
            const { orgId, userId } = ctxAuth()
            const row = taskToRow(target, orgId, userId)
            const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'agenda_task', type: 'update', recordId: id, patch, table: 'agenda_tasks' }))
            void get().flush()
          }
        },

        panLeft: () =>
          set((s) => ({ viewStart: format(addDays(parseISO(s.viewStart), -PAN_DAYS[s.viewMode]), 'yyyy-MM-dd') })),
        panRight: () =>
          set((s) => ({ viewStart: format(addDays(parseISO(s.viewStart), PAN_DAYS[s.viewMode]), 'yyyy-MM-dd') })),
        zoomIn: () => set((s) => ({ visibleWeeks: Math.max(4, s.visibleWeeks - 2) })),
        zoomOut: () => set((s) => ({ visibleWeeks: Math.min(26, s.visibleWeeks + 2) })),
        setViewMode: (mode) => set({ viewMode: mode }),
        selectTask: (id) => set({ selectedTaskId: id }),
        setEditingTask: (id) => set({ editingTaskId: id }),
        setDisplayView: (view) => set({ displayView: view }),
        setVisibleWeeks: (n) => set({ visibleWeeks: Math.max(1, Math.min(52, n)) }),
        setViewStart: (date) => set({ viewStart: date }),

        loadDemoData: () => set({ tasks: mockTasks, resources: mockResources }),
        clearData: () => set({ tasks: [], resources: [], pendingSync: [], syncError: null }),

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
          const ts = await pullTable<{ payload: AgendaTask }>('agenda_tasks')
          const rs = await pullTable<{ payload: AgendaResource }>('agenda_resources')
          if (ts) set({ tasks:     ts.map((r) => r.payload) })
          if (rs) set({ resources: rs.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-agenda',
      partialize: (s) => ({
        tasks:        s.tasks,
        resources:    s.resources,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

// Mantém função `resourceToRow` referenciada para futura CRUD de recursos
void resourceToRow

// Derived selectors
export function getUnscheduledCount(tasks: AgendaTask[]) {
  return tasks.filter((t) => t.status === 'unscheduled').length
}

export function getTasksForResource(tasks: AgendaTask[], resourceId: string) {
  return tasks.filter((t) => t.resourceId === resourceId)
}

export function useViewEnd(viewStart: string, visibleWeeks: number): string {
  return format(addDays(parseISO(viewStart), visibleWeeks * 7), 'yyyy-MM-dd')
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useAgendaStore.getState().flush()
  })
}
