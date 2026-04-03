/**
 * NucleoResumoPanel — Resumo por Nucleo dashboard for the Suprimentos module.
 * KPI cards, search, import, inline editing table, progress bars.
 */
import { useState, useMemo, useRef } from 'react'
import { Search, Upload, Plus, Trash2, Check, X, FileSpreadsheet, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { previewNucleoExcel, autoSuggestNucleoMapping, parseNucleoSheet } from '../utils/parseNucleoExcel'
import type { NucleoExcelPreview } from '../utils/parseNucleoExcel'
import type { NucleoResumo } from '@/types'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number, decimals = 0) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function progressColor(pct: number): string {
  if (pct >= 75) return '#4ade80'
  if (pct >= 40) return '#fbbf24'
  return '#f87171'
}

// ─── Nucleo fields for the import mapping ─────────────────────────────────────

const NUCLEO_FIELDS: { value: string; label: string }[] = [
  { value: '',                label: '-- Ignorar --' },
  { value: 'nucleo',          label: 'Nucleo' },
  { value: 'tipo',            label: 'Tipo' },
  { value: 'trechosTotal',    label: 'Trechos Total' },
  { value: 'trechosExecutados', label: 'Trechos Executados' },
  { value: 'trechosPendentes', label: 'Trechos Pendentes' },
  { value: 'metrosTotal',     label: 'Metros Total' },
  { value: 'metrosExecutados', label: 'Metros Executados' },
  { value: 'metrosPendentes', label: 'Metros Pendentes' },
  { value: 'progressoPct',    label: '% Progresso' },
  { value: 'ruas',            label: 'Ruas' },
]

// ─── Import Modal (inline multi-step) ─────────────────────────────────────────

type ImportStep = 'upload' | 'mapping' | 'preview' | 'done'

