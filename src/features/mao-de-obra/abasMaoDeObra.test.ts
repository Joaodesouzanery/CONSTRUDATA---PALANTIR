/**
 * A reorganização das abas de Mão de Obra.
 *
 * ⚠️ O teste que mais importa é o das OCORRÊNCIAS: remover o Escalamento parecia limpo (nenhum
 * importador fora do módulo) e não era — ele era o único lugar que CADASTRAVA ocorrência, enquanto
 * o card de custo do Dashboard LÊ esse dado. Sem mover o cadastro, o card ficaria zerado para
 * sempre, sem nenhum erro para denunciar.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ler = async (rel: string) => semComentarios(await readFile(new URL(rel, import.meta.url), 'utf8'))

test('🔴 o cadastro de ocorrências sobreviveu à remoção do Escalamento', async () => {
  const secao = await ler('./components/OcorrenciasSection.tsx')
  assert.match(secao, /OcorrenciaDialog/, 'sem o diálogo não há como cadastrar')
  assert.match(secao, /removeOccurrence/)
  const faltas = await ler('./components/FaltasEAusenciasPanel.tsx')
  assert.match(faltas, /OcorrenciasSection/, 'a seção precisa estar montada em algum lugar alcançável')
})

test('🔴 quem LÊ ocorrências continua sendo alimentado', async () => {
  // O card de custo do Dashboard lê `occurrences`. Se ninguém mais escreve, ele mente por omissão.
  const faixa = await ler('./components/FaixaDeCusto.tsx')
  assert.match(faixa, /occurrences/, 'se este leitor sumir, o teste acima perde o sentido — reveja')
})

test('o Escalamento não existe mais, e nada aponta para ele', async () => {
  const idx = await ler('./index.tsx')
  assert.doesNotMatch(idx, /import .*EscalamentoPanel/)
  // O id continua na união como depreciado, e cai numa tela real — não em branco.
  assert.match(idx, /case 'escalamento':\s+return <FaltasEAusenciasPanel \/>/)
})

test('os ids antigos caem em tela real, nunca no default', async () => {
  const idx = await ler('./index.tsx')
  for (const [antigo, novo] of [
    ['ausencias', 'FaltasEAusenciasPanel'],
    ['rh-financeiro', 'FolhaERHFinanceiroPanel'],
    ['avaliacoes', 'ProdutividadeEAvaliacoesPanel'],
  ]) {
    assert.match(idx, new RegExp(`case '${antigo}':[\\s\\S]{0,120}${novo}`),
      `o id '${antigo}' precisa cair em ${novo} — cair no default levaria ao Dashboard em silêncio`)
  }
})

test('a barra tem 11 abas, e nenhuma das fundidas sobrou solta', async () => {
  const header = await ler('./components/MaoDeObraHeader.tsx')
  const ids = [...header.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1])
  // Eram 10 depois das fusões de 18/09. A 11ª é 'ponto', acrescentada em 20/09 com a metade do
  // gestor do Ponto Eletrônico — não é aba fundida voltando, é módulo novo.
  assert.equal(ids.length, 11, `esperava 11 abas, achei ${ids.length}: ${ids.join(', ')}`)
  for (const sumiu of ['ausencias', 'avaliacoes', 'rh-financeiro', 'escalamento']) {
    assert.ok(!ids.includes(sumiu), `'${sumiu}' foi fundida e não pode estar na barra`)
  }
  assert.ok(ids.includes('ponto'), 'a aba do gestor do ponto precisa estar na barra')
  // ⚠️ A ordem importa: escala → apontamento → ponto → hora extra é a ordem cronológica do dado.
  assert.ok(ids.indexOf('ponto') > ids.indexOf('apontamentos'))
  assert.ok(ids.indexOf('ponto') < ids.indexOf('horas-extras'))
})

test('🔴 Produtividade e Avaliações ficam em SUB-ABAS — escopos diferentes', async () => {
  const p = await ler('./components/ProdutividadeEAvaliacoesPanel.tsx')
  // Produtividade é recortada pela obra ativa; avaliações é global. Empilhadas numa tela contínua,
  // os dois números pareceriam comparáveis — é o defeito que o CMO já teve.
  assert.match(p, /visao === 'produtividade' \? <ProdutividadePanel/)
  assert.match(p, /obra selecionada|todas as obras/, 'a tela precisa DIZER de onde cada metade fala')
})

test('🔴 o teto de custo do RH parou de sumir no F5', async () => {
  const rh = await ler('./components/RHFinanceiroPanel.tsx')
  assert.match(rh, /cltSettings\.tetoCustoRhMensal/)
  assert.doesNotMatch(rh, /useState<number>\(100_000\)/,
    'era estado local: o alerta de estouro seguia calculando contra um teto que ninguém escolheu')
  const tipos = await ler('../../types/index.ts')
  assert.match(tipos, /tetoCustoRhMensal\?: number/)
})

test('o aviso de "falta sem turno não desconta" não se perdeu na fusão', async () => {
  const faltas = await readFile(new URL('./components/FaltasSubsPanel.tsx', import.meta.url), 'utf8')
  assert.match(faltas, /sem turno/i,
    'registerAbsence chama marcarTurnoAusente; sem turno no dia a folha NÃO muda, e quem não lê '
    + 'isso acha que ajustou o pagamento')
})
