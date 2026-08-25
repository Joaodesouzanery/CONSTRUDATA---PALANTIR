/**
 * O indicador precisa dizer a verdade.
 *
 * O cliente relatou o ícone girando indefinidamente em "Enviando para a nuvem…". A causa era esta
 * regra, que era `syncing || pending > 0` e colapsava três situações diferentes numa só.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estadoDoSync, deveGirar } from './estadoDoSync'

const r = (p: Partial<Parameters<typeof estadoDoSync>[0]> = {}) =>
  ({ pending: 0, syncing: false, esperando: 0, estacionadas: 0, ...p })

test('fila vazia é "tudo salvo"', () => {
  assert.equal(estadoDoSync(r(), 0), 'tudo-salvo')
  assert.ok(!deveGirar('tudo-salvo'))
})

test('requisição em voo é "enviando", e só ela gira', () => {
  assert.equal(estadoDoSync(r({ pending: 3, syncing: true }), 0), 'enviando')
  assert.ok(deveGirar('enviando'))
})

test('op esperando o horário NÃO é "enviando" — e não gira', () => {
  // Era este o caso que deixava o ícone rodando por até 30 minutos dizendo "não precisa fazer nada".
  const e = estadoDoSync(r({ pending: 2, esperando: 2 }), 0)
  assert.equal(e, 'esperando')
  assert.ok(!deveGirar(e))
})

test('parte esperando e parte pronta ainda é "enviando"', () => {
  assert.equal(estadoDoSync(r({ pending: 3, esperando: 1 }), 0), 'enviando')
})

test('⚠️ op de outra empresa NÃO conta como envio', () => {
  // A causa principal do sintoma: elas nunca saem da fila e eram contadas como "enviando",
  // deixando o indicador girando para sempre, sem horário, sem aviso e sem rótulo.
  const e = estadoDoSync(r({ pending: 4, estacionadas: 4 }), 0)
  assert.equal(e, 'estacionado')
  assert.ok(!deveGirar(e))
})

test('estacionadas + uma de verdade: a de verdade manda', () => {
  assert.equal(estadoDoSync(r({ pending: 5, estacionadas: 4, syncing: true }), 0), 'enviando')
  assert.equal(estadoDoSync(r({ pending: 5, estacionadas: 4, esperando: 1 }), 0), 'esperando')
})

test('o que pede decisão humana vence tudo', () => {
  assert.equal(estadoDoSync(r({ pending: 9, syncing: true, estacionadas: 3 }), 1), 'precisa-atencao')
  assert.ok(!deveGirar('precisa-atencao'))
})

test('contagem inconsistente não vira estado impossível', () => {
  // Defesa contra `estacionadas > pending` (só aconteceria por corrida entre os dois contadores).
  assert.equal(estadoDoSync(r({ pending: 1, estacionadas: 5 }), 0), 'estacionado')
  assert.equal(estadoDoSync(r({ pending: 0, estacionadas: 0, esperando: 3 }), 0), 'tudo-salvo')
})
