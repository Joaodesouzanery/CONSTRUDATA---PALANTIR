import { useState, useRef } from 'react'
import { Upload, Download, Search, Trash2, AlertTriangle, Plus, CheckCircle, FileDown, X, Edit3 } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { parseAndValidate, downloadTemplate } from '@/lib/importEngine'
import { consolidadoImportConfig, type ConsolidadoImportRow } from '../utils/catalogoImport'
import type { ConsolidatedSegment, SegmentStatus, SegmentTipo } from '@/types'

const STATUS_COLORS: Record<SegmentStatus, string> = {
  EXECUTADO: 'bg-emerald-500/15 text-emerald-400',
  PENDENTE:  'bg-red-500/15 text-red-400',
  CADASTRO:  'bg-gray-500/15 text-gray-400',
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }
function today() { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` }

export function ConsolidadoPanel() {
  const store = useMedicaoStore()
  const { segments, addSegments, clearSegments, getGlobalKpis, getNucleos, getRuas, getFilteredSegments, updateSegmentStatus, addSegment, updateSegment, removeSegment } = store

  const [search, setSearch]             = useState('')
  const [filterNucleo, setFilterNucleo] = useState('')
  const [filterTipo, setFilterTipo]     = useState<SegmentTipo | ''>('')
  const [filterStatus, setFilterStatus] = useState<SegmentStatus | ''>('')
  const [filterRua, setFilterRua]       = useState('')
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; errors: number } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const kpis = getGlobalKpis()
  const nucleos = getNucleos()
  const ruas = getRuas(filterNucleo || undefined)

  const filtered = getFilteredSegments({
    nucleo: filterNucleo || undefined,
    tipo: (filterTipo as SegmentTipo) || undefined,
    status: (filterStatus as SegmentStatus) || undefined,
    rua: filterRua || undefined,
  }).filter((seg) => {
    if (!search) return true
    const q = search.toLowerCase()
    return seg.ns.toLowerCase().includes(q) || seg.rua.toLowerCase().includes(q) || seg.pvMont.toLowerCase().includes(q) || seg.pvJus.toLowerCase().includes(q)
  })

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await parseAndValidate<ConsolidadoImportRow>(file, consolidadoImportConfig)
      const items: ConsolidatedSegment[] = result.validRows.map((row, i) => {
        const rawStatus = String(row.status).toUpperCase().trim()
        let status: SegmentStatus = 'PENDENTE'
        if (rawStatus.includes('EXECUTADO')) status = 'EXECUTADO'
        else if (rawStatus.includes('CADASTRO')) status = 'CADASTRO'
        return {
          id: crypto.randomUUID(), nucleo: String(row.nucleo).trim(), tipo: String(row.tipo).toUpperCase().includes('AGUA') ? 'AGUA' as const : 'ESGOTO' as const,
          rua: String(row.rua || 'Sem Rua').trim(), ns: String(row.ns || `NS-${String(i+1).padStart(4,'0')}`),
          pvMont: String(row.pvMont || ''), pvJus: String(row.pvJus || ''), dnMm: row.dnMm || null, extM: row.extM || 0,
          material: String(row.material || 'PVC'), ctMont: row.ctMont || null, ctJus: row.ctJus || null, declPerMil: row.declPerMil || null,
          status, dataExec: row.dataExec && !String(row.dataExec).includes('nan') ? String(row.dataExec) : null,
          networkLayer: String(row.networkLayer || ''), analise: String(row.analise || ''),
        }
      })
      addSegments(items)
      setImportResult({ ok: result.validRows.length, errors: result.errors.length })
    } catch { setImportResult({ ok: 0, errors: 1 }) }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  function handleMarkExecutado(seg: ConsolidatedSegment) {
    if (seg.status === 'EXECUTADO') return
    updateSegmentStatus(seg.id, 'EXECUTADO', today())
  }

  function handleExportCsv() {
    const BOM = '\uFEFF'
    const header = ['Núcleo','Tipo','Rua','NS','PV Mont','PV Jus','DN(mm)','Ext(m)','Mat','STATUS','Data Exec'].join(';')
    const rows = filtered.map((s) => [s.nucleo,s.tipo,s.rua,s.ns,s.pvMont,s.pvJus,s.dnMm??'',fmt(s.extM),s.material,s.status,s.dataExec??''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';'))
    const csv = BOM + [header,...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `consolidado_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Executados" value={String(kpis.totalExec)} sub={`${fmt(kpis.kmExec)} km`} color="text-emerald-400" />
        <Kpi label="Pendentes" value={String(kpis.totalPend)} sub={`${fmt(kpis.kmPend)} km`} color="text-red-400" />
        <Kpi label="Cadastro" value={String(kpis.totalCad)} sub={`${fmt(kpis.kmCad)} km`} color="text-gray-400" />
        <Kpi label="Total" value={String(segments.length)} />
        <Kpi label="km Obra" value={fmt(kpis.kmExec + kpis.kmPend)} />
        <Kpi label="Progresso" value={`${kpis.pctExec}%`} color="text-cyan-400" />
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-3 flex items-center">
          <div className="w-full h-2 bg-[#1f2937] rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(kpis.pctExec, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar NS, rua, PV…"
            className="w-full bg-[#111827] border border-[#1f2937] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <select value={filterNucleo} onChange={(e) => { setFilterNucleo(e.target.value); setFilterRua('') }}
          className="bg-[#111827] border border-[#1f2937] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
          <option value="">Todos Núcleos</option>
          {nucleos.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as SegmentTipo | '')}
          className="bg-[#111827] border border-[#1f2937] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
          <option value="">Água + Esgoto</option>
          <option value="ESGOTO">Esgoto</option>
          <option value="AGUA">Água</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as SegmentStatus | '')}
          className="bg-[#111827] border border-[#1f2937] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
          <option value="">Todos Status</option>
          <option value="EXECUTADO">Executado</option>
          <option value="PENDENTE">Pendente</option>
          <option value="CADASTRO">Cadastro</option>
        </select>
        {ruas.length > 0 && (
          <select value={filterRua} onChange={(e) => setFilterRua(e.target.value)}
            className="bg-[#111827] border border-[#1f2937] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
            <option value="">Todas Ruas</option>
            {ruas.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50">
          <Upload size={14} /> {importing ? 'Importando…' : 'Importar XLSX'}
        </button>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
          <Plus size={14} /> Novo Trecho
        </button>
        {filtered.length > 0 && (
          <button onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <FileDown size={14} /> Exportar CSV
          </button>
        )}
        <button onClick={() => downloadTemplate(consolidadoImportConfig, 'template-consolidado')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <Download size={14} /> Template
        </button>
        {segments.length > 0 && (
          <button onClick={() => { if (window.confirm('Limpar todos os trechos?')) clearSegments() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {importResult && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs ${importResult.errors > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {importResult.errors > 0 && <AlertTriangle size={14} />}
          {importResult.ok} trechos importados{importResult.errors > 0 && `, ${importResult.errors} erros`}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          {segments.length === 0 ? 'Importe o XLSX consolidado ou adicione trechos manualmente.' : 'Nenhum trecho encontrado.'}
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-[#1f2937]" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0d1117] text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="px-2 py-2 text-left">Núcleo</th>
                <th className="px-2 py-2 text-center">Tipo</th>
                <th className="px-2 py-2 text-left">Rua</th>
                <th className="px-2 py-2 text-left">NS</th>
                <th className="px-2 py-2 text-right">DN</th>
                <th className="px-2 py-2 text-right">Ext(m)</th>
                <th className="px-2 py-2 text-center">Mat</th>
                <th className="px-2 py-2 text-center">Status</th>
                <th className="px-2 py-2 text-left">Data</th>
                <th className="px-2 py-2 text-center w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {filtered.slice(0, 500).map((seg) => (
                <tr key={seg.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-2 py-1.5 text-gray-300">{seg.nucleo}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${seg.tipo === 'ESGOTO' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>{seg.tipo}</span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-300 max-w-[120px] truncate" title={seg.rua}>{seg.rua}</td>
                  <td className="px-2 py-1.5 text-cyan-400 font-mono">{seg.ns}</td>
                  <td className="px-2 py-1.5 text-right text-gray-300 tabular-nums">{seg.dnMm || '—'}</td>
                  <td className="px-2 py-1.5 text-right text-white font-medium tabular-nums">{fmt(seg.extM)}</td>
                  <td className="px-2 py-1.5 text-center text-gray-400">{seg.material}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[seg.status]}`}>{seg.status}</span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-400 tabular-nums text-[10px]">{seg.dataExec || '—'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {seg.status === 'PENDENTE' && (
                        <button onClick={() => handleMarkExecutado(seg)} title="Marcar como executado"
                          className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                          <CheckCircle size={13} />
                        </button>
                      )}
                      <button onClick={() => setEditingId(seg.id)} title="Editar"
                        className="p-1 rounded text-gray-400 hover:bg-white/10 transition-colors">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => { if (window.confirm('Remover trecho?')) removeSegment(seg.id) }} title="Remover"
                        className="p-1 rounded text-red-400 hover:bg-red-500/20 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 500 && <div className="text-center py-2 text-gray-500 text-[10px] bg-[#0d1117]">Mostrando 500 de {filtered.length}.</div>}
        </div>
      )}
      <div className="text-[10px] text-gray-600 text-right">{filtered.length} de {segments.length}</div>

      {/* Add Modal */}
      {showAddModal && <AddSegmentModal onClose={() => setShowAddModal(false)} onAdd={addSegment} nucleos={nucleos} />}
      {/* Edit Modal */}
      {editingId && <EditSegmentModal segId={editingId} onClose={() => setEditingId(null)} onSave={updateSegment} onStatusChange={updateSegmentStatus} />}
    </div>
  )
}

// ─── KPI component ───────────────────────────────────────────────────────────
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-3">
      <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
    </div>
  )
}

// ─── Add Segment Modal ───────────────────────────────────────────────────────
function AddSegmentModal({ onClose, onAdd, nucleos }: { onClose: () => void; onAdd: (s: ConsolidatedSegment) => void; nucleos: string[] }) {
  const [nucleo, setNucleo] = useState(nucleos[0] || '')
  const [customNucleo, setCustomNucleo] = useState('')
  const [tipo, setTipo] = useState<SegmentTipo>('ESGOTO')
  const [rua, setRua] = useState('')
  const [ns, setNs] = useState('')
  const [dnMm, setDnMm] = useState('')
  const [extM, setExtM] = useState('')
  const [material, setMaterial] = useState('PVC')
  const [status, setStatus] = useState<SegmentStatus>('PENDENTE')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalNucleo = customNucleo || nucleo
    if (!finalNucleo || !extM) return
    onAdd({
      id: crypto.randomUUID(), nucleo: finalNucleo, tipo, rua: rua || 'Sem Rua', ns: ns || `NS-${Date.now()}`,
      pvMont: '', pvJus: '', dnMm: dnMm ? parseInt(dnMm) : null, extM: parseFloat(extM.replace(',', '.')) || 0,
      material, ctMont: null, ctJus: null, declPerMil: null, status,
      dataExec: status === 'EXECUTADO' ? today() : null, networkLayer: '', analise: '',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl p-5 space-y-4" style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Novo Trecho</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Núcleo</label>
            {nucleos.length > 0 ? (
              <select value={nucleo} onChange={(e) => setNucleo(e.target.value)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white">
                {nucleos.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value="">+ Novo…</option>
              </select>
            ) : (
              <input value={customNucleo} onChange={(e) => setCustomNucleo(e.target.value)} placeholder="Nome do núcleo" className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
            )}
            {nucleo === '' && nucleos.length > 0 && <input value={customNucleo} onChange={(e) => setCustomNucleo(e.target.value)} placeholder="Nome" className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white mt-1" />}
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as SegmentTipo)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white">
              <option value="ESGOTO">Esgoto</option>
              <option value="AGUA">Água</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Rua</label>
            <input value={rua} onChange={(e) => setRua(e.target.value)} placeholder="BECO 10" className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">NS</label>
            <input value={ns} onChange={(e) => setNs(e.target.value)} placeholder="NS-0001" className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">DN (mm)</label>
            <input value={dnMm} onChange={(e) => setDnMm(e.target.value)} placeholder="200" className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Extensão (m) *</label>
            <input value={extM} onChange={(e) => setExtM(e.target.value)} placeholder="43.97" required className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Material</label>
            <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white">
              <option>PVC</option><option>PEAD</option><option>MBV</option><option>Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as SegmentStatus)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white">
              <option value="PENDENTE">Pendente</option>
              <option value="EXECUTADO">Executado</option>
              <option value="CADASTRO">Cadastro</option>
            </select>
          </div>
        </div>
        <button type="submit" className="w-full py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#f97316' }}>Adicionar Trecho</button>
      </form>
    </div>
  )
}

// ─── Edit Segment Modal ──────────────────────────────────────────────────────
function EditSegmentModal({ segId, onClose, onSave, onStatusChange }: {
  segId: string; onClose: () => void
  onSave: (id: string, patch: Partial<ConsolidatedSegment>) => void
  onStatusChange: (id: string, status: SegmentStatus, dataExec?: string) => void
}) {
  const seg = useMedicaoStore((s) => s.segments.find((x) => x.id === segId))
  const [rua, setRua] = useState(seg?.rua ?? '')
  const [dnMm, setDnMm] = useState(String(seg?.dnMm ?? ''))
  const [extM, setExtM] = useState(String(seg?.extM ?? ''))
  const [material, setMaterial] = useState(seg?.material ?? 'PVC')
  const [status, setStatus] = useState<SegmentStatus>(seg?.status ?? 'PENDENTE')
  const [dataExec, setDataExec] = useState(seg?.dataExec ?? '')

  if (!seg) return null

  function handleSave() {
    onSave(segId, { rua, dnMm: dnMm ? parseInt(dnMm) : null, extM: parseFloat(extM.replace(',', '.')) || 0, material })
    if (status !== seg!.status) {
      onStatusChange(segId, status, status === 'EXECUTADO' ? (dataExec || today()) : undefined)
    } else if (dataExec !== seg!.dataExec) {
      onSave(segId, { dataExec: dataExec || null })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-xl p-5 space-y-4" style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Editar {seg.ns} — {seg.nucleo}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Rua</label>
            <input value={rua} onChange={(e) => setRua(e.target.value)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">DN (mm)</label>
            <input value={dnMm} onChange={(e) => setDnMm(e.target.value)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Extensão (m)</label>
            <input value={extM} onChange={(e) => setExtM(e.target.value)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Material</label>
            <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white">
              <option>PVC</option><option>PEAD</option><option>MBV</option><option>Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as SegmentStatus)} className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white">
              <option value="PENDENTE">Pendente</option>
              <option value="EXECUTADO">Executado</option>
              <option value="CADASTRO">Cadastro</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Data Execução</label>
            <input value={dataExec} onChange={(e) => setDataExec(e.target.value)} placeholder="dd/mm/yyyy" className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1.5 text-xs text-white" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-gray-400 border border-[#333] hover:bg-white/5">Cancelar</button>
          <button onClick={handleSave} className="flex-1 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#f97316' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
