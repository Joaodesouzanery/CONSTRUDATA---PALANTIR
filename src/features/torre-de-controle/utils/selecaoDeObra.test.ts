/**
 * 🔴 O teste que faltava — e a falta dele deixou passar um bug que gravava o contrato de uma obra
 * dentro de outra, em produção.
 *
 * Não havia UM teste sobre a gravação do contrato: nem roteamento por id, nem preservação da
 * seleção, nem reset de rascunho. Os testes da Torre eram todos de utilitários puros, e este
 * caminho — o que mexe em dinheiro de cliente — estava inteiramente descoberto.
 *
 * O primeiro teste aqui falha na versão anterior do código.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { proximaSelecao } from './selecaoDeObra'

const obras = (...ids: string[]) => ids.map((id) => ({ id }))

test('🔴 sincronizar NÃO troca a obra que a pessoa escolheu', () => {
  // O cenário real: a pessoa clicou na SQS 314; um `pull()` em voo resolve 300 ms depois. A lista
  // volta com a EXCELLENCE em primeiro (é a cadastrada mais recentemente — `created_at DESC`) e a
  // SQS no fim (`mergePull` empurra para lá quem tem gravação pendente).
  //
  // Antes do conserto isto devolvia 'excellence', a tela trocava de obra no meio da digitação, e o
  // "Salvar" gravava o contrato da SQS dentro da EXCELLENCE.
  assert.equal(proximaSelecao('sqs-314', obras('excellence', 'outra', 'sqs-314')), 'sqs-314')
})

test('a obra escolhida é mantida esteja onde estiver na lista', () => {
  assert.equal(proximaSelecao('b', obras('a', 'b', 'c')), 'b')
  assert.equal(proximaSelecao('a', obras('a', 'b', 'c')), 'a')
  assert.equal(proximaSelecao('c', obras('a', 'b', 'c')), 'c')
})

test('sem escolha nenhuma, a primeira da lista entra — a pré-seleção continua existindo', () => {
  // Ela é útil para quem tem uma obra só, e foi decisão explícita mantê-la.
  assert.equal(proximaSelecao(null, obras('a', 'b')), 'a')
  assert.equal(proximaSelecao(undefined, obras('a', 'b')), 'a')
})

test('🔴 obra escolhida que SUMIU da lista é reselecionada — a tela não pode apontar para o nada', () => {
  // Some por exclusão de outro usuário, por troca de empresa ou por filtro. Manter a seleção aqui
  // seria o erro oposto: a tela ficaria mostrando uma obra que não existe mais.
  assert.equal(proximaSelecao('apagada', obras('a', 'b')), 'a')
})

test('lista vazia devolve null, e não estoura', () => {
  assert.equal(proximaSelecao('a', []), null)
  assert.equal(proximaSelecao(null, []), null)
})
