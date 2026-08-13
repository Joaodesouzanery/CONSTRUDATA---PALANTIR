import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  CONTAGEM_CASOS_SINTETICOS_PADRAO,
  CHECKSUM_SINTETICO_PADRAO,
  ORGANIZACAO_SINTETICA_PADRAO_ID,
  calcularChecksumDatasetSintetico,
  type SeletorAtividadeLifecycle,
  type MapeamentoCaracteristica,
  type DefinicaoProcesso,
  type EventoProcesso,
  type MetadadosEventoProcesso,
  type DefinicaoMetricaProcesso,
  type DefinicaoCaminhoProcesso,
  type DefinicoesMetricasVersionadas,
} from '../src/features/processos/core/index.ts'

const PAGE_SIZE = 1_000
const EXPECTED_EVENT_COUNT = 153_290
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface DefinitionRow {
  id: string
  organization_id: string
  process_key: string
  version: number
  name: string
  description: string
  timezone: string
  case_object_type: string
  source_mappings: DefinicaoProcesso['sourceMappings']
  feature_mappings: DefinicaoProcesso['featureMappings']
  process_model: DefinicaoProcesso['processModel']
  objective: DefinicaoProcesso['objective']
  kpi_definitions: DefinicoesMetricasVersionadas
  sla_definitions: DefinicoesMetricasVersionadas
}

interface EventRow {
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
}

function readOrganizationId(argv: string[]): string {
  const index = argv.indexOf('--organization')
  const organizationId = index === -1
    ? ORGANIZACAO_SINTETICA_PADRAO_ID
    : argv[index + 1]
  if (!organizationId || !UUID_PATTERN.test(organizationId)) {
    throw new Error('--organization must be followed by a valid UUID.')
  }
  return organizationId
}

function normalizeSelector(selector: SeletorAtividadeLifecycle): SeletorAtividadeLifecycle {
  return selector.lifecycle
    ? { activity: selector.activity, lifecycle: selector.lifecycle }
    : { activity: selector.activity }
}

function normalizeMetric(metric: DefinicaoMetricaProcesso): DefinicaoMetricaProcesso {
  return {
    key: metric.key,
    label: metric.label,
    metricType: metric.metricType,
    from: normalizeSelector(metric.from),
    to: normalizeSelector(metric.to),
    target: metric.target,
    warningThreshold: metric.warningThreshold,
    criticalThreshold: metric.criticalThreshold,
    unit: metric.unit,
  }
}

function normalizeMetrics(collection: DefinicoesMetricasVersionadas): DefinicoesMetricasVersionadas {
  return {
    schemaVersion: 1,
    definitions: collection.definitions.map(normalizeMetric),
  }
}

function normalizeFeature(mapping: MapeamentoCaracteristica): MapeamentoCaracteristica {
  return mapping.unit
    ? { path: mapping.path, type: mapping.type, unit: mapping.unit }
    : { path: mapping.path, type: mapping.type }
}

function normalizePath(path: DefinicaoCaminhoProcesso): DefinicaoCaminhoProcesso {
  return { key: path.key, label: path.label, states: [...path.states] }
}

