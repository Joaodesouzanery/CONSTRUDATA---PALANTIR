/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx'
import { isAuthenticated } from './_supabaseAuth'

type VercelRequestLike = {
  method?: string
  body?: any
}

type VercelResponseLike = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: any) => void }
}

type ImportedActivity = {
  wbsCode: string
  name: string
  parentId: string | null
  level: number
  plannedStart: string
  plannedEnd: string
  trendStart: string
  trendEnd: string
  durationDays: number
  percentComplete: number
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  isMilestone: boolean
  responsibleTeam?: string
  predecessors?: string[]
  weight?: number
  notes?: string
  networkType?: 'agua' | 'esgoto' | 'civil' | 'geral'
  nucleo?: string
  local?: string
  sourceImportId?: string
  sourceFileName?: string
  sourceImportType?: 'mpp' | 'xml' | 'excel'
  criticalPath?: boolean
  totalSlack?: string | number
  resources?: string[]
}

type MppImportResponse = {
  source: 'mpxj' | 'mpp-fallback'
  fileName: string
  projectName: string
  activities: ImportedActivity[]
  warnings: string[]
  mappings: {
    nuclei: string[]
    extractedStrings: number
  }
}

const KNOWN_NUCLEI = [
  'Sao Manoel',
  'SÃO MANOEL',
  'Joao Carlos',
  'JOÃO CARLOS',
  'Vila Israel',
  'VILA ISRAEL',
  'Teteu',
  'TETÉU',
  'Morro do Teteu',
  'MORRO DO TETÉU',
  'Vila Criadores',
  'VILA CRIADORES',
  'Vila Pantanal',
  'VILA PANTANAL',
  'Pantanal Baixo',
  'PANTANAL BAIXO',
]

const BLOCKLIST = [
  'calibri',
  'arial',
  'times new roman',
  'gantt',
  'microsoft project',
  'standard',
  'resource',
  'task name',
  'duration',
  'finish',
  'start',
  'critical',
  'predecessor',
]

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDe\b/g, 'de')
}

function detectNucleo(text: string) {
  const normalized = normalizeText(text)
  const found = KNOWN_NUCLEI.find((item) => normalized.includes(normalizeText(item)))
  return found ? titleCase(found) : ''
}

function detectStreetLocal(text: string) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const match = clean.match(/\b(?:rua|r\.|avenida|av\.|beco|travessa|alameda|estrada)\s+[^,;|()[\]]{2,80}/i)
  return match ? titleCase(match[0].replace(/^r\./i, 'Rua').replace(/^av\./i, 'Avenida')) : ''
}

function isUsefulMppString(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  const normalized = normalizeText(text)
  if (text.length < 4 || text.length > 140) return false
  if (!/[a-zA-ZÀ-ÿ]/.test(text)) return false
  if (/^[\d\s.,:/\\|()[\]-]+$/.test(text)) return false
  if (BLOCKLIST.some((blocked) => normalized.includes(blocked))) return false
  return true
}

function extractUtf16Strings(buffer: Buffer) {
  const strings: string[] = []
  let start = -1

  for (let index = 0; index < buffer.length - 1; index += 2) {
    const code = buffer.readUInt16LE(index)
    const printable = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xfffd)
    if (printable && code !== 0) {
      if (start === -1) start = index
    } else if (start !== -1) {
      const candidate = buffer.subarray(start, index).toString('utf16le')
      if (isUsefulMppString(candidate)) strings.push(candidate.replace(/\s+/g, ' ').trim())
      start = -1
    }
  }

  return strings
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const output: string[] = []
  values.forEach((value) => {
    const key = normalizeText(value)
    if (!key || seen.has(key)) return
    seen.add(key)
    output.push(value)
  })
  return output
}

function isOleCompound(buffer: Buffer) {
  return buffer.length > 8
    && buffer[0] === 0xd0
    && buffer[1] === 0xcf
    && buffer[2] === 0x11
    && buffer[3] === 0xe0
    && buffer[4] === 0xa1
    && buffer[5] === 0xb1
    && buffer[6] === 0x1a
    && buffer[7] === 0xe1
}

function makeDate(daysFromNow: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}

