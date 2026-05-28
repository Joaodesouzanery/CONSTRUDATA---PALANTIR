import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, ExternalLink, FileDown, Plus, RefreshCw, Trash2, Upload, Users, X as XIcon } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import type {
  Subempreiteiro,
  SubempreiteiroCustoLancamento,
  SubempreiteiroMemoriaLinha,
  SubempreiteiroNotaFiscal,
  SubempreiteiroParametroFinanceiro,
  SubempreiteiroRetencaoDetalhada,
  SubempreiteiroRetencaoMensal,
  SubempreiteiroRhMensal,
  SubempreiteiroDetalhadoMensal,
  SubempreteiroItem,
} from '@/store/medicaoBillingStore'
import { readWorkbook, parseSubempreiteiroSheet } from '../utils/xlsxParsers'
import type { SubempreiteiroParseResult } from '../utils/xlsxParsers'
import { exportSubempreiteirosPdf } from '../utils/exportPdf'
import { describeNPrecoAlias } from '@/lib/medicaoCodeMap'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { getCriadouroLabel, getRdoSabespExecutedServices } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import { SabespPlanilhaPanel } from './SabespPlanilhaPanel'
import { useContractorStore } from '@/store/contractorStore'
import { promoteSubempreiteiroImportToUnified } from '../utils/unifiedImportPromotion'

type CostKey =
  | 'agregados'
  | 'materiaisFerramentas'
  | 'materiaisEpi'
  | 'maquinas'
  | 'servicos'
  | 'veiculos'
  | 'combustivel'
  | 'abastecimentoComboio'
  | 'locEquipamentos'
  | 'epis'

type TabId =
  | 'memoria'
  | 'parametros'
  | 'descontos'
  | 'rh'
  | CostKey
  | 'retencoes'
  | 'nfs'
  | 'detalhado'
  | 'fechamento'
  | 'auditoria'

type SubempreiteiroDesconto = NonNullable<Subempreiteiro['descontos']>[number]

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'fechamento', label: 'Resumo Fechamento' },
  { id: 'auditoria', label: 'Auditoria e Exceções' },
  { id: 'parametros', label: 'Parâmetros' },
  { id: 'retencoes', label: 'Itens de Retenção' },
  { id: 'nfs', label: 'NFs' },
  { id: 'detalhado', label: 'Planilha de Medição Sabesp' },
  { id: 'memoria', label: 'Memória' },
  { id: 'descontos', label: 'Descontos' },
  { id: 'rh', label: 'RH' },
  { id: 'agregados', label: 'Agregados' },
  { id: 'materiaisFerramentas', label: 'Materiais' },
  { id: 'materiaisEpi', label: 'Materiais + EPI' },
  { id: 'maquinas', label: 'Máquinas' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'veiculos', label: 'Veículos' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'abastecimentoComboio', label: 'Abastecimento Comboio' },
  { id: 'locEquipamentos', label: 'Locação de Equipamentos' },
  { id: 'epis', label: 'Controle e Saída EPI' },
]
const costConfigs: Record<CostKey, { label: string; descontoField: keyof NonNullable<Subempreiteiro['descontos']>[number] }> = {
  agregados: { label: 'Agregados', descontoField: 'agregados' },
  materiaisFerramentas: { label: 'Materiais', descontoField: 'materiaisFerramentas' },
  materiaisEpi: { label: 'Materiais + EPI', descontoField: 'materiaisEpi' },
  maquinas: { label: 'Máquinas', descontoField: 'maquinas' },
  servicos: { label: 'Serviços', descontoField: 'servicos' },
  veiculos: { label: 'Veículos', descontoField: 'veiculos' },
  combustivel: { label: 'Combustível', descontoField: 'combustivel' },
  abastecimentoComboio: { label: 'Abastecimento Comboio', descontoField: 'abastecimentoComboio' },
  locEquipamentos: { label: 'Locação de Equipamentos', descontoField: 'locEquipamentos' },
  epis: { label: 'Controle e Saida EPI', descontoField: 'epi' },
}

const fieldClass = 'rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]'
const btnMuted = 'inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#484848] px-3 py-2 text-xs font-medium text-[#f5f5f5] hover:bg-[#525252]'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function costRowsFromSub(sub: Subempreiteiro, key: CostKey): SubempreiteiroCustoLancamento[] {
  const explicit = sub[key] ?? []
  if (explicit.length > 0) return explicit
  const config = costConfigs[key]
  return (sub.descontos ?? [])
    .map((row) => {
      const amount = Number(row[config.descontoField]) || 0
      if (amount === 0) return null
      return {
        id: `${key}-${row.id}`,
        mes: row.mes,
        descricao: `${config.label} consolidado da aba DESCONTOS`,
        quantidade: 1,
        valorUnitario: amount,
        valorTotal: amount,
        origem: normalizeSheetOrigin(row.origem),
        status: 'aprovado',
      } satisfies SubempreiteiroCustoLancamento
    })
    .filter(Boolean) as SubempreiteiroCustoLancamento[]
}

function costTotal(rows: SubempreiteiroCustoLancamento[]) {
  return rows.reduce((sum, row) => sum + (Number(row.valorTotal) || 0), 0)
}

function structuredCostsTotal(sub: Subempreiteiro) {
  return (Object.keys(costConfigs) as CostKey[])
    .reduce((sum, key) => sum + costTotal(costRowsFromSub(sub, key)), 0)
}

function subDiscountTotal(sub: Subempreiteiro) {
  const descontoTotal = (sub.descontos ?? []).reduce((sum, item) => sum + item.total, 0)
  return Math.max(descontoTotal, structuredCostsTotal(sub))
}

function subNetTotal(sub: Subempreiteiro) {
  const nfPago = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0)
  return sub.totalAprovado - subDiscountTotal(sub) - (sub.retencao || 0) + nfPago
}

function monthFromDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value.slice(0, 7)
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function isKnownNucleo(value: string) {
  return Boolean(value && value !== 'Não informado' && value !== 'Nao informado')
}

function itemTotal(item: SubempreteiroItem) {
  return item.qtd * item.valorUnitario
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    rascunho: 'Rascunho',
    em_revisao: 'Em revisão',
    aprovado: 'Aprovado',
    glosado: 'Glosado',
    bloqueado: 'Bloqueado',
  }
  return labels[status ?? ''] ?? String(status ?? '')
}

function rdoHasAuditEvidence(rdo: Record<string, unknown>) {
  const parserResult = rdo.parser_result as { audit_attachments?: unknown } | undefined
  return Boolean(
    (Array.isArray(rdo.photo_paths) && rdo.photo_paths.length > 0)
    || rdo.planilha_foto_path
    || rdo.planilha_foto_url
    || rdo.assinatura_empreiteira_url
    || rdo.assinatura_consorcio_url
    || (Array.isArray(parserResult?.audit_attachments) && parserResult.audit_attachments.length > 0)
  )
}

function origemLabel(origem?: string) {
  if (!origem) return 'Manual'
  return origem
    .replace('Importação XLSX', 'Importação XLSX')
    .replace('Importação XLSX', 'Importação XLSX')
}

function normalizeSheetOrigin(origem?: string) {
  if (origem === 'Manual' || origem === 'RDO Sabesp') return origem
  return 'Importação XLSX'
}

