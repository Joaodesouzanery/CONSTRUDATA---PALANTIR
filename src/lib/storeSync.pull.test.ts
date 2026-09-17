/**
 * O pull pagina — e o reconcile do RDO não apaga custo sem prova.
 *
 * ─── O QUE ESTAVA QUEBRADO ─────────────────────────────────────────────────────
 * `pullTable` mandava um SELECT sem `.range()`. O PostgREST corta em `max_rows` (1000 por padrão)
 * e devolve a página truncada **sem erro nenhum** — não há como o chamador distinguir "a empresa
 * tem 1000 registros" de "tem 4000 e você recebeu os 1000 primeiros".
 *
 * Isso não era um detalhe de listagem: o `pull` do RDO usa a lista para decidir quais RDOs "não
 * existem mais" e APAGAR os lançamentos financeiros deles — `type: 'delete'` em
 * `financeiro_entries`, que é hard delete. Com a lista truncada, materiais e mão de obra de RDOs
 * válidos sumiam do Fluxo e da DRE, sem volta. A conta do cliente: ~176 RDOs/mês no Lançamento
 * Rápido, ou seja ~6 meses até bater no teto.
 *
 * Testado no texto do arquivo — montar o cliente Supabase e o zustand só para exercitar uma query
 * custaria mais do que vale, e é o padrão já usado em `financeiroTitulosStore.test.ts`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

async function codigo(rel: string): Promise<string> {
  return semComentarios(await readFile(new URL(rel, import.meta.url), 'utf8'))
}

test('pullTable pagina com .range — não confia numa resposta única', async () => {
  const s = await codigo('./storeSync.ts')
  assert.match(s, /\.range\(inicio, inicio \+ PAGINA_DO_PULL - 1\)/,
    'sem .range o PostgREST corta em max_rows e devolve a página truncada sem erro')
  assert.match(s, /if \(lote\.length < PAGINA_DO_PULL\) break/,
    'a parada tem de ser "veio página curta", não um número fixo de voltas')
})

test('pullTable tem teto — o laço não pode ser infinito se o servidor mentir', async () => {
  const s = await codigo('./storeSync.ts')
  assert.match(s, /paginado\.length >= TETO_DO_PULL/)
})

test('a página pedida é do tamanho do max_rows padrão — pedir mais não adianta', async () => {
  const s = await codigo('./storeSync.ts')
  assert.match(s, /const PAGINA_DO_PULL = 1000/)
})

test('o reconcile do RDO não poda quando o pull veio vazio e há RDO local', async () => {
  const s = await codigo('../store/rdoStore.ts')
  assert.match(s, /const podeP = rows\.length > 0 \|\| local === 0/,
    'servidor mudo não é prova de exclusão em massa')
  assert.match(s, /if \(!podeP\) \{ get\(\)\.syncExecutionToPlanejamento\(\); return \}/,
    'sem a guarda DENTRO do setTimeout, a poda roda do mesmo jeito')
})

test('a poda continua existindo — a guarda não pode ter desligado o reconcile', async () => {
  const s = await codigo('../store/rdoStore.ts')
  assert.match(s, /orfaos\.forEach\(\(rid\) => fin\.removeRdoEntries\(rid\)\)/,
    'excluir um RDO de verdade PRECISA continuar limpando o Financeiro')
  assert.match(s, /orfaos\.forEach\(\(rid\) => mo\.removeRdoTimecards\(rid\)\)/)
})
