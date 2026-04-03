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
  let nPrecoLineIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(nPreco)) {
      nPrecoLineIdx = i
      break
    }
  }

  if (nPrecoLineIdx >= 0) {
    // Collect ALL lines between nPreco line and next section marker
    const descParts: string[] = []

    // Text on same line after the code
    const afterCode = lines[nPrecoLineIdx]
      .substring(lines[nPrecoLineIdx].indexOf(nPreco) + nPreco.length)
      .trim()
    if (afterCode.length > 3 && !afterCode.match(/^[\s,.:;-]*$/) && !afterCode.match(/^(SIntS|SiiS|UNIDADE|REGULAMENTA|COMPREENDE|MEDI|CAPITULO|REVISAO)/i)) {
      descParts.push(afterCode)
    }

    // Subsequent lines until a known section marker
    for (let i = nPrecoLineIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.length < 2) continue
      // Stop at section markers
      if (line.match(/^(SIntS|SiiS|UNIDADE|REGULAMENTA[ÇC]|COMPREENDE|MEDI[ÇC][ÃA]O|NOTAS?|CAPITULO|REVISAO)\b/i)) break
      // Stop if line looks like a header/metadata (all caps short line that's a section)
      if (line === line.toUpperCase() && line.length < 30 && line.match(/^[A-Z\s]+$/)) break
      descParts.push(line)
    }

    descricao = descParts.join(' ').replace(/\s+/g, ' ').trim()
  }

  // Fallback: regex on full text
  if (!descricao) {
    const descMatch = text.match(new RegExp(nPreco + '[\\s\\n]+(.+?)(?:SIntS|SiiS|UNIDADE|REGULAMENTA|COMPREENDE)', 'is'))
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
  // Strategy 1: UNIDADE followed by unit on same line
  const unidadeMatch = text.match(/UNIDADE\s*[:.]?\s*(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
  if (unidadeMatch) {
    unidade = unidadeMatch[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³')
  } else {
    // Strategy 2: UNIDADE on its own line, unit on next line
    for (let i = 0; i < lines.length; i++) {
      if (/UNIDADE/i.test(lines[i])) {
        // Check same line after UNIDADE
        const afterUnidade = lines[i].replace(/.*UNIDADE\s*[:.]?\s*/i, '').trim()
        const sameLineMatch = afterUnidade.match(/^(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
        if (sameLineMatch) {
          unidade = sameLineMatch[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³')
          break
        }
        // Check next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          const nextMatch = nextLine.match(/^(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
          if (nextMatch) {
            unidade = nextMatch[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³')
          }
        }
        break
      }
    }
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

  // Strip SIntS/SiiS prefix from description if it leaked in
  if (descricao.match(/^(SIntS|SiiS)\s*[:.]?\s*/i)) {
    descricaoSints = descricaoSints || descricao.replace(/^(SIntS|SiiS)\s*[:.]?\s*/i, '').trim()
    descricao = descricaoSints
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
