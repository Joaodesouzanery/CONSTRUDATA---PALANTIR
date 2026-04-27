import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, FileUp, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import type { ImportedScheduleRow, PlanServiceType, PlanTrecho, PlanningNucleus } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

type DraftNucleus = Omit<PlanningNucleus, 'id' | 'budgetBRL'>
type DraftTrecho = Omit<PlanTrecho, 'id'>

const SERVICE_OPTIONS: Array<{ value: PlanServiceType; label: string }> = [
  { value: 'esgoto', label: 'Esgoto' },
  { value: 'agua', label: 'Água' },
  { value: 'drenagem', label: 'Drenagem' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'edificacao', label: 'Edificação' },
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

function toDate(value: unknown): string | undefined {
  if (!value) return undefined
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const br = text.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return undefined
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
  const keys = Object.keys(row)
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const found = keys.find((k) => names.some((name) => norm(k).includes(norm(name))))
  return found ? row[found] : undefined
}

function importRowsToTrechos(rows: ImportedScheduleRow[]): DraftTrecho[] {
  return rows.map((row, idx) => {
    const lengthM = Math.max(1, row.lengthM ?? Math.max(1, (row.durationDays ?? 1) * 12))
    return {
      code: row.code || `IMP-${String(idx + 1).padStart(3, '0')}`,
      description: row.name,
      lengthM,
      depthM: row.depthM ?? 1.5,
      diameterMm: row.diameterMm ?? 200,
      soilType: 'normal',
      requiresShoring: (row.depthM ?? 1.5) >= 1.8,
      unitCostBRL: row.unitCostBRL ?? 350,
      activityType: row.serviceType ?? 'outro',
      financialWeightPct: rows.length > 0 ? 100 / rows.length : 0,
      physicalProgressPct: 0,
      financialProgressPct: 0,
      estimatedHH: Math.round(lengthM * 0.35),
      equipmentDemand: { headcount: 6, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 },
      plannedStartDate: row.startDate,
      plannedEndDate: row.endDate,
      notes: row.nucleusName ? `Núcleo importado: ${row.nucleusName}` : undefined,
    }
  })
}

async function parseScheduleFile(file: File): Promise<ImportedScheduleRow[]> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'mpp') throw new Error('Arquivo .mpp binário não é lido diretamente. Exporte o cronograma no MS Project como XML ou XLSX e importe novamente.')
  const buffer = await file.arrayBuffer()
  if (ext === 'xml') {
    const xml = new TextDecoder('utf-8').decode(buffer)
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const tasks = Array.from(doc.getElementsByTagName('Task'))
    return tasks
      .map((task, idx) => {
        const get = (tag: string) => task.getElementsByTagName(tag)[0]?.textContent?.trim()
        const name = get('Name') || ''
        return {
          code: get('WBS') || get('ID') || `MSP-${idx + 1}`,
          name,
          startDate: toDate(get('Start')?.slice(0, 10)),
          endDate: toDate(get('Finish')?.slice(0, 10)),
          durationDays: Number(get('Duration')?.match(/\d+/)?.[0] ?? 1),
          serviceType: normalizeService(name),
        }
      })
      .filter((row) => row.name && row.name.toLowerCase() !== 'null')
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  return rows.map((row, idx) => ({
    code: String(pick(row, ['codigo', 'wbs', 'id']) || `XLS-${idx + 1}`),
    name: String(pick(row, ['atividade', 'nome', 'tarefa', 'descricao', 'servico']) || `Atividade ${idx + 1}`),
    startDate: toDate(pick(row, ['inicio', 'start'])),
    endDate: toDate(pick(row, ['fim', 'termino', 'finish'])),
    durationDays: Number(pick(row, ['duracao', 'duration']) || 1),
    nucleusName: String(pick(row, ['nucleo', 'frente']) || ''),
    serviceType: normalizeService(pick(row, ['tipo', 'servico'])),
    lengthM: Number(pick(row, ['comprimento', 'extensao', 'metros']) || 0) || undefined,
    depthM: Number(pick(row, ['profundidade']) || 0) || undefined,
    diameterMm: Number(pick(row, ['diametro', 'dn']) || 0) || undefined,
    unitCostBRL: Number(pick(row, ['custo', 'valor', 'r$/m']) || 0) || undefined,
    predecessors: String(pick(row, ['predecessor']) || ''),
  }))
}

