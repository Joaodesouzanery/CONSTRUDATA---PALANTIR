/**
 * Estoque parado.
 *
 * O teste 🔴 é o da distinção que o resto do sistema mantém: **"nunca saiu" não é "parado há 0
 * dias"**. Se as duas situações colapsarem, o item encalhado desde a compra desaparece no meio dos
 * que acabaram de chegar — que é exatamente o item que a fila existe para achar.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ItemEstoque, MovimentacaoEstoque } from '@/types'
import { estoqueParado, situacaoDoEstoque, diasEntre } from './estoqueParado'

const HOJE = '2026-09-10'

const item = (p: Partial<ItemEstoque> & { id: string }): ItemEstoque => ({
  depositoId: 'dep-1', descricao: 'Item', unidade: 'un',
  qtdDisponivel: 10, qtdReservada: 0, qtdTransito: 0, estoqueMinimo: 0,
  custoUnitario: 100, ...p,
})

const mov = (itemId: string, tipo: MovimentacaoEstoque['tipo'], dataMovimento: string): MovimentacaoEstoque =>
  ({ id: crypto.randomUUID(), itemId, depositoId: 'dep-1', tipo, quantidade: 1, dataMovimento })

test('dias entre datas não depende de fuso', () => {
  assert.equal(diasEntre('2026-09-01', '2026-09-10'), 9)
  assert.equal(diasEntre('2026-09-10', '2026-09-10'), 0)
})

test('🔴 item que NUNCA saiu não é "parado há 0 dias"', () => {
  const s = situacaoDoEstoque([item({ id: 'a' })], [mov('a', 'entrada', '2026-01-05')], { hoje: HOJE })
  assert.equal(s[0].situacao, 'nunca-saiu')
  assert.equal(s[0].diasParado, null, 'null é "não sei desde quando", não zero')
  assert.equal(s[0].ultimaSaida, null)
  assert.equal(s[0].primeiraEntrada, '2026-01-05', 'mas dá para dizer desde quando ele está na casa')
})

test('a última saída manda, mesmo com movimentações fora de ordem', () => {
  const s = situacaoDoEstoque([item({ id: 'a' })], [
    mov('a', 'saida', '2026-08-01'),
    mov('a', 'saida', '2026-09-08'),
    mov('a', 'saida', '2026-07-15'),
  ], { hoje: HOJE })
  assert.equal(s[0].ultimaSaida, '2026-09-08')
  assert.equal(s[0].diasParado, 2)
  assert.equal(s[0].situacao, 'girando')
})

test('o limite de dias decide parado × girando, e é configurável', () => {
  const movs = [mov('a', 'saida', '2026-08-05')]   // 36 dias até HOJE
  const com = (diasParaParar?: number) =>
    situacaoDoEstoque([item({ id: 'a' })], movs, { hoje: HOJE, diasParaParar })[0]
  assert.equal(com().diasParado, 36)
  assert.equal(com().situacao, 'parado', 'padrão de 30 dias')
  assert.equal(com(60).situacao, 'girando', 'com o limite em 60, 36 dias ainda gira')
})

test('só entrada e saída contam — transferência e ajuste não são consumo', () => {
  const s = situacaoDoEstoque([item({ id: 'a' })], [
    mov('a', 'transferencia', '2026-09-09'),
    mov('a', 'ajuste', '2026-09-09'),
  ], { hoje: HOJE })
  assert.equal(s[0].situacao, 'nunca-saiu', 'mover de depósito não é o material sendo usado')
})

test('⚠️ item zerado fica de fora — não há dinheiro parado no que não está lá', () => {
  const s = situacaoDoEstoque([item({ id: 'a', qtdDisponivel: 0 })], [], { hoje: HOJE })
  assert.equal(s.length, 0)
})

test('o valor parado é o que está na prateleira × o custo do item', () => {
  const s = situacaoDoEstoque([item({ id: 'a', qtdDisponivel: 7, custoUnitario: 12.5 })], [], { hoje: HOJE })
  assert.equal(s[0].valorParado, 87.5)
  assert.equal(s[0].semCusto, false)
})

test('🔴 item sem custo entra na fila, com o valor marcado como desconhecido', () => {
  // Escondê-lo por não ter preço seria trocar um buraco por outro: ele é um problema conhecido
  // de tamanho desconhecido.
  const r = estoqueParado([item({ id: 'a', custoUnitario: undefined })], [], { hoje: HOJE })
  assert.equal(r.fila.length, 1)
  assert.equal(r.fila[0].semCusto, true)
  assert.equal(r.fila[0].valorParado, 0)
  assert.equal(r.semCusto, 1)
  assert.equal(r.valorParado, 0, 'e não infla o total com um número inventado')
})

test('a fila traz só o que não gira, do mais caro para o mais barato', () => {
  const itens = [
    item({ id: 'gira', descricao: 'Gira', qtdDisponivel: 1, custoUnitario: 1000 }),
    item({ id: 'caro', descricao: 'Caro', qtdDisponivel: 10, custoUnitario: 500 }),
    item({ id: 'barato', descricao: 'Barato', qtdDisponivel: 2, custoUnitario: 10 }),
  ]
  const movs = [
    mov('gira', 'saida', '2026-09-09'),
    mov('caro', 'saida', '2026-06-01'),
  ]
  const r = estoqueParado(itens, movs, { hoje: HOJE })
  assert.deepEqual(r.fila.map((x) => x.item.id), ['caro', 'barato'])
  assert.equal(r.valorParado, 5020)
  assert.equal(r.parados, 1)
  assert.equal(r.nuncaSairam, 1)
  assert.equal(r.total, 3, 'os três foram olhados; um está girando')
})

test('o recorte por obra separa o almoxarifado de cada uma', () => {
  const itens = [item({ id: 'a', siteId: 'obra-1' }), item({ id: 'b', siteId: 'obra-2' })]
  const r = estoqueParado(itens, [], { hoje: HOJE, siteId: 'obra-1' })
  assert.deepEqual(r.fila.map((x) => x.item.id), ['a'])
})
