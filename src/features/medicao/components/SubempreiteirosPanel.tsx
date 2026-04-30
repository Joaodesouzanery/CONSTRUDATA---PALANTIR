import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, FileDown, Plus, RefreshCw, Trash2, Upload, Users, X as XIcon } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import type { Subempreiteiro, SubempreteiroItem } from '@/store/medicaoBillingStore'
import { readWorkbook, parseSubempreiteiroSheet } from '../utils/xlsxParsers'
import type { SubempreiteiroParseResult } from '../utils/xlsxParsers'
import { exportSubempreiteirosPdf } from '../utils/exportPdf'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { getCriadouroLabel, getRdoSabespExecutedServices } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import { useContractorStore } from '@/store/contractorStore'

type TabId = 'resumo' | 'rdos' | 'itens' | 'parametros' | 'descontos' | 'rh' | 'nfs'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'rdos', label: 'RDOs' },
  { id: 'itens', label: 'Itens Medidos' },
  { id: 'parametros', label: 'Parâmetros e Retenção' },
  { id: 'descontos', label: 'Descontos' },
  { id: 'rh', label: 'RH' },
  { id: 'nfs', label: 'NFs' },
]

const fieldClass = 'rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]'
const btnMuted = 'inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#484848] px-3 py-2 text-xs font-medium text-[#f5f5f5] hover:bg-[#525252]'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function monthFromDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value.slice(0, 7)
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function isKnownNucleo(value: string) {
  return Boolean(value && value !== 'Nao informado')
}

