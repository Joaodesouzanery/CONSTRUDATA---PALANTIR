import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  AcumuladorDescoberta,
  REGRAS_RETRABALHO_COMPRAS,
  descobrirProcesso,
  gerarDatasetComprasConstrucao,
  type CicloVidaProcesso,
  type DefinicaoProcesso,
  type EventoProcesso,
} from './index.ts'

const baseDataset = gerarDatasetComprasConstrucao({ caseCount: 1 })
const definition: DefinicaoProcesso = baseDataset.definition
const baseEvent = baseDataset.events[0]!

function evento(
  caseId: string,
  activity: string,
  lifecycle: CicloVidaProcesso | null,
  occurredAt: string,
  sequenceNumber: number | null,
  suffix: string,
): EventoProcesso {
  return {
    ...baseEvent,
    eventId: `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`,
    sourceEventId: `${caseId}:${suffix}`,
    caseId,
    activity,
    lifecycle,
    occurredAt,
    sequenceNumber,
  }
}

describe('motor de descoberta de Processos', () => {
  test('separa loop, repetição, retrabalho e transição proibida', () => {
    const caseId = 'case:analitico:001'
    const events = [
      evento(caseId, 'Material Request', 'started', '2026-01-01T00:00:00.000Z', 1, '1'),
      evento(caseId, 'Material Request', 'completed', '2026-01-01T01:00:00.000Z', 2, '2'),
      evento(caseId, 'Review', 'started', '2026-01-01T02:00:00.000Z', 3, '3'),
      evento(caseId, 'Review', 'completed', '2026-01-01T03:00:00.000Z', 4, '4'),
      evento(caseId, 'Approval', 'started', '2026-01-01T04:00:00.000Z', 5, '5'),
      evento(caseId, 'Approval', 'approved', '2026-01-01T05:00:00.000Z', 6, '6'),
      evento(caseId, 'Review', 'reopened', '2026-01-01T06:00:00.000Z', 7, '7'),
      evento(caseId, 'Review', 'completed', '2026-01-01T07:00:00.000Z', 8, '8'),
      evento(caseId, 'Purchase', 'started', '2026-01-01T08:00:00.000Z', 9, '9'),
      evento(caseId, 'Purchase', 'completed', '2026-01-01T09:00:00.000Z', 10, '10'),
    ]
    const { result, caseSummaries } = descobrirProcesso(definition, events, {
      reworkRules: [...REGRAS_RETRABALHO_COMPRAS],
    })

    assert.equal(result.loops.length, 1)
    assert.deepEqual([result.loops[0]?.from, result.loops[0]?.to], ['Approval', 'Review'])
    assert.equal(result.rework[0]?.ruleKey, 'approval_review')
    assert.equal(result.repeatedActivities[0]?.activity, 'Review')
    assert.equal(result.forbiddenTransitions[0]?.key, 'Review->Purchase')
    assert.equal(caseSummaries[0]?.hasLoop, true)
    assert.equal(caseSummaries[0]?.hasRework, true)
    assert.equal(caseSummaries[0]?.hasDeviation, true)
    assert.deepEqual(result.metrics, {})
    assert.deepEqual(result.bottlenecks, [])
  })

  test('preserva lifecycles incompletos, lifecycle nulo e ordem ambígua', () => {
    const caseId = 'case:analitico:002'
    const events = [
      evento(caseId, 'A', 'started', '2026-01-01T00:00:00.000Z', 1, '11'),
      evento(caseId, 'B', 'completed', '2026-01-01T01:00:00.000Z', 2, '12'),
      evento(caseId, 'C', null, '2026-01-01T02:00:00.000Z', null, '13'),
      evento(caseId, 'D', null, '2026-01-01T02:00:00.000Z', null, '14'),
    ]
    const { result } = descobrirProcesso(definition, events)
    assert.deepEqual(
      result.incompleteLifecycles.map(({ kind }) => kind).sort(),
      ['missing_lifecycle', 'missing_lifecycle', 'started_without_terminal', 'terminal_without_started'],
    )
    assert.equal(result.ambiguousOrderings.length, 1)
    assert.equal(result.ambiguousOrderings[0]?.occurredAt, '2026-01-01T02:00:00.000Z')
  })

  test('marca somente sobreposição estrita como possível concorrência', () => {
    const concurrentCase = 'case:concorrente'
    const adjacentCase = 'case:adjacente'
    const events = [
      evento(concurrentCase, 'Finance Review', 'started', '2026-01-01T00:00:00.000Z', 1, '21'),
      evento(concurrentCase, 'Technical Review', 'started', '2026-01-01T01:00:00.000Z', 2, '22'),
      evento(concurrentCase, 'Technical Review', 'completed', '2026-01-01T03:00:00.000Z', 3, '23'),
      evento(concurrentCase, 'Finance Review', 'completed', '2026-01-01T04:00:00.000Z', 4, '24'),
      evento(adjacentCase, 'A', 'started', '2026-01-02T00:00:00.000Z', 1, '25'),
      evento(adjacentCase, 'A', 'completed', '2026-01-02T01:00:00.000Z', 2, '26'),
      evento(adjacentCase, 'B', 'started', '2026-01-02T01:00:00.000Z', 3, '27'),
      evento(adjacentCase, 'B', 'completed', '2026-01-02T02:00:00.000Z', 4, '28'),
    ]
    const { result, caseSummaries } = descobrirProcesso(definition, events)
    assert.equal(result.possibleConcurrency.length, 1)
    assert.deepEqual(
      [result.possibleConcurrency[0]?.firstActivity, result.possibleConcurrency[0]?.secondActivity],
      ['Finance Review', 'Technical Review'],
    )
    assert.equal(caseSummaries.find(({ caseId }) => caseId === concurrentCase)?.hasPossibleConcurrency, true)
    assert.equal(caseSummaries.find(({ caseId }) => caseId === adjacentCase)?.hasPossibleConcurrency, false)
  })

  test('é determinístico e processa o dataset completo caso a caso', () => {
    const dataset = gerarDatasetComprasConstrucao()
    const run = () => {
      const accumulator = new AcumuladorDescoberta(dataset.definition, {
        reworkRules: [...REGRAS_RETRABALHO_COMPRAS],
      })
      let currentCaseId = ''
      let currentEvents: EventoProcesso[] = []
      for (const event of dataset.events) {
        if (currentCaseId && event.caseId !== currentCaseId) {
          accumulator.processarCaso(currentEvents)
          currentEvents = []
        }
        currentCaseId = event.caseId
        currentEvents.push(event)
      }
      if (currentEvents.length > 0) accumulator.processarCaso(currentEvents)
      return accumulator.finalizar()
    }
    const first = run()
    const second = run()

    assert.deepEqual(first, second)
    assert.equal(first.input.caseCount, 12_483)
    assert.equal(first.input.eventCount, 153_290)
    // Cada retrabalho cria a transição de retorno e a posterior retomada de uma
    // atividade já observada; ambas pertencem ao loop, apenas uma é retrabalho.
    assert.equal(first.loops.reduce((sum, item) => sum + item.occurrenceCount, 0), 2_996)
    assert.equal(first.rework.reduce((sum, item) => sum + item.occurrenceCount, 0), 1_498)
    assert.equal(first.forbiddenTransitions.reduce((sum, item) => sum + item.occurrenceCount, 0), 250)
    assert.equal(first.possibleConcurrency.length, 0)
  })
})
