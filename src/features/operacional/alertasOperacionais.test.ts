/**
 * Os alertas saem do DADO IMPORTADO — e não podem acusar quem não deve.
 *
 * ⚠️ A regra antiga do lookahead procurava /RESTRI|NÃO|NAO/ no texto da situação. Ou seja: uma
 * linha dizendo "NÃO HÁ RESTRIÇÃO" virava alerta de restrição pendente — o oposto do que ela diz.
 * Alerta falso é pior que alerta nenhum: ensina a ignorar a lista inteira.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { alertasDaOperacao } from '@/features/operacional/alertasOperacionais'
import type { LinhaOperacional, SabespSheetId } from '@/features/operacional/sabespStore'

const linha = (aba: SabespSheetId, valores: Record<string, string>, ativa = true): LinhaOperacional =>
  ({ id: `${aba}-x`, aba, chave: 'x', valores, origem: 'planilha', ativa })

test('OS concluída sem foto vira alerta ALTO', () => {
  const a = alertasDaOperacao([linha('ordens_servico', { 'STATUS DA OS': 'CONCLUÍDA', 'FOTO ANTES': '', 'FOTO DEPOIS': '' })])
  assert.equal(a.length, 1)
  assert.equal(a[0].gravidade, 'alta')
  assert.match(a[0].titulo, /foto/i)
})

test('OS concluída COM as duas fotos não alerta', () => {
  assert.deepEqual(
    alertasDaOperacao([linha('ordens_servico', { 'STATUS DA OS': 'CONCLUÍDA', 'FOTO ANTES': 'sim', 'FOTO DEPOIS': 'sim' })]),
    [],
  )
})

test('OS em andamento não é cobrada por evidência — ainda não acabou', () => {
  assert.deepEqual(
    alertasDaOperacao([linha('ordens_servico', { 'STATUS DA OS': 'EM ANDAMENTO', 'FOTO ANTES': '' })]),
    [],
  )
})

test('🔴 pavimento: coluna AUSENTE é silêncio, não acusação', () => {
  // Acusar por falta de informação é o que enche a tela de alerta falso.
  const a = alertasDaOperacao([linha('ordens_servico', {
    'STATUS DA OS': 'CONCLUÍDA', 'FOTO ANTES': 'x', 'FOTO DEPOIS': 'x',
  })])
  assert.deepEqual(a, [])
})

test('pavimento presente e não reposto alerta', () => {
  const a = alertasDaOperacao([linha('ordens_servico', {
    'STATUS DA OS': 'CONCLUÍDA', 'FOTO ANTES': 'x', 'FOTO DEPOIS': 'x', 'PAVIMENTO REPOSTO?': 'NÃO',
  })])
  assert.equal(a.length, 1)
  assert.match(a[0].titulo, /pavimento/i)
})

test('🔴 "NÃO HÁ RESTRIÇÃO" NÃO vira alerta — era o defeito da regra antiga', () => {
  const a = alertasDaOperacao([linha('lookahead', {
    'RESTRIÇÃO': 'NÃO HÁ RESTRIÇÃO', 'RESTRIÇÃO REMOVIDA?': 'SIM',
  })])
  assert.deepEqual(a, [], 'a palavra "NÃO" no texto não pode disparar alerta')
})

test('restrição de verdade, não removida, vira alerta', () => {
  const a = alertasDaOperacao([linha('lookahead', {
    'RESTRIÇÃO': 'Falta licença da prefeitura', 'RESTRIÇÃO REMOVIDA?': 'NÃO',
  })])
  assert.equal(a.length, 1)
  assert.match(a[0].titulo, /licença/i)
})

test('restrição sem descrição não alerta — não há o que cobrar', () => {
  assert.deepEqual(alertasDaOperacao([linha('lookahead', { 'RESTRIÇÃO': '', 'RESTRIÇÃO REMOVIDA?': 'NÃO' })]), [])
})

test('ocorrência aberta alerta; encerrada não', () => {
  assert.equal(alertasDaOperacao([linha('ocorrencias', { STATUS: 'ABERTA' })]).length, 1)
  assert.equal(alertasDaOperacao([linha('ocorrencias', { STATUS: 'ENCERRADA' })]).length, 0)
})

test('ata com pendência URGENTE sobe para gravidade alta', () => {
  const a = alertasDaOperacao([linha('atas', {
    'PENDÊNCIA / AÇÃO': 'Enviar projeto', STATUS: 'ABERTA', PRIORIDADE: 'URGENTE', PRAZO: '20/09',
  })])
  assert.equal(a[0].gravidade, 'alta')
  assert.match(a[0].titulo, /20\/09/)
})

test('ata concluída não alerta', () => {
  assert.deepEqual(alertasDaOperacao([linha('atas', { 'PENDÊNCIA / AÇÃO': 'X', STATUS: 'CONCLUÍDA' })]), [])
})

test('documento de equipe vencendo alerta com o nome da pessoa', () => {
  const a = alertasDaOperacao([linha('equipe', { NOME: 'José da Silva', ALERTA: 'ASO VENCIDO' })])
  assert.equal(a.length, 1)
  assert.match(a[0].titulo, /José da Silva/)
})

test('acento e caixa no título da coluna não escondem o campo', () => {
  const a = alertasDaOperacao([linha('lookahead', { 'RESTRICAO': 'Falta topografia', 'restrição removida?': 'nao' })])
  assert.equal(a.length, 1)
})

test('linha inativa (sumiu da planilha) não gera alerta', () => {
  assert.deepEqual(
    alertasDaOperacao([linha('ordens_servico', { 'STATUS DA OS': 'CONCLUÍDA', 'FOTO ANTES': '' }, false)]),
    [],
  )
})

test('os altos vêm primeiro — é a ordem em que se resolve', () => {
  const a = alertasDaOperacao([
    linha('ocorrencias', { STATUS: 'ABERTA' }),
    linha('equipe', { NOME: 'A', ALERTA: 'VENCIDO' }),
  ])
  assert.equal(a[0].gravidade, 'alta')
  assert.equal(a[1].gravidade, 'media')
})