function formatPercent(value?: number) {
  return `${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function cleanLabel(value?: string) {
  return String(value ?? '')
    .replaceAll('Medição', 'Medição')
    .replaceAll('medição', 'medição')
    .replaceAll('Retenção', 'Retenção')
    .replaceAll('retenção', 'retenção')
    .replaceAll('Descrição', 'Descrição')
    .replaceAll('descrição', 'descrição')
    .replaceAll('Preço', 'Preço')
    .replaceAll('preço', 'preço')
    .replaceAll('Mês', 'Mês')
    .replaceAll('mês', 'mês')
    .replaceAll('Núcleo', 'Núcleo')
    .replaceAll('núcleo', 'núcleo')
    .replaceAll('Importação', 'Importação')
    .replaceAll('Ações', 'Ações')
    .replaceAll('Observações', 'Observações')
    .replaceAll('Competência', 'Competência')
    .replaceAll('revisão', 'revisão')
    .replaceAll('Revisão', 'Revisão')
    .replaceAll('Físico', 'Físico')
    .replaceAll('Líquido', 'Líquido')
    .replaceAll('Liquido', 'Líquido')
}

function rdoDetailedRows(sub: Subempreiteiro): SubempreiteiroDetalhadoMensal[] {
  if ((sub.detalhadoMensal ?? []).length > 0) return sub.detalhadoMensal ?? []
  return sub.itens.map((item) => ({
    id: item.id ?? `${item.rdoId ?? 'item'}-${item.nPreco}-${item.descricao}`,
    mes: item.mes ?? sub.periodo,
    item: item.serviceId ?? item.nPreco,
    descricao: item.descricao,
    nPreco: item.nPrecoSabesp || item.nPreco,
    unidade: item.unidade,
    qtdContratada: item.qtd,
    precoUnitario: item.valorUnitario,
    precoTotal: itemTotal(item),
    qtdMes: item.qtd,
    precoTotalMes: itemTotal(item),
    fisicoMes: item.qtd,
    fisicoAcumulado: item.qtd,
    financeiroMes: itemTotal(item),
    financeiroAcumulado: itemTotal(item),
    percentualFisico: 0,
    percentualFinanceiro: 0,
    observacoes: item.retencaoObservacao ?? '',
    origem: normalizeSheetOrigin(item.origem),
    status: item.origem === 'RDO Sabesp' ? 'em_revisao' : 'rascunho',
    rdoId: item.rdoId,
  }))
}

function downloadTemplateSub() {
  const template = [{
    'Nº Preço': '420009',
    'Vínc. Sabesp': '420009',
    'Descrição': 'Assentamento de rede esgoto PVC DN150',
    'Unidade': 'M',
    'Qtd': 100,
    'Vl. Unitário': 1648.38,
  }]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Empreiteiro')
  XLSX.writeFile(wb, 'Template_Empreiteiro_ConstruData.xlsx')
}

interface AddSubModalProps {
  onClose: () => void
  onAdd: (sub: Omit<Subempreiteiro, 'id'>) => void
  periodo: string
}

function AddSubModal({ onClose, onAdd, periodo }: AddSubModalProps) {
  const [nome, setNome] = useState('')
  const [nucleo, setNucleo] = useState('')
  const [per, setPer] = useState(periodo)

  function handleAdd() {
    if (!nome.trim()) return
    onAdd({
      nome: nome.trim(),
      nucleo: nucleo.trim(),
      periodo: per.trim(),
      contractorId: null,
      itens: [],
      parametros: [],
      descontos: [],
      rh: [],
      nfs: [],
      retencoes: [],
      parametrosFinanceiros: [],
      retencaoDetalhada: [],
      detalhadoMensal: [],
      totalMedido: 0,
      totalAprovado: 0,
      retencao: 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-16" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#525252] bg-[#3a3a3a] px-5 py-3">
          <span className="text-sm font-semibold text-white">Novo Empreiteiro</span>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-white"><XIcon size={16} /></button>
        </div>
        <div className="space-y-3 p-5">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Empreiteiro / Empresa" className={fieldClass} />
          <input value={nucleo} onChange={(e) => setNucleo(e.target.value)} placeholder="Núcleo" className={fieldClass} />
          <input value={per} onChange={(e) => setPer(e.target.value)} placeholder="Período" className={fieldClass} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#525252] bg-[#1f1f1f] px-5 py-3">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-white">Cancelar</button>
          <button onClick={handleAdd} disabled={!nome.trim()} className="rounded-lg bg-[#f97316] px-5 py-2 text-xs font-medium text-white disabled:opacity-50">
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function LegacyImportSubBtn({ subId, periodo }: { subId?: string; periodo: string }) {
  const { addSubempreiteiro, importSubempreiteiroDetalhado } = useMedicaoBillingStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<SubempreiteiroParseResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const wb = await readWorkbook(file)
      setPreview(parseSubempreiteiroSheet(wb))
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function confirm() {
    if (!preview || preview.errors.length) return
    const payload = {
      nome: preview.nome,
      nucleo: preview.nucleo,
      periodo: preview.periodo || periodo,
      itens: preview.itens.map((item) => ({ ...item, origem: 'Importação XLSX' as const, mes: item.mes || preview.periodo || periodo })),
      parametros: preview.parametros ?? [],
      descontos: preview.descontos ?? [],
      rh: preview.rh ?? [],
      agregados: preview.agregados ?? [],
      materiaisFerramentas: preview.materiaisFerramentas ?? [],
      materiaisEpi: preview.materiaisEpi ?? [],
      maquinas: preview.maquinas ?? [],
      servicos: preview.servicos ?? [],
      veiculos: preview.veiculos ?? [],
      combustivel: preview.combustivel ?? [],
      abastecimentoComboio: preview.abastecimentoComboio ?? [],
      locEquipamentos: preview.locEquipamentos ?? [],
      epis: preview.epis ?? [],
      parametrosFinanceiros: preview.parametrosFinanceiros ?? [],
      retencaoDetalhada: preview.retencaoDetalhada ?? [],
      detalhadoMensal: preview.detalhadoMensal ?? [],
      nfs: preview.nfs ?? [],
      retencoes: preview.retencoes ?? [],
      importWarnings: preview.warnings ?? [],
      totalMedido: preview.totals.totalMedido,
      totalAprovado: preview.totals.totalAprovado,
      retencao: preview.totals.retencao,
    }
    if (subId) {
      importSubempreiteiroDetalhado(subId, payload)
    } else {
      addSubempreiteiro({
        contractorId: null,
        ...payload,
      })
    }
    await promoteSubempreiteiroImportToUnified(preview)
    setPreview(null)
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} className={btnMuted}>
        <Upload size={13} /> {loading ? 'Lendo...' : 'Importação XLSX'}
      </button>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#525252] bg-[#3a3a3a] px-5 py-3">
              <span className="text-sm font-semibold text-white">Prévia de importação - {preview.nome}</span>
              <button onClick={() => setPreview(null)} className="text-[#a3a3a3] hover:text-white"><XIcon size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              {preview.errors.length > 0 ? (
                <div className="flex gap-2 rounded-lg border border-red-700/30 bg-red-900/20 p-3 text-xs text-red-300">
                  <AlertCircle size={14} /> {preview.errors.join(' ')}
                </div>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Metric label="Itens" value={preview.itens.length} />
                    <Metric label="Medido" value={fmt(preview.totals.totalMedido)} />
                    <Metric label="Retenção" value={fmt(preview.totals.retencao)} />
                    <Metric label="NFs" value={preview.nfs?.length ?? 0} />
                  </div>
                  <p className="text-xs text-[#a3a3a3]">
                    Também serão importados parâmetros ({preview.parametros?.length ?? 0}), descontos ({preview.descontos?.length ?? 0}) e RH ({preview.rh?.length ?? 0}).
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#525252] bg-[#1f1f1f] px-5 py-3">
              <button onClick={() => setPreview(null)} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-white">Cancelar</button>
              {preview.errors.length === 0 && <button onClick={confirm} className="rounded-lg bg-[#f97316] px-5 py-2 text-xs font-medium text-white">Confirmar importação</button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

type ImportPreview = SubempreiteiroParseResult & { fileName: string }

function ImportSubBtn({ subId, periodo }: { subId?: string; periodo: string }) {
  const { addSubempreiteiro, importSubempreiteiroDetalhado, getActiveBoletim } = useMedicaoBillingStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<ImportPreview[]>([])
  const [loading, setLoading] = useState(false)
  const boletim = getActiveBoletim()

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setLoading(true)
    try {
      const parsed = await Promise.all(files.map(async (file) => {
        const wb = await readWorkbook(file)
        return { ...parseSubempreiteiroSheet(wb), fileName: file.name }
      }))
      setPreviews(parsed)
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function payloadFromPreview(preview: ImportPreview) {
    return {
      nome: preview.nome,
      nucleo: preview.nucleo,
      periodo: preview.periodo || periodo,
      itens: preview.itens.map((item) => ({ ...item, origem: 'Importação XLSX' as const, mes: item.mes || preview.periodo || periodo })),
      parametros: preview.parametros ?? [],
      descontos: preview.descontos ?? [],
      rh: preview.rh ?? [],
      agregados: preview.agregados ?? [],
      materiaisFerramentas: preview.materiaisFerramentas ?? [],
      materiaisEpi: preview.materiaisEpi ?? [],
      maquinas: preview.maquinas ?? [],
      servicos: preview.servicos ?? [],
      veiculos: preview.veiculos ?? [],
      combustivel: preview.combustivel ?? [],
      abastecimentoComboio: preview.abastecimentoComboio ?? [],
      locEquipamentos: preview.locEquipamentos ?? [],
      epis: preview.epis ?? [],
      parametrosFinanceiros: preview.parametrosFinanceiros ?? [],
      retencaoDetalhada: preview.retencaoDetalhada ?? [],
      detalhadoMensal: preview.detalhadoMensal ?? [],
      nfs: preview.nfs ?? [],
      retencoes: preview.retencoes ?? [],
      totalMedido: preview.totals.totalMedido,
      totalAprovado: preview.totals.totalAprovado,
      retencao: preview.totals.retencao,
    }
  }

  async function confirm() {
    const validPreviews = previews.filter((preview) => preview.errors.length === 0)
    if (validPreviews.length === 0) return
    for (const [index, preview] of validPreviews.entries()) {
      const payload = payloadFromPreview(preview)
      if (subId && index === 0) {
        importSubempreiteiroDetalhado(subId, payload)
      } else {
        addSubempreiteiro({ contractorId: null, ...payload })
      }
      await promoteSubempreiteiroImportToUnified(preview)
    }
    setPreviews([])
  }

  const validCount = previews.filter((preview) => preview.errors.length === 0).length
  const hasErrors = previews.some((preview) => preview.errors.length > 0)
  const aliasSummary = (preview: ImportPreview) =>
    Array.from(new Set(preview.itens.map((item) => describeNPrecoAlias(item.nPreco)).filter(Boolean)))
  const importIssues = (preview: ImportPreview) => {
    const itemKeys = preview.itens.map((item) => `${item.nPrecoSabesp || item.nPreco}|${item.descricao}|${item.mes || preview.periodo || periodo}`)
    const duplicateItems = itemKeys.length - new Set(itemKeys).size
    const missingCode = preview.itens.filter((item) => !(item.nPrecoSabesp || item.nPreco)).length
    const missingNucleo = !isKnownNucleo(preview.nucleo) ? 1 : 0
    const sameContractorPeriod = (boletim?.subempreiteiros ?? []).filter((sub) =>
      cleanLabel(sub.nome).toLowerCase() === cleanLabel(preview.nome).toLowerCase()
      && cleanLabel(sub.nucleo || '').toLowerCase() === cleanLabel(preview.nucleo || '').toLowerCase()
      && String(sub.periodo || '') === String(preview.periodo || periodo),
    ).length
    return [
      missingCode ? `${missingCode} item(ns) sem N. Preço` : '',
      missingNucleo ? 'Núcleo pendente' : '',
      duplicateItems ? `${duplicateItems} item(ns) duplicado(s) dentro do arquivo` : '',
      sameContractorPeriod ? 'Possível reimportação/revisão para empreiteiro, núcleo e período já existentes' : '',
      ...(preview.warnings ?? []),
    ].filter(Boolean)
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} className={btnMuted}>
        <Upload size={13} /> {loading ? 'Lendo...' : subId ? 'Importação XLSX' : 'Importação XLSX em lote'}
      </button>
      {previews.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setPreviews([])}>
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#525252] bg-[#3a3a3a] px-5 py-3">
              <div>
                <span className="text-sm font-semibold text-white">Prévia de importação de empreiteiros</span>
                <p className="mt-0.5 text-xs text-[#d4d4d4]">{validCount} de {previews.length} arquivo(s) pronto(s) para gravar.</p>
              </div>
              <button onClick={() => setPreviews([])} className="text-[#d4d4d4] hover:text-white"><XIcon size={16} /></button>
            </div>
            <div className="max-h-[62vh] space-y-3 overflow-y-auto p-5">
              {previews.map((preview) => {
                const aliases = aliasSummary(preview)
                const issues = importIssues(preview)
                return (
                  <div key={preview.fileName} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{preview.nome}</p>
                        <p className="text-xs text-[#d4d4d4]">{preview.fileName} - {preview.nucleo || 'Núcleo pendente'} - {preview.periodo || periodo}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs ${preview.errors.length ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                        {preview.errors.length ? 'Revisar' : 'Pronto'}
                      </span>
                    </div>
                    {preview.errors.length > 0 ? (
                      <div className="mt-3 flex gap-2 rounded-lg border border-red-700/30 bg-red-900/20 p-3 text-xs text-red-300">
                        <AlertCircle size={14} /> {preview.errors.join(' ')}
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 grid gap-2 sm:grid-cols-5">
                          <Metric label="Itens" value={preview.itens.length} />
                          <Metric label="Medido" value={fmt(preview.totals.totalMedido)} />
                          <Metric label="Aprovado" value={fmt(preview.totals.totalAprovado)} />
                          <Metric label="Retenção" value={fmt(preview.totals.retencao)} />
                          <Metric label="NFs" value={preview.nfs?.length ?? 0} />
                        </div>
                        <p className="mt-3 text-xs text-[#d4d4d4]">
                          Também serão importados parâmetros ({preview.parametros?.length ?? 0}), detalhamento mensal ({preview.detalhadoMensal?.length ?? 0}), descontos ({preview.descontos?.length ?? 0}), RH ({preview.rh?.length ?? 0}), máquinas ({preview.maquinas?.length ?? 0}), serviços ({preview.servicos?.length ?? 0}), veículos ({preview.veiculos?.length ?? 0}), combustível ({preview.combustivel?.length ?? 0}) e EPI ({preview.epis?.length ?? 0}).
                        </p>
                        {aliases.length > 0 && (
                          <p className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                            Códigos normalizados para conferência Sabesp: {aliases.join(', ')}.
                          </p>
                        )}
                        {issues.length > 0 && (
                          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                            <p className="font-semibold">Exceções antes de gravar</p>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                              {issues.map((issue) => <li key={issue}>{issue}</li>)}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
              {hasErrors && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Arquivos com erro ficam fora da gravação. Corrija a planilha ou importe novamente.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#525252] bg-[#1f1f1f] px-5 py-3">
              <button onClick={() => setPreviews([])} className="px-4 py-2 text-xs text-[#d4d4d4] hover:text-white">Cancelar</button>
              {validCount > 0 && <button onClick={confirm} className="rounded-lg bg-[#f97316] px-5 py-2 text-xs font-medium text-white">Confirmar {validCount} importação(ões)</button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

void LegacyImportSubBtn

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function SubSelector({ subs, selectedId, onSelect, onRemove }: { subs: Subempreiteiro[]; selectedId: string; onSelect: (id: string) => void; onRemove: (id: string) => void }) {
  const totalItens = subs.reduce((sum, sub) => sum + sub.itens.length, 0)
  const totalMedido = subs.reduce((sum, sub) => sum + sub.totalMedido, 0)
  return (
    <div className="grid gap-2 lg:grid-cols-3">
      <button
        type="button"
        onClick={() => onSelect('__all')}
        className={`rounded-lg border p-3 text-left ${selectedId === '__all' ? 'border-[#f97316] bg-[#f97316]/10' : 'border-[#525252] bg-[#2c2c2c] hover:border-[#6b6b6b]'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Geral - todos os empreiteiros</p>
            <p className="text-xs text-[#a3a3a3]">Medição consolidada por RDO, núcleo e empreiteira</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 text-[10px] text-[#a3a3a3]">
          <span>{totalItens} itens</span>
          <span>{fmt(totalMedido)}</span>
        </div>
      </button>
      {subs.map((sub) => (
        <button
          key={sub.id}
          type="button"
          onClick={() => onSelect(sub.id)}
          className={`rounded-lg border p-3 text-left ${selectedId === sub.id ? 'border-[#f97316] bg-[#f97316]/10' : 'border-[#525252] bg-[#2c2c2c] hover:border-[#6b6b6b]'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{sub.nome}</p>
              <p className="text-xs text-[#a3a3a3]">{sub.nucleo || 'Sem núcleo'} · {sub.periodo}</p>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => { event.stopPropagation(); onRemove(sub.id) }}
              className="text-red-300 hover:text-red-200"
            >
              <Trash2 size={14} />
            </span>
          </div>
          <div className="mt-3 flex gap-2 text-[10px] text-[#a3a3a3]">
            <span>{sub.itens.length} itens</span>
            <span>{fmt(sub.totalMedido)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function ResumoTab({ sub }: { sub: Subempreiteiro }) {
  const descontos = subDiscountTotal(sub)
  const nfPago = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0)
  const saldoRetencao = (sub.retencoes ?? []).at(-1)?.saldoFinal ?? sub.retencao
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Metric label="Medição" value={fmt(sub.totalMedido)} />
      <Metric label="Medição aprovada" value={fmt(sub.totalAprovado)} />
      <Metric label="Descontos" value={fmt(descontos)} />
      <Metric label="Liquido previsto" value={fmt(subNetTotal(sub))} />
      <Metric label="Saldo retenção" value={fmt(saldoRetencao)} />
      <Metric label="Liberação NF" value={fmt(nfPago)} />
      <Metric label="Itens RDO" value={sub.itens.filter((item) => item.origem === 'RDO Sabesp').length} />
      <Metric label="Itens manuais" value={sub.itens.filter((item) => item.origem !== 'RDO Sabesp').length} />
      <Metric label="NFs" value={sub.nfs?.length ?? 0} />
    </div>
  )
}

function RdosTab({ pendingCount, contractorFilter, nucleoFilter }: { pendingCount: number; contractorFilter: string; nucleoFilter: string }) {
  const contractors = useContractorStore((state) => state.contractors)
  const measurementSources = useContractorStore((state) => state.measurementSources)
  const resolveRdoContractor = useContractorStore((state) => state.resolveRdoContractor)
  const rows = readLocalRdoSabesp().filter((rdo) => {
    if (rdo.status === 'draft') return false
    const contractor = resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
    const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
    if (contractorFilter !== 'all' && contractor?.name !== contractorFilter) return false
    if (nucleoFilter !== 'all' && nucleo !== nucleoFilter) return false
    return true
  })
  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          {pendingCount} RDO(s) estão pendentes de empreiteira ou núcleo e ainda não entram na medição.
        </div>
      )}
      {rows.map((rdo) => {
        const contractor = resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
        const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
        const services = getRdoSabespExecutedServices(rdo)
        const serviceQuantity = services.reduce((sum, service) => sum + (Number(service.quantity) || 0), 0)
        const sourceCount = measurementSources.filter((source) => source.rdo_id === rdo.id && !source.deleted_at).length
        return (
          <div key={rdo.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{rdo.report_date}</span>
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">{nucleo}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${contractor ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {contractor?.name || 'Empreiteira pendente'}
                </span>
                {rdo.encarregado && <span className="text-xs text-[#a3a3a3]">{rdo.encarregado}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4]">
                  {services.length} atividade(s)
                </span>
                <span className="rounded-full border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4]">
                  {fmtNum(serviceQuantity)} qtd. total
                </span>
                <a
                  href={`/app/rdo-sabesp?rdo=${encodeURIComponent(rdo.id)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4] hover:border-[#f97316] hover:text-white"
                >
                  Abrir RDO <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${sourceCount > 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
              {sourceCount > 0
                ? `Este RDO alimentou ${sourceCount} item(ns) em Fontes da Medição.`
                : 'Este RDO ainda não gerou fonte de medição. Confirme se está finalizado e salvo no Supabase.'}
            </div>
            {services.length > 0 && (
              <details className="mt-2 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-[#d4d4d4]">Ver atividades executadas</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {services.map((service) => (
                    <span key={service.service_id} className="rounded-full border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4]">
                      {service.services_catalog.name}: {fmtNum(service.quantity)} {service.unit}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      })}
      {rows.length === 0 && <p className="py-8 text-center text-sm text-[#6b6b6b]">Nenhum RDO Sabesp finalizado encontrado.</p>}
      <p className="text-xs text-[#6b6b6b]">Empreiteiras cadastradas: {contractors.filter((item) => !item.deleted_at).length}</p>
    </div>
  )
}

function MeasurementSourcesTab({ contractorFilter, nucleoFilter }: { contractorFilter: string; nucleoFilter: string }) {
  const contractors = useContractorStore((state) => state.contractors)
  const sources = useContractorStore((state) => state.measurementSources)
  const rows = useMemo(() => sources.filter((source) => {
    const contractor = contractors.find((item) => item.id === source.contractor_id)
    if (contractorFilter !== 'all' && contractor?.name !== contractorFilter) return false
    if (nucleoFilter !== 'all' && source.nucleo !== nucleoFilter) return false
    return !source.deleted_at
  }), [contractorFilter, contractors, nucleoFilter, sources])

  const groupedRows = useMemo(() => {
    const groups = new Map<string, {
      key: string
      date: string
      origin: string
      contractorName: string
      nucleo: string
      quantity: number
      count: number
      statuses: Set<string>
      rdoIds: Set<string>
      services: string[]
    }>()
    rows.forEach((source) => {
      const contractor = contractors.find((item) => item.id === source.contractor_id)
      const date = source.source_date || source.created_at?.slice(0, 10) || '-'
      const key = [date, source.origin_label || source.source_kind, source.contractor_id || 'sem-empreiteira', source.nucleo || 'sem-nucleo'].join('|')
      const group = groups.get(key) ?? {
        key,
        date,
        origin: source.origin_label || source.source_kind || '-',
        contractorName: contractor?.name || '-',
        nucleo: source.nucleo || '-',
        quantity: 0,
        count: 0,
        statuses: new Set<string>(),
        rdoIds: new Set<string>(),
        services: [],
      }
      group.quantity += Number(source.quantity) || 0
      group.count += 1
      if (source.quality_status) group.statuses.add(source.quality_status)
      if (source.rdo_id) group.rdoIds.add(source.rdo_id)
      if (source.service_description) {
        const serviceLabel = `${source.service_code ? `${source.service_code} - ` : ''}${source.service_description}`
        if (!group.services.includes(serviceLabel)) group.services.push(serviceLabel)
      }
      groups.set(key, group)
    })
    return Array.from(groups.values())
  }, [contractors, rows])

  const statusLabel: Record<string, string> = {
    clear: 'Liberado',
    pending_quality: 'Qualidade pendente',
    blocked_by_nc: 'Bloqueado por NC',
    released: 'Liberado pela Qualidade',
    glosa_review: 'Revisão de glosa',
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3 text-xs text-[#d4d4d4]">
        Cada linha abaixo é uma origem auditável da medição. Quando vem de RDO, o link abre o documento que gerou a quantidade.
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#525252]">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#1f1f1f] text-left text-xs uppercase text-[#a3a3a3]">
            <tr>
              <th className="p-2">Data</th>
              <th>Origem</th>
              <th>Empreiteira</th>
              <th>Núcleo</th>
              <th>Serviço</th>
              <th className="text-right">Qtd</th>
              <th>Qualidade</th>
              <th>RDO</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((group) => {
              const statuses = Array.from(group.statuses)
              const primaryStatus = statuses.includes('blocked_by_nc')
                ? 'blocked_by_nc'
                : statuses.includes('pending_quality') || statuses.includes('glosa_review')
                  ? 'pending_quality'
                  : statuses[0] || 'clear'
              const firstRdoId = Array.from(group.rdoIds)[0]
              return (
                <tr key={group.key} className="border-t border-[#3d3d3d] text-[#f5f5f5]">
                  <td className="p-2">{group.date}</td>
                  <td>{group.origin}</td>
                  <td>{group.contractorName}</td>
                  <td>{group.nucleo}</td>
                  <td>
                    <details>
                      <summary className="cursor-pointer text-xs text-[#d4d4d4]">
                        {group.count} fonte(s), {group.services.length} servico(s)
                      </summary>
                      <div className="mt-2 max-w-[460px] space-y-1 text-xs text-[#a3a3a3]">
                        {group.services.slice(0, 12).map((service) => <div key={service}>{service}</div>)}
                        {group.services.length > 12 && <div>+ {group.services.length - 12} servico(s)</div>}
                      </div>
                    </details>
                  </td>
                  <td className="text-right">{fmtNum(group.quantity)}</td>
                  <td>
                    <span className={`rounded-full px-2 py-1 text-xs ${primaryStatus === 'blocked_by_nc' ? 'bg-red-500/15 text-red-300' : primaryStatus === 'pending_quality' || primaryStatus === 'glosa_review' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {statusLabel[primaryStatus] || primaryStatus}
                    </span>
                  </td>
                  <td>
                    {firstRdoId ? (
                      <a href={`/app/rdo-sabesp?rdo=${encodeURIComponent(firstRdoId)}`} className="inline-flex items-center gap-1 text-[#f97316] hover:text-orange-300">
                        Abrir {group.rdoIds.size > 1 ? `+${group.rdoIds.size - 1}` : ''} <ExternalLink size={12} />
                      </a>
                    ) : '-'}
                  </td>
                </tr>
              )
            })}
            {groupedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-sm text-[#6b6b6b]">Nenhuma fonte de medição encontrada para o filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ItensTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({ nPreco: '', descricao: '', unidade: 'UN', qtd: 0, valorUnitario: 0 })

  function addManual() {
    if (!form.descricao.trim()) return
    onUpdate({
      itens: [
        ...sub.itens,
        {
          ...form,
          id: crypto.randomUUID(),
          nPrecoSabesp: form.nPreco,
          origem: 'Manual',
          mes: sub.periodo,
          nucleo: sub.nucleo,
        },
      ],
      totalMedido: sub.totalMedido + form.qtd * form.valorUnitario,
    })
    setForm({ nPreco: '', descricao: '', unidade: 'UN', qtd: 0, valorUnitario: 0 })
  }

  function removeItem(id?: string) {
    const next = sub.itens.filter((item) => item.id !== id)
    onUpdate({ itens: next, totalMedido: next.reduce((sum, item) => sum + itemTotal(item), 0) })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-[120px,1fr,80px,100px,120px,auto]">
        <input value={form.nPreco} onChange={(e) => setForm((v) => ({ ...v, nPreco: e.target.value }))} placeholder="N. Preço" className={fieldClass} />
        <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição manual" className={fieldClass} />
        <input value={form.unidade} onChange={(e) => setForm((v) => ({ ...v, unidade: e.target.value }))} placeholder="Un." className={fieldClass} />
        <input type="number" value={form.qtd} onChange={(e) => setForm((v) => ({ ...v, qtd: Number(e.target.value) }))} placeholder="Qtd" className={fieldClass} />
        <input type="number" value={form.valorUnitario} onChange={(e) => setForm((v) => ({ ...v, valorUnitario: Number(e.target.value) }))} placeholder="Vl. Unit." className={fieldClass} />
        <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#525252]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#1f1f1f] text-left text-xs uppercase text-[#a3a3a3]">
            <tr><th className="p-2">Mês</th><th>N. Preço</th><th>Descrição</th><th>Un</th><th className="text-right">Qtd</th><th className="text-right">Vl. Unit.</th><th>Origem</th><th></th></tr>
          </thead>
          <tbody>
            {sub.itens.map((item) => (
              <tr key={item.id} className="border-t border-[#3d3d3d] text-[#f5f5f5]">
                <td className="p-2">{item.mes || sub.periodo}</td><td>{item.nPreco}</td><td>{item.descricao}</td><td>{item.unidade}</td>
                <td className="text-right">{fmtNum(item.qtd)}</td><td className="text-right">{fmt(item.valorUnitario)}</td>
                <td><span className="rounded-full bg-[#484848] px-2 py-1 text-xs text-[#d4d4d4]">{item.origem || 'Manual'}</span></td>
                <td className="text-right"><button onClick={() => removeItem(item.id)} className="text-red-300 hover:text-red-200"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ParametrosTab({ sub }: { sub: Subempreiteiro }) {
  return (
    <div className="space-y-4">
      <DataTable
        rows={sub.parametros ?? []}
        columns={['mes', 'empreiteiro', 'nucleo', 'contrato', 'engenheiro', 'gerenteProducao', 'revisao', 'data', 'status']}
      />
      <h3 className="text-sm font-semibold text-white">Histórico de retenção</h3>
      <DataTable rows={sub.retencoes ?? []} columns={['mes', 'valorRetido', 'valorLiberado', 'saldoAnterior', 'saldoFinal', 'observacao']} moneyCols={['valorRetido', 'valorLiberado', 'saldoAnterior', 'saldoFinal']} />
    </div>
  )
}

function ParametrosFinanceirosTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const generated: SubempreiteiroParametroFinanceiro[] = [
    { id: 'calc-medicao', mes: sub.periodo, descricao: `Medição ${sub.periodo}`, valor: sub.totalMedido, tipo: 'medicao', origem: 'Calculado' },
    { id: 'calc-aprovada', mes: sub.periodo, descricao: 'Medição Aprovada', valor: sub.totalAprovado, tipo: 'aprovada', origem: 'Calculado' },
    { id: 'calc-descontos', mes: sub.periodo, descricao: 'Descontos', valor: -subDiscountTotal(sub), tipo: 'desconto', origem: 'Calculado' },
    { id: 'calc-taxa', mes: sub.periodo, descricao: 'Taxa Adm 5% (descontos)', valor: -(subDiscountTotal(sub) * 0.05), tipo: 'desconto', origem: 'Calculado' },
    { id: 'calc-fechamento', mes: sub.periodo, descricao: 'Fechamento mês', valor: subNetTotal(sub), tipo: 'fechamento', origem: 'Calculado' },
    { id: 'calc-retencao', mes: sub.periodo, descricao: `Retenção ${sub.periodo}`, valor: sub.retencao, tipo: 'retencao', origem: 'Calculado' },
    { id: 'calc-liberacao-nf', mes: sub.periodo, descricao: 'Liberação NF', valor: (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0), tipo: 'nf', origem: 'Calculado' },
    { id: 'calc-saldo', mes: sub.periodo, descricao: `Saldo Final Retenção ${sub.periodo}`, valor: (sub.retencoes ?? []).at(-1)?.saldoFinal ?? sub.retencao, tipo: 'saldo', origem: 'Calculado' },
  ]
  const legacyRows: SubempreiteiroParametroFinanceiro[] = (sub.parametros ?? [])
    .filter((row) => row.descricao || row.valor)
    .map((row) => ({
      id: row.id,
      mes: row.mes,
      descricao: row.descricao || 'Parâmetro importado',
      valor: Number(row.valor) || Number(row.valorMaisDescontos) || 0,
      tipo: 'ajuste',
      origem: 'Importação XLSX',
    }))
  const manualRows = sub.parametrosFinanceiros ?? []
  const rows = [...generated, ...legacyRows, ...manualRows]
  const totalValor = rows.reduce((sum, row) => sum + (Number(row.valor) || 0), 0)
  const [form, setForm] = useState({ mes: sub.periodo, descricao: '', valor: 0, tipo: 'ajuste' as SubempreiteiroParametroFinanceiro['tipo'] })

  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    onUpdate({
      parametrosFinanceiros: [
        ...manualRows,
        {
          id: crypto.randomUUID(),
          mes: form.mes || sub.periodo,
          descricao: form.descricao,
          valor: Number(form.valor) || 0,
          tipo: form.tipo,
          origem: 'Manual',
        },
      ],
    })
    setForm({ mes: sub.periodo, descricao: '', valor: 0, tipo: 'ajuste' })
  }

  function remove(id?: string) {
    if (!onUpdate || !id) return
    onUpdate({ parametrosFinanceiros: manualRows.filter((row) => row.id !== id) })
  }

  const displayRows = rows.map((row) => ({
    id: row.id,
    mes: row.mes,
    descricao: row.descricao,
    valor: row.valor,
    tipo: row.tipo,
    origem: origemLabel(row.origem),
  }))

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Medição aprovada" value={fmt(sub.totalAprovado)} />
        <Metric label="Fechamento mês" value={fmt(subNetTotal(sub))} />
        <Metric label="Saldo da tabela" value={fmt(totalValor)} />
      </div>
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[120px,1fr,140px,160px,auto]">
          <input value={form.mes} onChange={(e) => setForm((v) => ({ ...v, mes: e.target.value }))} placeholder="Mês" className={fieldClass} />
          <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição" className={fieldClass} />
          <input type="number" value={form.valor} onChange={(e) => setForm((v) => ({ ...v, valor: Number(e.target.value) }))} placeholder="Valor" className={fieldClass} />
          <select value={form.tipo} onChange={(e) => setForm((v) => ({ ...v, tipo: e.target.value as SubempreiteiroParametroFinanceiro['tipo'] }))} className={fieldClass}>
            <option value="adiantamento">Adiantamento</option>
            <option value="fechamento">Fechamento mês anterior</option>
            <option value="ajuste">Ajustes - extras/outros</option>
            <option value="desconto">Desconto</option>
            <option value="nf">Liberação NF</option>
            <option value="saldo">Saldo Retenção</option>
          </select>
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <SpreadsheetTable
        rows={displayRows}
        columns={[
          { key: 'mes', label: 'Mês', sticky: true },
          { key: 'descricao', label: 'Descrição' },
          { key: 'valor', label: 'Valor (R$)', money: true },
          { key: 'tipo', label: 'Tipo' },
          { key: 'origem', label: 'Origem' },
        ]}
        totals={{ valor: totalValor }}
        onDelete={onUpdate ? (row) => String(row.origem) === 'Manual' ? remove(String(row.id)) : undefined : undefined}
      />
    </div>
  )
}

void ParametrosTab

function ReadOnlyAggregateNotice({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
      A visao Geral consolida todos os empreiteiros. Para adicionar manualmente, selecione um empreiteiro especifico acima.
    </div>
  )
}

function MemoriaTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({ nPreco: '', descricao: '', unidade: 'M', qtd: 0, ruaBeco: '', trechoInicial: '', trechoFinal: '' })
  const rows = sub.memoria?.length ? sub.memoria : sub.itens.map((item) => ({
    id: item.id ?? `${item.rdoId}-${item.serviceId}`,
    mes: item.mes ?? sub.periodo,
    rdoId: item.rdoId,
    nPreco: item.nPrecoSabesp || item.nPreco,
    descricao: item.descricao,
    unidade: item.unidade,
    qtd: item.qtd,
    nucleo: item.nucleo ?? sub.nucleo,
    origem: item.origem,
    status: item.origem === 'RDO Sabesp' ? 'em_revisao' : 'rascunho',
  } satisfies SubempreiteiroMemoriaLinha))

  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    onUpdate({
      memoria: [
        ...rows,
        {
          id: crypto.randomUUID(),
          mes: sub.periodo,
          nPreco: form.nPreco,
          descricao: form.descricao,
          unidade: form.unidade,
          qtd: Number(form.qtd) || 0,
          nucleo: sub.nucleo,
          ruaBeco: form.ruaBeco,
          trechoInicial: form.trechoInicial,
          trechoFinal: form.trechoFinal,
          origem: 'Manual',
          status: 'rascunho',
        },
      ],
    })
    setForm({ nPreco: '', descricao: '', unidade: 'M', qtd: 0, ruaBeco: '', trechoInicial: '', trechoFinal: '' })
  }

  function approveSuggestions() {
    if (!onUpdate) return
    onUpdate({
      memoria: rows.map((line) => line.nPreco && line.status !== 'bloqueado' && line.status !== 'glosado'
        ? { ...line, status: 'aprovado' }
        : line),
    })
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      {onUpdate && rows.some((line) => line.nPreco && line.status !== 'aprovado') && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
          <p className="text-xs text-[#a3a3a3]">
            Vínculo assistido: itens com N. Preço sugerido entram em revisão humana antes de virar medição aprovada.
          </p>
          <button onClick={approveSuggestions} className={btnMuted}>Aprovar sugestões com N. Preço</button>
        </div>
      )}
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[120px,1fr,80px,90px,1fr,120px,120px,auto]">
          <input value={form.nPreco} onChange={(e) => setForm((v) => ({ ...v, nPreco: e.target.value }))} placeholder="N. Preço" className={fieldClass} />
          <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Servico" className={fieldClass} />
          <input value={form.unidade} onChange={(e) => setForm((v) => ({ ...v, unidade: e.target.value }))} placeholder="Un." className={fieldClass} />
          <input type="number" value={form.qtd} onChange={(e) => setForm((v) => ({ ...v, qtd: Number(e.target.value) }))} placeholder="Qtd" className={fieldClass} />
          <input value={form.ruaBeco} onChange={(e) => setForm((v) => ({ ...v, ruaBeco: e.target.value }))} placeholder="Rua/Beco" className={fieldClass} />
          <input value={form.trechoInicial} onChange={(e) => setForm((v) => ({ ...v, trechoInicial: e.target.value }))} placeholder="Trecho ini." className={fieldClass} />
          <input value={form.trechoFinal} onChange={(e) => setForm((v) => ({ ...v, trechoFinal: e.target.value }))} placeholder="Trecho fim" className={fieldClass} />
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <DataTable rows={rows} columns={['mes', 'rdoId', 'nPreco', 'descricao', 'unidade', 'qtd', 'nucleo', 'ruaBeco', 'trechoInicial', 'trechoFinal', 'origem', 'status', 'evidencia']} />
    </div>
  )
}

function DescontosTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const emptyForm = {
    mes: sub.periodo,
    rh: 0,
    agregados: 0,
    materiaisFerramentas: 0,
    materiaisEpi: 0,
    maquinas: 0,
    servicos: 0,
    veiculos: 0,
    combustivel: 0,
    abastecimentoComboio: 0,
    locEquipamentos: 0,
    epi: 0,
  }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const total = Number(form.rh) + Number(form.agregados) + Number(form.materiaisFerramentas) + Number(form.materiaisEpi)
    + Number(form.maquinas) + Number(form.servicos) + Number(form.veiculos) + Number(form.combustivel)
    + Number(form.abastecimentoComboio) + Number(form.locEquipamentos) + Number(form.epi)

  function reset() {
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  function saveManual() {
    if (!onUpdate) return
    const row: SubempreiteiroDesconto = {
      ...form,
      id: editingId ?? crypto.randomUUID(),
      total,
      origem: 'Manual',
    }
    const current = sub.descontos ?? []
    onUpdate({
      descontos: editingId
        ? current.map((item) => item.id === editingId ? row : item)
        : [...current, row],
    })
    reset()
  }

  function edit(row: SubempreiteiroDesconto) {
    setEditingId(row.id ?? null)
    setForm({
      mes: row.mes || sub.periodo,
      rh: Number(row.rh) || 0,
      agregados: Number(row.agregados) || 0,
      materiaisFerramentas: Number(row.materiaisFerramentas) || 0,
      materiaisEpi: Number(row.materiaisEpi) || 0,
      maquinas: Number(row.maquinas) || 0,
      servicos: Number(row.servicos) || 0,
      veiculos: Number(row.veiculos) || 0,
      combustivel: Number(row.combustivel) || 0,
      abastecimentoComboio: Number(row.abastecimentoComboio) || 0,
      locEquipamentos: Number(row.locEquipamentos) || 0,
      epi: Number(row.epi) || 0,
    })
  }

  function remove(id?: string) {
    if (!onUpdate || !id) return
    onUpdate({ descontos: (sub.descontos ?? []).filter((item) => item.id !== id) })
  }

  const fields: Array<[keyof typeof form, string]> = [
    ['mes', 'Mês'],
    ['rh', 'RH'],
    ['agregados', 'Agregados'],
    ['materiaisFerramentas', 'Mat. + Ferr.'],
    ['materiaisEpi', 'Mat. + EPI'],
    ['maquinas', 'Máquinas'],
    ['servicos', 'Serviços'],
    ['veiculos', 'Veículos'],
    ['combustivel', 'Combustível'],
    ['abastecimentoComboio', 'Abast. comboio'],
    ['locEquipamentos', 'Loc. equipamentos'],
    ['epi', 'EPI'],
  ]

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      {onUpdate && (
        <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map(([key, label]) => (
              <label key={key} className="space-y-1 text-[11px] font-medium uppercase text-[#a3a3a3]">
                <span>{label}</span>
                <input
                  type={key === 'mes' ? 'text' : 'number'}
                  value={form[key]}
                  onChange={(event) => setForm((value) => ({
                    ...value,
                    [key]: key === 'mes' ? event.target.value : Number(event.target.value),
                  }))}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Total: {fmt(total)}</span>
            <div className="flex flex-wrap gap-2">
              {editingId && <button type="button" onClick={reset} className={btnMuted}>Cancelar</button>}
              <button type="button" onClick={saveManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">
                {editingId ? 'Salvar desconto' : 'Adicionar desconto'}
              </button>
            </div>
          </div>
        </div>
      )}
      <EditableDataTable
        rows={sub.descontos ?? []}
        columns={['mes', 'rh', 'agregados', 'materiaisFerramentas', 'materiaisEpi', 'maquinas', 'servicos', 'veiculos', 'combustivel', 'abastecimentoComboio', 'locEquipamentos', 'epi', 'total']}
        moneyCols={['rh', 'agregados', 'materiaisFerramentas', 'materiaisEpi', 'maquinas', 'servicos', 'veiculos', 'combustivel', 'abastecimentoComboio', 'locEquipamentos', 'epi', 'total']}
        onEdit={onUpdate ? (row) => edit(row as SubempreiteiroDesconto) : undefined}
        onDelete={onUpdate ? (row) => remove((row as SubempreiteiroDesconto).id) : undefined}
      />
    </div>
  )
}

function CostTab({ sub, costKey, onUpdate }: { sub: Subempreiteiro; costKey: CostKey; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const config = costConfigs[costKey]
  const rows = costRowsFromSub(sub, costKey)
  const [form, setForm] = useState({ data: '', descricao: '', quantidade: 1, valorUnitario: 0, fornecedor: '', nf: '', placa: '', operador: '', evidencia: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setForm({ data: '', descricao: '', quantidade: 1, valorUnitario: 0, fornecedor: '', nf: '', placa: '', operador: '', evidencia: '' })
  }

  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    const next: SubempreiteiroCustoLancamento = {
      id: editingId ?? crypto.randomUUID(),
      mes: sub.periodo,
      data: form.data,
      descricao: form.descricao,
      quantidade: Number(form.quantidade) || 0,
      valorUnitario: Number(form.valorUnitario) || 0,
      valorTotal: (Number(form.quantidade) || 0) * (Number(form.valorUnitario) || 0),
      fornecedor: form.fornecedor,
      nf: form.nf,
      placa: form.placa,
      operador: form.operador,
      evidencia: form.evidencia,
      nucleo: sub.nucleo,
      origem: 'Manual',
      status: 'rascunho',
    }
    const current = sub[costKey] ?? []
    onUpdate({
      [costKey]: editingId
        ? current.map((item) => item.id === editingId ? next : item)
        : [...current, next],
    } as Partial<Subempreiteiro>)
    resetForm()
  }

  function edit(row: SubempreiteiroCustoLancamento) {
    setEditingId(row.id ?? null)
    setForm({
      data: row.data || '',
      descricao: row.descricao || '',
      quantidade: Number(row.quantidade) || 1,
      valorUnitario: Number(row.valorUnitario) || 0,
      fornecedor: row.fornecedor || '',
      nf: row.nf || '',
      placa: row.placa || '',
      operador: row.operador || '',
      evidencia: row.evidencia || '',
    })
  }

  function remove(id?: string) {
    if (!onUpdate || !id) return
    onUpdate({ [costKey]: (sub[costKey] ?? []).filter((item) => item.id !== id) } as Partial<Subempreiteiro>)
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label={config.label} value={fmt(costTotal(rows))} />
        <Metric label="Lancamentos" value={rows.length} />
        <Metric label="Origem" value={(sub[costKey]?.length ?? 0) > 0 ? 'Detalhada' : 'Resumo DESCONTOS'} />
      </div>
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[120px,1fr,90px,120px,140px,110px,110px,110px,auto]">
          <input type="date" value={form.data} onChange={(e) => setForm((v) => ({ ...v, data: e.target.value }))} className={fieldClass} />
          <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descricao" className={fieldClass} />
          <input type="number" value={form.quantidade} onChange={(e) => setForm((v) => ({ ...v, quantidade: Number(e.target.value) }))} placeholder="Qtd" className={fieldClass} />
          <input type="number" value={form.valorUnitario} onChange={(e) => setForm((v) => ({ ...v, valorUnitario: Number(e.target.value) }))} placeholder="Vl. Unit." className={fieldClass} />
          <input value={form.fornecedor} onChange={(e) => setForm((v) => ({ ...v, fornecedor: e.target.value }))} placeholder="Fornecedor" className={fieldClass} />
          <input value={form.nf} onChange={(e) => setForm((v) => ({ ...v, nf: e.target.value }))} placeholder="NF" className={fieldClass} />
          <input value={form.placa} onChange={(e) => setForm((v) => ({ ...v, placa: e.target.value }))} placeholder="Placa" className={fieldClass} />
          <input value={form.operador} onChange={(e) => setForm((v) => ({ ...v, operador: e.target.value }))} placeholder="Operador" className={fieldClass} />
          <input value={form.evidencia} onChange={(e) => setForm((v) => ({ ...v, evidencia: e.target.value }))} placeholder="Evidência" className={fieldClass} />
          <div className="flex gap-2">
            {editingId && <button type="button" onClick={resetForm} className={btnMuted}>Cancelar</button>}
            <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">{editingId ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </div>
      )}
      <EditableDataTable
        rows={rows}
        columns={['mes', 'data', 'descricao', 'quantidade', 'valorUnitario', 'valorTotal', 'fornecedor', 'nf', 'placa', 'operador', 'origem', 'status', 'evidencia']}
        moneyCols={['valorUnitario', 'valorTotal']}
        onEdit={onUpdate && (sub[costKey]?.length ?? 0) > 0 ? (row) => edit(row as SubempreiteiroCustoLancamento) : undefined}
        onDelete={onUpdate && (sub[costKey]?.length ?? 0) > 0 ? (row) => remove((row as SubempreiteiroCustoLancamento).id) : undefined}
      />
    </div>
  )
}

function DescontosECustosTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const costKeys = Object.keys(costConfigs) as CostKey[]
  const totalDescontos = (sub.descontos ?? []).reduce((sum, item) => sum + item.total, 0)
  const totalCustos = structuredCostsTotal(sub)
  const cards = [
    { label: 'Descontos consolidados', value: totalDescontos },
    { label: 'Custos detalhados', value: totalCustos },
    { label: 'Base usada no fechamento', value: subDiscountTotal(sub) },
  ]

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => <Metric key={card.label} label={card.label} value={fmt(card.value)} />)}
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {costKeys.map((key) => {
          const rows = costRowsFromSub(sub, key)
          return (
            <div key={key} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3">
              <p className="text-xs uppercase tracking-wide text-[#a3a3a3]">{costConfigs[key].label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{fmt(costTotal(rows))}</p>
              <p className="mt-1 text-[11px] text-[#6b6b6b]">{rows.length} lançamento(s)</p>
            </div>
          )
        })}
      </div>
      <details open className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
        <summary className="cursor-pointer text-sm font-semibold text-white">Descontos mensais</summary>
        <div className="mt-3"><DescontosTab sub={sub} onUpdate={onUpdate} /></div>
      </details>
      <details className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
        <summary className="cursor-pointer text-sm font-semibold text-white">RH</summary>
        <div className="mt-3"><RhTab sub={sub} onUpdate={onUpdate} /></div>
      </details>
      {costKeys.map((key) => (
        <details key={key} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-white">{costConfigs[key].label}</summary>
          <div className="mt-3"><CostTab sub={sub} costKey={key} onUpdate={onUpdate} /></div>
        </details>
      ))}
    </div>
  )
}

function AuditoriaTab({ sub }: { sub: Subempreiteiro }) {
  const detailed = rdoDetailedRows(sub)
  const exceptionRows = [
    ...sub.itens
      .filter((item) => !(item.nPrecoSabesp || item.nPreco))
      .map((item) => ({ tipo: 'Serviço sem N. Preço', origem: item.origem || 'Manual', detalhe: item.descricao, acao: 'Mapear código Sabesp antes da conferência final' })),
    ...sub.itens
      .filter((item) => describeNPrecoAlias(item.nPreco))
      .map((item) => ({ tipo: 'Código equivalente normalizado', origem: item.origem || 'Importação XLSX', detalhe: `${item.nPreco} -> ${item.nPrecoSabesp || describeNPrecoAlias(item.nPreco)}`, acao: 'Conferir se o vínculo Sabesp está correto' })),
    ...(!isKnownNucleo(sub.nucleo) ? [{ tipo: 'Núcleo divergente/pendente', origem: sub.nome, detalhe: sub.nucleo || 'Sem núcleo', acao: 'Selecionar núcleo para cruzar Sabesp x Empreiteiro x RDO' }] : []),
    ...sub.itens
      .filter((item) => item.origem === 'RDO Sabesp' && item.retencaoObservacao?.toLowerCase().includes('sem evidencia'))
      .map((item) => ({ tipo: 'RDO sem foto', origem: 'RDO Sabesp', detalhe: `${item.mes || ''} - ${item.descricao}`, acao: 'Não bloqueia medição; manter alerta de auditoria' })),
    ...sub.itens
      .filter((item) => item.origem === 'RDO Sabesp' && !item.contractorId && !sub.contractorId)
      .map((item) => ({ tipo: 'RDO sem empreiteiro', origem: 'RDO Sabesp', detalhe: item.descricao, acao: 'Vincular encarregado/empreiteiro' })),
  ].slice(0, 80)
  const checks = [
    { item: 'Itens sem N. Preço', total: detailed.filter((row) => !row.nPreco).length, tone: 'text-amber-300' },
    { item: 'Itens em revisão', total: detailed.filter((row) => row.status === 'em_revisao').length, tone: 'text-amber-300' },
    { item: 'Itens aprovados', total: detailed.filter((row) => row.status === 'aprovado').length, tone: 'text-emerald-300' },
    { item: 'Itens glosados/bloqueados', total: detailed.filter((row) => row.status === 'glosado' || row.status === 'bloqueado').length, tone: 'text-red-300' },
    { item: 'NFs sem pagamento', total: (sub.nfs ?? []).filter((nf) => nf.valorPago < nf.valorNf).length, tone: 'text-amber-300' },
    { item: 'Memórias sem evidência', total: (sub.memoria ?? []).filter((row) => !row.evidencia).length, tone: 'text-[#d4d4d4]' },
  ]
  const origemRows = [
    { origem: 'RDO Sabesp', registros: detailed.filter((row) => row.origem === 'RDO Sabesp').length },
    { origem: 'Importação XLSX', registros: detailed.filter((row) => origemLabel(row.origem).includes('Importação')).length },
    { origem: 'Manual', registros: detailed.filter((row) => row.origem === 'Manual').length },
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {checks.map((check) => (
          <div key={check.item} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
            <p className="text-xs text-[#a3a3a3]">{check.item}</p>
            <p className={`mt-2 text-2xl font-bold ${check.tone}`}>{check.total}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
        <h3 className="text-sm font-semibold text-white">Rastreabilidade por origem</h3>
        <DataTable rows={origemRows} columns={['origem', 'registros']} />
      </section>
      <section className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Fila de exceções</h3>
          <span className={`rounded-full px-2 py-1 text-xs ${exceptionRows.length ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {exceptionRows.length ? `${exceptionRows.length} pendência(s)` : 'Sem pendências críticas'}
          </span>
        </div>
        {exceptionRows.length > 0 ? (
          <DataTable rows={exceptionRows} columns={['tipo', 'origem', 'detalhe', 'acao']} />
        ) : (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Planilha, RDOs e vínculos principais estão sem exceções pendentes para este filtro.
          </p>
        )}
      </section>
      <section className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Conferência Sabesp / Critérios</h3>
        <p className="text-xs leading-relaxed text-[#a3a3a3]">
          A conferência operacional usa N. Preço, item, unidade e descrição para cruzar a medição do subempreiteiro com a Planilha Sabesp e os Critérios. Linhas sem vínculo claro ficam em revisão antes de entrarem no aprovado financeiro.
        </p>
      </section>
    </div>
  )
}

function RhTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({ funcionariosClt: 0, funcionariosPj: 0, adiantamento: 0, folhaSalarial: 0, folhaPj: 0, inss: 0 })

  function addManual() {
    if (!onUpdate) return
    const total = Number(form.adiantamento) + Number(form.folhaSalarial) + Number(form.folhaPj) + Number(form.inss)
    const next: SubempreiteiroRhMensal = {
      id: crypto.randomUUID(),
      mes: sub.periodo,
      funcionariosClt: Number(form.funcionariosClt) || 0,
      funcionariosPj: Number(form.funcionariosPj) || 0,
      adiantamento: Number(form.adiantamento) || 0,
      folhaSalarial: Number(form.folhaSalarial) || 0,
      folhaPj: Number(form.folhaPj) || 0,
      inss: Number(form.inss) || 0,
      total,
      origem: 'Manual',
    }
    onUpdate({ rh: [...(sub.rh ?? []), next] })
    setForm({ funcionariosClt: 0, funcionariosPj: 0, adiantamento: 0, folhaSalarial: 0, folhaPj: 0, inss: 0 })
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[90px,90px,120px,120px,120px,120px,auto]">
          <input type="number" value={form.funcionariosClt} onChange={(e) => setForm((v) => ({ ...v, funcionariosClt: Number(e.target.value) }))} placeholder="CLT" className={fieldClass} />
          <input type="number" value={form.funcionariosPj} onChange={(e) => setForm((v) => ({ ...v, funcionariosPj: Number(e.target.value) }))} placeholder="PJ" className={fieldClass} />
          <input type="number" value={form.adiantamento} onChange={(e) => setForm((v) => ({ ...v, adiantamento: Number(e.target.value) }))} placeholder="Adiant." className={fieldClass} />
          <input type="number" value={form.folhaSalarial} onChange={(e) => setForm((v) => ({ ...v, folhaSalarial: Number(e.target.value) }))} placeholder="Folha CLT" className={fieldClass} />
          <input type="number" value={form.folhaPj} onChange={(e) => setForm((v) => ({ ...v, folhaPj: Number(e.target.value) }))} placeholder="Folha PJ" className={fieldClass} />
          <input type="number" value={form.inss} onChange={(e) => setForm((v) => ({ ...v, inss: Number(e.target.value) }))} placeholder="INSS" className={fieldClass} />
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <DataTable rows={sub.rh ?? []} columns={['mes', 'funcionariosClt', 'funcionariosPj', 'adiantamento', 'folhaSalarial', 'folhaPj', 'inss', 'total', 'origem']} moneyCols={['adiantamento', 'folhaSalarial', 'folhaPj', 'inss', 'total']} />
    </div>
  )
}

function RetencoesTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({ valorRetido: 0, valorLiberado: 0, observacao: '' })

  function addManual() {
    if (!onUpdate) return
    const lastSaldo = (sub.retencoes ?? []).at(-1)?.saldoFinal ?? 0
    const valorRetido = Number(form.valorRetido) || 0
    const valorLiberado = Number(form.valorLiberado) || 0
    const next: SubempreiteiroRetencaoMensal = {
      id: crypto.randomUUID(),
      mes: sub.periodo,
      valorRetido,
      valorLiberado,
      saldoAnterior: lastSaldo,
      saldoFinal: lastSaldo + valorRetido - valorLiberado,
      observacao: form.observacao,
      origem: 'Manual',
    }
    onUpdate({ retencoes: [...(sub.retencoes ?? []), next], retencao: next.saldoFinal })
    setForm({ valorRetido: 0, valorLiberado: 0, observacao: '' })
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[140px,140px,1fr,auto]">
          <input type="number" value={form.valorRetido} onChange={(e) => setForm((v) => ({ ...v, valorRetido: Number(e.target.value) }))} placeholder="Valor retido" className={fieldClass} />
          <input type="number" value={form.valorLiberado} onChange={(e) => setForm((v) => ({ ...v, valorLiberado: Number(e.target.value) }))} placeholder="Valor liberado" className={fieldClass} />
          <input value={form.observacao} onChange={(e) => setForm((v) => ({ ...v, observacao: e.target.value }))} placeholder="Observacao / regra" className={fieldClass} />
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <DataTable rows={sub.retencoes ?? []} columns={['mes', 'valorRetido', 'valorLiberado', 'saldoAnterior', 'saldoFinal', 'observacao', 'origem']} moneyCols={['valorRetido', 'valorLiberado', 'saldoAnterior', 'saldoFinal']} />
    </div>
  )
}

function RetencaoDetalhadaTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({
    mes: sub.periodo,
    item: '',
    nPreco: '',
    descricao: '',
    unidade: 'M',
    qtd: 0,
    precoTotal: 0,
    retencaoPercentual: 60,
    observacoes: 'Retenção 60% (redes) (m)',
  })
  const legacyRows: SubempreiteiroRetencaoDetalhada[] = (sub.retencaoItens ?? []).map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    mes: item.mes ?? sub.periodo,
    item: item.serviceId ?? item.nPreco,
    descricao: item.descricao,
    nPreco: item.nPrecoSabesp || item.nPreco,
    unidade: item.unidade,
    qtd: item.qtd,
    precoTotal: itemTotal(item),
    fisicoMes: item.qtd,
    fisicoAcumulado: item.qtd,
    financeiroMes: itemTotal(item),
    financeiroAcumulado: itemTotal(item),
    retencaoPercentual: item.retencaoPercentual ?? 0,
    observacoes: item.retencaoObservacao ?? '',
    origem: normalizeSheetOrigin(item.origem),
  }))
  const rows = (sub.retencaoDetalhada ?? []).length > 0 ? sub.retencaoDetalhada ?? [] : legacyRows
  const totalBase = rows.reduce((sum, item) => sum + (Number(item.precoTotal) || 0), 0)
  const totalRetencao = rows.reduce((sum, item) => sum + (Number(item.precoTotal) || 0) * ((Number(item.retencaoPercentual) || 0) / 100), 0)
  const grouped = Array.from(rows.reduce((map, item) => {
    const key = item.mes || sub.periodo
    map.set(key, [...(map.get(key) ?? []), item])
    return map
  }, new Map<string, SubempreiteiroRetencaoDetalhada[]>()))

  function saveRows(nextRows: SubempreiteiroRetencaoDetalhada[]) {
    if (!onUpdate) return
    onUpdate({
      retencaoDetalhada: nextRows,
      retencao: nextRows.reduce((sum, item) => sum + (Number(item.precoTotal) || 0) * ((Number(item.retencaoPercentual) || 0) / 100), 0),
    })
  }

  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    saveRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        mes: form.mes || sub.periodo,
        item: form.item,
        nPreco: form.nPreco,
        descricao: form.descricao,
        unidade: form.unidade,
        qtd: Number(form.qtd) || 0,
        precoTotal: Number(form.precoTotal) || 0,
        fisicoMes: Number(form.qtd) || 0,
        fisicoAcumulado: Number(form.qtd) || 0,
        financeiroMes: Number(form.precoTotal) || 0,
        financeiroAcumulado: Number(form.precoTotal) || 0,
        percentualFisico: 0,
        percentualFinanceiro: 0,
        origem: 'Manual',
        retencaoPercentual: Number(form.retencaoPercentual) || 0,
        observacoes: form.observacoes,
      },
    ])
    setForm({ mes: sub.periodo, item: '', nPreco: '', descricao: '', unidade: 'M', qtd: 0, precoTotal: 0, retencaoPercentual: 60, observacoes: 'Retenção 60% (redes) (m)' })
  }

  function remove(id?: string) {
    if (!id) return
    saveRows(rows.filter((item) => item.id !== id))
  }

  const displayRows = rows.map((item) => ({
    id: item.id,
    mes: item.mes || sub.periodo,
    item: item.item,
    descricao: item.descricao,
    nPreco: item.nPreco,
    unidade: item.unidade,
    qtd: item.qtd,
    precoTotal: item.precoTotal,
    fisicoAnterior: item.fisicoAnterior ?? 0,
    fisicoMes: item.fisicoMes ?? item.qtd,
    fisicoAcumulado: item.fisicoAcumulado ?? item.qtd,
    financeiroAnterior: item.financeiroAnterior ?? 0,
    financeiroMes: item.financeiroMes ?? item.precoTotal,
    financeiroAcumulado: item.financeiroAcumulado ?? item.precoTotal,
    percentualFisico: item.percentualFisico ?? 0,
    percentualFinanceiro: item.percentualFinanceiro ?? 0,
    valorRetido: (Number(item.precoTotal) || 0) * ((Number(item.retencaoPercentual) || 0) / 100),
    observacoes: item.observacoes || '',
    origem: origemLabel(item.origem),
  }))

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Base de retenção" value={fmt(totalBase)} />
        <Metric label="Total retido" value={fmt(totalRetencao)} />
        <Metric label="Itens" value={rows.length} />
      </div>
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[100px_100px_120px_1fr_70px_90px_130px_100px_180px_auto]">
          <input value={form.mes} onChange={(e) => setForm((v) => ({ ...v, mes: e.target.value }))} placeholder="Mês" className={fieldClass} />
          <input value={form.item} onChange={(e) => setForm((v) => ({ ...v, item: e.target.value }))} placeholder="Item" className={fieldClass} />
          <input value={form.nPreco} onChange={(e) => setForm((v) => ({ ...v, nPreco: e.target.value }))} placeholder="N. Preço" className={fieldClass} />
          <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição do serviço" className={fieldClass} />
          <input value={form.unidade} onChange={(e) => setForm((v) => ({ ...v, unidade: e.target.value }))} placeholder="Un." className={fieldClass} />
          <input type="number" value={form.qtd} onChange={(e) => setForm((v) => ({ ...v, qtd: Number(e.target.value) }))} placeholder="Qtd" className={fieldClass} />
          <input type="number" value={form.precoTotal} onChange={(e) => setForm((v) => ({ ...v, precoTotal: Number(e.target.value) }))} placeholder="Preço total" className={fieldClass} />
          <input type="number" value={form.retencaoPercentual} onChange={(e) => setForm((v) => ({ ...v, retencaoPercentual: Number(e.target.value) }))} placeholder="% Ret." className={fieldClass} />
          <select value={form.observacoes} onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))} className={fieldClass}>
            <option value="Retenção 60% (redes) (m)">Retenção 60% (redes) (m)</option>
            <option value="Retenção 60% (ligações) (und.)">Retenção 60% (ligações) (und.)</option>
            <option value="Retenção 100% (itens retidos pela Sabesp)">Retenção 100% (itens retidos pela Sabesp)</option>
            <option value="Retenção manual">Retenção manual</option>
          </select>
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <div className="space-y-3">
        {grouped.map(([mes, monthRows]) => {
          const monthTotal = monthRows.reduce((sum, item) => sum + (Number(item.precoTotal) || 0) * ((Number(item.retencaoPercentual) || 0) / 100), 0)
          return (
            <div key={mes} className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{mes}</h3>
                <span className="text-xs font-semibold text-[#f97316]">Total: {fmt(monthTotal)}</span>
              </div>
              <SpreadsheetTable
                rows={displayRows.filter((item) => item.mes === mes)}
                columns={[
                  { key: 'item', label: 'Item', sticky: true },
                  { key: 'descricao', label: 'Descrição do Serviço' },
                  { key: 'nPreco', label: 'N. Preço' },
                  { key: 'unidade', label: 'Unid', align: 'center' },
                  { key: 'qtd', label: 'Qtd', number: true },
                  { key: 'precoTotal', label: 'Preço Total', money: true },
                  { key: 'fisicoAnterior', label: 'Anterior - Físico', number: true },
                  { key: 'fisicoMes', label: 'Mês Atual - Físico', number: true },
                  { key: 'fisicoAcumulado', label: 'Acumulado - Físico', number: true },
                  { key: 'financeiroAnterior', label: 'Anterior - Financeiro', money: true },
                  { key: 'financeiroMes', label: 'Mês Atual - Financeiro', money: true },
                  { key: 'financeiroAcumulado', label: 'Acumulado - Financeiro', money: true },
                  { key: 'percentualFisico', label: 'Med. Acumulado - Físico (%)', percent: true },
                  { key: 'percentualFinanceiro', label: 'Med. Acumulado - Financeiro (%)', percent: true },
                  { key: 'valorRetido', label: 'Valor Retido', money: true },
                  { key: 'observacoes', label: 'Observações' },
                ]}
                totals={{ precoTotal: monthRows.reduce((sum, item) => sum + item.precoTotal, 0), valorRetido: monthTotal }}
                onDelete={onUpdate ? (row) => remove((row as { id?: string }).id) : undefined}
                minWidth={1900}
              />
            </div>
          )
        })}
        {rows.length === 0 && <p className="rounded-lg border border-dashed border-[#525252] p-6 text-sm text-[#6b6b6b]">Sem itens de retenção ainda.</p>}
      </div>
    </div>
  )
}

void RetencoesTab

function NfsTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({ numero: '', nf: '', fornecedor: sub.nome, observacao: '', valorNf: 0, valorPago: 0, dataEmissao: '', vencimento: '', competencia: sub.periodo, status: 'PENDENTE' as SubempreiteiroNotaFiscal['status'], dataPagamento: '' })
  const rows = (sub.nfs ?? []).map((nf, index) => ({
    id: nf.id,
    num: index + 1,
    nf: nf.numero,
    fornecedor: nf.fornecedor,
    obs: nf.observacao,
    valorNf: nf.valorNf,
    valorPago: nf.valorPago,
    dataEmissao: nf.dataEmissao,
    vencimento: nf.vencimento,
    competencia: nf.competencia,
    status: nf.status,
    dataPagamento: nf.dataPagamento,
    origem: origemLabel(nf.origem),
  }))
  const totalNf = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorNf, 0)
  const totalPago = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0)

  function addManual() {
    if (!onUpdate || !form.nf.trim()) return
    const next: SubempreiteiroNotaFiscal = {
      id: crypto.randomUUID(),
      numero: form.nf,
      fornecedor: form.fornecedor || sub.nome,
      observacao: form.observacao,
      valorNf: Number(form.valorNf) || 0,
      valorPago: Number(form.valorPago) || 0,
      dataEmissao: form.dataEmissao,
      vencimento: form.vencimento,
      competencia: form.competencia || sub.periodo,
      status: form.status,
      dataPagamento: form.dataPagamento,
      origem: 'Manual',
    }
    onUpdate({ nfs: [...(sub.nfs ?? []), next] })
    setForm({ numero: '', nf: '', fornecedor: sub.nome, observacao: '', valorNf: 0, valorPago: 0, dataEmissao: '', vencimento: '', competencia: sub.periodo, status: 'PENDENTE', dataPagamento: '' })
  }

  function remove(id?: string) {
    if (!onUpdate || !id) return
    onUpdate({ nfs: (sub.nfs ?? []).filter((nf) => nf.id !== id) })
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Notas fiscais" value={sub.nfs?.length ?? 0} />
        <Metric label="Valor NF" value={fmt(totalNf)} />
        <Metric label="Valor pago" value={fmt(totalPago)} />
      </div>
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[90px,1fr,1fr,120px,120px,130px,130px,120px,120px,130px,auto]">
          <input value={form.nf} onChange={(e) => setForm((v) => ({ ...v, nf: e.target.value }))} placeholder="NF" className={fieldClass} />
          <input value={form.fornecedor} onChange={(e) => setForm((v) => ({ ...v, fornecedor: e.target.value }))} placeholder="Fornecedor" className={fieldClass} />
          <input value={form.observacao} onChange={(e) => setForm((v) => ({ ...v, observacao: e.target.value }))} placeholder="Obs" className={fieldClass} />
          <input type="number" value={form.valorNf} onChange={(e) => setForm((v) => ({ ...v, valorNf: Number(e.target.value) }))} placeholder="Valor NF" className={fieldClass} />
          <input type="number" value={form.valorPago} onChange={(e) => setForm((v) => ({ ...v, valorPago: Number(e.target.value) }))} placeholder="Valor PG" className={fieldClass} />
          <input type="date" value={form.dataEmissao} onChange={(e) => setForm((v) => ({ ...v, dataEmissao: e.target.value }))} className={fieldClass} />
          <input type="date" value={form.vencimento} onChange={(e) => setForm((v) => ({ ...v, vencimento: e.target.value }))} className={fieldClass} />
          <input value={form.competencia} onChange={(e) => setForm((v) => ({ ...v, competencia: e.target.value }))} placeholder="Competência" className={fieldClass} />
          <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as SubempreiteiroNotaFiscal['status'] }))} className={fieldClass}>
            <option value="PENDENTE">PENDENTE</option>
            <option value="ENVIADA">ENVIADA</option>
            <option value="APROVADA">APROVADA</option>
            <option value="PAGA">PAGA</option>
            <option value="GLOSADA">GLOSADA</option>
          </select>
          <input type="date" value={form.dataPagamento} onChange={(e) => setForm((v) => ({ ...v, dataPagamento: e.target.value }))} className={fieldClass} />
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <SpreadsheetTable
        rows={rows}
        columns={[
          { key: 'num', label: 'Num.', align: 'center' },
          { key: 'nf', label: 'NF', sticky: true },
          { key: 'fornecedor', label: 'Fornecedor' },
          { key: 'obs', label: 'Obs' },
          { key: 'valorNf', label: 'Valor NF', money: true },
          { key: 'valorPago', label: 'Valor PG', money: true },
          { key: 'dataEmissao', label: 'Data Emissão' },
          { key: 'vencimento', label: 'Vencimento' },
          { key: 'competencia', label: 'Competência' },
          { key: 'status', label: 'Status', align: 'center' },
          { key: 'dataPagamento', label: 'Data Pagamento' },
        ]}
        totals={{ valorNf: totalNf, valorPago: totalPago }}
        onDelete={onUpdate ? (row) => remove(String(row.id)) : undefined}
        minWidth={1250}
      />
    </div>
  )
}

function DetalhadoTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const rows = rdoDetailedRows(sub)
  const [form, setForm] = useState({
    mes: sub.periodo,
    item: '',
    descricao: '',
    nPreco: '',
    unidade: 'M',
    qtdContratada: 0,
    precoUnitario: 0,
    qtdMes: 0,
    observacoes: '',
  })
  const totalEmpreiteiro = rows.reduce((sum, row) => sum + row.precoTotal, 0)
  const totalMes = rows.reduce((sum, row) => sum + row.precoTotalMes, 0)
  const approvedTotal = rows.filter((row) => row.status === 'aprovado').reduce((sum, row) => sum + row.precoTotalMes, 0)

  function saveRows(nextRows: SubempreiteiroDetalhadoMensal[]) {
    if (!onUpdate) return
    onUpdate({
      detalhadoMensal: nextRows,
      totalMedido: nextRows.reduce((sum, row) => sum + row.precoTotalMes, 0),
      totalAprovado: nextRows.filter((row) => row.status === 'aprovado').reduce((sum, row) => sum + row.precoTotalMes, 0),
    })
  }

  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    const precoTotal = (Number(form.qtdContratada) || 0) * (Number(form.precoUnitario) || 0)
    const precoTotalMes = (Number(form.qtdMes) || 0) * (Number(form.precoUnitario) || 0)
    saveRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        mes: form.mes || sub.periodo,
        item: form.item,
        descricao: form.descricao,
        nPreco: form.nPreco,
        unidade: form.unidade,
        qtdContratada: Number(form.qtdContratada) || 0,
        precoUnitario: Number(form.precoUnitario) || 0,
        precoTotal,
        qtdMes: Number(form.qtdMes) || 0,
        precoTotalMes,
        fisicoMes: Number(form.qtdMes) || 0,
        fisicoAcumulado: Number(form.qtdMes) || 0,
        financeiroMes: precoTotalMes,
        financeiroAcumulado: precoTotalMes,
        percentualFisico: 0,
        percentualFinanceiro: 0,
        observacoes: form.observacoes,
        origem: 'Manual',
        status: 'rascunho',
      },
    ])
    setForm({ mes: sub.periodo, item: '', descricao: '', nPreco: '', unidade: 'M', qtdContratada: 0, precoUnitario: 0, qtdMes: 0, observacoes: '' })
  }

  function approveRdoSuggestions() {
    saveRows(rows.map((row) => row.status === 'em_revisao' ? { ...row, status: 'aprovado' } : row))
  }

  function remove(id?: string) {
    if (!id) return
    saveRows(rows.filter((row) => row.id !== id))
  }

  const displayRows = rows.map((row) => ({
    id: row.id,
    mes: row.mes,
    item: row.item,
    descricao: row.descricao,
    nPreco: row.nPreco,
    unidade: row.unidade,
    qtdContratada: row.qtdContratada,
    precoUnitario: row.precoUnitario,
    precoTotal: row.precoTotal,
    qtdMes: row.qtdMes,
    precoTotalMes: row.precoTotalMes,
    fisicoAnterior: row.fisicoAnterior ?? 0,
    fisicoMes: row.fisicoMes ?? row.qtdMes,
    fisicoAcumulado: row.fisicoAcumulado ?? row.qtdMes,
    financeiroAnterior: row.financeiroAnterior ?? 0,
    financeiroMes: row.financeiroMes ?? row.precoTotalMes,
    financeiroAcumulado: row.financeiroAcumulado ?? row.precoTotalMes,
    percentualFisico: row.percentualFisico ?? 0,
    percentualFinanceiro: row.percentualFinanceiro ?? 0,
    observacoes: row.observacoes ?? '',
    origem: origemLabel(row.origem),
    status: statusLabel(row.status),
  }))

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Preço total empreiteiro" value={fmt(totalEmpreiteiro)} />
        <Metric label="Mês atual" value={fmt(totalMes)} />
        <Metric label="Aprovado" value={fmt(approvedTotal)} />
        <Metric label="Itens em revisão" value={rows.filter((row) => row.status === 'em_revisao').length} />
      </div>
      {onUpdate && rows.some((row) => row.status === 'em_revisao') && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
          <p className="text-xs text-[#a3a3a3]">Itens vindos do RDO entram em revisão antes de impactar o aprovado.</p>
          <button type="button" onClick={approveRdoSuggestions} className={btnMuted}>Aprovar itens do RDO</button>
        </div>
      )}
      {onUpdate && (
        <div className="grid gap-2 md:grid-cols-[100px_100px_1fr_110px_70px_110px_120px_90px_1fr_auto]">
          <input value={form.mes} onChange={(e) => setForm((v) => ({ ...v, mes: e.target.value }))} placeholder="Mês" className={fieldClass} />
          <input value={form.item} onChange={(e) => setForm((v) => ({ ...v, item: e.target.value }))} placeholder="Item" className={fieldClass} />
          <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição do serviço" className={fieldClass} />
          <input value={form.nPreco} onChange={(e) => setForm((v) => ({ ...v, nPreco: e.target.value }))} placeholder="N. Preço" className={fieldClass} />
          <input value={form.unidade} onChange={(e) => setForm((v) => ({ ...v, unidade: e.target.value }))} placeholder="Unid" className={fieldClass} />
          <input type="number" value={form.qtdContratada} onChange={(e) => setForm((v) => ({ ...v, qtdContratada: Number(e.target.value) }))} placeholder="Qtd contratada" className={fieldClass} />
          <input type="number" value={form.precoUnitario} onChange={(e) => setForm((v) => ({ ...v, precoUnitario: Number(e.target.value) }))} placeholder="Preço unit." className={fieldClass} />
          <input type="number" value={form.qtdMes} onChange={(e) => setForm((v) => ({ ...v, qtdMes: Number(e.target.value) }))} placeholder="Qtd mês" className={fieldClass} />
          <input value={form.observacoes} onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))} placeholder="Observações" className={fieldClass} />
          <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </div>
      )}
      <SpreadsheetTable
        rows={displayRows}
        columns={[
          { key: 'item', label: 'Item', sticky: true },
          { key: 'descricao', label: 'Descrição do Serviço' },
          { key: 'nPreco', label: 'N. Preço' },
          { key: 'unidade', label: 'Unid', align: 'center' },
          { key: 'qtdContratada', label: 'Qtd Contratada Empreiteiro', number: true },
          { key: 'precoUnitario', label: 'Preço Unit. Empreiteiro', money: true },
          { key: 'precoTotal', label: 'Preço Total Empreiteiro', money: true },
          { key: 'qtdMes', label: 'Qtd Mês', number: true },
          { key: 'precoTotalMes', label: 'Preço Total Mês', money: true },
          { key: 'fisicoAnterior', label: 'Anterior - Físico', number: true },
          { key: 'fisicoMes', label: 'Mês Atual - Físico', number: true },
          { key: 'fisicoAcumulado', label: 'Acumulado - Físico', number: true },
          { key: 'financeiroAnterior', label: 'Anterior - Financeiro', money: true },
          { key: 'financeiroMes', label: 'Mês Atual - Financeiro', money: true },
          { key: 'financeiroAcumulado', label: 'Acumulado - Financeiro', money: true },
          { key: 'percentualFisico', label: 'Med. Acumulado - Físico (%)', percent: true },
          { key: 'percentualFinanceiro', label: 'Med. Acumulado - Financeiro (%)', percent: true },
          { key: 'observacoes', label: 'Observações' },
          { key: 'origem', label: 'Origem' },
          { key: 'status', label: 'Status' },
        ]}
        totals={{ precoTotal: totalEmpreiteiro, precoTotalMes: totalMes, financeiroMes: totalMes, financeiroAcumulado: totalMes }}
        onDelete={onUpdate ? (row) => remove(String(row.id)) : undefined}
        minWidth={2200}
      />
    </div>
  )
}

