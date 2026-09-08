#!/usr/bin/env node
/**
 * QA de isolamento entre empresas — a parte que dá para provar SEM acesso ao banco.
 *
 * Quatro conferências estáticas sobre o código, cada uma contra um vazamento real:
 *  1. Todo store limpo na troca de empresa (`resetTenantScopedRuntimeStores`) tem de exportar
 *     `ensureTenantScope` OU `clearData`/`reset`. O fallback de `auth.ts` é `state.reset?.()` — um
 *     store sem nenhum dos três é limpo por NADA, em silêncio, e o dado da empresa anterior fica na
 *     memória para a próxima.
 *  2. Toda função `*ToRow` carimba `organization_id`. Linha sem org é linha que a RLS rejeita (e a
 *     fila prende) ou, pior, que uma policy frouxa deixa passar sem dono.
 *  3. Toda escrita direta `.from('…').insert/upsert` fora da fila leva `organization_id`.
 *  4. Toda tabela do inventário de auditoria tem policy de SELECT por `organization_id` em alguma
 *     migração — é o que impede uma empresa ler a outra.
 *
 * ⚠️ Isto NÃO substitui o roteiro de tela (`docs/QA_ISOLAMENTO_WCR_COMPIZZO.md`): o código pode
 * estar certo e o banco em produção estar sem uma migração. Os dois juntos é que provam.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ `fileURLToPath`, não `.pathname`: a raiz do projeto tem espaço no nome e viraria `%20`.
const RAIZ = fileURLToPath(new URL('../../', import.meta.url))
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8')
let falhas = 0
const conferir = (ok, oQue, detalhe = '') => {
  console.log(`  ${ok ? 'OK    ' : 'FALHOU'} ${oQue}${detalhe ? `  ${detalhe}` : ''}`)
  if (!ok) falhas++
}

// ── 1. stores da troca de empresa ─────────────────────────────────────────────
console.log('\n=== 1. cada store limpo na troca de empresa sabe se limpar ===')
const auth = ler('src/lib/auth.ts')
const bloco = auth.slice(auth.indexOf('async function resetTenantScopedRuntimeStores'), auth.indexOf('for (const result of stores)'))
const stores = [...bloco.matchAll(/import\('@\/store\/(\w+)'\)/g)].map((m) => m[1])
conferir(stores.length >= 40, `${stores.length} stores na lista de troca`)
const semLimpeza = []
const soFallback = []
for (const nome of stores) {
  const src = ler(`src/store/${nome}.ts`)
  const temScope = /ensureTenantScope\s*[:(]/.test(src)
  const temClear = /\bclearData\s*[:(]/.test(src)
  const temReset = /\breset\s*[:(]/.test(src)
  if (!temScope && !temClear && !temReset) semLimpeza.push(nome)
  else if (!temScope) soFallback.push(nome)
}
conferir(semLimpeza.length === 0, 'nenhum store fica sem limpeza nenhuma', semLimpeza.join(', '))
console.log(`  info   ${soFallback.length} store(s) dependem só do fallback clearData/reset (sem ensureTenantScope):`)
console.log(`         ${soFallback.join(', ')}`)

// ── 2. *ToRow carimba organization_id ─────────────────────────────────────────
console.log('\n=== 2. toda linha que sobe leva organization_id ===')
const arquivosStore = readdirSync(join(RAIZ, 'src/store')).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
const toRowSemOrg = []
let toRows = 0
for (const f of arquivosStore) {
  const src = ler(`src/store/${f}`)
  for (const m of src.matchAll(/function (\w+ToRow)\s*\([^)]*\)[^{]*\{/g)) {
    toRows++
    // o corpo: até o fechamento do primeiro nível de chaves
    let i = m.index + m[0].length, nivel = 1
    while (i < src.length && nivel > 0) { if (src[i] === '{') nivel++; else if (src[i] === '}') nivel--; i++ }
    const corpo = src.slice(m.index, i)
    if (!/organization_id/.test(corpo)) toRowSemOrg.push(`${f}:${m[1]}`)
  }
}
conferir(toRows >= 40, `${toRows} funções *ToRow encontradas`)
conferir(toRowSemOrg.length === 0, 'todas carimbam organization_id', toRowSemOrg.join(', '))

// ── 3. escritas diretas fora da fila ──────────────────────────────────────────
console.log('\n=== 3. escrita direta .from().insert/upsert leva organization_id ===')
const diretasSemOrg = []
let diretas = 0
for (const dir of ['src/store', 'src/lib']) {
  for (const f of readdirSync(join(RAIZ, dir)).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
    const src = ler(`${dir}/${f}`)
    for (const m of src.matchAll(/\.from\('([a-z_]+)'\)\s*\n?\s*\.(insert|upsert)\(/g)) {
      diretas++
      const tabela = m[1]
      if (['profiles', 'organizations', 'memberships', 'app_state', 'user_routines'].includes(tabela)) continue  // por usuário / por org, não por tenant de dado
      const janela = src.slice(Math.max(0, m.index - 1200), m.index + 400)
      if (!/organization_id/.test(janela)) diretasSemOrg.push(`${dir}/${f} → ${tabela}`)
    }
  }
}
conferir(diretas > 0, `${diretas} escritas diretas encontradas`)
conferir(diretasSemOrg.length === 0, 'todas com organization_id por perto', diretasSemOrg.join(', '))

// ── 4. RLS de SELECT por organização, tabela a tabela ─────────────────────────
console.log('\n=== 4. toda tabela do inventário tem policy de SELECT por organization_id ===')
const auditoria = ler('src/lib/auditoria.ts')
const inicio = auditoria.indexOf('const MODULOS')
const fim = auditoria.indexOf('\n}', inicio)
const tabelas = [...auditoria.slice(inicio, fim).matchAll(/^\s{2}([a-z_0-9]+):\s*\[/gm)].map((m) => m[1])
conferir(tabelas.length >= 80, `${tabelas.length} tabelas no inventário`)
const migracoes = readdirSync(join(RAIZ, 'supabase/migrations')).filter((f) => f.endsWith('.sql') && !f.startsWith('APPLY_'))
  .map((f) => ler(`supabase/migrations/${f}`).toLowerCase()).join('\n')
// Tabelas POR USUÁRIO/POR ORG, não por dado de tenant: a policy delas é por `auth.uid()` /
// membership, e é isso mesmo. Excluídas com o motivo escrito, não em silêncio.
const POR_USUARIO = new Set(['memberships', 'organizations'])
// ⚠️ Várias migrações criam as policies num LAÇO: `EXECUTE format('CREATE POLICY %I_select_own_org
// ON public.%I FOR SELECT … USING (organization_id = public.user_org() …)')` sobre uma lista de
// nomes. O nome da tabela é `%I` — um regex literal `on public.<t>` fica cego para elas. Aqui: a
// migração tem o laço E cita a tabela na lista.
const arquivosMig = readdirSync(join(RAIZ, 'supabase/migrations')).filter((f) => f.endsWith('.sql') && !f.startsWith('APPLY_'))
const migracoesPorArquivo = arquivosMig.map((f) => ler(`supabase/migrations/${f}`).toLowerCase())
const LACO = /format\(\s*'create policy %i_select_own_org on public\.%i for select[^']*organization_id = public\.user_org\(\)/
const semPolicy = []
for (const t of tabelas) {
  if (POR_USUARIO.has(t)) continue
  const literal = new RegExp(`create policy[^;]*?on public\\.${t}\\b[^;]*?for select[^;]*?(organization_id\\s*=\\s*(public\\.)?user_org\\(\\)|is_global_admin)`, 's')
  const literalAlt = new RegExp(`create policy[^;]*?on public\\.${t}\\b[^;]*?(using|as permissive)[^;]*?organization_id[^;]*?user_org`, 's')
  const noLaco = migracoesPorArquivo.some((m) => LACO.test(m) && new RegExp(`'${t}'`).test(m))
  if (!literal.test(migracoes) && !literalAlt.test(migracoes) && !noLaco) semPolicy.push(t)
}
console.log(`  info   ${POR_USUARIO.size} tabelas por usuário/org fora da conferência (policy por auth.uid, e é assim mesmo): ${[...POR_USUARIO].join(', ')}`)
conferir(semPolicy.length === 0, 'todas com policy de SELECT por org', semPolicy.length ? `SEM: ${semPolicy.join(', ')}` : '')

console.log(falhas === 0 ? '\nISOLAMENTO ESTÁTICO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