function NucleoImportModal({ onClose }: { onClose: () => void }) {
  const importNucleoResumos = useSuprimentosStore((s) => s.importNucleoResumos)

  const [step, setStep] = useState<ImportStep>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<NucleoExcelPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [parsed, setParsed] = useState<Omit<NucleoResumo, 'id'>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    setError(null)
    try {
      const preview = await previewNucleoExcel(f)
      if (preview.headers.length === 0) {
        setError('Arquivo vazio ou sem dados reconheciveis.')
        return
      }
      setFile(f)
      setFilename(f.name)
      setExcelPreview(preview)
      const suggested = autoSuggestNucleoMapping(preview.headers)
      setMapping(suggested)
      setStep('mapping')
    } catch {
      setError('Erro ao ler arquivo. Verifique o formato.')
    }
  }

  async function handlePreview() {
    if (!file) return
    setError(null)
    try {
      const items = await parseNucleoSheet(file, mapping, 0)
      setParsed(items)
      setStep('preview')
    } catch {
      setError('Erro ao processar dados.')
    }
  }

  function handleImport() {
    setImporting(true)
    importNucleoResumos(parsed)
    setStep('done')
    setImporting(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Importar Resumo por Nucleo</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-[#3d3d3d] text-xs text-[#a3a3a3]">
          {(['upload', 'mapping', 'preview', 'done'] as ImportStep[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-[#525252]" />}
              <span className={cn(step === s ? 'text-[#f97316] font-semibold' : '')}>
                {s === 'upload' ? '1. Arquivo' : s === 'mapping' ? '2. Colunas' : s === 'preview' ? '3. Preview' : '4. Concluido'}
              </span>
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#f87171] text-xs">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                isDragging ? 'border-[#f97316] bg-[#f97316]/5' : 'border-[#525252] hover:border-[#f97316]/40',
              )}
            >
              <Upload size={32} className="text-[#6b6b6b]" />
              <p className="text-[#a3a3a3] text-sm">Arraste um arquivo .xlsx ou .csv aqui</p>
              <p className="text-[#6b6b6b] text-xs">ou clique para selecionar</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && excelPreview && (
            <div className="space-y-3">
              <p className="text-[#a3a3a3] text-xs">Arquivo: <span className="text-[#f5f5f5] font-medium">{filename}</span> ({excelPreview.headers.length} colunas, {excelPreview.rows.length} linhas)</p>
              <div className="space-y-2">
                {excelPreview.headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[#a3a3a3] text-xs w-40 truncate" title={h}>{h}</span>
                    <select
                      value={Object.entries(mapping).find(([, idx]) => idx === i)?.[0] ?? ''}
                      onChange={(e) => {
                        const newMapping = { ...mapping }
                        // Remove old mapping that pointed to this column
                        for (const [key, idx] of Object.entries(newMapping)) {
                          if (idx === i) delete newMapping[key]
                        }
                        // Set new mapping
                        if (e.target.value) newMapping[e.target.value] = i
                        setMapping(newMapping)
                      }}
                      className="bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] flex-1"
                    >
                      {NUCLEO_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handlePreview}
                  disabled={!mapping['nucleo']}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Visualizar <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && parsed.length > 0 && (
            <div className="space-y-3">
              <p className="text-[#a3a3a3] text-xs">{parsed.length} nucleo(s) encontrado(s)</p>
              <div className="overflow-x-auto rounded-lg border border-[#525252]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#3d3d3d] text-[#a3a3a3]">
                      <th className="text-left px-3 py-2">Nucleo</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-right px-3 py-2">Trechos</th>
                      <th className="text-right px-3 py-2">Metros</th>
                      <th className="text-right px-3 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-[#3d3d3d]">
                        <td className="px-3 py-1.5 text-[#f5f5f5]">{r.nucleo}</td>
                        <td className="px-3 py-1.5 text-[#a3a3a3]">{r.tipo}</td>
                        <td className="px-3 py-1.5 text-right text-[#a3a3a3]">{r.trechosExecutados}/{r.trechosTotal}</td>
                        <td className="px-3 py-1.5 text-right text-[#a3a3a3]">{fmtNum(r.metrosExecutados)}</td>
                        <td className="px-3 py-1.5 text-right font-medium" style={{ color: progressColor(r.progressoPct) }}>{fmtNum(r.progressoPct, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.length > 10 && (
                <p className="text-[#6b6b6b] text-xs">... e mais {parsed.length - 10} linha(s)</p>
              )}
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep('mapping')} className="px-3 py-1.5 rounded text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] disabled:opacity-40 transition-colors"
                >
                  Importar {parsed.length} registro(s)
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 size={40} className="text-[#4ade80]" />
              <p className="text-[#f5f5f5] text-sm font-medium">Importacao concluida!</p>
              <p className="text-[#a3a3a3] text-xs">{parsed.length} nucleo(s) importado(s) com sucesso.</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Nucleo Modal ─────────────────────────────────────────────────────────

function AddNucleoModal({ onClose }: { onClose: () => void }) {
  const addNucleoResumo = useSuprimentosStore((s) => s.addNucleoResumo)
  const [form, setForm] = useState({
    nucleo: '', tipo: '', trechosTotal: '', trechosExecutados: '',
    metrosTotal: '', metrosExecutados: '', ruas: '', observacoes: '',
  })

  function handleSubmit() {
    if (!form.nucleo.trim()) return
    const tT = parseFloat(form.trechosTotal) || 0
    const tE = parseFloat(form.trechosExecutados) || 0
    const mT = parseFloat(form.metrosTotal) || 0
    const mE = parseFloat(form.metrosExecutados) || 0
    addNucleoResumo({
      nucleo: form.nucleo.trim(),
      tipo: form.tipo.trim() || '--',
      trechosTotal: tT,
      trechosExecutados: tE,
      trechosPendentes: tT - tE,
      metrosTotal: mT,
      metrosExecutados: mE,
      metrosPendentes: mT - mE,
      progressoPct: mT > 0 ? parseFloat(((mE / mT) * 100).toFixed(1)) : 0,
      ruas: form.ruas.trim() || '--',
      observacoes: form.observacoes.trim() || undefined,
    })
    onClose()
  }

  const fields: { key: keyof typeof form; label: string; type?: string; full?: boolean }[] = [
    { key: 'nucleo', label: 'Nome do Nucleo' },
    { key: 'tipo', label: 'Tipo de Obra' },
    { key: 'trechosTotal', label: 'Trechos Total', type: 'number' },
    { key: 'trechosExecutados', label: 'Trechos Executados', type: 'number' },
    { key: 'metrosTotal', label: 'Metros Total', type: 'number' },
    { key: 'metrosExecutados', label: 'Metros Executados', type: 'number' },
    { key: 'ruas', label: 'Ruas / Logradouros', full: true },
    { key: 'observacoes', label: 'Observacoes', full: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Adicionar Nucleo</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-3">
          {fields.map(({ key, label, type, full }) => (
            <div key={key} className={cn('flex flex-col gap-1', full && 'col-span-2')}>
              <label className="text-[#a3a3a3] text-xs">{label}</label>
              <input
                type={type ?? 'text'}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316] focus:outline-none transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#525252]">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!form.nucleo.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function NucleoResumoPanel() {
  const { nucleoResumos, updateNucleoResumo, removeNucleoResumo } = useSuprimentosStore(
    useShallow((s) => ({
      nucleoResumos:       s.nucleoResumos,
      updateNucleoResumo:  s.updateNucleoResumo,
      removeNucleoResumo:  s.removeNucleoResumo,
    }))
  )

  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return nucleoResumos
    const q = search.toLowerCase()
    return nucleoResumos.filter(
      (n) => n.nucleo.toLowerCase().includes(q) || n.tipo.toLowerCase().includes(q) || n.ruas.toLowerCase().includes(q),
    )
  }, [nucleoResumos, search])

  // ── KPI computations ───────────────────────────────────────────────────────
  const totalNucleos = nucleoResumos.length
  const totalTrechos = nucleoResumos.reduce((s, n) => s + n.trechosTotal, 0)
  const execTrechos = nucleoResumos.reduce((s, n) => s + n.trechosExecutados, 0)
  const totalMetrosExec = nucleoResumos.reduce((s, n) => s + n.metrosExecutados, 0)
  const avgProgress = totalNucleos > 0
    ? nucleoResumos.reduce((s, n) => s + n.progressoPct, 0) / totalNucleos
    : 0

  // ── Totals row ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    trechosTotal: filtered.reduce((s, n) => s + n.trechosTotal, 0),
    trechosExecutados: filtered.reduce((s, n) => s + n.trechosExecutados, 0),
    metrosExecutados: filtered.reduce((s, n) => s + n.metrosExecutados, 0),
    metrosPendentes: filtered.reduce((s, n) => s + n.metrosPendentes, 0),
    metrosTotal: filtered.reduce((s, n) => s + n.metrosTotal, 0),
  }), [filtered])

  const totalsProgress = totals.metrosTotal > 0
    ? parseFloat(((totals.metrosExecutados / totals.metrosTotal) * 100).toFixed(1))
    : 0

  // ── Inline editing ─────────────────────────────────────────────────────────
  function startEdit(id: string, field: string, currentValue: string | number) {
    setEditingCell({ id, field })
    setEditValue(String(currentValue))
  }

  function confirmEdit() {
    if (!editingCell) return
    const { id, field } = editingCell
    const numFields = ['trechosTotal', 'trechosExecutados', 'metrosTotal', 'metrosExecutados']

    if (numFields.includes(field)) {
      const val = parseFloat(editValue) || 0
      const item = nucleoResumos.find((n) => n.id === id)
      if (!item) return
      const patch: Partial<NucleoResumo> = { [field]: val }

      // Recalculate derived fields
      const tT = field === 'trechosTotal' ? val : item.trechosTotal
      const tE = field === 'trechosExecutados' ? val : item.trechosExecutados
      const mT = field === 'metrosTotal' ? val : item.metrosTotal
      const mE = field === 'metrosExecutados' ? val : item.metrosExecutados
      patch.trechosPendentes = tT - tE
      patch.metrosPendentes = mT - mE
      patch.progressoPct = mT > 0 ? parseFloat(((mE / mT) * 100).toFixed(1)) : 0

      updateNucleoResumo(id, patch)
    } else {
      updateNucleoResumo(id, { [field]: editValue })
    }

    setEditingCell(null)
    setEditValue('')
  }

  function cancelEdit() {
    setEditingCell(null)
    setEditValue('')
  }

  function renderCell(item: NucleoResumo, field: string, display: string | number, align: 'left' | 'right' = 'left') {
    const isEditing = editingCell?.id === item.id && editingCell?.field === field
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
            className={cn(
              'bg-[#484848] border border-[#f97316] rounded px-1.5 py-0.5 text-xs text-[#f5f5f5] w-full focus:outline-none',
              align === 'right' && 'text-right',
            )}
          />
          <button onClick={confirmEdit} className="text-[#4ade80] hover:text-[#22c55e]"><Check size={12} /></button>
          <button onClick={cancelEdit} className="text-[#f87171] hover:text-[#dc2626]"><X size={12} /></button>
        </div>
      )
    }
    return (
      <span
        onClick={() => startEdit(item.id, field, display)}
        className="cursor-pointer hover:text-[#f97316] transition-colors"
        title="Clique para editar"
      >
        {display}
      </span>
    )
  }

  // ── KPI Cards ──────────────────────────────────────────────────────────────

  const kpis = [
    { label: 'Total Nucleos', value: totalNucleos, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
    { label: 'Trechos Exec / Total', value: `${fmtNum(execTrechos)} / ${fmtNum(totalTrechos)}`, color: 'text-[#38bdf8]', bg: 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30' },
    { label: 'Metros Executados', value: fmtNum(totalMetrosExec), color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: '% Progresso Medio', value: `${fmtNum(avgProgress, 1)}%`, color: `text-[${progressColor(avgProgress)}]`, bg: avgProgress >= 75 ? 'bg-[#16a34a]/10 border-[#16a34a]/30' : avgProgress >= 40 ? 'bg-[#ca8a04]/10 border-[#ca8a04]/30' : 'bg-[#dc2626]/10 border-[#dc2626]/30' },
  ]

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        {kpis.map(({ label, value, color, bg }) => (
          <div key={label} className={cn('border rounded-xl p-4 flex flex-col gap-1', bg)}>
            <p className="text-[#6b6b6b] text-xs">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nucleo, tipo, rua..."
            className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b] focus:border-[#f97316] focus:outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#f5f5f5]">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
        >
          <FileSpreadsheet size={13} /> Importar Planilha
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
        >
          <Plus size={13} /> Adicionar Nucleo
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#525252]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#3d3d3d] text-[#a3a3a3]">
              <th className="text-left px-3 py-2.5 font-medium">Nucleo</th>
              <th className="text-left px-3 py-2.5 font-medium">Tipo</th>
              <th className="text-right px-3 py-2.5 font-medium">Trechos (Exec/Total)</th>
              <th className="text-right px-3 py-2.5 font-medium">Metros Exec</th>
              <th className="text-right px-3 py-2.5 font-medium">Metros Pend</th>
              <th className="px-3 py-2.5 font-medium w-40">% Progresso</th>
              <th className="text-left px-3 py-2.5 font-medium">Ruas</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-[#6b6b6b]">
                  {nucleoResumos.length === 0
                    ? 'Nenhum nucleo cadastrado. Importe uma planilha ou adicione manualmente.'
                    : 'Nenhum resultado encontrado.'}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-[#3d3d3d] hover:bg-[#3d3d3d]/50 transition-colors">
                  <td className="px-3 py-2 text-[#f5f5f5] font-medium">
                    {renderCell(item, 'nucleo', item.nucleo)}
                  </td>
                  <td className="px-3 py-2 text-[#a3a3a3]">
                    {renderCell(item, 'tipo', item.tipo)}
                  </td>
                  <td className="px-3 py-2 text-right text-[#a3a3a3]">
                    <span className="inline-flex items-center gap-0.5">
                      {renderCell(item, 'trechosExecutados', item.trechosExecutados, 'right')}
                      <span className="text-[#525252] mx-0.5">/</span>
                      {renderCell(item, 'trechosTotal', item.trechosTotal, 'right')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[#a3a3a3]">
                    {renderCell(item, 'metrosExecutados', fmtNum(item.metrosExecutados), 'right')}
                  </td>
                  <td className="px-3 py-2 text-right text-[#a3a3a3]">
                    {fmtNum(item.metrosPendentes)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#484848] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(item.progressoPct, 100)}%`,
                            backgroundColor: progressColor(item.progressoPct),
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums w-10 text-right" style={{ color: progressColor(item.progressoPct) }}>
                        {fmtNum(item.progressoPct, 1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#a3a3a3] max-w-[200px] truncate" title={item.ruas}>
                    {renderCell(item, 'ruas', item.ruas)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeNucleoResumo(item.id)}
                      className="text-[#6b6b6b] hover:text-[#f87171] transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}

            {/* Totals footer row */}
            {filtered.length > 0 && (
              <tr className="border-t-2 border-[#525252] bg-[#3d3d3d]/60 font-semibold">
                <td className="px-3 py-2.5 text-[#f5f5f5]">Total ({filtered.length})</td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5 text-right text-[#f5f5f5]">
                  {fmtNum(totals.trechosExecutados)} / {fmtNum(totals.trechosTotal)}
                </td>
                <td className="px-3 py-2.5 text-right text-[#f5f5f5]">{fmtNum(totals.metrosExecutados)}</td>
                <td className="px-3 py-2.5 text-right text-[#f5f5f5]">{fmtNum(totals.metrosPendentes)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#484848] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(totalsProgress, 100)}%`,
                          backgroundColor: progressColor(totalsProgress),
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums w-10 text-right" style={{ color: progressColor(totalsProgress) }}>
                      {fmtNum(totalsProgress, 1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showImport && <NucleoImportModal onClose={() => setShowImport(false)} />}
      {showAdd && <AddNucleoModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
