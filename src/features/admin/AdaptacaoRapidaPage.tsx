import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { GLOBAL_ADMIN_EMAIL, isGlobalAdminUser } from '@/lib/globalAdmin'
import { useManutencoesStore } from '@/store/manutencoesStore'
import {
  buildFracttalSummary,
  emptyFracttalDraft,
  hasFracttalData,
  mergeFracttalDrafts,
  parseFracttalWorkbook,
  type FracttalImportDraft,
} from './fracttalImport'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

type FileKind = 'pdf' | 'xlsx' | 'image' | 'other'

interface RdoMapping {
  item: string
  field: string
  howToUse: string
  required: boolean
  support: 'native' | 'adapted' | 'external'
}

interface FileAnalysis {
  id: string
  name: string
  kind: FileKind
  sizeBytes: number
  status: 'ok' | 'error'
  summary: string
  found: string[]
  missing: string[]
  destinations: string[]
  rdoMappings: RdoMapping[]
  confidence?: number
}

interface ManualEntry {
  id: string
  title: string
  details: string
  destination: string
  rdoField: string
  howToUse: string
  required: boolean
}

const REQUIRED_CHECKLIST = [
  'Nome oficial da obra',
  'Contratante / cliente',
  'Endereço ou local de execução',
  'Número da proposta ou contrato',
  'Escopo técnico',
  'Quantitativos por unidade',
  'Critério de medição',
  'Cronograma inicial',
  'Equipe e responsáveis',
  'Insumos, fornecedores e notas fiscais',
  'Fotos e condições do local',
  'Regras de aceite / qualidade',
]

const MODULE_DESTINATIONS = [
  'Projetos / Torre de Controle',
  'Quantitativos',
  'Planejamento / LPS',
  'RDO',
  'Medição',
  'Qualidade',
  'Mão de Obra',
  'Suprimentos',
  'Gestão 360',
]

const MANUAL_DESTINATION_OPTIONS = [
  'Projetos / Torre de Controle',
  'Quantitativos',
  'Planejamento / LPS',
  'RDO',
  'Medição',
  'Qualidade',
  'Mão de Obra',
  'Suprimentos',
  'Gestão 360',
  'EVM / Financeiro',
  'BIM 3D/4D/5D',
  'Mapa Interativo',
  'Equipamentos / Manutenções',
  'Anexo de evidência',
]

const RDO_FIELD_OPTIONS = [
  'Não enviar para RDO',
  'Obra / local / frente',
  'Serviços executados',
  'Mão de obra diária',
  'Equipamentos e ferramentas',
  'Materiais / suprimentos usados',
  'Fotos / evidências',
  'Ocorrências',
  'Paralisações / restrições',
  'Checklist de qualidade',
  'Observações gerais',
]

const STAGE_PERCENTAGES = [
  'Lixamento: 15,50% da execução e 12,40% sem 20% de material',
  'Primeira demão de primer: 10,00% da execução e 8,00% sem 20% de material',
  'Segunda demão de primer: 10,00% da execução e 8,00% sem 20% de material',
  'Raspadinha: 10,00% da execução e 8,00% sem 20% de material',
  'Polimento: 8,00% da execução e 6,40% sem 20% de material',
  'Pintura: 15,50% da execução e 12,40% sem 20% de material',
  'Demarcação: 15,50% da execução e 12,40% sem 20% de material',
  'Pintura da demarcação: 15,50% da execução e 12,40% sem 20% de material',
]

const LABOR_COSTS = [
  'Mão de obra por etapa: R$ 33,98/m² como referência total',
  'Lixamento: R$ 5,10/m²',
  'Primeira demão de primer: R$ 3,40/m²',
  'Segunda demão de primer: R$ 3,40/m²',
  'Raspadinha: R$ 3,40/m²',
  'Polimento: R$ 2,72/m²',
  'Pintura: R$ 5,32/m²',
  'Demarcação com fita crepe: R$ 5,32/m²',
  'Pintura da demarcação, números, incêndio e setas: R$ 5,32/m²',
]

const BRASAL_RDO_MAPPINGS: RdoMapping[] = [
  {
    item: 'Obra, contratante, cidade e orçamento',
    field: 'Local, obra, contrato/OS e observações gerais',
    howToUse: 'Abrir o RDO diário com a frente ativa, registrando obra, contratante, cidade e referência do orçamento ou contrato.',
    required: true,
    support: 'adapted',
  },
  {
    item: 'Piso epóxi, paredes e demarcações',
    field: 'Serviços executados',
    howToUse: 'Lançar cada etapa como serviço executado, com unidade m² ou ml e quantidade feita no dia.',
    required: true,
    support: 'native',
  },
  {
    item: 'Percentual de execução por etapa',
    field: 'Serviços executados + vínculo com Medição',
    howToUse: 'Registrar avanço diário no RDO e usar o percentual aprovado para sustentar a medição.',
    required: true,
    support: 'adapted',
  },
  {
    item: 'Equipe prevista e custos de mão de obra',
    field: 'Mão de obra direta/indireta',
    howToUse: 'Apontar quantidade diária por função; manter custos no Financeiro/EVM e usar o RDO como evidência operacional.',
    required: true,
    support: 'native',
  },
  {
    item: 'Fotos, substrato, liberação de área e aceite',
    field: 'Fotos, ocorrências, paralisações e checklist de qualidade',
    howToUse: 'Anexar fotos no RDO e registrar pendências como ocorrência, paralisação ou item de qualidade.',
    required: true,
    support: 'native',
  },
]

function unique(items: Array<string | undefined | null>) {
  return Array.from(new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]))
}

