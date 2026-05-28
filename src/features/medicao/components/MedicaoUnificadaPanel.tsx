import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Link2,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContractorStore } from '@/store/contractorStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import {
  useMedicaoUnificadaStore,
  type UnifiedFinancialType,
  type UnifiedMeasurementFinancialEntry,
  type UnifiedMeasurementMemoryLine,
  type UnifiedMeasurementSource,
  type UnifiedSourceKind,
} from '@/store/medicaoUnificadaStore'
import {
  exportSubempreiteiroWorkbook,
  generateAllSubempreiteiroMeasurements,
} from '../utils/measurementGeneration'

type TabKey = 'resumo' | 'fontes' | 'memoria' | 'itens' | 'financeiro' | 'conferencia' | 'fechamento'
type FormKey = 'periodo' | 'fonte' | 'memoria' | 'contrato' | 'financeiro' | null

interface MedicaoUnificadaPanelProps {
  initialTab?: TabKey
  lockedTab?: boolean
  embedded?: boolean
  title?: string
  subtitle?: string
}

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'resumo', label: 'Resumo', icon: ClipboardList },
  { key: 'fontes', label: 'Fontes', icon: Link2 },
  { key: 'memoria', label: 'Memória', icon: FileText },
  { key: 'itens', label: 'Itens Medidos', icon: Calculator },
  { key: 'financeiro', label: 'Financeiro', icon: Receipt },
  { key: 'conferencia', label: 'Conferência', icon: AlertTriangle },
  { key: 'fechamento', label: 'Fechamento', icon: FileCheck2 },
]

const sourceKindLabels: Record<UnifiedSourceKind, string> = {
  rdo: 'RDO automático',
  rdo_sabesp: 'RDO automático',
  spreadsheet: 'Importação XLSX',
  manual: 'Lançamento manual',
  manual_entry: 'Lançamento manual',
  engineering_adjustment: 'Ajuste de engenharia',
  financial_adjustment: 'Ajuste financeiro',
  suprimentos: 'Suprimentos',
  quality_return: 'Glosa/retorno de qualidade',
}

const financialTypeLabels: Record<UnifiedFinancialType, string> = {
  retention: 'Retenção',
  discount: 'Desconto',
  rh: 'RH',
  machine: 'Máquinas',
  vehicle: 'Veículos',
  fuel: 'Combustível',
  material: 'Materiais',
  epi: 'EPI',
  third_party_service: 'Serviços terceiros',
  invoice: 'Nota fiscal',
  advance: 'Adiantamento',
  previous_closing: 'Fechamento anterior',
  other: 'Outros',
  manual_adjustment: 'Ajuste manual',
}

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qty = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

function StatusBadge({ value }: { value?: string | null }) {
  const status = value ?? 'pending_review'
  const style =
    status === 'approved' || status === 'paid'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : status === 'blocked' || status === 'rejected' || status === 'glossed'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : status === 'draft'
      ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  const label: Record<string, string> = {
    draft: 'Rascunho',
    pending_review: 'Em revisão',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    glossed: 'Glosado',
    blocked: 'Bloqueado',
    paid: 'Pago',
  }
  return <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase', style)}>{label[status] ?? status}</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{label}</span>
      {children}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn('h-10 w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]', props.className)}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn('h-10 w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]', props.className)}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn('min-h-[84px] w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]', props.className)}
    />
  )
}

function Kpi({ label, value, note, tone = 'text-white' }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      {note && <p className="mt-1 text-xs text-[#737373]">{note}</p>}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#525252] bg-[#242424] p-8 text-center text-sm text-[#a3a3a3]">
      {children}
    </div>
  )
}

