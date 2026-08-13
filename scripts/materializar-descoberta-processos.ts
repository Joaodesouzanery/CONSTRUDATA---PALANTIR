import { createClient } from '@supabase/supabase-js'
import {
  AcumuladorDescoberta,
  CHAVE_ALGORITMO_DESCOBERTA,
  REGRAS_RETRABALHO_COMPRAS,
  VERSAO_ALGORITMO_DESCOBERTA,
  calcularChecksumTexto,
  linhaResumoCaso,
  normalizarDefinicaoProcesso,
  normalizarEventoProcesso,
  serializarJsonCanonico,
  type LinhaDefinicaoProcesso,
  type LinhaEventoProcesso,
  type ObjetoJson,
  type ParametrosDescoberta,
} from '../src/features/processos/core/index.ts'

interface ArgumentosMaterializacao {
  apply: boolean
  force: boolean
  organizationId?: string
  definitionId?: string
  constructionRework: boolean
  pageSize: number
  batchSize: number
  help: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uso() {
  return `Uso:
  npm run discover:processos -- --organization <uuid> --definition <uuid>
  npm run discover:processos -- --apply --organization <uuid> --definition <uuid>
  npm run discover:processos -- --apply --construction-rework --organization <uuid> --definition <uuid>

O padrão é dry-run. --apply exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
--force apaga e reconstrói somente uma materialização derivada idêntica.`
}

function lerArgumentos(argv: string[]): ArgumentosMaterializacao {
  const parsed: ArgumentosMaterializacao = {
    apply: false,
    force: false,
    constructionRework: false,
    pageSize: 1_000,
    batchSize: 500,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') parsed.apply = true
    else if (argument === '--force') parsed.force = true
    else if (argument === '--construction-rework') parsed.constructionRework = true
    else if (argument === '--organization') parsed.organizationId = argv[index += 1]
    else if (argument === '--definition') parsed.definitionId = argv[index += 1]
    else if (argument === '--page-size') parsed.pageSize = Number(argv[index += 1])
    else if (argument === '--batch-size') parsed.batchSize = Number(argv[index += 1])
    else if (argument === '--help' || argument === '-h') parsed.help = true
    else throw new Error(`Argumento desconhecido: ${argument}`)
  }
  if (parsed.help) return parsed
  if (!parsed.organizationId || !UUID_PATTERN.test(parsed.organizationId)) {
    throw new Error('--organization deve conter um UUID explícito.')
  }
  if (!parsed.definitionId || !UUID_PATTERN.test(parsed.definitionId)) {
    throw new Error('--definition deve conter um UUID explícito.')
  }
  if (!Number.isInteger(parsed.pageSize) || parsed.pageSize < 100 || parsed.pageSize > 1_000) {
    throw new Error('--page-size deve estar entre 100 e 1000.')
  }
  if (!Number.isInteger(parsed.batchSize) || parsed.batchSize < 1 || parsed.batchSize > 1_000) {
    throw new Error('--batch-size deve estar entre 1 e 1000.')
  }
  if (parsed.force && !parsed.apply) throw new Error('--force só pode ser usado junto com --apply.')
  return parsed
}

function mensagemErro(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}

function codigoErro(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) return String(error.code)
  return 'DISCOVERY_FAILED'
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2))
  if (args.help) {
    console.log(uso())
    return
  }
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias, inclusive no dry-run.')
  }
  const organizationId = args.organizationId!
  const definitionId = args.definitionId!
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: definitionRow, error: definitionError } = await supabase
    .from('process_definitions')
    .select('id, organization_id, process_key, version, name, description, timezone, case_object_type, source_mappings, feature_mappings, process_model, objective, kpi_definitions, sla_definitions')
    .eq('organization_id', organizationId)
    .eq('id', definitionId)
    .single()
  if (definitionError) throw definitionError
  const definition = normalizarDefinicaoProcesso(definitionRow as LinhaDefinicaoProcesso)
  const parametros: ParametrosDescoberta = {
    reworkRules: args.constructionRework ? [...REGRAS_RETRABALHO_COMPRAS] : [],
    maxExampleCaseIds: 10,
  }
  const parameters = JSON.parse(serializarJsonCanonico(parametros)) as ObjetoJson
  const parametersChecksum = calcularChecksumTexto(serializarJsonCanonico(parameters))
  const startedAt = new Date().toISOString()
  const accumulator = new AcumuladorDescoberta(definition, parametros)
  let offset = 0
  let carry: LinhaEventoProcesso[] = []

  while (true) {
    const { data, error } = await supabase
      .from('process_events')
      .select('event_id, event_schema_version, organization_id, process_definition_id, case_id, activity, lifecycle, occurred_at, sequence_number, actor_id, object_type, object_id, source_system, source_event_id, metadata')
      .eq('organization_id', organizationId)
      .eq('process_definition_id', definitionId)
      .order('case_id', { ascending: true })
      .order('occurred_at', { ascending: true })
      .order('sequence_number', { ascending: true, nullsFirst: false })
      .order('event_id', { ascending: true })
      .range(offset, offset + args.pageSize - 1)
    if (error) throw error
    const page = data as LinhaEventoProcesso[]
    const combined = [...carry, ...page]
    carry = []
    if (combined.length > 0) {
      const lastCaseId = combined[combined.length - 1]!.case_id
      const completedRows = page.length < args.pageSize
        ? combined
        : combined.filter(({ case_id }) => case_id !== lastCaseId)
      carry = page.length < args.pageSize
        ? []
        : combined.filter(({ case_id }) => case_id === lastCaseId)
      let currentCaseId = ''
      let currentEvents: LinhaEventoProcesso[] = []
      for (const row of completedRows) {
        if (currentCaseId && row.case_id !== currentCaseId) {
          accumulator.processarCaso(currentEvents.map(normalizarEventoProcesso))
          currentEvents = []
        }
        currentCaseId = row.case_id
        currentEvents.push(row)
      }
      if (currentEvents.length > 0) accumulator.processarCaso(currentEvents.map(normalizarEventoProcesso))
    }
    if (page.length < args.pageSize) break
    offset += page.length
  }
  if (carry.length > 0) accumulator.processarCaso(carry.map(normalizarEventoProcesso))

  const result = accumulator.finalizar()
  const identity = {
    organizationId,
    processDefinitionId: definitionId,
    definitionVersion: definition.version,
    algorithmKey: CHAVE_ALGORITMO_DESCOBERTA,
    algorithmVersion: VERSAO_ALGORITMO_DESCOBERTA,
    inputChecksum: result.input.inputChecksum,
    parametersChecksum,
  }
  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    identity,
    eventCount: result.input.eventCount,
    caseCount: result.input.caseCount,
    nodes: result.nodes.length,
    edges: result.edges.length,
    variants: result.paths.length,
    anomalies: {
      loops: result.loops.length,
      rework: result.rework.length,
      repeatedActivities: result.repeatedActivities.length,
      forbiddenTransitions: result.forbiddenTransitions.length,
      incompleteLifecycles: result.incompleteLifecycles.length,
      ambiguousOrderings: result.ambiguousOrderings.length,
      possibleConcurrency: result.possibleConcurrency.length,
    },
  }, null, 2))
  if (!args.apply) {
    console.log('Dry-run concluído. Nenhuma escrita foi executada.')
    return
  }

  const existingQuery = supabase
    .from('process_discovery_snapshots')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('process_definition_id', definitionId)
    .eq('definition_version', definition.version)
    .eq('algorithm_key', CHAVE_ALGORITMO_DESCOBERTA)
    .eq('algorithm_version', VERSAO_ALGORITMO_DESCOBERTA)
    .eq('input_checksum', result.input.inputChecksum)
    .eq('parameters_checksum', parametersChecksum)
    .maybeSingle()
  const { data: existing, error: existingError } = await existingQuery
  if (existingError) throw existingError
  if (existing && !args.force) {
    console.log(`Materialização idêntica já existe (${existing.id}, status ${existing.status}). Nada foi recriado.`)
    return
  }
  if (existing && args.force) {
    const { error } = await supabase.from('process_discovery_snapshots').delete().eq('id', existing.id)
    if (error) throw error
  }

  let snapshotId: string | null = null
  try {
    const { data: inserted, error: insertError } = await supabase
      .from('process_discovery_snapshots')
      .insert({
        organization_id: organizationId,
        process_definition_id: definitionId,
        definition_version: definition.version,
        algorithm_key: CHAVE_ALGORITMO_DESCOBERTA,
        algorithm_version: VERSAO_ALGORITMO_DESCOBERTA,
        input_checksum: result.input.inputChecksum,
        parameters,
        parameters_checksum: parametersChecksum,
        status: 'building',
        result_schema_version: result.schemaVersion,
        result: null,
        input_event_count: result.input.eventCount,
        input_case_count: result.input.caseCount,
        started_at: startedAt,
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    snapshotId = String(inserted.id)

    for (let offset = 0; offset < accumulator.caseSummaries.length; offset += args.batchSize) {
      const rows = accumulator.caseSummaries
        .slice(offset, offset + args.batchSize)
        .map((summary) => linhaResumoCaso(summary, snapshotId!))
      const { error } = await supabase.from('process_case_summaries').insert(rows)
      if (error) throw error
    }
    const completedAt = new Date().toISOString()
    const { error: readyError } = await supabase
      .from('process_discovery_snapshots')
      .update({
        status: 'ready',
        result,
        completed_at: completedAt,
        generated_at: completedAt,
      })
      .eq('id', snapshotId)
      .eq('status', 'building')
    if (readyError) throw readyError
    console.log(`Snapshot ${snapshotId} materializado como ready.`)
  } catch (error) {
    if (snapshotId) {
      await supabase
        .from('process_discovery_snapshots')
        .update({
          status: 'failed',
          result: null,
          completed_at: new Date().toISOString(),
          generated_at: null,
          error_code: codigoErro(error).slice(0, 120),
          error_message: mensagemErro(error).slice(0, 2_000),
        })
        .eq('id', snapshotId)
        .eq('status', 'building')
    }
    throw error
  }
}

main().catch((error: unknown) => {
  console.error(`[processos-discovery] ${mensagemErro(error)}`)
  process.exitCode = 1
})