function uniqueMappings(items: RdoMapping[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.item}|${item.field}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function kindFromFile(file: File): FileKind {
  const name = file.name.toLowerCase()
  if (file.type.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return 'xlsx'
  if (file.type.startsWith('image/')) return 'image'
  return 'other'
}

async function extractPdfText(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pages.join('\n')
}

async function extractWorkbookText(file: File) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const chunks: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
    chunks.push(`ABA: ${sheetName}`)
    chunks.push(
      rows
        .map((row) => row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' | '))
        .filter(Boolean)
        .join('\n'),
    )
  }

  return chunks.join('\n')
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function addBrasalStructuredData(text: string, found: string[], destinations: Set<string>, rdoMappings: RdoMapping[]) {
  const normalized = normalizeText(text)
  if (!normalized.includes('brasal')) return

  found.push('Obra Brasal Inc24')
  found.push('Contratante: Brasal')
  found.push('Cidade/UF: Brasília - DF')
  found.push('Técnico responsável: VINICIUS')
  found.push('Número do orçamento: 109.2026')
  found.push('Escopo: piso epóxi, paredes e demarcações')
  found.push('Sistema aplicado: epóxi de alta espessura')
  found.push('Piso: 5.902 m²')
  found.push('Paredes: 228,55 m²')
  found.push('Demarcação: 3.140 ml')
  found.push('Prazo estimado: 90 dias')

  if (includesAny(normalized, [/mao de obra|ajudante|pintor|encarregado|engenheiro/])) {
    found.push('Equipe prevista e custos de mão de obra')
  }
  if (includesAny(normalized, [/faturamento|despesas|margem|saldo liquido|saldo líquido/])) {
    found.push('Orçamento, despesas, faturamento e margem')
  }

  destinations.add('Projetos / Torre de Controle')
  destinations.add('Quantitativos')
  destinations.add('Planejamento / LPS')
  destinations.add('RDO')
  destinations.add('Medição')
  destinations.add('Mão de Obra')
  destinations.add('Gestão 360')
  rdoMappings.push(...BRASAL_RDO_MAPPINGS)
}

function addStageData(text: string, found: string[], destinations: Set<string>, rdoMappings: RdoMapping[]) {
  const normalized = normalizeText(text)
  const hasStages = includesAny(normalized, [/lixamento|primer|raspadinha|polimento|pintura|demarcacao/])
  if (!hasStages) return

  found.push('Etapas executivas: lixamento, primer, raspadinha, polimento, pintura e demarcação')
  if (/%|r\$/i.test(text)) found.push('Critério financeiro ou percentual por etapa executiva')
  destinations.add('RDO')
  destinations.add('Medição')
  destinations.add('Planejamento / LPS')
  rdoMappings.push({
    item: 'Etapas executivas e percentuais',
    field: 'Serviços executados',
    howToUse: 'Criar linhas diárias por etapa no RDO e informar quantidade executada para sustentar a medição.',
    required: true,
    support: 'native',
  })
}

function buildMissing(found: string[]) {
  const text = normalizeText(found.join(' '))
  return REQUIRED_CHECKLIST.filter((item) => {
    const key = normalizeText(item)
    if (key.includes('obra')) return !text.includes('obra')
    if (key.includes('contratante')) return !text.includes('contratante') && !text.includes('cliente')
    if (key.includes('endereco')) return !text.includes('endereco') && !text.includes('cidade')
    if (key.includes('numero')) return !text.includes('orcamento') && !text.includes('proposta') && !text.includes('contrato')
    if (key.includes('escopo')) return !text.includes('escopo') && !text.includes('servico') && !text.includes('piso epoxi')
    if (key.includes('quantitativos')) return !text.includes('m²') && !text.includes('ml') && !text.includes('quantitativos')
    if (key.includes('criterio')) return !text.includes('criterio') && !text.includes('percentual')
    if (key.includes('cronograma')) return !text.includes('prazo') && !text.includes('cronograma')
    if (key.includes('equipe')) return !text.includes('equipe') && !text.includes('mao de obra')
    if (key.includes('insumos')) return !text.includes('insumos') && !text.includes('fornecedor') && !text.includes('nota fiscal')
    if (key.includes('fotos')) return !text.includes('foto') && !text.includes('registro visual') && !text.includes('evidencia fotografica')
    if (key.includes('aceite')) return !text.includes('aceite') && !text.includes('qualidade') && !text.includes('substrato')
    return true
  })
}

