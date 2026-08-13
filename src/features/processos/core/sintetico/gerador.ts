import type {
  DistribuicaoDuracao,
  QuantisDuracao,
  DefinicaoProcesso,
  EventoProcesso,
  MetadadosEventoProcesso,
  CicloVidaProcesso,
  ResumoDuracaoEtapa,
  DatasetSintetico,
  OpcoesDatasetSintetico,
  RetrabalhoSintetico,
  RotaSintetica,
} from '../tipos.ts'

export const SEED_SINTETICA_PADRAO = '20260813'
export const CONTAGEM_CASOS_SINTETICOS_PADRAO = 12_483
export const INICIO_SINTETICO_PADRAO = '2026-01-01T08:00:00.000Z'
export const FUSO_SINTETICO_PADRAO = 'America/Sao_Paulo'
export const ORGANIZACAO_SINTETICA_PADRAO_ID = '00000000-0000-4000-8000-000000000001'
export const SISTEMA_ORIGEM_SINTETICO = 'synthetic_construction_procurement_v1'
export const CHECKSUM_SINTETICO_PADRAO = 'fnv1a64:0e385132416e749b'

export const DISTRIBUICOES_DURACAO_SINTETICAS: Record<string, DistribuicaoDuracao> = {
  'Material Request': { queueMedianHours: 0, queueSigma: 0, processingMedianHours: 0.5, processingSigma: 0.25 },
  Review: { queueMedianHours: 4, queueSigma: 0.45, processingMedianHours: 2, processingSigma: 0.35 },
  Approval: { queueMedianHours: 12, queueSigma: 0.60, processingMedianHours: 1.5, processingSigma: 0.35 },
  'Emergency Approval': { queueMedianHours: 3, queueSigma: 0.40, processingMedianHours: 0.75, processingSigma: 0.30 },
  Purchase: { queueMedianHours: 6, queueSigma: 0.45, processingMedianHours: 3, processingSigma: 0.35 },
  Delivery: { queueMedianHours: 72, queueSigma: 0.40, processingMedianHours: 1, processingSigma: 0.25 },
  Consumption: { queueMedianHours: 24, queueSigma: 0.50, processingMedianHours: 0.5, processingSigma: 0.25 },
}

interface RandomSource {
  next: () => number
  normal: () => number
}

interface MutableDurationSamples {
  baseQueue: number[]
  observedQueue: number[]
  processing: number[]
}

interface CaseFeatures {
  amount: number
  departmentId: string
  supplierId: string
  supplierAgeDays: number
  materialCategory: string
  siteId: string
}

function xmur3(value: string) {
  let hash = 1779033703 ^ value.length
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    return (hash ^= hash >>> 16) >>> 0
  }
}

function createRandom(seed: string): RandomSource {
  const seedFactory = xmur3(seed)
  let state = seedFactory()
  let spare: number | null = null

  const next = () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }

  const normal = () => {
    if (spare !== null) {
      const value = spare
      spare = null
      return value
    }
    const u = Math.max(next(), Number.EPSILON)
    const v = next()
    const magnitude = Math.sqrt(-2 * Math.log(u))
    const angle = 2 * Math.PI * v
    spare = magnitude * Math.sin(angle)
    return magnitude * Math.cos(angle)
  }

  return { next, normal }
}

function cyrb128(value: string): [number, number, number, number] {
  let first = 1779033703
  let second = 3144134277
  let third = 1013904242
  let fourth = 2773480762
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = second ^ Math.imul(first ^ code, 597399067)
    second = third ^ Math.imul(second ^ code, 2869860233)
    third = fourth ^ Math.imul(third ^ code, 951274213)
    fourth = first ^ Math.imul(fourth ^ code, 2716044179)
  }
  first = Math.imul(third ^ (first >>> 18), 597399067)
  second = Math.imul(fourth ^ (second >>> 22), 2869860233)
  third = Math.imul(first ^ (third >>> 17), 951274213)
  fourth = Math.imul(second ^ (fourth >>> 19), 2716044179)
  return [
    (first ^ second ^ third ^ fourth) >>> 0,
    (second ^ first) >>> 0,
    (third ^ first) >>> 0,
    (fourth ^ first) >>> 0,
  ]
}

