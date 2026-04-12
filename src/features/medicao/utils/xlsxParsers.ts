/**
 * xlsxParsers.ts — XLSX/CSV import helpers for Módulo de Medição.
 *
 * Uses the `xlsx` library (already in dependencies).
 * Each parser returns { data, errors } for preview-before-commit flow.
 */
import * as XLSX from 'xlsx'
import type { ItemContrato, SubempreteiroItem, Fornecedor } from '@/store/medicaoBillingStore'
import { getAllCriterios } from '../data/criterios'

// ─── Generic helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>

/** Reads all rows from the first worksheet of a WorkBook. */
function getRows(wb: XLSX.WorkBook): Row[] {
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
}

/** Normalise a header key: lower case, no accents, trim. */
function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

/**
 * Finds the first column whose normalised header matches any of the given
 * keywords (substring match).
 */
function findCol(row: Row, keywords: string[]): string | undefined {
  return Object.keys(row).find((k) => keywords.some((kw) => norm(k).includes(kw)))
}

/**
 * Converts a value to a number, handling both Brazilian (1.234,56)
 * and English (1234.56) decimal formats, as well as R$ currency strings.
 *
 * Robust cleaning: strips "R$", currency symbols, spaces, and non-numeric
 * characters (except .,- for decimal/negative). Handles Sabesp PDF formats
 * where values may contain embedded formatting.
 */
function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim()
  // Remove currency symbols (R$, $), parentheses, spaces, and stray chars
  const clean = s
    .replace(/R\$\s?/g, '')
    .replace(/\$/g, '')
    .replace(/[()]/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!clean || clean === '-' || clean === ',' || clean === '.') return 0
  // Brazilian format: both . and , present — . is thousands separator, , is decimal
  if (clean.includes(',') && clean.includes('.')) {
    const lastDot   = clean.lastIndexOf('.')
    const lastComma = clean.lastIndexOf(',')
    if (lastComma > lastDot) {
      // pt-BR: 1.234,56 → remove dots, replace comma
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
    } else {
      // en: 1,234.56 → remove commas
      return parseFloat(clean.replace(/,/g, '')) || 0
    }
  }
  // Only comma — decimal separator (Brazilian without thousands)
  if (clean.includes(',') && !clean.includes('.')) {
    return parseFloat(clean.replace(',', '.')) || 0
  }
  return parseFloat(clean) || 0
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** Read a WorkBook from a File object. */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

// ─── Sabesp planilha parser ───────────────────────────────────────────────────

export interface SabespParseResult {
  itens:    Omit<ItemContrato, 'id'>[]
  errors:   string[]
  warnings: string[]
}

/**
 * Parses a Sabesp measurement spreadsheet.
 *
 * Handles both simple and merged-cell Sabesp formats.
 * Scans cells directly (not just row strings) to find the data header,
 * since merged cells may appear empty in sheet_to_json output.
 *
 * Typical Sabesp column layout after the header:
 *   Item | Descrição | N. Preço | Unid. | Quant.(contrato) | P. Unit. | [period cols...]
 *
 * Grupo detected from Item code prefix: "01" → Canteiros, "02" → Esgoto, "03" → Água.
 */
