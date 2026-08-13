import { compararEventosProcesso } from './sintetico/gerador.ts'
import type {
  ArestaProcesso,
  AtividadeRepetida,
  CicloVidaProcesso,
  ConcorrenciaPossivel,
  DefinicaoProcesso,
  EventoProcesso,
  EvidenciaAgregada,
  LifecycleIncompleto,
  LoopObservado,
  NoProcesso,
  ObjetoJson,
  OcorrenciaAtividade,
  OrdenacaoAmbigua,
  ParametrosDescoberta,
  ResultadoCasoDescoberto,
  ResultadoDescoberta,
  ResumoCasoProcesso,
  RetrabalhoObservado,
  TransicaoProibidaObservada,
  VarianteProcesso,
} from './tipos.ts'

export const CHAVE_ALGORITMO_DESCOBERTA = 'construdata.processos.discovery'
export const VERSAO_ALGORITMO_DESCOBERTA = '2.0.0'

export const REGRAS_RETRABALHO_COMPRAS = [
  { key: 'approval_review', label: 'Aprovação retornou para revisão', from: 'Approval', to: 'Review' },
  { key: 'purchase_approval', label: 'Compra retornou para aprovação', from: 'Purchase', to: 'Approval' },
  { key: 'delivery_purchase', label: 'Entrega retornou para compra', from: 'Delivery', to: 'Purchase' },
] as const

const TERMINAIS = new Set<CicloVidaProcesso>(['completed', 'approved', 'cancelled'])
const INICIOS = new Set<CicloVidaProcesso>(['started', 'reopened'])

interface EvidenciaMutavel {
  key: string
  occurrenceCount: number
  caseIds: Set<string>
  exampleCaseIds: string[]
}

interface NoMutavel {
  occurrenceCount: number
  caseIds: Set<string>
  startCount: number
  endCount: number
}

interface ArestaMutavel {
  occurrenceCount: number
  caseIds: Set<string>
  isLoop: boolean
  isForbidden: boolean
}

interface VarianteMutavel {
  activities: string[]
  caseCount: number
  eventCount: number
}

interface OcorrenciaMutavel extends OcorrenciaAtividade {
  startLifecycle: CicloVidaProcesso | null
}

function atualizarFNV(hash: number, value: string): number {
  let next = hash >>> 0
  for (let index = 0; index < value.length; index += 1) {
    next ^= value.charCodeAt(index)
    next = Math.imul(next, 16777619)
  }
  return next >>> 0
}

export function serializarJsonCanonico(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(serializarJsonCanonico).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${serializarJsonCanonico(item)}`).join(',')}}`
}