function deterministicUuid(value: string): string {
  const words = cyrb128(value)
  const bytes: number[] = []
  for (const word of words) {
    bytes.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff)
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function shuffled(values: number[], random: RandomSource): number[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swapIndex] ?? copy[index]!
    copy[swapIndex] = current!
  }
  return copy
}

function sampleLognormal(random: RandomSource, median: number, sigma: number): number {
  if (median === 0) return 0
  return median * Math.exp(sigma * random.normal())
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function quantile(sorted: number[], probability: number): number {
  if (sorted.length === 0) return 0
  const position = (sorted.length - 1) * probability
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower] ?? 0
  const fraction = position - lower
  return (sorted[lower] ?? 0) * (1 - fraction) + (sorted[upper] ?? 0) * fraction
}

function summarize(values: number[]): QuantisDuracao {
  const sorted = [...values].sort((left, right) => left - right)
  const mean = sorted.length === 0 ? 0 : sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  return {
    count: sorted.length,
    mean: round(mean),
    p50: round(quantile(sorted, 0.5)),
    p75: round(quantile(sorted, 0.75)),
    p90: round(quantile(sorted, 0.9)),
  }
}

function ensureDurationSamples(
  samples: Record<string, MutableDurationSamples>,
  activity: string,
): MutableDurationSamples {
  const existing = samples[activity]
  if (existing) return existing
  const created = { baseQueue: [], observedQueue: [], processing: [] }
  samples[activity] = created
  return created
}

function addHours(timestamp: number, hours: number): number {
  return timestamp + hours * 60 * 60 * 1_000
}

function expectedCount(caseCount: number, rate: number): number {
  return Math.round(caseCount * rate)
}

function validateOptions(options: OpcoesDatasetSintetico) {
  const caseCount = options.caseCount ?? CONTAGEM_CASOS_SINTETICOS_PADRAO
  if (!Number.isInteger(caseCount) || caseCount < 1) {
    throw new Error('caseCount must be a positive integer.')
  }
  const startAt = options.startAt ?? INICIO_SINTETICO_PADRAO
  if (!Number.isFinite(Date.parse(startAt))) throw new Error('startAt must be a valid ISO timestamp.')
  const timezone = options.timezone ?? FUSO_SINTETICO_PADRAO
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(startAt))
  } catch {
    throw new Error(`timezone must be a valid IANA timezone: ${timezone}`)
  }
}

