/**
 * O título "recebido" deixa de nascer órfão.
 *
 * ─── O QUE ESTAVA QUEBRADO ─────────────────────────────────────────────────────
 * `titulosDoFaturamento` já cria o título direto como `status: 'pago'` quando a nota do extrato
 * está "Recebido" — mas nunca com `entryId`. E `baixarTitulo` bloqueava por `status === 'pago'`,
 * tratando "já pago" e "pago mas nunca lançado" como o mesmo caso. `upsertTitulos` (o caminho que
 * grava o título vindo do extrato) nunca chamava `baixarTitulo`. Resultado: a receita nunca virava
 * `FinanceiroEntry`, embora o próprio comentário do `faturamentoParaFinanceiro.ts` prometesse que
 * "nasce recebida cria e baixa no mesmo passo".
 *
 * `criarEntryDaBaixa` é pura (sem zustand/persist/auth) e é testada de verdade abaixo. O resto —
 * a guarda de `baixarTitulo` e o reparo automático em `upsertTitulos`/`pull` — é verificado no
 * texto do arquivo, como já é o padrão para este tipo de store (ver `rdoObraNoEvento.test.ts`):
 * montar o zustand com persist + auth + fila de sync só para checar uma guarda custaria mais do
 * que vale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { criarEntryDaBaixa } from '@/features/financeiro/utils/criarEntryDaBaixa'
import type { FinanceiroTitulo } from '@/types'

async function codigoDoStore(): Promise<string> {
  const bruto = await readFile(new URL('./financeiroTitulosStore.ts', import.meta.url), 'utf8')
  return bruto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\/[^\n'"`]*$/gm, '')
}

const tituloBase: FinanceiroTitulo = {
  id: 'titulo-1',
  tipo: 'receber',
  descricao: 'Medição #4',
  parceiro: 'Construtora X',
  valor: 41_200,
  vencimento: '2026-09-30',
  obraId: 'obra-1',
  numeroDoc: 'MED-04',
  categoria: 'medicao',
  status: 'pago',
  dataPagamento: '2026-09-05',
  createdAt: '2026-09-01T00:00:00.000Z',
}

test('criarEntryDaBaixa: usa a dataPagamento recebida, não a de hoje', () => {
  const entry = criarEntryDaBaixa(tituloBase, 'org-1', tituloBase.dataPagamento!)
  assert.equal(entry.data, '2026-09-05')
  assert.equal(entry.tipo, 'entrada')
  assert.equal(entry.valor, 41_200)
  assert.equal(entry.obraId, 'obra-1')
  assert.equal(entry.sourceTituloId, 'titulo-1')
})

test('criarEntryDaBaixa: o id é derivado do título — chamar duas vezes dá o MESMO id', () => {
  const a = criarEntryDaBaixa(tituloBase, 'org-1', '2026-09-05')
  const b = criarEntryDaBaixa(tituloBase, 'org-1', '2026-09-05')
  assert.equal(a.id, b.id, 'o id precisa ser determinístico — é o que evita lançamento duplicado')
})

test('criarEntryDaBaixa: título "pagar" vira saída, "receber" vira entrada', () => {
  const pagar = criarEntryDaBaixa({ ...tituloBase, tipo: 'pagar' }, 'org-1', '2026-09-05')
  assert.equal(pagar.tipo, 'saida')
  const receber = criarEntryDaBaixa({ ...tituloBase, tipo: 'receber' }, 'org-1', '2026-09-05')
  assert.equal(receber.tipo, 'entrada')
})

test('baixarTitulo: a guarda bloqueia por entryId já existente, não por status pago', async () => {
  const s = await codigoDoStore()
  assert.match(
    s,
    /if \(!t \|\| t\.entryId\) return/,
    'a guarda de baixarTitulo precisa checar t.entryId, não t.status === "pago" — senão um título ' +
      'que nasceu pago sem lançamento fica bloqueado para sempre',
  )
  assert.doesNotMatch(
    s,
    /if \(!t \|\| t\.status === 'pago'\) return/,
    'a guarda antiga voltou — ela trata "já pago" e "pago sem lançamento" como o mesmo caso',
  )
})

test('baixarTitulo: sem opts, prefere a dataPagamento do próprio título à data de hoje', async () => {
  const s = await codigoDoStore()
  assert.match(
    s,
    /opts\?\.dataPagamento \?\? t\.dataPagamento \?\? hojeLocalISO\(\)/,
    'reparar um título que já tinha dataPagamento própria não pode trocá-la pela data de hoje — ' +
      'isso move a competência do lançamento na DRE',
  )
})

test('upsertTitulos: repara automaticamente título que chega pago sem entryId', async () => {
  const s = await codigoDoStore()
  // ⚠️ `addBoleto:` sozinho casaria primeiro com a INTERFACE (bem antes da implementação) —
  // por isso a assinatura completa da implementação (`addBoleto: (input) => {`) como fim do corte.
  const corpo = s.slice(s.indexOf('upsertTitulos: (titulos0)'), s.indexOf('addBoleto: (input) => {'))
  assert.match(
    corpo,
    /for \(const t of titulos\) if \(t\.status === 'pago' && !t\.entryId\) get\(\)\.baixarTitulo/,
    'upsertTitulos precisa reparar título pago-sem-entryId (ex.: nota "Recebido") — senão a ' +
      'receita do extrato de faturamento nunca vira lançamento',
  )
})

test('pull: repara título já corrompido em produção ao sincronizar', async () => {
  const s = await codigoDoStore()
  const corpo = s.slice(s.indexOf('pull: async () =>'))
  assert.match(
    corpo,
    /for \(const t of merged\) if \(t\.status === 'pago' && !t\.entryId\) get\(\)\.baixarTitulo/,
    'pull precisa reparar título pago-sem-entryId vindo do servidor — senão um caso anterior ao ' +
      'conserto nunca sara neste aparelho',
  )
})

test('upsertTitulos MESCLA: o extrato de faturamento não rebaixa um título já pago', async () => {
  const s = await codigoDoStore()
  const corpo = s.slice(s.indexOf('upsertTitulos: (titulos0)'), s.indexOf('addBoleto: (input) => {'))
  assert.match(
    corpo,
    /if \(!anterior\?\.entryId\) return novo/,
    'o `entryId` é a prova de que o dinheiro andou — onde ele existe, o pagamento vence o extrato',
  )
  assert.match(
    corpo,
    /status: 'pago' as const,\s*\n\s*entryId: anterior\.entryId/,
    'preservar o entryId sem restaurar o status deixaria um "pendente" com lançamento — o inverso ' +
      'do bug, e igualmente incoerente',
  )
  assert.doesNotMatch(
    corpo,
    /titulos: \[\.\.\.titulos0,/,
    'gravar a lista recebida crua é exatamente o que revertia a baixa feita em Cobranças',
  )
})

test('upsertTitulos: quem NUNCA foi baixado continua vindo inteiro do extrato', async () => {
  const s = await codigoDoStore()
  const corpo = s.slice(s.indexOf('upsertTitulos: (titulos0)'), s.indexOf('addBoleto: (input) => {'))
  // Sem `entryId` anterior, o título novo passa direto: valor, vencimento e nº do documento têm de
  // continuar saindo da NOTA, que é a fonte certa para o lado comercial.
  assert.match(corpo, /const anterior = anteriores\.get\(novo\.id\)/)
})
