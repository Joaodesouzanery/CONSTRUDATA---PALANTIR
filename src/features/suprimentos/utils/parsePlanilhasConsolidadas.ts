/**
 * parsePlanilhasConsolidadas.ts — Parsers for the 3 Planilhas Consolidadas sheet types:
 *   1. Resumo por Núcleo
 *   2. Consolidado Trechos
 *   3. Materiais Pendentes
 *
 * Each parser reads an XLSX WorkBook and returns typed arrays matching the store types.
 */
import * as XLSX from 'xlsx'
import type { ResumoNucleo, ConsolidadoTrecho, MaterialItem, MaterialRua, MaterialNucleo } from '@/data/mockPlanilhasConsolidadas'

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim().replace(/R\$\s?/g, '').replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    return parseFloat(s.replace(/,/g, '')) || 0
  }
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.')) || 0
  return parseFloat(s) || 0
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

/** Read a WorkBook from a File. */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

/** Get all rows from the first (or named) sheet as key-value objects. */
function getRows(wb: XLSX.WorkBook, sheetIndex = 0): Record<string, unknown>[] {
  const sheetName = wb.SheetNames[sheetIndex]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
}

/** Get headers from first sheet. */
function getHeaders(wb: XLSX.WorkBook, sheetIndex = 0): string[] {
  const sheetName = wb.SheetNames[sheetIndex]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
  if (rows.length === 0) return []
  return Object.keys(rows[0])
}

/** Find the header that best matches one of the hints. Returns the header key or null. */
function findColumn(headers: string[], hints: string[]): string | null {
  for (const h of headers) {
    const n = normalize(h)
    for (const hint of hints) {
      if (n === hint || n.includes(hint) || hint.includes(n)) return h
    }
  }
  return null
}

// ─── Preview (shared) ───────────────────────────────────────────────────────

export interface PlanilhaPreview {
  sheetNames: string[]
  headers:    string[]
  sampleRows: Record<string, string>[]
  rowCount:   number
}

export function previewWorkbook(wb: XLSX.WorkBook, sheetIndex = 0): PlanilhaPreview {
  const sheetName = wb.SheetNames[sheetIndex]
  if (!sheetName) return { sheetNames: wb.SheetNames, headers: [], sampleRows: [], rowCount: 0 }
  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
  const headers = raw.length > 0 ? Object.keys(raw[0]) : []
  const sampleRows = raw.slice(0, 10).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
  )
  return { sheetNames: wb.SheetNames, headers, sampleRows, rowCount: raw.length }
}

// ─── 1. Resumo por Núcleo ───────────────────────────────────────────────────

const RESUMO_HINTS: Record<keyof ResumoNucleo, string[]> = {
  nucleo:  ['nucleo', 'nome', 'localidade', 'area', 'frente'],
  tipo:    ['tipo', 'rede', 'sistema', 'type'],
  trTotal: ['tr total', 'trechos total', 'total trechos', 'total tr'],
  trObra:  ['tr obra', 'trechos obra', 'em obra'],
  trCad:   ['tr cad', 'trechos cad', 'cadastro', 'tr cadastro'],
  trExec:  ['tr exec', 'trechos exec', 'executado', 'tr executado'],
  trPend:  ['tr pend', 'trechos pend', 'pendente', 'tr pendente'],
  kmObra:  ['km obra', 'extensao obra', 'ext obra'],
  kmExec:  ['km exec', 'extensao exec', 'ext exec', 'km executado'],
  kmPend:  ['km pend', 'extensao pend', 'ext pend', 'km pendente'],
  kmCad:   ['km cad', 'extensao cad', 'ext cad', 'km cadastro'],
  kmReal:  ['km real', 'extensao real', 'real'],
  ratio:   ['ratio', 'razao', 'indice', 'r/p'],
  pctExec: ['exec', 'pct exec', 'progresso', 'percent', 'pct', 'avanco'],
}

export interface ResumoParseResult {
  items:  ResumoNucleo[]
  errors: string[]
}

