/**
 * xerExporter.ts — Generates a Primavera P6 compatible .xer file from
 * MasterActivity data.
 *
 * Produces the minimal set of tables P6 Professional needs to import:
 *   ERMHDR  — file header
 *   PROJECT — project record
 *   PROJWBS — WBS structure
 *   TASK    — activities
 *   TASKPRED — predecessor links
 */
import type { MasterActivity } from '@/types'

const HOURS_PER_DAY = 8
const SEP = '\t'

function daysToHrs(days: number): string {
  return String((days || 0) * HOURS_PER_DAY)
}

function isoToP6(iso: string | undefined): string {
  if (!iso) return ''
  // P6 date format: YYYY-MM-DD HH:MM
  return iso.length === 10 ? `${iso} 08:00` : iso
}

function table(name: string, fields: string[], rows: string[][]): string {
  const header = `%T\t${name}\n%F\t${fields.join(SEP)}`
  const body = rows.map((r) => `%R\t${r.join(SEP)}`).join('\n')
  return `${header}\n${body}`
}

export function exportToXer(activities: MasterActivity[], projectName = 'CONSTRUDATA'): string {
  const today = new Date().toISOString().split('T')[0]
  const projId = 'PROJ_1'
  const rootWbsId = 'WBS_ROOT'
  const calId = 'CAL_1'

  // ── ERMHDR ────────────────────────────────────────────────────────────────
  const ermhdr = [
    `%T\tERMHDR`,
    `%F\tprog_group\tversion\tdate\tprojname\texport_type`,
    `%R\tP6PROFESSIONAL\t20.12\t${isoToP6(today)}\t${projectName}\tproject`,
  ].join('\n')

  // ── PROJECT ───────────────────────────────────────────────────────────────
  const projRows = [[
    projId,
    projectName,
    projectName.replace(/\s+/g, '_').toUpperCase().slice(0, 20),
    isoToP6(activities[0]?.plannedStart ?? today),
    isoToP6(activities[activities.length - 1]?.plannedEnd ?? today),
    rootWbsId,
  ]]
  const projTable = table(
    'PROJECT',
    ['proj_id', 'proj_short_name', 'proj_short_name2', 'plan_start_date', 'plan_end_date', 'wbs_id'],
    projRows,
  )

  // ── PROJWBS ───────────────────────────────────────────────────────────────
  const wbsRows: string[][] = [
    [rootWbsId, projId, projectName, projectName, ''],
  ]
  const wbsCodes = new Set<string>()
  activities.forEach((a) => {
    const code = a.wbsCode || 'WBS_GEN'
    if (!wbsCodes.has(code)) {
      wbsCodes.add(code)
      wbsRows.push([`WBS_${code}`, projId, code, a.name.slice(0, 40), rootWbsId])
    }
  })
  const wbsTable = table(
    'PROJWBS',
    ['wbs_id', 'proj_id', 'wbs_short_name', 'wbs_name', 'parent_wbs_id'],
    wbsRows,
  )

  // ── TASK ──────────────────────────────────────────────────────────────────
  const taskIdMap = new Map<string, string>() // activity.id → task_id
  const taskRows: string[][] = []
  activities.forEach((a, i) => {
    const taskId = `TASK_${i + 1}`
    taskIdMap.set(a.id, taskId)
    // Also map by activityCode for predecessor resolution
    if (a.activityCode) taskIdMap.set(a.activityCode, taskId)

    const origDur = daysToHrs(a.originalDurationDays ?? a.durationDays ?? 0)
    const remDur  = daysToHrs(a.remainingDurationDays ?? a.durationDays ?? 0)
    const actDur  = daysToHrs(a.actualDurationDays ?? 0)
    const isMile  = a.isMilestone ? 'TT_Mile' : 'TT_Task'

    taskRows.push([
      taskId,
      projId,
      `WBS_${a.wbsCode || 'WBS_GEN'}`,
      a.activityCode || `ACT${String(i + 1).padStart(4, '0')}`,
      a.name,
      String(Math.round(a.percentComplete ?? 0)),
      origDur,
      remDur,
      actDur,
      isoToP6(a.earlyStart || a.plannedStart),
      isoToP6(a.earlyFinish || a.plannedEnd),
      isoToP6(a.lateStart || a.plannedStart),
      isoToP6(a.lateFinish || a.plannedEnd),
      String((a.totalFloat ?? 0) * HOURS_PER_DAY),
      String((a.freeFloat ?? 0) * HOURS_PER_DAY),
      a.constraintType ?? 'ASAP',
      isoToP6(a.constraintDate),
      isMile,
      a.calendarId ?? calId,
    ])
  })
  const taskTable = table(
    'TASK',
    [
      'task_id', 'proj_id', 'wbs_id', 'task_code', 'task_name',
      'phys_complete_pct', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'act_drtn_hr_cnt',
      'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
      'total_float_hr_cnt', 'free_float_hr_cnt',
      'cstr_type', 'cstr_date', 'task_type', 'clndr_id',
    ],
    taskRows,
  )

  // ── TASKPRED ──────────────────────────────────────────────────────────────
  const predRows: string[][] = []
  let predIdx = 1
  activities.forEach((a) => {
    const succTaskId = taskIdMap.get(a.id)
    if (!succTaskId) return
    ;(a.predecessors ?? []).forEach((p) => {
      const predTaskId = taskIdMap.get(p.activityId)
      if (!predTaskId) return
      const relMap: Record<string, string> = { FS: 'PR_FS', SS: 'PR_SS', FF: 'PR_FF', SF: 'PR_SF' }
      predRows.push([
        `PRED_${predIdx++}`,
        succTaskId,
        predTaskId,
        relMap[p.relationship] ?? 'PR_FS',
        String(p.lag * HOURS_PER_DAY),
      ])
    })
  })
  const predTable = table(
    'TASKPRED',
    ['task_pred_id', 'task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'],
    predRows,
  )

  return [ermhdr, projTable, wbsTable, taskTable, predTable, '%E'].join('\n\n')
}