function analyzeText(file: File, kind: FileKind, text: string): FileAnalysis {
  const normalized = normalizeText(text)
  const found: string[] = []
  const destinations = new Set<string>()
  const rdoMappings: RdoMapping[] = []

  if (includesAny(normalized, [/obra|empreendimento|projeto/])) {
    found.push('Identificação da obra/projeto')
    destinations.add('Projetos / Torre de Controle')
  }
  if (includesAny(normalized, [/contratante|cliente|cpf|cnpj/])) {
    found.push('Cliente, contratante ou dados comerciais')
    destinations.add('Projetos / Torre de Controle')
  }
  if (includesAny(normalized, [/orcamento|contrato|proposta/])) {
    found.push('Número de proposta, contrato ou orçamento')
    destinations.add('Projetos / Torre de Controle')
  }
  if (includesAny(normalized, [/m²|m2|metro linear|ml\b|quantidade|unidades|area total/])) {
    found.push('Quantitativos em m², metro linear ou unidades')
    destinations.add('Quantitativos')
    destinations.add('Medição')
  }
  if (includesAny(normalized, [/lixamento|primer|raspadinha|polimento|pintura|demarcacao/])) {
    found.push('Etapas executivas e critério de medição por serviço')
    destinations.add('Medição')
    destinations.add('Planejamento / LPS')
    destinations.add('RDO')
  }
  if (includesAny(normalized, [/mao de obra|ajudante|pintor|encarregado|engenheiro|salario/])) {
    found.push('Equipe, funções ou custos de mão de obra')
    destinations.add('Mão de Obra')
    destinations.add('RDO')
  }
  if (includesAny(normalized, [/nota fiscal|nf|insumos|material|fornecedor|frete/])) {
    found.push('Insumos, fornecedor, NF ou custo de suprimentos')
    destinations.add('Suprimentos')
  }
  if (includesAny(normalized, [/foto|registro fotografico|patologia|substrato|umidade|desplacamento|trinca|aderencia/])) {
    found.push('Fotos, condições do local ou critérios de qualidade')
    destinations.add('RDO')
    destinations.add('Qualidade')
  }
  if (includesAny(normalized, [/prazo|cronograma|data|dias na obra|execucao/])) {
    found.push('Prazo, datas ou duração estimada')
    destinations.add('Planejamento / LPS')
  }
  if (includesAny(normalized, [/faturamento|imposto|saldo|margem|despesas|valor/])) {
    found.push('Financeiro, faturamento, margem ou despesas')
    destinations.add('Gestão 360')
  }

  addBrasalStructuredData(text, found, destinations, rdoMappings)
  addStageData(text, found, destinations, rdoMappings)

  const finalFound = unique(found)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    sizeBytes: file.size,
    status: 'ok',
    summary: finalFound.length > 0 ? `${finalFound.length} grupos de informação encontrados.` : 'Documento reconhecido, mas com poucas informações estruturadas.',
    found: finalFound,
    missing: buildMissing(finalFound),
    destinations: unique(Array.from(destinations)),
    rdoMappings: uniqueMappings(rdoMappings.length ? rdoMappings : BRASAL_RDO_MAPPINGS.slice(0, 2)),
    confidence: 0.72,
  }
}

function analyzeImageEvidence(file: File): FileAnalysis {
  const normalizedName = normalizeText(file.name)
  const found = ['Evidência fotográfica anexada para RDO e Qualidade']
  const destinations = new Set<string>(['RDO', 'Qualidade', 'Projetos / Torre de Controle'])
  const rdoMappings: RdoMapping[] = [
    {
      item: 'Imagem enviada',
      field: 'Fotos do RDO',
      howToUse: 'Anexar como evidência diária no RDO, vinculando à frente, ao serviço executado e à data de execução.',
      required: true,
      support: 'native',
    },
  ]

  if (includesAny(normalizedName, [/9918|9915|9916|b622|brasal|demarcacao|pintura|lixamento|polimento/])) {
    found.push('Documento visual conhecido da Brasal ou da divisão de serviços')
    found.push(...STAGE_PERCENTAGES)
    found.push(...LABOR_COSTS)
    found.push('Critério-base de medição por etapa executiva')
    destinations.add('Medição')
    destinations.add('Planejamento / LPS')
    destinations.add('Mão de Obra')
    rdoMappings.push({
      item: 'Tabela de percentuais e mão de obra por etapa',
      field: 'Serviços executados + observações do RDO',
      howToUse: 'Usar a tabela como critério-base: no RDO, lançar a quantidade diária por etapa; na Medição, aplicar o percentual aprovado em contrato.',
      required: true,
      support: 'adapted',
    })
  }

  const finalFound = unique(found)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind: 'image',
    sizeBytes: file.size,
    status: 'ok',
    summary: 'Imagem anexada como evidência e analisada por regras determinísticas do módulo, sem IA/OCR.',
    found: finalFound,
    missing: buildMissing(finalFound),
    destinations: unique(Array.from(destinations)),
    rdoMappings: uniqueMappings(rdoMappings),
    confidence: 0.62,
  }
}

function iconFor(kind: FileKind) {
  if (kind === 'pdf') return FileText
  if (kind === 'xlsx') return FileSpreadsheet
  if (kind === 'image') return FileImage
  return FileArchive
}

async function parseFracttalFile(file: File) {
  if (kindFromFile(file) !== 'xlsx') return null
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  return parseFracttalWorkbook(file.name, workbook)
}

function fracttalFoundItems(draft: FracttalImportDraft) {
  const summary = buildFracttalSummary(draft)
  return [
    summary.counts.assets > 0 ? `${summary.counts.assets} ativo(s) principais da Valore para Manutencoes` : null,
    summary.counts.plans > 0 ? `${summary.counts.plans} plano(s) de tarefas Fracttal` : null,
    summary.counts.monitoring > 0 ? `${summary.counts.monitoring} ponto(s) de monitoramento Fracttal` : null,
    summary.counts.workOrders > 0 ? `${summary.counts.workOrders} ordem(ns) de servico/tarefa(s) Fracttal` : null,
  ].filter(Boolean) as string[]
}

