/**
 * O leitor contra o ARQUIVO REAL do cliente — não contra um fixture inventado.
 *
 * ⚠️ Cada número aqui foi MEDIDO no
 * `CONTROLE OPERACIONAL SABESP - BERTIOGA GUARUJA E SANTOS - WCR-rev15-PLANEJADOxREALIZADO.xlsx`
 * antes do conserto. Eles são a diferença entre "lê a planilha" e "lê TUDO da planilha":
 *
 *   55 listas suspensas  → 45 resolvidas, 10 vazias (as literais, tipo `"SIM,NÃO"`)
 *   13 regras de data/número → 0 lidas
 *   01. CONFIGURAÇÕES    → lido como tabela, com o VALOR virando nome de coluna
 *
 * Se o cliente mandar uma revisão nova e estes números mudarem, o teste falha — e é isso que se
 * quer: a planilha mudou, alguém precisa olhar.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'
import {
  validacoesDoXml, mapaDasAbas, lerConfiguracoes, lerAba, colunasDoSqref, opcoesDaFormula,
  chaveDaColuna, desescapar, type ValidacaoLida,
} from '@/features/operacional/leitorPlanilha'

const ARQUIVO = new URL(
  '../../../CONTROLE OPERACIONAL SABESP - BERTIOGA GUARUJA E SANTOS - WCR-rev15-PLANEJADOxREALIZADO.xlsx',
  import.meta.url,
)

let cache: { wb: XLSX.WorkBook; buffer: ArrayBuffer } | null = null
async function planilha() {
  if (cache) return cache
  const bin = await readFile(ARQUIVO)
  const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer
  cache = { wb: XLSX.read(buffer, { type: 'array', cellDates: true }), buffer }
  return cache
}

// ─── sqref → colunas ──────────────────────────────────────────────────────────

test('colunasDoSqref: intervalo simples, bloco múltiplo e coluna única', () => {
  assert.deepEqual(colunasDoSqref('D5:D604'), [3])
  assert.deepEqual(colunasDoSqref('A1:C3'), [0, 1, 2])
  assert.deepEqual(colunasDoSqref('D5:D604 F5:F604'), [3, 5])
  assert.deepEqual(colunasDoSqref('$B$2'), [1])
  assert.deepEqual(colunasDoSqref('AA1:AB2'), [26, 27])
})

// ─── os três formatos de lista ────────────────────────────────────────────────

test('opcoesDaFormula: a lista LITERAL — o formato que voltava vazio', async () => {
  const { wb } = await planilha()
  assert.deepEqual(opcoesDaFormula('"SIM,NÃO"', wb).opcoes, ['SIM', 'NÃO'])
  assert.deepEqual(
    opcoesDaFormula('"URGENTE,ALTA,NORMAL,BAIXA"', wb).opcoes,
    ['URGENTE', 'ALTA', 'NORMAL', 'BAIXA'],
  )
})

test('opcoesDaFormula: fórmula vazia não inventa opção', async () => {
  const { wb } = await planilha()
  assert.deepEqual(opcoesDaFormula('', wb).opcoes, [])
  assert.deepEqual(opcoesDaFormula('   ', wb).opcoes, [])
})

// ─── O parser de XML: onde mora a regra ───────────────────────────────────────
//
// A contagem ponta-a-ponta contra o arquivo real (55 listas, 0 vazias, 7 datas, 6 números) vive em
// `scripts/qa/qa-operacional.mjs`, porque abrir o `.xlsx` precisa do jszip e ele não carrega no
// resolver de testes. Aqui ficam os casos que o XML sozinho já prova.

const XML_LISTA_LITERAL =
  '<dataValidation type="list" allowBlank="1" sqref="G5:G304">'
  + '<formula1>&quot;SIM,NÃO&quot;</formula1></dataValidation>'

const XML_AUTO_FECHADO =
  '<dataValidation type="date" operator="between" allowBlank="0" sqref="B5:B304" '
  + 'prompt="Data dentro do mês" />'

const XML_DECIMAL =
  '<dataValidation type="decimal" operator="greaterThanOrEqual" sqref="H5:H304">'
  + '<formula1>0</formula1></dataValidation>'

test('🔴 a lista LITERAL é lida — era ela que voltava sem opções', async () => {
  const { wb } = await planilha()
  const [v] = validacoesDoXml(XML_LISTA_LITERAL, '16. LOOKAHEAD E RESTRIÇÕES', wb)
  assert.equal(v.tipo, 'lista')
  assert.deepEqual(v.opcoes, ['SIM', 'NÃO'])
  assert.deepEqual(v.colunas, [6])
})

test('🔴 dataValidation AUTO-FECHADO é lido — o regex antigo exigia corpo', async () => {
  const { wb } = await planilha()
  const [v] = validacoesDoXml(XML_AUTO_FECHADO, '04. PROGRAMAÇÃO DIÁRIA', wb)
  assert.ok(v, 'sem isto, toda regra sem <formula1> era descartada')
  assert.equal(v.tipo, 'data')
  assert.equal(v.obrigatorio, true, 'allowBlank="0" é campo obrigatório')
  assert.equal(v.mensagem, 'Data dentro do mês')
})

test('🔴 regra de número vira regra de campo — antes o laço a jogava fora', async () => {
  const { wb } = await planilha()
  const [v] = validacoesDoXml(XML_DECIMAL, '06. APONTAMENTO DIÁRIO', wb)
  assert.equal(v.tipo, 'numero')
  assert.equal(v.min, '0')
})

test('validação sem sqref é ignorada — não dá para ligá-la a coluna nenhuma', async () => {
  const { wb } = await planilha()
  assert.deepEqual(validacoesDoXml('<dataValidation type="list"><formula1>"A,B"</formula1></dataValidation>', 'X', wb), [])
})

test('tipo desconhecido não vira campo — melhor sem regra do que com regra inventada', async () => {
  const { wb } = await planilha()
  assert.deepEqual(validacoesDoXml('<dataValidation type="custom" sqref="A1"><formula1>X</formula1></dataValidation>', 'X', wb), [])
})

test('as três validações juntas saem na ordem, cada uma com seu tipo', async () => {
  const { wb } = await planilha()
  const vs: ValidacaoLida[] = validacoesDoXml(XML_LISTA_LITERAL + XML_AUTO_FECHADO + XML_DECIMAL, 'X', wb)
  assert.deepEqual(vs.map((v) => v.tipo), ['lista', 'data', 'numero'])
})

// ─── O mapa da aba → arquivo, que não pode ser posicional ─────────────────────

test('🔴 a aba é casada pelo REL, não pela posição', () => {
  // Rels fora de ordem de propósito: é o caso em que o mapeamento posicional erra.
  const rels =
    '<Relationship Id="rId1" Target="worksheets/sheet3.xml"/>'
    + '<Relationship Id="rId2" Target="worksheets/sheet1.xml"/>'
  const wbxml =
    '<sheet name="GUIA RÁPIDO" sheetId="1" r:id="rId1"/>'
    + '<sheet name="00. LEIA-ME" sheetId="2" r:id="rId2"/>'
  const mapa = mapaDasAbas(wbxml, rels)
  assert.equal(mapa.get('GUIA RÁPIDO'), 'xl/worksheets/sheet3.xml')
  assert.equal(mapa.get('00. LEIA-ME'), 'xl/worksheets/sheet1.xml')
})

test('nome de aba com entidade XML é desescapado', () => {
  const mapa = mapaDasAbas('<sheet name="A &amp; B" r:id="rId1"/>', '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>')
  assert.ok(mapa.has('A & B'))
  assert.equal(desescapar('&quot;SIM,NÃO&quot;'), '"SIM,NÃO"')
})

// ─── Configurações é formulário ───────────────────────────────────────────────

test('🔴 01. CONFIGURAÇÕES é lido como formulário — o valor não vira nome de coluna', async () => {
  const { wb } = await planilha()
  const params = lerConfiguracoes(wb.Sheets['01. CONFIGURAÇÕES'])
  const empresa = params.find((p) => p.rotulo === 'Empresa executante')
  assert.ok(empresa, 'o rótulo tem de ser lido como RÓTULO')
  assert.equal(empresa.valor, 'WCR SANEAMENTO', 'e o valor como VALOR — antes ele virava coluna')
  assert.equal(empresa.celula, 'C5', 'a planilha cita as células nas próprias instruções')
})

test('as seções do painel de configuração são preservadas', async () => {
  const { wb } = await planilha()
  const params = lerConfiguracoes(wb.Sheets['01. CONFIGURAÇÕES'])
  const empresa = params.find((p) => p.rotulo === 'Empresa executante')
  assert.match(String(empresa?.secao), /IDENTIFICA/i)
})

test('configurações traz os parâmetros reais do contrato, não linhas de tabela', async () => {
  const { wb } = await planilha()
  const params = lerConfiguracoes(wb.Sheets['01. CONFIGURAÇÕES'])
  const porRotulo = new Map(params.map((p) => [p.rotulo, p.valor]))
  assert.equal(porRotulo.get('Contrato 1 — nome curto'), 'BERTIOGA')
  assert.equal(porRotulo.get('Contrato 2 — nome curto'), 'SANTOS')
  assert.ok(params.length > 20, `esperava dezenas de parâmetros, vieram ${params.length}`)
})

// ─── Uma aba de tabela, com as regras ligadas às colunas ──────────────────────

test('lerAba: acha o cabeçalho e liga a regra de cada coluna pelo índice', async () => {
  const { wb } = await planilha()
  // A validação é montada à mão: o que se testa aqui é o LIGAMENTO (intervalo → coluna → regra),
  // não a leitura do zip. A coluna E é a 4 (0-based).
  const validacoes = validacoesDoXml(
    '<dataValidation type="list" sqref="E5:E904"><formula1>&quot;EQUIPE 01,EQUIPE 02&quot;</formula1></dataValidation>',
    '04. PROGRAMAÇÃO DIÁRIA', wb,
  )
  const aba = lerAba(wb.Sheets['04. PROGRAMAÇÃO DIÁRIA'], '04. PROGRAMAÇÃO DIÁRIA',
    ['DATA', 'CONTRATO', 'EQUIPE', 'ID DO SERVIÇO'], validacoes)
  assert.ok(aba)
  assert.equal(aba.linhaDoCabecalho, 3, 'o cabeçalho real está na linha 4')
  const comRegra = aba.colunas.find((c) => c.indice === 4)
  assert.deepEqual(comRegra?.regra?.opcoes, ['EQUIPE 01', 'EQUIPE 02'])
  assert.equal(aba.colunas.find((c) => c.indice === 0)?.regra, undefined,
    'coluna fora do intervalo não pode herdar regra de vizinha')
})

test('🔴 coluna sem título é MARCADA, não batizada de "Coluna N"', async () => {
  const { wb } = await planilha()
  const aba = lerAba(wb.Sheets['04. PROGRAMAÇÃO DIÁRIA'], '04. PROGRAMAÇÃO DIÁRIA',
    ['DATA', 'CONTRATO', 'EQUIPE', 'ID DO SERVIÇO'])
  assert.ok(aba)
  const semTitulo = aba.colunas.filter((c) => !c.temTitulo)
  assert.ok(semTitulo.length > 0, 'esta aba tem colunas espaçadoras')
  for (const c of semTitulo) {
    assert.equal(chaveDaColuna(c), `col_${c.indice}`)
    assert.doesNotMatch(c.titulo, /Coluna/, 'nome inventado vira coluna de verdade na tela')
  }
})

test('lerAba devolve null quando o cabeçalho não bate — não inventa tabela', async () => {
  const { wb } = await planilha()
  assert.equal(lerAba(wb.Sheets['GUIA RÁPIDO'], 'GUIA RÁPIDO', ['ISTO NÃO EXISTE']), null)
})

test('as 20 abas operacionais continuam sendo reconhecidas', async () => {
  const { wb } = await planilha()
  // ⚠️ `/^\d/` sozinho conta 21: `00. LEIA-ME` também começa com dígito, e ele é GUIA, não aba
  // operacional. A conta certa exclui o 00.
  const operacionais = wb.SheetNames.filter((n) => /^\d/.test(n) && !n.startsWith('00.'))
  assert.equal(operacionais.length, 20, 'a rev15 tem 20 abas operacionais (01..18 + 01A + 01B)')
  assert.equal(wb.SheetNames.length, 22, '20 operacionais + GUIA RÁPIDO + 00. LEIA-ME')
})