function StatusBadge({ label }: { label?: string }) {
  const value = cleanLabel(label || 'Manual')
  const color = value.includes('aprov') || value.includes('PAGA')
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : value.includes('revis') || value.includes('PENDENTE')
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : value.includes('glos') || value.includes('bloque')
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : 'border-[#525252] bg-[#1f1f1f] text-[#d4d4d4]'
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${color}`}>{value}</span>
}

function PlatformParametrosTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const manualRows = sub.parametrosFinanceiros ?? []
  const [form, setForm] = useState({ mes: sub.periodo, descricao: '', valor: 0, tipo: 'ajuste' as SubempreiteiroParametroFinanceiro['tipo'] })
  const rows: SubempreiteiroParametroFinanceiro[] = [
    { id: 'calc-medicao', mes: sub.periodo, descricao: `Medição ${sub.periodo}`, valor: sub.totalMedido, tipo: 'medicao', origem: 'Calculado' },
    { id: 'calc-aprovada', mes: sub.periodo, descricao: 'Medição Aprovada', valor: sub.totalAprovado, tipo: 'aprovada', origem: 'Calculado' },
    { id: 'calc-descontos', mes: sub.periodo, descricao: 'Descontos', valor: -subDiscountTotal(sub), tipo: 'desconto', origem: 'Calculado' },
    { id: 'calc-taxa', mes: sub.periodo, descricao: 'Taxa Adm 5% (descontos)', valor: -(subDiscountTotal(sub) * 0.05), tipo: 'desconto', origem: 'Calculado' },
    { id: 'calc-fechamento', mes: sub.periodo, descricao: 'Fechamento mês', valor: subNetTotal(sub), tipo: 'fechamento', origem: 'Calculado' },
    { id: 'calc-retencao', mes: sub.periodo, descricao: `Retenção ${sub.periodo}`, valor: sub.retencao, tipo: 'retencao', origem: 'Calculado' },
    { id: 'calc-liberacao-nf', mes: sub.periodo, descricao: 'Liberação NF', valor: (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0), tipo: 'nf', origem: 'Calculado' },
    ...((sub.retencoes ?? []).map((row) => ({ id: `saldo-${row.id}`, mes: row.mes, descricao: `Saldo Retenção ${row.mes}`, valor: row.saldoFinal, tipo: 'saldo' as const, origem: (row.origem === 'Manual' || row.origem === 'RDO Sabesp' ? row.origem : row.origem ? 'Importação XLSX' : 'Calculado') as SubempreiteiroParametroFinanceiro['origem'] }))),
    ...((sub.parametros ?? []).filter((row) => row.descricao || row.valor).map((row) => ({ id: row.id, mes: row.mes, descricao: row.descricao || 'Parâmetro importado', valor: Number(row.valor) || Number(row.valorMaisDescontos) || 0, tipo: 'ajuste' as const, origem: 'Importação XLSX' as const }))),
    ...manualRows,
  ]
  const sections = [
    { title: 'Medição', kinds: ['medicao', 'aprovada'] },
    { title: 'Descontos', kinds: ['desconto', 'adiantamento', 'ajuste'] },
    { title: 'Fechamento', kinds: ['fechamento'] },
    { title: 'Retenção', kinds: ['retencao'] },
    { title: 'Liberação NF', kinds: ['nf'] },
    { title: 'Saldos', kinds: ['saldo'] },
  ].map((section) => ({ ...section, rows: rows.filter((row) => section.kinds.includes(row.tipo)) }))

  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    onUpdate({ parametrosFinanceiros: [...manualRows, { id: crypto.randomUUID(), mes: form.mes || sub.periodo, descricao: form.descricao, valor: Number(form.valor) || 0, tipo: form.tipo, origem: 'Manual' }] })
    setForm({ mes: sub.periodo, descricao: '', valor: 0, tipo: 'ajuste' })
  }

  function remove(id?: string) {
    if (!onUpdate || !id) return
    onUpdate({ parametrosFinanceiros: manualRows.filter((row) => row.id !== id) })
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Medição aprovada" value={fmt(sub.totalAprovado)} />
        <Metric label="Fechamento mês" value={fmt(subNetTotal(sub))} />
        <Metric label="Saldo retenção" value={fmt((sub.retencoes ?? []).at(-1)?.saldoFinal ?? sub.retencao)} />
      </div>
      {onUpdate && (
        <details className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-white">Adicionar lançamento manual</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-[120px,1fr,140px,170px,auto]">
            <input value={form.mes} onChange={(e) => setForm((v) => ({ ...v, mes: e.target.value }))} placeholder="Mês" className={fieldClass} />
            <input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição" className={fieldClass} />
            <input type="number" value={form.valor} onChange={(e) => setForm((v) => ({ ...v, valor: Number(e.target.value) }))} placeholder="Valor" className={fieldClass} />
            <select value={form.tipo} onChange={(e) => setForm((v) => ({ ...v, tipo: e.target.value as SubempreiteiroParametroFinanceiro['tipo'] }))} className={fieldClass}>
              <option value="adiantamento">Adiantamento</option>
              <option value="fechamento">Fechamento mês anterior</option>
              <option value="ajuste">Ajustes - extras/outros</option>
              <option value="desconto">Desconto</option>
              <option value="nf">Liberação NF</option>
              <option value="saldo">Saldo Retenção</option>
            </select>
            <button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button>
          </div>
        </details>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              <span className="text-xs font-semibold text-[#f97316]">{fmt(section.rows.reduce((sum, row) => sum + Number(row.valor || 0), 0))}</span>
            </div>
            <div className="space-y-2">
              {section.rows.length === 0 && <p className="rounded-lg border border-dashed border-[#525252] p-3 text-xs text-[#6b6b6b]">Sem lançamentos.</p>}
              {section.rows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{cleanLabel(row.descricao)}</p>
                    <p className="mt-0.5 text-[11px] text-[#a3a3a3]">{row.mes} · {cleanLabel(row.origem)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${Number(row.valor) < 0 ? 'text-red-300' : 'text-[#f5f5f5]'}`}>{fmt(Number(row.valor) || 0)}</span>
                    {onUpdate && row.origem === 'Manual' && <button onClick={() => remove(row.id)} className="text-red-300 hover:text-red-200"><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function PlatformRetencaoTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const legacyRows: SubempreiteiroRetencaoDetalhada[] = (sub.retencaoItens ?? []).map((item) => ({
    id: item.id ?? crypto.randomUUID(), mes: item.mes ?? sub.periodo, item: item.serviceId ?? item.nPreco, descricao: item.descricao, nPreco: item.nPrecoSabesp || item.nPreco, unidade: item.unidade, qtd: item.qtd, precoTotal: itemTotal(item), fisicoMes: item.qtd, fisicoAcumulado: item.qtd, financeiroMes: itemTotal(item), financeiroAcumulado: itemTotal(item), retencaoPercentual: item.retencaoPercentual ?? 0, observacoes: item.retencaoObservacao ?? '', origem: normalizeSheetOrigin(item.origem),
  }))
  const rows = (sub.retencaoDetalhada ?? []).length > 0 ? sub.retencaoDetalhada ?? [] : legacyRows
  const [form, setForm] = useState({ mes: sub.periodo, item: '', nPreco: '', descricao: '', unidade: 'M', qtd: 0, precoTotal: 0, retencaoPercentual: 60, observacoes: 'Retenção 60% (redes) (m)' })
  const totalRetencao = rows.reduce((sum, item) => sum + (Number(item.precoTotal) || 0) * ((Number(item.retencaoPercentual) || 0) / 100), 0)
  const ruleTotals = ['Retenção 60% (redes) (m)', 'Retenção 60% (ligações) (und.)', 'Retenção 100% (itens retidos pela Sabesp)'].map((rule) => ({
    rule,
    total: rows.filter((row) => cleanLabel(row.observacoes).includes(rule.replace('Retenção ', '').split(' ')[0]) || cleanLabel(row.observacoes) === rule).reduce((sum, row) => sum + row.precoTotal * ((row.retencaoPercentual ?? 0) / 100), 0),
  }))

  function saveRows(nextRows: SubempreiteiroRetencaoDetalhada[]) {
    if (!onUpdate) return
    onUpdate({ retencaoDetalhada: nextRows, retencao: nextRows.reduce((sum, item) => sum + item.precoTotal * ((item.retencaoPercentual ?? 0) / 100), 0) })
  }
  function addManual() {
    if (!onUpdate || !form.descricao.trim()) return
    saveRows([...rows, { id: crypto.randomUUID(), mes: form.mes, item: form.item, nPreco: form.nPreco, descricao: form.descricao, unidade: form.unidade, qtd: Number(form.qtd) || 0, precoTotal: Number(form.precoTotal) || 0, fisicoMes: Number(form.qtd) || 0, fisicoAcumulado: Number(form.qtd) || 0, financeiroMes: Number(form.precoTotal) || 0, financeiroAcumulado: Number(form.precoTotal) || 0, percentualFisico: 0, percentualFinanceiro: 0, origem: 'Manual', retencaoPercentual: Number(form.retencaoPercentual) || 0, observacoes: form.observacoes }])
    setForm({ mes: sub.periodo, item: '', nPreco: '', descricao: '', unidade: 'M', qtd: 0, precoTotal: 0, retencaoPercentual: 60, observacoes: 'Retenção 60% (redes) (m)' })
  }

  return (
    <div className="space-y-4">
      <ReadOnlyAggregateNotice active={!onUpdate} />
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Base de retenção" value={fmt(rows.reduce((sum, item) => sum + item.precoTotal, 0))} />
        <Metric label="Total retido" value={fmt(totalRetencao)} />
        <Metric label="Itens" value={rows.length} />
        <Metric label="Mês" value={sub.periodo} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">{ruleTotals.map((item) => <div key={item.rule} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3"><p className="text-xs text-[#a3a3a3]">{item.rule}</p><p className="mt-1 text-lg font-semibold text-white">{fmt(item.total)}</p></div>)}</div>
      {onUpdate && <details className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3"><summary className="cursor-pointer text-sm font-semibold text-white">Adicionar item de retenção</summary><div className="mt-3 grid gap-2 md:grid-cols-[100px_100px_120px_1fr_70px_90px_130px_100px_180px_auto]"><input value={form.mes} onChange={(e) => setForm((v) => ({ ...v, mes: e.target.value }))} placeholder="Mês" className={fieldClass} /><input value={form.item} onChange={(e) => setForm((v) => ({ ...v, item: e.target.value }))} placeholder="Item" className={fieldClass} /><input value={form.nPreco} onChange={(e) => setForm((v) => ({ ...v, nPreco: e.target.value }))} placeholder="N. Preço" className={fieldClass} /><input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição" className={fieldClass} /><input value={form.unidade} onChange={(e) => setForm((v) => ({ ...v, unidade: e.target.value }))} placeholder="Un." className={fieldClass} /><input type="number" value={form.qtd} onChange={(e) => setForm((v) => ({ ...v, qtd: Number(e.target.value) }))} placeholder="Qtd" className={fieldClass} /><input type="number" value={form.precoTotal} onChange={(e) => setForm((v) => ({ ...v, precoTotal: Number(e.target.value) }))} placeholder="Preço total" className={fieldClass} /><input type="number" value={form.retencaoPercentual} onChange={(e) => setForm((v) => ({ ...v, retencaoPercentual: Number(e.target.value) }))} placeholder="% Ret." className={fieldClass} /><input value={form.observacoes} onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))} placeholder="Observações" className={fieldClass} /><button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button></div></details>}
      <div className="space-y-2">{rows.map((row) => <div key={row.id} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{cleanLabel(row.descricao)}</p><p className="mt-1 text-xs text-[#a3a3a3]">Item {row.item || '-'} · N. Preço {row.nPreco || '-'} · {row.unidade}</p></div><div className="text-right"><p className="text-sm font-semibold text-white">{fmt(row.precoTotal)}</p><p className="text-xs text-[#f97316]">Retido {fmt(row.precoTotal * ((row.retencaoPercentual ?? 0) / 100))}</p></div></div><div className="mt-3 grid gap-2 text-xs text-[#d4d4d4] sm:grid-cols-4"><span>Qtd: {fmtNum(row.qtd)}</span><span>Físico mês: {fmtNum(row.fisicoMes ?? row.qtd)}</span><span>Financeiro mês: {fmt(row.financeiroMes ?? row.precoTotal)}</span><StatusBadge label={row.origem} /></div><details className="mt-3 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-2"><summary className="cursor-pointer text-xs text-[#a3a3a3]">Acumulados e observações</summary><div className="mt-2 grid gap-2 text-xs text-[#d4d4d4] sm:grid-cols-4"><span>Físico anterior: {fmtNum(row.fisicoAnterior ?? 0)}</span><span>Físico acumulado: {fmtNum(row.fisicoAcumulado ?? row.qtd)}</span><span>Financeiro anterior: {fmt(row.financeiroAnterior ?? 0)}</span><span>Financeiro acumulado: {fmt(row.financeiroAcumulado ?? row.precoTotal)}</span><span>% físico: {formatPercent(row.percentualFisico)}</span><span>% financeiro: {formatPercent(row.percentualFinanceiro)}</span><span className="sm:col-span-2">Observações: {cleanLabel(row.observacoes) || '-'}</span></div></details></div>)}</div>
    </div>
  )
}

function PlatformNfsTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const [form, setForm] = useState({ nf: '', fornecedor: sub.nome, observacao: '', valorNf: 0, valorPago: 0, dataEmissao: '', vencimento: '', competencia: sub.periodo, status: 'PENDENTE' as SubempreiteiroNotaFiscal['status'], dataPagamento: '' })
  const totalNf = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorNf, 0)
  const totalPago = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0)
  function addManual() {
    if (!onUpdate || !form.nf.trim()) return
    onUpdate({ nfs: [...(sub.nfs ?? []), { id: crypto.randomUUID(), numero: form.nf, fornecedor: form.fornecedor || sub.nome, observacao: form.observacao, valorNf: Number(form.valorNf) || 0, valorPago: Number(form.valorPago) || 0, dataEmissao: form.dataEmissao, vencimento: form.vencimento, competencia: form.competencia || sub.periodo, status: form.status, dataPagamento: form.dataPagamento, origem: 'Manual' }] })
    setForm({ nf: '', fornecedor: sub.nome, observacao: '', valorNf: 0, valorPago: 0, dataEmissao: '', vencimento: '', competencia: sub.periodo, status: 'PENDENTE', dataPagamento: '' })
  }
  function remove(id?: string) { if (onUpdate && id) onUpdate({ nfs: (sub.nfs ?? []).filter((nf) => nf.id !== id) }) }
  return <div className="space-y-4"><ReadOnlyAggregateNotice active={!onUpdate} /><div className="grid gap-3 md:grid-cols-4"><Metric label="Valor NF" value={fmt(totalNf)} /><Metric label="Valor pago" value={fmt(totalPago)} /><Metric label="Saldo em aberto" value={fmt(totalNf - totalPago)} /><Metric label="NFs pagas" value={(sub.nfs ?? []).filter((nf) => nf.status === 'PAGA').length} /></div>{onUpdate && <details className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3"><summary className="cursor-pointer text-sm font-semibold text-white">Adicionar nota fiscal</summary><div className="mt-3 grid gap-2 md:grid-cols-[90px,1fr,1fr,120px,120px,130px,130px,120px,120px,130px,auto]"><input value={form.nf} onChange={(e) => setForm((v) => ({ ...v, nf: e.target.value }))} placeholder="NF" className={fieldClass} /><input value={form.fornecedor} onChange={(e) => setForm((v) => ({ ...v, fornecedor: e.target.value }))} placeholder="Fornecedor" className={fieldClass} /><input value={form.observacao} onChange={(e) => setForm((v) => ({ ...v, observacao: e.target.value }))} placeholder="Obs" className={fieldClass} /><input type="number" value={form.valorNf} onChange={(e) => setForm((v) => ({ ...v, valorNf: Number(e.target.value) }))} placeholder="Valor NF" className={fieldClass} /><input type="number" value={form.valorPago} onChange={(e) => setForm((v) => ({ ...v, valorPago: Number(e.target.value) }))} placeholder="Valor PG" className={fieldClass} /><input type="date" value={form.dataEmissao} onChange={(e) => setForm((v) => ({ ...v, dataEmissao: e.target.value }))} className={fieldClass} /><input type="date" value={form.vencimento} onChange={(e) => setForm((v) => ({ ...v, vencimento: e.target.value }))} className={fieldClass} /><input value={form.competencia} onChange={(e) => setForm((v) => ({ ...v, competencia: e.target.value }))} placeholder="Competência" className={fieldClass} /><select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as SubempreiteiroNotaFiscal['status'] }))} className={fieldClass}><option value="PENDENTE">PENDENTE</option><option value="ENVIADA">ENVIADA</option><option value="APROVADA">APROVADA</option><option value="PAGA">PAGA</option><option value="GLOSADA">GLOSADA</option></select><input type="date" value={form.dataPagamento} onChange={(e) => setForm((v) => ({ ...v, dataPagamento: e.target.value }))} className={fieldClass} /><button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button></div></details>}<div className="space-y-2">{(sub.nfs ?? []).map((nf, index) => <div key={nf.id} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">#{index + 1} · NF {nf.numero}</p><p className="mt-1 text-xs text-[#a3a3a3]">{nf.fornecedor} · {nf.competencia}</p></div><div className="flex items-center gap-2"><StatusBadge label={nf.status} />{onUpdate && <button onClick={() => remove(nf.id)} className="text-red-300 hover:text-red-200"><Trash2 size={14} /></button>}</div></div><div className="mt-3 grid gap-2 text-xs text-[#d4d4d4] sm:grid-cols-4"><span>Valor NF: {fmt(nf.valorNf)}</span><span>Valor PG: {fmt(nf.valorPago)}</span><span>Emissão: {nf.dataEmissao || '-'}</span><span>Vencimento: {nf.vencimento || '-'}</span><span>Pagamento: {nf.dataPagamento || '-'}</span><span className="sm:col-span-3">Obs: {nf.observacao || '-'}</span></div></div>)}</div></div>
}