export function PlanningCreationWizard({ open, onClose }: Props) {
  const createGuidedPlan = usePlanejamentoStore((s) => s.createGuidedPlan)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [contractName, setContractName] = useState('')
  const [contractor, setContractor] = useState('Sabesp')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(plusDays(180))
  const [bacTotal, setBacTotal] = useState(4_891_304)
  const [nucleusCount, setNucleusCount] = useState(2)
  const [nuclei, setNuclei] = useState<DraftNucleus[]>([
    { name: 'Núcleo 1', location: '', serviceType: 'esgoto', bacWeightPct: 50, equipmentInventory: { retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } },
    { name: 'Núcleo 2', location: '', serviceType: 'agua', bacWeightPct: 50, equipmentInventory: { retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } },
  ])
  const [trechos, setTrechos] = useState<DraftTrecho[]>([
    { code: 'T001', description: 'Rede coletora - trecho inicial', lengthM: 120, depthM: 1.6, diameterMm: 200, soilType: 'normal', requiresShoring: false, unitCostBRL: 350, activityType: 'esgoto', financialWeightPct: 50, physicalProgressPct: 0, financialProgressPct: 0, estimatedHH: 42, equipmentDemand: { headcount: 6, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } },
    { code: 'T002', description: 'Interligação de rede', lengthM: 90, depthM: 1.4, diameterMm: 150, soilType: 'normal', requiresShoring: false, unitCostBRL: 320, activityType: 'agua', financialWeightPct: 50, physicalProgressPct: 0, financialProgressPct: 0, estimatedHH: 32, equipmentDemand: { headcount: 6, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } },
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
      while (next.length < count) next.push({ name: `Núcleo ${next.length + 1}`, location: '', serviceType: 'esgoto', bacWeightPct: Math.round(100 / count), equipmentInventory: { retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } })
      return next.slice(0, count).map((n) => ({ ...n, bacWeightPct: Math.round((100 / count) * 100) / 100 }))
    })
  }

  function next() {
    setError(null)
    if (step === 1) {
      if (!contractName.trim()) return setError('Informe o nome do contrato.')
      if (!startDate || !endDate || endDate <= startDate) return setError('Informe datas válidas.')
      if (bacTotal <= 0) return setError('Informe o BAC total.')
    }
    if (step === 2) {
      const total = nuclei.reduce((s, n) => s + n.bacWeightPct, 0)
      if (nuclei.some((n) => !n.name.trim())) return setError('Todos os núcleos precisam de nome.')
      if (Math.abs(total - 100) > 0.5) return setError('Os pesos dos núcleos precisam somar 100%.')
    }
    if (step === 3 && trechos.length === 0) return setError('Cadastre ou importe pelo menos um trecho.')
    setStep((s) => Math.min(4, s + 1))
  }

  function addTrecho() {
    const n = trechos.length + 1
    setTrechos((prev) => [...prev, { code: `T${String(n).padStart(3, '0')}`, description: '', lengthM: 100, depthM: 1.5, diameterMm: 200, soilType: 'normal', requiresShoring: false, unitCostBRL: 350, activityType: nuclei[n % Math.max(1, nuclei.length)]?.serviceType ?? 'outro', financialWeightPct: Math.round((100 / (prev.length + 1)) * 100) / 100, physicalProgressPct: 0, financialProgressPct: 0, estimatedHH: 35, equipmentDemand: { headcount: 6, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 } }])
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const rows = await parseScheduleFile(file)
      if (rows.length === 0) throw new Error('Nenhuma atividade válida encontrada.')
      setTrechos(importRowsToTrechos(rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar arquivo.')
    }
  }

  function generate() {
    createGuidedPlan({
      contract: { contractName: contractName.trim(), contractor: contractor.trim(), startDate, endDate, bacTotal, nucleusCount },
      nuclei,
      trechos,
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
              <Field label="Contratante"><input value={contractor} onChange={(e) => setContractor(e.target.value)} className={inputCls} placeholder="Sabesp" /></Field>
              <Field label="Data de início"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
              <Field label="Data de fim"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></Field>
              <Field label="BAC total"><input type="number" value={bacTotal} onChange={(e) => setBacTotal(Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Quantidade de núcleos"><input type="number" min={1} max={12} value={nucleusCount} onChange={(e) => syncNucleusCount(Math.max(1, Number(e.target.value) || 1))} className={inputCls} /></Field>
              <div className="rounded-lg border border-[#525252] bg-[#333333] p-4 md:col-span-2">
                <p className="text-xs text-[#a3a3a3]">Takt teórico sugerido por núcleo</p>
                <p className="mt-1 text-2xl font-bold text-[#f97316]">{theoreticalTakt} dias</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {nuclei.map((n, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border border-[#525252] bg-[#333333] p-4 md:grid-cols-5">
                  <Field label="Nome"><input value={n.name} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} className={inputCls} /></Field>
                  <Field label="Localização"><input value={n.location} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, location: e.target.value } : r))} className={inputCls} /></Field>
                  <Field label="Serviço"><select value={n.serviceType} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, serviceType: e.target.value as PlanServiceType } : r))} className={inputCls}>{SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="% BAC"><input type="number" value={n.bacWeightPct} onChange={(e) => setNuclei((rows) => rows.map((r, i) => i === idx ? { ...r, bacWeightPct: Number(e.target.value) } : r))} className={inputCls} /></Field>
                  <div className="flex flex-col justify-end text-xs text-[#a3a3a3]"><span>Orçamento</span><strong className="text-[#f5f5f5]">{(bacTotal * (n.bacWeightPct / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong></div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[#a3a3a3]">{trechos.length} trecho(s) cadastrados</p>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.xml,.mpp" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-[#525252] px-3 py-2 text-sm text-[#f5f5f5] hover:bg-[#3d3d3d]"><FileUp size={14} /> Importar XLSX/XML</button>
                  <button onClick={addTrecho} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={14} /> Trecho</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#525252]">
                <table className="w-full text-xs">
                  <thead className="bg-[#333333] text-[#a3a3a3]"><tr><th className="px-3 py-2 text-left">Código</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">m</th><th className="px-3 py-2 text-right">Prof.</th><th className="px-3 py-2 text-right">R$/m</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {trechos.map((t, idx) => (
                      <tr key={idx} className="border-t border-[#3d3d3d]">
                        <td className="px-3 py-2"><input value={t.code} onChange={(e) => setTrechos((rows) => rows.map((r, i) => i === idx ? { ...r, code: e.target.value } : r))} className={cellCls} /></td>
                        <td className="px-3 py-2"><input value={t.description} onChange={(e) => setTrechos((rows) => rows.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))} className={cellCls} /></td>
                        <td className="px-3 py-2"><input type="number" value={t.lengthM} onChange={(e) => setTrechos((rows) => rows.map((r, i) => i === idx ? { ...r, lengthM: Number(e.target.value) } : r))} className={`${cellCls} text-right`} /></td>
                        <td className="px-3 py-2"><input type="number" value={t.depthM} onChange={(e) => setTrechos((rows) => rows.map((r, i) => i === idx ? { ...r, depthM: Number(e.target.value), requiresShoring: Number(e.target.value) >= 1.8 } : r))} className={`${cellCls} text-right`} /></td>
                        <td className="px-3 py-2"><input type="number" value={t.unitCostBRL ?? 0} onChange={(e) => setTrechos((rows) => rows.map((r, i) => i === idx ? { ...r, unitCostBRL: Number(e.target.value) } : r))} className={`${cellCls} text-right`} /></td>
                        <td className="px-3 py-2"><button onClick={() => setTrechos((rows) => rows.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={13} /></button></td>
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
              <Summary label="Núcleos" value={String(nuclei.length)} />
              <Summary label="Trechos" value={String(trechos.length)} />
              <Summary label="Takt" value={`${theoreticalTakt}d`} />
              <div className="col-span-2 rounded-lg border border-[#525252] bg-[#333333] p-4 md:col-span-4">
                <p className="text-sm font-semibold text-[#f5f5f5]">Ao concluir</p>
                <p className="mt-1 text-xs text-[#a3a3a3]">O sistema cria Rev.0, gera equipes por núcleo, distribui BAC, calcula cronograma inicial, curva S, histograma e abre o Gantt para ajustes.</p>
              </div>
            </div>
          )}

          {error && <div className="mt-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
        </div>
        <div className="flex items-center justify-between border-t border-[#525252] bg-[#1f1f1f] px-6 py-3">
          {step > 1 ? <button onClick={() => setStep((s) => Math.max(1, s - 1))} className="flex items-center gap-1.5 rounded px-3 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]"><ChevronLeft size={14} /> Voltar</button> : <span />}
          {step < 4 ? <button onClick={next} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white">Próximo <ChevronRight size={14} /></button> : <button onClick={generate} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-sm font-bold text-white"><Sparkles size={14} /> Gerar Planejamento</button>}
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
