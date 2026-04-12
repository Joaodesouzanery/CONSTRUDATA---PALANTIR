/**
 * SubempreiteirosPanel — Step 3: Planilhas dos Subempreiteiros.
 *
 * Add/edit subcontractor measurement sheets (e.g., VIALTA - São Manuel).
 * Each subcontractor has: nome, nucleo, periodo, line items (nPreco → qtd → valor),
 * and totals (medido / aprovado / retenção).
 */
import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Users, Upload, AlertCircle, X as XIcon, FileDown, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import type { Subempreiteiro, SubempreteiroItem } from '@/store/medicaoBillingStore'
import { readWorkbook, parseSubempreiteiroSheet } from '../utils/xlsxParsers'
import type { SubempreiteiroParseResult } from '../utils/xlsxParsers'
import { exportSubempreiteirosPdf } from '../utils/exportPdf'

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

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// ─── Add Subempreiteiro Modal ─────────────────────────────────────────────────

interface AddSubModalProps {
  onClose: () => void
  onAdd:   (sub: Omit<Subempreiteiro, 'id'>) => void
  periodo: string
}

function AddSubModal({ onClose, onAdd, periodo }: AddSubModalProps) {
  const [nome,    setNome]    = useState('')
  const [nucleo,  setNucleo]  = useState('')
  const [per,     setPer]     = useState(periodo)
  const [itens,   setItens]   = useState<SubempreteiroItem[]>([])
  const [totalMedido,   setTotalMedido]   = useState('')
  const [totalAprovado, setTotalAprovado] = useState('')
  const [retencao,      setRetencao]      = useState('')

  function addItem() {
    setItens((prev) => [...prev, { nPreco: '', nPrecoSabesp: '', descricao: '', unidade: 'M', qtd: 0, valorUnitario: 0 }])
  }
  function updateItem(idx: number, patch: Partial<SubempreteiroItem>) {
    if (patch.qtd !== undefined) patch.qtd = isNaN(patch.qtd) ? 0 : patch.qtd
    if (patch.valorUnitario !== undefined) patch.valorUnitario = isNaN(patch.valorUnitario) ? 0 : patch.valorUnitario
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleAdd() {
    if (!nome.trim()) return
    onAdd({
      nome:          nome.trim(),
      nucleo:        nucleo.trim(),
      periodo:       per.trim(),
      itens,
      totalMedido:   parseFloat(totalMedido.replace(',', '.'))   || 0,
      totalAprovado: parseFloat(totalAprovado.replace(',', '.')) || 0,
      retencao:      parseFloat(retencao.replace(',', '.'))      || 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Novo Subempreiteiro</span>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Nome / Empresa</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: VIALTA"
                className="w-full bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            </div>
            <div>
              <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Período</label>
              <input value={per} onChange={(e) => setPer(e.target.value)} placeholder="fev/26"
                className="w-full bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Núcleo</label>
              <input value={nucleo} onChange={(e) => setNucleo(e.target.value)} placeholder="ex.: São Manuel"
                className="w-full bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="text-[10px] text-[#a3a3a3] font-semibold uppercase mb-2">Itens de Medição</div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center flex-wrap">
                  <input value={it.nPreco} onChange={(e) => updateItem(idx, { nPreco: e.target.value })}
                    placeholder="Nº Preço"
                    className="w-24 bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                  <input value={it.nPrecoSabesp} onChange={(e) => updateItem(idx, { nPrecoSabesp: e.target.value })}
                    placeholder="Vínc. Sabesp"
                    title="N. Preço da Sabesp vinculado"
                    className="w-24 bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                  <input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                    placeholder="Descrição"
                    className="flex-1 bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                  <input value={it.unidade} onChange={(e) => updateItem(idx, { unidade: e.target.value })}
                    placeholder="Un" className="w-12 bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                  <input type="number" value={it.qtd} onChange={(e) => updateItem(idx, { qtd: parseFloat(e.target.value) || 0 })}
                    placeholder="Qtd" className="w-20 bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                  <input type="number" value={it.valorUnitario} onChange={(e) => updateItem(idx, { valorUnitario: parseFloat(e.target.value) || 0 })}
                    placeholder="R$/Un" className="w-24 bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:bg-red-900/20 rounded p-1"><Trash2 size={12} /></button>
                </div>
              ))}
              <button type="button" onClick={addItem}
                className="flex items-center gap-1.5 text-[#f97316] text-xs hover:text-[#ea580c] transition-colors">
                <Plus size={13} /> Adicionar item
              </button>
            </div>
          </div>

          {/* Totais */}
          <div className="grid grid-cols-3 gap-3 border-t border-[#525252] pt-4">
            <div>
              <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Total Medido (R$)</label>
              <input value={totalMedido} onChange={(e) => setTotalMedido(e.target.value)} placeholder="0,00"
                className="w-full bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            </div>
            <div>
              <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Total Aprovado (R$)</label>
              <input value={totalAprovado} onChange={(e) => setTotalAprovado(e.target.value)} placeholder="0,00"
                className="w-full bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            </div>
            <div>
              <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Retenção (R$)</label>
              <input value={retencao} onChange={(e) => setRetencao(e.target.value)} placeholder="0,00"
                className="w-full bg-[#1f1f1f] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button onClick={handleAdd} disabled={!nome.trim()}
            className="px-5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#f97316' }}>
            Salvar Subempreiteiro
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main-level import: creates a NEW subempreiteiro from XLSX ───────────────

function ImportSubNewBtn({ periodo }: { periodo: string }) {
  const { addSubempreiteiro } = useMedicaoBillingStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const wb = await readWorkbook(file)
      const result = parseSubempreiteiroSheet(wb)
      if (result.errors.length > 0) { alert(result.errors.join('\n')); return }
      // Create new subempreiteiro and import items
      addSubempreiteiro({
        nome: result.nome,
        nucleo: result.nucleo || '',
        periodo: result.periodo || periodo,
        itens: result.itens,
        totalMedido: result.totals.totalMedido,
        totalAprovado: result.totals.totalAprovado,
        retencao: result.totals.retencao,
      })
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={loading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-50 transition-colors">
        <Upload size={13} /> {loading ? 'Lendo...' : 'Importar XLSX'}
      </button>
    </>
  )
}

// ─── Import button for subcontractor card ─────────────────────────────────────

function ImportSubBtn({ subId }: { subId: string }) {
  const { importSubempreiteiroItems } = useMedicaoBillingStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<SubempreiteiroParseResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
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

  function handleConfirm() {
    if (!preview) return
    importSubempreiteiroItems(subId, preview.itens, preview.totals)
    setPreview(null)
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        title="Importar planilha XLSX"
        className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium border border-[#525252] bg-[#3a3a3a] text-[#a3a3a3] hover:bg-[#484848] hover:text-[#f5f5f5] disabled:opacity-50 transition-colors"
      >
        <Upload size={11} />
        {loading ? '...' : 'XLSX'}
      </button>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
              <span className="text-white font-semibold text-sm">Importar Medição — {preview.nome}</span>
              <button onClick={() => setPreview(null)} className="text-[#6b6b6b] hover:text-white"><XIcon size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {preview.errors.length > 0 ? (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div>{preview.errors.join(' ')}</div>
                </div>
              ) : (
                <>
                  <p className="text-[#a3a3a3] text-xs">{preview.itens.length} itens · Total medido: <strong className="text-[#f5f5f5]">{preview.totals.totalMedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                  <div className="overflow-x-auto max-h-48 border border-[#525252] rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#1f1f1f] text-[#6b6b6b] uppercase text-[9px]">
                          <th className="px-3 py-2 text-left">Nº Preço</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-right">Qtd</th>
                          <th className="px-3 py-2 text-right">Vl. Unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.itens.slice(0, 6).map((it, i) => (
                          <tr key={i} className="border-t border-[#525252]">
                            <td className="px-3 py-1.5 font-mono text-[#f97316]">{it.nPreco}</td>
                            <td className="px-3 py-1.5 text-[#f5f5f5] truncate max-w-[180px]">{it.descricao}</td>
                            <td className="px-3 py-1.5 text-right">{it.qtd}</td>
                            <td className="px-3 py-1.5 text-right">{it.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        {preview.itens.length > 6 && (
                          <tr><td colSpan={4} className="px-3 py-2 text-center text-[#6b6b6b] text-[10px]">+ {preview.itens.length - 6} itens</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
              <button onClick={() => setPreview(null)} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
              {preview.errors.length === 0 && (
                <button onClick={handleConfirm} className="px-5 py-2 text-xs font-medium text-white rounded-lg transition-colors" style={{ backgroundColor: '#f97316' }}>
                  Importar {preview.itens.length} itens
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function SubCard({ sub, onRemove }: { sub: Subempreiteiro; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const retPct = sub.totalMedido > 0 ? (sub.retencao / sub.totalMedido) * 100 : 0

  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
      <div className="flex items-center px-4 py-3 gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center shrink-0">
          <Users size={17} className="text-[#f97316]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">{sub.nome}</div>
          <div className="text-[#a3a3a3] text-xs">{sub.nucleo} · {sub.periodo}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-emerald-400 font-bold text-sm">{fmt(sub.totalAprovado)}</div>
          <div className="text-[10px] text-[#6b6b6b]">aprovado · retenção {pct(retPct)}%</div>
        </div>
        <ImportSubBtn subId={sub.id} />
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="text-[#a3a3a3] hover:text-white transition-colors ml-1">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <button type="button" onClick={onRemove} className="text-red-400 hover:bg-red-900/20 rounded p-1 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && sub.itens.length > 0 && (
        <div className="border-t border-[#525252] overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase text-[9px]">
                <th className="px-3 py-2 text-left border-r border-[#525252]">Nº Preço</th>
                <th className="px-3 py-2 text-left border-r border-[#525252]">Vínc. Sabesp</th>
                <th className="px-3 py-2 text-left border-r border-[#525252]">Descrição</th>
                <th className="px-3 py-2 text-center border-r border-[#525252]">Un</th>
                <th className="px-3 py-2 text-right border-r border-[#525252]">Qtd</th>
                <th className="px-3 py-2 text-right border-r border-[#525252]">Vl. Unit.</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sub.itens.map((it, idx) => (
                <tr key={idx} className="border-b border-[#525252]">
                  <td className="px-3 py-1.5 border-r border-[#525252] font-mono text-[#f97316]">{it.nPreco}</td>
                  <td className="px-3 py-1.5 border-r border-[#525252] font-mono text-[#a3a3a3] text-[10px]">{it.nPrecoSabesp || '—'}</td>
                  <td className="px-3 py-1.5 border-r border-[#525252] text-[#f5f5f5]">{it.descricao}</td>
                  <td className="px-3 py-1.5 border-r border-[#525252] text-center text-[#a3a3a3]">{it.unidade}</td>
                  <td className="px-3 py-1.5 border-r border-[#525252] text-right">{it.qtd.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-1.5 border-r border-[#525252] text-right">{fmt(it.valorUnitario)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-emerald-400">{fmt(it.qtd * it.valorUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-[#1f1f1f] flex gap-6 justify-end text-xs border-t border-[#525252]">
            <span className="text-[#a3a3a3]">Medido: <strong className="text-[#f5f5f5]">{fmt(sub.totalMedido)}</strong></span>
            <span className="text-[#a3a3a3]">Aprovado: <strong className="text-emerald-400">{fmt(sub.totalAprovado)}</strong></span>
            <span className="text-[#a3a3a3]">Retenção: <strong className="text-red-400">{fmt(sub.retencao)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SubempreiteirosPanel() {
  const { getActiveBoletim, addSubempreiteiro, removeSubempreiteiro } = useMedicaoBillingStore()
  const [addOpen, setAddOpen] = useState(false)
  const boletim = getActiveBoletim()

  if (!boletim) return (
    <div className="p-8 text-center text-[#6b6b6b] text-sm">Nenhum boletim ativo.</div>
  )

  const totalAprovado = boletim.subempreiteiros.reduce((s, sub) => s + sub.totalAprovado, 0)
  const totalRetencao = boletim.subempreiteiros.reduce((s, sub) => s + sub.retencao, 0)

  return (
    <div className="p-6 space-y-4 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-semibold text-base">Planilhas dos Subempreiteiros</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">{boletim.subempreiteiros.length} subempreiteiros · Período: {boletim.periodo}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Main-level import: creates a new subempreiteiro from XLSX */}
          <ImportSubNewBtn periodo={boletim.periodo} />
          {boletim.subempreiteiros.length > 0 && (
            <>
              <button type="button"
                onClick={() => {
                  const rows = boletim.subempreiteiros.flatMap(sub =>
                    sub.itens.map(it => ({
                      'Subempreiteiro': sub.nome, 'Núcleo': sub.nucleo, 'Período': sub.periodo,
                      'Nº Preço': it.nPreco, 'Vínc. Sabesp': it.nPrecoSabesp, 'Descrição': it.descricao,
                      'Un': it.unidade, 'Qtd': it.qtd, 'Vl. Unitário': it.valorUnitario,
                      'Total': Math.round(it.qtd * it.valorUnitario * 100) / 100,
                    }))
                  )
                  const ws = XLSX.utils.json_to_sheet(rows)
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Subempreiteiros')
                  XLSX.writeFile(wb, `Subempreiteiros_${boletim.periodo.replace('/', '-')}.xlsx`)
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors">
                <FileDown size={13} /> Exportar XLSX
              </button>
              <button type="button"
                onClick={() => exportSubempreiteirosPdf(boletim.subempreiteiros, boletim.periodo, boletim.contrato)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors">
                <FileDown size={13} /> Exportar PDF
              </button>
            </>
          )}
          {boletim.subempreiteiros.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-[#a3a3a3]">Total aprovado</div>
              <div className="text-emerald-400 font-bold text-base">{fmt(totalAprovado)}</div>
              <div className="text-[10px] text-red-400">Retenção: {fmt(totalRetencao)}</div>
            </div>
          )}
        </div>
      </div>

      {boletim.subempreiteiros.map((sub) => (
        <SubCard key={sub.id} sub={sub} onRemove={() => removeSubempreiteiro(sub.id)} />
      ))}

      {boletim.subempreiteiros.length === 0 && (
        <div className="py-12 text-center text-[#6b6b6b] text-sm">
          <Users size={32} className="mx-auto mb-3 text-[#525252]" />
          Nenhum subempreiteiro adicionado ainda.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#525252] rounded-lg text-sm text-[#f97316] hover:border-[#f97316]/50 transition-colors">
          <Plus size={15} /> Adicionar subempreiteiro
        </button>
        <button type="button" onClick={downloadTemplateSub}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-dashed border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
          <Download size={13} /> Template XLSX
        </button>
      </div>

      {addOpen && (
        <AddSubModal
          onClose={() => setAddOpen(false)}
          onAdd={addSubempreiteiro}
          periodo={boletim.periodo}
        />
      )}
    </div>
  )
}
