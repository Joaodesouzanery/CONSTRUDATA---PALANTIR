/**
 * criterioPdfParser.ts — Parse Sabesp "Regulamentação de Preços e Critérios de Medição" PDF.
 *
 * Each page of the PDF contains one criterion with:
 *   - Nº PREÇO (6-digit code)
 *   - DESCRIÇÃO
 *   - UNIDADE
 *   - COMPREENDE section
 *   - MEDIÇÃO section
 *   - NOTAS section
 *
 * Uses pdfjs-dist (already installed) to extract text per page.
 */
import * as pdfjsLib from 'pdfjs-dist'
// @ts-expect-error Vite ?url import for worker
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CriterioMedicao } from '../data/criterios'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * Extract measurement criteria from a Sabesp PDF file.
 * Returns an array of CriterioMedicao objects, one per valid page.
 */
export async function parseCriterioPdf(file: File): Promise<{ items: CriterioMedicao[]; errors: string[] }> {
  const items: CriterioMedicao[] = []
  const errors: string[] = []

  try {
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')

      // Extract N. Preço — look for 6-digit code after "Nº. PREÇO" or "N. PREÇO" header
      const nPrecoMatch = text.match(/(?:N[º°]?\s*\.?\s*PRE[CÇ]O)\s+(\d{6})/i)
        || text.match(/\b(\d{6})\b.*?(?:REGULAMENTA|COMPREENDE)/i)
      if (!nPrecoMatch) continue

      const nPreco = nPrecoMatch[1]

      // Skip if we already have this code (multi-page criteria)
      if (items.some(c => c.nPreco === nPreco)) continue

      // Extract Unidade — look for common units after UNIDADE header or at end of first table
      const unidadeMatch = text.match(/UNIDADE\s+([A-Za-zÀ-ÿ²³/]+)/i)
        || text.match(/\b(GB|UN|M[²³]?|MES|MÊS|EQD|KG|M3|un)\s*(?:REGULAMENTA|Folha)/i)
      const unidade = unidadeMatch ? unidadeMatch[1].trim().toUpperCase() : 'UN'

      // Extract Descrição — text between N.Preço code and UNIDADE/REGULAMENTAÇÃO
      let descricao = ''
      const descMatch = text.match(new RegExp(nPreco + '\\s+(.+?)\\s+(?:' + unidade + '|REGULAMENTA|UNIDADE)', 'i'))
      if (descMatch) {
        descricao = descMatch[1].trim()
        // Clean SiiS code if present
        descricao = descricao.replace(/SiiS:.*$/i, '').trim()
      }
      if (!descricao) {
        // Fallback: get text after DESCRIÇÃO header
        const descFallback = text.match(/DESCRI[ÇC][AÃ]O\s+(.+?)(?:UNIDADE|REGULAMENTA)/i)
        if (descFallback) descricao = descFallback[1].replace(/SiiS:.*$/i, '').trim()
      }
      if (!descricao) continue

      // Extract COMPREENDE section
      const compreendeMatch = text.match(/COMPREENDE[:\s]+(.+?)(?:MEDI[ÇC][AÃ]O:|$)/is)
      const compreende = compreendeMatch ? compreendeMatch[1].replace(/\s+/g, ' ').trim() : ''

      // Extract MEDIÇÃO section
      const medicaoMatch = text.match(/MEDI[ÇC][AÃ]O[:\s]+(.+?)(?:NOTAS?:|Folha|$)/is)
      const medicao = medicaoMatch ? medicaoMatch[1].replace(/\s+/g, ' ').trim() : ''

      // Extract NOTAS section
      const notasMatch = text.match(/NOTAS?[:\s]+(.+?)(?:Folha|Contrato|$)/is)
      const notas = notasMatch ? notasMatch[1].replace(/\s+/g, ' ').trim() : ''

      // Detect grupo from description or N.Preço range
      let grupo: '01' | '02' | '03' = '03'
      let grupoNome = 'Água'
      const code = parseInt(nPreco)
      if (code >= 500000 && code < 510000 && /canteiro|plano|comerciali|qualidade/i.test(descricao)) {
        grupo = '01'; grupoNome = 'Canteiros e Planos'
      } else if (code >= 420000 && code < 430000 || /esgoto|rede colet|ramal.*esg/i.test(descricao)) {
        grupo = '02'; grupoNome = 'Esgoto'
      } else if (code >= 410000 && code < 420000 || /agua|abastec|ligac.*agua|PEAD/i.test(descricao)) {
        grupo = '03'; grupoNome = 'Água'
      }

      items.push({
        nPreco,
        descricao: descricao.substring(0, 200), // Limit length
        unidade,
        grupo,
        grupoNome,
        compreende: compreende.substring(0, 1000),
        medicao: medicao.substring(0, 500),
        notas: notas.substring(0, 500),
      })
    }

    if (items.length === 0) {
      errors.push('Nenhum critério encontrado no PDF. Verifique se o arquivo é o "Regulamentação de Preços e Critérios de Medição" da Sabesp.')
    }
  } catch (err) {
    errors.push(`Erro ao ler PDF: ${err instanceof Error ? err.message : 'formato inválido'}`)
  }

  return { items, errors }
}
