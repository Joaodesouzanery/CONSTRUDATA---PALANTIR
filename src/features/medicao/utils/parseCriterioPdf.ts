/**
 * parseCriterioPdf.ts — Parses Sabesp criteria PDF documents.
 * Extracts measurement criteria from multi-page PDFs where each page
 * contains a single criterion with: N. Preço, Descrição, Unidade,
 * Regulamentação (Compreende), Medição, and Notas.
 *
 * Uses X/Y coordinate-based extraction for reliable column separation
 * in the Sabesp table layout (N°. PREÇO | DESCRIÇÃO | UNIDADE).
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CriterioMedicao } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface ParseProgress {
  current: number
  total: number
}

interface TextItem {
  x: number
  y: number
  text: string
  width: number
  height: number
}

// ─── Low-level text extraction ──────────────────────────────────────────────

/**
 * Extract ALL text items with their X/Y coordinates from a page.
 */
async function extractTextItems(page: pdfjsLib.PDFPageProxy): Promise<TextItem[]> {
  const content = await page.getTextContent()
  const items: TextItem[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    items.push({
      x: 'transform' in item ? item.transform[4] : 0,
      y: 'transform' in item ? item.transform[5] : 0,
      text: item.str,
      width: 'width' in item ? (item as { width: number }).width : 0,
      height: 'transform' in item ? item.transform[3] : 0,
    })
  }
  return items
}

/**
 * Group text items into lines by Y coordinate, sorted top-to-bottom.
 */
function groupIntoLines(items: TextItem[], yTolerance = 3): { y: number; items: TextItem[] }[] {
  const lineMap = new Map<number, TextItem[]>()
  for (const item of items) {
    const yKey = Math.round(item.y / yTolerance) * yTolerance
    if (!lineMap.has(yKey)) lineMap.set(yKey, [])
    lineMap.get(yKey)!.push(item)
  }
  return Array.from(lineMap.entries())
    .sort(([a], [b]) => b - a) // Y descending = top to bottom
    .map(([y, lineItems]) => ({
      y,
      items: lineItems.sort((a, b) => a.x - b.x),
    }))
}

/**
 * Convert lines into plain text strings (for regex-based section extraction).
 */
function linesToStrings(lines: { y: number; items: TextItem[] }[]): string[] {
  return lines.map((line) =>
    line.items.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim()
  ).filter((s) => s.length > 0)
}

// ─── Table row extraction (coordinate-based) ───────────────────────────────

/**
 * Detect the table header row ("N°. PREÇO | DESCRIÇÃO | UNIDADE") and determine
 * column boundaries from actual header positions.
 */
function detectTableColumns(lines: { y: number; items: TextItem[] }[]): {
  headerLineIdx: number
  nPrecoXMax: number
  descXMin: number
  descXMax: number
  unidadeXMin: number
} | null {
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const lineText = lines[i].items.map((it) => it.text).join(' ')
    // Look for the header row containing PREÇO and DESCRIÇÃO
    if (/PRE[CÇ]O/i.test(lineText) && /DESCRI/i.test(lineText)) {
      let nPrecoX = 0
      let descX = 0
      let unidadeX = 0
      for (const item of lines[i].items) {
        if (/PRE[CÇ]O/i.test(item.text)) nPrecoX = item.x + (item.width || 60)
        if (/DESCRI/i.test(item.text)) descX = item.x
        if (/UNIDADE/i.test(item.text)) unidadeX = item.x
      }
      return {
        headerLineIdx: i,
        nPrecoXMax: nPrecoX > 0 ? nPrecoX : 150,
        descXMin: descX > 0 ? descX - 5 : 120,
        descXMax: unidadeX > 0 ? unidadeX - 5 : 500,
        unidadeXMin: unidadeX > 0 ? unidadeX - 5 : 500,
      }
    }
  }
  return null
}

/**
 * Extract the table data row (nPreco, descricao, unidade) using column X boundaries.
 * Looks at the line(s) right after the header.
 */
