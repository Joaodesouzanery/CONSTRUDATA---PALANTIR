/**
 * engineeringOntology.ts — Engineering term normalization and fuzzy matching
 * for Sabesp construction vocabulary.
 *
 * Provides ontology-aware fuzzy matching that understands common abbreviations
 * and variations used in Sabesp infrastructure projects.
 */

/** Sabesp abbreviation → full term mappings */
const SABESP_ONTOLOGY: Record<string, string[]> = {
  'escavacao mecanica de vala': [
    'esc mec val',
    'esc. mec. val.',
    'escav mecan vala',
    'esc mecanica',
  ],
  'assentamento de tubulacao': [
    'assent tub',
    'assent. tub.',
    'assentamento tubulacao',
    'assent tubulação',
  ],
  'reaterro compactado de vala': [
    'reat comp val',
    'reat. comp.',
    'reaterro compact',
    'reat compactado',
  ],
  'lastro de brita': [
    'lastro brita',
    'lastro pedra britada',
    'lastro de areia e brita',
  ],
  'ligacao domiciliar de agua': [
    'lig dom agua',
    'lig. dom.',
    'ligacao domiciliar',
    'lig domiciliar',
  ],
  'ligacao domiciliar de esgoto': [
    'lig dom esg',
    'lig. dom. esg.',
    'ligacao domiciliar esgoto',
  ],
  'poço de visita': ['pv', 'p.v.', 'poco visita', 'poço de visita tipo'],
  'caixa de inspecao': [
    'ci',
    'c.i.',
    'caixa inspecao',
    'cx inspecao',
  ],
  'teste hidrostatico': [
    'teste hidro',
    'teste hidrost',
    'ensaio hidrostatico',
  ],
  'pavimentacao asfaltica': [
    'pav asf',
    'pavimentacao',
    'capa asfaltica',
    'reposicao asfaltica',
  ],
  'rebaixamento de lencol freatico': [
    'rebaix lencol',
    'rebaixamento lencol',
    'rebaix. lencol freat',
  ],
  'escoramento continuo': ['esc cont', 'escoramento', 'esc. continuo'],
  'escoramento descontinuo': [
    'esc desc',
    'esc. descontinuo',
    'esc descontinuo',
  ],
  'cadastro de rede': ['cad rede', 'cadastro', 'levantamento cadastral'],
  'sinalizacao de obra': ['sinaliz', 'sinalização', 'sinalizacao obra'],
  'mobilizacao e desmobilizacao': [
    'mob desmob',
    'mobilizacao',
    'mob/desmob',
  ],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Compute similarity score between two normalized strings (0-1) using word overlap + containment. */
function similarity(a: string, b: string): number {
  if (a === b) return 1

  // Word-level Jaccard + containment bonus
  const wordsA = new Set(a.split(' '))
  const wordsB = new Set(b.split(' '))
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  const jaccard = intersection / union

  // Containment bonus: if one string fully contains the other
  const containsBonus =
    a.includes(b) || b.includes(a) ? 0.3 : 0

  return Math.min(1, jaccard + containsBonus)
}

/** Normalize an engineering term using the ontology. Returns the canonical form if found. */
export function normalizeEngineering(raw: string): string {
  const norm = normalize(raw)

  for (const [canonical, variants] of Object.entries(SABESP_ONTOLOGY)) {
    for (const variant of variants) {
      const normVariant = normalize(variant)
      if (
        normVariant === norm ||
        norm.includes(normVariant) ||
        normVariant.includes(norm)
      ) {
        return canonical
      }
    }
  }

  return norm
}

/** Find the best match for `input` among `candidates` using ontology-aware fuzzy matching. */
export function fuzzyMatch(
  input: string,
  candidates: string[],
  threshold = 0.4,
): { match: string; score: number; index: number } | null {
  const normInput = normalizeEngineering(input)
  let best: { match: string; score: number; index: number } | null = null

  for (let i = 0; i < candidates.length; i++) {
    const normCandidate = normalizeEngineering(candidates[i])
    const score = similarity(normInput, normCandidate)
    if (score >= threshold && (!best || score > best.score)) {
      best = { match: candidates[i], score, index: i }
    }
  }

  return best
}

/** Suggest corrections for a raw engineering term. */
export function suggestCorrections(
  raw: string,
): { original: string; suggested: string; confidence: number }[] {
  const norm = normalize(raw)
  const suggestions: {
    original: string
    suggested: string
    confidence: number
  }[] = []

  for (const [canonical, variants] of Object.entries(SABESP_ONTOLOGY)) {
    const allTerms = [canonical, ...variants]
    for (const term of allTerms) {
      const score = similarity(norm, normalize(term))
      if (score >= 0.3 && score < 1.0) {
        suggestions.push({
          original: raw,
          suggested: canonical,
          confidence: score,
        })
        break // one suggestion per canonical term
      }
    }
  }

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}

export { SABESP_ONTOLOGY, normalize as normalizeText, similarity }