function createDefinicaoProcesso(
  organizationId: string,
  processDefinitionId: string,
  timezone: string,
): DefinicaoProcesso {
  return {
    id: processDefinitionId,
    organizationId,
    processKey: 'construction-procurement',
    version: 1,
    name: 'Compras de obra',
    description: 'Processo sintético de solicitação, aprovação, compra, entrega e consumo de materiais.',
    timezone,
    caseObjectType: 'ProcurementCase',
    sourceMappings: {
      caseId: '$.case_id',
      activity: '$.activity',
      timestamp: '$.occurred_at',
      actorId: '$.actor_id',
      lifecycle: '$.lifecycle',
      objectType: '$.object_type',
      objectId: '$.object_id',
    },
    featureMappings: {
      amount: { path: '$.amount', type: 'number', unit: 'BRL' },
      department: { path: '$.department_id', type: 'string' },
      supplier: { path: '$.supplier_id', type: 'string' },
      supplier_age_days: { path: '$.supplier_age_days', type: 'number', unit: 'days' },
      material_category: { path: '$.material_category', type: 'string' },
      site: { path: '$.site_id', type: 'string' },
    },
    processModel: {
      schemaVersion: 1,
      allowedPaths: [
        {
          key: 'standard',
          label: 'Fluxo padrão',
          states: ['Material Request.completed', 'Review.completed', 'Approval.approved', 'Purchase.completed', 'Delivery.completed', 'Consumption.completed'],
        },
        {
          key: 'emergency',
          label: 'Fluxo emergencial',
          states: ['Material Request.completed', 'Emergency Approval.approved', 'Purchase.completed', 'Delivery.completed', 'Consumption.completed'],
        },
        {
          key: 'cancelled',
          label: 'Cancelamento durante aprovação',
          states: ['Material Request.completed', 'Review.completed', 'Approval.cancelled'],
        },
      ],
      requiredStates: ['Material Request.completed'],
      optionalStates: ['Review.completed', 'Approval.approved', 'Emergency Approval.approved', 'Consumption.completed'],
      forbiddenTransitions: [{ from: 'Review.completed', to: 'Purchase.started' }],
      startStates: ['Material Request.started'],
      endStates: ['Consumption.completed', 'Approval.cancelled'],
      concurrencyGroups: [],
    },
    objective: {
      key: 'reduce_procurement_lead_time',
      label: 'Reduzir o lead time de compras sem comprometer conformidade',
    },
    kpiDefinitions: {
      schemaVersion: 1,
      definitions: [
        {
          key: 'approval_time',
          label: 'Tempo de aprovação',
          metricType: 'duration',
          from: { activity: 'Approval', lifecycle: 'started' },
          to: { activity: 'Approval', lifecycle: 'approved' },
          target: 24,
          warningThreshold: 30,
          criticalThreshold: 48,
          unit: 'hours',
        },
        {
          key: 'case_lead_time',
          label: 'Lead time do caso',
          metricType: 'duration',
          from: { activity: 'Material Request', lifecycle: 'started' },
          to: { activity: 'Consumption', lifecycle: 'completed' },
          target: 168,
          warningThreshold: 216,
          criticalThreshold: 288,
          unit: 'hours',
        },
      ],
    },
    slaDefinitions: {
      schemaVersion: 1,
      definitions: [
        {
          key: 'approval_sla',
          label: 'SLA de aprovação',
          metricType: 'duration',
          from: { activity: 'Approval', lifecycle: 'started' },
          to: { activity: 'Approval', lifecycle: 'approved' },
          target: 24,
          warningThreshold: 36,
          criticalThreshold: 48,
          unit: 'hours',
        },
      ],
    },
  }
}

function routeAndReworkAssignments(caseCount: number, seed: string) {
  const caseIndexes = Array.from({ length: caseCount }, (_, index) => index)
  const routeOrder = shuffled(caseIndexes, createRandom(`${seed}:routes`))
  const cancelledCount = expectedCount(caseCount, 0.01)
  const forbiddenCount = expectedCount(caseCount, 0.02)
  const emergencyCount = expectedCount(caseCount, 0.05)
  let cursor = 0

  const cancelled = new Set(routeOrder.slice(cursor, cursor += cancelledCount))
  const forbidden = new Set(routeOrder.slice(cursor, cursor += forbiddenCount))
  const emergency = new Set(routeOrder.slice(cursor, cursor += emergencyCount))

  const routes = new Map<number, RotaSintetica>()
  for (const index of caseIndexes) {
    const route: RotaSintetica = cancelled.has(index)
      ? 'cancelled'
      : forbidden.has(index)
        ? 'forbidden_skip_approval'
        : emergency.has(index)
          ? 'emergency'
          : 'standard'
    routes.set(index, route)
  }

  const standardIndexes = caseIndexes.filter((index) => routes.get(index) === 'standard')
  const reworkOrder = shuffled(standardIndexes, createRandom(`${seed}:rework`))
  const approvalReviewCount = expectedCount(caseCount, 0.07)
  const purchaseApprovalCount = expectedCount(caseCount, 0.03)
  const deliveryPurchaseCount = expectedCount(caseCount, 0.02)
  cursor = 0
  const approvalReview = new Set(reworkOrder.slice(cursor, cursor += approvalReviewCount))
  const purchaseApproval = new Set(reworkOrder.slice(cursor, cursor += purchaseApprovalCount))
  const deliveryPurchase = new Set(reworkOrder.slice(cursor, cursor += deliveryPurchaseCount))
  const reworks = new Map<number, RetrabalhoSintetico>()
  for (const index of approvalReview) reworks.set(index, 'approval_review')
  for (const index of purchaseApproval) reworks.set(index, 'purchase_approval')
  for (const index of deliveryPurchase) reworks.set(index, 'delivery_purchase')

  return { routes, reworks }
}

