/**
 * pdfWorkerBridge.ts — Non-blocking PDF processing bridge.
 * Processes PDF pages in chunks, yielding to the main thread between chunks
 * to prevent UI blocking on large documents (200+ pages).
 *
 * Since pdfjs-dist already uses its own internal web worker for parsing,
 * we cannot move it into a custom worker. Instead we use chunked processing
 * with requestIdleCallback / setTimeout(0) to yield between page batches.
 */

interface ProgressCallback {
  (progress: { current: number; total: number }): void
}

/**
 * Process a large PDF file without blocking the UI.
 * Uses chunked processing with idle callbacks to yield between page batches.
 * @param file The PDF file to process
 * @param pageProcessor Function that processes a single page and returns parsed data
 * @param onProgress Optional progress callback
 * @param chunkSize Number of pages to process before yielding (default 5)
 */
export async function processLargePdf<T>(
  file: File,
  pageProcessor: (
    page: unknown,
    pageNum: number,
    text: string,
    lines: string[],
  ) => T | null,
  onProgress?: ProgressCallback,
  chunkSize = 5,
): Promise<T[]> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = (
    workerUrl as { default: string }
  ).default

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages
  const results: T[] = []

  for (let start = 1; start <= totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, totalPages)

    // Process chunk of pages
    for (let i = start; i <= end; i++) {
      try {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()

        // Extract lines with Y-grouping
        const lineMap = new Map<number, { x: number; text: string }[]>()
        for (const item of content.items) {
          if (!('str' in item) || !(item as { str: string }).str.trim())
            continue
          const transform = 'transform' in item
            ? (item as { transform: number[] }).transform
            : null
          const y = Math.round((transform ? transform[5] : 0) / 3) * 3
          const x = transform ? transform[4] : 0
          if (!lineMap.has(y)) lineMap.set(y, [])
          lineMap.get(y)!.push({ x, text: (item as { str: string }).str })
        }

        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
        const lines = sortedYs
          .map((y) =>
            lineMap
              .get(y)!
              .sort((a, b) => a.x - b.x)
              .map((it) => it.text)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim(),
          )
          .filter((l) => l.length > 0)

        const text = lines.join('\n')
        const result = pageProcessor(page, i, text, lines)
        if (result) results.push(result)

        if (onProgress) onProgress({ current: i, total: totalPages })
      } catch {
        // Skip pages that fail to parse
        continue
      }
    }

    // Yield to main thread between chunks to avoid blocking UI
    if (end < totalPages) {
      await new Promise<void>((resolve) => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve())
        } else {
          setTimeout(resolve, 0)
        }
      })
    }
  }

  return results
}
