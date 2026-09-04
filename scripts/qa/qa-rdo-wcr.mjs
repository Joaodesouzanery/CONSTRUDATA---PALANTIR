/**
 * Roda o apontamento REAL da WCR pelos dois caminhos — colado e em planilha — e prova que dão o
 * mesmo resultado. Depois manda o RDO para o gerador de PDF e prova que o corpo sai preenchido.
 *
 * É a demonstração de ponta a ponta do item 1: "cola e o RDO aparece pronto".
 *
 * Rode com:
 *   node --import ./scripts/testes/resolver-ts.mjs scripts/qa/qa-rdo-wcr.mjs
 */
import xlsx from 'xlsx'
import { parseApontamentoWcr, resumirApontamento, SIGLAS_WCR } from '../../src/features/rdo/utils/apontamentoWcr.ts'
import { lerPlanilhaWcr } from '../../src/features/rdo/utils/apontamentoWcrPlanilha.ts'
import { buildRdosReportHtml } from '../../src/features/rdo/utils/rdosReportExport.ts'

const XLSX = xlsx.default ?? xlsx
const HOJE = '2026-09-04'

/** Letra por letra como o cliente mandou, inclusive os espaços sobrando. */
const APONTAMENTO = `📋 APONTAMENTO DIÁRIO — MODELO

Produção - 31/08
Equipe - Gilvan 
Núcleo - Boi Malhado
Imóvel - rua santa rosa de sul 
Imóvel - Rua  Santa Rosa do Tocantins 
Imóvel - rua um 

SERVIÇO ÁGUA
PRA - 
LA - 
LIA - 
Caixa UMA - 
HM - 100
Interligação - 
Válvula - 

SERVIÇO ESGOTO
PRE - 
LE - 
LIE - 
PV - 
PI - 
CI - 

obs: qualquer coisa fora da lista escreve aqui`

let falhas = 0
const conferir = (ok, rotulo, detalhe = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FALHA'}  ${rotulo}${detalhe ? `  ${detalhe}` : ''}`)
  if (!ok) falhas++
}

console.log('\n=== RDO WCR — apontamento real do cliente ===')

// ── 1. colado ────────────────────────────────────────────────────────────────
const colado = parseApontamentoWcr(APONTAMENTO, { hoje: HOJE })
console.log('\n-- colado do WhatsApp --')
conferir(colado.data === '2026-08-31', 'a data saiu certa', colado.data ?? '(nenhuma)')
conferir(colado.anoInferido === true, 'e a tela sabe que o ano foi deduzido')
conferir(colado.equipe === 'Gilvan', 'equipe')
conferir(colado.nucleo === 'Boi Malhado', 'núcleo')
conferir(colado.imoveis.length === 3, 'os TRÊS imóveis contam', `imóveis=${colado.imoveis.length}`)
conferir(colado.linhas.length === SIGLAS_WCR.length, 'as 13 siglas aparecem', `linhas=${colado.linhas.length}`)
conferir(colado.naoEntendidas.length === 0, 'nada ficou sem entender')
conferir(!!colado.observacoes, 'a observação foi capturada')

console.log('\n-- ⚠️ vazio é AUSENTE, nunca zero --')
const zeros = colado.linhas.filter((l) => l.quantidade === 0)
conferir(zeros.length === 0, 'nenhuma sigla vazia virou 0', zeros.map((l) => l.sigla).join(', '))
const comNumero = colado.linhas.filter((l) => l.quantidade !== undefined)
conferir(comNumero.length === 1 && comNumero[0].sigla === 'HM',
  'só o HM tem número, como no apontamento', `com número=${comNumero.length}`)

const resumo = resumirApontamento(colado)
conferir(resumo.unidades === 100 && resumo.metros === 0 && resumo.semMedida === 12,
  'o resumo separa unidade, metro e sem-medida',
  `un=${resumo.unidades} m=${resumo.metros} sem=${resumo.semMedida}`)

// ── 2. o mesmo, em planilha ──────────────────────────────────────────────────
console.log('\n-- o MESMO apontamento, em .xlsx --')
const cabecalho = ['DATA', 'EQUIPE', 'NÚCLEO', 'IMÓVEIS', ...SIGLAS_WCR.map((s) => s.sigla), 'OBS']
const linha = [
  '31/08/2026', 'Gilvan', 'Boi Malhado',
  colado.imoveis.join('; '),
  ...SIGLAS_WCR.map((s) => (s.sigla === 'HM' ? 100 : null)),
  colado.observacoes,
]
const ws = XLSX.utils.aoa_to_sheet([['APONTAMENTO WCR'], cabecalho, linha])
const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
const daPlanilha = lerPlanilhaWcr(matriz, { hoje: HOJE }).apontamentos[0]

conferir(!!daPlanilha, 'a planilha foi lida')
if (daPlanilha) {
  conferir(daPlanilha.data === colado.data, 'mesma data')
  conferir(daPlanilha.equipe === colado.equipe, 'mesma equipe')
  conferir(daPlanilha.nucleo === colado.nucleo, 'mesmo núcleo')
  conferir(JSON.stringify(daPlanilha.imoveis) === JSON.stringify(colado.imoveis), 'mesmos imóveis')
  conferir(JSON.stringify(daPlanilha.linhas) === JSON.stringify(colado.linhas),
    '⭐ MESMAS LINHAS DE PRODUÇÃO — colar e importar não podem divergir')
  const r2 = resumirApontamento(daPlanilha)
  conferir(r2.unidades === resumo.unidades && r2.metros === resumo.metros && r2.semMedida === resumo.semMedida,
    'mesmo resumo')
}

// ── 3. o PDF ─────────────────────────────────────────────────────────────────
console.log('\n-- o RDO sai INTEIRO no PDF --')
const agora = '2026-08-31T12:00:00Z'
const rdo = {
  id: 'qa', number: 1, status: 'finalizado', date: colado.data, responsible: colado.equipe,
  weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 0 },
  manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
  equipment: [], services: [], trechos: [], materials: [], geolocation: null,
  observations: colado.observacoes ?? '', incidents: '', photos: [],
  createdAt: agora, updatedAt: agora,
  template: 'wcr',
  wcr: {
    equipe: colado.equipe, nucleo: colado.nucleo, imoveis: colado.imoveis,
    producao: colado.linhas.map((l) => ({
      sigla: l.sigla,
      quantidade: l.quantidade === undefined ? '' : String(l.quantidade),
      unidade: l.unidade,
    })),
    observacoes: colado.observacoes, anoInferido: colado.anoInferido,
  },
}
const html = buildRdosReportHtml([{ tipo: 'torre', rdo }], { periodo: 'ago/2026' })

conferir(/Produção do dia/.test(html), 'o corpo WCR foi impresso (e não o corpo padrão vazio)')
conferir(/HM/.test(html) && /100/.test(html), 'o serviço executado aparece')
conferir(/Boi Malhado/.test(html), 'o núcleo aparece')
conferir(colado.imoveis.every((i) => html.includes(i.replace(/&/g, '&amp;'))), 'os três imóveis aparecem')
conferir(/não informado/.test(html), '⚠️ as siglas SEM medida aparecem como "não informado"')
conferir(/deduzido/i.test(html), 'o PDF avisa que o ano foi deduzido')
conferir(/WCR/.test(html), 'o sumário identifica o modelo')

console.log(falhas === 0 ? '\nTUDO CONFERE.\n' : `\n${falhas} FALHA(S).\n`)
process.exit(falhas === 0 ? 0 : 1)