export function parseSabespSheet(wb: XLSX.WorkBook): SabespParseResult {
  const itens: Omit<ItemContrato, 'id'>[] = []
  const errors: string[] = []
  const warnings: string[] = []

  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    errors.push('Planilha vazia.')
    return { itens, errors, warnings }
  }

  const ws = wb.Sheets[sheetName]

  // ── Read as 2D array (raw: false for formatted strings) ───────────────────
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]

  if (raw.length === 0) {
    errors.push('Planilha vazia ou sem dados reconhecíveis.')
    return { itens, errors, warnings }
  }

  // ── Build a flat cell map from raw address access for merged-cell detection ─
  // XLSX represents merged cells: the anchor cell has the value, others are empty.
  // We scan all cells in first 30 rows to find "N. Preço" anywhere.
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
  const cellValues: Map<string, string> = new Map()
  if (range) {
    for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (cell && cell.v != null) {
          cellValues.set(addr, toStr(cell.v))
        }
      }
    }
  }

  // ── Find header row ────────────────────────────────────────────────────────
  // Strategy 1: find a cell containing "n. preço" / "npreço" / "n preço" / "n°preço"
  // in the first 30 rows (handles merged headers).
  let headerRowIdx = -1

  // Check 2D array rows first (works for most files)
  for (let i = 0; i < Math.min(raw.length, 30); i++) {
    const cells = raw[i].map(toStr)
    const rowStr = cells.join('|')
    if (
      /n[\s.°º]*pre/i.test(rowStr) ||
      /n[º°]?\s*pre/i.test(rowStr) ||
      (/^item$/i.test(cells[0] ?? '') && /descri/i.test(cells[1] ?? ''))
    ) {
      headerRowIdx = i
      break
    }
  }

  // Strategy 2: scan individual cells (catches merged-cell headers)
  if (headerRowIdx === -1 && range) {
    outer: for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const val = cellValues.get(XLSX.utils.encode_cell({ r, c })) ?? ''
        if (/n[\s.°º]*pre/i.test(val) || /n[º°]\s*pre/i.test(val)) {
          headerRowIdx = r
          break outer
        }
      }
    }
  }

  // Strategy 3: find first row where col 2 is a pure numeric string → data starts there
  // (no header detected, use pure positional)
  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const col2 = toStr(raw[i][2])
      if (/^\d{4,}$/.test(col2.replace(/\s/g, ''))) {
        headerRowIdx = i - 1  // treat row before as header
        break
      }
    }
  }

  // ── Determine column indices ───────────────────────────────────────────────
  let iItem = 0, iDescr = 1, iNPreco = 2, iUnid = 3, iQtdContr = 4, iPUnit = 5
  let iQtdMedida = -1
  let iQtdAnterior = -1

  if (headerRowIdx >= 0 && headerRowIdx < raw.length) {
    const headers = raw[headerRowIdx].map(toStr)
    headers.forEach((h, idx) => {
      const n = norm(h)
      if (/^item$/.test(n)) iItem = idx
      else if (/descri|servico/.test(n) && idx <= 3) iDescr = idx
      else if (/n[\s.]?pre|n[º°]pre|numero.*pre/.test(n)) iNPreco = idx
      else if (/^un(id)?$/.test(n) || n === 'un') iUnid = idx
      else if (/^(quant|qtd|quantidade)$/.test(n) && idx <= 6 && iQtdContr === 4) iQtdContr = idx
      else if (/p[\s.]?\s*unit|prec.*unit|vl.*unit|valor.*unit/.test(n) && idx <= 7) iPUnit = idx
      else if (/anterior/.test(n)) iQtdAnterior = idx
      else if (/acum|acumulad/.test(n) && iQtdAnterior === -1) iQtdAnterior = idx
    })
    // Look for period measurement Quant. column after P.Unit
    for (let ci = iPUnit + 1; ci < headers.length; ci++) {
      const hn = norm(headers[ci])
      if (/quant|qtd/.test(hn)) {
        iQtdMedida = ci
        break
      }
    }
    // Also scan the row ABOVE headerRowIdx for period labels like "MED. 08"
    // (the quant column is often under a merged "MED.XX" header)
    if (iQtdMedida === -1 && headerRowIdx > 0) {
      const above = raw[headerRowIdx - 1].map(toStr)
      for (let ci = iPUnit + 1; ci < above.length; ci++) {
        if (/med/i.test(above[ci])) {
          // Found measurement period column block — quant is first sub-column
          iQtdMedida = ci
          break
        }
      }
    }
  }

  // ── Parse data rows ────────────────────────────────────────────────────────
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0
  let currentGrupo: '01' | '02' | '03' = '02'

  for (let i = startRow; i < raw.length; i++) {
    const row = raw[i]
    // Skip rows that are completely empty or contain only whitespace
    if (!row || row.every((cell) => !toStr(cell))) continue

    const item    = toStr(row[iItem])
    const nPreco  = toStr(row[iNPreco])
    const descricao = toStr(row[iDescr])

    // Skip completely empty rows (Item, NPreco, and Descricao all empty)
    if (!item && !nPreco && !descricao) continue

    // Skip CRITÉRIO lines (measurement criteria text, not data rows)
    const rowJoined = [item, nPreco, descricao].join(' ')
    if (/crit[eé]rio/i.test(rowJoined) && !/^\d{4,}$/.test(nPreco.replace(/\s/g, ''))) continue

    // Skip "Total do Grupo", "Total da Frente", "Total da Planilha" summary rows
    if (/total\s*(do|da|geral)/i.test(rowJoined)) continue

    // Detect grupo from Item code prefix
    // Handle both 7-digit (CSV: 1010101) and 8-digit (PDF: 01010101) formats
    const cleanItem = item.replace(/\D/g, '')
    // Normalize to 8 digits by padding with leading zero if 7 digits
    const normalizedItem = cleanItem.length === 7 ? '0' + cleanItem : cleanItem
    const grupoPfx = normalizedItem.slice(0, 2)
    if (grupoPfx === '01') currentGrupo = '01'
    else if (grupoPfx === '02') currentGrupo = '02'
    else if (grupoPfx === '03') currentGrupo = '03'
    else {
      // Heuristic from description
      const rowStr = [item, descricao].join(' ').toLowerCase()
      if (/canteiro|plano de gestao|pcmat|pcmso/.test(rowStr)) currentGrupo = '01'
      else if (/esgoto|esgotamento|coleta|rede coletora/.test(rowStr)) currentGrupo = '02'
      else if (/agua|abastecimento|adutora|rede de distribui/.test(rowStr)) currentGrupo = '03'
    }

    // Try to extract N. Preço from description if the NPreço column is empty
    // (handles PDF format where "MANUTENÇÃO DO CANTEIRO 500101" has code embedded)
    let nPrecoClean = nPreco.replace(/\s/g, '')
    let cleanDescricao = descricao

    if (!nPrecoClean || !/^\d{3,}$/.test(nPrecoClean)) {
      // Try to extract numeric code from end of description (3-6 digits)
      const codeMatch = descricao.match(/\b(\d{3,6})\s*$/)
      if (codeMatch) {
        nPrecoClean = codeMatch[1]
        cleanDescricao = descricao.replace(/\s*\d{3,6}\s*$/, '').trim()
      }
    }

    // Check if row has numeric data (quantity or unit price) — accept items
    // even without standard N. Preço (e.g., "TRANSPORTE DE RESIDUOS" with short codes)
    const hasNumericData = toNum(row[iQtdContr]) > 0 || toNum(row[iPUnit]) > 0

    // If no N. Preço and no numeric data, it's a group header — skip
    if ((!nPrecoClean || !/^\d+$/.test(nPrecoClean)) && !hasNumericData) continue

    // Generate temporary ID for items without standard N. Preço
    if (!nPrecoClean || !/^\d+$/.test(nPrecoClean)) {
      if (hasNumericData && cleanDescricao) {
        // Accept the item with a generated code: "EXT-" + row index
        nPrecoClean = `EXT${String(i).padStart(4, '0')}`
      } else {
        continue
      }
    }

    // Skip rows that look like repeated column headers
    if (norm(nPrecoClean).includes('preco') || norm(nPrecoClean).includes('n preco')) continue

    // Validate unit exists
    const unidadeRaw = toStr(row[iUnid])
    const unidade = unidadeRaw || 'M'

    const qtdContrato   = toNum(row[iQtdContr])
    const valorUnitario = toNum(row[iPUnit])
    const qtdMedida     = iQtdMedida >= 0 ? toNum(row[iQtdMedida]) : 0
    const qtdAnterior   = iQtdAnterior >= 0 ? toNum(row[iQtdAnterior]) : 0

    if (!cleanDescricao && !nPrecoClean) continue

    itens.push({
      itemEAP:      normalizedItem || item,
      nPreco:       nPrecoClean,
      descricao:    cleanDescricao || '—',
      unidade,
      grupo:        nPrecoClean.startsWith('EXT') ? 'EX' : currentGrupo,
      qtdContrato,
      qtdAnterior,
      qtdMedida,
      valorUnitario,
    })
  }

  if (itens.length === 0) {
    errors.push(
      'Nenhum item de contrato foi encontrado. ' +
      'Verifique se a planilha é a Planilha de Medição Sabesp com colunas: Item | Descrição | N. Preço | Unid. | Quant. | P. Unit.'
    )
  }

  // ── Rounding validation (Regra dos Centavos) ──────────────────────────────
  // Check if calculated totals match expected values within ±R$0.01 tolerance
  for (const it of itens) {
    if (it.qtdMedida > 0 && it.valorUnitario > 0) {
      const computed = it.qtdMedida * it.valorUnitario
      // Round to 2 decimals (Sabesp standard)
      const rounded = Math.round(computed * 100) / 100
      if (Math.abs(computed - rounded) > 0.005) {
        warnings.push(
          `Arredondamento: item ${it.nPreco} — valor calculado R$ ${computed.toFixed(4)} será arredondado para R$ ${rounded.toFixed(2)}`
        )
      }
    }
  }

  // Validate N. Preço against criteria catalog
  const catalogo = getAllCriterios()
  const catalogoSet = new Set(catalogo.map(c => c.nPreco))
  const naoEncontrados = itens.filter(it => !it.nPreco.startsWith('EXT') && !catalogoSet.has(it.nPreco))
  if (naoEncontrados.length > 0 && naoEncontrados.length <= 10) {
    warnings.push(
      `${naoEncontrados.length} N. Preço não encontrado(s) no catálogo de critérios: ${naoEncontrados.map(it => it.nPreco).join(', ')}. ` +
      'Verifique se os códigos estão corretos ou adicione os critérios manualmente.'
    )
  }

  // Validate overrun: items where accumulated > contract
  const estourados = itens.filter(it => (it.qtdAnterior + it.qtdMedida) > it.qtdContrato && it.qtdContrato > 0)
  if (estourados.length > 0) {
    warnings.push(
      `${estourados.length} item(ns) com medição superior ao contrato (requer Aditivo): ${estourados.map(it => `${it.nPreco} (${((it.qtdAnterior + it.qtdMedida) / it.qtdContrato * 100).toFixed(0)}%)`).join(', ')}`
    )
  }

  // Check for duplicate N. Preço entries (skip generated EXT codes)
  const seen = new Set<string>()
  for (const it of itens) {
    if (it.nPreco.startsWith('EXT')) continue
    if (seen.has(it.nPreco)) {
      warnings.push(`N. Preço duplicado: ${it.nPreco} aparece mais de uma vez na planilha.`)
    }
    seen.add(it.nPreco)
  }

  // ── Cross-check: compare imported total vs "Total da Planilha" row ────────
  // Scan raw data for a row containing "Total da Planilha" and extract its value
  for (let i = startRow; i < raw.length; i++) {
    const cells = raw[i]?.map(toStr) ?? []
    const rowText = cells.join(' ')
    if (/total\s*(da\s*)?planilha/i.test(rowText)) {
      // Find the first large numeric value in this row (the total)
      for (const cell of cells) {
        const val = toNum(cell)
        if (val > 1000) {
          // Compare with sum of all imported items (qtdContrato * valorUnitario)
          const importedTotal = itens.reduce((s, it) => s + it.qtdContrato * it.valorUnitario, 0)
          const diff = Math.abs(val - importedTotal)
          if (diff > 1) {
            warnings.push(
              `Alerta de consistência: Total da Planilha no arquivo é R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` +
              `, mas a soma dos itens importados é R$ ${importedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` +
              ` (diferença: R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Verifique se todos os itens foram importados.`
            )
          }
          break
        }
      }
      break
    }
  }

  // Flag items with generated IDs (no standard N. Preço)
  const extItems = itens.filter(it => it.nPreco.startsWith('EXT'))
  if (extItems.length > 0) {
    warnings.push(
      `${extItems.length} item(ns) importado(s) sem código N. Preço padrão: ${extItems.map(it => it.descricao).join(', ')}. ` +
      'Códigos temporários (EXT) foram gerados. Edite manualmente se necessário.'
    )
  }

  return { itens, errors, warnings }
}

