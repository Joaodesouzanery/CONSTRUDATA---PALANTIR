/**
 * parseCriterioPdf.ts — Parses Sabesp criteria PDF documents.
 * Extracts measurement criteria from multi-page PDFs where each page
 * contains a single criterion with: N. Preço, Descrição, Unidade,
 * Regulamentação (Compreende), Medição, and Notas.
 *
 * Uses Y-position grouping for better line detection from pdfjs-dist.
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CriterioMedicao } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface ParseProgress {
  current: number
  total: number
}

/**
 * Extract text from a PDF page preserving line structure using Y-position grouping.
 */
async function extractPageLines(page: pdfjsLib.PDFPageProxy): Promise<string[]> {
  const content = await page.getTextContent()
  if (!content.items.length) return []

  // Group text items by Y position (same line = similar Y)
  const lineMap = new Map<number, { x: number; text: string }[]>()
  const Y_TOLERANCE = 3

  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const y = Math.round(('transform' in item ? item.transform[5] : 0) / Y_TOLERANCE) * Y_TOLERANCE
    const x = 'transform' in item ? item.transform[4] : 0
    if (!lineMap.has(y)) lineMap.set(y, [])
    lineMap.get(y)!.push({ x, text: item.str })
  }

  // Sort by Y descending (PDF coordinates: top of page = higher Y)
  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)

  const lines: string[] = []
  for (const y of sortedYs) {
    const items = lineMap.get(y)!.sort((a, b) => a.x - b.x)
    lines.push(items.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim())
  }

  return lines.filter((l) => l.length > 0)
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
      const lines = await extractPageLines(page)
      const text = lines.join('\n')

      const parsed = parseCriterioPage(text, lines)
      if (parsed && parsed.nPreco) {
        const existing = criteriosMap.get(parsed.nPreco)
        if (existing) {
          // Merge multi-page criteria
          if (parsed.regulamentacao) {
            existing.regulamentacao = (existing.regulamentacao + '\n' + parsed.regulamentacao).trim()
          }
          if (parsed.notas) {
            existing.notas = (existing.notas + '\n' + parsed.notas).trim()
          }
          if (parsed.medicao && !existing.medicao) {
            existing.medicao = parsed.medicao
          }
          if (parsed.descricao && !existing.descricao) {
            existing.descricao = parsed.descricao
          }
        } else {
          criteriosMap.set(parsed.nPreco, parsed)
        }
      }
    } catch {
      continue
    }
  }

  return Array.from(criteriosMap.values())
}

/**
 * Parse a single page's text to extract criterion data.
 * Uses both full text and individual lines for better extraction.
 */
function parseCriterioPage(
  text: string,
  lines: string[],
): Omit<CriterioMedicao, 'id'> | null {
  // ── Extract N. Preço ─────────────────────────────────────────────────
  // Try multiple patterns from most specific to least
  let nPreco = ''

  // Pattern 1: "N°. PREÇO" followed by number (possibly on next line)
  const p1 = text.match(/N[°º]?\.\s*PRE[CÇ]O[\s\S]{0,30}?(\d{3,8})/i)
  if (p1) nPreco = p1[1]

  // Pattern 2: "PREÇO" keyword near a 3-8 digit number
  if (!nPreco) {
    const p2 = text.match(/PRE[CÇ]O\s*[\n\s:]*(\d{3,8})/i)
    if (p2) nPreco = p2[1]
  }

  // Pattern 3: Look in lines for a standalone 5-8 digit number near the top
  if (!nPreco) {
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const m = lines[i].match(/\b(\d{5,8})\b/)
      if (m && !lines[i].match(/pag|folha|contrato|pagina/i)) {
        nPreco = m[1]
        break
      }
    }
  }

  if (!nPreco) return null

  // ── Extract Description ──────────────────────────────────────────────
  let descricao = ''

  // Find the line containing nPreco and get text after it
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(nPreco)) {
      // Description might be on the same line after nPreco
      const afterCode = lines[i].substring(lines[i].indexOf(nPreco) + nPreco.length).trim()
      if (afterCode.length > 5 && !afterCode.match(/^[\s,.:;-]*$/)) {
        descricao = afterCode.replace(/\s+/g, ' ').trim()
      }
      // Or on the next line(s)
      if (!descricao && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (nextLine.length > 5 && !nextLine.match(/^(SIntS|UNIDADE|REGULAMENTA|COMPREENDE|MEDI)/i)) {
          descricao = nextLine
          // Also check the line after for continuation
          if (i + 2 < lines.length) {
            const line3 = lines[i + 2].trim()
            if (line3.length > 3 && !line3.match(/^(SIntS|UNIDADE|REGULAMENTA|COMPREENDE|MEDI)/i)) {
              descricao += ' ' + line3
            }
          }
        }
      }
      break
    }
  }

  // Fallback: regex on full text
  if (!descricao) {
    const descMatch = text.match(new RegExp(nPreco + '[\\s\\n]+(.+?)(?:SIntS|UNIDADE|REGULAMENTA|COMPREENDE)', 'is'))
    if (descMatch) {
      descricao = descMatch[1].replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  // ── Extract SIntS ────────────────────────────────────────────────────
  let descricaoSints: string | undefined
  const sintsMatch = text.match(/SIntS\s*[:.]?\s*(.+?)(?:\n|UNIDADE|REGULAMENTA|COMPREENDE)/i)
  if (sintsMatch) {
    descricaoSints = sintsMatch[1].replace(/\s+/g, ' ').trim()
  }

  // ── Extract Unidade ──────────────────────────────────────────────────
  let unidade = ''
  const unidadeMatch = text.match(/UNIDADE\s*[:.]?\s*(M[²³2³]|M|KG|TON|UN|VB|CJ|L|P[ÇC]|GL|CX|GB|MES|DI|H|PA|SC|BR)\b/i)
  if (unidadeMatch) {
    unidade = unidadeMatch[1].toUpperCase()
  }

  // ── Extract Regulamentação / Compreende ──────────────────────────────
  let regulamentacao = ''
  const regMatch = text.match(/(?:REGULAMENTA[ÇC][ÃA]O|COMPREENDE)\s*[:.]?\s*([\s\S]*?)(?:MEDI[ÇC][ÃA]O\s*:|NOTAS?\s*:|Folha\s|Pag[\s.]+\d)/i)
  if (regMatch) {
    regulamentacao = regMatch[1]
      .replace(/\n\s*[-–•]\s*/g, '\n- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // ── Extract Medição ──────────────────────────────────────────────────
  let medicao = ''
  const medMatch = text.match(/MEDI[ÇC][ÃA]O\s*[:.]?\s*([\s\S]*?)(?:NOTAS?\s*:|Folha\s|Pag[\s.]+\d|$)/i)
  if (medMatch) {
    medicao = medMatch[1].replace(/\s+/g, ' ').trim()
  }

  // ── Extract Notas ────────────────────────────────────────────────────
  let notas = ''
  const notasMatch = text.match(/NOTAS?\s*[:.]?\s*([\s\S]*?)(?:Folha\s|Pag[\s.]+\d|Contrato\s+\d|$)/i)
  if (notasMatch) {
    notas = notasMatch[1]
      .replace(/\n\s*(\d+)[.)]\s*/g, '\n$1. ')
      .trim()
  }

  // Use SIntS as fallback description
  if (!descricao && descricaoSints) {
    descricao = descricaoSints
  }

  // Accept criteria even with minimal data (just nPreco is enough)
  if (!nPreco) return null

  return {
    nPreco,
    descricao: descricao || `Critério ${nPreco}`,
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
