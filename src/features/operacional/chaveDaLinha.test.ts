/**
 * A chave de identidade do Operacional — o teste que NÃO existia, e cuja ausência custou caro.
 *
 * ⚠️ `chaveDaLinha` vivia sem `export` e sem um único teste dentro de `importarPlanilha.ts`. Foi
 * por isso que o commit `cecc4e4` trocou a chave do Banco de Custos sem nada acusar: a interseção
 * entre as chaves velhas e as novas daquela aba é **zero**, e a reimportação seguinte reportou
 * 33 linhas novas e 40 sumidas que eram as mesmas 33 linhas. O equivalente do Controle de Caixa
 * (`chaveDeConteudo`) é travado por um teste nomeado desde o primeiro dia — e nunca teve esse
 * problema. Este arquivo é a mesma trava.
 *
 * Os números citados aqui foram MEDIDOS contra o arquivo real do cliente (rev15), não estimados.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  COLUNAS_DE_IDENTIDADE, chaveDaLinha, valorPorRotulo, normalizarRotulo, temIdentidadePropria,
} from '@/features/operacional/chaveDaLinha'
import { SABESP_SHEETS } from '@/features/operacional/sabespStore'
import { ehRegistroReal } from '@/features/operacional/importarPlanilha'

const nova = () => new Map<string, number>()

// ─── 🔴 A fonte é uma só ──────────────────────────────────────────────────────

test('🔴 toda aba declara sua identidade — nenhuma fica de fora sem querer', () => {
  for (const def of SABESP_SHEETS) {
    assert.ok(COLUNAS_DE_IDENTIDADE[def.id] !== undefined,
      `${def.id} não está em COLUNAS_DE_IDENTIDADE — a chave cairia no conteúdo inteiro da linha`)
  }
  assert.equal(Object.keys(COLUNAS_DE_IDENTIDADE).length, SABESP_SHEETS.length)
})

test('🔴 `colunasDoCabecalho` NÃO é identidade — as duas listas podem divergir, e divergem', () => {
  // Isto é uma afirmação, não um acidente: o detector de cabeçalho quer MUITOS rótulos (pontua a
  // linha candidata por quantos ela contém); a identidade quer os POUCOS que não mudam. Confundir
  // as duas foi a causa raiz. O teste existe para que ninguém "conserte" a divergência igualando-as.
  const prog = SABESP_SHEETS.find((d) => d.id === 'programacao')!
  assert.ok(prog.colunasDoCabecalho.includes('EQUIPE'))
  assert.ok(!COLUNAS_DE_IDENTIDADE.programacao.includes('EQUIPE'))
})

// ─── 🔴 Campo preenchido depois não entra na chave ────────────────────────────

test('🔴 EQUIPE ficou FORA da chave — ela é designada depois, e está vazia em 44/44 hoje', () => {
  assert.ok(!COLUNAS_DE_IDENTIDADE.programacao.includes('EQUIPE'))
  assert.ok(!COLUNAS_DE_IDENTIDADE.apontamento.includes('EQUIPE'))

  const antes = { DATA: '2026-09-08', CONTRATO: 'BERTIOGA', 'ID DO SERVIÇO': 'BER-0001', EQUIPE: '' }
  const depois = { ...antes, EQUIPE: 'EQ-01' }
  assert.equal(
    chaveDaLinha(antes, COLUNAS_DE_IDENTIDADE.programacao, nova()),
    chaveDaLinha(depois, COLUNAS_DE_IDENTIDADE.programacao, nova()),
    'preencher a equipe não pode virar 44 linhas novas + 44 sumidas',
  )
})

test('🔴 `Nº OS SABESP` ficou FORA — o número chega da SABESP depois de a linha existir', () => {
  assert.ok(!COLUNAS_DE_IDENTIDADE.ordens_servico.includes('Nº OS SABESP'))
  const antes = { 'ID DO SERVIÇO': 'BER-0001', CONTRATO: 'BERTIOGA', 'Nº OS SABESP': '' }
  assert.equal(
    chaveDaLinha(antes, COLUNAS_DE_IDENTIDADE.ordens_servico, nova()),
    chaveDaLinha({ ...antes, 'Nº OS SABESP': '123456' }, COLUNAS_DE_IDENTIDADE.ordens_servico, nova()),
  )
})

test('🔴 `Nº BOLETIM` ficou FORA da Medição — a medição muda de boletim ao ser reapresentada', () => {
  assert.ok(!COLUNAS_DE_IDENTIDADE.medicao.includes('Nº BOLETIM'))
  const antes = { 'Nº BOLETIM': 'BM-09/2026', 'ID DO SERVIÇO': 'BER-0001', 'CÓD. PREÇO (CHAVE)': 'BER-72000053' }
  assert.equal(
    chaveDaLinha(antes, COLUNAS_DE_IDENTIDADE.medicao, nova()),
    chaveDaLinha({ ...antes, 'Nº BOLETIM': 'BM-10/2026' }, COLUNAS_DE_IDENTIDADE.medicao, nova()),
  )
})

test('🔴 `CÓD. PREÇO` FICA na Medição, e o texto FICA nas Atas — medido, não achado', () => {
  // Tirar estes dois parece coerente com a regra acima, e destruiria a unicidade:
  //  · Medição sem `CÓD. PREÇO`: 70 chaves distintas caem para 44;
  //  · Atas sem o texto da pendência: `Nº DA ATA` sozinho dá 1 distinta e 11 repetidas.
  // Quem resolve a mutabilidade destes dois é o casamento por semelhança, não cirurgia na chave.
  assert.ok(COLUNAS_DE_IDENTIDADE.medicao.includes('CÓD. PREÇO (CHAVE)'))
  assert.ok(COLUNAS_DE_IDENTIDADE.atas.includes('PENDÊNCIA / AÇÃO'))
})

// ─── 🔴 Coluna vazia ocupa a posição ──────────────────────────────────────────

test('🔴 campo-chave vazio OCUPA a posição — `a|` e `|a` não são a mesma linha', () => {
  const cols = ['A', 'B']
  const so_a = chaveDaLinha({ A: 'x', B: '' }, cols, nova())
  const so_b = chaveDaLinha({ A: '', B: 'x' }, cols, nova())
  assert.notEqual(so_a, so_b,
    'o `.filter(Boolean)` de antes encurtava a chave: as duas viravam "x", e uma sobrescrevia a '
    + 'outra em silêncio na hora de gravar')
  assert.equal(so_a, 'x|')
  assert.equal(so_b, '|x')
})

test('a chave desempata repetição por ordem de aparição', () => {
  const vistas = nova()
  const cols = ['CHAVE']
  assert.equal(chaveDaLinha({ CHAVE: 'BER-72000222' }, cols, vistas), 'BER-72000222')
  assert.equal(chaveDaLinha({ CHAVE: 'BER-72000222' }, cols, vistas), 'BER-72000222#2')
  assert.equal(chaveDaLinha({ CHAVE: 'BER-72000222' }, cols, vistas), 'BER-72000222#3')
})

test('sem nenhuma coluna de identidade preenchida, a identidade cai no conteúdo — e isso é sinalizado', () => {
  const cols = ['A', 'B']
  assert.equal(temIdentidadePropria({ A: 'x', B: '' }, cols), true)
  assert.equal(temIdentidadePropria({ A: '', B: '' }, cols), false)
  assert.equal(temIdentidadePropria({ A: 'x' }, []), false, 'aba derivada não tem identidade nenhuma')
})

// ─── 🔴 Igualdade antes de prefixo ────────────────────────────────────────────

test('🔴 `DATA` não casa com `DATA LIMITE` quando existe uma coluna `DATA` de verdade', () => {
  const valores = { 'DATA LIMITE': '2026-12-31', DATA: '2026-09-08', 'DATA DE EXECUÇÃO': '2026-09-09' }
  assert.equal(valorPorRotulo(valores, 'DATA'), '2026-09-08',
    'o casamento por prefixo puro devolvia a primeira coluna na ordem do arquivo — de modo que '
    + 'REORDENAR uma coluna na planilha trocaria a identidade de todas as linhas da aba de uma vez')
})

test('o prefixo continua valendo quando não há coluna exata — rótulo varia entre revisões', () => {
  assert.equal(valorPorRotulo({ 'SEMANA (2ª feira) — ISO': '2026-W37' }, 'SEMANA (2ª feira)'), '2026-W37')
  assert.equal(valorPorRotulo({ OUTRA: 'x' }, 'DATA'), '')
})

test('acento, caixa e espaço duplo não mudam o rótulo', () => {
  assert.equal(normalizarRotulo('  Nº  da   Ata '), 'N° DA ATA'.replace('°', 'º').toUpperCase().replace(/\s+/g, ' '))
  assert.equal(valorPorRotulo({ 'Código  do   Serviço': 'x' }, 'CODIGO DO SERVICO'), 'x')
})

// ─── 🔴 A coluna-âncora decide o que é registro ───────────────────────────────

test('🔴 medição sem `CÓD. PREÇO` ainda é uma medição — 17 delas eram descartadas', () => {
  const semPreco = {
    'Nº BOLETIM': 'BM-09/2026', 'MÊS DE MEDIÇÃO': 'Sep-26',
    'ID DO SERVIÇO': 'BER-0001', CONTRATO: 'BERTIOGA', 'CÓD. PREÇO (CHAVE)': '',
  }
  assert.equal(ehRegistroReal('medicao', semPreco), true,
    'exigir TODAS as colunas de identidade juntas engolia 17 medições reais do arquivo do cliente')
  assert.equal(ehRegistroReal('medicao', { 'ID DO SERVIÇO': '', 'CÓD. PREÇO (CHAVE)': 'BER-72000053' }), false,
    'sem a âncora não há linha: isso é resto de bloco lateral')
})

test('🔴 a linha `TOTAL DO CONTRATO` do Faturamento continua fora — a âncora é o MÊS', () => {
  assert.equal(ehRegistroReal('faturamento', { 'MÊS': '', CONTRATO: 'TOTAL DO CONTRATO' }), false)
  assert.equal(ehRegistroReal('faturamento', { 'MÊS': 'Sep-26', CONTRATO: 'BERTIOGA' }), true)
})

test('aba derivada nunca produz registro — ela é fórmula na planilha', () => {
  for (const id of ['configuracoes', 'carteira_ticket', 'resumo', 'dashboard', 'planejado_realizado'] as const) {
    assert.deepEqual([...COLUNAS_DE_IDENTIDADE[id]], [])
    assert.equal(ehRegistroReal(id, { QUALQUER: 'coisa' }), false)
  }
})

test('legenda e bloco lateral continuam fora de Materiais, Lookahead e Plano Semanal', () => {
  // ⚠️ Eu suspeitei que o filtro estivesse comendo 30 + 13 + 16 linhas destas abas. Fui olhar
  // linha a linha no arquivo real: são "RESUMO DE SALDO POR MATERIAL", "PPC POR SEMANA" e
  // "A = segunda-feira da semana". Devolver 0 registros está CERTO, e este teste é para não
  // "consertar" isso de novo.
  assert.equal(ehRegistroReal('materiais', { DATA: '', MATERIAL: 'CIMENTO', SALDO: '12' }), false)
  assert.equal(ehRegistroReal('lookahead', { 'SEMANA (2ª feira)': '', CONTRATO: 'A = contrato (menu)' }), false)
  assert.equal(ehRegistroReal('plano_semanal', { 'SEMANA (2ª feira)': '', PPC: '78%' }), false)
})