function buildFallbackPreview(fileName: string, buffer: Buffer): MppImportResponse {
  const CFB = (XLSX as any).CFB
  if (!CFB?.read) throw new Error('Leitor CFB indisponivel no backend')

  const cfb = CFB.read(buffer, { type: 'buffer' })
  const streamStrings = (cfb?.FileIndex ?? []).flatMap((entry: any) => {
    if (!entry?.content || !Buffer.isBuffer(entry.content)) return []
    return extractUtf16Strings(entry.content)
  })
  const extracted = uniqueStrings(streamStrings)
  const projectName = extracted.find((item) => normalizeText(item).includes('cronograma')) || fileName.replace(/\.mpp$/i, '')
  const importId = `mpp-${Date.now()}`
  const nuclei = uniqueStrings(extracted.map(detectNucleo).filter(Boolean))
  const fallbackNuclei = nuclei.length ? nuclei : ['Sem nucleo mapeado']
  const start = makeDate(0)
  const end = makeDate(90)
  const activities: ImportedActivity[] = [{
    wbsCode: '1',
    name: projectName,
    parentId: null,
    level: 0,
    plannedStart: start,
    plannedEnd: end,
    trendStart: start,
    trendEnd: end,
    durationDays: 90,
    percentComplete: 0,
    status: 'not_started',
    isMilestone: false,
    networkType: 'geral',
    sourceImportId: importId,
    sourceFileName: fileName,
    sourceImportType: 'mpp',
    notes: 'Cronograma-base importado de MPP. Previa textual gerada no backend; confirme datas, predecessoras e caminho critico quando o conversor MPXJ estiver configurado.',
  }]

  const seenActivityNames = new Set<string>()
  fallbackNuclei.forEach((nucleo, nucleoIndex) => {
    const nucleusWbs = `1.${nucleoIndex + 1}`
    activities.push({
      wbsCode: nucleusWbs,
      name: nucleo === 'Sem nucleo mapeado' ? 'Frente sem nucleo mapeado' : `Frente ${nucleo}`,
      parentId: null,
      level: 1,
      plannedStart: start,
      plannedEnd: end,
      trendStart: start,
      trendEnd: end,
      durationDays: 90,
      percentComplete: 0,
      status: 'not_started',
      isMilestone: false,
      networkType: 'geral',
      nucleo,
      sourceImportId: importId,
      sourceFileName: fileName,
      sourceImportType: 'mpp',
      notes: 'Agrupamento por nucleo inferido do arquivo MPP.',
    })

    const children = extracted
      .filter((item) => item !== projectName)
      .filter((item) => {
        const detected = detectNucleo(item)
        if (nucleo === 'Sem nucleo mapeado') return !detected
        return detected === nucleo || normalizeText(item).includes(normalizeText(nucleo))
      })
      .filter((item) => {
        const key = normalizeText(`${nucleo}-${item}`)
        if (seenActivityNames.has(key)) return false
        seenActivityNames.add(key)
        return true
      })
      .slice(0, 80)

    children.forEach((item, itemIndex) => {
      activities.push({
        wbsCode: `${nucleusWbs}.${itemIndex + 1}`,
        name: item,
        parentId: null,
        level: 2,
        plannedStart: start,
        plannedEnd: start,
        trendStart: start,
        trendEnd: start,
        durationDays: 1,
        percentComplete: 0,
        status: 'not_started',
        isMilestone: false,
        networkType: normalizeText(item).includes('agua') ? 'agua' : normalizeText(item).includes('esgoto') ? 'esgoto' : 'geral',
        nucleo,
        local: item,
        sourceImportId: importId,
        sourceFileName: fileName,
        sourceImportType: 'mpp',
        notes: 'Atividade extraida de texto interno do MPP. Fica como pendencia de mapeamento para datas, predecessoras, recursos, folga e caminho critico.',
      })
    })
  })

  return {
    source: 'mpp-fallback',
    fileName,
    projectName,
    activities,
    warnings: [
      'MPP binario aceito pelo backend. Esta previa usa extracao textual local porque MPXJ_CONVERTER_URL nao esta configurado.',
      'Para fidelidade total de WBS, datas, predecessoras, marcos, recursos, folga e caminho critico, configure um servico MPXJ e mantenha este endpoint como proxy.',
      'Nada foi gravado automaticamente: confirme a previa e revise pendencias de mapeamento por nucleo/local.',
    ],
    mappings: {
      nuclei: fallbackNuclei,
      extractedStrings: extracted.length,
    },
  }
}

