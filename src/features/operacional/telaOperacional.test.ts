/**
 * A tela do Operacional — o scroll, as abas e os ganchos que não podem sumir.
 *
 * ⚠️ Três dos quatro testes 🔴 daqui protegem defeitos que JÁ aconteceram e que não deixam rastro
 * no console: a página que não rola, a aba que não troca e o PDF que sai em branco. Nenhum deles
 * quebra o build, nenhum deles gera erro — só ficam errados na tela, e alguém precisa reclamar.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

async function ler(caminho: string): Promise<string> {
  return readFile(new URL(caminho, import.meta.url), 'utf8')
}

/** Sem comentário: o arquivo EXPLICA o defeito que evita, e o texto casaria com a busca. */
async function semComentario(caminho: string): Promise<string> {
  return (await ler(caminho))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

// ─── 🔴 O scroll é da página ──────────────────────────────────────────────────

test('🔴 a raiz do Operacional usa min-h-full, nunca h-full', async () => {
  const idx = await semComentario('./index.tsx')
  assert.match(idx, /className="flex min-h-full flex-col/)
  assert.doesNotMatch(idx, /className="flex h-full flex-col/,
    'com h-full a página fica da altura exata do <main>, que então não tem o que rolar — e a '
    + 'rolagem cai num pane interno, prendendo a planilha numa janelinha')
})

test('🔴 nenhum scroller vertical sobrou no caminho da grade', async () => {
  const painel = await semComentario('./SabespPanel.tsx')
  const proibidos = [...painel.matchAll(/className=(?:"|\{cn\(')[^"']*overflow-auto/g)]
    .map((m) => m[0])
    // Dois casos legítimos, e só dois:
    //  · tela cheia — ali o contêiner É a janela, e o pane interno é o certo;
    //  · um bloco com `max-h-` declarado (o Leia-me) — janela de leitura de propósito, não acidente.
    .filter((m) => !m.includes('telaCheia') && !m.includes('max-h-'))
  assert.equal(proibidos.length, 0,
    `scroller vertical indevido: ${proibidos.join(' | ')}`)
})

test('🔴 a tabela mantém a rolagem HORIZONTAL — ela tem 30 colunas', async () => {
  const painel = await semComentario('./SabespPanel.tsx')
  assert.match(painel, /overflow-x-auto/,
    'sem ela a tabela larga estoura a página em vez de rolar de lado')
})

test('o SubTabHost só desliga o pane interno quando pedem', async () => {
  const host = await semComentario('../../components/shared/SubTabHost.tsx')
  assert.match(host, /rolagemDaPagina \? 'flex flex-col' : 'flex flex-col h-full'/)
  assert.match(host, /rolagemDaPagina \? undefined : 'flex-1 overflow-auto'/,
    'EVM, Torre e Financeiro dependem do pane interno — ligar para todos quebraria os três')

  const painel = await semComentario('./SabespPanel.tsx')
  assert.match(painel, /rolagemDaPagina/, 'e o Operacional precisa pedir')
})

test('o cabeçalho do módulo NÃO é sticky — quem gruda é o da tabela', async () => {
  const idx = await semComentario('./index.tsx')
  assert.doesNotMatch(idx, /<header className="sticky/,
    'dois elementos grudados no topo brigam, e o do módulo tem z maior: esconderia o da tabela')
  const painel = await semComentario('./SabespPanel.tsx')
  assert.match(painel, /<thead className="sticky top-0/)
})

// ─── 🔴 Trocar de aba mostra a aba ────────────────────────────────────────────

test('🔴 GrupoDeAbas tem key={g} — sem ela a aba não troca', async () => {
  const painel = await semComentario('./SabespPanel.tsx')
  assert.match(painel, /<GrupoDeAbas key=\{g\}/,
    'o SubTabHost renderiza este componente sempre na mesma posição; sem key o React reconcilia o '
    + 'MESMO fiber e preserva o useState da sub-aba. Indo de Cadastros para Execução, `ativa` '
    + 'continuava valendo uma aba que não existe ali: nenhuma pill acendia e a grade seguia '
    + 'mostrando Cadastros')
})

// ─── 🔴 Os ganchos do PDF ─────────────────────────────────────────────────────

test('🔴 os três ganchos do CSS de impressão continuam existindo', async () => {
  const painel = await ler('./SabespPanel.tsx')
  const celula = await ler('./components/CelulaEditavel.tsx')
  const css = await readFile(new URL('../../styles/globals.css', import.meta.url), 'utf8')

  assert.match(painel, /operacional-impressao/, 'a âncora do @media print')
  assert.match(celula, /celula-valor/, 'o que o print mostra no lugar do input')
  assert.match(css, /\.operacional-impressao/)
  assert.match(css, /table-header-group/, 'sem isto o cabeçalho não repete entre páginas')
})

// ─── A exportação diz o que cada saída é ──────────────────────────────────────

test('🔴 a exportação nomeia os três formatos, e não promete fidelidade onde não há', async () => {
  const painel = await ler('./SabespPanel.tsx')
  assert.match(painel, /Arquivo original/)
  assert.match(painel, /cópia fiel/)
  assert.match(painel, /Dados para análise/)
  assert.match(painel, /derivado/,
    'o botão único "Exportar tudo" dava a entender que devolvia a planilha; ele devolve uma '
    + 'reconstrução sem fórmulas, sem colunas vazias e sem linhas estruturais')
  assert.doesNotMatch(painel, />\s*Exportar tudo/)
})

test('🔴 o arquivo original é lido de forma REATIVA', async () => {
  const painel = await semComentario('./SabespPanel.tsx')
  assert.match(painel, /useSabespStore\(\(s\) => s\.arquivoOriginal\)/)
  assert.doesNotMatch(painel, /getState\(\)\.arquivoOriginal/,
    'lido com getState() dentro do JSX, o botão não aparecia quando o pull trazia o ponteiro sem '
    + 'mexer em linhas/abas — o componente simplesmente não re-renderizava')
})

test('a exportação por aba usa o nome SABESP, não o id interno', async () => {
  const arq = await semComentario('./arquivoOperacional.ts')
  assert.match(arq, /const nomeDaAba = SABESP_SHEETS\.find/)
  assert.doesNotMatch(arq, /aba\.slice\(0, 31\)/,
    'a guia saía chamada "cadastro_servicos", um nome que só existe dentro do código')
})
