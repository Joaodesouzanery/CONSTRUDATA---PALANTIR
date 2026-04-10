import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import type { FinanceiroEntry, EntradaCategoria, SaidaCategoria } from '@/types'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const ENTRADA_CATS: { key: EntradaCategoria; label: string }[] = [
  { key: 'medicao', label: 'Medição' }, { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'reajuste', label: 'Reajuste' }, { key: 'outro', label: 'Outro' },
]
const SAIDA_CATS: { key: SaidaCategoria; label: string }[] = [
  { key: 'materiais', label: 'Materiais' }, { key: 'mao_de_obra', label: 'Mão de Obra' },
  { key: 'equipamentos', label: 'Equipamentos' }, { key: 'subempreiteiros', label: 'Subempreiteiros' },
  { key: 'administrativo', label: 'Administrativo' }, { key: 'outro', label: 'Outro' },
]

export function EntradasPanel() { return <LancamentosPanel tipo="entrada" /> }
export function SaidasPanel() { return <LancamentosPanel tipo="saida" /> }

function LancamentosPanel({ tipo }: { tipo: 'entrada' | 'saida' }) {
  const { entries, addEntry, removeEntry } = useFinanceiroStore()
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState('')

  const cats = tipo === 'entrada' ? ENTRADA_CATS : SAIDA_CATS
  let items = entries.filter((e) => e.tipo === tipo)
  if (filterCat) items = items.filter((e) => e.categoria === filterCat)
  items = [...items].sort((a, b) => b.data.localeCompare(a.data))
  const total = items.reduce((s, e) => s + e.valor, 0)

  // Group by category for summary
  const byCat = new Map<string, number>()
  for (const e of items) { byCat.set(e.categoria, (byCat.get(e.categoria) ?? 0) + e.valor) }

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">{tipo === 'entrada' ? 'Entradas (Receitas)' : 'Saídas (Despesas)'}</h2>
          <p className="text-[10px] text-[#6b6b6b]">{items.length} lançamentos — Total: <strong className={tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}>{fmtBRL(total)}</strong></p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors hover:bg-[#ea580c]" style={{ backgroundColor: '#f97316' }}>
          <Plus size={14} /> {tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
        </button>
      </div>

      {/* Category summary */}
      {byCat.size > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCat('')} className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${!filterCat ? 'bg-white/10 text-white' : 'text-[#6b6b6b] hover:text-white'}`}>Todas</button>
          {cats.map((c) => {
            const val = byCat.get(c.key)
            if (!val) return null
            return <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? '' : c.key)}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${filterCat === c.key ? 'bg-white/10 text-white' : 'text-[#6b6b6b] hover:text-white'}`}>
              {c.label} ({fmtBRL(val)})
            </button>
          })}
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-[#6b6b6b] text-sm">Nenhum lançamento.</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Referência</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02] group">
                  <td className="px-3 py-2 text-[#a3a3a3] tabular-nums">{e.data}</td>
                  <td className="px-3 py-2 text-white">{e.descricao}</td>
                  <td className="px-3 py-2 text-[#a3a3a3] capitalize">{e.categoria.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-[#6b6b6b]">{e.referencia || '—'}</td>
                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(e.valor)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => { if (window.confirm('Remover?')) removeEntry(e.id) }}
                      className="p-1 rounded text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddModal tipo={tipo} cats={cats} onClose={() => setShowAdd(false)} onAdd={addEntry} />}
    </div>
  )
}

function AddModal({ tipo, cats, onClose, onAdd }: { tipo: 'entrada' | 'saida'; cats: { key: string; label: string }[]; onClose: () => void; onAdd: (e: FinanceiroEntry) => void }) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [categoria, setCategoria] = useState(cats[0].key)
  const [referencia, setReferencia] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao || !valor) return
    onAdd({
      id: crypto.randomUUID(), tipo, descricao, valor: parseFloat(valor.replace(',', '.')) || 0,
      data, categoria: categoria as EntradaCategoria & SaidaCategoria, referencia: referencia || undefined, createdAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl p-5 space-y-4 bg-[#2c2c2c] border border-[#525252]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}</h2>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-[#6b6b6b] uppercase mb-1">Descrição *</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required placeholder="Ex: Medição Março/2026"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#6b6b6b] uppercase mb-1">Valor (R$) *</label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} required placeholder="150000.00"
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] uppercase mb-1">Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#6b6b6b] uppercase mb-1">Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] uppercase mb-1">Referência</label>
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="NF-001, Med-03"
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        </div>
        <button type="submit" className="w-full py-2.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#f97316' }}>
          {tipo === 'entrada' ? 'Adicionar Entrada' : 'Adicionar Saída'}
        </button>
      </form>
    </div>
  )
}
