import { test } from 'node:test'
import assert from 'node:assert/strict'
import { casarEquipe } from './casarEquipe.ts'

test('Ruan sugere Juan, mas não é exato', () => {
  const r = casarEquipe('Ruan', [{ name: 'Juan' }])
  assert.equal(r.tipo, 'provavel')
})
