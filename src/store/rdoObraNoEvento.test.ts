/**
 * O RDO anuncia a MESMA obra ao ser criado e ao ser editado.
 *
 * ─── O QUE ESTAVA QUEBRADO ────────────────────────────────────────────────────
 * `rdoToRow` tinha `project_id: (rdo as { projectId?: string | null }).projectId ?? null` — um
 * cast para um campo que **não existe** no tipo `RDO` (ele tem `siteId`). Resolvia `undefined ??
 * null`, ou seja, **null sempre**. E `addRdo` emitia `rdo.closed`/`rdo.finalized` com
 * `projectId: row.project_id`, herdando o null; a `operationalKey` também nascia sem obra.
 *
 * A edição (`updateRdo`) já fora corrigida para `upd.siteId` — então o mesmo RDO anunciava obra
 * nula ao nascer e a obra certa ao ser editado. Hoje ninguém lê esse payload (os assinantes só
 * dão `pull()`), mas o escopo por obra do Economia vai ler exatamente ele.
 *
 * Este teste é textual de propósito: o `emit` acontece dentro de um store com persistência,
 * autenticação e fila de sync, e montar tudo isso para checar um campo custaria mais do que vale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

/**
 * O arquivo SEM comentários.
 *
 * Necessário porque os próprios comentários do conserto citam o cast morto para explicar o que
 * havia ali — e um teste que varre o texto cru acusaria a explicação como se fosse o defeito.
 */
async function codigoDoStore(): Promise<string> {
  const bruto = await readFile(new URL('./rdoStore.ts', import.meta.url), 'utf8')
  return bruto
    .replace(/\/\*[\s\S]*?\*\//g, '')   // blocos /* … */
    .replace(/^\s*\/\/.*$/gm, '')        // linhas inteiras de //
    .replace(/\/\/[^\n'"`]*$/gm, '')     // // no fim da linha (sem strings, para não cortar URLs)
}

test('o cast para o campo inexistente `projectId` não volta ao rdoStore', async () => {
  const s = await codigoDoStore()
  assert.ok(
    !/rdo as \{\s*projectId\?/.test(s),
    'o cast morto `(rdo as { projectId?: ... })` voltou — ele resolve null sempre, porque RDO tem siteId',
  )
})

test('criar e editar emitem a obra pelo MESMO caminho: siteId', async () => {
  const s = await codigoDoStore()
  // Todo `projectId:` dentro de um emit/buildOperationalKey tem de vir de um `.siteId`.
  const suspeitas = [...s.matchAll(/projectId:\s*([^,\n]+)/g)]
    .map((m) => m[1].trim())
    .filter((v) => !v.includes('siteId'))
  assert.deepEqual(suspeitas, [], `projectId vindo de outra coisa que não siteId: ${suspeitas.join(' | ')}`)
})

test('a coluna legada project_id é gravada como null explícito, não com o id da obra', async () => {
  // `projects.id` é `site:<uuid>` (gestao-360/utils/siteProjects.ts) — espaço de id diferente do
  // de `construction_sites.id`. E há função no servidor que faz `r.project_id::uuid = p.id`:
  // gravar o uuid da obra ali produziria junção errada, não escopo.
  const s = await codigoDoStore()
  assert.match(s, /project_id:\s*null,/, 'project_id deixou de ser null explícito em rdoToRow')
  assert.ok(
    !/project_id:\s*[^n\s].*siteId/.test(s),
    'o id da obra foi parar na coluna legada de projeto',
  )
})

test('site_id continua sendo preenchido com a obra — é ele que vale', async () => {
  const s = await codigoDoStore()
  assert.match(s, /site_id:\s*rdo\.siteId \?\? null/)
})
