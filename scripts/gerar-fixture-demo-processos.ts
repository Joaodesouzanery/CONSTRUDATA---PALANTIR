import { writeFile } from 'node:fs/promises'
import {
  CHECKSUM_SINTETICO_PADRAO,
  REGRAS_RETRABALHO_COMPRAS,
  calcularChecksumTexto,
  descobrirProcesso,
  gerarDatasetComprasConstrucao,
  serializarJsonCanonico,
  type EventoProcesso,
  type ResumoCasoProcesso,
} from '../src/features/processos/core/index.ts'

interface CasoDemo {
  key: string
  label: string
  summary: ResumoCasoProcesso
  events: EventoProcesso[]
}

const output = new URL('../src/features/processos/demo/processos-demo.json', import.meta.url)
const dataset = gerarDatasetComprasConstrucao()
const discovery = descobrirProcesso(dataset.definition, dataset.events, {
  reworkRules: [...REGRAS_RETRABALHO_COMPRAS],
})
const eventsByCase = new Map<string, EventoProcesso[]>()
for (const event of dataset.events) {
  const events = eventsByCase.get(event.caseId) ?? []
  events.push(event)
  eventsByCase.set(event.caseId, events)
}
const selected = new Set<string>()

function activities(events: EventoProcesso[]) {
  return events
    .filter(({ lifecycle }) => lifecycle === 'started' || lifecycle === 'reopened' || lifecycle === null)
    .map(({ activity }) => activity)
}

function hasTransition(events: EventoProcesso[], from: string, to: string) {
  const values = activities(events)
  return values.some((activity, index) => activity === from && values[index + 1] === to)
}

function pick(
  key: string,
  label: string,
  predicate: (summary: ResumoCasoProcesso, events: EventoProcesso[]) => boolean,
): CasoDemo {
  const summary = discovery.caseSummaries.find((candidate) => {
    const events = eventsByCase.get(candidate.caseId) ?? []
    return !selected.has(candidate.caseId) && predicate(candidate, events)
  })
  if (!summary) throw new Error(`Caso representativo ausente: ${key}`)
  selected.add(summary.caseId)
  return { key, label, summary, events: eventsByCase.get(summary.caseId) ?? [] }
}

const cases: CasoDemo[] = [
  pick('standard', 'Fluxo padrão', (summary, events) => {
    const metadata = events[0]?.metadata
    return !summary.hasLoop && !summary.hasDeviation
      && !events.some(({ activity }) => activity === 'Emergency Approval')
      && events.at(-1)?.lifecycle === 'completed'
      && Boolean(metadata && metadata.supplier_age_days >= 90 && metadata.amount <= 50_000)
  }),
  pick('new-supplier', 'Fornecedor novo', (_, events) => (events[0]?.metadata.supplier_age_days ?? 999) < 90),
  pick('high-amount', 'Valor alto', (_, events) => (events[0]?.metadata.amount ?? 0) > 50_000),
  pick('triple-interaction', 'Interação tripla', (_, events) => {
    const metadata = events[0]?.metadata
    return Boolean(metadata
      && metadata.supplier_age_days < 90
      && metadata.amount > 50_000
      && metadata.department_id === 'DEP-INFRASTRUCTURE')
  }),
  pick('emergency', 'Caminho emergencial', (_, events) => events.some(({ activity }) => activity === 'Emergency Approval')),
  pick('cancelled', 'Caso cancelado', (_, events) => events.at(-1)?.lifecycle === 'cancelled'),
  pick('forbidden', 'Desvio Review → Purchase', (summary) => summary.hasDeviation),
  pick('approval-review', 'Loop Approval → Review', (_, events) => hasTransition(events, 'Approval', 'Review')),
  pick('purchase-approval', 'Loop Purchase → Approval', (_, events) => hasTransition(events, 'Purchase', 'Approval')),
  pick('delivery-purchase', 'Loop Delivery → Purchase', (_, events) => hasTransition(events, 'Delivery', 'Purchase')),
]

const artifactWithoutChecksum = {
  schemaVersion: 1,
  sourceDatasetChecksum: dataset.groundTruth.checksum,
  sourceDatasetCaseCount: dataset.groundTruth.caseCount,
  sourceDatasetEventCount: dataset.groundTruth.eventCount,
  definition: dataset.definition,
  parameters: {
    reworkRules: [...REGRAS_RETRABALHO_COMPRAS],
    maxExampleCaseIds: 10,
  },
  result: discovery.result,
  cases,
}
if (artifactWithoutChecksum.sourceDatasetChecksum !== CHECKSUM_SINTETICO_PADRAO) {
  throw new Error('O checksum M1 mudou; a fixture DEMO não pode ser gerada.')
}
const artifact = {
  ...artifactWithoutChecksum,
  artifactChecksum: calcularChecksumTexto(serializarJsonCanonico(artifactWithoutChecksum)),
}
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  output: output.pathname,
  artifactChecksum: artifact.artifactChecksum,
  inputChecksum: artifact.result.input.inputChecksum,
  representativeCaseIds: cases.map(({ key, summary }) => ({ key, caseId: summary.caseId })),
}, null, 2))
