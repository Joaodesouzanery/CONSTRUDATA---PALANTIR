import type {
  DefinicaoProcesso,
  DefinicoesMetricasVersionadas,
  EventoProcesso,
  MetadadosEventoProcesso,
  MapeamentoCaracteristicas,
  MapeamentosOrigem,
  ModeloProcesso,
  ObjetoJson,
  ResultadoDescoberta,
  ResumoCasoProcesso,
} from './tipos.ts'

export interface LinhaDefinicaoProcesso {
  id: string
  organization_id: string
  process_key: string
  version: number
  name: string
  description: string
  timezone: string
  case_object_type: string
  source_mappings: MapeamentosOrigem
  feature_mappings: MapeamentoCaracteristicas
  process_model: ModeloProcesso
  objective: ObjetoJson
  kpi_definitions: DefinicoesMetricasVersionadas
  sla_definitions: DefinicoesMetricasVersionadas
}

export interface LinhaEventoProcesso {
  event_id: string
  event_schema_version: number
  organization_id: string
  process_definition_id: string
  case_id: string
  activity: string
  lifecycle: EventoProcesso['lifecycle']
  occurred_at: string
  sequence_number: number | null
  actor_id: string | null
  object_type: string | null
  object_id: string | null
  source_system: string
  source_event_id: string
  metadata: MetadadosEventoProcesso
  ingested_at?: string
}

export interface LinhaSnapshotDescoberta {
  id: string
  organization_id: string
  process_definition_id: string
  definition_version: number
  algorithm_key: string
  algorithm_version: string
  input_checksum: string
  parameters: ObjetoJson
  parameters_checksum: string
  status: 'building' | 'ready' | 'failed'
  result_schema_version: number
  result: ResultadoDescoberta | null
  input_event_count: number
  input_case_count: number
  started_at: string
  completed_at: string | null
  generated_at: string | null
  error_code: string | null
  error_message: string | null
}

export interface LinhaResumoCaso {
  organization_id: string
  process_definition_id: string
  snapshot_id: string
  case_id: string
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  event_count: number
  activity_count: number
  variant_key: string
  has_loop: boolean
  has_rework: boolean
  has_deviation: boolean
  has_anomaly: boolean
  has_possible_concurrency: boolean
  terminal_lifecycle: EventoProcesso['lifecycle']
  metadata_schema_version: number
  metadata_summary: ObjetoJson
}

export function normalizarDefinicaoProcesso(row: LinhaDefinicaoProcesso): DefinicaoProcesso {
  return {
    id: row.id,
    organizationId: row.organization_id,
    processKey: row.process_key,
    version: row.version,
    name: row.name,
    description: row.description,
    timezone: row.timezone,
    caseObjectType: row.case_object_type,
    sourceMappings: row.source_mappings,
    featureMappings: row.feature_mappings,
    processModel: row.process_model,
    objective: row.objective,
    kpiDefinitions: row.kpi_definitions,
    slaDefinitions: row.sla_definitions,
  }
}

export function normalizarEventoProcesso(row: LinhaEventoProcesso): EventoProcesso {
  return {
    eventId: row.event_id,
    eventSchemaVersion: row.event_schema_version,
    organizationId: row.organization_id,
    processDefinitionId: row.process_definition_id,
    caseId: row.case_id,
    activity: row.activity,
    lifecycle: row.lifecycle,
    occurredAt: new Date(row.occurred_at).toISOString(),
    sequenceNumber: row.sequence_number,
    actorId: row.actor_id,
    objectType: row.object_type,
    objectId: row.object_id,
    sourceSystem: row.source_system,
    sourceEventId: row.source_event_id,
    metadata: row.metadata,
    ...(row.ingested_at ? { ingestedAt: new Date(row.ingested_at).toISOString() } : {}),
  }
}

export function linhaResumoCaso(summary: ResumoCasoProcesso, snapshotId: string): LinhaResumoCaso {
  return {
    organization_id: summary.organizationId,
    process_definition_id: summary.processDefinitionId,
    snapshot_id: snapshotId,
    case_id: summary.caseId,
    started_at: summary.startedAt,
    ended_at: summary.endedAt,
    duration_ms: summary.durationMs,
    event_count: summary.eventCount,
    activity_count: summary.activityCount,
    variant_key: summary.variantKey,
    has_loop: summary.hasLoop,
    has_rework: summary.hasRework,
    has_deviation: summary.hasDeviation,
    has_anomaly: summary.hasAnomaly,
    has_possible_concurrency: summary.hasPossibleConcurrency,
    terminal_lifecycle: summary.terminalLifecycle,
    metadata_schema_version: 1,
    metadata_summary: summary.metadataSummary,
  }
}
