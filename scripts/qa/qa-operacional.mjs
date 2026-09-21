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
import { ehRegistroReal, lerBancoCustos, prepararImportacao } from '../../src/features/operacional/importarPlanilha.ts'
import { COLUNAS_DE_IDENTIDADE, chaveDaLinha } from '../../src/features/operacional/chaveDaLinha.ts'
import { celulasAlteradas, refDaCelula } from '../../src/features/operacional/planilhaFiel.ts'
import { gerarPlanilhaAtual } from '../../src/features/operacional/planilhaFielZip.ts'

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
  const aba = lerAba(ws, def.sheetName, def.colunasDoCabecalho, validacoes)
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
// ⚠️ Medição passou de 53 para 70 DE PROPÓSITO: o filtro exigia todas as colunas de identidade
// juntas e descartava 17 medições reais (boletim, mês, ID e contrato preenchidos) só porque o
// `CÓD. PREÇO` ainda não tinha chegado. Materiais, Lookahead e Plano seguem em 0 — o que há ali é
// bloco lateral e legenda, conferido linha a linha.
for (const [id, esperado] of [['equipe', 31], ['medicao', 70], ['ocorrencias', 7], ['materiais', 0], ['lookahead', 0], ['plano_semanal', 0]]) {
  const def = SABESP_SHEETS.find((d) => d.id === id)
  const lida = lerAba(wb.Sheets[def.sheetName], def.sheetName, def.colunasDoCabecalho, validacoes)
  const reais = lida?.linhas.filter((l) => ehRegistroReal(id, l)) ?? []
  conferir(reais.length === esperado, `${def.label}: só registros preenchidos`, `achou ${reais.length}`)
}

// ── a CHAVE: campo preenchido depois não pode mudar a identidade ─────────────
//
// ⚠️ Este bloco não existia, e é por isso que o commit `cecc4e4` trocou a chave do Banco de Custos
// sem nada acusar. A reimportação seguinte reportou 33 novas e 40 sumidas que eram as mesmas 33.
console.log('\n-- a chave de identidade --')
{
  const novoMapa = () => new Map()
  const casos = [
    ['programacao', { DATA: '2026-09-08', CONTRATO: 'BERTIOGA', 'ID DO SERVIÇO': 'BER-0001' }, 'EQUIPE', 'EQ-01'],
    ['ordens_servico', { 'ID DO SERVIÇO': 'BER-0001', CONTRATO: 'BERTIOGA' }, 'Nº OS SABESP', '998877'],
    ['apontamento', { DATA: '2026-09-08', CONTRATO: 'BERTIOGA' }, 'EQUIPE', 'EQ-02'],
    ['medicao', { 'ID DO SERVIÇO': 'BER-0001', 'CÓD. PREÇO (CHAVE)': 'BER-72000053' }, 'Nº BOLETIM', 'BM-10/2026'],
  ]
  for (const [aba, base, campo, valor] of casos) {
    const antes = chaveDaLinha(base, COLUNAS_DE_IDENTIDADE[aba], novoMapa())
    const depois = chaveDaLinha({ ...base, [campo]: valor }, COLUNAS_DE_IDENTIDADE[aba], novoMapa())
    conferir(antes === depois, `${aba}: preencher "${campo}" NÃO muda a chave`, `${antes} vs ${depois}`)
  }
  // Coluna-chave vazia ocupa a posição: sem isso duas linhas diferentes colidem em silêncio.
  conferir(
    chaveDaLinha({ A: 'x', B: '' }, ['A', 'B'], novoMapa()) !== chaveDaLinha({ A: '', B: 'x' }, ['A', 'B'], novoMapa()),
    'campo-chave vazio ocupa a posição na chave',
  )
}

// ── a importação ponta a ponta contra o arquivo real ─────────────────────────
console.log('\n-- a importação, com o arquivo do cliente --')
const arquivo = new File([bin], CAMINHO)
const p1 = await prepararImportacao(arquivo, 'qa-org', [])
conferir(p1.diagnostico.registros === 876, 'a importação enxerga 876 registros reais', `achou ${p1.diagnostico.registros}`)
conferir(p1.diagnostico.formulas === 50838, 'e detecta as 50.838 fórmulas', `achou ${p1.diagnostico.formulas}`)
conferir(p1.diagnostico.abasReconhecidas === 22, 'as 22 abas foram reconhecidas', `${p1.diagnostico.abasReconhecidas}`)
conferir(new Set(p1.paraGravar.map((l) => l.id)).size === p1.paraGravar.length, 'nenhum id de linha repetido')

// 🔴 A prova que o cliente vai fazer: subir a MESMA planilha de novo.
const p2 = await prepararImportacao(arquivo, 'qa-org', p1.paraGravar)
conferir(p2.resumo.novas === 0 && p2.resumo.ausentes === 0 && p2.resumo.atualizadas === 0,
  'reimportar o mesmo arquivo dá 0 nova, 0 sumida, 0 atualizada',
  JSON.stringify(p2.resumo))
conferir(p2.resumo.inalteradas === 876, 'e 876 inalteradas', `${p2.resumo.inalteradas}`)

