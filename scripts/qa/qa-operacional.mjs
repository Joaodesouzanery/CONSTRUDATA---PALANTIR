/**
 * Roda o leitor do Operacional contra o ARQUIVO REAL do cliente (rev15) e confere os números que
 * definem "lê TUDO da planilha".
 *
 * Não é teste unitário — a regra pura está em `leitorPlanilha.test.ts`. Isto aqui abre o `.xlsx`
 * de verdade (o que exige jszip, que não carrega no resolver de testes) e prova que o arquivo
 * inteiro entra. Rode com:
 *   node --import ./scripts/testes/resolver-ts.mjs scripts/qa/qa-operacional.mjs
 *
 * ⚠️ Se o cliente mandar uma revisão nova e um destes números mudar, este QA falha — e é isso que
 * se quer: a planilha mudou, alguém precisa olhar antes de importar.
 */
import fs from 'node:fs'
import xlsx from 'xlsx'
import JSZip from 'jszip'
import { mapaDasAbas, validacoesDoXml, lerConfiguracoes, lerAba } from '../../src/features/operacional/leitorPlanilha.ts'
import { SABESP_SHEETS } from '../../src/features/operacional/sabespStore.ts'
import { ehRegistroReal, lerBancoCustos } from '../../src/features/operacional/importarPlanilha.ts'

const XLSX = xlsx.default ?? xlsx
const CAMINHO = process.argv[2] ?? 'CONTROLE OPERACIONAL SABESP - BERTIOGA GUARUJA E SANTOS - WCR-rev15-PLANEJADOxREALIZADO.xlsx'

let falhas = 0
function conferir(ok, titulo, detalhe = '') {
  if (!ok) falhas++
  console.log(`  ${ok ? ' OK  ' : '❌ FALHA'}  ${titulo}${detalhe ? `  ${detalhe}` : ''}`)
}

if (!fs.existsSync(CAMINHO)) {
  console.log(`\n⚠️  ${CAMINHO} não está no repositório — QA pulado.`)
  process.exit(0)
}

const bin = fs.readFileSync(CAMINHO)
const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

console.log(`\n=== ${CAMINHO} ===`)

// ── abas ──────────────────────────────────────────────────────────────────────
console.log('\n-- as 22 abas --')
conferir(wb.SheetNames.length === 22, 'a planilha tem 22 abas', `são ${wb.SheetNames.length}`)
conferir(!!wb.Sheets['GUIA RÁPIDO'], 'GUIA RÁPIDO presente')
conferir(!!wb.Sheets['00. LEIA-ME'], '00. LEIA-ME presente')

// ── validações ────────────────────────────────────────────────────────────────
const zip = await JSZip.loadAsync(buffer)
const rels = await zip.file('xl/_rels/workbook.xml.rels').async('text')
const wbxml = await zip.file('xl/workbook.xml').async('text')
const arquivos = mapaDasAbas(wbxml, rels)

conferir(arquivos.size === 22, 'o mapa aba → arquivo cobre as 22', `cobriu ${arquivos.size}`)

const validacoes = []
for (const aba of wb.SheetNames) {
  const caminho = arquivos.get(aba)
  if (!caminho) continue
  const xml = await zip.file(caminho)?.async('text')
  if (xml) validacoes.push(...validacoesDoXml(xml, aba, wb))
}

const listas = validacoes.filter((v) => v.tipo === 'lista')
const semOpcoes = listas.filter((v) => !v.opcoes?.length)

console.log('\n-- ⚠️ as listas suspensas (eram 45 de 55) --')
conferir(listas.length === 55, 'a planilha declara 55 listas', `achou ${listas.length}`)
conferir(semOpcoes.length === 0, 'NENHUMA lista fica sem opções',
  semOpcoes.length ? `vazias: ${semOpcoes.map((v) => `${v.aba}/${v.intervalo}`).join(', ')}` : '')

console.log('\n-- ⚠️ as regras que não são lista (eram 0) --')
conferir(validacoes.filter((v) => v.tipo === 'data').length === 7, '7 regras de data')
conferir(validacoes.filter((v) => v.tipo === 'numero').length === 6, '6 regras de número')

// ── configurações é formulário ────────────────────────────────────────────────
console.log('\n-- ⚠️ 01. CONFIGURAÇÕES é formulário, não tabela --')
const params = lerConfiguracoes(wb.Sheets['01. CONFIGURAÇÕES'])
const porRotulo = new Map(params.map((p) => [p.rotulo, p.valor]))
conferir(porRotulo.get('Empresa executante') === 'WCR SANEAMENTO',
  'o valor é VALOR, não nome de coluna', `leu "${porRotulo.get('Empresa executante')}"`)
conferir(params.length >= 20, 'os parâmetros do contrato entraram', `${params.length} parâmetros`)

// ── as 20 abas operacionais ───────────────────────────────────────────────────
console.log('\n-- as 20 abas operacionais --')
let lidas = 0
let semTitulo = 0
let comRegra = 0
for (const def of SABESP_SHEETS) {
  const ws = wb.Sheets[def.sheetName]
  if (!ws) { conferir(false, `${def.label}: aba não encontrada`); continue }
  const aba = lerAba(ws, def.sheetName, def.keyColumns, validacoes)
  if (!aba) { conferir(false, `${def.label}: cabeçalho não reconhecido`); continue }
  lidas++
  semTitulo += aba.colunas.filter((c) => !c.temTitulo).length
  comRegra += aba.colunas.filter((c) => c.regra).length
}
conferir(lidas === SABESP_SHEETS.length, `as ${SABESP_SHEETS.length} abas operacionais foram lidas`, `lidas ${lidas}`)
conferir(semTitulo > 0, 'as colunas sem título estão MARCADAS (não viram "Coluna N")', `${semTitulo} colunas`)
conferir(comRegra > 0, 'as colunas com dropdown/regra carregam a regra', `${comRegra} colunas`)

// ── semântica: título/ajuda não pode virar registro ──────────────────────────
console.log('\n-- registros de negócio, não linhas visuais --')
const precos = lerAba(wb.Sheets['02. TABELA DE PREÇOS'], '02. TABELA DE PREÇOS', ['CHAVE'], validacoes)
const precosReais = precos?.linhas.filter((l) => ehRegistroReal('tabela_precos', l)) ?? []
conferir(precosReais.length === 511, 'Tabela de Preços tem exatamente 511 preços', `achou ${precosReais.length}`)
const bancoMatriz = XLSX.utils.sheet_to_json(wb.Sheets['01A. BANCO DE CUSTOS'], { header: 1, defval: '', raw: false })
const custos = lerBancoCustos(bancoMatriz)
conferir(custos.some((l) => l.Contrato === 'BERTIOGA'), 'Banco de Custos identifica Bertioga')
conferir(custos.some((l) => l.Contrato === 'SANTOS'), 'Banco de Custos identifica Santos')
for (const [id, esperado] of [['equipe', 31], ['medicao', 53], ['ocorrencias', 7], ['materiais', 0], ['lookahead', 0], ['plano_semanal', 0]]) {
  const def = SABESP_SHEETS.find((d) => d.id === id)
  const lida = lerAba(wb.Sheets[def.sheetName], def.sheetName, def.keyColumns, validacoes)
  const reais = lida?.linhas.filter((l) => ehRegistroReal(id, l)) ?? []
  conferir(reais.length === esperado, `${def.label}: só registros preenchidos`, `achou ${reais.length}`)
}

console.log(falhas === 0 ? '\nTUDO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
