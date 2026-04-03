/**
 * parseCriterioPdf.ts — Parses Sabesp criteria PDF documents.
 * Extracts measurement criteria from multi-page PDFs where each page
 * contains a single criterion with: N. Preço, Descrição, Unidade,
 * Regulamentação (Compreende), Medição, and Notas.
 */
import * as pdfjsLib from 'pdfjs-dist'
import type { CriterioMedicao } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface ParseProgress {
  current: number
  total: number
}

/**
 * Parse a Sabesp criteria PDF and extract measurement criteria.
 * Each page typically contains one criterion.
 */
export async function parseCriterioPdf(
  file: File,
  onProgress?: (progress: ParseProgress) => void,
): Promise<Omit<CriterioMedicao, 'id'>[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  const criteriosMap = new Map<string, Omit<CriterioMedicao, 'id'>>()

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress({ current: i, total: totalPages })

    try {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')

      const parsed = parseCriterioPage(text)
      if (parsed && parsed.nPreco) {
        // Merge with existing if same N. Preço (multi-page criteria)
        const existing = criteriosMap.get(parsed.nPreco)
        if (existing) {
          existing.regulamentacao = (existing.regulamentacao + '\n' + parsed.regulamentacao).trim()
          existing.notas = (existing.notas + '\n' + parsed.notas).trim()
          if (parsed.medicao && !existing.medicao) {
            existing.medicao = parsed.medicao
          }
        } else {
          criteriosMap.set(parsed.nPreco, parsed)
        }
      }
    } catch {
      // Skip pages that fail to parse
      continue
    }
  }

  return Array.from(criteriosMap.values())
}

/**
 * Parse a single page's text to extract criterion data.
 */
function parseCriterioPage(text: string): Omit<CriterioMedicao, 'id'> | null {
  // Extract N. Preço - look for numeric code near "PREÇO" or "N°"
  const nPrecoMatch = text.match(/N[°º]?\.\s*PRE[CÇ]O\s*(\d{3,8})/i)
    || text.match(/(?:^|\s)(\d{5,8})(?:\s)/m)
  if (!nPrecoMatch) return null

  const nPreco = nPrecoMatch[1].trim()

  // Extract description - text between N. Preço number and SIntS or UNIDADE
  let descricao = ''
  const descMatch = text.match(new RegExp(nPreco + '\\s+(.+?)(?:SIntS|UNIDADE|REGULAMENTA)', 'i'))
  if (descMatch) {
    descricao = descMatch[1].replace(/\s+/g, ' ').trim()
  }

  // Extract SIntS
  let descricaoSints: string | undefined
  const sintsMatch = text.match(/SIntS\s*:\s*(.+?)(?:UNIDADE|REGULAMENTA|COMPREENDE)/i)
  if (sintsMatch) {
    descricaoSints = sintsMatch[1].replace(/\s+/g, ' ').trim()
  }

  // Extract Unidade
  let unidade = ''
  const unidadeMatch = text.match(/UNIDADE\s*[:.]?\s*(M²|M³|M|KG|TON|UN|VB|CJ|L|PÇ|GL|CX|M2|M3)/i)
  if (unidadeMatch) {
    unidade = unidadeMatch[1].toUpperCase()
  }

  // Extract Regulamentação / Compreende
  let regulamentacao = ''
  const regMatch = text.match(/(?:REGULAMENTA[ÇC][ÃA]O|COMPREENDE)\s*[:.]?\s*([\s\S]*?)(?:MEDI[ÇC][ÃA]O|NOTAS?|Folha\s|Pag\.|$)/i)
  if (regMatch) {
    regulamentacao = regMatch[1]
      .replace(/\s+/g, ' ')
      .replace(/[-–]\s*/g, '\n- ')
      .trim()
  }

  // Extract Medição
  let medicao = ''
  const medMatch = text.match(/MEDI[ÇC][ÃA]O\s*[:.]?\s*([\s\S]*?)(?:NOTAS?|Folha\s|Pag\.|$)/i)
  if (medMatch) {
    medicao = medMatch[1].replace(/\s+/g, ' ').trim()
  }

  // Extract Notas
  let notas = ''
  const notasMatch = text.match(/NOTAS?\s*[:.]?\s*([\s\S]*?)(?:Folha\s|Pag\.|Contrato\s|$)/i)
  if (notasMatch) {
    notas = notasMatch[1]
      .replace(/\s+/g, ' ')
      .replace(/(\d+)\.\s*/g, '\n$1. ')
      .trim()
  }

  // Skip if we don't have minimal data
  if (!nPreco || (!descricao && !descricaoSints)) return null

  return {
    nPreco,
    descricao: descricao || descricaoSints || '',
    descricaoSints,
    unidade,
    regulamentacao,
    medicao,
    notas,
  }
}

/**
 * Convert a File to base64 string for storage.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Erro ao converter arquivo'))
    reader.readAsDataURL(file)
  })
}