function generateFeatures(seed: string, caseIndex: number): CaseFeatures {
  const random = createRandom(`${seed}:case:${caseIndex}:features`)
  const isNewSupplier = random.next() < 0.20
  const isHighAmount = random.next() < 0.30
  const amount = isHighAmount
    ? 50_001 + Math.floor(random.next() * 99_999)
    : 5_000 + Math.floor(random.next() * 45_001)
  const supplierAgeDays = isNewSupplier
    ? 1 + Math.floor(random.next() * 89)
    : 90 + Math.floor(random.next() * 1_911)
  const departmentRoll = random.next()
  const departmentId = departmentRoll < 0.25
    ? 'DEP-INFRASTRUCTURE'
    : departmentRoll < 0.55
      ? 'DEP-OPERATIONS'
      : departmentRoll < 0.80
        ? 'DEP-PROJECTS'
        : 'DEP-ADMINISTRATION'
  const materialRoll = random.next()
  const materialCategory = materialRoll < 0.25
    ? 'hydraulic'
    : materialRoll < 0.55
      ? 'structural'
      : materialRoll < 0.80
        ? 'electrical'
        : 'finishes'

  return {
    amount,
    departmentId,
    supplierId: `supplier:synthetic:${String(Math.floor(random.next() * 480) + 1).padStart(4, '0')}`,
    supplierAgeDays,
    materialCategory,
    siteId: `site:synthetic:${String(Math.floor(random.next() * 8) + 1).padStart(2, '0')}`,
  }
}

export function obterEfeitoFilaSinteticoHoras(activity: string, metadata: MetadadosEventoProcesso): number {
  let effect = 0
  if (activity === 'Review' && metadata.department_id === 'DEP-INFRASTRUCTURE') effect += 8
  if (activity === 'Delivery' && metadata.material_category === 'hydraulic') effect += 6
  if (activity === 'Approval') {
    const newSupplier = metadata.supplier_age_days < 90
    const highAmount = metadata.amount > 50_000
    const infrastructure = metadata.department_id === 'DEP-INFRASTRUCTURE'
    if (newSupplier) effect += 18
    if (highAmount) effect += 12
    if (newSupplier && highAmount && infrastructure) effect += 36
  }
  return effect
}

function objectForActivity(activity: string, caseNumber: string, features: CaseFeatures) {
  if (activity === 'Material Request' || activity === 'Review') {
    return { objectType: 'MaterialRequest', objectId: `material-request:synthetic:${caseNumber}` }
  }
  if (activity === 'Approval' || activity === 'Emergency Approval') {
    return { objectType: 'Approval', objectId: `approval:synthetic:${caseNumber}` }
  }
  if (activity === 'Purchase') {
    return { objectType: 'PurchaseOrder', objectId: `purchase-order:synthetic:${caseNumber}` }
  }
  if (activity === 'Delivery') {
    return { objectType: 'Delivery', objectId: `delivery:synthetic:${caseNumber}` }
  }
  return { objectType: 'MaterialLot', objectId: `material-lot:synthetic:${caseNumber}:${features.materialCategory}` }
}

function actorForActivity(activity: string, caseIndex: number): string {
  const pools: Record<string, number> = {
    'Material Request': 120,
    Review: 24,
    Approval: 12,
    'Emergency Approval': 5,
    Purchase: 18,
    Delivery: 32,
    Consumption: 80,
  }
  const size = pools[activity] ?? 10
  return `employee:synthetic:${activity.toLowerCase().replaceAll(' ', '-')}:${String((caseIndex % size) + 1).padStart(3, '0')}`
}

function updateChecksum(hash: number, value: string): number {
  let next = hash >>> 0
  for (let index = 0; index < value.length; index += 1) {
    next ^= value.charCodeAt(index)
    next = Math.imul(next, 16777619)
  }
  return next >>> 0
}

