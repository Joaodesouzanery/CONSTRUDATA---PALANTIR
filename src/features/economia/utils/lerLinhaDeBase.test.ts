/**
 * O leitor da planilha da linha de base.
 *
 * O dado do período-espelho só existe no controle do cliente, e ele escreve competência de três
 * jeitos diferentes. Recusar a escrita dele é a forma mais rápida de a importação nunca ser usada.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lerCompetencia, lerLinhaDeBase } from './lerLinhaDeBase'
import type { Matriz } from '@/features/financeiro/utils/controleDeCaixaPlanilha'

const CAB: Matriz = [['MÊS', 'QUANTIDADE', 'CUSTO', 'HOMENS-HORA']]

// ─── A competência ────────────────────────────────────────────────────────────

test('as três escritas que aparecem em planilha de obra', () => {
  assert.equal(lerCompetencia('2025-08'), '2025-08')
  assert.equal(lerCompetencia('08/2025'), '2025-08')
  assert.equal(lerCompetencia('ago/25'), '2025-08')
  assert.equal(lerCompetencia('AGOSTO/2025'), '2025-08')
  assert.equal(lerCompetencia(new Date('2025-08-15T00:00:00')), '2025-08')
})

test('mês inválido é recusado, não arredondado', () => {
  assert.equal(lerCompetencia('13/2025'), null)
  assert.equal(lerCompetencia('2025-13'), null)
  assert.equal(lerCompetencia('xyz/25'), null)
  assert.equal(lerCompetencia(''), null)
})

test('ano de dois dígitos: 25 é 2025, 95 é 1995', () => {
  assert.equal(lerCompetencia('jan/25'), '2025-01')
  assert.equal(lerCompetencia('jan/95'), '1995-01')
})

// ─── A leitura ────────────────────────────────────────────────────────────────

test('lê os meses e ORDENA — a planilha do cliente nem sempre vem em ordem', () => {
  const r = lerLinhaDeBase([...CAB,
    ['mar/25', 900, 47000, 720],
    ['jan/25', 1000, 50000, 800],
    ['fev/25', 1200, 58000, 950],
  ])
  assert.equal(r.problemas.length, 0)
  assert.deepEqual(r.meses.map((m) => m.periodo), ['2025-01', '2025-02', '2025-03'])
  assert.equal(r.meses[0].quantidadeExecutada, 1000)
  assert.equal(r.meses[0].homensHora, 800)
})

test('homens-hora é opcional — nem todo cliente registra', () => {
  const r = lerLinhaDeBase([...CAB, ['jan/25', 1000, 50000, '']])
  assert.equal(r.problemas.length, 0)
  assert.equal(r.meses[0].homensHora, undefined)
})

test('⚠️ o MESMO mês duas vezes é recusado', () => {
  // Dobraria quantidade e custo — e o R$/unidade nem mudaria, então passaria despercebido.
  const r = lerLinhaDeBase([...CAB, ['jan/25', 1000, 50000], ['01/2025', 1000, 50000]])
  assert.equal(r.meses.length, 1)
  assert.ok(r.problemas.some((p) => /mais de uma vez/.test(p.motivo)))
})

test('linha de TOTAIS não vira mês', () => {
  const r = lerLinhaDeBase([...CAB, ['jan/25', 1000, 50000], ['TOTAL', 1000, 50000]])
  assert.equal(r.meses.length, 1)
  assert.equal(r.problemas.length, 0, 'e nem vira problema — é linha de fechamento, é normal')
})

test('valor não numérico aponta a linha e a coluna', () => {
  const r = lerLinhaDeBase([...CAB, ['jan/25', 'muito', 50000], ['fev/25', 1000, 'caro']])
  assert.equal(r.meses.length, 0)
  assert.equal(r.problemas[0].coluna, 'QUANTIDADE')
  assert.equal(r.problemas[0].conteudo, 'muito')
  assert.equal(r.problemas[1].coluna, 'CUSTO')
})

test('negativo é recusado — a linha de base é o que foi executado e gasto', () => {
  const r = lerLinhaDeBase([...CAB, ['jan/25', -100, 50000]])
  assert.equal(r.meses.length, 0)
  assert.ok(r.problemas.some((p) => /negativo/.test(p.motivo)))
})

test('valor em real brasileiro é entendido', () => {
  const r = lerLinhaDeBase([...CAB, ['jan/25', '1.000', 'R$ 50.000,00']])
  assert.equal(r.meses[0].custoBRL, 50000)
})

test('os apelidos de coluna que a planilha do cliente usa', () => {
  const r = lerLinhaDeBase([['COMPETÊNCIA', 'M2', 'GASTO', 'HH'], ['jan/25', 1000, 50000, 800]])
  assert.equal(r.problemas.length, 0)
  assert.equal(r.meses[0].quantidadeExecutada, 1000)
  assert.equal(r.meses[0].homensHora, 800)
})

test('planilha sem cabeçalho reconhecível avisa em vez de importar lixo', () => {
  const r = lerLinhaDeBase([['foo', 'bar'], ['1', '2']])
  assert.equal(r.meses.length, 0)
  assert.match(r.problemas[0].motivo, /cabeçalho/i)
})

test('planilha vazia não é planilha com problema', () => {
  const r = lerLinhaDeBase([...CAB])
  assert.equal(r.meses.length, 0)
  assert.equal(r.problemas.length, 0)
})
