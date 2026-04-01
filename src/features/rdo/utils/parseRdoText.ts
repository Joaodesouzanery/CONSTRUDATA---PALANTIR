/**
 * parseRdoText.ts
 * Parses a structured field-report text message into RDO form data.
 *
 * Expected format:
 *   Equipe rede: esgoto
 *   Líder: Bruno
 *
 *   Rua B, beco do Sheike: assentamento rede esgoto tubo de 200mm, 6M, 1 ligação casa - 423
 *
 *   material:
 *   47M tubo 200mm
 *
 *   Equipamentos:
 *   2 Retro
 *
 *   Ajudantes: 13
 *   Encarregado: 5
 */
import type { RdoEquipmentEntry, RdoServiceEntry, RdoTrechoEntry, RdoTrechoStatus } from '@/types'

export interface ParsedRdoData {
  responsible:   string
  services:      Omit<RdoServiceEntry,   'id'>[]
  trechos:       Omit<RdoTrechoEntry,    'id'>[]
  equipment:     Omit<RdoEquipmentEntry, 'id'>[]
  manpower:      { foremanCount: number; officialCount: number; helperCount: number; operatorCount: number }
  employeeNames: string[]
  observations:  string
  date?:         string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }

function extractMeters(text: string): number {
  const m = text.match(/(\d+(?:\.\d+)?)\s*[Mm](?:\s|,|$)/)
  return m ? parseFloat(m[1]) : 0
}