export function parseResumo(wb: XLSX.WorkBook, sheetIndex = 0): ResumoParseResult {
  const errors: string[] = []
  const rows = getRows(wb, sheetIndex)
  if (rows.length === 0) return { items: [], errors: ['Planilha vazia — nenhuma linha encontrada.'] }

  const headers = Object.keys(rows[0])
  const col = (hints: string[]) => findColumn(headers, hints)

  const cNucleo  = col(RESUMO_HINTS.nucleo)
  const cTipo    = col(RESUMO_HINTS.tipo)
  const cTrTotal = col(RESUMO_HINTS.trTotal)
  const cTrObra  = col(RESUMO_HINTS.trObra)
  const cTrCad   = col(RESUMO_HINTS.trCad)
  const cTrExec  = col(RESUMO_HINTS.trExec)
  const cTrPend  = col(RESUMO_HINTS.trPend)
  const cKmObra  = col(RESUMO_HINTS.kmObra)
  const cKmExec  = col(RESUMO_HINTS.kmExec)
  const cKmPend  = col(RESUMO_HINTS.kmPend)
  const cKmCad   = col(RESUMO_HINTS.kmCad)
  const cKmReal  = col(RESUMO_HINTS.kmReal)
  const cRatio   = col(RESUMO_HINTS.ratio)
  const cPctExec = col(RESUMO_HINTS.pctExec)

  if (!cNucleo) errors.push('Coluna "Núcleo" não encontrada.')

  const items: ResumoNucleo[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const nucleo = str(cNucleo ? r[cNucleo] : '')
    if (!nucleo) continue

    const tipoRaw = str(cTipo ? r[cTipo] : '').toUpperCase()
    const tipo: ResumoNucleo['tipo'] = tipoRaw.includes('AGUA') || tipoRaw.includes('WATER') ? 'AGUA' : 'ESGOTO'

    items.push({
      nucleo,
      tipo,
      trTotal: toNum(cTrTotal ? r[cTrTotal] : 0),
      trObra:  toNum(cTrObra  ? r[cTrObra]  : 0),
      trCad:   toNum(cTrCad   ? r[cTrCad]   : 0),
      trExec:  toNum(cTrExec  ? r[cTrExec]  : 0),
      trPend:  toNum(cTrPend  ? r[cTrPend]  : 0),
      kmObra:  toNum(cKmObra  ? r[cKmObra]  : 0),
      kmExec:  toNum(cKmExec  ? r[cKmExec]  : 0),
      kmPend:  toNum(cKmPend  ? r[cKmPend]  : 0),
      kmCad:   toNum(cKmCad   ? r[cKmCad]   : 0),
      kmReal:  toNum(cKmReal  ? r[cKmReal]  : 0),
      ratio:   str(cRatio     ? r[cRatio]   : '—'),
      pctExec: toNum(cPctExec ? r[cPctExec] : 0),
    })
  }

  if (items.length === 0) errors.push('Nenhum núcleo válido encontrado.')
  return { items, errors }
}

// ─── 2. Consolidado Trechos ─────────────────────────────────────────────────

const TRECHOS_HINTS = {
  nucleo:   ['nucleo', 'nome', 'localidade', 'area', 'frente'],
  tipo:     ['tipo', 'rede', 'sistema', 'type'],
  rua:      ['rua', 'logradouro', 'street', 'endereco', 'via', 'nome rua', 'nome da rua'],
  ns:       ['ns', 'trecho', 'segmento', 'n s', 'numero serie'],
  pvMont:   ['pv mont', 'pv montante', 'montante', 'pv inicio', 'pv a'],
  pvJus:    ['pv jus', 'pv jusante', 'jusante', 'pv fim', 'pv b'],
  dnMm:     ['dn', 'dn mm', 'diametro', 'diam', 'mm'],
  extM:     ['ext', 'ext m', 'extensao', 'comprimento', 'metros', 'length', 'comp'],
  mat:      ['mat', 'material', 'tubo', 'tipo tubo', 'tipo material'],
  ctMont:   ['ct mont', 'ct montante', 'cota mont', 'cota montante'],
  ctJus:    ['ct jus', 'ct jusante', 'cota jus', 'cota jusante'],
  declPml:  ['decl', 'declividade', 'decl pml', 'inclinacao', 'slope'],
  status:   ['status', 'situacao', 'estado', 'andamento'],
  dataExec: ['data exec', 'data execucao', 'data', 'dt exec', 'executado em', 'date'],
}

export interface TrechosParseResult {
  items:  ConsolidadoTrecho[]
  errors: string[]
}

function inferStatus(raw: string): ConsolidadoTrecho['status'] {
  const s = raw.toUpperCase()
  if (s.includes('EXEC') || s.includes('CONCL') || s.includes('OK') || s.includes('DONE')) return 'EXECUTADO'
  if (s.includes('PEND') || s.includes('FALT') || s.includes('ABERTO')) return 'PENDENTE'
  if (s.includes('CAD') || s.includes('REGIST') || s.includes('PROJETO')) return 'CADASTRO'
  return 'PENDENTE'
}

