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

// ─── Equipment Profile Module ─────────────────────────────────────────────────

export type EquipmentStatus = 'active' | 'idle' | 'maintenance' | 'alert' | 'offline'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface EquipmentAlert {
  id: string
  equipmentId: string
  severity: AlertSeverity
  type: string
  message: string
  timestamp: string        // ISO string
  acknowledged: boolean
}

export interface EquipmentProfile {
  id: string
  code: string             // e.g. 'EQ-017'
  name: string
  type: string             // e.g. 'Plataforma Elevatória'
  brand: string
  model: string
  year: number
  serialNumber: string
  status: EquipmentStatus
  lat: number | null
  lng: number | null
  siteName: string | null
  description: string
  maxLoad: string
  lastMaintenance: string  // yyyy-MM-dd
  nextMaintenance: string  // yyyy-MM-dd
  operator: string | null
  engineHours: number
  alerts: EquipmentAlert[]
}

// ─── Agenda / Gantt ───────────────────────────────────────────────────────────

export type TaskColor = 'blue' | 'orange' | 'green' | 'red' | 'purple'

export interface AgendaTask {
  id: string
  title: string
  resourceId: string
  startDate: string   // 'yyyy-MM-dd'
  endDate: string     // 'yyyy-MM-dd'
  color: TaskColor
  status: 'scheduled' | 'unscheduled' | 'completed'
  notes?: string
}

export interface AgendaResource {
  id: string
  code: string
  name: string
  type: 'equipment' | 'crew' | 'other'
  status: 'active' | 'inactive'
}