function SourceCard({ source, partnerName, hasMemory, onGenerate, onReview }: {
  source: UnifiedMeasurementSource
  partnerName: string
  hasMemory: boolean
  onGenerate: () => void
  onReview?: (status: 'approved' | 'blocked' | 'rejected') => void
}) {
  const photo = String(source.source_payload?.planilha_foto_path ?? source.evidence_url ?? '')
  const signatures = [
    source.source_payload?.assinatura_empreiteira_presente ? 'Assinatura empreiteira' : '',
    source.source_payload?.assinatura_consorcio_presente ? 'Assinatura consórcio' : '',
  ].filter(Boolean)

  return (
    <article className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={source.status} />
            <span className="rounded-full bg-[#f97316]/10 px-2 py-1 text-[10px] font-semibold uppercase text-[#f97316]">{sourceKindLabels[source.source_kind]}</span>
            {source.quality_status === 'blocked_by_nc' && <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-red-300">Qualidade bloqueou</span>}
          </div>
          <h3 className="mt-3 text-base font-semibold text-white">{source.service_description}</h3>
          <p className="mt-1 text-xs text-[#a3a3a3]">
            {source.source_date || 'Sem data'} · {source.nucleo || 'Sem núcleo'} · {partnerName || 'Sem parceiro'}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-lg font-bold text-white">{qty(num(source.quantity))} {source.unit || ''}</p>
          <p className="text-xs text-[#a3a3a3]">{brl(num(source.amount))}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-[#a3a3a3] sm:grid-cols-3">
        <span>N. Preço: <strong className="text-[#f5f5f5]">{source.service_code || 'pendente'}</strong></span>
        <span>Origem: <strong className="text-[#f5f5f5]">{source.origin_label}</strong></span>
        <span>Memória: <strong className={hasMemory ? 'text-emerald-300' : 'text-amber-300'}>{hasMemory ? 'gerada' : 'pendente'}</strong></span>
      </div>
      {(photo || signatures.length > 0) && (
        <div className="mt-3 rounded-lg border border-[#525252] bg-[#1f1f1f] p-3 text-xs text-[#a3a3a3]">
          {photo && <p>Documento/foto do RDO: <span className="text-[#f5f5f5]">{photo}</span></p>}
          {signatures.length > 0 && <p className="mt-1 text-emerald-300">{signatures.join(' + ')} presentes para auditoria.</p>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onGenerate} className="rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#f5f5f5] hover:bg-[#3a3a3a]">
          {hasMemory ? 'Ver memória gerada' : 'Gerar memória'}
        </button>
        {onReview && (
          <button onClick={() => onReview('rejected')} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20">Marcar problema</button>
        )}
      </div>
    </article>
  )
}

export function MedicaoUnificadaPanel({
  initialTab = 'resumo',
  lockedTab = false,
  embedded = false,
  title,
  subtitle,
}: MedicaoUnificadaPanelProps = {}) {
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [form, setForm] = useState<FormKey>(null)
  const [periodLabel, setPeriodLabel] = useState('mai/26')
  const [contractNo, setContractNo] = useState('11481051')
  const [sourceDraft, setSourceDraft] = useState({
    service_description: '',
    source_kind: 'manual_entry' as UnifiedSourceKind,
    source_date: new Date().toISOString().slice(0, 10),
    contractor_id: '',
    nucleo: '',
    service_code: '',
    unit: 'M',
    quantity: '',
    unit_price: '',
    manual_reason: '',
    evidence_url: '',
  })
  const [memoryDraft, setMemoryDraft] = useState({
    service_description: '',
    contractor_id: '',
    nucleo: '',
    n_preco: '',
    unit: 'M',
    quantity: '',
    unit_price: '',
    location_text: '',
    trecho_inicial: '',
    trecho_final: '',
    service_order: '',
    croqui: '',
    manual_reason: '',
  })
  const [contractDraft, setContractDraft] = useState({
    description: '',
    n_preco: '',
    item_code: '',
    unit: 'M',
    contracted_quantity: '',
    previous_quantity: '',
    unit_price: '',
    retention_percent: '',
    measurement_rule: '',
  })
  const [financialDraft, setFinancialDraft] = useState({
    entry_type: 'discount' as UnifiedFinancialType,
    description: '',
    contractor_id: '',
    nucleo: '',
    amount: '',
    competence: '',
    invoice_number: '',
    manual_reason: '',
    evidence_url: '',
  })

  const {
    periods,
    activePeriodId,
    sources,
    memoryLines,
    contractItems,
    financialEntries,
    loading,
    syncError,
    load,
    setActivePeriod,
    createPeriod,
    addManualSource,
    addMemoryLine,
    addContractItem,
    addFinancialEntry,
    generateMemoryFromSource,
    reviewMemoryLine,
    reviewFinancialEntry,
  } = useMedicaoUnificadaStore()
  const { contractors, load: loadContractors } = useContractorStore()
  const { suppliers, pull: pullSuprimentos } = useSuprimentosStore()

  useEffect(() => {
    void load()
    void loadContractors()
    void pullSuprimentos()
  }, [load, loadContractors, pullSuprimentos])

  const activePeriod = periods.find((period) => period.id === activePeriodId) ?? periods[0] ?? null
  const activePeriodFilterId = activePeriod?.id ?? null
  const periodSources = useMemo(() => sources.filter((source) => !activePeriodFilterId || !source.period_id || source.period_id === activePeriodFilterId), [sources, activePeriodFilterId])
  const periodMemory = useMemo(() => memoryLines.filter((line) => !activePeriodFilterId || !line.period_id || line.period_id === activePeriodFilterId), [memoryLines, activePeriodFilterId])
  const periodFinancial = useMemo(() => financialEntries.filter((entry) => !activePeriodFilterId || !entry.period_id || entry.period_id === activePeriodFilterId), [financialEntries, activePeriodFilterId])
  const activeContractItems = useMemo(() => contractItems.filter((item) => !activePeriodFilterId || !item.period_id || item.period_id === activePeriodFilterId), [contractItems, activePeriodFilterId])
  const generatedMeasurements = useMemo(() => generateAllSubempreiteiroMeasurements({
    period: activePeriod,
    contractors,
    sources: periodSources,
    memoryLines: periodMemory,
    contractItems: activeContractItems,
    financialEntries: periodFinancial,
  }), [activeContractItems, activePeriod, contractors, periodFinancial, periodMemory, periodSources])

  const partnerName = useCallback((contractorId?: string | null, supplierId?: string | null) => {
    if (contractorId) {
      const contractor = contractors.find((item) => item.id === contractorId && !item.deleted_at)
      if (contractor) return contractor.name
    }
    if (supplierId) {
      const supplier = suppliers.find((item) => item.id === supplierId)
      if (supplier) return supplier.name
    }
    return ''
  }, [contractors, suppliers])
  const grossApproved = periodMemory.filter((line) => line.review_status === 'approved').reduce((total, line) => total + num(line.quantity) * num(line.unit_price), 0)
  const contractItemsCount = activeContractItems.length
  const pendingSources = periodSources.filter((source) => (source.status ?? 'pending_review') === 'pending_review').length
  const pendingMemory = periodMemory.filter((line) => line.review_status !== 'approved').length
  const pendingNPreco = periodMemory.filter((line) => !line.n_preco).length
  const blockedQuality = periodSources.filter((source) => source.quality_status === 'blocked_by_nc' || source.status === 'blocked').length
  const generatedAutoLines = generatedMeasurements.reduce((total, measurement) => total + measurement.economy.autoGeneratedLines, 0)
  const generatedBlockers = generatedMeasurements.reduce((total, measurement) => total + measurement.economy.pendingCriticalCount, 0)
  const approvedDeductions = periodFinancial
    .filter((entry) => ['approved', 'paid'].includes(entry.status) && entry.entry_type !== 'invoice')
    .reduce((total, entry) => total + Math.abs(num(entry.amount)), 0)
  const approvedInvoices = periodFinancial
    .filter((entry) => ['approved', 'paid'].includes(entry.status) && entry.entry_type === 'invoice')
    .reduce((total, entry) => total + Math.abs(num(entry.amount)), 0)
  const netValue = grossApproved - approvedDeductions

  const groupedItems = useMemo(() => {
    const map = new Map<string, { label: string; n_preco: string; unit: string; quantity: number; amount: number; contractor: string; nucleo: string; pending: boolean }>()
    for (const line of periodMemory) {
      if (line.review_status !== 'approved') continue
      const key = [line.n_preco || 'pendente', line.service_description, line.contractor_id || '', line.supplier_id || '', line.nucleo || ''].join('|')
      const current = map.get(key) ?? {
        label: line.service_description,
        n_preco: line.n_preco || 'pendente',
        unit: line.unit || '',
        quantity: 0,
        amount: 0,
        contractor: partnerName(line.contractor_id, line.supplier_id) || 'Sem parceiro',
        nucleo: line.nucleo || 'Sem núcleo',
        pending: !line.n_preco,
      }
      current.quantity += num(line.quantity)
      current.amount += num(line.quantity) * num(line.unit_price)
      map.set(key, current)
    }
    return Array.from(map.values())
  }, [periodMemory, partnerName])

  async function submitPeriod(event: React.FormEvent) {
    event.preventDefault()
    if (!periodLabel.trim()) return
    await createPeriod({ period_label: periodLabel, contract_no: contractNo })
    setForm(null)
  }

  async function submitSource(event: React.FormEvent) {
    event.preventDefault()
    if (!sourceDraft.service_description.trim()) return
    await addManualSource({
      ...sourceDraft,
      contractor_id: sourceDraft.contractor_id || null,
      quantity: num(sourceDraft.quantity),
      unit_price: num(sourceDraft.unit_price),
      manual_reason: sourceDraft.manual_reason || 'Complemento manual da medição.',
    })
    setSourceDraft({ ...sourceDraft, service_description: '', quantity: '', unit_price: '', manual_reason: '', evidence_url: '' })
    setForm(null)
    setTab('fontes')
  }

  async function submitMemory(event: React.FormEvent) {
    event.preventDefault()
    if (!memoryDraft.service_description.trim()) return
    await addMemoryLine({
      ...memoryDraft,
      contractor_id: memoryDraft.contractor_id || null,
      quantity: num(memoryDraft.quantity),
      unit_price: num(memoryDraft.unit_price),
      manual_reason: memoryDraft.manual_reason || 'Complemento manual da memória de cálculo.',
    })
    setMemoryDraft({ ...memoryDraft, service_description: '', quantity: '', unit_price: '', location_text: '', manual_reason: '' })
    setForm(null)
    setTab('memoria')
  }

  async function submitContract(event: React.FormEvent) {
    event.preventDefault()
    if (!contractDraft.description.trim()) return
    await addContractItem({
      ...contractDraft,
      contracted_quantity: num(contractDraft.contracted_quantity),
      previous_quantity: num(contractDraft.previous_quantity),
      unit_price: num(contractDraft.unit_price),
      retention_percent: num(contractDraft.retention_percent),
    })
    setContractDraft({ ...contractDraft, description: '', n_preco: '', item_code: '', contracted_quantity: '', previous_quantity: '', unit_price: '', retention_percent: '', measurement_rule: '' })
    setForm(null)
  }

  async function submitFinancial(event: React.FormEvent) {
    event.preventDefault()
    if (!financialDraft.description.trim()) return
    await addFinancialEntry({
      ...financialDraft,
      contractor_id: financialDraft.contractor_id || null,
      amount: num(financialDraft.amount),
      manual_reason: financialDraft.manual_reason || 'Lançamento financeiro manual.',
    })
    setFinancialDraft({ ...financialDraft, description: '', amount: '', invoice_number: '', manual_reason: '', evidence_url: '' })
    setForm(null)
    setTab('financeiro')
  }

  return (
    <div className={cn('min-h-full bg-gray-950 text-[#f5f5f5]', embedded ? 'p-0' : 'p-4 sm:p-6')}>
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-[#525252] bg-[#2c2c2c] p-4 sm:p-5">
          {(title || subtitle) && (
            <div className="mb-3 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2">
              {title && <p className="text-[10px] font-bold uppercase tracking-wide text-[#f97316]">{title}</p>}
              {subtitle && <p className="mt-1 text-xs text-[#a3a3a3]">{subtitle}</p>}
            </div>
          )}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f97316]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#f97316]">Medição Unificada</span>
                {syncError && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] text-amber-300">cache local ativo</span>}
              </div>
              <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">RDO → Memória → Itens medidos → Fechamento</h2>
              <p className="mt-1 max-w-3xl text-sm text-[#a3a3a3]">
                As quantidades nascem em fontes auditáveis, exigem revisão humana e podem receber complemento manual com motivo, responsável e evidência.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <select
                value={activePeriod?.id ?? ''}
                onChange={(event) => setActivePeriod(event.target.value || null)}
                className="h-10 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
              >
                <option value="">Sem período fixo</option>
                {periods.map((period) => <option key={period.id} value={period.id}>{period.period_label} · {period.contract_no || 'sem contrato'}</option>)}
              </select>
              <button onClick={() => setForm('periodo')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f97316] px-3 text-sm font-semibold text-white hover:bg-[#ea580c]">
                <Plus size={15} /> Período
              </button>
              <button onClick={() => setForm('fonte')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 text-sm text-white hover:bg-[#484848]">
                <Plus size={15} /> Fonte
              </button>
              <button onClick={() => setForm('memoria')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 text-sm text-white hover:bg-[#484848]">
                <Plus size={15} /> Memória
              </button>
              <button onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white hover:bg-[#3a3a3a]">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Recarregar
              </button>
            </div>
          </div>
          {syncError && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Supabase ainda não retornou todas as camadas: {syncError}. A tela continua usando cache local até a migration ser aplicada.
            </p>
          )}
        </header>

        {!lockedTab && <nav className="overflow-x-auto rounded-xl border border-[#525252] bg-[#2c2c2c] p-2">
          <div className="flex min-w-max gap-2">
            {tabs.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors', tab === item.key ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white')}
                >
                  <Icon size={14} /> {item.label}
                </button>
              )
            })}
          </div>
        </nav>}

        {form && (
          <section className="rounded-2xl border border-[#525252] bg-[#2c2c2c] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">
                {form === 'periodo' && 'Novo período de medição'}
                {form === 'fonte' && 'Nova fonte manual'}
                {form === 'memoria' && 'Nova linha de memória'}
                {form === 'contrato' && 'Novo item contratual'}
                {form === 'financeiro' && 'Novo lançamento financeiro'}
              </h3>
              <button onClick={() => setForm(null)} className="text-sm text-[#a3a3a3] hover:text-white">Fechar</button>
            </div>

            {form === 'periodo' && (
              <form onSubmit={submitPeriod} className="grid gap-3 sm:grid-cols-3">
                <Field label="Período"><Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="mai/26" /></Field>
                <Field label="Contrato"><Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} placeholder="11481051" /></Field>
                <button className="mt-5 h-10 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white">Criar período</button>
              </form>
            )}

            {form === 'fonte' && (
              <form onSubmit={submitSource} className="grid gap-3 md:grid-cols-4">
                <Field label="Tipo"><Select value={sourceDraft.source_kind} onChange={(e) => setSourceDraft({ ...sourceDraft, source_kind: e.target.value as UnifiedSourceKind })}>{Object.entries(sourceKindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
                <Field label="Data"><Input type="date" value={sourceDraft.source_date} onChange={(e) => setSourceDraft({ ...sourceDraft, source_date: e.target.value })} /></Field>
                <Field label="Empreiteiro"><Select value={sourceDraft.contractor_id} onChange={(e) => setSourceDraft({ ...sourceDraft, contractor_id: e.target.value })}><option value="">Sem empreiteiro</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                <Field label="Núcleo"><Input value={sourceDraft.nucleo} onChange={(e) => setSourceDraft({ ...sourceDraft, nucleo: e.target.value })} /></Field>
                <Field label="Serviço"><Input value={sourceDraft.service_description} onChange={(e) => setSourceDraft({ ...sourceDraft, service_description: e.target.value })} /></Field>
                <Field label="N. Preço"><Input value={sourceDraft.service_code} onChange={(e) => setSourceDraft({ ...sourceDraft, service_code: e.target.value })} /></Field>
                <Field label="Unidade"><Input value={sourceDraft.unit} onChange={(e) => setSourceDraft({ ...sourceDraft, unit: e.target.value })} /></Field>
                <Field label="Quantidade"><Input type="number" step="0.01" value={sourceDraft.quantity} onChange={(e) => setSourceDraft({ ...sourceDraft, quantity: e.target.value })} /></Field>
                <Field label="Preço unitário"><Input type="number" step="0.01" value={sourceDraft.unit_price} onChange={(e) => setSourceDraft({ ...sourceDraft, unit_price: e.target.value })} /></Field>
                <Field label="Evidência"><Input value={sourceDraft.evidence_url} onChange={(e) => setSourceDraft({ ...sourceDraft, evidence_url: e.target.value })} placeholder="link, foto ou documento" /></Field>
                <div className="md:col-span-2"><Field label="Motivo"><TextArea value={sourceDraft.manual_reason} onChange={(e) => setSourceDraft({ ...sourceDraft, manual_reason: e.target.value })} /></Field></div>
                <button className="h-10 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white md:col-span-4">Salvar fonte</button>
              </form>
            )}

            {form === 'memoria' && (
              <form onSubmit={submitMemory} className="grid gap-3 md:grid-cols-4">
                <Field label="Empreiteiro"><Select value={memoryDraft.contractor_id} onChange={(e) => setMemoryDraft({ ...memoryDraft, contractor_id: e.target.value })}><option value="">Sem empreiteiro</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                <Field label="Núcleo"><Input value={memoryDraft.nucleo} onChange={(e) => setMemoryDraft({ ...memoryDraft, nucleo: e.target.value })} /></Field>
                <Field label="N. Preço"><Input value={memoryDraft.n_preco} onChange={(e) => setMemoryDraft({ ...memoryDraft, n_preco: e.target.value })} /></Field>
                <Field label="Serviço"><Input value={memoryDraft.service_description} onChange={(e) => setMemoryDraft({ ...memoryDraft, service_description: e.target.value })} /></Field>
                <Field label="Unidade"><Input value={memoryDraft.unit} onChange={(e) => setMemoryDraft({ ...memoryDraft, unit: e.target.value })} /></Field>
                <Field label="Quantidade"><Input type="number" step="0.01" value={memoryDraft.quantity} onChange={(e) => setMemoryDraft({ ...memoryDraft, quantity: e.target.value })} /></Field>
                <Field label="Preço unitário"><Input type="number" step="0.01" value={memoryDraft.unit_price} onChange={(e) => setMemoryDraft({ ...memoryDraft, unit_price: e.target.value })} /></Field>
                <Field label="Local"><Input value={memoryDraft.location_text} onChange={(e) => setMemoryDraft({ ...memoryDraft, location_text: e.target.value })} /></Field>
                <Field label="Trecho inicial"><Input value={memoryDraft.trecho_inicial} onChange={(e) => setMemoryDraft({ ...memoryDraft, trecho_inicial: e.target.value })} /></Field>
                <Field label="Trecho final"><Input value={memoryDraft.trecho_final} onChange={(e) => setMemoryDraft({ ...memoryDraft, trecho_final: e.target.value })} /></Field>
                <Field label="Nota de serviço"><Input value={memoryDraft.service_order} onChange={(e) => setMemoryDraft({ ...memoryDraft, service_order: e.target.value })} /></Field>
                <Field label="Croqui"><Input value={memoryDraft.croqui} onChange={(e) => setMemoryDraft({ ...memoryDraft, croqui: e.target.value })} /></Field>
                <div className="md:col-span-4"><Field label="Motivo/observação"><TextArea value={memoryDraft.manual_reason} onChange={(e) => setMemoryDraft({ ...memoryDraft, manual_reason: e.target.value })} /></Field></div>
                <button className="h-10 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white md:col-span-4">Salvar memória</button>
              </form>
            )}

            {form === 'contrato' && (
              <form onSubmit={submitContract} className="grid gap-3 md:grid-cols-4">
                <Field label="N. Preço"><Input value={contractDraft.n_preco} onChange={(e) => setContractDraft({ ...contractDraft, n_preco: e.target.value })} /></Field>
                <Field label="Item"><Input value={contractDraft.item_code} onChange={(e) => setContractDraft({ ...contractDraft, item_code: e.target.value })} /></Field>
                <Field label="Descrição"><Input value={contractDraft.description} onChange={(e) => setContractDraft({ ...contractDraft, description: e.target.value })} /></Field>
                <Field label="Unidade"><Input value={contractDraft.unit} onChange={(e) => setContractDraft({ ...contractDraft, unit: e.target.value })} /></Field>
                <Field label="Qtd contratada"><Input type="number" step="0.01" value={contractDraft.contracted_quantity} onChange={(e) => setContractDraft({ ...contractDraft, contracted_quantity: e.target.value })} /></Field>
                <Field label="Qtd anterior"><Input type="number" step="0.01" value={contractDraft.previous_quantity} onChange={(e) => setContractDraft({ ...contractDraft, previous_quantity: e.target.value })} /></Field>
                <Field label="Preço unitário"><Input type="number" step="0.01" value={contractDraft.unit_price} onChange={(e) => setContractDraft({ ...contractDraft, unit_price: e.target.value })} /></Field>
                <Field label="% retenção"><Input type="number" step="0.01" value={contractDraft.retention_percent} onChange={(e) => setContractDraft({ ...contractDraft, retention_percent: e.target.value })} /></Field>
                <div className="md:col-span-4"><Field label="Regra de medição"><TextArea value={contractDraft.measurement_rule} onChange={(e) => setContractDraft({ ...contractDraft, measurement_rule: e.target.value })} /></Field></div>
                <button className="h-10 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white md:col-span-4">Salvar item contratual</button>
              </form>
            )}

            {form === 'financeiro' && (
              <form onSubmit={submitFinancial} className="grid gap-3 md:grid-cols-4">
                <Field label="Tipo"><Select value={financialDraft.entry_type} onChange={(e) => setFinancialDraft({ ...financialDraft, entry_type: e.target.value as UnifiedFinancialType })}>{Object.entries(financialTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
                <Field label="Empreiteiro"><Select value={financialDraft.contractor_id} onChange={(e) => setFinancialDraft({ ...financialDraft, contractor_id: e.target.value })}><option value="">Sem empreiteiro</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                <Field label="Núcleo"><Input value={financialDraft.nucleo} onChange={(e) => setFinancialDraft({ ...financialDraft, nucleo: e.target.value })} /></Field>
                <Field label="Competência"><Input value={financialDraft.competence} onChange={(e) => setFinancialDraft({ ...financialDraft, competence: e.target.value })} placeholder="fev/26" /></Field>
                <Field label="Descrição"><Input value={financialDraft.description} onChange={(e) => setFinancialDraft({ ...financialDraft, description: e.target.value })} /></Field>
                <Field label="Valor"><Input type="number" step="0.01" value={financialDraft.amount} onChange={(e) => setFinancialDraft({ ...financialDraft, amount: e.target.value })} /></Field>
                <Field label="NF"><Input value={financialDraft.invoice_number} onChange={(e) => setFinancialDraft({ ...financialDraft, invoice_number: e.target.value })} /></Field>
                <Field label="Evidência"><Input value={financialDraft.evidence_url} onChange={(e) => setFinancialDraft({ ...financialDraft, evidence_url: e.target.value })} /></Field>
                <div className="md:col-span-4"><Field label="Motivo"><TextArea value={financialDraft.manual_reason} onChange={(e) => setFinancialDraft({ ...financialDraft, manual_reason: e.target.value })} /></Field></div>
                <button className="h-10 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white md:col-span-4">Salvar lançamento</button>
              </form>
            )}
          </section>
        )}

        {tab === 'resumo' && (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Fontes recebidas" value={String(periodSources.length)} note={`${pendingSources} aguardando revisão`} />
              <Kpi label="Memórias aprovadas" value={String(periodMemory.filter((line) => line.review_status === 'approved').length)} note={`${pendingMemory} pendentes`} />
              <Kpi label="Valor bruto aprovado" value={brl(grossApproved)} tone="text-emerald-300" />
              <Kpi label="Valor líquido prévio" value={brl(netValue)} note={`${contractItemsCount} itens contratuais cadastrados`} tone="text-[#f97316]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label="Medições geradas" value={String(generatedMeasurements.length)} note="por subempreiteiro e núcleo" />
              <Kpi label="Linhas automáticas" value={String(generatedAutoLines)} note="com origem em RDO/fonte" tone="text-emerald-300" />
              <Kpi label="Bloqueios do fechamento" value={String(generatedBlockers)} note="checklist SLNR/Sabesp" tone={generatedBlockers ? 'text-amber-300' : 'text-emerald-300'} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4 lg:col-span-2">
                <h3 className="font-semibold text-white">Fluxo de aprovação</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {['RDO/importação', 'Revisão humana', 'N. Preço', 'Fechamento'].map((label, index) => (
                    <div key={label} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
                      <p className="text-[10px] font-semibold uppercase text-[#f97316]">Etapa {index + 1}</p>
                      <p className="mt-2 font-semibold text-white">{label}</p>
                      <p className="mt-1 text-xs text-[#a3a3a3]">{index === 0 ? 'Tudo entra como fonte auditável.' : index === 1 ? 'IA nunca fecha sozinha.' : index === 2 ? 'Contrato dá preço e regra.' : 'Sem pendência crítica.'}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
                <h3 className="font-semibold text-white">Pendências críticas</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="flex justify-between text-[#a3a3a3]"><span>Fontes em revisão</span><strong className="text-white">{pendingSources}</strong></p>
                  <p className="flex justify-between text-[#a3a3a3]"><span>Sem N. Preço</span><strong className="text-white">{pendingNPreco}</strong></p>
                  <p className="flex justify-between text-[#a3a3a3]"><span>Qualidade/bloqueios</span><strong className="text-white">{blockedQuality}</strong></p>
                  <p className="flex justify-between text-[#a3a3a3]"><span>NFs aprovadas</span><strong className="text-white">{brl(approvedInvoices)}</strong></p>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'fontes' && (
          <section className="space-y-3">
            {periodSources.length === 0 ? <Empty>Nenhuma fonte ainda. Finalize um RDO ou adicione uma fonte manual.</Empty> : periodSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                partnerName={partnerName(source.contractor_id, source.supplier_id)}
                hasMemory={periodMemory.some((line) => line.source_id === source.id)}
                onGenerate={() => void generateMemoryFromSource(source.id).then(() => setTab('memoria'))}
              />
            ))}
          </section>
        )}

        {tab === 'memoria' && (
          <section className="space-y-3">
            {periodMemory.length === 0 ? <Empty>Nenhuma memória de cálculo. Gere a partir de uma fonte ou lance manualmente.</Empty> : periodMemory.map((line: UnifiedMeasurementMemoryLine) => (
              <article key={line.id} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div>
                    <StatusBadge value={line.review_status} />
                    <h3 className="mt-3 font-semibold text-white">{line.service_description}</h3>
                    <p className="mt-1 text-xs text-[#a3a3a3]">{line.location_text || 'Sem local'} · {line.nucleo || 'Sem núcleo'} · {partnerName(line.contractor_id, line.supplier_id) || 'Sem parceiro'}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-bold text-white">{qty(num(line.quantity))} {line.unit || ''}</p>
                    <p className="text-xs text-[#a3a3a3]">{brl(num(line.quantity) * num(line.unit_price))}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-[#a3a3a3] sm:grid-cols-4">
                  <span>N. Preço: <strong className={line.n_preco ? 'text-[#f5f5f5]' : 'text-amber-300'}>{line.n_preco || 'pendente'}</strong></span>
                  <span>Trecho: <strong className="text-[#f5f5f5]">{[line.trecho_inicial, line.trecho_final].filter(Boolean).join(' → ') || '-'}</strong></span>
                  <span>NS: <strong className="text-[#f5f5f5]">{line.service_order || '-'}</strong></span>
                  <span>RDO: <strong className="text-[#f5f5f5]">{line.rdo_id ? `${line.rdo_type || ''} ${line.rdo_id.slice(0, 8)}` : 'manual'}</strong></span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => void reviewMemoryLine(line.id, 'approved')} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20">Aprovar memória</button>
                  <button onClick={() => void reviewMemoryLine(line.id, 'blocked')} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20">Bloquear</button>
                </div>
              </article>
            ))}
          </section>
        )}

        {tab === 'itens' && (
          <section className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setForm('contrato')} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm text-white hover:bg-[#484848]">
                <Plus size={15} /> Item contratual
              </button>
            </div>
            {groupedItems.length === 0 ? <Empty>Nenhum item aprovado ainda. Aprove memórias para consolidar por N. Preço.</Empty> : (
              <div className="grid gap-3">
                {groupedItems.map((item) => (
                  <div key={`${item.n_preco}-${item.label}-${item.contractor}-${item.nucleo}`} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase', item.pending ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300')}>
                          {item.pending ? 'Pendente de classificação' : `N. Preço ${item.n_preco}`}
                        </span>
                        <h3 className="mt-3 font-semibold text-white">{item.label}</h3>
                        <p className="mt-1 text-xs text-[#a3a3a3]">{item.contractor} · {item.nucleo}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-bold text-white">{qty(item.quantity)} {item.unit}</p>
                        <p className="text-xs text-[#a3a3a3]">{brl(item.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'financeiro' && (
          <section className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setForm('financeiro')} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm text-white hover:bg-[#484848]">
                <Plus size={15} /> Lançamento financeiro
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label="Abatimentos aprovados" value={brl(approvedDeductions)} tone="text-red-300" />
              <Kpi label="NFs lançadas" value={brl(approvedInvoices)} tone="text-emerald-300" />
              <Kpi label="Líquido prévio" value={brl(netValue)} tone="text-[#f97316]" />
            </div>
            {periodFinancial.length === 0 ? <Empty>Nenhum desconto, retenção ou NF lançado.</Empty> : periodFinancial.map((entry: UnifiedMeasurementFinancialEntry) => (
              <article key={entry.id} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <StatusBadge value={entry.status} />
                    <h3 className="mt-3 font-semibold text-white">{entry.description}</h3>
                    <p className="mt-1 text-xs text-[#a3a3a3]">{financialTypeLabels[entry.entry_type]} · {partnerName(entry.contractor_id, entry.supplier_id) || 'Sem parceiro'} · {entry.competence || 'sem competência'}</p>
                  </div>
                  <p className="text-lg font-bold text-white">{brl(num(entry.amount))}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => void reviewFinancialEntry(entry.id, entry.entry_type === 'invoice' ? 'paid' : 'approved')} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20">Aprovar</button>
                  <button onClick={() => void reviewFinancialEntry(entry.id, 'glossed')} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20">Glosar</button>
                </div>
              </article>
            ))}
          </section>
        )}

        {tab === 'conferencia' && (
          <section className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
            {[
              { label: 'Fontes aguardando revisão', value: pendingSources, hint: 'Todo RDO extraído por IA precisa de aceite humano.' },
              { label: 'Memórias sem aprovação', value: pendingMemory, hint: 'Quantidade só entra no fechamento após aprovação.' },
              { label: 'Itens sem N. Preço', value: pendingNPreco, hint: 'Sem vínculo contratual, não há preço oficial.' },
              { label: 'Bloqueios de qualidade', value: blockedQuality, hint: 'Qualidade pode glosar ou bloquear a medição.' },
            ].map((item) => (
              <div key={item.label} className={cn('rounded-xl border p-4', item.value ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10')}>
                <div className="flex items-start gap-3">
                  {item.value ? <AlertTriangle className="mt-0.5 text-amber-300" size={18} /> : <CheckCircle2 className="mt-0.5 text-emerald-300" size={18} />}
                  <div>
                    <p className="font-semibold text-white">{item.label}: {item.value}</p>
                    <p className="mt-1 text-sm text-[#d4d4d4]">{item.hint}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
            <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
              <h3 className="font-semibold text-white">Checklist automatico por subempreiteiro</h3>
              <div className="mt-4 grid gap-3">
                {generatedMeasurements.length === 0 ? <Empty>Nenhuma medicao gerada para conferir.</Empty> : generatedMeasurements.map((measurement) => (
                  <div key={measurement.key} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">{measurement.contractorName} · {measurement.nucleo}</p>
                        <p className="mt-1 text-xs text-[#a3a3a3]">
                          {measurement.memoryLines.length} linhas, {measurement.economy.evidenceCoveragePercent}% com evidencia, liquido {brl(measurement.economy.netPreviewBRL)}
                        </p>
                      </div>
                      <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase', measurement.economy.pendingCriticalCount ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300')}>
                        {measurement.economy.pendingCriticalCount ? `${measurement.economy.pendingCriticalCount} bloqueio(s)` : 'pronta'}
                      </span>
                    </div>
                    {measurement.exceptions.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {measurement.exceptions.map((exception, index) => (
                          <p key={`${exception.code}-${index}`} className={cn('rounded-lg border px-3 py-2 text-xs', exception.severity === 'blocker' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-200')}>
                            {exception.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === 'fechamento' && (
          <section className="space-y-4">
          <div className="rounded-2xl border border-[#525252] bg-[#2c2c2c] p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 text-[#f97316]" size={22} />
              <div>
                <h3 className="text-lg font-bold text-white">Pré-fechamento mensal</h3>
                <p className="mt-1 text-sm text-[#a3a3a3]">
                  O fechamento só deve ocorrer quando não houver fonte pendente, item sem N. Preço, bloqueio de qualidade ou lançamento financeiro sem aprovação.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Kpi label="Valor bruto aprovado" value={brl(grossApproved)} />
              <Kpi label="Descontos/retenções" value={brl(approvedDeductions)} tone="text-red-300" />
              <Kpi label="Valor líquido previsto" value={brl(netValue)} tone="text-[#f97316]" />
            </div>
            <div className="mt-5 rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
              {pendingSources + pendingMemory + pendingNPreco + blockedQuality > 0 ? (
                <p className="text-sm text-amber-200">Ainda existem pendências críticas. Revise a aba Conferência antes de fechar a medição.</p>
              ) : (
                <p className="text-sm text-emerald-200">Sem pendências críticas. A medição está pronta para conferência final e emissão da NF.</p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-[#525252] bg-[#2c2c2c] p-5">
            <h3 className="text-lg font-bold text-white">Pacotes XLSX por subempreiteiro</h3>
            <p className="mt-1 text-sm text-[#a3a3a3]">
              Cada pacote consolida Resumo Geral, Fechamento, Parametros, NFs, Medicao, Memoria, Descontos e abas operacionais.
            </p>
            <div className="mt-4 grid gap-3">
              {generatedMeasurements.length === 0 ? <Empty>Nenhum pacote disponivel. Cadastre fontes, memorias ou lancamentos financeiros.</Empty> : generatedMeasurements.map((measurement) => (
                <article key={measurement.key} className="rounded-xl border border-[#525252] bg-[#1f1f1f] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">{measurement.contractorName} · {measurement.nucleo}</p>
                      <p className="mt-1 text-xs text-[#a3a3a3]">
                        Medido {brl(measurement.payload.totalMedido)} · aprovado {brl(measurement.payload.totalAprovado)} · retencao {brl(measurement.payload.retencao)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportSubempreiteiroWorkbook(measurement)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f97316] px-3 text-sm font-semibold text-white hover:bg-[#ea580c]"
                    >
                      <Download size={15} /> Exportar XLSX
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          </section>
        )}
      </div>
    </div>
  )
}
