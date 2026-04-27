import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, FileUp, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { MasterActivity, PlanServiceType, PlanningNucleus } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

type DraftNucleus = Omit<PlanningNucleus, 'id' | 'budgetBRL'>
type DraftActivity = Omit<MasterActivity, 'id'>

const SERVICE_OPTIONS: Array<{ value: PlanServiceType; label: string }> = [
  { value: 'esgoto', label: 'Esgoto' },
  { value: 'agua', label: 'Agua' },
  { value: 'drenagem', label: 'Drenagem' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'edificacao', label: 'Edificacao' },
  { value: 'outro', label: 'Outro' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function plusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function normalizeService(value: unknown): PlanServiceType {
  const raw = String(value ?? '').toLowerCase()
  if (raw.includes('agua') || raw.includes('água')) return 'agua'
  if (raw.includes('esgoto')) return 'esgoto'
  if (raw.includes('dren')) return 'drenagem'
  if (raw.includes('edif')) return 'edificacao'
  if (raw.includes('infra')) return 'infraestrutura'
  return 'outro'
}

function pick(row: Record<string, unknown>, names: string[]) {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const key = Object.keys(row).find((k) => names.some((name) => norm(k).includes(norm(name))))
  return key ? row[key] : undefined
}

function toDate(value: unknown): string | undefined {
  if (!value) return undefined
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const br = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  if (/^\d{4,5}$/.test(text)) {
    const d = new Date((Number(text) - 25569) * 86_400_000)
    return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
  }
  return undefined
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const n = Number(String(value ?? '').replace(/[R$\s.]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

async function parseScheduleFile(file: File): Promise<DraftActivity[]> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'mpp') throw new Error('Arquivo .mpp binario nao e lido diretamente. Exporte do MS Project como XML ou XLSX.')
  const buffer = await file.arrayBuffer()
  if (ext === 'xml') {
    const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(buffer), 'text/xml')
    return Array.from(doc.getElementsByTagName('Task')).map((task, idx) => {
      const get = (tag: string) => task.getElementsByTagName(tag)[0]?.textContent?.trim()
      const start = toDate(get('Start')) ?? today()
      const end = toDate(get('Finish')) ?? plusDays(30)
      const name = get('Name') || `Atividade ${idx + 1}`
      return makeActivity({
        wbsCode: get('WBS') || String(idx + 1),
        name,
        start,
        end,
        serviceType: normalizeService(name),
        nucleusName: get('OutlineCode1') || '',
      }, idx)
    }).filter((a) => a.name && a.name.toLowerCase() !== 'null')
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  return rows.map((row, idx) => makeActivity({
    wbsCode: String(pick(row, ['wbs', 'codigo', 'item']) || `1.${idx + 1}`),
    name: String(pick(row, ['atividade', 'nome', 'tarefa', 'descricao']) || `Atividade ${idx + 1}`),
    start: toDate(pick(row, ['inicio', 'start'])) ?? today(),
    end: toDate(pick(row, ['fim', 'termino', 'finish'])) ?? plusDays(30),
    serviceType: normalizeService(pick(row, ['tipo', 'servico', 'rede'])),
    nucleusName: String(pick(row, ['nucleo', 'frente', 'comunidade']) || ''),
    lengthM: toNumber(pick(row, ['comprimento', 'extensao', 'metros']), 0),
    weight: toNumber(pick(row, ['peso', 'prioridade']), 1),
  }, idx))
}

function makeActivity(input: {
  wbsCode: string
  name: string
  start: string
  end: string
  serviceType: PlanServiceType
  nucleusName?: string
  lengthM?: number
  weight?: number
}, idx: number): DraftActivity {
  const durationDays = Math.max(1, Math.ceil((new Date(input.end).getTime() - new Date(input.start).getTime()) / 86_400_000))
  const networkType = input.serviceType === 'agua' || input.serviceType === 'esgoto' ? input.serviceType : input.serviceType === 'drenagem' ? 'civil' : 'geral'
  return {
    wbsCode: input.wbsCode || `1.${idx + 1}`,
    name: input.name,
    parentId: null,
    level: input.wbsCode.split('.').length,
    plannedStart: input.start,
    plannedEnd: input.end,
    trendStart: input.start,
    trendEnd: input.end,
    durationDays,
    percentComplete: 0,
    status: 'not_started',
    isMilestone: false,
    networkType,
    nucleo: input.nucleusName,
    comprimento: input.lengthM,
    weight: input.weight ?? 1,
    financialWeightPct: 0,
    physicalProgressPct: 0,
    financialProgressPct: 0,
    estimatedHH: Math.max(8, Math.round((input.lengthM || durationDays * 10) * 0.35)),
    equipmentDemand: { headcount: 6, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 },
    baselineStart: input.start,
    baselineEnd: input.end,
  }
}

export function CriarCronogramaWizard({ open, onClose }: Props) {
  const createGuidedPlan = usePlanejamentoMestreStore((s) => s.createGuidedPlan)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [contractName, setContractName] = useState('')
  const [contractor, setContractor] = useState('Sabesp')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(plusDays(180))
  const [bacTotal, setBacTotal] = useState(4_891_304)
  const [nucleusCount, setNucleusCount] = useState(6)
  const [nuclei, setNuclei] = useState<DraftNucleus[]>(Array.from({ length: 6 }, (_, idx) => ({
    name: `Nucleo ${idx + 1}`,
    location: '',
    serviceType: idx % 2 === 0 ? 'esgoto' : 'agua',
    bacWeightPct: Math.round((100 / 6) * 100) / 100,
    equipmentInventory: { retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 },
  })))
  const [activities, setActivities] = useState<DraftActivity[]>([
    makeActivity({ wbsCode: '1.1.1', name: 'Rede coletora - trecho inicial', start: today(), end: plusDays(45), serviceType: 'esgoto', nucleusName: 'Nucleo 1', lengthM: 120, weight: 5 }, 0),
    makeActivity({ wbsCode: '1.2.1', name: 'Rede de agua - interligacao', start: plusDays(20), end: plusDays(70), serviceType: 'agua', nucleusName: 'Nucleo 2', lengthM: 90, weight: 4 }, 1),
  ])

  const theoreticalTakt = useMemo(() => {
    const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000))
    return Math.max(1, Math.round(days / Math.max(1, nucleusCount)))
  }, [endDate, nucleusCount, startDate])

  if (!open) return null

  function syncNucleusCount(count: number) {
    setNucleusCount(count)
    setNuclei((prev) => {
      const next = [...prev]
      while (next.length < count) next.push({ name: `Nucleo ${next.length + 1}`, location: '', serviceType: 'esgoto', bacWeightPct: 100 / count, equipmentInventory: { retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } })
      return next.slice(0, count).map((n) => ({ ...n, bacWeightPct: Math.round((100 / count) * 100) / 100 }))
    })
  }

  function next() {
    setError(null)
    if (step === 1) {
      if (!contractName.trim()) return setError('Informe o nome do contrato.')
      if (!startDate || !endDate || endDate <= startDate) return setError('Informe datas validas.')
      if (bacTotal <= 0) return setError('Informe o BAC total.')
    }
    if (step === 2) {
      const total = nuclei.reduce((s, n) => s + n.bacWeightPct, 0)
      if (nuclei.some((n) => !n.name.trim())) return setError('Todos os nucleos precisam de nome.')
      if (Math.abs(total - 100) > 1) return setError('Os pesos dos nucleos precisam somar 100%.')
    }
    if (step === 3 && activities.length === 0) return setError('Cadastre ou importe pelo menos uma atividade.')
    setStep((s) => Math.min(4, s + 1))
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const parsed = await parseScheduleFile(file)
      if (parsed.length === 0) throw new Error('Nenhuma atividade valida encontrada.')
      setActivities(parsed.map((a, idx) => ({ ...a, financialWeightPct: Math.round((100 / parsed.length) * 100) / 100, nucleo: a.nucleo || nuclei[idx % nuclei.length]?.name })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar arquivo.')
    }
  }

  function generate() {
    createGuidedPlan({
      contract: { contractName: contractName.trim(), contractor: contractor.trim(), startDate, endDate, bacTotal, nucleusCount },
      nuclei,
      activities: activities.map((a, idx) => ({ ...a, financialWeightPct: a.financialWeightPct || Math.round((100 / activities.length) * 100) / 100, nucleo: a.nucleo || nuclei[idx % nuclei.length]?.name })),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#525252] bg-[#2c2c2c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#525252] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f97316]"><Sparkles size={18} className="text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-[#f5f5f5]">Criar Planejamento do Zero</h2>
              <p className="text-xs text-[#a3a3a3]">Etapa {step} de 4</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>
        <div className="h-1 bg-[#3d3d3d]"><div className="h-full bg-[#f97316] transition-all" style={{ width: `${(step / 4) * 100}%` }} /></div>
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nome do contrato"><input value={contractName} onChange={(e) => setContractName(e.target.value)} className={inputCls} placeholder="Contrato Sabesp - Setor Norte" /></Field>
              <Field label="Contratante"><input value={contractor} onChange={(e) => setContractor(e.target.value)} className={inputCls} /></Field>
              <Field label="Data de inicio"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
              <Field label="Data de fim"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></Field>
              <Field label="BAC total"><input type="number" value={bacTotal} onChange={(e) => setBacTotal(Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Quantidade de nucleos"><input type="number" min={1} max={12} value={nucleusCount} onChange={(e) => syncNucleusCount(Math.max(1, Number(e.target.value) || 1))} className={inputCls} /></Field>
              <Summary label="Takt teorico por nucleo" value={`${theoreticalTakt} dias`} />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              {nuclei.map((n, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border border-[#525252] bg-[#333333] p-4 md:grid-cols-5">
                  <Field label="Nome"><input value={n.name} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} className={inputCls} /></Field>
                  <Field label="Localizacao"><input value={n.location} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, location: e.target.value } : r))} className={inputCls} /></Field>
                  <Field label="Servico"><select value={n.serviceType} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, serviceType: e.target.value as PlanServiceType } : r))} className={inputCls}>{SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="% BAC"><input type="number" value={n.bacWeightPct} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, bacWeightPct: Number(e.target.value) } : r))} className={inputCls} /></Field>
                  <div className="flex flex-col justify-end text-xs text-[#a3a3a3]"><span>Orcamento</span><strong className="text-[#f5f5f5]">{(bacTotal * (n.bacWeightPct / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong></div>
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[#a3a3a3]">{activities.length} atividade(s) cadastradas</p>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.xml,.mpp" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-[#525252] px-3 py-2 text-sm text-[#f5f5f5] hover:bg-[#3d3d3d]"><FileUp size={14} /> Importar XLSX/XML</button>
                  <button onClick={() => setActivities((rows) => [...rows, makeActivity({ wbsCode: `1.${rows.length + 1}`, name: '', start: startDate, end: endDate, serviceType: 'esgoto', nucleusName: nuclei[0]?.name }, rows.length)])} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={14} /> Atividade</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#525252]">
                <table className="w-full text-xs">
                  <thead className="bg-[#333333] text-[#a3a3a3]"><tr><th className="px-3 py-2 text-left">WBS</th><th className="px-3 py-2 text-left">Atividade</th><th className="px-3 py-2 text-left">Nucleo</th><th className="px-3 py-2 text-right">% Fin.</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {activities.map((a, idx) => (
                      <tr key={idx} className="border-t border-[#3d3d3d]">
                        <td className="px-3 py-2"><input value={a.wbsCode} onChange={(e) => setActivities((rows) => rows.map((r, i) => i === idx ? { ...r, wbsCode: e.target.value } : r))} className={cellCls} /></td>
                        <td className="px-3 py-2"><input value={a.name} onChange={(e) => setActivities((rows) => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} className={cellCls} /></td>
                        <td className="px-3 py-2"><input value={a.nucleo ?? ''} onChange={(e) => setActivities((rows) => rows.map((r, i) => i === idx ? { ...r, nucleo: e.target.value } : r))} className={cellCls} /></td>
                        <td className="px-3 py-2"><input type="number" value={a.financialWeightPct ?? 0} onChange={(e) => setActivities((rows) => rows.map((r, i) => i === idx ? { ...r, financialWeightPct: Number(e.target.value) } : r))} className={`${cellCls} text-right`} /></td>
                        <td className="px-3 py-2"><button onClick={() => setActivities((rows) => rows.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Summary label="Contrato" value={contractName || '-'} />
              <Summary label="Nucleos" value={String(nuclei.length)} />
              <Summary label="Atividades" value={String(activities.length)} />
              <Summary label="Takt" value={`${theoreticalTakt}d`} />
            </div>
          )}
          {error && <div className="mt-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
        </div>
        <div className="flex items-center justify-between border-t border-[#525252] bg-[#1f1f1f] px-6 py-3">
          {step > 1 ? <button onClick={() => setStep((s) => Math.max(1, s - 1))} className="flex items-center gap-1.5 rounded px-3 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]"><ChevronLeft size={14} /> Voltar</button> : <span />}
          {step < 4 ? <button onClick={next} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Proximo <ChevronRight size={14} /></button> : <button onClick={generate} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-sm font-bold text-white"><Sparkles size={14} /> Gerar Planejamento</button>}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]'
const cellCls = 'w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">{label}{children}</label>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#525252] bg-[#333333] p-4"><p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">{label}</p><p className="mt-1 text-lg font-bold text-[#f5f5f5]">{value}</p></div>
}
