import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sincronizouHaPouco } from './useStoreSync.ts'

test('TTL do pull: sincronizado há menos de 30 s não puxa de novo; mais, puxa; nunca, puxa', () => {
  const agora = Date.parse('2026-09-08T12:00:00.000Z')
  assert.equal(sincronizouHaPouco('2026-09-08T11:59:45.000Z', agora), true, '15 s atrás')
  assert.equal(sincronizouHaPouco('2026-09-08T11:59:00.000Z', agora), false, '60 s atrás')
  assert.equal(sincronizouHaPouco(null, agora), false)
  assert.equal(sincronizouHaPouco('lixo', agora), false, 'data inválida não pode travar o pull')
})
