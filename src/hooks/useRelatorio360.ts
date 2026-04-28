import { useMemo } from 'react'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useAgendaStore } from '@/store/agendaStore'
import { getTasksForDate } from '@/features/agenda/calendarUtils'
import type { Activity, AgendaTask, DailyReport } from '@/types'

function agendaStatusToActivityStatus(task: AgendaTask): Activity['status'] {
  if (task.status === 'completed') return 'completed'
  if ((task.completionPct ?? 0) > 0) return 'in_progress'
  return 'planned'
}

export function mergeAgendaIntoReport(report: DailyReport | null, tasks: AgendaTask[]): DailyReport | null {
  if (!report) return null
  const dayTasks = getTasksForDate(tasks, new Date(`${report.date}T12:00:00`))
  if (dayTasks.length === 0) return report

  const existingIds = new Set((report.activities ?? []).map((a) => a.id))
  const agendaActivities: Activity[] = dayTasks
    .map((task) => {
      const plannedQty = task.estimatedHours && task.estimatedHours > 0 ? task.estimatedHours : 100
      const actualQty = task.status === 'completed'
        ? plannedQty
        : Math.round(plannedQty * ((task.completionPct ?? 0) / 100) * 100) / 100
      return {
        id: `agenda-${task.id}`,
        name: `[Agenda] ${task.title}${task.location ? ` - ${task.location}` : ''}`,
        plannedQty,
        actualQty,
        unit: task.estimatedHours && task.estimatedHours > 0 ? 'h' : '%',
        crewId: `agenda-resource-${task.resourceId}`,
        status: agendaStatusToActivityStatus(task),
      }
    })
    .filter((activity) => !existingIds.has(activity.id))

  if (agendaActivities.length === 0) return report

  const existingCrewIds = new Set((report.crews ?? []).map((crew) => crew.id))
  const agendaCrews = dayTasks
    .map((task) => ({
      id: `agenda-resource-${task.resourceId}`,
      foremanName: task.teamLeadName || task.assignedTo || 'Agenda',
      crewType: task.location ? `Agenda - ${task.location}` : 'Agenda',
      activityIds: [`agenda-${task.id}`],
      timecards: [],
    }))
    .filter((crew, index, list) => !existingCrewIds.has(crew.id) && list.findIndex((item) => item.id === crew.id) === index)

  return {
    ...report,
    activities: [...(report.activities ?? []), ...agendaActivities],
    crews: [...(report.crews ?? []), ...agendaCrews],
  }
}

export function useCurrentReport() {
  const report = useRelatorio360Store((s) => s.reports[s.currentDate] ?? null)
  const tasks = useAgendaStore((s) => s.tasks)
  return useMemo(() => mergeAgendaIntoReport(report, tasks), [report, tasks])
}

export function useCurrentDate() {
  return useRelatorio360Store((s) => s.currentDate)
}

export function useSummaryMetrics() {
  // useCurrentReport returns a stable object reference (same ref when state unchanged),
  // so useMemo only recomputes when the report actually changes. This avoids returning
  // a new object literal from a Zustand selector, which would cause an infinite re-render
  // loop via useSyncExternalStore's Object.is snapshot comparison (React error #185).
  const report = useCurrentReport()
  return useMemo(() => {
    if (!report) {
      return {
        activityCount: 0,
        timecardCount: 0,
        totalTimecardHours: 0,
        totalTimecardCost: 0,
        equipmentCount: 0,
        totalEquipmentHours: 0,
        totalEquipmentCost: 0,
      }
    }

    const crews = report.crews ?? []
    const equipmentLogs = report.equipmentLogs ?? []
    const activities = report.activities ?? []
    const allTimecards = crews.flatMap((c) => c.timecards ?? [])
    const timecardCount = allTimecards.length
    const totalTimecardHours = allTimecards.reduce((s, t) => s + t.hoursWorked, 0)
    const totalTimecardCost = allTimecards.reduce((s, t) => s + t.hoursWorked * t.hourlyRate, 0)

    const equipmentCount = equipmentLogs.length
    const totalEquipmentHours = equipmentLogs.reduce((s, e) => s + e.utilizationHours, 0)
    const totalEquipmentCost = equipmentLogs.reduce((s, e) => s + e.utilizationHours * e.hourlyRate, 0)

    return {
      activityCount: activities.length,
      timecardCount,
      totalTimecardHours,
      totalTimecardCost,
      equipmentCount,
      totalEquipmentHours,
      totalEquipmentCost,
    }
  }, [report])
}