// 🔴 A migração: o banco tem as chaves ANTIGAS da Medição (com Nº BOLETIM). A segunda passada
// precisa reconhecer as 70 pelo conteúdo — senão o cliente vê "70 novas e 70 sumiram" de novo.
{
  const norma = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
  const val = (o, r) => { const a = norma(r); for (const [k, v] of Object.entries(o)) if (norma(k) === a) return String(v ?? '').trim(); return '' }
  const antigas = p1.paraGravar.map((l) => {
    if (l.aba !== 'medicao') return l
    const chave = [val(l.valores, 'Nº BOLETIM'), val(l.valores, 'ID DO SERVIÇO'), val(l.valores, 'CÓD. PREÇO (CHAVE)')].filter(Boolean).join('|')
    return { ...l, id: `velho-${chave}`, chave }
  })
  const p3 = await prepararImportacao(arquivo, 'qa-org', antigas)
  conferir(p3.resumo.reidentificadas === 70, 'as 70 medições com chave antiga são RECONHECIDAS pelo conteúdo', `${p3.resumo.reidentificadas}`)
  conferir(p3.resumo.novas === 0 && p3.resumo.ausentes === 0, 'e nenhuma delas vira nova ou sumida', JSON.stringify(p3.resumo))
  const mantiveram = p3.paraGravar.filter((l) => l.aba === 'medicao' && String(l.id).startsWith('velho-')).length
  conferir(mantiveram === 70, 'as 70 mantêm o id antigo — a gravação SUBSTITUI, não duplica', `${mantiveram}`)
}

// ── a exportação FIEL: original × gerado ─────────────────────────────────────
console.log('\n-- a cirurgia no arquivo original --')
{
  const alvo = p1.paraGravar.find((l) => l.aba === 'ocorrencias')
  const campo = Object.keys(alvo.valores).find((k) => /DESCRI/i.test(k))
  const linhas = p1.paraGravar.map((l) => (l === alvo ? { ...l, valores: { ...l.valores, [campo]: 'TEXTO DE QA & TESTE' } } : l))

  const paraEscrever = SABESP_SHEETS.flatMap((def) => {
    const meta = p1.abas[def.id]
    if (!meta) return []
    const celulas = celulasAlteradas(def.id, meta, linhas.filter((l) => l.aba === def.id && l.ativa))
    return celulas.length ? [{ sheetName: def.sheetName, celulas }] : []
  })
  const total = paraEscrever.reduce((n, a) => n + a.celulas.length, 0)
  conferir(total === 1, 'editar UMA célula produz exatamente UMA célula no diff', `${total}`)
  conferir(refDaCelula(paraEscrever[0].celulas[0].linha, paraEscrever[0].celulas[0].coluna) === 'H5',
    'e ela cai no endereço certo do arquivo', refDaCelula(paraEscrever[0].celulas[0].linha, paraEscrever[0].celulas[0].coluna))

  const r = await gerarPlanilhaAtual(buffer, paraEscrever)
  const gerado = Buffer.from(await r.blob.arrayBuffer())
  // ⚠️ MESMAS opções da leitura do original. Ler um com `cellDates` e o outro sem faz 661 datas
  // compararem Date contra número, e a conferência acusa diferença onde não há nenhuma.
  const wbB = XLSX.read(gerado, { type: 'buffer', cellDates: true })

  conferir(JSON.stringify(wb.SheetNames) === JSON.stringify(wbB.SheetNames), 'as 22 abas saem na MESMA ordem')
  const formulas = (livro) => Object.fromEntries(livro.SheetNames.map((n) => [n, Object.keys(livro.Sheets[n]).filter((k) => !k.startsWith('!') && livro.Sheets[n][k].f).length]))
  const fA = formulas(wb); const fB = formulas(wbB)
  const totalF = Object.values(fB).reduce((a, b) => a + b, 0)
  conferir(JSON.stringify(fA) === JSON.stringify(fB), `as 50.838 fórmulas sobrevivem, aba por aba`, `gerado tem ${totalF}`)
  conferir(totalF === 50838, 'e o total continua 50.838', `${totalF}`)
  const dims = (livro) => Object.fromEntries(livro.SheetNames.map((n) => [n, livro.Sheets[n]['!ref']]))
  conferir(JSON.stringify(dims(wb)) === JSON.stringify(dims(wbB)), 'a dimensão de cada aba é idêntica (Medição A1:AB1512)')

  const zipB = await JSZip.loadAsync(gerado)
  const contarNoZip = async (z) => {
    let listas = 0; let regras = 0; let cf = 0
    for (const nome of Object.keys(z.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
      const x = await z.file(nome).async('text')
      listas += [...x.matchAll(/<dataValidation [^>]*type="list"/g)].length
      regras += [...x.matchAll(/<dataValidation /g)].length
      cf += [...x.matchAll(/<conditionalFormatting/g)].length
    }
    return [listas, regras, cf]
  }
  const [lA, rA, cA] = await contarNoZip(zip)
  const [lB, rB, cB] = await contarNoZip(zipB)
  conferir(lA === lB && rA === rB && cA === cB, 'listas, validações e formatação condicional intactas', `${lB}/${rB}/${cB}`)
  conferir(lB === 55 && cB === 47, 'e são as 55 listas e os 47 blocos de formatação condicional', `${lB}/${cB}`)
  conferir(JSON.stringify(Object.keys(zip.files).sort()) === JSON.stringify(Object.keys(zipB.files).sort()),
    'o ZIP tem exatamente as mesmas entradas — nem uma a mais')
  conferir(/fullCalcOnLoad="1"/.test(await zipB.file('xl/workbook.xml').async('text')),
    'o Excel vai recalcular ao abrir — senão o total fica com o valor velho em cache')

  let diferentes = 0
  for (const n of wb.SheetNames) {
    const A = wb.Sheets[n]; const B = wbB.Sheets[n]
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      if (k.startsWith('!')) continue
      if (String(A[k]?.v ?? '') !== String(B[k]?.v ?? '')) diferentes++
    }
  }
  conferir(diferentes === 1, '🔴 e SÓ a célula editada mudou no arquivo inteiro', `${diferentes} célula(s) diferentes`)
}

console.log(falhas === 0 ? '\nTUDO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
