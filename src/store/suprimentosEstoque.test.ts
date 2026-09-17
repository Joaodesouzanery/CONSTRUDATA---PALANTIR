/**
 * Estoque: o que não pode sumir, e a conta que faltava.
 *
 * ─── OS DOIS DEFEITOS ──────────────────────────────────────────────────────────
 * 1. `consumirMaterial` revertia a baixa em QUALQUER erro — inclusive rede caindo. A pessoa já
 *    tinha saído do almoxarifado com o material; o sistema desfazia por causa de wi-fi ruim, o
 *    modal já estava fechado, e o aviso ia só para `syncError`. Em obra, rede instável é o normal.
 * 2. A entrada pelo Mapa de Estoque registrava a movimentação e NÃO somava o saldo — cada entrada
 *    feita por ali deixava o estoque menor do que a prateleira.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { ehFalhaDefinitivaDeBaixa } from '@/store/suprimentosStore'

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = async (rel: string) => semComentarios(await readFile(new URL(rel, import.meta.url), 'utf8'))

// ─── A classificação, que é o que decide se uma retirada some ─────────────────

test('rede caindo é TRANSITÓRIO — a retirada não pode ser desfeita', () => {
  for (const m of [
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'The operation was aborted',
    'timeout of 8000ms exceeded',
    'Load failed',
    '',
  ]) assert.equal(ehFalhaDefinitivaDeBaixa(m), false, `"${m}" não pode ser tratado como definitivo`)
})

test('recusa explícita do servidor é DEFINITIVO — aí sim desfaz', () => {
  for (const m of [
    'new row violates row-level security policy',
    'permission denied for table suprimentos_estoque_itens',
    '42501',
    'item não encontrado',
    'quantidade inválida',
  ]) assert.equal(ehFalhaDefinitivaDeBaixa(m), true, `"${m}" precisa ser definitivo`)
})

test('o padrão é transitório — errar para "definitivo" APAGA retirada que aconteceu', () => {
  assert.equal(ehFalhaDefinitivaDeBaixa('erro desconhecido do servidor'), false)
  assert.equal(ehFalhaDefinitivaDeBaixa('500 Internal Server Error'), false)
})

// ─── O wiring, conferido no texto ─────────────────────────────────────────────

test('consumirMaterial NÃO reverte em falha transitória — enfileira', async () => {
  const s = await ler('./suprimentosStore.ts')
  const corpo = s.slice(s.indexOf('consumirMaterial: ('), s.indexOf('calcSemaforo: ('))
  assert.match(corpo, /if \(!ehFalhaDefinitivaDeBaixa\(motivo\)\) \{/)
  assert.match(corpo, /retiradasPendentes: \[\.\.\.s\.retiradasPendentes,/)
  // A reversão tem de continuar existindo para o caso definitivo — senão o saldo mente.
  assert.match(corpo, /movimentacoes: s\.movimentacoes\.filter\(\(m\) => m\.id !== mov\.id\)/)
})

test('a retirada pendente sobrevive ao reload', async () => {
  const s = await ler('./suprimentosStore.ts')
  const p = s.slice(s.indexOf('partialize: (s) => ({'), s.indexOf('version: 3'))
  assert.match(p, /retiradasPendentes: s\.retiradasPendentes/,
    'a fila existe porque a rede caiu — e quem está sem rede fecha a aba')
})

test('o estoque passou a ser persistido — e a migração parou de apagá-lo', async () => {
  const s = await ler('./suprimentosStore.ts')
  const p = s.slice(s.indexOf('partialize: (s) => ({'), s.indexOf('version: 3'))
  for (const c of ['depositos', 'estoqueItens', 'movimentacoes']) {
    assert.match(p, new RegExp(`${c}:\\s+s\\.${c}`), `${c} precisa estar no partialize`)
  }
  const mig = s.slice(s.indexOf('migrate: (persisted)'))
  for (const c of ['depositos', 'estoqueItens', 'movimentacoes']) {
    assert.doesNotMatch(mig, new RegExp(`delete state\\.${c}\\b`),
      `a migração ainda apaga ${c} — persistir e apagar em seguida não adianta nada`)
  }
})

test('a entrada de material é UMA ação — as duas telas não podem fazer a conta por fora', async () => {
  const store = await ler('./suprimentosStore.ts')
  const corpo = store.slice(store.indexOf('entradaMaterial: (itemId'), store.indexOf('addMovimentacao: (mov) => {'))
  assert.match(corpo, /updateItemEstoque\(itemId, \{ qtdDisponivel: item\.qtdDisponivel \+ qty \}\)/)
  assert.match(corpo, /addMovimentacao\(/)
  assert.match(corpo, /hojeLocalISO\(\)/, 'data em UTC fazia a entrada das 21h nascer no dia seguinte')

  for (const tela of ['MapaEstoquePanel', 'AlmoxarifadoPanel']) {
    const t = await ler(`../features/suprimentos/components/${tela}.tsx`)
    assert.match(t, /entradaMaterial\(/, `${tela} precisa usar a ação do store`)
    // O invariante é não chamar `addMovimentacao` direto: é a metade que esquece o saldo.
    // (`tipo: 'entrada'` ainda aparece nos formulários, e isso é legítimo.)
    assert.doesNotMatch(t, /addMovimentacao\(/,
      `${tela} ainda registra a movimentação à mão — foi assim que o saldo parou de ser somado`)
  }
})
