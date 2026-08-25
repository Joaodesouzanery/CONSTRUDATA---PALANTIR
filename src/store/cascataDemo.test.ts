/**
 * Todo store que tem dado de exemplo precisa estar na cascata do Modo Demonstração.
 *
 * ─── POR QUE ESTE TESTE EXISTE ────────────────────────────────────────────────
 * O `economiaStore` tinha `loadDemoData()` pronto, estava em `STORE_KEYS` (então o snapshot e a
 * restauração funcionavam) — **e não estava na cascata**. Com a Demonstração ligada, todos os
 * outros módulos trocavam para o dado de exemplo e a tela de Economia continuava exibindo os
 * eventos e a linha de base reais do cliente.
 *
 * Achado em 25/08/2026 e invisível a olho nu: a cascata é uma lista de ~35 linhas quase idênticas,
 * e faltar uma não quebra nada — só mistura. É exatamente o tipo de defeito que um teste pega e
 * uma revisão não.
 *
 * A regra do cliente é literal: *"os dados de Demonstração NÃO PODEM SE MISTURAR com os originais
 * e reais"*. Este teste é a trava dela.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const raiz = new URL('../../', import.meta.url)
const lerStore = (nome: string) => readFile(new URL(`src/store/${nome}`, raiz), 'utf8')

/** Os dois ramos do `toggleDemoMode`: ligar (loadDemoData) e desligar sem snapshot (clearData). */
async function ramosDaCascata() {
  const texto = await lerStore('appModeStore.ts')
  const inicio = texto.indexOf('Load demo data in each store')
  const corte = texto.indexOf('clearLocalOnlyModuleData()', inicio)
  assert.ok(inicio > 0 && corte > inicio, 'a cascata mudou de forma — reveja este teste')
  const ligado = texto.slice(inicio, texto.indexOf('} else {', inicio))
  const desligado = texto.slice(texto.indexOf('} else {', inicio), corte)
  return { ligado, desligado, texto }
}

/** Nomes de arquivo de store que exportam `loadDemoData` de verdade. */
async function storesComDadoDeExemplo(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const arquivos = (await readdir(new URL('src/store', raiz)))
    .filter((f) => f.endsWith('Store.ts') && !f.endsWith('.test.ts'))
  const comDemo: string[] = []
  for (const f of arquivos) {
    const t = await lerStore(f)
    // A declaração, não a chamada: `loadDemoData: () =>` ou `loadDemoData() {`.
    if (/loadDemoData\s*:\s*\(/.test(t) || /\bloadDemoData\s*\(\s*\)\s*\{/.test(t)) comDemo.push(f)
  }
  return comDemo
}

test('todo store com loadDemoData está na cascata de LIGAR a Demonstração', async () => {
  const { ligado } = await ramosDaCascata()
  const faltando = (await storesComDadoDeExemplo())
    .filter((f) => f !== 'appModeStore.ts')
    .filter((f) => !ligado.includes(`./${f.replace(/\.ts$/, '')}`))
  assert.deepEqual(faltando, [], `store(s) fora da cascata — o dado real continuaria na tela: ${faltando.join(', ')}`)
})

test('o Economia especificamente está nos DOIS ramos', async () => {
  // Nomeado à parte porque foi o que estava quebrado, e porque estar só num ramo é meio conserto:
  // sem o `clearData`, desligar a Demonstração sem snapshot deixaria o dado de exemplo na tela.
  const { ligado, desligado } = await ramosDaCascata()
  assert.match(ligado, /economiaStore.*loadDemoData/s, 'Economia fora do ramo de LIGAR')
  assert.match(desligado, /economiaStore.*clearData/s, 'Economia fora do ramo de DESLIGAR')
})

test('todo store da cascata também está em STORE_KEYS — senão o dado real não volta', async () => {
  // STORE_KEYS é o que o snapshot copia ANTES de a demonstração sobrescrever. Um store que entra
  // na cascata sem estar nesta lista tem o dado do cliente substituído pelo de exemplo e **nunca
  // restaurado** — foi o caso do `cdata-rateio-consumo`, que por isso entrou aqui primeiro.
  //
  // A chave é lida do próprio `persist({ name: ... })` de cada store, e não de uma lista escrita à
  // mão: uma lista à mão envelhece igual à cascata, e seria o mesmo defeito de novo.
  const { ligado } = await ramosDaCascata()
  const chaves = await lerStore('appModeStore.ts')
  const blocoKeys = chaves.slice(chaves.indexOf('const STORE_KEYS'), chaves.indexOf('function clearLocalOnlyModuleData'))

  const naCascata = [...ligado.matchAll(/import\('\.\/(\w+Store)'\)/g)].map((m) => m[1])
  assert.ok(naCascata.length > 30, `só ${naCascata.length} stores na cascata — o formato mudou?`)

  const semSnapshot: string[] = []
  for (const store of new Set(naCascata)) {
    const texto = await lerStore(`${store}.ts`)
    const chave = texto.match(/name:\s*'(cdata-[a-z0-9-]+)'/)?.[1]
    // Store sem `persist` não grava nada no navegador e não precisa de snapshot.
    if (!chave) continue
    if (!blocoKeys.includes(`'${chave}'`)) semSnapshot.push(`${store} (${chave})`)
  }
  assert.deepEqual(semSnapshot, [], `na cascata mas fora de STORE_KEYS — o dado real seria perdido: ${semSnapshot.join(', ')}`)
})
