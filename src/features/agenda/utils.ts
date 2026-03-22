import {
  parseISO,
  format,
  addWeeks,
  addDays,
  differenceInCalendarWeeks,
  differenceInDays,
  getISOWeek,
  isAfter,
  isBefore,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AgendaTask } from '@/types'

export const COLUMN_WIDTH = 140  // px per week
export const ROW_HEIGHT = 72     // px per resource row
export const SIDEBAR_W = 240     // px for sticky name column
export const HEADER_H = 68       // px for the two-row time header

// ─── Week list ─────────────────────────────────────────────────────────────────

export function getVisibleWeeks(viewStart: string, visibleWeeks: number): Date[] {
  const start = parseISO(viewStart)
  return Array.from({ length: visibleWeeks }, (_, i) => addWeeks(start, i))
}

// ─── Month header segments ────────────────────────────────────────────────────

export interface MonthSegment {
  label: string
  spanWeeks: number
}

export function getMonthSegments(weeks: Date[]): MonthSegment[] {
  const segments: MonthSegment[] = []
  for (const week of weeks) {
    const label = format(week, 'MMMM yyyy', { locale: ptBR })
    const last = segments[segments.length - 1]
    if (last && last.label === label) {
      last.spanWeeks += 1
    } else {
      segments.push({ label, spanWeeks: 1 })
    }
  }
  return segments
}

// ─── Bar positioning ──────────────────────────────────────────────────────────

export interface BarStyle {
  left: number
  width: number
  visible: boolean
}

export function getBarStyle(
  task: AgendaTask,
  viewStart: string,
  visibleWeeks: number,
  previewOffsetWeeks: number = 0
): BarStyle {
  const start = parseISO(viewStart)
  const taskStart = addWeeks(parseISO(task.startDate), previewOffsetWeeks)

  const weekOffset = differenceInCalendarWeeks(taskStart, start, { weekStartsOn: 1 })
  const taskDurationDays = Math.max(7, differenceInDays(parseISO(task.endDate), parseISO(task.startDate)))
  const weekSpan = Math.max(1, Math.ceil(taskDurationDays / 7))

  const left = weekOffset * COLUMN_WIDTH + 4
  const width = Math.max(30, weekSpan * COLUMN_WIDTH - 8)

  // Visible if bar overlaps the visible range
  const visible = weekOffset < visibleWeeks && weekOffset + weekSpan > 0

  return { left, width, visible }
}

export function getResizeLeftStyle(
  task: AgendaTask,
  viewStart: string,
  visibleWeeks: number,
  previewStartDeltaWeeks: number
): BarStyle {
  const modifiedTask: AgendaTask = {
    ...task,
    startDate: format(
      addWeeks(parseISO(task.startDate), previewStartDeltaWeeks),
      'yyyy-MM-dd'
    ),
  }
  // Clamp: startDate cannot exceed endDate
  if (!isBefore(parseISO(modifiedTask.startDate), parseISO(task.endDate))) {
    modifiedTask.startDate = format(addDays(parseISO(task.endDate), -7), 'yyyy-MM-dd')
  }
  return getBarStyle(modifiedTask, viewStart, visibleWeeks)
}

export function getResizeRightStyle(
  task: AgendaTask,
  viewStart: string,
  visibleWeeks: number,
  previewEndDeltaWeeks: number
): BarStyle {
  const modifiedTask: AgendaTask = {
    ...task,
    endDate: format(
      addWeeks(parseISO(task.endDate), previewEndDeltaWeeks),
      'yyyy-MM-dd'
    ),
  }
  // Clamp: endDate cannot precede startDate
  if (!isAfter(parseISO(modifiedTask.endDate), parseISO(task.startDate))) {
    modifiedTask.endDate = format(addDays(parseISO(task.startDate), 7), 'yyyy-MM-dd')
  }
  return getBarStyle(modifiedTask, viewStart, visibleWeeks)
}

// ─── Today indicator ──────────────────────────────────────────────────────────

export function getTodayOffset(viewStart: string, visibleWeeks: number): number | null {
  const start = parseISO(viewStart)
  const today = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekOffset = differenceInCalendarWeeks(today, start, { weekStartsOn: 1 })
  if (weekOffset < 0 || weekOffset >= visibleWeeks) return null
  return weekOffset * COLUMN_WIDTH + COLUMN_WIDTH / 2
}

// ─── Date range display ───────────────────────────────────────────────────────

export function formatViewRange(viewStart: string, visibleWeeks: number): string {
  const start = parseISO(viewStart)
  const end = addWeeks(start, visibleWeeks)
  const startStr = format(start, "dd/MM/yyyy", { locale: ptBR })
  const endStr = format(end, "dd/MM/yyyy", { locale: ptBR })
  return `${startStr} — ${endStr}`
}

// ─── Week number label ────────────────────────────────────────────────────────

export function getWeekLabel(date: Date): string {
  return String(getISOWeek(date))
}

// ─── Task move calculation ────────────────────────────────────────────────────

export function applyDragDelta(task: AgendaTask, deltaWeeks: number): { newStart: string; newEnd: string } {
  const newStart = format(addWeeks(parseISO(task.startDate), deltaWeeks), 'yyyy-MM-dd')
  const duration = differenceInDays(parseISO(task.endDate), parseISO(task.startDate))
  const newEnd = format(addDays(parseISO(newStart), duration), 'yyyy-MM-dd')
  return { newStart, newEnd }
}

export function applyResizeLeft(task: AgendaTask, deltaWeeks: number): string {
  const newStart = format(addWeeks(parseISO(task.startDate), deltaWeeks), 'yyyy-MM-dd')
  // Enforce at least 1 week before endDate
  if (!isBefore(parseISO(newStart), parseISO(task.endDate))) {
    return format(addDays(parseISO(task.endDate), -7), 'yyyy-MM-dd')
  }
  return newStart
}

export function applyResizeRight(task: AgendaTask, deltaWeeks: number): string {
  const newEnd = format(addWeeks(parseISO(task.endDate), deltaWeeks), 'yyyy-MM-dd')
  // Enforce at least 1 week after startDate
  if (!isAfter(parseISO(newEnd), parseISO(task.startDate))) {
    return format(addDays(parseISO(task.startDate), 7), 'yyyy-MM-dd')
  }
  return newEnd
}