function PlatformDetalhadoTab({ sub, onUpdate }: { sub: Subempreiteiro; onUpdate?: (patch: Partial<Subempreiteiro>) => void }) {
  const rows = rdoDetailedRows(sub)
  const [form, setForm] = useState({ mes: sub.periodo, item: '', descricao: '', nPreco: '', unidade: 'M', qtdContratada: 0, precoUnitario: 0, qtdMes: 0, observacoes: '' })
  const totalMes = rows.reduce((sum, row) => sum + row.precoTotalMes, 0)
  const approvedTotal = rows.filter((row) => row.status === 'aprovado').reduce((sum, row) => sum + row.precoTotalMes, 0)
  function saveRows(nextRows: SubempreiteiroDetalhadoMensal[]) { if (onUpdate) onUpdate({ detalhadoMensal: nextRows, totalMedido: nextRows.reduce((sum, row) => sum + row.precoTotalMes, 0), totalAprovado: nextRows.filter((row) => row.status === 'aprovado').reduce((sum, row) => sum + row.precoTotalMes, 0) }) }
  function remove(id?: string) { if (onUpdate && id) saveRows(rows.filter((row) => row.id !== id)) }
  function addManual() { if (!onUpdate || !form.descricao.trim()) return; const precoTotal = Number(form.qtdContratada) * Number(form.precoUnitario); const precoTotalMes = Number(form.qtdMes) * Number(form.precoUnitario); saveRows([...rows, { id: crypto.randomUUID(), mes: form.mes, item: form.item, descricao: form.descricao, nPreco: form.nPreco, unidade: form.unidade, qtdContratada: Number(form.qtdContratada) || 0, precoUnitario: Number(form.precoUnitario) || 0, precoTotal, qtdMes: Number(form.qtdMes) || 0, precoTotalMes, fisicoMes: Number(form.qtdMes) || 0, fisicoAcumulado: Number(form.qtdMes) || 0, financeiroMes: precoTotalMes, financeiroAcumulado: precoTotalMes, percentualFisico: 0, percentualFinanceiro: 0, observacoes: form.observacoes, origem: 'Manual', status: 'rascunho' }]); setForm({ mes: sub.periodo, item: '', descricao: '', nPreco: '', unidade: 'M', qtdContratada: 0, precoUnitario: 0, qtdMes: 0, observacoes: '' }) }
  return <div className="space-y-4"><ReadOnlyAggregateNotice active={!onUpdate} /><div className="grid gap-3 md:grid-cols-4"><Metric label="Preço total empreiteiro" value={fmt(rows.reduce((sum, row) => sum + row.precoTotal, 0))} /><Metric label="Mês atual" value={fmt(totalMes)} /><Metric label="Aprovado" value={fmt(approvedTotal)} /><Metric label="Itens em revisão" value={rows.filter((row) => row.status === 'em_revisao').length} /></div>{onUpdate && rows.some((row) => row.status === 'em_revisao') && <div className="flex items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#1f1f1f] p-3"><p className="text-xs text-[#a3a3a3]">Itens vindos do RDO entram em revisão antes de impactar o aprovado.</p><button type="button" onClick={() => saveRows(rows.map((row) => row.status === 'em_revisao' ? { ...row, status: 'aprovado' } : row))} className={btnMuted}>Aprovar itens do RDO</button></div>}{onUpdate && <details className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-3"><summary className="cursor-pointer text-sm font-semibold text-white">Adicionar item manual</summary><div className="mt-3 grid gap-2 md:grid-cols-[100px_100px_1fr_110px_70px_110px_120px_90px_1fr_auto]"><input value={form.mes} onChange={(e) => setForm((v) => ({ ...v, mes: e.target.value }))} placeholder="Mês" className={fieldClass} /><input value={form.item} onChange={(e) => setForm((v) => ({ ...v, item: e.target.value }))} placeholder="Item" className={fieldClass} /><input value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} placeholder="Descrição" className={fieldClass} /><input value={form.nPreco} onChange={(e) => setForm((v) => ({ ...v, nPreco: e.target.value }))} placeholder="N. Preço" className={fieldClass} /><input value={form.unidade} onChange={(e) => setForm((v) => ({ ...v, unidade: e.target.value }))} placeholder="Unid" className={fieldClass} /><input type="number" value={form.qtdContratada} onChange={(e) => setForm((v) => ({ ...v, qtdContratada: Number(e.target.value) }))} placeholder="Qtd contratada" className={fieldClass} /><input type="number" value={form.precoUnitario} onChange={(e) => setForm((v) => ({ ...v, precoUnitario: Number(e.target.value) }))} placeholder="Preço unit." className={fieldClass} /><input type="number" value={form.qtdMes} onChange={(e) => setForm((v) => ({ ...v, qtdMes: Number(e.target.value) }))} placeholder="Qtd mês" className={fieldClass} /><input value={form.observacoes} onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))} placeholder="Observações" className={fieldClass} /><button onClick={addManual} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Adicionar</button></div></details>}<div className="space-y-2">{rows.map((row) => <div key={row.id} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{cleanLabel(row.descricao)}</p><p className="mt-1 text-xs text-[#a3a3a3]">Item {row.item || '-'} · N. Preço {row.nPreco || '-'} · {row.unidade}</p></div><div className="flex items-center gap-2"><StatusBadge label={statusLabel(row.status)} /><StatusBadge label={row.origem} />{onUpdate && <button onClick={() => remove(row.id)} className="text-red-300 hover:text-red-200"><Trash2 size={14} /></button>}</div></div><div className="mt-3 grid gap-2 text-xs text-[#d4d4d4] sm:grid-cols-5"><span>Qtd contratada: {fmtNum(row.qtdContratada)}</span><span>Preço unit.: {fmt(row.precoUnitario)}</span><span>Total empreiteiro: {fmt(row.precoTotal)}</span><span>Qtd mês: {fmtNum(row.qtdMes)}</span><span>Total mês: {fmt(row.precoTotalMes)}</span></div><details className="mt-3 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-2"><summary className="cursor-pointer text-xs text-[#a3a3a3]">Acumulados e observações</summary><div className="mt-2 grid gap-2 text-xs text-[#d4d4d4] sm:grid-cols-4"><span>Físico anterior: {fmtNum(row.fisicoAnterior ?? 0)}</span><span>Físico mês: {fmtNum(row.fisicoMes ?? row.qtdMes)}</span><span>Físico acumulado: {fmtNum(row.fisicoAcumulado ?? row.qtdMes)}</span><span>Financeiro anterior: {fmt(row.financeiroAnterior ?? 0)}</span><span>Financeiro mês: {fmt(row.financeiroMes ?? row.precoTotalMes)}</span><span>Financeiro acumulado: {fmt(row.financeiroAcumulado ?? row.precoTotalMes)}</span><span>% físico: {formatPercent(row.percentualFisico)}</span><span>% financeiro: {formatPercent(row.percentualFinanceiro)}</span><span className="sm:col-span-4">Observações: {cleanLabel(row.observacoes) || '-'}</span></div></details></div>)}</div></div>
}

void ParametrosFinanceirosTab
void ItensTab
void RetencaoDetalhadaTab
void NfsTab
void DetalhadoTab
void ResumoTab
void RdosTab
void MeasurementSourcesTab
void DescontosECustosTab
void AuditoriaTab

function FechamentoTab({ sub }: { sub: Subempreiteiro }) {
  const descontos = subDiscountTotal(sub)
  const nfPago = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0)
  const manualParams = sub.parametrosFinanceiros ?? []
  const byType = (type: SubempreiteiroParametroFinanceiro['tipo']) =>
    manualParams.filter((row) => row.tipo === type).reduce((sum, row) => sum + Number(row.valor || 0), 0)
  const medicaoAnterior = (sub.detalhadoMensal ?? []).filter((row) => row.mes !== sub.periodo).reduce((sum, row) => sum + Number(row.financeiroMes || row.precoTotalMes || 0), 0)
  const taxaAdministracaoPercentual = Math.max(0, byType('desconto') || 5)
  const taxaAdministracaoValor = descontos * (taxaAdministracaoPercentual / 100)
  const adiantamento = byType('adiantamento')
  const fechamentoAnterior = byType('fechamento')
  const ajustesExtras = byType('ajuste')
  const locacaoCanteiro = costTotal(costRowsFromSub(sub, 'locEquipamentos'))
  const retencaoMes = sub.retencao
  const retencoesOrdenadas = [...(sub.retencoes ?? [])].sort((a, b) => a.mes.localeCompare(b.mes))
  const ultimos3 = retencoesOrdenadas.slice(-3)
  const saldoRetencao = retencoesOrdenadas.at(-1)?.saldoFinal ?? sub.retencao
  const totalRetido = retencoesOrdenadas.reduce((sum, row) => sum + Number(row.valorRetido || 0), 0) || retencaoMes
  const fechamentoMes = sub.totalAprovado - descontos - taxaAdministracaoValor - adiantamento + fechamentoAnterior + ajustesExtras - locacaoCanteiro - retencaoMes + nfPago
  const nfStatus = (sub.nfs ?? []).length === 0
    ? 'Sem NF'
    : (sub.nfs ?? []).every((nf) => nf.status === 'PAGA')
      ? 'Liberada/Paga'
      : (sub.nfs ?? []).some((nf) => nf.status === 'APROVADA' || nf.status === 'ENVIADA')
        ? 'Em liberacao'
        : 'Pendente'
  const rows = [
    { item: 'Medicao do mes anterior', valor: medicaoAnterior },
    { item: 'Medicao Aprovada', valor: sub.totalAprovado },
    { item: 'Descontos', valor: -descontos },
    { item: `Taxa de Administracao ${formatPercent(taxaAdministracaoPercentual)} sobre descontos`, valor: -taxaAdministracaoValor },
    { item: 'Adiantamento', valor: -adiantamento },
    { item: 'Fechamento mes anterior', valor: fechamentoAnterior },
    { item: 'Ajustes - extras/outros', valor: ajustesExtras },
    { item: 'Locacao Canteiro', valor: -locacaoCanteiro },
    { item: 'Fechamento mes', valor: fechamentoMes },
    { item: 'Retencao mes', valor: -retencaoMes },
    { item: 'Status da Liberacao da NF', valor: nfStatus },
    { item: 'Saldo Retencao dos ultimos 3 meses', valor: ultimos3.reduce((sum, row) => sum + Number(row.saldoFinal || 0), 0) },
    { item: 'Saldo Final Retencao', valor: saldoRetencao },
    { item: 'Total Retido', valor: totalRetido },
    ...manualParams.filter((row) => !['desconto', 'adiantamento', 'fechamento', 'ajuste'].includes(row.tipo)).map((row) => ({
      item: row.descricao,
      valor: row.valor,
    })),
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Empreiteiro" value={sub.nome} />
        <Metric label="Núcleo" value={sub.nucleo || '-'} />
        <Metric label="Periodo" value={sub.periodo} />
        <Metric label="Fechamento mes" value={fmt(fechamentoMes)} />
      </div>
      <DataTable rows={rows} columns={['item', 'valor']} moneyCols={['valor']} />
    </div>
  )
}

function isCostTab(tab: TabId): tab is CostKey {
  return Object.prototype.hasOwnProperty.call(costConfigs, tab)
}

type SheetColumn = {
  key: string
  label: string
  money?: boolean
  number?: boolean
  percent?: boolean
  sticky?: boolean
  align?: 'left' | 'right' | 'center'
}

function SpreadsheetTable({
  rows,
  columns,
  totals,
  onEdit,
  onDelete,
  minWidth = 980,
}: {
  rows: Array<Record<string, unknown>>
  columns: SheetColumn[]
  totals?: Record<string, unknown>
  onEdit?: (row: Record<string, unknown>) => void
  onDelete?: (row: Record<string, unknown>) => void
  minWidth?: number
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#525252] p-6 text-sm text-[#6b6b6b]">Sem registros ainda.</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#525252] bg-[#2c2c2c]">
      <table className="w-full border-collapse text-xs text-[#f5f5f5]" style={{ minWidth }}>
        <thead>
          <tr className="bg-[#1f1f1f] text-[#a3a3a3]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`border-r border-[#525252] px-3 py-2 text-left font-semibold uppercase tracking-wide ${column.sticky ? 'sticky left-0 z-10 bg-[#1f1f1f]' : ''}`}
              >
                {cleanLabel(column.label)}
              </th>
            ))}
            {(onEdit || onDelete) && <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-[#a3a3a3]">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className={`border-t border-[#3d3d3d] ${index % 2 === 0 ? 'bg-[#2c2c2c]' : 'bg-[#262626]'} hover:bg-[#333333]`}>
              {columns.map((column) => {
                const raw = row[column.key]
                const value = column.money
                  ? fmt(Number(raw) || 0)
                  : column.percent
                    ? formatPercent(Number(raw) || 0)
                    : column.number
                      ? fmtNum(Number(raw) || 0)
                      : String(raw ?? '')
                const align = column.align ?? (column.money || column.number || column.percent ? 'right' : 'left')
                return (
                  <td
                    key={column.key}
                    className={`border-r border-[#3d3d3d] px-3 py-2 ${column.sticky ? 'sticky left-0 bg-inherit font-medium text-white' : ''}`}
                    style={{ textAlign: align }}
                  >
                    {column.key === 'origem' || column.key === 'status' ? (
                      <span className="inline-flex rounded-full border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-[10px] font-medium text-[#d4d4d4]">
                        {cleanLabel(String(value))}
                      </span>
                    ) : cleanLabel(String(value))}
                  </td>
                )
              })}
              {(onEdit || onDelete) && (
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {onEdit && <button type="button" onClick={() => onEdit(row)} className="rounded border border-[#525252] bg-[#3a3a3a] px-2 py-1 text-[11px] text-[#f5f5f5] hover:border-[#f97316]">Editar</button>}
                    {onDelete && <button type="button" onClick={() => onDelete(row)} className="rounded border border-red-500/40 bg-[#3a3a3a] px-2 py-1 text-[11px] text-red-300 hover:border-red-300">Excluir</button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="border-t border-[#525252] bg-[#1f1f1f] font-bold text-white">
              {columns.map((column, index) => {
                const raw = totals[column.key]
                const value = index === 0 && raw == null
                  ? 'TOTAL'
                  : column.money
                    ? fmt(Number(raw) || 0)
                    : column.percent
                      ? formatPercent(Number(raw) || 0)
                      : column.number
                        ? fmtNum(Number(raw) || 0)
                        : String(raw ?? '')
                return <td key={column.key} className="border-r border-[#525252] px-3 py-2 text-right">{cleanLabel(String(value))}</td>
              })}
              {(onEdit || onDelete) && <td className="border-r border-[#525252]" />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function EditableDataTable({
  rows,
  columns,
  moneyCols = [],
  onEdit,
  onDelete,
}: {
  rows: object[]
  columns: string[]
  moneyCols?: string[]
  onEdit?: (row: object) => void
  onDelete?: (row: object) => void
}) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-[#525252] p-6 text-sm text-[#6b6b6b]">Sem registros ainda.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-[#525252]">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-[#1f1f1f] text-left text-xs uppercase text-[#a3a3a3]">
          <tr>
            {columns.map((column) => <th key={column} className="p-2">{column}</th>)}
            {(onEdit || onDelete) && <th className="p-2 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const record = row as Record<string, unknown>
            return (
              <tr key={String(record.id ?? index)} className="border-t border-[#3d3d3d] text-[#f5f5f5]">
                {columns.map((column) => {
                  const value = record[column]
                  return <td key={column} className="p-2">{moneyCols.includes(column) ? fmt(Number(value) || 0) : String(value ?? '')}</td>
                })}
                {(onEdit || onDelete) && (
                  <td className="p-2">
                    <div className="flex justify-end gap-2">
                      {onEdit && <button type="button" onClick={() => onEdit(row)} className="rounded border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4] hover:border-[#f97316] hover:text-white">Editar</button>}
                      {onDelete && <button type="button" onClick={() => onDelete(row)} className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:border-red-300 hover:text-red-200">Excluir</button>}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DataTable({ rows, columns, moneyCols = [] }: { rows: object[]; columns: string[]; moneyCols?: string[] }) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-[#525252] p-6 text-sm text-[#6b6b6b]">Sem registros ainda.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-[#525252]">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-[#1f1f1f] text-left text-xs uppercase text-[#a3a3a3]"><tr>{columns.map((column) => <th key={column} className="p-2">{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => {
            const record = row as Record<string, unknown>
            return (
            <tr key={String(record.id ?? index)} className="border-t border-[#3d3d3d] text-[#f5f5f5]">
              {columns.map((column) => {
                const value = record[column]
                return <td key={column} className="p-2">{moneyCols.includes(column) && typeof value === 'number' ? fmt(Number(value) || 0) : String(value ?? '')}</td>
              })}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

void PlatformDetalhadoTab

export function SubempreiteirosPanel() {
  const { getActiveBoletim, addSubempreiteiro, updateSubempreiteiro, removeSubempreiteiro, syncRdoSabespSubempreiteiros } = useMedicaoBillingStore()
  const {
    contractors,
    measurementSources,
    load: loadContractors,
    resolveRdoContractor,
  } = useContractorStore()
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('fechamento')
  const [selectedId, setSelectedId] = useState('__all')
  const [contractorFilter, setContractorFilter] = useState('all')
  const [nucleoFilter, setNucleoFilter] = useState('all')
  const [lastSyncMessage, setLastSyncMessage] = useState('')
  const boletim = getActiveBoletim()

  useEffect(() => {
    void loadContractors()
  }, [loadContractors])

  const rdoRows = useMemo(() => {
    const sourceRows = measurementSources
      .filter((source) => source.source_kind === 'rdo_sabesp' && !source.deleted_at)
      .flatMap((source) => {
        const contractor = contractors.find((item) => item.id === source.contractor_id && !item.deleted_at)
        const nucleo = source.nucleo || ''
        if (!contractor || !isKnownNucleo(nucleo)) return []
        const payload = source.source_payload ?? {}
        const evidence = typeof payload.planilha_foto_path === 'string' ? payload.planilha_foto_path : ''
        const hasEvidence = Boolean(evidence || payload.assinatura_empreiteira_presente || payload.assinatura_consorcio_presente)
        return [{
          contractorId: contractor.id,
          contractorName: contractor.name,
          nucleo,
          periodo: monthFromDate(source.source_date),
          rdoId: source.rdo_id || source.id,
          rdoDate: String(source.source_date || ''),
          serviceId: source.source_uid || `${source.service_code || 'sem-codigo'}-${source.id}`,
          nPreco: source.service_code || '',
          descricao: source.service_description,
          unidade: source.unit || '',
          qtd: Number(source.quantity) || 0,
          ruaBeco: typeof payload.rua_beco === 'string' ? payload.rua_beco : '',
          evidencia: evidence,
          evidenceMissing: !hasEvidence,
          qualityBlocked: source.quality_status === 'blocked_by_nc' || source.quality_status === 'glosa_review',
        }]
      })
    const rdosSyncedRemotely = new Set(sourceRows.map((row) => row.rdoId))
    const localRows = readLocalRdoSabesp().filter((rdo) => rdo.status !== 'draft' && !rdosSyncedRemotely.has(rdo.id)).flatMap((rdo) => {
      const contractor = resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
      const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
      if (!contractor || !isKnownNucleo(nucleo)) return []
      const qualityBlocked = Boolean(rdo.qualidade && !rdo.qualidade.ordem_servico && !rdo.qualidade.bandeirola && !rdo.qualidade.projeto)
      const evidence = Array.isArray(rdo.photo_paths) && rdo.photo_paths.length > 0
        ? rdo.photo_paths[0]
        : rdo.planilha_foto_path || rdo.planilha_foto_url || rdo.assinatura_empreiteira_url || rdo.assinatura_consorcio_url || ''
      const evidenceMissing = !rdoHasAuditEvidence(rdo)
      return getRdoSabespExecutedServices(rdo).map((service) => ({
        contractorId: contractor.id,
        contractorName: contractor.name,
        nucleo,
        periodo: monthFromDate(rdo.report_date),
        rdoId: rdo.id,
        rdoDate: String(rdo.report_date || ''),
        serviceId: service.service_id,
        nPreco: service.service_id.split('-')[0] || '',
        descricao: service.services_catalog.name,
        unidade: service.unit || service.services_catalog.unit || '',
        qtd: service.quantity,
        ruaBeco: rdo.rua_beco || '',
        evidencia: evidence,
        evidenceMissing,
        qualityBlocked,
      }))
    })
    return [...sourceRows, ...localRows]
  }, [contractors, measurementSources, resolveRdoContractor])

  const pendingRdoCount = useMemo(() => {
    return readLocalRdoSabesp().filter((rdo) => {
      if (rdo.status === 'draft') return false
      const contractor = resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
      const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
      return !contractor || !isKnownNucleo(nucleo)
    }).length
  }, [resolveRdoContractor])
  void pendingRdoCount

  useEffect(() => {
    if (rdoRows.length > 0) syncRdoSabespSubempreiteiros(rdoRows)
  }, [rdoRows, syncRdoSabespSubempreiteiros])

  function handleSyncRdos() {
    syncRdoSabespSubempreiteiros(rdoRows)
    if (rdoRows.length === 0) {
      setLastSyncMessage('Nenhum RDO Sabesp apto para sincronizar. Confira se ele está finalizado, com empreiteiro, núcleo e serviços executados.')
      return
    }
    setLastSyncMessage(`${rdoRows.length} item(ns) de RDO sincronizado(s) por empreiteiro, núcleo e mês.`)
  }

  const subs = useMemo(() => boletim?.subempreiteiros ?? [], [boletim?.subempreiteiros])
  const rdoFilterRefs = useMemo(() => {
    return readLocalRdoSabesp().filter((rdo) => rdo.status !== 'draft').map((rdo) => ({
      contractor: resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })?.name ?? '',
      nucleo: getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro),
    }))
  }, [resolveRdoContractor])
  const contractorOptions = useMemo(() => Array.from(new Set([
    ...contractors.filter((item) => !item.deleted_at).map((item) => item.name),
    ...subs.map((sub) => sub.nome),
    ...rdoFilterRefs.map((item) => item.contractor),
  ].filter(Boolean))).sort(), [contractors, rdoFilterRefs, subs])
  const nucleoOptions = useMemo(() => Array.from(new Set([
    ...subs.map((sub) => sub.nucleo),
    ...rdoFilterRefs.map((item) => item.nucleo).filter(isKnownNucleo),
  ].filter(Boolean))).sort(), [rdoFilterRefs, subs])
  const filteredSubs = useMemo(() => subs.filter((sub) => {
    if (contractorFilter !== 'all' && sub.nome !== contractorFilter) return false
    if (nucleoFilter !== 'all' && sub.nucleo !== nucleoFilter) return false
    return true
  }), [contractorFilter, nucleoFilter, subs])
  const aggregateSub = useMemo<Subempreiteiro>(() => ({
    id: '__all',
    nome: 'Todos os empreiteiros',
    nucleo: nucleoFilter === 'all' ? 'Todos os núcleos' : nucleoFilter,
    periodo: boletim?.periodo ?? '',
    contractorId: null,
    itens: filteredSubs.flatMap((sub) => sub.itens.map((item) => ({
      ...item,
      contractorId: item.contractorId ?? sub.contractorId ?? null,
      nucleo: item.nucleo ?? sub.nucleo,
    }))),
    memoria: filteredSubs.flatMap((sub) => sub.memoria ?? []),
    parametros: filteredSubs.flatMap((sub) => sub.parametros ?? []),
    descontos: filteredSubs.flatMap((sub) => sub.descontos ?? []),
    rh: filteredSubs.flatMap((sub) => sub.rh ?? []),
    agregados: filteredSubs.flatMap((sub) => sub.agregados ?? []),
    materiaisFerramentas: filteredSubs.flatMap((sub) => sub.materiaisFerramentas ?? []),
    materiaisEpi: filteredSubs.flatMap((sub) => sub.materiaisEpi ?? []),
    maquinas: filteredSubs.flatMap((sub) => sub.maquinas ?? []),
    servicos: filteredSubs.flatMap((sub) => sub.servicos ?? []),
    veiculos: filteredSubs.flatMap((sub) => sub.veiculos ?? []),
    combustivel: filteredSubs.flatMap((sub) => sub.combustivel ?? []),
    abastecimentoComboio: filteredSubs.flatMap((sub) => sub.abastecimentoComboio ?? []),
    locEquipamentos: filteredSubs.flatMap((sub) => sub.locEquipamentos ?? []),
    epis: filteredSubs.flatMap((sub) => sub.epis ?? []),
    retencaoItens: filteredSubs.flatMap((sub) => sub.retencaoItens ?? []),
    parametrosFinanceiros: filteredSubs.flatMap((sub) => sub.parametrosFinanceiros ?? []),
    retencaoDetalhada: filteredSubs.flatMap((sub) => sub.retencaoDetalhada ?? []),
    detalhadoMensal: filteredSubs.flatMap((sub) => rdoDetailedRows(sub)),
    nfs: filteredSubs.flatMap((sub) => sub.nfs ?? []),
    retencoes: filteredSubs.flatMap((sub) => sub.retencoes ?? []),
    totalMedido: filteredSubs.reduce((sum, sub) => sum + sub.totalMedido, 0),
    totalAprovado: filteredSubs.reduce((sum, sub) => sum + sub.totalAprovado, 0),
    retencao: filteredSubs.reduce((sum, sub) => sum + sub.retencao, 0),
  }), [boletim?.periodo, filteredSubs, nucleoFilter])
  const effectiveSelectedId = selectedId !== '__all' && filteredSubs.some((sub) => sub.id === selectedId) ? selectedId : '__all'
  const selected = effectiveSelectedId === '__all' ? aggregateSub : filteredSubs.find((sub) => sub.id === effectiveSelectedId) ?? null

  if (!boletim) return <div className="p-8 text-center text-sm text-[#6b6b6b]">Nenhum boletim ativo.</div>

  const totalAprovado = filteredSubs.reduce((sum, sub) => sum + sub.totalAprovado, 0)
  const totalRetencao = filteredSubs.reduce((sum, sub) => sum + sub.retencao, 0)

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Empreiteiros</h2>
          <p className="mt-0.5 text-xs text-[#a3a3a3]">
            RDO Sabesp identificado entra automaticamente na medição por núcleo e empreiteira.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportSubBtn periodo={boletim.periodo} />
          {selected && selected.id !== '__all' && <ImportSubBtn subId={selected.id} periodo={selected.periodo || boletim.periodo} />}
          <button type="button" onClick={handleSyncRdos} className={btnMuted}>
            <RefreshCw size={13} /> Sincronizar RDOs
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-medium text-white">
            <Plus size={13} /> Adicionar
          </button>
          <button type="button" onClick={downloadTemplateSub} className={btnMuted}><Download size={13} /> Template</button>
          {filteredSubs.length > 0 && <button type="button" onClick={() => exportSubempreiteirosPdf(filteredSubs, boletim.periodo, boletim.contrato)} className={btnMuted}><FileDown size={13} /> PDF</button>}
        </div>
      </div>

      {lastSyncMessage && (
        <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs text-[#d4d4d4]">
          {lastSyncMessage}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Empreiteiros" value={filteredSubs.length} />
        <Metric label="Total aprovado" value={fmt(totalAprovado)} />
        <Metric label="Retenção registrada" value={fmt(totalRetencao)} />
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-xs leading-relaxed text-blue-100">
        RDO Sabesp finalizado entra automaticamente como rascunho conferivel quando ha empreiteiro, nucleo, servico/N. Preco e evidencia suficientes.
        Itens sem preco unitario, sem N. Preco ou bloqueados pela qualidade permanecem em revisao antes do fechamento.
      </div>

      <div className="grid gap-2 rounded-xl border border-[#525252] bg-[#2c2c2c] p-3 md:grid-cols-2">
        <select value={contractorFilter} onChange={(event) => setContractorFilter(event.target.value)} className={fieldClass}>
          <option value="all">Todos os empreiteiros</option>
          {contractorOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={nucleoFilter} onChange={(event) => setNucleoFilter(event.target.value)} className={fieldClass}>
          <option value="all">Todos os núcleos</option>
          {nucleoOptions.map((nucleo) => <option key={nucleo} value={nucleo}>{nucleo}</option>)}
        </select>
      </div>

      <SubSelector subs={filteredSubs} selectedId={selected?.id ?? ''} onSelect={setSelectedId} onRemove={removeSubempreiteiro} />

      {!selected ? (
        <div className="py-12 text-center text-sm text-[#6b6b6b]">
          <Users size={32} className="mx-auto mb-3 text-[#525252]" />
          Nenhum empreiteiro encontrado para o filtro.
        </div>
      ) : (
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c]">
          <div className="overflow-x-auto border-b border-[#525252]">
            <div className="flex min-w-max gap-1 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${activeTab === tab.id ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {activeTab === 'memoria' && <MemoriaTab sub={selected} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {activeTab === 'parametros' && <PlatformParametrosTab sub={selected} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {activeTab === 'descontos' && <DescontosTab sub={selected} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {activeTab === 'rh' && <RhTab sub={selected} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {isCostTab(activeTab) && <CostTab sub={selected} costKey={activeTab} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {activeTab === 'retencoes' && <PlatformRetencaoTab sub={selected} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {activeTab === 'nfs' && <PlatformNfsTab sub={selected} onUpdate={selected.id !== '__all' ? (patch) => updateSubempreiteiro(selected.id, patch) : undefined} />}
            {activeTab === 'auditoria' && <AuditoriaTab sub={selected} />}
            {activeTab === 'detalhado' && (
              <div className="-m-4">
                <div className="border-b border-[#525252] bg-[#1f1f1f] px-4 py-3">
                  <p className="text-sm font-semibold text-white">Planilha de Medição Sabesp</p>
                  <p className="mt-1 text-xs text-[#a3a3a3]">
                    Esta é a planilha Sabesp oficial do boletim ativo, usada para conferir os serviços que vieram dos RDOs e alimentar a medição.
                  </p>
                </div>
                <SabespPlanilhaPanel />
              </div>
            )}
            {activeTab === 'fechamento' && <FechamentoTab sub={selected} />}
          </div>
        </div>
      )}

      {addOpen && <AddSubModal onClose={() => setAddOpen(false)} onAdd={addSubempreiteiro} periodo={boletim.periodo} />}
    </div>
  )
}
