export type PrimitivoJson = string | number | boolean | null
export type ValorJson = PrimitivoJson | ObjetoJson | ValorJson[]
export interface ObjetoJson { [key: string]: ValorJson }

export const CICLOS_VIDA_PROCESSO = [
  'started',
  'completed',
  'approved',
  'cancelled',
  'reopened',
] as const

export type CicloVidaProcesso = (typeof CICLOS_VIDA_PROCESSO)[number]
export type TipoMetrica = 'duration' | 'count' | 'rate' | 'percentage'
export type UnidadeMetrica = 'minutes' | 'hours' | 'days' | 'count' | 'percentage'
export type TipoCaracteristica = 'number' | 'string' | 'boolean' | 'timestamp'

export interface SeletorAtividadeLifecycle {
  activity: string
  lifecycle?: CicloVidaProcesso
}

export interface DefinicaoMetricaProcesso {
  key: string
  label: string
  metricType: TipoMetrica
  from: SeletorAtividadeLifecycle
  to: SeletorAtividadeLifecycle
  target: number
  warningThreshold: number
  criticalThreshold: number
  unit: UnidadeMetrica
}

export interface DefinicoesMetricasVersionadas {
  schemaVersion: 1
  definitions: DefinicaoMetricaProcesso[]
}

export interface MapeamentoCaracteristica {
  path: `$.${string}`
  type: TipoCaracteristica
  unit?: string
}

export type MapeamentoCaracteristicas = Record<string, MapeamentoCaracteristica>

export interface MapeamentosOrigem {
  caseId: string
  activity: string
  timestamp: string
  actorId?: string
  lifecycle?: string
  objectType?: string
  objectId?: string
}

export interface DefinicaoCaminhoProcesso {
  key: string
  label: string
  states: string[]
}

export interface TransicaoProibida {
  from: string
  to: string
}

export interface GrupoConcorrencia {
  key: string
  activities: string[]
  join: 'all' | 'any'
}

export interface ModeloProcesso {
  schemaVersion: 1
  allowedPaths: DefinicaoCaminhoProcesso[]
  requiredStates: string[]
  optionalStates: string[]
  forbiddenTransitions: TransicaoProibida[]
  startStates: string[]
  endStates: string[]
  concurrencyGroups: GrupoConcorrencia[]
}

export interface DefinicaoProcesso {
  id: string
  organizationId: string
  processKey: string
  version: number
  name: string
  description: string
  timezone: string
  caseObjectType: string
  sourceMappings: MapeamentosOrigem
  featureMappings: MapeamentoCaracteristicas
  processModel: ModeloProcesso
  objective: ObjetoJson
  kpiDefinitions: DefinicoesMetricasVersionadas
  slaDefinitions: DefinicoesMetricasVersionadas
}

export interface MetadadosRegistroOrigem extends ObjetoJson {
  type: string
  id: string
}

export interface MetadadosEventoProcesso extends ObjetoJson {
  schema_version: number
  amount: number
  currency: string
  department_id: string
  supplier_id: string
  supplier_age_days: number
  material_category: string
  site_id: string
  source_record: MetadadosRegistroOrigem
}

export interface EventoProcesso {
  eventId: string
  eventSchemaVersion: number
  organizationId: string
  processDefinitionId: string
  caseId: string
  activity: string
  lifecycle: CicloVidaProcesso | null
  occurredAt: string
  sequenceNumber: number | null
  actorId: string | null
  objectType: string | null
  objectId: string | null
  sourceSystem: string
  sourceEventId: string
  metadata: MetadadosEventoProcesso
  /** Filled by persistence adapters; omitted by pure synthetic generation. */
  ingestedAt?: string
}

export interface DistribuicaoDuracao {
  queueMedianHours: number
  queueSigma: number
  processingMedianHours: number
  processingSigma: number
}

export interface QuantisDuracao {
  count: number
  mean: number
  p50: number
  p75: number
  p90: number
}

export interface ResumoDuracaoEtapa {
  baseQueue: QuantisDuracao
  observedQueue: QuantisDuracao
  processing: QuantisDuracao
}

export type RotaSintetica = 'standard' | 'emergency' | 'cancelled' | 'forbidden_skip_approval'
export type RetrabalhoSintetico = 'approval_review' | 'purchase_approval' | 'delivery_purchase'