function itemTotal(item: SubempreteiroItem) {
  return item.qtd * item.valorUnitario
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
  XLSX.utils.book_append_sheet(wb, ws, 'Template Subempreiteiro')
  XLSX.writeFile(wb, 'Template_Subempreiteiro_ConstruData.xlsx')
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
          <span className="text-sm font-semibold text-white">Novo Subempreiteiro</span>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-white"><XIcon size={16} /></button>
        </div>
        <div className="space-y-3 p-5">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Empreiteira / Subempreiteiro" className={fieldClass} />
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

function ImportSubBtn({ subId, periodo }: { subId?: string; periodo: string }) {
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

  function confirm() {
    if (!preview || preview.errors.length) return
    const payload = {
      nome: preview.nome,
      nucleo: preview.nucleo,
      periodo: preview.periodo || periodo,
      itens: preview.itens.map((item) => ({ ...item, origem: 'Importação XLSX' as const, mes: item.mes || preview.periodo || periodo })),
      parametros: preview.parametros ?? [],
      descontos: preview.descontos ?? [],
      rh: preview.rh ?? [],
      nfs: preview.nfs ?? [],
      retencoes: preview.retencoes ?? [],
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
    setPreview(null)
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} className={btnMuted}>
        <Upload size={13} /> {loading ? 'Lendo...' : 'Importar XLSX'}
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
            <p className="text-sm font-semibold text-white">Geral - todos os subempreiteiros</p>
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
  const descontos = (sub.descontos ?? []).reduce((sum, item) => sum + item.total, 0)
  const nfPago = (sub.nfs ?? []).reduce((sum, nf) => sum + nf.valorPago, 0)
  const saldoRetencao = (sub.retencoes ?? []).at(-1)?.saldoFinal ?? sub.retencao
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Metric label="Medição" value={fmt(sub.totalMedido)} />
      <Metric label="Medição aprovada" value={fmt(sub.totalAprovado)} />
      <Metric label="Descontos" value={fmt(descontos)} />
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
        return (
          <div key={rdo.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">{rdo.report_date}</span>
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">{nucleo}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${contractor ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {contractor?.name || 'Empreiteira pendente'}
              </span>
              {rdo.encarregado && <span className="text-xs text-[#a3a3a3]">{rdo.encarregado}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {services.map((service) => (
                <span key={service.service_id} className="rounded-full border border-[#525252] px-2 py-1 text-xs text-[#d4d4d4]">
                  {service.services_catalog.name}: {fmtNum(service.quantity)} {service.unit}
                </span>
              ))}
            </div>
          </div>
        )
      })}
      {rows.length === 0 && <p className="py-8 text-center text-sm text-[#6b6b6b]">Nenhum RDO Sabesp finalizado encontrado.</p>}
      <p className="text-xs text-[#6b6b6b]">Empreiteiras cadastradas: {contractors.filter((item) => !item.deleted_at).length}</p>
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
                return <td key={column} className="p-2">{moneyCols.includes(column) ? fmt(Number(value) || 0) : String(value ?? '')}</td>
              })}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SubempreiteirosPanel() {
  const { getActiveBoletim, addSubempreiteiro, updateSubempreiteiro, removeSubempreiteiro, syncRdoSabespSubempreiteiros } = useMedicaoBillingStore()
  const contractorStore = useContractorStore()
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('resumo')
  const [selectedId, setSelectedId] = useState('__all')
  const [contractorFilter, setContractorFilter] = useState('all')
  const [nucleoFilter, setNucleoFilter] = useState('all')
  const [lastSyncMessage, setLastSyncMessage] = useState('')
  const boletim = getActiveBoletim()

  useEffect(() => {
    void contractorStore.load()
  }, [contractorStore.load])

  const rdoRows = useMemo(() => {
    return readLocalRdoSabesp().filter((rdo) => rdo.status !== 'draft').flatMap((rdo) => {
      const contractor = contractorStore.resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
      const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
      if (!contractor || !isKnownNucleo(nucleo)) return []
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
      }))
    })
  }, [contractorStore.contractors, contractorStore.foremen, contractorStore.rdoLinks])

  const pendingRdoCount = useMemo(() => {
    return readLocalRdoSabesp().filter((rdo) => {
      if (rdo.status === 'draft') return false
      const contractor = contractorStore.resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
      const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
      return !contractor || !isKnownNucleo(nucleo)
    }).length
  }, [contractorStore.contractors, contractorStore.foremen, contractorStore.rdoLinks])

  useEffect(() => {
    if (rdoRows.length > 0) syncRdoSabespSubempreiteiros(rdoRows)
  }, [rdoRows, syncRdoSabespSubempreiteiros])

  function handleSyncRdos() {
    syncRdoSabespSubempreiteiros(rdoRows)
    if (rdoRows.length === 0) {
      setLastSyncMessage('Nenhum RDO Sabesp apto para sincronizar. Confira se ele esta finalizado, com empreiteiro, nucleo e servicos executados.')
      return
    }
    setLastSyncMessage(`${rdoRows.length} item(ns) de RDO sincronizado(s) por empreiteiro, nucleo e mes.`)
  }

  const subs = boletim?.subempreiteiros ?? []
  const rdoFilterRefs = useMemo(() => {
    return readLocalRdoSabesp().filter((rdo) => rdo.status !== 'draft').map((rdo) => ({
      contractor: contractorStore.resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })?.name ?? '',
      nucleo: getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro),
    }))
  }, [contractorStore.contractors, contractorStore.foremen, contractorStore.rdoLinks])
  const contractorOptions = useMemo(() => Array.from(new Set([
    ...contractorStore.contractors.filter((item) => !item.deleted_at).map((item) => item.name),
    ...subs.map((sub) => sub.nome),
    ...rdoFilterRefs.map((item) => item.contractor),
  ].filter(Boolean))).sort(), [contractorStore.contractors, rdoFilterRefs, subs])
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
    nome: 'Todos os subempreiteiros',
    nucleo: nucleoFilter === 'all' ? 'Todos os núcleos' : nucleoFilter,
    periodo: boletim?.periodo ?? '',
    contractorId: null,
    itens: filteredSubs.flatMap((sub) => sub.itens.map((item) => ({
      ...item,
      contractorId: item.contractorId ?? sub.contractorId ?? null,
      nucleo: item.nucleo ?? sub.nucleo,
    }))),
    parametros: filteredSubs.flatMap((sub) => sub.parametros ?? []),
    descontos: filteredSubs.flatMap((sub) => sub.descontos ?? []),
    rh: filteredSubs.flatMap((sub) => sub.rh ?? []),
    nfs: filteredSubs.flatMap((sub) => sub.nfs ?? []),
    retencoes: filteredSubs.flatMap((sub) => sub.retencoes ?? []),
    totalMedido: filteredSubs.reduce((sum, sub) => sum + sub.totalMedido, 0),
    totalAprovado: filteredSubs.reduce((sum, sub) => sum + sub.totalAprovado, 0),
    retencao: filteredSubs.reduce((sum, sub) => sum + sub.retencao, 0),
  }), [boletim?.periodo, filteredSubs, nucleoFilter])
  const selected = selectedId === '__all' ? aggregateSub : filteredSubs.find((sub) => sub.id === selectedId) ?? filteredSubs[0] ?? null

  useEffect(() => {
    if (!selectedId) {
      setSelectedId('__all')
      return
    }
    if (selectedId !== '__all' && !filteredSubs.some((sub) => sub.id === selectedId)) {
      setSelectedId('__all')
    }
  }, [filteredSubs, selectedId])

  if (!boletim) return <div className="p-8 text-center text-sm text-[#6b6b6b]">Nenhum boletim ativo.</div>

  const totalAprovado = filteredSubs.reduce((sum, sub) => sum + sub.totalAprovado, 0)
  const totalRetencao = filteredSubs.reduce((sum, sub) => sum + sub.retencao, 0)

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Subempreiteiros</h2>
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
        <Metric label="Subempreiteiros" value={filteredSubs.length} />
        <Metric label="Total aprovado" value={fmt(totalAprovado)} />
        <Metric label="Retenção registrada" value={fmt(totalRetencao)} />
      </div>

      <div className="grid gap-2 rounded-xl border border-[#525252] bg-[#2c2c2c] p-3 md:grid-cols-2">
        <select value={contractorFilter} onChange={(event) => setContractorFilter(event.target.value)} className={fieldClass}>
          <option value="all">Todos os empreiteiros</option>
          {contractorOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={nucleoFilter} onChange={(event) => setNucleoFilter(event.target.value)} className={fieldClass}>
          <option value="all">Todos os nucleos</option>
          {nucleoOptions.map((nucleo) => <option key={nucleo} value={nucleo}>{nucleo}</option>)}
        </select>
      </div>

      <SubSelector subs={filteredSubs} selectedId={selected?.id ?? ''} onSelect={setSelectedId} onRemove={removeSubempreiteiro} />

      {!selected ? (
        <div className="py-12 text-center text-sm text-[#6b6b6b]">
          <Users size={32} className="mx-auto mb-3 text-[#525252]" />
          Nenhum subempreiteiro encontrado para o filtro.
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
            {activeTab === 'resumo' && <ResumoTab sub={selected} />}
            {activeTab === 'rdos' && <RdosTab pendingCount={pendingRdoCount} contractorFilter={contractorFilter} nucleoFilter={nucleoFilter} />}
            {activeTab === 'itens' && selected.id !== '__all' && <ItensTab sub={selected} onUpdate={(patch) => updateSubempreiteiro(selected.id, patch)} />}
            {activeTab === 'itens' && selected.id === '__all' && <DataTable rows={selected.itens} columns={['mes', 'nucleo', 'nPreco', 'descricao', 'unidade', 'qtd', 'valorUnitario', 'origem', 'rdoId']} moneyCols={['valorUnitario']} />}
            {activeTab === 'parametros' && <ParametrosTab sub={selected} />}
            {activeTab === 'descontos' && <DataTable rows={selected.descontos ?? []} columns={['mes', 'rh', 'agregados', 'materiaisFerramentas', 'materiaisEpi', 'maquinas', 'combustivel', 'epi', 'total']} moneyCols={['rh', 'agregados', 'materiaisFerramentas', 'materiaisEpi', 'maquinas', 'combustivel', 'epi', 'total']} />}
            {activeTab === 'rh' && <DataTable rows={selected.rh ?? []} columns={['mes', 'funcionariosClt', 'funcionariosPj', 'adiantamento', 'folhaSalarial', 'folhaPj', 'inss', 'total']} moneyCols={['adiantamento', 'folhaSalarial', 'folhaPj', 'inss', 'total']} />}
            {activeTab === 'nfs' && <DataTable rows={selected.nfs ?? []} columns={['numero', 'fornecedor', 'valorNf', 'valorPago', 'dataEmissao', 'vencimento', 'competencia', 'status', 'dataPagamento']} moneyCols={['valorNf', 'valorPago']} />}
          </div>
        </div>
      )}

      {addOpen && <AddSubModal onClose={() => setAddOpen(false)} onAdd={addSubempreiteiro} periodo={boletim.periodo} />}
    </div>
  )
}
