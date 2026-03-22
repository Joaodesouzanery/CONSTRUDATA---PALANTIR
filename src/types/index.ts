// ─── Activity / Kanban ────────────────────────────────────────────────────────

export type ActivityStatus = 'planned' | 'in_progress' | 'completed'

export interface Activity {
  id: string
  name: string
  plannedQty: number
  actualQty: number
  unit: string
  crewId: string
  status: ActivityStatus
}

// ─── Crews ────────────────────────────────────────────────────────────────────

export interface Timecard {
  id: string
  workerName: string
  role: string
  hoursWorked: number
  hourlyRate: number
}

export interface Crew {
  id: string
  foremanName: string
  crewType: string
  timecards: Timecard[]
  activityIds: string[]
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export interface EquipmentLog {
  id: string
  equipmentId: string
  type: string
  activityId: string
  utilizationHours: number
  hourlyRate: number
}

// ─── Materials ────────────────────────────────────────────────────────────────

export interface MaterialLog {
  id: string
  materialId: string
  projectName: string
  activityId: string
  quantity: number
  unit: string
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export interface ReportPhoto {
  id: string
  base64: string
  label: string
  uploadedAt: string
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string
  date: string
  projectName: string
  activities: Activity[]
  crews: Crew[]
  equipmentLogs: EquipmentLog[]
  materialLogs: MaterialLog[]
  photos: ReportPhoto[]
}
