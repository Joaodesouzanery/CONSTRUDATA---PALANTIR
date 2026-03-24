/**
 * ComposicaoPanel — editable item table with SINAPI/SEINFRA search dialog.
 * Inline editing: click any editable cell to edit in-place.
 */
import { useState, useMemo } from 'react'
import { Plus, Trash2, Search, RefreshCw, Download, Printer, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { exportToCsv, exportToXlsx } from '../utils/exportEngine'
import type { OrcamentoItem, CostBaseSource } from '@/types'
// Import SINAPI/SEINFRA mock data
import { mockSinapi } from '@/data/mockSinapi'

const SOURCE_BADGE: Record<CostBaseSource, string> = {
  sinapi:  'bg-blue-900/50 text-blue-300',
  seinfra: 'bg-teal-900/50 text-teal-300',
  custom:  'bg-violet-900/50 text-violet-300',
  manual:  'bg-gray-700 text-gray-400',
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

// Inline editable cell
function EditCell({ value, onSave, type = 'text' }: {
  value: string | number
  onSave: (v: string | number) => void
  type?: 'text' | 'number'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  function commit() {
    const v = type === 'number' ? parseFloat(draft) || 0 : draft
    onSave(v)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="cursor-pointer hover:text-violet-400 transition-colors"
        title="Clique para editar"
      >
        {type === 'number' && typeof value === 'number' && value > 1000 ? fmtBRL(value) : value}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-gray-700 border border-violet-500 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none"
      />
      <button onClick={commit} className="text-emerald-400 hover:text-emerald-300 p-0.5"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-400 p-0.5"><X size={12} /></button>
    </div>
  )
}

// SINAPI Search Dialog
function SinapiSearchDialog({ onAdd, onClose, costBase }: {
  onAdd: (item: Omit<OrcamentoItem, 'id' | 'totalCost'>) => void
  onClose: () => void
  costBase: CostBaseSource
}) {
  const { bdiGlobal } = useQuantitativosStore()
  const [query, setQuery] = useState('')
  const [qty, setQty] = useState(1)

  const filtered = useMemo(() => {
    if (!query.trim()) return mockSinapi.slice(0, 20)
    const q = query.toLowerCase()
    return mockSinapi.filter((e) => e.description.toLowerCase().includes(q) || e.code.includes(q)).slice(0, 30)
  }, [query])

  function handleAdd(entry: typeof mockSinapi[0]) {
    onAdd({
      code: entry.code,
      description: entry.description,
      unit: entry.unit,
      quantity: qty,
      unitCost: entry.unitCost,
      bdi: bdiGlobal,
      category: entry.category,
      source: costBase,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Buscar Item — SINAPI</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código ou descrição..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-xs">Qtd:</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
              min={0.01}
              className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((entry) => (
            <div
              key={entry.code}
              onClick={() => handleAdd(entry)}
              className="px-5 py-3 border-b border-gray-700/50 hover:bg-gray-750/40 cursor-pointer flex items-start justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm group-hover:text-violet-300 transition-colors">{entry.description}</p>
                <p className="text-gray-500 text-xs mt-0.5">{entry.code} · {entry.unit} · {entry.category}</p>
              </div>
              <span className="text-violet-400 text-sm font-medium whitespace-nowrap shrink-0">
                {fmtBRL(entry.unitCost)}/{entry.unit}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-10">Nenhum item encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Save Budget Dialog
function SaveDialog({ onSave, onClose }: { onSave: (name: string, desc?: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')

  function submit() {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    onSave(name.trim(), desc.trim() || undefined)
    onClose()
  }

  const inputCls = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-white font-semibold text-sm">Salvar Orçamento</h3>
        <div>
          <label className="block text-gray-400 text-xs mb-1">Nome *</label>
          <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Rede Pluvial Trecho A" className={inputCls} />
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-1">Descrição (opcional)</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">Cancelar</button>
          <button onClick={submit} className="px-4 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: '#8b5cf6' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export function ComposicaoPanel() {
  const {
    currentItems, bdiGlobal, costBase,
    addItem, updateItem, removeItem, resetItems,
    importFromPreConstrucao, importFromSuprimentos,
    saveBudget,
  } = useQuantitativosStore()

  const [showSearch, setShowSearch] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [importing, setImporting] = useState<'pre' | 'sup' | null>(null)
  const [sortCol, setSortCol] = useState<'code' | 'description' | 'totalCost' | 'category' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const total = currentItems.reduce((s, i) => s + i.totalCost, 0)

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return currentItems
    return [...currentItems].sort((a, b) => {
      const av = a[sortCol as keyof OrcamentoItem] ?? ''
      const bv = b[sortCol as keyof OrcamentoItem] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [currentItems, sortCol, sortDir])

  async function handleImportPre() {
    setImporting('pre')
    await importFromPreConstrucao()
    setImporting(null)
  }

  async function handleImportSup() {
    setImporting('sup')
    await importFromSuprimentos()
    setImporting(null)
  }

  function handleReset() {
    if (!confirm('Reiniciar a composição? Todos os itens serão removidos.')) return
    resetItems()
  }

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return null
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />
  }

  const thCls = 'text-gray-500 text-xs font-medium py-2.5 px-3 text-left cursor-pointer hover:text-gray-300 whitespace-nowrap select-none'

  return (
    <div className="p-6 space-y-4">
      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-black">Quantitativos e Orçamento</h1>
        <p className="text-sm text-gray-600">Gerado em: {new Date().toLocaleString('pt-BR')} · Base: {costBase.toUpperCase()} · BDI Global: {bdiGlobal}%</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white transition-colors"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          <Plus size={14} /> Adicionar Item
        </button>
        <button
          onClick={handleImportPre}
          disabled={importing === 'pre'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
        >
          {importing === 'pre' ? 'Importando...' : '↓ Importar da Pré-Construção'}
        </button>
        <button
          onClick={handleImportSup}
          disabled={importing === 'sup'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
        >
          {importing === 'sup' ? 'Importando...' : '↓ Importar do Suprimentos'}
        </button>
        <button
          onClick={() => setShowSave(true)}
          disabled={currentItems.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
        >
          Salvar Orçamento
        </button>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => exportToCsv(currentItems)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => exportToXlsx(currentItems, bdiGlobal)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
            <Download size={13} /> Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
            <Printer size={13} /> PDF
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-gray-700 hover:bg-red-900/40 text-gray-400 hover:text-red-300 transition-colors">
            <RefreshCw size={13} /> Reiniciar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <p className="text-gray-400 text-xs">
            {currentItems.length} item{currentItems.length !== 1 ? 's' : ''} · BDI Global: {bdiGlobal}%
          </p>
          <p className="text-violet-400 text-sm font-semibold">Total: {fmtBRL(total)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                <th className={thCls} onClick={() => handleSort('code')}>Código<SortIcon col="code" /></th>
                <th className={thCls} onClick={() => handleSort('description')}>Descrição<SortIcon col="description" /></th>
                <th className="text-gray-500 text-xs font-medium py-2.5 px-3 text-left">Un.</th>
                <th className="text-gray-500 text-xs font-medium py-2.5 px-3 text-right">Quantidade</th>
                <th className="text-gray-500 text-xs font-medium py-2.5 px-3 text-right">C.Unit. (R$)</th>
                <th className="text-gray-500 text-xs font-medium py-2.5 px-3 text-right">BDI %</th>
                <th className={`${thCls} text-right`} onClick={() => handleSort('totalCost')}>Total c/ BDI<SortIcon col="totalCost" /></th>
                <th className={thCls} onClick={() => handleSort('category')}>Categoria<SortIcon col="category" /></th>
                <th className="text-gray-500 text-xs font-medium py-2.5 px-3 text-center">Fonte</th>
                <th className="py-2.5 px-3 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-gray-500 py-14">
                    Nenhum item. Clique em "+ Adicionar Item" ou importe de outro módulo.
                  </td>
                </tr>
              )}
              {sorted.map((item) => (
                <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-750/20">
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">
                    <EditCell value={item.code} onSave={(v) => updateItem(item.id, { code: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-200 max-w-xs">
                    <EditCell value={item.description} onSave={(v) => updateItem(item.id, { description: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">
                    <EditCell value={item.unit} onSave={(v) => updateItem(item.id, { unit: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    <EditCell value={item.quantity} onSave={(v) => updateItem(item.id, { quantity: Number(v) })} type="number" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    <EditCell value={item.unitCost} onSave={(v) => updateItem(item.id, { unitCost: Number(v) })} type="number" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400">
                    <EditCell value={item.bdi} onSave={(v) => updateItem(item.id, { bdi: Number(v) })} type="number" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-violet-300 font-medium">{fmtBRL(item.totalCost)}</td>
                  <td className="px-3 py-2.5 text-gray-400">
                    <EditCell value={item.category} onSave={(v) => updateItem(item.id, { category: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[item.source]}`}>
                      {item.source.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 print:hidden">
                    <button onClick={() => removeItem(item.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {currentItems.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-600">
                  <td colSpan={6} className="px-3 py-3 text-gray-300 font-semibold text-sm">TOTAL GERAL</td>
                  <td className="px-3 py-3 text-right text-violet-400 font-bold text-sm">{fmtBRL(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-8 border-t border-gray-300 pt-3 text-xs text-gray-500 flex justify-between">
        <span>Atlântico — Quantitativos e Orçamento</span>
        <span>Gerado em: {new Date().toLocaleString('pt-BR')}</span>
      </div>

      {showSearch && (
        <SinapiSearchDialog onAdd={addItem} onClose={() => setShowSearch(false)} costBase={costBase} />
      )}
      {showSave && (
        <SaveDialog onSave={saveBudget} onClose={() => setShowSave(false)} />
      )}
    </div>
  )
}