export function parseTrechos(wb: XLSX.WorkBook, sheetIndex = 0): TrechosParseResult {
  const errors: string[] = []
  const rows = getRows(wb, sheetIndex)
  if (rows.length === 0) return { items: [], errors: ['Planilha vazia — nenhuma linha encontrada.'] }

  const headers = Object.keys(rows[0])
  const col = (hints: string[]) => findColumn(headers, hints)

  const cNucleo   = col(TRECHOS_HINTS.nucleo)
  const cTipo     = col(TRECHOS_HINTS.tipo)
  const cRua      = col(TRECHOS_HINTS.rua)
  const cNs       = col(TRECHOS_HINTS.ns)
  const cPvMont   = col(TRECHOS_HINTS.pvMont)
  const cPvJus    = col(TRECHOS_HINTS.pvJus)
  const cDnMm     = col(TRECHOS_HINTS.dnMm)
  const cExtM     = col(TRECHOS_HINTS.extM)
  const cMat      = col(TRECHOS_HINTS.mat)
  const cCtMont   = col(TRECHOS_HINTS.ctMont)
  const cCtJus    = col(TRECHOS_HINTS.ctJus)
  const cDeclPml  = col(TRECHOS_HINTS.declPml)
  const cStatus   = col(TRECHOS_HINTS.status)
  const cDataExec = col(TRECHOS_HINTS.dataExec)

  if (!cNucleo && !cRua) errors.push('Coluna "Núcleo" ou "Rua" não encontrada.')

  const items: ConsolidadoTrecho[] = []
  let lastNucleo = ''
  let lastTipo: ConsolidadoTrecho['tipo'] = 'ESGOTO'
  let lastRua = 'Sem Rua'

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    // Track current nucleo/tipo/rua (some sheets use merged cells → empty below first)
    const rawNucleo = str(cNucleo ? r[cNucleo] : '')
    if (rawNucleo) lastNucleo = rawNucleo

    const rawTipo = str(cTipo ? r[cTipo] : '').toUpperCase()
    if (rawTipo) lastTipo = rawTipo.includes('AGUA') || rawTipo.includes('WATER') ? 'AGUA' : 'ESGOTO'

    const rawRua = str(cRua ? r[cRua] : '')
    if (rawRua) lastRua = rawRua

    // Need at least NS or extM to count as a trecho row
    const ns = str(cNs ? r[cNs] : '')
    const extM = toNum(cExtM ? r[cExtM] : 0)
    if (!ns && extM === 0) continue

    const rawStatus = str(cStatus ? r[cStatus] : '')
    const rawDataExec = str(cDataExec ? r[cDataExec] : '')
    const dnRaw = cDnMm ? r[cDnMm] : null
    const ctMontRaw = cCtMont ? r[cCtMont] : null
    const ctJusRaw = cCtJus ? r[cCtJus] : null
    const declRaw = cDeclPml ? r[cDeclPml] : null

    items.push({
      nucleo:   lastNucleo || 'Sem Núcleo',
      tipo:     lastTipo,
      rua:      lastRua,
      ns:       ns || `NS-${String(i + 1).padStart(4, '0')}`,
      pvMont:   str(cPvMont ? r[cPvMont] : ''),
      pvJus:    str(cPvJus ? r[cPvJus] : '') || null,
      dnMm:     dnRaw != null && str(dnRaw) !== '' ? toNum(dnRaw) : null,
      extM:     extM,
      mat:      str(cMat ? r[cMat] : 'PVC'),
      ctMont:   ctMontRaw != null && str(ctMontRaw) !== '' ? toNum(ctMontRaw) : null,
      ctJus:    ctJusRaw != null && str(ctJusRaw) !== '' ? toNum(ctJusRaw) : null,
      declPml:  declRaw != null && str(declRaw) !== '' ? toNum(declRaw) : null,
      status:   rawStatus ? inferStatus(rawStatus) : 'PENDENTE',
      dataExec: rawDataExec || null,
    })
  }

  if (items.length === 0) errors.push('Nenhum trecho válido encontrado.')
  return { items, errors }
}

// ─── 3. Materiais Pendentes ─────────────────────────────────────────────────

