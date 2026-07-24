/**
 * similarity — heurística de similaridade textual (code-only, sem IA) reusada no
 * Workbench e no CapEx do Predial. Jaccard sobre tokens (sem acentos, sem stopwords).
 */
const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'para', 'por', 'com', 'que', 'os', 'as', 'um', 'uma', 'the', 'and', 'to', 'of', 'in', 'ao', 'se', 'sua', 'seu'])
const DIACRITICS = /[̀-ͯ]/g

export function tokenize(s: string): Set<string> {
  const m = (s || '').toLowerCase().normalize('NFD').replace(DIACRITICS, '').match(/[a-z0-9]{3,}/g) ?? []
  return new Set(m.filter((t) => !STOP.has(t)))
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/** Rankeia itens por similaridade textual com um texto-base. */
export function rankBySimilarity<T>(baseText: string, items: T[], textOf: (t: T) => string, opts?: { min?: number; topN?: number }): { item: T; score: number }[] {
  const base = tokenize(baseText)
  return items
    .map((item) => ({ item, score: jaccard(base, tokenize(textOf(item))) }))
    .filter((x) => x.score > (opts?.min ?? 0.05))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts?.topN ?? 6)
}
