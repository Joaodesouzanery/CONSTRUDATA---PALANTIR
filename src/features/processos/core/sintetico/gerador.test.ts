import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  CONTAGEM_CASOS_SINTETICOS_PADRAO,
  CICLOS_VIDA_PROCESSO,
  compararEventosProcesso,
  gerarDatasetComprasConstrucao,
  obterEfeitoFilaSinteticoHoras,
  type EventoProcesso,
  type MetadadosEventoProcesso,
} from '../index.ts'

const dataset = gerarDatasetComprasConstrucao()

function eventsByCase(events: EventoProcesso[]) {
  const grouped = new Map<string, EventoProcesso[]>()
  for (const event of events) {
    const existing = grouped.get(event.caseId) ?? []
    existing.push(event)
    grouped.set(event.caseId, existing)
  }
  return grouped
}

describe('construction procurement synthetic dataset', () => {
  test('creates the complete deterministic default fixture', () => {
    assert.equal(dataset.groundTruth.caseCount, CONTAGEM_CASOS_SINTETICOS_PADRAO)
    assert.equal(new Set(dataset.events.map((event) => event.caseId)).size, CONTAGEM_CASOS_SINTETICOS_PADRAO)
    assert.equal(dataset.groundTruth.eventCount, dataset.events.length)
    assert.equal(dataset.groundTruth.checksum, 'fnv1a64:0e385132416e749b')

    const repeated = gerarDatasetComprasConstrucao({ caseCount: 256 })
    const repeatedAgain = gerarDatasetComprasConstrucao({ caseCount: 256 })
    const anotherSeed = gerarDatasetComprasConstrucao({ seed: 'another-seed', caseCount: 256 })
    assert.equal(repeated.groundTruth.checksum, repeatedAgain.groundTruth.checksum)
    assert.notEqual(repeated.groundTruth.checksum, anotherSeed.groundTruth.checksum)
  })

  test('uses unique event IDs and source lineage', () => {
    assert.equal(new Set(dataset.events.map((event) => event.eventId)).size, dataset.events.length)
    assert.equal(
      new Set(dataset.events.map((event) => `${event.organizationId}:${event.sourceSystem}:${event.sourceEventId}`)).size,
      dataset.events.length,
    )
  })

  test('orders every case by timestamp, sequence number and event ID', () => {
    for (const caseEvents of eventsByCase(dataset.events).values()) {
      assert.deepEqual(caseEvents, [...caseEvents].sort(compararEventosProcesso))
      assert.deepEqual(
        caseEvents.map((event) => event.sequenceNumber),
        Array.from({ length: caseEvents.length }, (_, index) => index + 1),
      )
    }

    const base = dataset.events[0]!
    const sameTimestamp = [
      { ...base, eventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', sequenceNumber: null },
      { ...base, eventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sequenceNumber: 2 },
      { ...base, eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sequenceNumber: 2 },
    ].sort(compararEventosProcesso)
    assert.deepEqual(sameTimestamp.map((event) => event.eventId), [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ])
  })

  test('keeps lifecycle, case and object semantics explicit', () => {
    const lifecycleSet = new Set(dataset.events.map((event) => event.lifecycle))
    for (const lifecycle of CICLOS_VIDA_PROCESSO) assert.ok(lifecycleSet.has(lifecycle))

    const standardCase = [...eventsByCase(dataset.events).values()].find((events) => (
      events.some((event) => event.activity === 'Consumption')
      && events.some((event) => event.activity === 'Approval')
    ))
    assert.ok(standardCase)
    assert.equal(new Set(standardCase.map((event) => event.caseId)).size, 1)
    assert.ok(new Set(standardCase.map((event) => event.objectId)).size >= 5)
    assert.ok(standardCase.every((event) => event.objectId?.includes(':synthetic:')))
  })

  test('emits canonical analytical metadata without hidden labels', () => {
    for (const event of dataset.events.slice(0, 1_000)) {
      assert.equal(event.metadata.schema_version, 1)
      assert.equal(event.metadata.currency, 'BRL')
      assert.equal(typeof event.metadata.amount, 'number')
      assert.equal(typeof event.metadata.department_id, 'string')
      assert.equal(typeof event.metadata.supplier_age_days, 'number')
      assert.equal(typeof event.metadata.material_category, 'string')
      assert.equal('ground_truth' in event.metadata, false)
      assert.equal('synthetic_effect' in event.metadata, false)
    }
    assert.equal(dataset.definition.featureMappings.amount.path, '$.amount')
    assert.equal(dataset.definition.featureMappings.department?.path, '$.department_id')
  })

  test('provides typed, versioned process, KPI and SLA definitions', () => {
    assert.equal(dataset.definition.timezone, 'America/Sao_Paulo')
    assert.equal(dataset.definition.processModel.schemaVersion, 1)
    assert.ok(dataset.definition.processModel.allowedPaths.length > 1)
    assert.deepEqual(dataset.definition.processModel.concurrencyGroups, [])
    assert.equal(dataset.definition.kpiDefinitions.schemaVersion, 1)
    assert.equal(dataset.definition.slaDefinitions.schemaVersion, 1)
    const approvalKpi = dataset.definition.kpiDefinitions.definitions.find(({ key }) => key === 'approval_time')
    assert.deepEqual(approvalKpi?.from, { activity: 'Approval', lifecycle: 'started' })
    assert.deepEqual(approvalKpi?.to, { activity: 'Approval', lifecycle: 'approved' })
    assert.equal(approvalKpi?.unit, 'hours')
  })

  test('matches exact route, deviation and rework cohort allocations', () => {
    assert.deepEqual(dataset.groundTruth.routeCounts, {
      standard: 11_484,
      emergency: 624,
      cancelled: 125,
      forbidden_skip_approval: 250,
    })
    assert.deepEqual(dataset.groundTruth.reworkCounts, {
      approval_review: 874,
      purchase_approval: 374,
      delivery_purchase: 250,
    })
    assert.equal(Object.values(dataset.groundTruth.reworkCounts).reduce((sum, count) => sum + count, 0), 1_498)
  })

  test('implements every planted simple and interaction effect', () => {
    const base: MetadadosEventoProcesso = {
      schema_version: 1,
      amount: 40_000,
      currency: 'BRL',
      department_id: 'DEP-OPERATIONS',
      supplier_id: 'supplier:test',
      supplier_age_days: 365,
      material_category: 'structural',
      site_id: 'site:test',
      source_record: { type: 'Approval', id: 'approval:test' },
    }
    assert.equal(obterEfeitoFilaSinteticoHoras('Approval', base), 0)
    assert.equal(obterEfeitoFilaSinteticoHoras('Approval', { ...base, supplier_age_days: 43 }), 18)
    assert.equal(obterEfeitoFilaSinteticoHoras('Approval', { ...base, amount: 75_000 }), 12)
    assert.equal(obterEfeitoFilaSinteticoHoras('Review', { ...base, department_id: 'DEP-INFRASTRUCTURE' }), 8)
    assert.equal(obterEfeitoFilaSinteticoHoras('Delivery', { ...base, material_category: 'hydraulic' }), 6)
    assert.equal(obterEfeitoFilaSinteticoHoras('Approval', {
      ...base,
      supplier_age_days: 43,
      amount: 75_000,
      department_id: 'DEP-INFRASTRUCTURE',
    }), 66)
  })

  test('separates queue and processing time and respects distribution tolerances', () => {
    for (const [activity, configured] of Object.entries(dataset.groundTruth.distributions)) {
      const realized = dataset.groundTruth.realizedDurations[activity]
      assert.ok(realized)
      if (configured.queueMedianHours === 0) assert.equal(realized.baseQueue.p50, 0)
      else {
        const tolerance = realized.baseQueue.count >= 500 ? 0.05 : 0.10
        assert.ok(Math.abs(realized.baseQueue.p50 - configured.queueMedianHours) / configured.queueMedianHours <= tolerance)
      }
      const tolerance = realized.processing.count >= 500 ? 0.05 : 0.10
      assert.ok(
        Math.abs(realized.processing.p50 - configured.processingMedianHours) / configured.processingMedianHours <= tolerance,
      )
      assert.ok(realized.processing.p50 > 0)
    }

    const review = dataset.groundTruth.realizedDurations.Review!
    assert.ok(review.observedQueue.p50 > review.baseQueue.p50)
    const approval = dataset.groundTruth.realizedDurations.Approval!
    assert.ok(approval.observedQueue.p50 > approval.baseQueue.p50)
  })
})