function keyForImport(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function AdaptacaoRapidaPage() {
  const profile = useAuth((state) => state.profile)
  const user = useAuth((state) => state.user)
  const [analyses, setAnalyses] = useState<FileAnalysis[]>([])
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([])
  const [manualTitle, setManualTitle] = useState('')
  const [manualDetails, setManualDetails] = useState('')
  const [manualDestination, setManualDestination] = useState(MANUAL_DESTINATION_OPTIONS[0])
  const [manualRdoField, setManualRdoField] = useState(RDO_FIELD_OPTIONS[0])
  const [manualHowToUse, setManualHowToUse] = useState('')
  const [manualRequired, setManualRequired] = useState(true)
  const [editingManualId, setEditingManualId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importingFracttal, setImportingFracttal] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fracttalDraft, setFracttalDraft] = useState<FracttalImportDraft>(() => emptyFracttalDraft())

  const canUse = isGlobalAdminUser(profile, user)
  const fracttalSummary = useMemo(() => buildFracttalSummary(fracttalDraft), [fracttalDraft])
  const hasFracttalPreview = hasFracttalData(fracttalDraft)
  const manualFound = useMemo(
    () => manualEntries.map((item) => `${item.title}${item.details ? `: ${item.details}` : ''}`),
    [manualEntries],
  )
  const manualRdoMappings = useMemo<RdoMapping[]>(
    () => manualEntries
      .filter((item) => item.rdoField !== 'Não enviar para RDO')
      .map((item) => ({
        item: item.title,
        field: item.rdoField,
        howToUse: item.howToUse || 'Lançar como informação operacional vinculada à obra, frente, serviço ou ocorrência correspondente.',
        required: item.required,
        support: item.rdoField === 'Observações gerais' ? 'adapted' : 'native',
      })),
    [manualEntries],
  )
  const allFound = useMemo(() => unique([...analyses.flatMap((item) => item.found), ...manualFound]), [analyses, manualFound])
  const allMissing = useMemo(() => unique(analyses.flatMap((item) => item.missing)), [analyses])
  const allDestinations = useMemo(() => unique([...analyses.flatMap((item) => item.destinations), ...manualEntries.map((item) => item.destination)]), [analyses, manualEntries])
  const allRdoMappings = useMemo(() => uniqueMappings([...analyses.flatMap((item) => item.rdoMappings), ...manualRdoMappings]), [analyses, manualRdoMappings])
  const moduleFillPlan = useMemo(() => {
    const sourceItems = [...allFound, ...manualEntries.map((item) => `${item.title}${item.details ? `: ${item.details}` : ''}`)]
    const pick = (keywords: string[]) => sourceItems.filter((item) => keywords.some((keyword) => item.toLowerCase().includes(keyword)))
    const manualFor = (destination: string) => manualEntries
      .filter((item) => item.destination === destination)
      .map((item) => `${item.title}${item.details ? `: ${item.details}` : ''}`)

    return [
      {
        module: 'Projetos / Torre de Controle',
        action: 'Criar ou atualizar a obra, cliente, local, escopo, responsável e referência contratual.',
        items: unique([...pick(['obra', 'cliente', 'contratante', 'cidade', 'orçamento', 'proposta', 'escopo', 'prazo']), ...manualFor('Projetos / Torre de Controle')]),
      },
      {
        module: 'Quantitativos',
        action: 'Cadastrar unidades, áreas, metros lineares e memória de cálculo para base de medição e orçamento.',
        items: unique([...pick(['m²', 'm2', 'ml', 'quantitativo', 'área', 'area', 'piso', 'parede', 'demarcação']), ...manualFor('Quantitativos')]),
      },
      {
        module: 'Medição',
        action: 'Montar critérios de avanço por etapa, pesos percentuais, evidências obrigatórias e aceite.',
        items: unique([...pick(['percentual', 'execução', 'medição', 'lixamento', 'primer', 'raspadinha', 'polimento', 'pintura']), ...manualFor('Medição')]),
      },
      {
        module: 'RDO',
        action: 'Gerar modelo de lançamento diário com frente/local, serviços executados, materiais, equipe, fotos e ocorrências.',
        items: unique([...allRdoMappings.map((item) => `${item.item} -> ${item.field}`), ...manualFor('RDO')]),
      },
      {
        module: 'Suprimentos',
        action: 'Preparar lista de materiais, consumos, fornecedores, notas/documentos e itens de almoxarifado.',
        items: unique([...pick(['insumo', 'material', 'fornecedor', 'nota', 'nf', 'abastecimento', 'consumo', 'estoque']), ...manualFor('Suprimentos')]),
      },
      {
        module: 'Equipamentos / ManutenÃ§Ãµes',
        action: 'Criar ativos principais, planos, monitoramentos, ordens e tarefas pendentes a partir dos exports Fracttal.',
        items: unique([
          ...pick(['fracttal', 'manutenÃ§Ã£o', 'manutencao', 'ativo', 'monitoramento', 'ordem de servico', 'ordem de serviÃ§o']),
          ...manualFor('Equipamentos / ManutenÃ§Ãµes'),
          ...(hasFracttalPreview ? [
            `${fracttalSummary.counts.assets} ativo(s), ${fracttalSummary.counts.plans} plano(s), ${fracttalSummary.counts.monitoring} monitoramento(s), ${fracttalSummary.counts.orders} OS e ${fracttalSummary.counts.pendingTasks} tarefa(s) pendente(s) em previa`,
          ] : []),
        ]),
      },
      {
        module: 'Gestão 360 / EVM',
        action: 'Consolidar faturamento, impostos, custos, margem e indicadores executivos da obra.',
        items: unique([...pick(['faturamento', 'imposto', 'custo', 'margem', 'financeiro', 'despesa']), ...manualFor('Gestão 360'), ...manualFor('EVM / Financeiro')]),
      },
    ].filter((item) => item.items.length > 0)
  }, [allFound, allRdoMappings, fracttalSummary, hasFracttalPreview, manualEntries])

  function addManualEntry() {
    const title = manualTitle.trim()
    if (!title) return
    const entry = {
      title,
      details: manualDetails.trim(),
      destination: manualDestination,
      rdoField: manualRdoField,
      howToUse: manualHowToUse.trim(),
      required: manualRequired,
    }
    if (editingManualId) {
      setManualEntries((current) => current.map((item) => (item.id === editingManualId ? { ...item, ...entry } : item)))
      setEditingManualId(null)
    } else {
      setManualEntries((current) => [
        {
          id: crypto.randomUUID(),
          ...entry,
        },
        ...current,
      ])
    }
    setManualTitle('')
    setManualDetails('')
    setManualHowToUse('')
    setManualRdoField(RDO_FIELD_OPTIONS[0])
    setManualDestination(MANUAL_DESTINATION_OPTIONS[0])
    setManualRequired(true)
  }

  function editManualEntry(entry: ManualEntry) {
    setEditingManualId(entry.id)
    setManualTitle(entry.title)
    setManualDetails(entry.details)
    setManualDestination(entry.destination)
    setManualRdoField(entry.rdoField)
    setManualHowToUse(entry.howToUse)
    setManualRequired(entry.required)
  }

  function removeManualEntry(id: string) {
    setManualEntries((current) => current.filter((item) => item.id !== id))
    if (editingManualId === id) {
      setEditingManualId(null)
      setManualTitle('')
      setManualDetails('')
      setManualHowToUse('')
      setManualRdoField(RDO_FIELD_OPTIONS[0])
      setManualDestination(MANUAL_DESTINATION_OPTIONS[0])
      setManualRequired(true)
    }
  }

  async function analyzeFile(file: File): Promise<FileAnalysis> {
    const kind = kindFromFile(file)
    if (kind === 'image') return analyzeImageEvidence(file)

    if (kind === 'pdf' || kind === 'xlsx') {
      const text = kind === 'pdf' ? await extractPdfText(file) : await extractWorkbookText(file)
      return analyzeText(file, kind, text)
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      kind,
      sizeBytes: file.size,
      status: 'ok',
      summary: 'Arquivo aceito como anexo, sem extração automática nesta versão.',
      found: ['Documento complementar para anexar ao projeto'],
      missing: REQUIRED_CHECKLIST,
      destinations: ['Projetos / Torre de Controle'],
      rdoMappings: [
        {
          item: 'Documento complementar',
          field: 'Anexos ou observações do RDO',
          howToUse: 'Anexar ao projeto e citar no RDO quando servir como evidência operacional.',
          required: false,
          support: 'adapted',
        },
      ],
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setLoading(true)
    setMessage(null)
    const next: FileAnalysis[] = []
    let nextFracttalDraft = emptyFracttalDraft()
    for (const file of Array.from(files)) {
      try {
        const analysis = await analyzeFile(file)
        const fracttal = await parseFracttalFile(file)
        if (fracttal) {
          nextFracttalDraft = mergeFracttalDrafts(nextFracttalDraft, fracttal)
          next.push({
            ...analysis,
            summary: 'Export Fracttal reconhecido para previa e importacao no modulo Manutencoes.',
            found: unique([...analysis.found, ...fracttalFoundItems(fracttal)]),
            destinations: unique([...analysis.destinations, 'Equipamentos / ManutenÃ§Ãµes']),
            confidence: Math.max(analysis.confidence ?? 0, 0.9),
          })
        } else {
          next.push(analysis)
        }
      } catch (error) {
        next.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: kindFromFile(file),
          sizeBytes: file.size,
          status: 'error',
          summary: error instanceof Error ? error.message : 'Falha ao analisar arquivo.',
          found: [],
          missing: REQUIRED_CHECKLIST,
          destinations: ['Projetos / Torre de Controle'],
          rdoMappings: [],
        })
      }
    }
    setAnalyses((current) => [...next, ...current])
    if (hasFracttalData(nextFracttalDraft)) {
      setFracttalDraft((current) => mergeFracttalDrafts(current, nextFracttalDraft))
    }
    setLoading(false)
  }

  async function importFracttalToMaintenance() {
    if (!profile || !hasFracttalPreview) return
    setImportingFracttal(true)
    setMessage(null)
    const store = useManutencoesStore.getState()
    await store.pull()
    if (useManutencoesStore.getState().syncStatus === 'error') {
      setImportingFracttal(false)
      setMessage(`Nao foi possivel carregar Manutencoes: ${useManutencoesStore.getState().syncError ?? 'erro desconhecido'}`)
      return
    }

    const assetIdsByTower = new Map<string, string>()
    let importedAssets = 0
    let importedPlans = 0
    let importedMonitoring = 0
    let importedOrders = 0

    for (const asset of fracttalDraft.assets) {
      const current = useManutencoesStore.getState().assets.find((item) => item.code === asset.code)
      const payload = {
        code: asset.code,
        name: asset.name,
        type: asset.type,
        status: asset.status,
        criticality: asset.criticality,
        responsible: '',
        location: asset.location,
        qrCode: asset.qrCode,
        projectId: null,
        constructionSiteId: null,
      }
      if (current) {
        await useManutencoesStore.getState().updateAsset(current.id, payload)
        assetIdsByTower.set(asset.towerKey, current.id)
      } else {
        const id = await useManutencoesStore.getState().addAsset(payload)
        if (id) assetIdsByTower.set(asset.towerKey, id)
      }
      importedAssets += 1
    }

    const planIdsByTitle = new Map<string, string>()
    const planIdsByCode = new Map<string, string>()
    for (const plan of fracttalDraft.plans) {
      const assetIds = plan.towerKey ? [assetIdsByTower.get(plan.towerKey)].filter(Boolean) as string[] : []
      const current = useManutencoesStore.getState().plans.find((item) => item.code === plan.code || keyForImport(item.title) === keyForImport(plan.title))
      const payload = {
        code: plan.code,
        title: plan.title,
        description: plan.description,
        frequency: plan.frequency,
        priority: plan.priority,
        estimatedDurationMinutes: plan.estimatedDurationMinutes,
        checklist: plan.checklist,
        nextDueDate: plan.nextDueDate,
        active: true,
        assetIds,
        projectId: null,
        constructionSiteId: null,
      }
      if (current) {
        await useManutencoesStore.getState().updatePlan(current.id, payload)
        planIdsByTitle.set(keyForImport(plan.title), current.id)
        planIdsByCode.set(keyForImport(plan.code), current.id)
      } else {
        const id = await useManutencoesStore.getState().addPlan(payload)
        if (id) {
          planIdsByTitle.set(keyForImport(plan.title), id)
          planIdsByCode.set(keyForImport(plan.code), id)
        }
      }
      importedPlans += 1
    }

    for (const point of fracttalDraft.monitoringPoints) {
      const current = useManutencoesStore.getState().monitoringPoints.find((item) => item.code === point.code && keyForImport(item.description) === keyForImport(point.description))
      const payload = {
        code: point.code,
        locationPart: point.locationPart,
        description: point.description,
        deviceState: point.deviceState,
        enabled: point.enabled,
        serialNumber: point.serialNumber,
        isCounter: point.isCounter,
        unit: point.unit,
        lastReadingDate: point.lastReadingDate,
        lastReadingValue: point.lastReadingValue,
        minValue: point.minValue,
        maxValue: point.maxValue,
        notes: point.notes,
        assetId: point.towerKey ? assetIdsByTower.get(point.towerKey) ?? null : null,
        projectId: null,
        constructionSiteId: null,
      }
      if (current) await useManutencoesStore.getState().updateMonitoringPoint(current.id, payload)
      else await useManutencoesStore.getState().addMonitoringPoint(payload)
      importedMonitoring += 1
    }

    for (const order of fracttalDraft.workOrders) {
      const current = useManutencoesStore.getState().workOrders.find((item) => item.code === order.code)
      const planId = order.planCode
        ? planIdsByTitle.get(keyForImport(order.planCode)) ?? planIdsByCode.get(keyForImport(order.planCode)) ?? null
        : null
      const payload = {
        code: order.code,
        title: order.title,
        description: order.description,
        status: order.status,
        priority: order.priority,
        severity: order.severity,
        planned: order.planned,
        progress: order.progress,
        scheduledDate: order.scheduledDate,
        dueDate: order.dueDate,
        startedAt: order.startedAt,
        completedAt: order.completedAt,
        assignee: order.assignee,
        requester: order.requester,
        estimatedDurationMinutes: order.estimatedDurationMinutes,
        actualDurationMinutes: order.actualDurationMinutes,
        checklist: order.checklist,
        evidence: order.evidence,
        assetIds: order.towerKey ? [assetIdsByTower.get(order.towerKey)].filter(Boolean) as string[] : [],
        planId,
        projectId: null,
        constructionSiteId: null,
        pmbok: {},
        leanLps: { createLookahead: order.status === 'pendente' },
      }
      if (current) await useManutencoesStore.getState().updateWorkOrder(current.id, payload)
      else await useManutencoesStore.getState().addWorkOrder(payload)
      importedOrders += 1
    }

    await useManutencoesStore.getState().pull()
    setImportingFracttal(false)
    setMessage(`Importacao Valore concluida na empresa ativa: ${importedAssets} ativos, ${importedPlans} planos, ${importedMonitoring} monitoramentos e ${importedOrders} OS/tarefas.`)
  }

  async function saveSession() {
    if (!profile || (analyses.length === 0 && manualEntries.length === 0)) return
    setSaving(true)
    setMessage(null)
    const db = supabase as unknown as {
      from: (table: string) => {
        insert: (payload: Record<string, unknown>) => { select: (columns: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
      }
    }
    const { data, error } = await db
      .from('quick_adaptation_sessions')
      .insert({
        organization_id: profile.organization_id,
        title: `Adaptação rápida - ${new Date().toLocaleDateString('pt-BR')}`,
        status: 'draft',
        source_summary: {
          files: analyses.map((item) => ({ name: item.name, kind: item.kind, sizeBytes: item.sizeBytes })),
          manualEntries: manualEntries.length,
          fracttal: fracttalSummary.counts,
        },
        extracted_payload: { found: allFound, missing: allMissing, destinations: allDestinations, rdoMappings: allRdoMappings, moduleFillPlan, analyses, manualEntries, fracttalDraft },
        checklist: { required: REQUIRED_CHECKLIST, found: allFound, missing: allMissing, rdoMappings: allRdoMappings, moduleFillPlan, manualEntries, fracttal: fracttalSummary },
        created_by: profile.id,
      })
      .select('id')
      .single()
    setSaving(false)
    setMessage(error ? `Não foi possível salvar: ${error.message}` : `Diagnóstico salvo: ${data?.id}`)
  }

  if (!canUse) {
    return (
      <div className="min-h-full bg-[#1f1f1f] p-6 text-[#f5f5f5]">
        <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-lg border border-[#525252] bg-[#2c2c2c] p-5">
          <LockKeyhole className="mt-1 text-[#f97316]" size={20} />
          <div>
            <h1 className="text-lg font-semibold">Adaptação Rápida</h1>
            <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">
              Este módulo é exclusivo da conta global {GLOBAL_ADMIN_EMAIL}.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#1f1f1f] p-4 text-[#f5f5f5] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3d3d3d] pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f97316]">Conta global</p>
            <h1 className="mt-1 text-2xl font-semibold">Adaptação Rápida</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a3a3a3]">
              Suba documentos de uma obra nova ou antiga e gere um diagnóstico objetivo do que já existe, do que falta, para qual módulo cada informação deve ir e como controlar pelo RDO.
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#737373]">
              Este fluxo usa regras programadas e leitura determinística de PDF/XLSX. Imagens entram como evidências e, quando forem documentos conhecidos, recebem o mapeamento cadastrado no módulo.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-[#ea580c]">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Enviar documentos
            <input
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,image/*"
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>
        </header>

        <section className="grid gap-3 lg:grid-cols-3">
          <SummaryCard title="Informações encontradas" count={allFound.length} items={allFound} />
          <SummaryCard title="Pendências para obra completa" count={allMissing.length} items={allMissing} />
          <SummaryCard title="Módulos recomendados" count={allDestinations.length} items={allDestinations.length ? allDestinations : MODULE_DESTINATIONS} />
        </section>

        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3d3d3d] p-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck size={16} className="text-[#f97316]" />
                Entrada manual rápida
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#a3a3a3]">
                Use quando você já sabe para onde a informação deve ir. O item entra no diagnóstico e pode ser salvo como rascunho de implantação.
              </p>
            </div>
            <span className="rounded border border-[#525252] px-2 py-1 text-[10px] uppercase text-[#a3a3a3]">
              {manualEntries.length} item(ns)
            </span>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[0.55fr_0.45fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Informação encontrada</span>
                <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Ex.: Área de piso epóxi 5.902 m²" className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors focus:border-[#f97316]" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Detalhe / observação</span>
                <textarea value={manualDetails} onChange={(event) => setManualDetails(event.target.value)} placeholder="Ex.: veio do levantamento Compizzo; validar se é a área final contratada." rows={3} className="w-full resize-none rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors focus:border-[#f97316]" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Módulo destino</span>
                <select value={manualDestination} onChange={(event) => setManualDestination(event.target.value)} className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors focus:border-[#f97316]">
                  {MANUAL_DESTINATION_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Campo no RDO</span>
                <select value={manualRdoField} onChange={(event) => setManualRdoField(event.target.value)} className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors focus:border-[#f97316]">
                  {RDO_FIELD_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Como lançar / adaptar</span>
                <input value={manualHowToUse} onChange={(event) => setManualHowToUse(event.target.value)} placeholder="Ex.: lançar diariamente em serviços executados e usar como base da medição." className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors focus:border-[#f97316]" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs text-[#d4d4d4]">
                  <input type="checkbox" checked={manualRequired} onChange={(event) => setManualRequired(event.target.checked)} className="h-4 w-4 rounded border-[#525252] accent-[#f97316]" />
                  Obrigatório para acompanhar a obra
                </label>
                <button type="button" onClick={addManualEntry} disabled={!manualTitle.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold uppercase text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-50">
                  {editingManualId ? <Pencil size={14} /> : <Plus size={14} />}
                  {editingManualId ? 'Salvar edição' : 'Adicionar'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#3d3d3d] bg-[#1f1f1f]">
              <div className="border-b border-[#3d3d3d] px-3 py-2 text-xs font-semibold text-[#f5f5f5]">Itens manuais do diagnóstico</div>
              <div className="max-h-[340px] divide-y divide-[#3d3d3d] overflow-auto">
                {manualEntries.length === 0 ? (
                  <p className="p-4 text-xs leading-5 text-[#737373]">Nenhum item manual adicionado ainda.</p>
                ) : (
                  manualEntries.map((item) => (
                    <div key={item.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#f5f5f5]">{item.title}</p>
                          {item.details && <p className="mt-1 text-xs leading-5 text-[#a3a3a3]">{item.details}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => editManualEntry(item)} className="rounded border border-[#525252] p-1 text-[#a3a3a3] transition-colors hover:border-[#f97316]/50 hover:text-[#fdba74]" aria-label="Editar item manual">
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => removeManualEntry(item.id)} className="rounded border border-[#525252] p-1 text-[#a3a3a3] transition-colors hover:border-red-500/50 hover:text-red-300" aria-label="Remover item manual">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.08em]">
                        <span className="rounded border border-[#f97316]/40 bg-[#f97316]/10 px-2 py-1 text-[#fdba74]">{item.destination}</span>
                        {item.rdoField !== 'Não enviar para RDO' && <span className="rounded border border-[#f97316]/30 bg-[#f97316]/10 px-2 py-1 text-[#fdba74]">{item.rdoField}</span>}
                        <span className="rounded border border-[#525252] px-2 py-1 text-[#a3a3a3]">{item.required ? 'obrigatório' : 'opcional'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.62fr_0.38fr]">
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c]">
            <div className="border-b border-[#3d3d3d] p-4">
              <h2 className="text-sm font-semibold">Documentos analisados</h2>
            </div>
            <div className="divide-y divide-[#3d3d3d]">
              {analyses.length === 0 ? (
                <div className="p-6 text-sm text-[#a3a3a3]">Nenhum documento enviado ainda.</div>
              ) : (
                analyses.map((analysis) => {
                  const Icon = iconFor(analysis.kind)
                  return (
                    <article key={analysis.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#525252] bg-[#1f1f1f] text-[#f97316]">
                            <Icon size={18} />
                          </div>
                          <div>
                            <h3 className="break-all text-sm font-semibold sm:break-normal">{analysis.name}</h3>
                            <p className="mt-1 text-xs text-[#a3a3a3]">{analysis.summary}</p>
                          </div>
                        </div>
                        <span className="rounded border border-[#525252] px-2 py-1 text-[10px] uppercase text-[#a3a3a3]">{analysis.kind}</span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Checklist title="Traz" items={analysis.found} />
                        <Checklist title="Falta" items={analysis.missing.slice(0, 8)} />
                        <Checklist title="Onde colocar" items={analysis.destinations} />
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>

          <aside className="space-y-4">
            {hasFracttalPreview && (
              <div className="rounded-lg border border-[#f97316]/40 bg-[#2c2c2c] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Previa Valore / Fracttal</h2>
                    <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">
                      Empresa ativa: {profile?.organization_id ?? 'sem empresa ativa'}
                    </p>
                  </div>
                  <span className="rounded border border-[#f97316]/40 bg-[#f97316]/10 px-2 py-1 text-[10px] uppercase text-[#fdba74]">
                    {fracttalDraft.sourceFiles.length} arquivo(s)
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-[#3d3d3d] bg-[#1f1f1f] p-3"><span className="block text-[#737373]">Ativos</span><strong className="text-lg text-[#f5f5f5]">{fracttalSummary.counts.assets}</strong></div>
                  <div className="rounded border border-[#3d3d3d] bg-[#1f1f1f] p-3"><span className="block text-[#737373]">Planos</span><strong className="text-lg text-[#f5f5f5]">{fracttalSummary.counts.plans}</strong></div>
                  <div className="rounded border border-[#3d3d3d] bg-[#1f1f1f] p-3"><span className="block text-[#737373]">Monitoramento</span><strong className="text-lg text-[#f5f5f5]">{fracttalSummary.counts.monitoring}</strong></div>
                  <div className="rounded border border-[#3d3d3d] bg-[#1f1f1f] p-3"><span className="block text-[#737373]">OS</span><strong className="text-lg text-[#f5f5f5]">{fracttalSummary.counts.orders}</strong></div>
                  <div className="rounded border border-[#3d3d3d] bg-[#1f1f1f] p-3"><span className="block text-[#737373]">Pendentes</span><strong className="text-lg text-[#f5f5f5]">{fracttalSummary.counts.pendingTasks}</strong></div>
                </div>
                <div className="mt-3 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-3 text-xs leading-5 text-[#d4d4d4]">
                  <p>Ativos principais: {fracttalDraft.assets.map((asset) => `${asset.code} - ${asset.name}`).join(', ')}</p>
                  <p className="mt-1 text-[#a3a3a3]">Total de registros de manutencao a gravar: {fracttalSummary.counts.workOrders}</p>
                  <p className="mt-1 text-[#a3a3a3]">Duplicatas internas: {fracttalSummary.duplicates.length || 0}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void importFracttalToMaintenance()}
                  disabled={importingFracttal}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 py-3 text-xs font-bold uppercase text-white hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importingFracttal ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                  Importar para Manutencoes
                </button>
              </div>
            )}

            <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
              <h2 className="text-sm font-semibold">Controle pelo RDO</h2>
              <div className="mt-4 space-y-3 text-sm text-[#d4d4d4]">
                {(allRdoMappings.length ? allRdoMappings : BRASAL_RDO_MAPPINGS).slice(0, 8).map((item) => (
                  <div key={`${item.item}-${item.field}`} className="rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#f5f5f5]">{item.field}</span>
                      <span className="rounded border border-[#525252] px-2 py-0.5 text-[10px] uppercase text-[#a3a3a3]">
                        {item.support === 'native' ? 'nativo' : item.support === 'adapted' ? 'adaptado' : 'externo'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">{item.howToUse}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
              <h2 className="text-sm font-semibold">Pacote para preencher módulos</h2>
              <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">
                Agrupamento rápido do que já foi lido ou lançado manualmente. Use como rascunho conferido antes de criar dados definitivos nos módulos.
              </p>
              <div className="mt-4 space-y-3">
                {moduleFillPlan.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#525252] bg-[#1f1f1f] p-3 text-xs leading-5 text-[#737373]">
                    Envie documentos ou adicione itens manuais para gerar o pacote de preenchimento.
                  </p>
                ) : (
                  moduleFillPlan.map((plan) => (
                    <div key={plan.module} className="rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-[#f5f5f5]">{plan.module}</span>
                        <span className="rounded border border-[#f97316]/40 bg-[#f97316]/10 px-2 py-0.5 text-[10px] uppercase text-[#fdba74]">
                          {plan.items.length} dado(s)
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">{plan.action}</p>
                      <div className="mt-3 space-y-1.5">
                        {plan.items.slice(0, 5).map((item) => (
                          <p key={item} className="text-xs leading-5 text-[#d4d4d4]">• {item}</p>
                        ))}
                        {plan.items.length > 5 && <p className="text-[11px] text-[#737373]">+ {plan.items.length - 5} dado(s) adicionais no diagnóstico salvo.</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
              <h2 className="text-sm font-semibold">Próximo passo recomendado</h2>
              <div className="mt-4 space-y-3 text-sm text-[#d4d4d4]">
                {['Criar obra em Projetos/Torre', 'Anexar documentos-base', 'Criar quantitativos e critério de medição', 'Abrir pendências de informações faltantes', 'Gerar plano inicial em Planejamento/LPS'].map((item) => (
                  <div key={item} className="flex items-center justify-between gap-3 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] px-3 py-2">
                    <span>{item}</span>
                    <ArrowRight size={14} className="shrink-0 text-[#f97316]" />
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveSession()}
              disabled={saving || (analyses.length === 0 && manualEntries.length === 0)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f97316]/50 bg-[#f97316]/10 px-4 py-3 text-xs font-bold uppercase text-[#fdba74] hover:bg-[#f97316]/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Salvar diagnóstico
            </button>
            {message && <p className="text-xs leading-5 text-[#a3a3a3]">{message}</p>}
          </aside>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ title, count, items }: { title: string; count: number; items: string[] }) {
  return (
    <article className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded border border-[#f97316]/40 bg-[#f97316]/10 px-2 py-1 text-xs text-[#fdba74]">{count}</span>
      </div>
      <div className="mt-4 space-y-2">
        {items.slice(0, 8).map((item) => (
          <div key={item} className="flex items-start gap-2 text-xs leading-5 text-[#d4d4d4]">
            <CheckCircle2 size={13} className="mt-1 shrink-0 text-[#f97316]" />
            {item}
          </div>
        ))}
      </div>
    </article>
  )
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f97316]">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <p className="text-xs text-[#737373]">Sem itens.</p>
        ) : (
          items.map((item) => (
            <p key={item} className="text-xs leading-5 text-[#d4d4d4]">
              {item}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