export interface VerdadeBaseSintetica {
  seed: string
  caseCount: number
  eventCount: number
  checksum: string
  routeCounts: Record<RotaSintetica, number>
  reworkCounts: Record<RetrabalhoSintetico, number>
  featureCounts: {
    newSupplier: number
    highAmount: number
    infrastructureDepartment: number
    hydraulicMaterial: number
    approvalInteraction: number
  }
  effectsHours: {
    newSupplierApprovalQueue: 18
    highAmountApprovalQueue: 12
    infrastructureReviewQueue: 8
    hydraulicDeliveryQueue: 6
    approvalInteractionQueue: 36
  }
  distributions: Record<string, DistribuicaoDuracao>
  realizedDurations: Record<string, ResumoDuracaoEtapa>
}

export interface OpcoesDatasetSintetico {
  seed?: string | number
  caseCount?: number
  startAt?: string
  timezone?: string
  organizationId?: string
  processDefinitionId?: string
}

export interface DatasetSintetico {
  definition: DefinicaoProcesso
  events: EventoProcesso[]
  groundTruth: VerdadeBaseSintetica
}

export interface ResumoEntradaDescoberta {
  organizationId: string
  processDefinitionId: string
  definitionVersion: number
  eventCount: number
  caseCount: number
  inputChecksum: string
}

export interface NoProcesso {
  key: string
  activity: string
  occurrenceCount: number
  caseCount: number
  startCount: number
  endCount: number
}

export interface ArestaProcesso {
  key: string
  from: string
  to: string
  occurrenceCount: number
  caseCount: number
  isLoop: boolean
  isForbidden: boolean
}

export interface VarianteProcesso {
  key: string
  activities: string[]
  caseCount: number
  eventCount: number
  percentage: number
}

export interface EvidenciaAgregada {
  key: string
  occurrenceCount: number
  caseCount: number
  exampleCaseIds: string[]
}

export interface LoopObservado extends EvidenciaAgregada {
  from: string
  to: string
}

export interface RegraRetrabalho {
  key: string
  label: string
  from: string
  to: string
}

export interface RetrabalhoObservado extends EvidenciaAgregada {
  ruleKey: string
  label: string
  from: string
  to: string
}

export interface AtividadeRepetida extends EvidenciaAgregada {
  activity: string
}

export interface TransicaoProibidaObservada extends EvidenciaAgregada {
  from: string
  to: string
}

export type TipoLifecycleIncompleto =
  | 'started_without_terminal'
  | 'terminal_without_started'
  | 'missing_lifecycle'

export interface LifecycleIncompleto extends EvidenciaAgregada {
  activity: string
  kind: TipoLifecycleIncompleto
}

export interface OrdenacaoAmbigua extends EvidenciaAgregada {
  firstActivity: string
  secondActivity: string
  occurredAt: string
}

export interface ConcorrenciaPossivel extends EvidenciaAgregada {
  firstActivity: string
  secondActivity: string
}

export interface OcorrenciaAtividade {
  activity: string
  occurrenceIndex: number
  startedAt: string
  endedAt: string | null
  startedEventId: string | null
  terminalEventId: string | null
  terminalLifecycle: CicloVidaProcesso | null
}

export interface ResumoCasoProcesso {
  organizationId: string
  processDefinitionId: string
  caseId: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  eventCount: number
  activityCount: number
  variantKey: string
  hasLoop: boolean
  hasRework: boolean
  hasDeviation: boolean
  hasAnomaly: boolean
  hasPossibleConcurrency: boolean
  terminalLifecycle: CicloVidaProcesso | null
  metadataSummary: ObjetoJson
}

export interface ParametrosDescoberta {
  reworkRules: RegraRetrabalho[]
  maxExampleCaseIds: number
}

export interface ResultadoDescoberta {
  schemaVersion: 1
  algorithmKey: string
  algorithmVersion: string
  input: ResumoEntradaDescoberta
  nodes: NoProcesso[]
  edges: ArestaProcesso[]
  paths: VarianteProcesso[]
  loops: LoopObservado[]
  rework: RetrabalhoObservado[]
  repeatedActivities: AtividadeRepetida[]
  forbiddenTransitions: TransicaoProibidaObservada[]
  incompleteLifecycles: LifecycleIncompleto[]
  ambiguousOrderings: OrdenacaoAmbigua[]
  possibleConcurrency: ConcorrenciaPossivel[]
  metrics: Record<string, never>
  bottlenecks: never[]
}

export interface ResultadoCasoDescoberto {
  summary: ResumoCasoProcesso
  occurrences: OcorrenciaAtividade[]
}