export function calcularChecksumTexto(value: string): string {
  const first = atualizarFNV(2166136261, value)
  const second = atualizarFNV(2166136261 ^ 0x9e3779b9, [...value].reverse().join(''))
  return `fnv1a64:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
}

function serializarEvento(evento: EventoProcesso): string {
  return serializarJsonCanonico({
    eventId: evento.eventId,
    eventSchemaVersion: evento.eventSchemaVersion,
    organizationId: evento.organizationId,
    processDefinitionId: evento.processDefinitionId,
    caseId: evento.caseId,
    activity: evento.activity,
    lifecycle: evento.lifecycle,
    occurredAt: evento.occurredAt,
    sequenceNumber: evento.sequenceNumber,
    actorId: evento.actorId,
    objectType: evento.objectType,
    objectId: evento.objectId,
    sourceSystem: evento.sourceSystem,
    sourceEventId: evento.sourceEventId,
    metadata: evento.metadata,
  })
}

function chaveVariante(activities: string[]): string {
  const serialized = activities.join('\u001f')
  const hash = atualizarFNV(2166136261, serialized)
  return `variant:fnv1a32:${hash.toString(16).padStart(8, '0')}`
}

function compararOcorrencias(left: OcorrenciaMutavel, right: OcorrenciaMutavel): number {
  const timestampOrder = left.startedAt.localeCompare(right.startedAt)
  if (timestampOrder !== 0) return timestampOrder
  return (left.startedEventId ?? left.terminalEventId ?? '')
    .localeCompare(right.startedEventId ?? right.terminalEventId ?? '')
}

function evidenceToPublic(evidence: EvidenciaMutavel): EvidenciaAgregada {
  return {
    key: evidence.key,
    occurrenceCount: evidence.occurrenceCount,
    caseCount: evidence.caseIds.size,
    exampleCaseIds: evidence.exampleCaseIds,
  }
}

function metadataResumo(evento: EventoProcesso): ObjetoJson {
  const metadata = evento.metadata
  return {
    schema_version: metadata.schema_version,
    amount: metadata.amount,
    currency: metadata.currency,
    department_id: metadata.department_id,
    supplier_id: metadata.supplier_id,
    supplier_age_days: metadata.supplier_age_days,
    material_category: metadata.material_category,
    site_id: metadata.site_id,
  }
}

export function criarParametrosDescoberta(
  parcial: Partial<ParametrosDescoberta> = {},
): ParametrosDescoberta {
  return {
    reworkRules: parcial.reworkRules ?? [],
    maxExampleCaseIds: parcial.maxExampleCaseIds ?? 10,
  }
}

export class AcumuladorDescoberta {
  readonly caseSummaries: ResumoCasoProcesso[] = []

  private readonly definition: DefinicaoProcesso
  private readonly parametros: ParametrosDescoberta
  private readonly nodes = new Map<string, NoMutavel>()
  private readonly edges = new Map<string, ArestaMutavel>()
  private readonly paths = new Map<string, VarianteMutavel>()
  private readonly loops = new Map<string, EvidenciaMutavel>()
  private readonly rework = new Map<string, EvidenciaMutavel>()
  private readonly repeated = new Map<string, EvidenciaMutavel>()
  private readonly forbidden = new Map<string, EvidenciaMutavel>()
  private readonly incomplete = new Map<string, EvidenciaMutavel>()
  private readonly ambiguous = new Map<string, EvidenciaMutavel>()
  private readonly concurrency = new Map<string, EvidenciaMutavel>()
  private readonly seenCaseIds = new Set<string>()
  private eventCount = 0
  private firstHash = 2166136261
  private secondHash = 2166136261 ^ 0x9e3779b9

  constructor(
    definition: DefinicaoProcesso,
    parametros: Partial<ParametrosDescoberta> = {},
  ) {
    this.definition = definition
    this.parametros = criarParametrosDescoberta(parametros)
  }

  processarCaso(eventosEntrada: readonly EventoProcesso[]): ResultadoCasoDescoberto {
    if (eventosEntrada.length === 0) throw new Error('Um caso precisa conter ao menos um evento.')
    const eventos = [...eventosEntrada].sort(compararEventosProcesso)
    const caseId = eventos[0]!.caseId
    if (this.seenCaseIds.has(caseId)) throw new Error(`O caso ${caseId} já foi processado.`)

    for (const evento of eventos) {
      if (evento.caseId !== caseId) throw new Error('Todos os eventos do lote devem pertencer ao mesmo caso.')
      if (evento.organizationId !== this.definition.organizationId) {
        throw new Error(`Evento ${evento.eventId} pertence a outra organização.`)
      }
      if (evento.processDefinitionId !== this.definition.id) {
        throw new Error(`Evento ${evento.eventId} pertence a outra definição.`)
      }
      const serialized = serializarEvento(evento)
      this.firstHash = atualizarFNV(this.firstHash, serialized)
      this.secondHash = atualizarFNV(this.secondHash, [...serialized].reverse().join(''))
      this.eventCount += 1
    }
    this.seenCaseIds.add(caseId)

    this.detectarOrdenacoesAmbiguas(eventos, caseId)
    const ocorrencias = this.reconstruirOcorrencias(eventos, caseId).sort(compararOcorrencias)
    const resultado = this.agregarCaso(eventos, ocorrencias, caseId)
    this.caseSummaries.push(resultado.summary)
    return resultado
  }

  finalizar(): ResultadoDescoberta {
    const caseCount = this.seenCaseIds.size
    const toEvidence = (map: Map<string, EvidenciaMutavel>) => (
      [...map.values()].sort((left, right) => left.key.localeCompare(right.key))
    )
    const nodes: NoProcesso[] = [...this.nodes.entries()]
      .map(([activity, value]) => ({
        key: activity,
        activity,
        occurrenceCount: value.occurrenceCount,
        caseCount: value.caseIds.size,
        startCount: value.startCount,
        endCount: value.endCount,
      }))
      .sort((left, right) => left.activity.localeCompare(right.activity))
    const edges: ArestaProcesso[] = [...this.edges.entries()]
      .map(([key, value]) => {
        const [from = '', to = ''] = key.split('\u001f')
        return {
          key: `${from}->${to}`,
          from,
          to,
          occurrenceCount: value.occurrenceCount,
          caseCount: value.caseIds.size,
          isLoop: value.isLoop,
          isForbidden: value.isForbidden,
        }
      })
      .sort((left, right) => left.key.localeCompare(right.key))
    const paths: VarianteProcesso[] = [...this.paths.entries()]
      .map(([key, value]) => ({
        key,
        activities: value.activities,
        caseCount: value.caseCount,
        eventCount: value.eventCount,
        percentage: caseCount === 0 ? 0 : Number(((value.caseCount / caseCount) * 100).toFixed(6)),
      }))
      .sort((left, right) => right.caseCount - left.caseCount || left.key.localeCompare(right.key))

    return {
      schemaVersion: 1,
      algorithmKey: CHAVE_ALGORITMO_DESCOBERTA,
      algorithmVersion: VERSAO_ALGORITMO_DESCOBERTA,
      input: {
        organizationId: this.definition.organizationId,
        processDefinitionId: this.definition.id,
        definitionVersion: this.definition.version,
        eventCount: this.eventCount,
        caseCount,
        inputChecksum: `fnv1a64:${this.firstHash.toString(16).padStart(8, '0')}${this.secondHash.toString(16).padStart(8, '0')}`,
      },
      nodes,
      edges,
      paths,
      loops: toEvidence(this.loops).map((value) => {
        const [from = '', to = ''] = value.key.split('\u001f')
        return { ...evidenceToPublic(value), key: `${from}->${to}`, from, to } satisfies LoopObservado
      }),
      rework: toEvidence(this.rework).map((value) => {
        const rule = this.parametros.reworkRules.find(({ key }) => key === value.key)
        return {
          ...evidenceToPublic(value),
          ruleKey: value.key,
          label: rule?.label ?? value.key,
          from: rule?.from ?? '',
          to: rule?.to ?? '',
        } satisfies RetrabalhoObservado
      }),
      repeatedActivities: toEvidence(this.repeated).map((value) => ({
        ...evidenceToPublic(value), activity: value.key,
      } satisfies AtividadeRepetida)),
      forbiddenTransitions: toEvidence(this.forbidden).map((value) => {
        const [from = '', to = ''] = value.key.split('\u001f')
        return { ...evidenceToPublic(value), key: `${from}->${to}`, from, to } satisfies TransicaoProibidaObservada
      }),
      incompleteLifecycles: toEvidence(this.incomplete).map((value) => {
        const [activity = '', kind = 'missing_lifecycle'] = value.key.split('\u001f')
        return { ...evidenceToPublic(value), key: `${activity}:${kind}`, activity, kind } as LifecycleIncompleto
      }),
      ambiguousOrderings: toEvidence(this.ambiguous).map((value) => {
        const [firstActivity = '', secondActivity = '', occurredAt = ''] = value.key.split('\u001f')
        return {
          ...evidenceToPublic(value),
          key: `${firstActivity}<->${secondActivity}@${occurredAt}`,
          firstActivity,
          secondActivity,
          occurredAt,
        } satisfies OrdenacaoAmbigua
      }),
      possibleConcurrency: toEvidence(this.concurrency).map((value) => {
        const [firstActivity = '', secondActivity = ''] = value.key.split('\u001f')
        return {
          ...evidenceToPublic(value),
          key: `${firstActivity}<->${secondActivity}`,
          firstActivity,
          secondActivity,
        } satisfies ConcorrenciaPossivel
      }),
      metrics: {},
      bottlenecks: [],
    }
  }

  private evidencia(map: Map<string, EvidenciaMutavel>, key: string, caseId: string, quantidade = 1) {
    const existing = map.get(key) ?? {
      key,
      occurrenceCount: 0,
      caseIds: new Set<string>(),
      exampleCaseIds: [],
    }
    existing.occurrenceCount += quantidade
    existing.caseIds.add(caseId)
    if (!existing.exampleCaseIds.includes(caseId)
      && existing.exampleCaseIds.length < this.parametros.maxExampleCaseIds) {
      existing.exampleCaseIds.push(caseId)
    }
    map.set(key, existing)
  }

  private detectarOrdenacoesAmbiguas(eventos: EventoProcesso[], caseId: string) {
    for (let index = 1; index < eventos.length; index += 1) {
      const previous = eventos[index - 1]!
      const current = eventos[index]!
      if (previous.occurredAt !== current.occurredAt) continue
      const sequenceIsAmbiguous = previous.sequenceNumber === null
        || current.sequenceNumber === null
        || previous.sequenceNumber === current.sequenceNumber
      if (!sequenceIsAmbiguous) continue
      const activities = [previous.activity, current.activity].sort()
      this.evidencia(
        this.ambiguous,
        `${activities[0]}\u001f${activities[1]}\u001f${current.occurredAt}`,
        caseId,
      )
    }
  }

  private reconstruirOcorrencias(eventos: EventoProcesso[], caseId: string): OcorrenciaMutavel[] {
    const ocorrencias: OcorrenciaMutavel[] = []
    const abertas = new Map<string, OcorrenciaMutavel[]>()
    const contagem = new Map<string, number>()

    const novaOcorrencia = (evento: EventoProcesso, startedEventId: string | null): OcorrenciaMutavel => {
      const occurrenceIndex = (contagem.get(evento.activity) ?? 0) + 1
      contagem.set(evento.activity, occurrenceIndex)
      return {
        activity: evento.activity,
        occurrenceIndex,
        startedAt: evento.occurredAt,
        endedAt: null,
        startedEventId,
        terminalEventId: null,
        terminalLifecycle: null,
        startLifecycle: evento.lifecycle,
      }
    }

    for (const evento of eventos) {
      if (evento.lifecycle === null) {
        const occurrence = novaOcorrencia(evento, evento.eventId)
        occurrence.endedAt = evento.occurredAt
        occurrence.terminalEventId = evento.eventId
        ocorrencias.push(occurrence)
        this.evidencia(this.incomplete, `${evento.activity}\u001fmissing_lifecycle`, caseId)
        continue
      }
      if (INICIOS.has(evento.lifecycle)) {
        const occurrence = novaOcorrencia(evento, evento.eventId)
        ocorrencias.push(occurrence)
        const activityOpen = abertas.get(evento.activity) ?? []
        activityOpen.push(occurrence)
        abertas.set(evento.activity, activityOpen)
        continue
      }
      if (TERMINAIS.has(evento.lifecycle)) {
        const activityOpen = abertas.get(evento.activity) ?? []
        const occurrence = activityOpen.pop()
        if (occurrence) {
          occurrence.endedAt = evento.occurredAt
          occurrence.terminalEventId = evento.eventId
          occurrence.terminalLifecycle = evento.lifecycle
        } else {
          const orphan = novaOcorrencia(evento, null)
          orphan.endedAt = evento.occurredAt
          orphan.terminalEventId = evento.eventId
          orphan.terminalLifecycle = evento.lifecycle
          ocorrencias.push(orphan)
          this.evidencia(this.incomplete, `${evento.activity}\u001fterminal_without_started`, caseId)
        }
      }
    }

    for (const activityOpen of abertas.values()) {
      for (const occurrence of activityOpen) {
        this.evidencia(this.incomplete, `${occurrence.activity}\u001fstarted_without_terminal`, caseId)
      }
    }
    return ocorrencias
  }

  private agregarCaso(
    eventos: EventoProcesso[],
    ocorrencias: OcorrenciaMutavel[],
    caseId: string,
  ): ResultadoCasoDescoberto {
    const atividades = ocorrencias.map(({ activity }) => activity)
    const counts = new Map<string, number>()
    for (const activity of atividades) counts.set(activity, (counts.get(activity) ?? 0) + 1)
    for (const [activity, count] of counts) {
      if (count > 1) this.evidencia(this.repeated, activity, caseId, count - 1)
    }

    const seenActivities = new Set<string>()
    let hasLoop = false
    let hasRework = false
    let hasDeviation = false
    for (let index = 0; index < ocorrencias.length; index += 1) {
      const occurrence = ocorrencias[index]!
      const node = this.nodes.get(occurrence.activity) ?? {
        occurrenceCount: 0,
        caseIds: new Set<string>(),
        startCount: 0,
        endCount: 0,
      }
      node.occurrenceCount += 1
      node.caseIds.add(caseId)
      if (index === 0) node.startCount += 1
      if (index === ocorrencias.length - 1) node.endCount += 1
      this.nodes.set(occurrence.activity, node)

      const next = ocorrencias[index + 1]
      seenActivities.add(occurrence.activity)
      if (!next) continue
      const transitionKey = `${occurrence.activity}\u001f${next.activity}`
      const isLoop = seenActivities.has(next.activity)
      const isForbidden = this.transicaoProibida(occurrence, next)
      const edge = this.edges.get(transitionKey) ?? {
        occurrenceCount: 0,
        caseIds: new Set<string>(),
        isLoop: false,
        isForbidden: false,
      }
      edge.occurrenceCount += 1
      edge.caseIds.add(caseId)
      edge.isLoop ||= isLoop
      edge.isForbidden ||= isForbidden
      this.edges.set(transitionKey, edge)
      if (isLoop) {
        hasLoop = true
        this.evidencia(this.loops, transitionKey, caseId)
      }
      if (isForbidden) {
        hasDeviation = true
        this.evidencia(this.forbidden, transitionKey, caseId)
      }
      const rule = this.parametros.reworkRules.find(
        ({ from, to }) => from === occurrence.activity && to === next.activity,
      )
      if (rule) {
        hasRework = true
        this.evidencia(this.rework, rule.key, caseId)
      }
    }

    let hasPossibleConcurrency = false
    for (let leftIndex = 0; leftIndex < ocorrencias.length; leftIndex += 1) {
      const left = ocorrencias[leftIndex]!
      if (!left.endedAt) continue
      for (let rightIndex = leftIndex + 1; rightIndex < ocorrencias.length; rightIndex += 1) {
        const right = ocorrencias[rightIndex]!
        if (!right.endedAt) continue
        const overlapStarts = Math.max(Date.parse(left.startedAt), Date.parse(right.startedAt))
        const overlapEnds = Math.min(Date.parse(left.endedAt), Date.parse(right.endedAt))
        if (overlapStarts >= overlapEnds) continue
        hasPossibleConcurrency = true
        const activities = [left.activity, right.activity].sort()
        this.evidencia(this.concurrency, `${activities[0]}\u001f${activities[1]}`, caseId)
      }
    }

    const variantKey = chaveVariante(atividades)
    const variant = this.paths.get(variantKey) ?? { activities: atividades, caseCount: 0, eventCount: 0 }
    variant.caseCount += 1
    variant.eventCount += eventos.length
    this.paths.set(variantKey, variant)

    const firstEvent = eventos[0]!
    const lastEvent = eventos[eventos.length - 1]!
    const hasIncomplete = [...this.incomplete.values()].some((value) => value.caseIds.has(caseId))
    const hasAmbiguous = [...this.ambiguous.values()].some((value) => value.caseIds.has(caseId))
    const endedAt = lastEvent.occurredAt
    const summary: ResumoCasoProcesso = {
      organizationId: this.definition.organizationId,
      processDefinitionId: this.definition.id,
      caseId,
      startedAt: firstEvent.occurredAt,
      endedAt,
      durationMs: Date.parse(endedAt) - Date.parse(firstEvent.occurredAt),
      eventCount: eventos.length,
      activityCount: counts.size,
      variantKey,
      hasLoop,
      hasRework,
      hasDeviation,
      hasAnomaly: hasLoop || hasRework || hasDeviation || hasIncomplete || hasAmbiguous || hasPossibleConcurrency,
      hasPossibleConcurrency,
      terminalLifecycle: lastEvent.lifecycle,
      metadataSummary: metadataResumo(firstEvent),
    }
    return { summary, occurrences: ocorrencias }
  }

  private transicaoProibida(from: OcorrenciaMutavel, to: OcorrenciaMutavel): boolean {
    const fromState = from.terminalLifecycle ? `${from.activity}.${from.terminalLifecycle}` : from.activity
    const toState = to.startLifecycle ? `${to.activity}.${to.startLifecycle}` : to.activity
    return this.definition.processModel.forbiddenTransitions.some((transition) => (
      (transition.from === from.activity || transition.from === fromState)
      && (transition.to === to.activity || transition.to === toState)
    ))
  }
}

export function descobrirProcesso(
  definition: DefinicaoProcesso,
  eventos: readonly EventoProcesso[],
  parametros: Partial<ParametrosDescoberta> = {},
): { result: ResultadoDescoberta; caseSummaries: ResumoCasoProcesso[] } {
  const accumulator = new AcumuladorDescoberta(definition, parametros)
  const byCase = new Map<string, EventoProcesso[]>()
  for (const evento of eventos) {
    const existing = byCase.get(evento.caseId) ?? []
    existing.push(evento)
    byCase.set(evento.caseId, existing)
  }
  for (const caseId of [...byCase.keys()].sort()) accumulator.processarCaso(byCase.get(caseId) ?? [])
  return { result: accumulator.finalizar(), caseSummaries: accumulator.caseSummaries }
}
