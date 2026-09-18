/**
 * Os consertos do Operacional — cada um por um defeito que já estava em produção.
 *
 * Testes de texto, como é o padrão do projeto para store com persist + auth + fila
 * (ver `financeiroTitulosStore.test.ts`): montar zustand, Supabase e sessão só para exercitar uma
 * guarda custaria mais do que vale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = async (rel: string) => semComentarios(await readFile(new URL(rel, import.meta.url), 'utf8'))

/**
 * ⚠️ O marco tem de ser a assinatura da IMPLEMENTAÇÃO. A interface declara os mesmos nomes bem
 * antes, e um marco que casa com ela devolve corte vazio — que passa como se tivesse conferido.
 */
function corpo(codigo: string, de: string, ate: string): string {
  const i = codigo.indexOf(de)
  const f = codigo.indexOf(ate)
  assert.ok(i >= 0, `não achei ${de}`)
  assert.ok(f > i, `o marco de fim (${ate}) veio antes do início — corte vazio`)
  return codigo.slice(i, f)
}

// ─── 🔴 Os metadados chegando ao servidor ─────────────────────────────────────

test('🔴 operacional_estado tem created_by — sem ele o fixOrg injeta e o PostgREST recusa', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20260918113625_operacional_importacoes_metadados.sql', import.meta.url),
    'utf8',
  )
  const tabela = sql.slice(sql.indexOf('create table if not exists public.operacional_estado'), sql.indexOf('alter table public.operacional_estado add column'))
  assert.match(tabela, /created_by uuid references auth\.users\(id\)/,
    'toda tabela que a fila toca precisa de created_by: o `fixOrg` repara a autoria de TODA op e, '
    + 'como o reparo dispara quando o campo é nulo, ele INJETA a coluna. Sem ela → PGRST204.')
  assert.match(sql, /alter table public\.operacional_estado add column if not exists created_by/,
    'quem já aplicou a versão anterior precisa ganhar a coluna sem recriar a tabela')
})

test('🔴 PGRST204 é silencioso — é por isso que a coluna faltando não aparecia na tela', async () => {
  const sync = await ler('../../lib/storeSync.ts')
  assert.match(sync, /CODIGOS_AGUARDANDO_SERVIDOR = new Set\(\[[^\]]*'PGRST204'/,
    'se um dia PGRST204 sair desta lista, o defeito passa a gritar — e este teste deixa de fazer sentido')
  assert.match(sync, /if \(row\.created_by === 'pending' \|\| row\.created_by == null/,
    'o fixOrg injeta created_by quando ele é nulo; é esse o contrato que a tabela precisa honrar')
})

test('a migração é reexecutável — toda policy tem drop antes', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20260918113625_operacional_importacoes_metadados.sql', import.meta.url),
    'utf8',
  )
  const criadas = [...sql.matchAll(/create policy (\w+) on/g)].map((m) => m[1])
  const dropadas = new Set([...sql.matchAll(/drop policy if exists (\w+) on/g)].map((m) => m[1]))
  assert.ok(criadas.length > 0)
  for (const p of criadas) {
    assert.ok(dropadas.has(p), `a policy ${p} não tem "drop policy if exists" — rodar o arquivo duas vezes quebra`)
  }
})

// ─── O gate que faltava nas ações de linha ────────────────────────────────────

test('🔴 criar, arquivar e desfazer barram sem papel — 42501 é fila TRAVADA', async () => {
  const s = await ler('./sabespStore.ts')
  assert.match(corpo(s, 'criarLinha: (aba, valores = {}) => {', 'duplicarLinha: (id) => {'),
    /if \(!podeEscreverTorre\(\)\.pode\)/)
  assert.match(corpo(s, 'alternarLinha: (id) => {', 'desfazer: () => {'),
    /if \(!podeEscreverTorre\(\)\.pode\)/)
  assert.match(corpo(s, 'desfazer: () => {', 'registrarImportacao: (batch, meta) => {'),
    /if \(!podeEscreverTorre\(\)\.pode\) return/)
})

test('`.pode` e não o objeto — o erro que deixou o gate morto no notasFiscaisStore', async () => {
  const s = await ler('./sabespStore.ts')
  assert.doesNotMatch(s, /if \(!podeEscreverTorre\(\)\)/,
    '`!objeto` é sempre falso; o gate nunca dispararia')
})

// ─── A permissão reativa ──────────────────────────────────────────────────────

test('🔴 a tela usa a permissão REATIVA, não um retrato do mount', async () => {
  const t = await ler('./SabespPanel.tsx')
  assert.match(t, /usePermissaoEscrita\(ROLES_TORRE_WRITE\)/,
    'as memberships chegam depois do primeiro render; com useMemo de deps vazias o `false` inicial '
    + 'congelava e a tela virava só-leitura para sempre, inclusive para owner')
  assert.doesNotMatch(t, /useMemo\(\(\) => podeEscreverTorre\(\)\.pode, \[\]\)/)
})

test('a tela DIZ por que está em modo leitura', async () => {
  const t = await ler('./SabespPanel.tsx')
  assert.match(t, /Modo leitura/)
  assert.match(t, /permissao\.explicacao/,
    '`PermissaoEscrita` já traz uma frase pronta em português — jogá-la fora era o problema')
})

// ─── Colunas: o padrão é TODAS (decisão do cliente) ───────────────────────────

test('🔴 a grade nasce com TODAS as colunas — sem botão obrigatório', async () => {
  const t = await ler('./SabespPanel.tsx')
  assert.match(t, /useState<'todas' \| 'preenchidas'>\('todas'\)/,
    'o cliente escolheu ver tudo depois de saber que 149 das 206 estão vazias')
  assert.match(t, /modoColunas === 'todas'\s*\n?\s*\? todasAsColunas/)
})

test('o rótulo da coluna sem título é o MESMO na tela e na exportação', async () => {
  const t = await ler('./SabespPanel.tsx')
  const x = await ler('./arquivoOperacional.ts')
  assert.match(t, /Campo \{c\.indice \+ 1\}/)
  assert.match(x, /`Campo \$\{c\.indice \+ 1\}`/)
  assert.doesNotMatch(t, /Campo auxiliar/, 'duas palavras para a mesma coluna confunde na conferência')
})

// ─── A grade que parou de cortar ──────────────────────────────────────────────

test('🔴 largura por CONTEÚDO, não uma medida só para todas', async () => {
  const t = await ler('./SabespPanel.tsx')
  assert.match(t, /larguraDaColuna/, 'min-w-32 em tudo era a causa do texto cortado')
  assert.match(t, /Math\.min\(420, Math\.max\(72/, 'precisa de piso e TETO — sem teto uma observação longa empurra a tabela')
  assert.doesNotMatch(t, /className="min-w-32 resize-x/)
})

test('a grade usa o padrão visual do Almoxarifado', async () => {
  const t = await ler('./SabespPanel.tsx')
  for (const marca of ['even:bg-\\[#2f2f2f\\]/70', 'hover:bg-\\[#3d3d3d\\]', 'align-top']) {
    assert.match(t, new RegExp(marca), `faltou ${marca} — é o padrão de tabela longa do app`)
  }
})

test('ordenar por coluna trata número como número', async () => {
  const t = await ler('./SabespPanel.tsx')
  assert.match(t, /alternarOrdem/)
  assert.match(t, /na !== null && nb !== null \? na - nb/,
    'sem isto "10" viria antes de "9" em qualquer coluna de quantidade')
})
