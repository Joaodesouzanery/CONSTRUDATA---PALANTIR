import { createClient } from '@supabase/supabase-js'
import {
  CONTAGEM_CASOS_SINTETICOS_PADRAO,
  SEED_SINTETICA_PADRAO,
  gerarDatasetComprasConstrucao,
  type DefinicaoProcesso,
  type EventoProcesso,
} from '../src/features/processos/core/index.ts'

interface ArgumentosSeed {
  apply: boolean
  organizationId?: string
  environment?: 'demo' | 'staging'
  seed: string
  caseCount: number
  help: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BATCH_SIZE = 500

function usage() {
  return `Usage:
  npm run seed:processos
  npm run seed:processos -- --seed 20260813 --cases 12483
  npm run seed:processos -- --apply --environment demo --organization <uuid>

Dry-run is the default. --apply requires SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY. VITE_* credentials are never read.`
}

function parseArguments(argv: string[]): ArgumentosSeed {
  const parsed: ArgumentosSeed = {
    apply: false,
    seed: SEED_SINTETICA_PADRAO,
    caseCount: CONTAGEM_CASOS_SINTETICOS_PADRAO,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') parsed.apply = true
    else if (argument === '--help' || argument === '-h') parsed.help = true
    else if (argument === '--organization') parsed.organizationId = argv[index += 1]
    else if (argument === '--environment') {
      const environment = argv[index += 1]
      if (environment !== 'demo' && environment !== 'staging') {
        throw new Error('--environment aceita somente demo ou staging; production é proibido.')
      }
      parsed.environment = environment
    }
    else if (argument === '--seed') parsed.seed = argv[index += 1] ?? ''
    else if (argument === '--cases') parsed.caseCount = Number(argv[index += 1])
    else throw new Error(`Unknown argument: ${argument}`)
  }

  if (!Number.isInteger(parsed.caseCount) || parsed.caseCount < 1) {
    throw new Error('--cases must be a positive integer.')
  }
  if (!parsed.seed) throw new Error('--seed cannot be blank.')
  if (parsed.apply && (!parsed.organizationId || !UUID_PATTERN.test(parsed.organizationId))) {
    throw new Error('--apply requires --organization with a valid UUID.')
  }
  if (parsed.apply && !parsed.environment) {
    throw new Error('--apply exige --environment demo ou staging. Produção é proibida.')
  }
  return parsed
}

function definitionRow(definition: DefinicaoProcesso) {
  return {
    id: definition.id,
    organization_id: definition.organizationId,
    process_key: definition.processKey,
    version: definition.version,
    name: definition.name,
    description: definition.description,
    timezone: definition.timezone,
    case_object_type: definition.caseObjectType,
    source_mappings: definition.sourceMappings,
    feature_mappings: definition.featureMappings,
    process_model: definition.processModel,
    objective: definition.objective,
    kpi_definitions: definition.kpiDefinitions,
    sla_definitions: definition.slaDefinitions,
  }
}

function eventRow(event: EventoProcesso) {
  return {
    event_id: event.eventId,
    event_schema_version: event.eventSchemaVersion,
    organization_id: event.organizationId,
    process_definition_id: event.processDefinitionId,
    case_id: event.caseId,
    activity: event.activity,
    lifecycle: event.lifecycle,
    occurred_at: event.occurredAt,
    sequence_number: event.sequenceNumber,
    actor_id: event.actorId,
    object_type: event.objectType,
    object_id: event.objectId,
    source_system: event.sourceSystem,
    source_event_id: event.sourceEventId,
    metadata: event.metadata,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }

  const dataset = gerarDatasetComprasConstrucao({
    seed: args.seed,
    caseCount: args.caseCount,
    organizationId: args.organizationId,
  })

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    organizationId: dataset.definition.organizationId,
    processDefinitionId: dataset.definition.id,
    ...dataset.groundTruth,
  }, null, 2))

  if (!args.apply) {
    console.log('\nDry-run complete. No database writes were attempted.')
    return
  }

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required with --apply.')
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: definitionError } = await supabase
    .from('process_definitions')
    .upsert(definitionRow(dataset.definition), {
      onConflict: 'organization_id,process_key,version',
    })
  if (definitionError) throw definitionError

  for (let offset = 0; offset < dataset.events.length; offset += BATCH_SIZE) {
    const batch = dataset.events.slice(offset, offset + BATCH_SIZE).map(eventRow)
    const { error } = await supabase
      .from('process_events')
      .upsert(batch, {
        onConflict: 'organization_id,source_system,source_event_id',
        ignoreDuplicates: true,
      })
    if (error) throw error
    console.log(`Inserted or confirmed ${Math.min(offset + batch.length, dataset.events.length)}/${dataset.events.length} events.`)
  }

  console.log('Seed do módulo Processos aplicado com sucesso.')
}

main().catch((error: unknown) => {
  console.error(`[processos-seed] ${errorMessage(error)}`)
  process.exitCode = 1
})
