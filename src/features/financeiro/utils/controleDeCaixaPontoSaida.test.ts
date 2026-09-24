/**
 * A aba "AUSÊNCIA PONTO SAÍDA" — a devolução de horas de quem não bateu a saída.
 *
 * Os casos vêm do arquivo real `CONTROLE DE CAIXA ATUAL`, aba com 10 colaboradores e total
 * R$ 2.065,15. O que estes testes cercam: **o valor pago não pode ser reescrito pelo sistema**, a
 * linha de total não pode virar gente, e reimportar não pode desfazer o que a pessoa marcou.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  lerPontoSaida, horaExtraDoPontoSaida, primeiroDiaDoTexto, ehAbaDePontoSaida, candidatosAoVinculo,
} from './controleDeCaixaPontoSaida'
import type { Matriz } from './controleDeCaixaPlanilha'
import type { HoraExtra } from '@/types'

// O cabeçalho REAL, com a quebra de linha dentro da célula que o arquivo traz.
const CAB: Matriz = [[
  'COLABORADOR', 'DIA', 'HORAS \nDESCONTADAS', 'HORAS \nEXTRAS', 'SALÁRIO', 'VALOR \nHORA',
  'VALOR \nHORA + 60%', 'VALOR HORAS EXTRAS', 'VALOR REF. HORAS \nDESCONTADAS', 'TOTAL', null,
]]

const AGORA = '2026-09-24T12:00:00.000Z'

test('a aba é reconhecida pelo nome, com e sem acento', () => {
  assert.equal(ehAbaDePontoSaida('AUSÊNCIA PONTO SAÍDA'), true)
  assert.equal(ehAbaDePontoSaida('ausencia de ponto saida'), true)
  assert.equal(ehAbaDePontoSaida('HORAS EXTRAS AGOSTO'), false)
})

test('🔴 "13 e 20/08" vira UM registro, com o texto cru preservado', () => {
  // São dois dias e um total só. Repartir inventaria número que a planilha não dá.
  const r = lerPontoSaida([...CAB,
    ['KAUÊ', '13 e 20/08', 8, 9.5, 4000, null, null, null, null, 421.8181818, 'Pago em 10/09'],
  ], { ano: 2026 })
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].data, '2026-08-13', 'a data é o PRIMEIRO dia — é por ela que ordena')
  assert.equal(r.linhas[0].diasTexto, '13 e 20/08')
  assert.equal(r.linhas[0].pagoEm, '2026-09-10', 'a coluna sem cabeçalho "Pago em 10/09"')
  assert.equal(primeiroDiaDoTexto('13 e 20/08', 2026), '2026-08-13')
})

test('🔴 a linha de total NÃO tem rótulo — e não pode virar um colaborador', () => {
  // No arquivo real ela é só a coluna TOTAL preenchida. Sem guarda, nasceria um colaborador
  // chamado "2065.148832" com o valor da aba inteira.
  const r = lerPontoSaida([...CAB,
    [' RENAN', new Date('2026-08-20T03:00:28.000Z'), 4, 4.5, 4000, null, null, null, null, 203.6363636, 'Pago em 10/09'],
    [null, null, null, null, null, null, null, null, null, 203.6363636, null],
  ], { ano: 2026 })
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].colaborador, 'RENAN')
  assert.equal(r.totalDeclaradoDaAba, 203.6363636)
})

test('🔴 grava o DECLARADO e denuncia a diferença — nunca reescreve o que já foi pago', () => {
  // WELLINGTON LUIZ, a maior divergência do arquivo: R$ 165,63 pagos × R$ 185,21 calculados.
  const r = lerPontoSaida([...CAB,
    ['WELLINGTON LUIZ', new Date('2026-08-20T03:00:28.000Z'), 4.5, 5, 3259.65, null, null, null, null, 165.63, 'Pago em 10/09'],
  ], { ano: 2026 })
  const l = r.linhas[0]
  assert.equal(l.totalDeclarado, 165.63)
  assert.ok(Math.abs(l.totalRecalculado - 185.2059) < 0.01, `recalculado ${l.totalRecalculado}`)
  assert.ok(Math.abs(l.diferenca - 19.58) < 0.02, `diferença ${l.diferenca}`)
  assert.equal(r.batem, 0)

  const he = horaExtraDoPontoSaida(l, { agora: AGORA })
  assert.equal(he.valor, 165.63, 'é o que saiu do caixa — regravar mudaria um pagamento feito')
  assert.equal(he.detalhe!.salario, 3259.65, 'os insumos viajam junto para a tela recalcular sozinha')
})

test('🔴 importar por cima do que foi digitado à mão preserva pago, pagoEm e entryId', () => {
  const r = lerPontoSaida([...CAB,
    ['MAELSON', '13 e 20/08', 8.1, 9.5, 3259.65, null, null, null, null, 346.2621818, null],
  ], { ano: 2026 })
  const existente: HoraExtra = {
    id: 'qualquer', workerId: 'w-1', workerNome: 'MAELSON', data: '2026-08-13', tipo: 'ponto-saida',
    valor: 346.26, pago: true, pagoEm: '2026-09-10', pagoPor: 'joão', entryId: 'entry-2065',
    origem: 'manual', createdAt: '2026-09-01T00:00:00.000Z',
  }
  const he = horaExtraDoPontoSaida(r.linhas[0], { agora: AGORA }, existente)
  assert.equal(he.pago, true)
  assert.equal(he.pagoEm, '2026-09-10')
  assert.equal(he.entryId, 'entry-2065', 'o vínculo com o caixa foi feito por uma pessoa')
  assert.equal(he.workerId, 'w-1')
  assert.equal(he.createdAt, '2026-09-01T00:00:00.000Z', 'quando nasceu não muda ao reimportar')
})

test('🔴 o id é o MESMO duas importações seguidas — senão o caixa pagaria em dobro', () => {
  const linhas: Matriz = [...CAB,
    ['KAUÊ', '13 e 20/08', 8, 9.5, 4000, null, null, null, null, 421.81, null],
  ]
  const a = horaExtraDoPontoSaida(lerPontoSaida(linhas, { ano: 2026 }).linhas[0], { agora: AGORA })
  const b = horaExtraDoPontoSaida(lerPontoSaida(linhas, { ano: 2026 }).linhas[0], { agora: '2026-10-01T00:00:00.000Z' })
  assert.equal(a.id, b.id)
})

test('a devolução não cria despesa: ela aponta para o lançamento que já está no caixa', () => {
  const r = lerPontoSaida([...CAB,
    ['RENAN', '20/08/2026', 4, 4.5, 4000, null, null, null, null, 203.64, null],
  ], { ano: 2026 })
  const he = horaExtraDoPontoSaida(r.linhas[0], { agora: AGORA, entryId: 'lancamento-2065' })
  assert.equal(he.entryId, 'lancamento-2065')
})

test('cabeçalho irreconhecível é RECUSA da aba inteira, não silêncio', () => {
  const r = lerPontoSaida([['A', 'B', 'C'], ['x', 1, 2]], { ano: 2026 })
  assert.equal(r.linhas.length, 0)
  assert.equal(r.problemas[0].gravidade, 'recusa')
})

test('⚠️ VALOR HORAS EXTRAS não pode ser lida como a coluna de HORAS EXTRAS', () => {
  // Casamento exato, nunca `includes`: a coluna de dinheiro contém a palavra da de horas, e trocar
  // as duas faria o recálculo divergir de todas as linhas sem ninguém entender por quê.
  const r = lerPontoSaida([...CAB,
    ['RENAN', '20/08/2026', 4, 4.5, 4000, 18.18, 29.09, 130.91, 72.73, 203.64, null],
  ], { ano: 2026 })
  assert.equal(r.linhas[0].horasExtras, 4.5)
  assert.equal(r.batem, 1, 'com as colunas certas, a conta fecha ao centavo')
})

test('🔴 o vínculo é PROPOSTO pelo valor — nunca casado sozinho', () => {
  // L214 do arquivo real: R$ 2.065,15, exatamente o total da aba.
  const entries = [
    { id: 'a', tipo: 'saida', valor: 300, data: '2026-09-10', descricao: 'DIESEL' },
    { id: 'b', tipo: 'saida', valor: 2065.15, data: '2026-09-10', descricao: 'HORAS EXTRAS E RESTITUIÇÃO DO DESCONTO…' },
    { id: 'c', tipo: 'saida', valor: 900, data: '2026-08-02', descricao: 'HORAS EXTRAS SEMANA' },
    { id: 'd', tipo: 'entrada', valor: 2065.15, data: '2026-09-10', descricao: 'MEDIÇÃO' },
  ]
  const r = candidatosAoVinculo(entries, 2065.148832, '2026-09-10')
  assert.equal(r[0].id, 'b', 'o valor ao centavo é o sinal mais forte')
  assert.equal(r[0].exato, true)
  assert.ok(!r.some((x) => x.id === 'd'), 'entrada nunca é candidata — a devolução é uma saída')
  assert.ok(!r.some((x) => x.id === 'a'))
})
