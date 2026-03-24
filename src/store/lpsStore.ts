/**
 * lpsStore.ts — Zustand store for the LPS / Lean Construction module.
 *
 * Manages:
 *  - activities: LpsActivity[] (planned/completed per week per trecho)
 *  - taktZones: TaktZone[] (takt time visualization)
 *  - weeklyPPC: derived from activities
 */
import { create } from 'zustand'
import type { LpsActivity, LpsWeeklyPPC, LpsTab, TaktZone } from '@/types'

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
  // e.g. '2025-W12' → 'S12/25'
  const [year, wPart] = isoWeekStr.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

// ─── Mock data factory ────────────────────────────────────────────────────────

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
  let id = 1

  // Past 6 weeks + current + 2 future
  for (let wi = -6; wi <= 2; wi++) {
    const week = weekOffset(today, wi)
    trechos.forEach((t, ti) => {
      const planned = ti < 4 || wi >= -2  // most are planned
      const completed = wi < 0 && planned  // past weeks mostly completed
      const notDone = wi < 0 && planned && !completed

      let readyStatus: LpsActivity['readyStatus'] = 'green'
      if (!planned) readyStatus = 'yellow'
      if (notDone) readyStatus = 'red'
      if (wi === 0 && ti === 2) readyStatus = 'yellow'  // current week at risk

      activities.push({
        id: String(id++),
        week,
        trechoCode: t.code,
        description: t.desc,
        planned,
        completed: completed && Math.random() > 0.15,
        readyStatus,
        responsibleTeam: t.team,
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
    { id: '1', code: 'T01', lengthM: 320, taktDays: 8, actualDays: 7 },
    { id: '2', code: 'T02', lengthM: 280, taktDays: 8, actualDays: 9 },
    { id: '3', code: 'T03', lengthM: 200, taktDays: 8, actualDays: 8 },
    { id: '4', code: 'T04', lengthM: 150, taktDays: 8, actualDays: undefined },
    { id: '5', code: 'T05', lengthM: 180, taktDays: 8, actualDays: undefined },
    { id: '6', code: 'T06', lengthM: 90,  taktDays: 8, actualDays: undefined },
  ]
}

// ─── Derived: compute weekly PPC ─────────────────────────────────────────────

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

// ─── State interface ──────────────────────────────────────────────────────────

interface LpsState {
  activeTab: LpsTab
  activities: LpsActivity[]
  taktZones: TaktZone[]
  taktTotalDays: number

  setActiveTab: (tab: LpsTab) => void

  addActivity: (a: Omit<LpsActivity, 'id'>) => void
  updateActivity: (id: string, updates: Partial<Omit<LpsActivity, 'id'>>) => void
  removeActivity: (id: string) => void

  updateTaktZone: (id: string, updates: Partial<Omit<TaktZone, 'id'>>) => void
  setTaktTotalDays: (days: number) => void
  recalculateTakt: () => void

  loadDemoData: () => void
  clearData: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLpsStore = create<LpsState>((set, get) => ({
  activeTab: 'semaforo',
  activities: makeMockActivities(),
  taktZones: makeMockTaktZones(),
  taktTotalDays: 48,

  setActiveTab: (tab) => set({ activeTab: tab }),

  addActivity: (a) =>
    set((s) => ({
      activities: [...s.activities, { ...a, id: crypto.randomUUID() }],
    })),

  updateActivity: (id, updates) =>
    set((s) => ({
      activities: s.activities.map((a) => a.id === id ? { ...a, ...updates } : a),
    })),

  removeActivity: (id) =>
    set((s) => ({ activities: s.activities.filter((a) => a.id !== id) })),

  updateTaktZone: (id, updates) =>
    set((s) => ({
      taktZones: s.taktZones.map((z) => z.id === id ? { ...z, ...updates } : z),
    })),

  setTaktTotalDays: (days) => {
    set({ taktTotalDays: days })
    get().recalculateTakt()
  },

  recalculateTakt: () => {
    const { taktZones, taktTotalDays } = get()
    const numZones = taktZones.length || 1
    const taktPerZone = Math.round(taktTotalDays / numZones)
    set({
      taktZones: taktZones.map((z) => ({ ...z, taktDays: taktPerZone })),
    })
  },

  loadDemoData: () =>
    set({
      activities: makeMockActivities(),
      taktZones: makeMockTaktZones(),
      taktTotalDays: 48,
    }),

  clearData: () =>
    set({
      activities: [],
      taktZones: [],
      taktTotalDays: 48,
    }),
}))
