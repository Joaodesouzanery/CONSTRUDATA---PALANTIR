/**
 * parseMedicaoPdf.ts — PDF parsing utility for Medição documents.
 * Extracts tabular measurement data from PDF files using pdfjs-dist.
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { MedicaoItem } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(s: string): number {
  const cleaned = s.replace(/\./g, '').replace(',', '.')
  const v = parseFloat(cleaned)
  return isNaN(v) ? 0 : v
}

/**
 * Parse a Medição PDF file and extract measurement items.
 * Looks for tabular rows with quantities, units, and prices.
 */
export async function parseMedicaoPdf(file: File): Promise<Omit<MedicaoItem, 'id'>[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageStr = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(pageStr)
  }

  const fullText = pageTexts.join('\n')
  const lines = fullText.split('\n')

  const items: Omit<MedicaoItem, 'id'>[] = []
  const seen = new Set<string>()

  // Pattern: item code, description, unit, numbers (qtdContratada, qtdMedida, qtdAcumulada, PU, valor)
  // Typical row: "1.1  Escavação mecanizada de vala  m³  500,00  120,00  350,00  45,80  5.496,00"
  const rowRegex =
    /(\d+(?:\.\d+)*)\s+(?:(\d{4,8})\s+)?(.{5,80}?)\s+(m²|m³|m\b|kg|ton|un|vb|cj|l\b|pç|gl|cx)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/gi

  for (const line of lines) {
    let match: RegExpExecArray | null
    rowRegex.lastIndex = 0

    while ((match = rowRegex.exec(line)) !== null) {
      const itemCode = match[1]
      const nPreco = match[2] || undefined  // optional N. Preço code
      const descricao = match[3].replace(/\s+/g, ' ').trim()
      const unidade = match[4].toLowerCase()
      const qtdContratada = parseNumber(match[5])
      const qtdMedida = parseNumber(match[6])
      const qtdAcumulada = parseNumber(match[7])
      const precoUnitario = parseNumber(match[8])
      const valorMedido = parseNumber(match[9])

      const key = normalize(descricao).split(/\s+/).slice(0, 4).join(' ')
      if (seen.has(key)) continue
      seen.add(key)

      if (!descricao || qtdMedida <= 0) continue

      items.push({
        item: itemCode,
        descricao,
        nPreco,
        unidade,
        qtdContratada,
        qtdMedida,
        qtdAcumulada,
        precoUnitario,
        valorMedido: valorMedido > 0 ? valorMedido : parseFloat((qtdMedida * precoUnitario).toFixed(2)),
      })
    }
  }

  // Fallback: simpler pattern for less structured PDFs
  if (items.length === 0) {
    const simpleRegex =
      /(.{5,60}?)\s+(m²|m³|m\b|kg|ton|un|vb|cj|l\b|pç|gl)\s+([\d.,]+)\s+([\d.,]+)/gi

    for (const line of lines) {
      simpleRegex.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = simpleRegex.exec(line)) !== null) {
        const descricao = match[1].replace(/\s+/g, ' ').replace(/^[^a-zA-ZÀ-ú]+/, '').trim()
        const unidade = match[2].toLowerCase()
        const qtdMedida = parseNumber(match[3])
        const precoUnitario = parseNumber(match[4])

        if (!descricao || qtdMedida <= 0) continue

        const key = normalize(descricao).split(/\s+/).slice(0, 4).join(' ')
        if (seen.has(key)) continue
        seen.add(key)

        items.push({
          item: '—',
          descricao,
          unidade,
          qtdContratada: 0,
          qtdMedida,
          qtdAcumulada: 0,
          precoUnitario,
          valorMedido: parseFloat((qtdMedida * precoUnitario).toFixed(2)),
        })
      }
    }
  }

  return items
}