// ─── Subempreiteiro sheet parser ──────────────────────────────────────────────

export interface SubempreiteiroParseResult {
  nome:     string
  nucleo:   string
  periodo:  string
  itens:    SubempreteiroItem[]
  totals:   { totalMedido: number; totalAprovado: number; retencao: number }
  errors:   string[]
}

/**
 * Parses a subcontractor measurement sheet (e.g., VIALTA medição).
 *
 * Strategy:
 * 1. Extract company metadata from the first ~10 rows (name, period, nucleo)
 * 2. Find the data header row by scanning for rows with "descri" or "quant" or "unit"
 * 3. Parse items below the header
 * 4. Auto-compute totals if not present in the sheet
 *
 * Handles multiple sheets by returning the combined result.
 */
export function parseSubempreiteiroSheet(wb: XLSX.WorkBook): SubempreiteiroParseResult {
  const result: SubempreiteiroParseResult = {
    nome:   wb.SheetNames[0] ?? 'Subempreiteiro',
    nucleo: '',
    periodo: '',
    itens:  [],
    totals: { totalMedido: 0, totalAprovado: 0, retencao: 0 },
    errors: [],
  }

  // Try all sheets, use first that has items
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]
    if (raw.length === 0) continue

    // ── Extract metadata from first 12 rows ──────────────────────────────────
    for (let i = 0; i < Math.min(raw.length, 12); i++) {
      const cells = raw[i].map(toStr).filter(Boolean)
      if (cells.length === 0) continue
      const rowStr = cells.join(' ')

      // Period: look for month/year patterns like "fev/26", "FEVEREIRO/2026", "MED. 08", "02/2026"
      if (!result.periodo) {
        const periodMatch = rowStr.match(
          /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[\s/.-]*(\d{2,4})/i
        ) || rowStr.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/)
          || rowStr.match(/\bmed[\s.]*(\d+)\b/i)
        if (periodMatch) result.periodo = periodMatch[0].trim()
      }

      // Nucleo: look for city/region names or "nucleo" keyword
      if (!result.nucleo) {
        const nuMatch = rowStr.match(/n[uú]cleo[:\s]+([A-Za-zÀ-ÿ\s]+)/i)
        if (nuMatch) result.nucleo = nuMatch[1].trim().split(/\s+/).slice(0, 2).join(' ')
      }

      // Company name: first non-empty row that looks like a company/header (not all numbers)
      if (result.nome === wb.SheetNames[0] && cells.length >= 1 && !/^\d/.test(cells[0])) {
        // A likely title row: non-numeric first cell, row has few items (not a data row)
        if (cells.length <= 4 && cells[0].length > 3) {
          result.nome = cells[0]
        }
      }
    }

    // ── Find header row ────────────────────────────────────────────────────────
    let headerIdx = -1
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
      const rowStr = raw[i].map(toStr).join(' ').toLowerCase()
      if (
        (rowStr.includes('descri') || rowStr.includes('servico') || rowStr.includes('especif')) &&
        (rowStr.includes('unit') || rowStr.includes('qtd') || rowStr.includes('quant') || rowStr.includes('valor'))
      ) {
        headerIdx = i
        break
      }
      // Also match rows with "n. preço" or "item" as first column signal
      if (/n[\s.]?pre/i.test(rowStr) && /descri/i.test(rowStr)) {
        headerIdx = i
        break
      }
    }

    // ── Parse using detected header ────────────────────────────────────────────
    if (headerIdx >= 0) {
      const headers = raw[headerIdx].map(toStr)
      const idx = (matchers: RegExp[]): number =>
        headers.findIndex((h) => matchers.some((re) => re.test(norm(h))))

      const idxNPreco   = idx([/n[\s.]?pre/, /^item$/, /^cod/])
      const idxDesc     = idx([/descri/, /servico/, /especif/])
      const idxUn       = idx([/^un(id)?$/, /^und$/, /^medida$/])
      const idxQtd      = idx([/^qtd/, /^quant/, /quantidade/])
      const idxVlUnit   = idx([/vl.*unit/, /valor.*unit/, /prec.*unit/, /p[\s.]?unit/])
      const idxTotal    = idx([/^total$/, /vl.*total/, /valor.*total/])
      const idxAprovado = idx([/aprovado/])
      const idxRetencao = idx([/retenc/, /reten/])

      const sheetItens: SubempreteiroItem[] = []

      for (let i = headerIdx + 1; i < raw.length; i++) {
        const cells = raw[i]
        const rowStr = cells.map(toStr).join(' ').toLowerCase()

        // Detect totals rows
        if (/total\s*(medido|aprovado|geral)?/.test(rowStr)) {
          if (idxTotal >= 0) {
            const tv = toNum(cells[idxTotal])
            if (tv > 0) result.totals.totalMedido = tv
          }
          if (idxAprovado >= 0) {
            const av = toNum(cells[idxAprovado])
            if (av > 0) result.totals.totalAprovado = av
          }
          if (idxRetencao >= 0) {
            const rv = toNum(cells[idxRetencao])
            if (rv > 0) result.totals.retencao = rv
          }
          continue
        }

        const nPreco    = idxNPreco  >= 0 ? toStr(cells[idxNPreco])  : ''
        const descricao = idxDesc    >= 0 ? toStr(cells[idxDesc])    : ''
        const unidade   = idxUn      >= 0 ? toStr(cells[idxUn]) || 'M' : 'M'
        const qtd       = idxQtd     >= 0 ? toNum(cells[idxQtd])    : 0
        const vlUnit    = idxVlUnit  >= 0 ? toNum(cells[idxVlUnit])  : 0

        if (!descricao && !nPreco) continue
        // Skip rows that are sub-headers or summary rows
        if (norm(descricao).includes('descri') || norm(descricao).includes('total')) continue

        sheetItens.push({ nPreco, nPrecoSabesp: '', descricao, unidade, qtd, valorUnitario: vlUnit })
      }

      if (sheetItens.length > 0) {
        result.itens = sheetItens
        break  // Found a valid sheet with items
      }
    } else {
      // Fallback: use sheet_to_json with auto headers
      const rows = getRows(wb)
      if (rows.length > 0) {
        const sample = rows[0] ?? {}
        const colNPreco = findCol(sample, ['n preco', 'npreco', 'item', 'codigo', 'cod'])
        const colDesc   = findCol(sample, ['descricao', 'descr', 'servico', 'especificacao'])
        const colUn     = findCol(sample, ['un', 'unidade', 'und'])
        const colQtd    = findCol(sample, ['qtd', 'quantidade', 'quant', 'qtde'])
        const colVlUnit = findCol(sample, ['vl unit', 'valor unit', 'preco unit', 'p unit'])

        for (const row of rows) {
          const nPreco = colNPreco ? toStr(row[colNPreco]) : ''
          const descricao = colDesc ? toStr(row[colDesc]) : ''
          if (!nPreco && !descricao) continue
          result.itens.push({
            nPreco,
            nPrecoSabesp: '',
            descricao,
            unidade: colUn ? toStr(row[colUn]) || 'M' : 'M',
            qtd: colQtd ? toNum(row[colQtd]) : 0,
            valorUnitario: colVlUnit ? toNum(row[colVlUnit]) : 0,
          })
        }
        if (result.itens.length > 0) break
      }
    }
  }

  // ── Auto-compute totals if not found in sheet ──────────────────────────────
  if (result.totals.totalMedido === 0 && result.itens.length > 0) {
    result.totals.totalMedido = result.itens.reduce((s, it) => s + it.qtd * it.valorUnitario, 0)
  }
  if (result.totals.totalAprovado === 0) {
    result.totals.totalAprovado = result.totals.totalMedido
  }

  if (result.itens.length === 0) {
    result.errors.push(
      'Nenhum item de medição encontrado. ' +
      'Verifique se a planilha possui colunas como: Nº Preço | Descrição | Un | Qtd | Vl. Unit.'
    )
  }

  return result
}