const MATERIAIS_HINTS = {
  nucleo:   ['nucleo', 'localidade', 'area', 'frente'],
  rua:      ['rua', 'logradouro', 'street', 'endereco', 'via'],
  material: ['material', 'descricao', 'produto', 'item', 'especificacao', 'nome'],
  un:       ['un', 'unidade', 'und', 'medida'],
  rede:     ['rede', 'tipo', 'sistema', 'esg', 'agua'],
  qtd:      ['qtd', 'quantidade', 'quant', 'qty', 'total'],
  metragem: ['metragem', 'metros', 'extensao', 'metro', 'comprimento', 'ext'],
}

export interface MateriaisParseResult {
  items:  MaterialNucleo[]
  errors: string[]
}

export function parseMateriais(wb: XLSX.WorkBook, sheetIndex = 0): MateriaisParseResult {
  const errors: string[] = []
  const rows = getRows(wb, sheetIndex)
  if (rows.length === 0) return { items: [], errors: ['Planilha vazia — nenhuma linha encontrada.'] }

  const headers = Object.keys(rows[0])
  const col = (hints: string[]) => findColumn(headers, hints)

  const cNucleo   = col(MATERIAIS_HINTS.nucleo)
  const cRua      = col(MATERIAIS_HINTS.rua)
  const cMaterial = col(MATERIAIS_HINTS.material)
  const cUn       = col(MATERIAIS_HINTS.un)
  const cRede     = col(MATERIAIS_HINTS.rede)
  const cQtd      = col(MATERIAIS_HINTS.qtd)
  const cMetragem = col(MATERIAIS_HINTS.metragem)

  if (!cMaterial) errors.push('Coluna "Material" não encontrada.')

  // Group by Nucleo > Rua
  const nucleoMap = new Map<string, Map<string, MaterialItem[]>>()
  let lastNucleo = ''
  let lastRua = 'Sem Rua'

  for (const r of rows) {
    const rawNucleo = str(cNucleo ? r[cNucleo] : '')
    if (rawNucleo) lastNucleo = rawNucleo
    const rawRua = str(cRua ? r[cRua] : '')
    if (rawRua) lastRua = rawRua

    const material = str(cMaterial ? r[cMaterial] : '')
    if (!material) continue

    const qtd = toNum(cQtd ? r[cQtd] : 0)
    const metRaw = str(cMetragem ? r[cMetragem] : '')

    const item: MaterialItem = {
      material,
      un: str(cUn ? r[cUn] : 'un'),
      rede: str(cRede ? r[cRede] : 'ESG').toUpperCase().slice(0, 3),
      qtd,
      metragem: metRaw || null,
      isSubItem: false,
    }

    const nucKey = lastNucleo || 'Sem Núcleo'
    if (!nucleoMap.has(nucKey)) nucleoMap.set(nucKey, new Map())
    const ruaMap = nucleoMap.get(nucKey)!
    if (!ruaMap.has(lastRua)) ruaMap.set(lastRua, [])
    ruaMap.get(lastRua)!.push(item)
  }

  const items: MaterialNucleo[] = []
  for (const [nucleo, ruaMap] of nucleoMap) {
    const ruas: MaterialRua[] = []
    for (const [rua, matItems] of ruaMap) {
      ruas.push({ rua, items: matItems })
    }
    items.push({ nucleo, ruas })
  }

  if (items.length === 0) errors.push('Nenhum material válido encontrado.')
  return { items, errors }
}

// ─── Auto-detect sheet type ─────────────────────────────────────────────────

export type PlanilhaType = 'resumo' | 'consolidado' | 'materiais'

export function detectSheetType(headers: string[]): PlanilhaType | null {
  const all = headers.map(normalize).join(' ')

  // Resumo: has "tr total" or "tr obra" + "km obra" pattern
  if ((all.includes('tr total') || all.includes('tr obra')) && (all.includes('km obra') || all.includes('km exec'))) {
    return 'resumo'
  }

  // Consolidado: has PV columns or NS + extensão
  if ((all.includes('pv mont') || all.includes('montante')) && (all.includes('pv jus') || all.includes('jusante'))) {
    return 'consolidado'
  }
  if (all.includes('ns') && (all.includes('ext') || all.includes('extensao')) && all.includes('status')) {
    return 'consolidado'
  }

  // Materiais: has material + qtd/quantidade
  if ((all.includes('material') || all.includes('descricao')) && (all.includes('qtd') || all.includes('quantidade'))) {
    return 'materiais'
  }

  return null
}