function normalizeConvertedPreview(fileName: string, converted: any): MppImportResponse {
  const activities = (Array.isArray(converted?.activities) ? converted.activities : []).map((activity: any, index: number) => {
    const plannedStart = String(activity.plannedStart || activity.start || activity.baselineStart || makeDate(0)).slice(0, 10)
    const plannedEnd = String(activity.plannedEnd || activity.finish || activity.end || activity.baselineEnd || plannedStart).slice(0, 10)
    const resources = Array.isArray(activity.resources)
      ? activity.resources.map((item: unknown) => String(item)).filter(Boolean)
      : String(activity.resourceNames || activity.responsibleTeam || '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)
    return {
      wbsCode: String(activity.wbsCode || activity.wbs || activity.outlineNumber || `1.${index + 1}`),
      name: String(activity.name || activity.taskName || `Atividade ${index + 1}`),
      parentId: activity.parentId ?? null,
      level: Number(activity.level ?? activity.outlineLevel ?? 0) || 0,
      plannedStart,
      plannedEnd,
      trendStart: String(activity.trendStart || activity.actualStart || plannedStart).slice(0, 10),
      trendEnd: String(activity.trendEnd || activity.actualFinish || plannedEnd).slice(0, 10),
      durationDays: Number(activity.durationDays ?? activity.duration ?? 0) || Math.max(0, Math.ceil((new Date(plannedEnd).getTime() - new Date(plannedStart).getTime()) / 86400000)),
      percentComplete: Math.min(100, Number(activity.percentComplete ?? activity.percent ?? 0) || 0),
      status: activity.status || (Number(activity.percentComplete ?? 0) >= 100 ? 'completed' : Number(activity.percentComplete ?? 0) > 0 ? 'in_progress' : 'not_started'),
      isMilestone: Boolean(activity.isMilestone ?? activity.milestone),
      responsibleTeam: String(activity.responsibleTeam || resources.join(', ') || ''),
      predecessors: Array.isArray(activity.predecessors) ? activity.predecessors.map(String) : String(activity.predecessors || '').split(/[;,]/).map((item) => item.trim()).filter(Boolean),
      weight: Number(activity.weight ?? 0) || undefined,
      notes: String(activity.notes || ''),
      networkType: activity.networkType || 'geral',
      nucleo: activity.nucleo || detectNucleo(`${activity.name ?? ''} ${activity.notes ?? ''}`) || undefined,
      local: activity.local || activity.location || detectStreetLocal(`${activity.name ?? ''} ${activity.notes ?? ''}`) || undefined,
      sourceImportId: activity.sourceImportId || `mpp-${Date.now()}`,
      sourceFileName: fileName,
      sourceImportType: 'mpp' as const,
      criticalPath: Boolean(activity.criticalPath ?? activity.critical),
      totalSlack: activity.totalSlack ?? activity.freeSlack,
      resources,
    } satisfies ImportedActivity
  })

  return {
    source: 'mpxj',
    fileName,
    projectName: converted?.projectName || fileName.replace(/\.mpp$/i, ''),
    activities,
    warnings: [
      ...(converted?.warnings ?? []),
      activities.length === 0 ? 'Conversor MPXJ nao retornou atividades validas.' : '',
    ].filter(Boolean),
    mappings: {
      nuclei: uniqueStrings(activities.map((activity) => activity.nucleo ?? '').filter(Boolean)),
      extractedStrings: Number(converted?.mappings?.extractedStrings ?? activities.length),
    },
  }
}

async function callMpxjConverter(fileName: string, dataBase64: string) {
  const converterUrl = process.env.MPXJ_CONVERTER_URL
  if (!converterUrl) return null

  const response = await fetch(converterUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileName, dataBase64 }),
  })
  if (!response.ok) throw new Error(`Conversor MPXJ retornou ${response.status}`)
  return await response.json()
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Metodo nao permitido' })
  }

  if (!(await isAuthenticated((req as any).headers?.authorization))) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const { fileName, dataBase64 } = req.body ?? {}
    if (!fileName || !dataBase64) return res.status(400).json({ error: 'fileName e dataBase64 sao obrigatorios' })

    const buffer = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
    if (!isOleCompound(buffer)) return res.status(400).json({ error: 'Arquivo MPP invalido ou corrompido' })

    const converted = await callMpxjConverter(String(fileName), String(dataBase64))
    if (converted) return res.status(200).json(normalizeConvertedPreview(String(fileName), converted))

    return res.status(200).json(buildFallbackPreview(String(fileName), buffer))
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao importar MPP' })
  }
}