// ─── Fornecedor sheet parser ──────────────────────────────────────────────────

export interface FornecedorParseResult {
  list:   Omit<Fornecedor, 'id'>[]
  errors: string[]
}

/**
 * Parses a suppliers spreadsheet.
 *
 * Handles two formats:
 * A) Multi-supplier table: Nome | Período | Descrição | Valor Aprovado (one row per supplier)
 * B) Single-supplier sheet: Metadata in first rows, total value somewhere in the sheet
 *
 * For format B, scans for a "TOTAL" labeled row to find the approved amount.
 */
export function parseFornecedorSheet(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const rows   = getRows(wb)
  const result: FornecedorParseResult = { list: [], errors: [] }

  if (rows.length === 0) {
    result.errors.push('Planilha vazia.')
    return result
  }

  const sample = rows[0]
  const colNome    = findCol(sample, ['nome', 'empresa', 'fornecedor', 'razao'])
  const colPeriodo = findCol(sample, ['periodo', 'mes', 'competencia', 'referencia'])
  const colDesc    = findCol(sample, ['descricao', 'descr', 'servico', 'objeto'])
  const colValor   = findCol(sample, ['valor', 'aprovado', 'total', 'vl aprovado'])

  if (!colNome && !colValor) {
    // ── Format B: single-supplier sheet ────────────────────────────────────
    const sheetName = wb.SheetNames[0] ?? 'Fornecedor'
    const raw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false }) as unknown[][]

    let nome      = sheetName
    let valor     = 0
    let periodo   = defaultPeriodo
    let descricao = ''

    for (let i = 0; i < raw.length; i++) {
      const cells = raw[i].map(toStr)
      const rowStr = cells.join(' ')

      // Extract nome from first non-empty rows that look like a title
      if (nome === sheetName && cells.some((c) => c.length > 3 && !/^\d/.test(c))) {
        const candidate = cells.find((c) => c.length > 3 && !/^\d/.test(c))
        if (candidate) nome = candidate
      }

      // Extract period
      if (!periodo || periodo === defaultPeriodo) {
        const pMatch = rowStr.match(
          /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[\s/.-]*(\d{2,4})/i
        ) || rowStr.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/)
        if (pMatch) periodo = pMatch[0].trim()
      }

      // Look for "TOTAL" labeled rows — the value in the adjacent cell is the approved amount
      const totalIdx = cells.findIndex((c) => /^total/i.test(c.trim()))
      if (totalIdx >= 0) {
        // Check cells to the right of "total"
        for (let j = totalIdx + 1; j < cells.length; j++) {
          const v = toNum(cells[j])
          if (v > 0) { valor = v; break }
        }
        // Also the same cell if it contains the value after a colon/space
        if (valor === 0) {
          const sameCell = cells[totalIdx]
          const m = sameCell.match(/[\d.,]+$/)
          if (m) { const v = toNum(m[0]); if (v > 0) valor = v }
        }
      }

      // Accumulate description from informative rows (skip numeric-only rows)
      if (descricao.length < 300 && rowStr.length > 5 && !/^[\d.,\s]+$/.test(rowStr)) {
        descricao += (descricao ? ' ' : '') + rowStr.substring(0, 100)
      }
    }

    // If still no total found, use the largest monetary value in the sheet
    if (valor === 0) {
      for (const row of raw) {
        for (const cell of row) {
          const v = toNum(cell)
          if (v > valor) valor = v
        }
      }
    }

    result.list.push({ nome, periodo, descricao: descricao.trim().substring(0, 500), valorAprovado: valor })
    return result
  }

  // ── Format A: multi-supplier table ──────────────────────────────────────────
  for (const row of rows) {
    const nome = colNome ? toStr(row[colNome]) : ''
    if (!nome) continue
    result.list.push({
      nome,
      periodo:       colPeriodo ? toStr(row[colPeriodo]) || defaultPeriodo : defaultPeriodo,
      descricao:     colDesc    ? toStr(row[colDesc])    : '',
      valorAprovado: colValor   ? toNum(row[colValor])   : 0,
    })
  }

  if (result.list.length === 0) {
    result.errors.push('Nenhum fornecedor encontrado na planilha.')
  }

  return result
}
