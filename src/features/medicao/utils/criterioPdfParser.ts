/**
 * criterioPdfParser.ts - parseia PDFs Sabesp de criterios de medicao.
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CriterioMedicao } from '../data/criterios'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const UNIT_RE = '(GB|UN|M²|M³|M2|M3|M|MES|MÊS|EQD|KG)'

function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeForSearch(text: string): string {
  return cleanText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function sectionBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = start.exec(text)
  if (!startMatch) return ''
  const from = startMatch.index + startMatch[0].length
  const rest = text.slice(from)
  const endMatch = end.exec(rest)
  return cleanText(endMatch ? rest.slice(0, endMatch.index) : rest)
}

function inferUnidade(medicao: string, text: string): string {
  const compreendeIndex = text.search(/COMPREENDE/i)
  const intro = text.slice(0, compreendeIndex > 0 ? compreendeIndex : Math.min(text.length, 600))
  const explicit =
    intro.match(new RegExp(`SiiS:.*?\\b${UNIT_RE}\\s+REGULAMENTA`, 'i')) ||
    intro.match(new RegExp(`UNIDADE\\s+.*?\\b${UNIT_RE}\\b`, 'i')) ||
    text.match(new RegExp(`\\b${UNIT_RE}\\s+(?:REGULAMENTA|COMPREENDE|Folha)`, 'i'))

  if (explicit?.[1]) {
    return explicit[1].replace('M2', 'M²').replace('M3', 'M³').toUpperCase()
  }

  if (/metro\s+c[uú]bico|volume/i.test(medicao)) return 'M³'
  if (/metro\s+quadrado|[aá]rea/i.test(medicao)) return 'M²'
  if (/metro|extens[aã]o|linear/i.test(medicao)) return 'M'
  if (/global/i.test(medicao)) return 'GB'
  if (/unidade|liga[cç][aã]o|sondagem|po[cç]o|caixa/i.test(medicao)) return 'UN'
  return 'UN'
}

function detectGrupo(nPreco: string, descricao: string): Pick<CriterioMedicao, 'grupo' | 'grupoNome'> {
  const code = Number(nPreco)

  if (/canteiro|plano|comerciali|qualidade|projeto/i.test(descricao)) {
    return { grupo: '01', grupoNome: 'Canteiros e Planos' }
  }
  if (/esgoto|ramal coletivo|coletor|sanit[aá]rio|intradomiciliar|pv|po[cç]o de visita/i.test(descricao)) {
    return { grupo: '02', grupoNome: 'Esgoto' }
  }
  if (/[aá]gua|abastecimento|liga[cç].*[aá]gua|hidr[oô]metro|adutora|pead|pba/i.test(descricao)) {
    return { grupo: '03', grupoNome: 'Água' }
  }
  if (code >= 410000 && code < 510000) return { grupo: '02', grupoNome: 'Esgoto' }
  return { grupo: '03', grupoNome: 'Água' }
}

export function parseCriterioTextPages(pages: string[]): { items: CriterioMedicao[]; errors: string[] } {
  const items: CriterioMedicao[] = []
  const errors: string[] = []

  pages.forEach((pageText, index) => {
    const text = cleanText(pageText)
    const searchText = normalizeForSearch(text)
    const nPrecoMatch =
      searchText.match(/N.?\s*\.?\s*PRECO\s+DESCRICAO\s+UNIDADE\s+(\d{6,8})/i) ||
      searchText.match(/N.?\s*\.?\s*PRECO.*?\b(\d{6,8})\b/i) ||
      searchText.match(/\b(\d{6,8})\b.*?(?:SiiS|REGULAMENTA|COMPREENDE)/i)

    if (!nPrecoMatch?.[1]) return
    let nPreco = nPrecoMatch[1]
    if (items.some((c) => c.nPreco === nPreco)) return

    const codePos = text.indexOf(nPreco)
    const afterCode = codePos >= 0 ? text.slice(codePos + nPreco.length) : text
    let descricao = cleanText(afterCode.split(/SiiS:|REGULAMENTA\p{L}+\s+COMPREENDE|COMPREENDE:/iu)[0])
      .replace(new RegExp(`\\s+${UNIT_RE}$`, 'i'), '')
      .replace(/^[-:.\s]+/, '')
      .trim()

    const embeddedHeaderCode = normalizeForSearch(descricao).match(/^Folha\s+\d+\/\d+\s+(\d{6,8})\s+(.+)/i)
    if (embeddedHeaderCode?.[1]) {
      nPreco = embeddedHeaderCode[1]
      descricao = cleanText(descricao.replace(/^Folha\s+\d+\/\d+\s+\d{6,8}\s+/i, ''))
      if (items.some((c) => c.nPreco === nPreco)) return
    }

    if (!descricao) {
      const descFallback = text.match(/DESCRI\p{L}+\s+UNIDADE\s+\d{6,8}\s+(.+?)(?:SiiS:|REGULAMENTA|COMPREENDE)/iu)
      descricao = cleanText(descFallback?.[1] ?? '')
    }

    if (!descricao) {
      errors.push(`Página ${index + 1}: critério sem descrição reconhecível.`)
      return
    }

    const compreende = sectionBetween(text, /COMPREENDE\s*:/i, /MEDI\p{L}+\s*:|NOTAS?\s*:|Folha/iu)
    const medicao = sectionBetween(text, /MEDI\p{L}+\s*:/iu, /NOTAS?\s*:|Folha|Contrato/i)
    const notas = sectionBetween(text, /NOTAS?\s*:/i, /Folha|Contrato|$/i)
    const unidade = inferUnidade(medicao, text)
    const grupo = detectGrupo(nPreco, descricao)

    items.push({
      nPreco,
      descricao: descricao.substring(0, 240),
      unidade,
      ...grupo,
      compreende: compreende.substring(0, 1200),
      medicao: medicao.substring(0, 800),
      notas: notas.substring(0, 800),
    })
  })

  if (items.length === 0) {
    errors.push('Nenhum critério encontrado no PDF. Verifique se o arquivo é o "Regulamentação de Preços e Critérios de Medição" da Sabesp.')
  }

  return { items, errors }
}

export async function parseCriterioPdf(file: File): Promise<{ items: CriterioMedicao[]; errors: string[] }> {
  try {
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise
    const pages: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }

    return parseCriterioTextPages(pages)
  } catch (err) {
    return { items: [], errors: [`Erro ao ler PDF: ${err instanceof Error ? err.message : 'formato inválido'}`] }
  }
}