function normalizeDefinition(row: DefinitionRow): DefinicaoProcesso {
  const source = row.source_mappings
  const features = row.feature_mappings
  const model = row.process_model
  return {
    id: row.id,
    organizationId: row.organization_id,
    processKey: row.process_key,
    version: row.version,
    name: row.name,
    description: row.description,
    timezone: row.timezone,
    caseObjectType: row.case_object_type,
    sourceMappings: {
      caseId: source.caseId,
      activity: source.activity,
      timestamp: source.timestamp,
      ...(source.actorId ? { actorId: source.actorId } : {}),
      ...(source.lifecycle ? { lifecycle: source.lifecycle } : {}),
      ...(source.objectType ? { objectType: source.objectType } : {}),
      ...(source.objectId ? { objectId: source.objectId } : {}),
    },
    featureMappings: {
      amount: normalizeFeature(features.amount!),
      department: normalizeFeature(features.department!),
      supplier: normalizeFeature(features.supplier!),
      supplier_age_days: normalizeFeature(features.supplier_age_days!),
      material_category: normalizeFeature(features.material_category!),
      site: normalizeFeature(features.site!),
    },
    processModel: {
      schemaVersion: 1,
      allowedPaths: model.allowedPaths.map(normalizePath),
      requiredStates: [...model.requiredStates],
      optionalStates: [...model.optionalStates],
      forbiddenTransitions: model.forbiddenTransitions.map(({ from, to }) => ({ from, to })),
      startStates: [...model.startStates],
      endStates: [...model.endStates],
      concurrencyGroups: model.concurrencyGroups.map(({ key, activities, join }) => ({
        key,
        activities: [...activities],
        join,
      })),
    },
    objective: {
      key: row.objective.key!,
      label: row.objective.label!,
    },
    kpiDefinitions: normalizeMetrics(row.kpi_definitions),
    slaDefinitions: normalizeMetrics(row.sla_definitions),
  }
}

function normalizeMetadata(metadata: MetadadosEventoProcesso): MetadadosEventoProcesso {
  return {
    schema_version: metadata.schema_version,
    amount: metadata.amount,
    currency: metadata.currency,
    department_id: metadata.department_id,
    supplier_id: metadata.supplier_id,
    supplier_age_days: metadata.supplier_age_days,
    material_category: metadata.material_category,
    site_id: metadata.site_id,
    source_record: {
      type: metadata.source_record.type,
      id: metadata.source_record.id,
    },
  }
}

function normalizeEvent(row: EventRow): EventoProcesso {
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
    metadata: normalizeMetadata(row.metadata),
  }
}

async function main() {
  const organizationId = readOrganizationId(process.argv.slice(2))
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: definitionRows, error: definitionError } = await supabase
    .from('process_definitions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('process_key', 'construction-procurement')
    .eq('version', 1)
  if (definitionError) throw definitionError
  assert.equal(definitionRows.length, 1, 'expected exactly one process definition')
  const definition = normalizeDefinition(definitionRows[0] as DefinitionRow)

  const events: EventoProcesso[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('process_events')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('process_definition_id', definition.id)
      .order('case_id', { ascending: true })
      .order('sequence_number', { ascending: true, nullsFirst: false })
      .order('event_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    events.push(...data.map((row) => normalizeEvent(row as EventRow)))
    if (data.length < PAGE_SIZE) break
  }

  const caseCount = new Set(events.map(({ caseId }) => caseId)).size
  const eventIds = new Set(events.map(({ eventId }) => eventId))
  const lineage = new Set(events.map(({ sourceSystem, sourceEventId }) => (
    `${organizationId}:${sourceSystem}:${sourceEventId}`
  )))
  const checksum = calcularChecksumDatasetSintetico(definition, events)

  assert.equal(caseCount, CONTAGEM_CASOS_SINTETICOS_PADRAO, 'case count mismatch')
  assert.equal(events.length, EXPECTED_EVENT_COUNT, 'event count mismatch')
  assert.equal(eventIds.size, events.length, 'duplicate event IDs detected')
  assert.equal(lineage.size, events.length, 'duplicate source lineage detected')
  assert.equal(checksum, CHECKSUM_SINTETICO_PADRAO, 'persisted dataset checksum mismatch')

  console.log(JSON.stringify({
    organizationId,
    processDefinitionId: definition.id,
    processDefinitionCount: definitionRows.length,
    caseCount,
    eventCount: events.length,
    uniqueEventIds: eventIds.size,
    uniqueLineage: lineage.size,
    checksum,
    status: 'verified',
  }, null, 2))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[processos-verify] ${message}`)
  process.exitCode = 1
})
