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

// ─── Projetos ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'planning' | 'completed' | 'on_hold'
export type ProjectPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'
export type BudgetLineType = 'labor' | 'equipment' | 'materials' | 'subcontract' | 'overhead' | 'other'
export type DesignViewType = '3D' | '4D' | '5D'
export type DocumentCategory = 'contract' | 'drawing' | 'specification' | 'report' | 'other'

export interface ProjectPhase {
  id: string
  name: string
  status: ProjectPhaseStatus
  progress: number       // 0–100
  startDate: string      // yyyy-MM-dd
  endDate: string        // yyyy-MM-dd
  notes?: string
}

export interface BudgetLine {
  id: string
  type: BudgetLineType
  description: string
  budgeted: number       // R$
  projected: number      // R$
  spent: number          // R$
}

export interface DesignDemand {
  id: string
  label: string
  quantity: number
  unit: string
  estimatedCost: number  // R$
}

export interface ProjectDocument {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  base64: string
  uploadedAt: string     // ISO
  uploadedBy: string
  category: DocumentCategory
}

export interface Project {
  id: string
  code: string           // e.g. 'PRJ-001'
  name: string
  owner: string          // dono
  manager: string        // gerente
  description: string
  status: ProjectStatus
  startDate: string      // yyyy-MM-dd
  endDate: string        // yyyy-MM-dd
  planningPhases: ProjectPhase[]   // 3 items: Engenharia e Design, Pré-construção, Aquisições
  executionPhases: ProjectPhase[]  // 3 items: Construção, Controle do Projeto, Encerramento
  budgetLines: BudgetLine[]
  demands: DesignDemand[]
  documents: ProjectDocument[]
}

// ─── Torre de Controle ────────────────────────────────────────────────────────

export type ObraStatus = 'active' | 'planning' | 'paused' | 'completed'
export type RiskLevel  = 'critical' | 'high' | 'medium' | 'low'
export type RiskStatus = 'identified' | 'active' | 'mitigated' | 'resolved'

export interface ConstructionRisk {
  id: string
  title: string
  description: string
  level: RiskLevel
  status: RiskStatus
  identifiedAt: string  // ISO date string
  notes?: string
}

export interface ConstructionSite {
  id: string
  code: string          // e.g. 'OBR-001'
  name: string          // nome da obra
  company: string       // empresa responsável
  owner: string         // dono da obra
  manager: string       // gerente da construção
  description: string
  status: ObraStatus
  street: string        // rua
  number: string        // número
  district: string      // bairro
  city: string          // cidade
  state: string         // estado (e.g. 'SP')
  cep: string           // CEP
  buildingType: string  // tipo: 'Residencial', 'Comercial', 'Industrial', etc.
  totalArea: number     // m²
  floors: number        // andares / pavimentos
  startDate: string     // yyyy-MM-dd
  expectedEnd: string   // yyyy-MM-dd
  lat: number | null
  lng: number | null
  risks: ConstructionRisk[]
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

// ─── Gestão de Equipamentos ───────────────────────────────────────────────────

export type WorkOrderStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type MaintenanceType = 'preventive' | 'corrective' | 'predictive'

export interface MaintenanceOrder {
  id: string
  equipmentId: string
  type: MaintenanceType
  description: string
  scheduledDate: string      // yyyy-MM-dd
  completedDate?: string
  responsible: string
  estimatedCost: number
  actualCost?: number
  status: WorkOrderStatus
  notes?: string
}

// ─── Pré-Construção ───────────────────────────────────────────────────────────

export type PipelineStep   = 'upload' | 'extraction' | 'normalization' | 'matching' | 'proposal'
export type ClauseSeverity = 'critical' | 'warning' | 'info'
export type CostSource     = 'sinapi' | 'seinfra' | 'custom'

export interface TakeoffItem {
  id: string
  description: string
  quantity: number
  unit: string
  confidence: number          // 0–100
  source: string              // filename
  normalized?: boolean
  normalizedDescription?: string
  normalizedQuantity?: number
  normalizedUnit?: string
}

export interface CostMatch {
  takeoffItemId: string
  source: CostSource
  code: string
  description: string
  unit: string
  unitCost: number
  score: number               // 0–100
  selected: boolean
  overrideUnitCost?: number
}

export interface ContractClause {
  id: string
  severity: ClauseSeverity
  type: string
  excerpt: string
  explanation: string
  recommendation: string
}

export interface BDIConfig {
  adminCentral: number
  iss: number
  pisCofins: number
  seguro: number
  lucro: number
}

export interface AnalysisSession {
  id: string
  createdAt: string
  fileNames: string[]
  totalItems: number
  totalCost: number
  status: PipelineStep
}

export interface SinapiEntry {
  code: string
  description: string
  unit: string
  unitCost: number
  category: string
  state: string
  referenceDate: string
}
