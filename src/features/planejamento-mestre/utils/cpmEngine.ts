/**
 * cpmEngine.ts — Critical Path Method (CPM) engine.
 *
 * Performs a forward pass and backward pass on an array of MasterActivity
 * objects to compute:
 *   - earlyStart / earlyFinish
 *   - lateStart  / lateFinish
 *   - totalFloat / freeFloat
 *   - isCritical (totalFloat <= 0)
 *
 * All dates are calendar dates (strings "YYYY-MM-DD").
 * Duration is measured in calendar days.
 *
 * Predecessor relationships supported: FS, SS, FF, SF (with lag in days).
 */
import type { MasterActivity } from '@/types'

// ─── Date arithmetic helpers ─────────────────────────────────────────────────

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function diffDays(isoA: string, isoB: string): number {
  // Returns isoB - isoA in days
  return Math.round(
    (new Date(isoB).getTime() - new Date(isoA).getTime()) / 86400000,
  )
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b
}

// ─── Main CPM function ───────────────────────────────────────────────────────

export function computeCPM(activities: MasterActivity[]): MasterActivity[] {
  if (activities.length === 0) return []

  // Build id/code → activity index maps
  const byId  = new Map<string, MasterActivity>()
  const byCode = new Map<string, MasterActivity>()
  activities.forEach((a) => {
    byId.set(a.id, a)
    if (a.activityCode) byCode.set(a.activityCode, a)
  })

  function resolve(ref: string): MasterActivity | undefined {
    return byId.get(ref) ?? byCode.get(ref)
  }

  // Work on mutable copies
  const acts: MasterActivity[] = activities.map((a) => ({
    ...a,
    originalDurationDays: a.originalDurationDays ?? a.durationDays ?? 0,
  }))

  const actMap = new Map<string, MasterActivity>()
  acts.forEach((a) => {
    actMap.set(a.id, a)
    if (a.activityCode) actMap.set(a.activityCode, a)
  })

  // Determine project start date
  const projectStart = acts.reduce(
    (min, a) => (!min || a.plannedStart < min ? a.plannedStart : min),
    acts[0]?.plannedStart ?? new Date().toISOString().split('T')[0],
  )

  // ── Forward Pass ────────────────────────────────────────────────────────────
  // Process in topological order (simple iterative — iterate until stable)

  // Initialize earlyStart for all
  acts.forEach((a) => {
    a.earlyStart  = a.earlyStart  || a.plannedStart  || projectStart
    a.earlyFinish = a.earlyFinish || a.plannedEnd     || addDays(a.earlyStart, a.originalDurationDays!)
  })

  const MAX_ITER = acts.length + 2
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false
    acts.forEach((a) => {
      let es = projectStart
      for (const pred of a.predecessors ?? []) {
        const p = resolve(pred.activityId)
        if (!p) continue
        const pAct = actMap.get(p.id)!
        const lag  = pred.lag ?? 0

        let candidateES: string
        switch (pred.relationship) {
          case 'SS':
            // Succ earlyStart ≥ Pred earlyStart + lag
            candidateES = addDays(pAct.earlyStart!, lag)
            break
          case 'FF':
            // Succ earlyFinish ≥ Pred earlyFinish + lag  →  earlyStart = earlyFinish - dur
            candidateES = addDays(
              addDays(pAct.earlyFinish!, lag),
              -(a.originalDurationDays!),
            )
            break
          case 'SF':
            // Succ earlyFinish ≥ Pred earlyStart + lag  →  earlyStart = earlyFinish - dur
            candidateES = addDays(
              addDays(pAct.earlyStart!, lag),
              -(a.originalDurationDays!),
            )
            break
          default: // FS
            // Succ earlyStart ≥ Pred earlyFinish + lag
            candidateES = addDays(pAct.earlyFinish!, lag)
        }
        es = maxDate(es, candidateES)
      }

      const newES = maxDate(a.earlyStart!, es)
      const newEF = addDays(newES, a.originalDurationDays!)
      if (newES !== a.earlyStart || newEF !== a.earlyFinish) {
        a.earlyStart  = newES
        a.earlyFinish = newEF
        changed = true
      }
    })
    if (!changed) break
  }

  // Project finish = max earlyFinish
  const projectFinish = acts.reduce(
    (max, a) => maxDate(max, a.earlyFinish!),
    acts[0]?.earlyFinish ?? projectStart,
  )

  // ── Backward Pass ───────────────────────────────────────────────────────────

  // Build successor map
  const successors = new Map<string, Array<{ succ: MasterActivity; relType: string; lag: number }>>()
  acts.forEach((a) => {
    ;(a.predecessors ?? []).forEach((pred) => {
      const pAct = resolve(pred.activityId)
      if (!pAct) return
      const list = successors.get(pAct.id) ?? []
      list.push({ succ: a, relType: pred.relationship, lag: pred.lag ?? 0 })
      successors.set(pAct.id, list)
    })
  })

  // Initialize lateFinish for all
  acts.forEach((a) => {
    a.lateFinish = projectFinish
    a.lateStart  = addDays(projectFinish, -(a.originalDurationDays!))
  })

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false
    // Process in reverse order
    ;[...acts].reverse().forEach((a) => {
      let lf = projectFinish
      const succs = successors.get(a.id) ?? []

      for (const { succ, relType, lag } of succs) {
        let candidateLF: string
        switch (relType) {
          case 'SS':
            // Pred lateStart ≤ Succ lateStart - lag → lateFinish = lateStart + dur
            candidateLF = addDays(
              addDays(succ.lateStart!, -lag),
              a.originalDurationDays!,
            )
            break
          case 'FF':
            // Pred lateFinish ≤ Succ lateFinish - lag
            candidateLF = addDays(succ.lateFinish!, -lag)
            break
          case 'SF':
            // Pred lateStart ≤ Succ lateFinish - lag → lateFinish = lateStart + dur
            candidateLF = addDays(
              addDays(succ.lateFinish!, -lag),
              a.originalDurationDays!,
            )
            break
          default: // FS
            // Pred lateFinish ≤ Succ lateStart - lag
            candidateLF = addDays(succ.lateStart!, -lag)
        }
        lf = minDate(lf, candidateLF)
      }

      const newLF = minDate(a.lateFinish!, lf)
      const newLS = addDays(newLF, -(a.originalDurationDays!))
      if (newLF !== a.lateFinish || newLS !== a.lateStart) {
        a.lateFinish = newLF
        a.lateStart  = newLS
        changed = true
      }
    })
    if (!changed) break
  }

  // ── Float Calculation ───────────────────────────────────────────────────────

  acts.forEach((a) => {
    a.totalFloat = diffDays(a.earlyStart!, a.lateStart!)
    // Free float: earlyFinish to earliest successor earlyStart
    const succs = successors.get(a.id) ?? []
    if (succs.length === 0) {
      a.freeFloat = diffDays(a.earlyFinish!, projectFinish)
    } else {
      a.freeFloat = succs.reduce((min, { succ, relType, lag }) => {
        let gap: number
        switch (relType) {
          case 'SS':
            gap = diffDays(a.earlyStart!, succ.earlyStart!) - lag
            break
          case 'FF':
            gap = diffDays(a.earlyFinish!, succ.earlyFinish!) - lag
            break
          default:
            gap = diffDays(a.earlyFinish!, succ.earlyStart!) - lag
        }
        return Math.min(min, gap)
      }, Infinity)
      if (!isFinite(a.freeFloat)) a.freeFloat = 0
    }
    a.isCritical = (a.totalFloat ?? 0) <= 0
  })

  return acts
}