function extractTableData(
  lines: { y: number; items: TextItem[] }[],
  cols: { headerLineIdx: number; nPrecoXMax: number; descXMin: number; descXMax: number; unidadeXMin: number },
): { nPreco: string; descricao: string; unidade: string; sints: string } {
  let nPreco = ''
  let descParts: string[] = []
  let unidade = ''
  let sints = ''

  // Scan lines after header for table data (typically 1-3 lines of data)
  for (let i = cols.headerLineIdx + 1; i < Math.min(lines.length, cols.headerLineIdx + 6); i++) {
    const lineText = lines[i].items.map((it) => it.text).join(' ')
    // Stop if we hit REGULAMENTAÇÃO section
    if (/REGULAMENTA/i.test(lineText)) break

    for (const item of lines[i].items) {
      if (item.x < cols.nPrecoXMax) {
        // N. Preço column
        const m = item.text.match(/\b(\d{3,8})\b/)
        if (m && !nPreco) nPreco = m[1]
      } else if (item.x >= cols.unidadeXMin) {
        // Unidade column
        const unitMatch = item.text.match(/\b(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
        if (unitMatch && !unidade) {
          unidade = unitMatch[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³')
        }
      } else if (item.x >= cols.descXMin && item.x < cols.descXMax) {
        // Descrição column
        descParts.push(item.text)
      }
    }
  }

  // Separate full description from SIntS abbreviation
  const fullDesc = descParts.join(' ').replace(/\s+/g, ' ').trim()
  const sintsMatch = fullDesc.match(/\b(SIntS|SiiS)\s*[:.]?\s*(.+)$/i)
  if (sintsMatch) {
    sints = sintsMatch[2].trim()
    const mainDesc = fullDesc.substring(0, sintsMatch.index).trim()
    return { nPreco, descricao: mainDesc || sints, unidade, sints }
  }

  return { nPreco, descricao: fullDesc, unidade, sints }
}

// ─── Section extraction (regex-based on concatenated text) ──────────────────

function extractSections(text: string, _lineStrings?: string[]): {
  regulamentacao: string
  medicao: string
  notas: string
} {
  // ── Regulamentação / Compreende
  let regulamentacao = ''
  const regMatch = text.match(/(?:REGULAMENTA[ÇC][ÃA]O|COMPREENDE)\s*[:.]?\s*([\s\S]*?)(?:MEDI[ÇC][ÃA]O\s*[:.]|NOTAS?\s*[:.]|Folha\s|Pag[\s.]+\d|$)/i)
  if (regMatch) {
    regulamentacao = regMatch[1]
      .replace(/\n\s*[-–•]\s*/g, '\n- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // ── Medição
  let medicao = ''
  const medMatch = text.match(/MEDI[ÇC][ÃA]O\s*[:.]?\s*([\s\S]*?)(?:NOTAS?\s*[:.]|Folha\s|Pag[\s.]+\d|$)/i)
  if (medMatch) {
    medicao = medMatch[1].replace(/\s+/g, ' ').trim()
  }

  // ── Notas
  let notas = ''
  const notasMatch = text.match(/NOTAS?\s*[:.]?\s*([\s\S]*?)(?:Folha\s|Pag[\s.]+\d|Contrato\s+\d|$)/i)
  if (notasMatch) {
    notas = notasMatch[1]
      .replace(/\n\s*(\d+)[.)]\s*/g, '\n$1. ')
      .trim()
  }

  return { regulamentacao, medicao, notas }
}

// ─── Fallback parser (for pages without table structure) ────────────────────

function parseFallback(text: string, lineStrings: string[]): Omit<CriterioMedicao, 'id'> | null {
  let nPreco = ''

  // Try "N°. PREÇO" pattern
  const p1 = text.match(/N[°º]?\.\s*PRE[CÇ]O[\s\S]{0,30}?(\d{3,8})/i)
  if (p1) nPreco = p1[1]

  if (!nPreco) {
    const p2 = text.match(/PRE[CÇ]O\s*[\n\s:]*(\d{3,8})/i)
    if (p2) nPreco = p2[1]
  }

  // Scan first 8 lines for standalone 5-8 digit number
  if (!nPreco) {
    for (let i = 0; i < Math.min(lineStrings.length, 8); i++) {
      const m = lineStrings[i].match(/\b(\d{5,8})\b/)
      if (m && !lineStrings[i].match(/pag|folha|contrato|pagina/i)) {
        nPreco = m[1]
        break
      }
    }
  }

  if (!nPreco) return null

  // Description: collect lines between nPreco and section markers
  let descricao = ''
  let nPrecoLineIdx = -1
  for (let i = 0; i < lineStrings.length; i++) {
    if (lineStrings[i].includes(nPreco)) { nPrecoLineIdx = i; break }
  }

  if (nPrecoLineIdx >= 0) {
    const descParts: string[] = []
    const afterCode = lineStrings[nPrecoLineIdx]
      .substring(lineStrings[nPrecoLineIdx].indexOf(nPreco) + nPreco.length)
      .trim()
    if (afterCode.length > 3 && !afterCode.match(/^[\s,.:;-]*$/) && !afterCode.match(/^(SIntS|SiiS|UNIDADE|REGULAMENTA|COMPREENDE|MEDI|CAPITULO|REVISAO)/i)) {
      descParts.push(afterCode)
    }
    for (let i = nPrecoLineIdx + 1; i < lineStrings.length; i++) {
      const line = lineStrings[i].trim()
      if (!line || line.length < 2) continue
      if (line.match(/^(SIntS|SiiS|UNIDADE|REGULAMENTA[ÇC]|COMPREENDE|MEDI[ÇC][ÃA]O|NOTAS?|CAPITULO|REVISAO)\b/i)) break
      if (line === line.toUpperCase() && line.length < 30 && line.match(/^[A-Z\s]+$/)) break
      descParts.push(line)
    }
    descricao = descParts.join(' ').replace(/\s+/g, ' ').trim()
  }

  // SIntS extraction
  let descricaoSints: string | undefined
  const sintsMatch = text.match(/(SIntS|SiiS)\s*[:.]?\s*(.+?)(?:\n|UNIDADE|REGULAMENTA|COMPREENDE)/i)
  if (sintsMatch) {
    descricaoSints = sintsMatch[2].replace(/\s+/g, ' ').trim()
  }

  // Clean SIntS from description
  if (descricao.match(/^(SIntS|SiiS)\s*[:.]?\s*/i)) {
    descricaoSints = descricaoSints || descricao.replace(/^(SIntS|SiiS)\s*[:.]?\s*/i, '').trim()
    descricao = descricaoSints || ''
  }
  if (!descricao && descricaoSints) descricao = descricaoSints

  // Unidade: two-strategy extraction
  let unidade = ''
  const uMatch = text.match(/UNIDADE\s*[:.]?\s*(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
  if (uMatch) {
    unidade = uMatch[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³')
  } else {
    for (let i = 0; i < lineStrings.length; i++) {
      if (/UNIDADE/i.test(lineStrings[i])) {
        const after = lineStrings[i].replace(/.*UNIDADE\s*[:.]?\s*/i, '').trim()
        const sm = after.match(/^(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
        if (sm) { unidade = sm[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³'); break }
        if (i + 1 < lineStrings.length) {
          const nm = lineStrings[i + 1].trim().match(/^(M[²³]|M2|M3|M\b|KG|TON|UN|VB|CJ|L\b|P[ÇC]|GL|CX|GB|MES|DI|H\b|PA|SC|BR)\b/i)
          if (nm) { unidade = nm[1].toUpperCase().replace('M2', 'M²').replace('M3', 'M³') }
        }
        break
      }
    }
  }

  const { regulamentacao, medicao, notas } = extractSections(text, lineStrings)

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

// ─── Main parser ────────────────────────────────────────────────────────────

/**
 * Parse a Sabesp criteria PDF and extract measurement criteria.
 * Each page typically contains one criterion.
 *
 * Strategy:
 * 1. Try coordinate-based extraction (detects table header, uses X boundaries)
 * 2. Fallback to regex-based extraction if no table structure found
 * 3. Merge multi-page criteria with the same N. Preço
 */
export async function parseCriterioPdf(
  file: File,
  onProgress?: (progress: ParseProgress) => void,
): Promise<(Omit<CriterioMedicao, 'id'> & { pageIndex?: number })[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  const criteriosMap = new Map<string, Omit<CriterioMedicao, 'id'> & { pageIndex?: number }>()

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress({ current: i, total: totalPages })

    try {
      const page = await pdf.getPage(i)
      const textItems = await extractTextItems(page)
      const lines = groupIntoLines(textItems)
      const lineStrings = linesToStrings(lines)
      const text = lineStrings.join('\n')

      let parsed: Omit<CriterioMedicao, 'id'> | null = null

      // Strategy 1: Coordinate-based extraction
      const cols = detectTableColumns(lines)
      if (cols) {
        const { nPreco, descricao, unidade, sints } = extractTableData(lines, cols)
        if (nPreco) {
          const { regulamentacao, medicao, notas } = extractSections(text, lineStrings)
          parsed = {
            nPreco,
            descricao: descricao || `Critério ${nPreco}`,
            descricaoSints: sints || undefined,
            unidade,
            regulamentacao,
            medicao,
            notas,
          }
        }
      }

      // Strategy 2: Fallback
      if (!parsed) {
        parsed = parseFallback(text, lineStrings)
      }

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
          if (parsed.descricao && (!existing.descricao || existing.descricao === `Critério ${parsed.nPreco}`)) {
            existing.descricao = parsed.descricao
          }
        } else {
          criteriosMap.set(parsed.nPreco, { ...parsed, pageIndex: i })
        }
      }
    } catch {
      continue
    }
  }

  return Array.from(criteriosMap.values())
}

/**
 * Render a single PDF page to a data URL image (PNG).
 * Used to show the original page alongside extracted data.
 */
export async function renderPdfPageToImage(
  pdfBase64: string,
  pageNumber: number,
  scale = 1.5,
): Promise<string> {
  // Convert data URL to ArrayBuffer
  const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const pdf = await pdfjsLib.getDocument({ data: bytes.buffer }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!

  // pdfjs-dist v5+ requires 'canvas' alongside 'canvasContext'
  await page.render({ canvasContext: ctx, viewport, canvas } as never).promise
  return canvas.toDataURL('image/png')
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