function parseUnit(raw: string): string {
  const u = raw.trim().toLowerCase()
  if (u === 'm' || u === 'metros' || u === 'metro') return 'm'
  if (u === 'un' || u === 'unid' || u === 'unidade' || u === 'unidades') return 'un'
  if (u === 'sc' || u === 'saco' || u === 'sacos') return 'sc'
  if (u === 'br' || u === 'barra' || u === 'barras') return 'br'
  if (u === 'kg' || u === 'kgf') return 'kg'
  if (u === 't' || u === 'ton') return 't'
  return u || 'un'
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseRdoText(raw: string): ParsedRdoData {
  const lines = raw.split('\n').map((l) => l.trim())

  const services:  Omit<RdoServiceEntry,   'id'>[] = []
  const trechos:   Omit<RdoTrechoEntry,    'id'>[] = []
  const equipment: Omit<RdoEquipmentEntry, 'id'>[] = []
  const employeeNames: string[] = []
  const obsLines: string[] = []
  const manpower = { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 }
  let responsible = ''
  let trechoCounter = 0

  // Detect section boundaries by scanning for section-start keywords
  type SectionType = 'team' | 'materials' | 'equipment' | 'personnel' | 'none'

  let currentSection: SectionType = 'none'
  let currentSystem: 'agua' | 'esgoto' | 'drenagem' | 'estrutura' | 'pavimentacao' | 'outro' = 'outro'

  // Personnel role → manpower field
  const PERSONNEL_MAP: Array<[RegExp, keyof typeof manpower, boolean]> = [
    [/ajudante/,                         'helperCount',   false],
    [/pedreiro/,                         'officialCount', false],
    [/encanador/,                        'officialCount', false],
    [/operador/,                         'operatorCount', false],
    [/encarregado/,                      'foremanCount',  false],
    [/motorista/,                        'helperCount',   false],
    [/apontador/,                        'helperCount',   false],
    [/técnico\s+de\s+segurança/,         'helperCount',   true],  // added to obs only
    [/tecnico\s+de\s+seguranca/,         'helperCount',   true],
    [/engenheiro/,                       'foremanCount',  true],  // added to obs only
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNorm = norm(line)

    // ── Section detection ──────────────────────────────────────────────────

    if (/equipe\s+rede:/i.test(line)) {
      currentSection = 'team'
      const sysRaw = norm(line.split(':').slice(1).join(':').trim())
      if (sysRaw.includes('esgoto')) currentSystem = 'esgoto'
      else if (sysRaw.includes('agua') || sysRaw.includes('água')) currentSystem = 'agua'
      else if (sysRaw.includes('drenagem')) currentSystem = 'drenagem'
      else currentSystem = 'outro'
      continue
    }

    if (/^(material|materiais)\s*:/i.test(line)) {
      currentSection = 'materials'
      continue
    }

    if (/^equipamentos?\s*:/i.test(line)) {
      currentSection = 'equipment'
      continue
    }

    // ── Blank line handling ─────────────────────────────────────────────────
    if (line === '') continue

    // ── Leader detection (any section) ─────────────────────────────────────
    if (/l[ií]der\s*:/i.test(line)) {
      const nameRaw = line.split(':').slice(1).join(':').trim()
      const names = nameRaw.split(/\/|,/).map((n) => n.trim()).filter(Boolean)
      names.forEach((n) => {
        if (n && !employeeNames.includes(n)) employeeNames.push(n)
      })
      if (!responsible && names.length > 0) responsible = names[0]
      continue
    }

    // ── Personnel detection (any section, checked before anything else) ────
    {
      let matched = false
      for (const [pattern, field, obsOnly] of PERSONNEL_MAP) {
        if (pattern.test(lineNorm)) {
          const numMatch = line.match(/:\s*(\d+)/)
          if (numMatch) {
            const count = parseInt(numMatch[1], 10)
            if (!obsOnly) {
              manpower[field] += count
            }
            obsLines.push(line)
            matched = true
            break
          }
        }
      }
      if (matched) continue
    }

    // ── Process by current section ─────────────────────────────────────────

    if (currentSection === 'team') {
      // Activity line: contains ":" separating location from description
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0 && colonIdx < line.length - 1) {
        const location    = line.slice(0, colonIdx).trim()
        const description = line.slice(colonIdx + 1).trim()
        const meters      = extractMeters(description) || extractMeters(location)

        trechoCounter++
        const code = `T-${String(trechoCounter).padStart(2, '0')}`

        const status: RdoTrechoStatus = meters > 0 ? 'in_progress' : 'not_started'

        trechos.push({
          trechoCode:        code,
          trechoDescription: `${location} — ${description}`,
          plannedMeters:     0,
          executedMeters:    meters,
          status,
          source:            'rdo',
          system:            currentSystem,
        })

        services.push({
          description: description || line,
          quantity:    meters || 1,
          unit:        meters > 0 ? 'm' : 'un',
        })

        obsLines.push(line)
      } else if (line.length > 2) {
        // Free text line in team section — add to observations
        obsLines.push(line)
      }
      continue
    }

    if (currentSection === 'materials') {
      // Pattern: {qty}{unit?} {description}
      // Examples: "47M tubo 200mm", "4 luva de 50mm", "20M tubo PEAD 110mm"
      const matMatch = line.match(/^(\d+(?:\.\d+)?)\s*(M|m|un|sc|br|kg|t|m²|m2|l|cx|pç|rlo)?\s+(.+)$/i)
      if (matMatch) {
        const qty  = parseFloat(matMatch[1])
        const unit = matMatch[2] ? parseUnit(matMatch[2]) : 'un'
        const desc = matMatch[3].trim()
        services.push({ description: desc, quantity: qty, unit })
      } else if (/^\d/.test(line)) {
        // Fallback: number-starting line without explicit unit
        const parts = line.split(/\s+/)
        const qty = parseFloat(parts[0]) || 1
        const desc = parts.slice(1).join(' ')
        if (desc) services.push({ description: desc, quantity: qty, unit: 'un' })
      }
      continue
    }

    if (currentSection === 'equipment') {
      // Pattern: {qty} {name}
      const eqMatch = line.match(/^(\d+)\s+(.+)$/)
      if (eqMatch) {
        const qty  = parseInt(eqMatch[1], 10)
        const name = titleCase(eqMatch[2].trim())
        equipment.push({ name, quantity: qty, hours: 8 })
      }
      continue
    }

    // Default — accumulate in observations
    obsLines.push(line)
  }

  // Build observations from notable lines
  const observations = obsLines
    .filter((l) => l.length > 3)
    .join('\n')
    .slice(0, 1900)

  return {
    responsible,
    services,
    trechos,
    equipment,
    manpower,
    employeeNames,
    observations,
  }
}
