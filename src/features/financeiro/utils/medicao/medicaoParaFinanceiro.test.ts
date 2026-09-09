/**
 * A medição virando Entrada no Financeiro.
 *
 * O teste que dá sentido aos outros é o 🔴 da pendência: se medição com item a conferir puder
 * gerar lançamento, toda a fila de exceção vira decoração e o preço não confirmado vira dinheiro
 * pela porta dos fundos.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { entradaDaMedicao, idDaEntradaDaMedicao, podeGerarEntrada } from './medicaoParaFinanceiro'
import type { ResultadoDaMedicao } from './motorDaMedicao'

const ORG = '11111111-1111-1111-1111-111111111111'
const CT = '13.546/25-00'

const resultado = (p: Partial<ResultadoDaMedicao> = {}): ResultadoDaMedicao => ({
  obra: 'BOI MALHADO', regiao: '02',
  linhas: [{ servicoCatalogoId: 'a', descricao: 'REDE', unidade: 'M', quantidade: 10,
    precoCheio: 100, fator: 0.6, precoComFator: 60, valor: 600, flag: 'ok' }],
  pendentes: [], total: 600, totalPendente: 0, podeFechar: true, ...p,
})

test('🔴 medição com item a conferir NÃO gera lançamento — e diz por quê', () => {
  const comPendencia = resultado({
    pendentes: [{ servicoCatalogoId: 'c', descricao: 'A CONFERIR', unidade: 'UN', quantidade: 1,
      precoCheio: 1000, fator: 0.6, precoComFator: 600, valor: 600, flag: 'bloco_deslocado_pdf',
      pendencia: 'preco_a_conferir', motivo: 'preço deslocado' }],
    totalPendente: 600, podeFechar: false,
  })
  const p = podeGerarEntrada(comPendencia, 'obra-1', '2026-06')
  assert.equal(p.pode, false)
  assert.ok(p.motivo && p.motivo.includes('1 item'), 'o motivo diz quantos, não só "não pode"')
})

test('sem obra cadastrada, sem competência ou sem valor também não gera', () => {
  assert.equal(podeGerarEntrada(resultado(), undefined, '2026-06').pode, false)
  assert.equal(podeGerarEntrada(resultado(), 'obra-1', '').pode, false)
  assert.equal(podeGerarEntrada(resultado(), 'obra-1', 'junho').pode, false)
  assert.equal(podeGerarEntrada(resultado({ total: 0, linhas: [] }), 'obra-1', '2026-06').pode, false)
  assert.equal(podeGerarEntrada(undefined, 'obra-1', '2026-06').pode, false, 'sem região escolhida')
})

test('medição limpa, obra e competência: pode', () => {
  const p = podeGerarEntrada(resultado(), 'obra-1', '2026-06')
  assert.equal(p.pode, true)
  assert.equal(p.motivo, undefined)
})

test('🔴 o id é determinístico — gerar duas vezes ATUALIZA, não duplica', () => {
  const a = idDaEntradaDaMedicao(ORG, CT, 'BOI MALHADO', '2026-06')
  const b = idDaEntradaDaMedicao(ORG, CT, 'BOI MALHADO', '2026-06')
  assert.equal(a, b)
  // e muda com cada parte da identidade
  assert.notEqual(a, idDaEntradaDaMedicao(ORG, CT, 'SAKURA', '2026-06'))
  assert.notEqual(a, idDaEntradaDaMedicao(ORG, CT, 'BOI MALHADO', '2026-07'))
  assert.notEqual(a, idDaEntradaDaMedicao(ORG, 'OUTRO', 'BOI MALHADO', '2026-06'))
})

test('a diferença de caixa/acento no nome da obra não cria lançamento novo', () => {
  assert.equal(
    idDaEntradaDaMedicao(ORG, CT, 'BOI MALHADO', '2026-06'),
    idDaEntradaDaMedicao(ORG, CT, ' boi  malhado ', '2026-06'),
  )
})

test('a Entrada guarda de onde veio, e o valor é o do motor', () => {
  const e = entradaDaMedicao(resultado(), { orgId: ORG, numeroContrato: CT, obraId: 'obra-1', competencia: '2026-06', data: '2026-06-01' })
  assert.equal(e.tipo, 'entrada')
  assert.equal(e.categoria, 'medicao')
  assert.equal(e.valor, 600)
  assert.equal(e.obraId, 'obra-1')
  assert.equal(e.descricao, 'Medição 06/2026 — BOI MALHADO')
  assert.equal(e.id, idDaEntradaDaMedicao(ORG, CT, 'BOI MALHADO', '2026-06'))
  assert.equal(e.sourceMedicaoId, e.id, 'é o marcador de procedência — dá para voltar ao item de contrato')
  assert.ok(e.referencia!.includes(CT))
  assert.ok(e.notas!.includes('item a item'))
})
