/**
 * pdfStructuralExtractor.ts — Generic coordinate-based PDF table extraction.
 * Detects table structure from header positions and extracts rows by column boundaries.
 *
 * Key insight: PDF text items have X coordinates. Items in the same column share
 * similar X values. By detecting where headers are positioned, we know the X
 * boundaries for each column and can extract cell values accordingly.
 */

export interface TextItem {
  x: number
  y: number
  text: string
  width: number
  height: number
}

export interface TableColumn {
  label: string
  xMin: number
  xMax: number
}

export interface TableLayout {
  columns: TableColumn[]
  headerY: number
  dataStartY: number
}

/** Group text items into lines by Y coordinate (within tolerance). */
function groupByY(items: TextItem[], tolerance = 3): Map<number, TextItem[]> {
  const lineMap = new Map<number, TextItem[]>()

  for (const item of items) {
    let assignedY: number | null = null
    for (const existingY of lineMap.keys()) {
      if (Math.abs(existingY - item.y) <= tolerance) {
        assignedY = existingY
        break
      }
    }
    if (assignedY === null) {
      assignedY = item.y
      lineMap.set(assignedY, [])
    }
    lineMap.get(assignedY)!.push(item)
  }

  // Sort items within each line by X
  for (const [, lineItems] of lineMap) {
    lineItems.sort((a, b) => a.x - b.x)
  }

  return lineMap
}

/** Get sorted Y values from a line map (descending — top of page first in PDF coords). */
function sortedYKeys(lineMap: Map<number, TextItem[]>): number[] {
  return Array.from(lineMap.keys()).sort((a, b) => b - a)
}

/** Detect table columns from text items by finding header keywords and their X positions. */
export function detectTableLayout(
  items: TextItem[],
  headerKeywords: string[],
  yTolerance = 3,
): TableLayout | null {
  const lineMap = groupByY(items, yTolerance)
  const yKeys = sortedYKeys(lineMap)

  // Scan the first 15 lines (from top) looking for the header row
  const scanLimit = Math.min(15, yKeys.length)
  let bestHeaderY: number | null = null
  let bestMatches: { keyword: string; x: number; width: number }[] = []

  const normalise = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()

  for (let li = 0; li < scanLimit; li++) {
    const y = yKeys[li]
    const lineItems = lineMap.get(y)!
    const lineText = lineItems.map((i) => normalise(i.text))

    const matches: { keyword: string; x: number; width: number }[] = []
    for (const kw of headerKeywords) {
      const normKw = normalise(kw)
      for (let idx = 0; idx < lineItems.length; idx++) {
        if (lineText[idx].includes(normKw) || normKw.includes(lineText[idx])) {
          matches.push({
            keyword: kw,
            x: lineItems[idx].x,
            width: lineItems[idx].width,
          })
          break
        }
      }
    }

    if (matches.length > bestMatches.length) {
      bestMatches = matches
      bestHeaderY = y
    }
  }

  if (!bestHeaderY || bestMatches.length < 2) {
    return null
  }

  // Sort matched columns by X position
  bestMatches.sort((a, b) => a.x - b.x)

  // Determine page width from the rightmost item
  const pageMaxX = Math.max(...items.map((i) => i.x + i.width), 600)

  // Build columns — each column goes from its X to the next column's X
  const columns: TableColumn[] = bestMatches.map((m, idx) => {
    const xMin = m.x
    const xMax =
      idx < bestMatches.length - 1 ? bestMatches[idx + 1].x : pageMaxX
    return { label: m.keyword, xMin, xMax }
  })

  // dataStartY = the next line after the header
  const headerIdx = yKeys.indexOf(bestHeaderY)
  const dataStartY =
    headerIdx < yKeys.length - 1 ? yKeys[headerIdx + 1] : bestHeaderY - 20

  return { columns, headerY: bestHeaderY, dataStartY }
}

/** Extract text from items that fall within a column's X boundaries on a given line. */
export function extractCellText(
  lineItems: TextItem[],
  col: TableColumn,
): string {
  return lineItems
    .filter((i) => i.x >= col.xMin && i.x < col.xMax)
    .map((i) => i.text)
    .join(' ')
    .trim()
}

/** Extract all data rows from a page's text items using the detected layout. */
export function extractTableRows(
  items: TextItem[],
  layout: TableLayout,
  yTolerance = 3,
  stopKeywords = ['TOTAL', 'SUBTOTAL'],
): Record<string, string>[] {
  const lineMap = groupByY(items, yTolerance)
  const yKeys = sortedYKeys(lineMap)
  const rows: Record<string, string>[] = []

  const normaliseStop = (s: string) => s.toUpperCase().trim()

  for (const y of yKeys) {
    // In PDF coordinates Y decreases downward, so data rows have Y < dataStartY
    if (y >= layout.dataStartY) continue

    const lineItems = lineMap.get(y)!

    // Check for stop keywords
    const lineText = lineItems.map((i) => i.text).join(' ')
    const shouldStop = stopKeywords.some((sk) =>
      normaliseStop(lineText).includes(normaliseStop(sk)),
    )
    if (shouldStop) break

    // Extract cell for each column
    const row: Record<string, string> = {}
    let hasContent = false
    for (const col of layout.columns) {
      const cellText = extractCellText(lineItems, col)
      row[col.label] = cellText
      if (cellText.length > 0) hasContent = true
    }

    if (hasContent) {
      rows.push(row)
    }
  }

  return rows
}