export function calcularChecksumDatasetSintetico(
  definition: DefinicaoProcesso,
  events: EventoProcesso[],
): string {
  let first = updateChecksum(2166136261, JSON.stringify(definition))
  let second = updateChecksum(2166136261 ^ 0x9e3779b9, JSON.stringify(definition))
  for (const event of events) {
    const serialized = JSON.stringify(event)
    first = updateChecksum(first, serialized)
    second = updateChecksum(second, serialized.split('').reverse().join(''))
  }
  return `fnv1a64:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
}

export function compararEventosProcesso(left: EventoProcesso, right: EventoProcesso): number {
  const timestampOrder = left.occurredAt.localeCompare(right.occurredAt)
  if (timestampOrder !== 0) return timestampOrder
  if (left.sequenceNumber !== right.sequenceNumber) {
    if (left.sequenceNumber === null) return 1
    if (right.sequenceNumber === null) return -1
    return left.sequenceNumber - right.sequenceNumber
  }
  return left.eventId.localeCompare(right.eventId)
}

export function gerarDatasetComprasConstrucao(
  options: OpcoesDatasetSintetico = {},
): DatasetSintetico {
  validateOptions(options)
  const seed = String(options.seed ?? SEED_SINTETICA_PADRAO)
  const caseCount = options.caseCount ?? CONTAGEM_CASOS_SINTETICOS_PADRAO
  const startAt = options.startAt ?? INICIO_SINTETICO_PADRAO
  const timezone = options.timezone ?? FUSO_SINTETICO_PADRAO
  const organizationId = options.organizationId ?? ORGANIZACAO_SINTETICA_PADRAO_ID
  const processDefinitionId = options.processDefinitionId
    ?? deterministicUuid(`${organizationId}:construction-procurement:v1`)
  const definition = createDefinicaoProcesso(organizationId, processDefinitionId, timezone)
  const { routes, reworks } = routeAndReworkAssignments(caseCount, seed)
  const events: EventoProcesso[] = []
  const durationSamples: Record<string, MutableDurationSamples> = {}
  const routeCounts: Record<RotaSintetica, number> = {
    standard: 0,
    emergency: 0,
    cancelled: 0,
    forbidden_skip_approval: 0,
  }
  const reworkCounts: Record<RetrabalhoSintetico, number> = {
    approval_review: 0,
    purchase_approval: 0,
    delivery_purchase: 0,
  }
  const featureCounts = {
    newSupplier: 0,
    highAmount: 0,
    infrastructureDepartment: 0,
    hydraulicMaterial: 0,
    approvalInteraction: 0,
  }
  const fixtureStart = Date.parse(startAt)
  const arrivalWindowHours = 24 * 180

  for (let caseIndex = 0; caseIndex < caseCount; caseIndex += 1) {
    const route = routes.get(caseIndex) ?? 'standard'
    const rework = reworks.get(caseIndex)
    routeCounts[route] += 1
    if (rework) reworkCounts[rework] += 1
    const features = generateFeatures(seed, caseIndex)
    const newSupplier = features.supplierAgeDays < 90
    const highAmount = features.amount > 50_000
    const infrastructure = features.departmentId === 'DEP-INFRASTRUCTURE'
    const hydraulic = features.materialCategory === 'hydraulic'
    if (newSupplier) featureCounts.newSupplier += 1
    if (highAmount) featureCounts.highAmount += 1
    if (infrastructure) featureCounts.infrastructureDepartment += 1
    if (hydraulic) featureCounts.hydraulicMaterial += 1
    if (newSupplier && highAmount && infrastructure) featureCounts.approvalInteraction += 1

    const caseRandom = createRandom(`${seed}:case:${caseIndex}:durations`)
    const caseNumber = String(caseIndex + 1).padStart(6, '0')
    const caseId = `procurement-case:synthetic:${caseNumber}`
    let currentTimestamp = addHours(
      fixtureStart,
      (caseIndex / caseCount) * arrivalWindowHours + caseRandom.next() * 4,
    )
    let sequenceNumber = 0
    const metadataBase = {
      schema_version: 1,
      amount: features.amount,
      currency: 'BRL',
      department_id: features.departmentId,
      supplier_id: features.supplierId,
      supplier_age_days: features.supplierAgeDays,
      material_category: features.materialCategory,
      site_id: features.siteId,
    }

    const emitActivity = (
      activity: string,
      terminalLifecycle: CicloVidaProcesso,
      reopened = false,
    ) => {
      const distribution = DISTRIBUICOES_DURACAO_SINTETICAS[activity]
      if (!distribution) throw new Error(`Missing duration distribution for ${activity}.`)
      const baseQueue = sampleLognormal(caseRandom, distribution.queueMedianHours, distribution.queueSigma)
      const processing = sampleLognormal(
        caseRandom,
        distribution.processingMedianHours,
        distribution.processingSigma,
      )
      const sourceRecord = objectForActivity(activity, caseNumber, features)
      const metadata: MetadadosEventoProcesso = {
        ...metadataBase,
        source_record: { type: sourceRecord.objectType, id: sourceRecord.objectId },
      }
      const observedQueue = baseQueue + obterEfeitoFilaSinteticoHoras(activity, metadata)
      const samples = ensureDurationSamples(durationSamples, activity)
      samples.baseQueue.push(baseQueue)
      samples.observedQueue.push(observedQueue)
      samples.processing.push(processing)
      const startedAt = addHours(currentTimestamp, observedQueue)
      const completedAt = addHours(startedAt, processing)

      const addEvent = (lifecycle: CicloVidaProcesso, occurredAt: number) => {
        sequenceNumber += 1
        const sourceEventId = `${caseId}:${String(sequenceNumber).padStart(3, '0')}:${activity}:${lifecycle}`
        events.push({
          eventId: deterministicUuid(`${organizationId}:${SISTEMA_ORIGEM_SINTETICO}:${sourceEventId}`),
          eventSchemaVersion: 1,
          organizationId,
          processDefinitionId,
          caseId,
          activity,
          lifecycle,
          occurredAt: new Date(occurredAt).toISOString(),
          sequenceNumber,
          actorId: actorForActivity(activity, caseIndex),
          objectType: sourceRecord.objectType,
          objectId: sourceRecord.objectId,
          sourceSystem: SISTEMA_ORIGEM_SINTETICO,
          sourceEventId,
          metadata,
        })
      }

      addEvent(reopened ? 'reopened' : 'started', startedAt)
      addEvent(terminalLifecycle, completedAt)
      currentTimestamp = completedAt
    }

    emitActivity('Material Request', 'completed')
    if (route !== 'emergency') emitActivity('Review', 'completed')

    if (route === 'emergency') {
      emitActivity('Emergency Approval', 'approved')
    } else if (route !== 'forbidden_skip_approval') {
      emitActivity('Approval', route === 'cancelled' ? 'cancelled' : 'approved')
    }

    if (route === 'cancelled') continue

    if (rework === 'approval_review') {
      emitActivity('Review', 'completed', true)
      emitActivity('Approval', 'approved', true)
    }

    emitActivity('Purchase', 'completed')
    if (rework === 'purchase_approval') {
      emitActivity('Approval', 'approved', true)
      emitActivity('Purchase', 'completed', true)
    }

    emitActivity('Delivery', 'completed')
    if (rework === 'delivery_purchase') {
      emitActivity('Purchase', 'completed', true)
      emitActivity('Delivery', 'completed', true)
    }
    emitActivity('Consumption', 'completed')
  }

  const realizedDurations: Record<string, ResumoDuracaoEtapa> = {}
  for (const [activity, samples] of Object.entries(durationSamples)) {
    realizedDurations[activity] = {
      baseQueue: summarize(samples.baseQueue),
      observedQueue: summarize(samples.observedQueue),
      processing: summarize(samples.processing),
    }
  }

  const checksum = calcularChecksumDatasetSintetico(definition, events)
  return {
    definition,
    events,
    groundTruth: {
      seed,
      caseCount,
      eventCount: events.length,
      checksum,
      routeCounts,
      reworkCounts,
      featureCounts,
      effectsHours: {
        newSupplierApprovalQueue: 18,
        highAmountApprovalQueue: 12,
        infrastructureReviewQueue: 8,
        hydraulicDeliveryQueue: 6,
        approvalInteractionQueue: 36,
      },
      distributions: DISTRIBUICOES_DURACAO_SINTETICAS,
      realizedDurations,
    },
  }
}
