import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHECKSUM_SINTETICO_PADRAO,
  calcularChecksumTexto,
  serializarJsonCanonico,
} from '../core/index.ts'
import { DEMO_PROCESSOS } from './fixture.ts'

test('fixture DEMO usa o contrato real e o checksum canônico M1', () => {
  const { artifactChecksum, ...artifact } = DEMO_PROCESSOS
  assert.equal(DEMO_PROCESSOS.sourceDatasetChecksum, CHECKSUM_SINTETICO_PADRAO)
  assert.equal(DEMO_PROCESSOS.sourceDatasetCaseCount, 12_483)
  assert.equal(DEMO_PROCESSOS.sourceDatasetEventCount, 153_290)
  assert.equal(DEMO_PROCESSOS.result.schemaVersion, 1)
  assert.equal(DEMO_PROCESSOS.result.input.caseCount, 12_483)
  assert.equal(DEMO_PROCESSOS.result.input.eventCount, 153_290)
  assert.equal(DEMO_PROCESSOS.cases.length, 10)
  assert.equal(artifactChecksum, calcularChecksumTexto(serializarJsonCanonico(artifact)))
})
