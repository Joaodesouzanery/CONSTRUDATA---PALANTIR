import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { exportCSV, exportPDF } from '@/lib/financeiroExport'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export function PorObraPanel() {
  const entries = useFinanceiroStore((s) => s.entries)
  const sites   = useTorreStore((s) => s.sites)
  const [porCidade, setPorCidade] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const filtered = entries.filter((e) => {
    if (dataInicio && e.data < dataInicio) return false
    if (dataFim && e.data > dataFim) return false
    return true
  })

  const obraMap = Object.fromEntries(sites.map((s) => [s.id, s]))
  const obraNames = Object.fromEntries(sites.map((s) => [s.id, s.name]))

  type GroupEntry = { id: string; label: string; subLabel?: string; entries: typeof filtered }
  let groups: GroupEntry[] = []

  if (!porCidade) {
    // Group by obra
    const byObra = new Map<string, typeof filtered>()
    for (const e of filtered) {
      const key = e.obraId ?? '__sem_obra__'
      if (!byObra.has(key)) byObra.set(key, [])
      byObra.get(key)!.push(e)
    }
    groups = Array.from(byObra.entries()).map(([id, ents]) => ({
      id,
      label: id === '__sem_obra__' ? 'Sem obra vinculada' : (obraMap[id]?.name ?? id.slice(0, 8)),
      subLabel: id !== '__sem_obra__' ? (obraMap[id] ? `${obraMap[id].city ?? ''} ${obraMap[id].state ?? ''}`.trim() : undefined) : undefined,
      entries: ents,
    }))
  } else {
    // Group by Estado → Cidade
    const byCidade = new Map<string, typeof filtered>()
    for (const e of filtered) {
      const site = e.obraId ? obraMap[e.obraId] : undefined
      const key = site ? `${site.state ?? '—'}__${site.city ?? '—'}` : '——__Sem cidade'
      if (!byCidade.has(key)) byCidade.set(key, [])
      byCidade.get(key)!.push(e)
    }
    groups = Array.from(byCidade.entries()).map(([key, ents]) => {
      const [estado, cidade] = key.split('__')
      return { id: key, label: `${estado} — ${cidade}`, entries: ents }
    })
  }

  groups.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white">Por Obra</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#a3a3a3] cursor-pointer select-none">
            <input type="checkbox" checked={porCidade} onChange={(e) => setPorCidade(e.target.checked)}
              className="accent-emerald-500 w-3 h-3" />
            Agrupar por Cidade/Estado
          </label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
            className="bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-xs text-white focus:outline-none" />
          <span className="text-[#6b6b6b] text-xs">até</span>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
            className="bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-xs text-white focus:outline-none" />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm">Nenhum lançamento encontrado.</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const entradas = g.entries.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0)
            const saidas   = g.entries.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0)
            const saldo    = entradas - saidas
            const isOpen   = open[g.id] ?? false

            return (
              <div key={g.id} className="border border-[#525252] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [g.id]: !isOpen }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#2c2c2c] hover:bg-[#333] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} className="text-[#6b6b6b]" /> : <ChevronRight size={14} className="text-[#6b6b6b]" />}
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{g.label}</p>
                      {g.subLabel && <p className="text-[10px] text-[#6b6b6b]">{g.subLabel}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-[#6b6b6b]">Entradas</p>
                      <p className="text-xs font-semibold text-emerald-400">{fmtBRL(entradas)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-[#6b6b6b]">Saídas</p>
                      <p className="text-xs font-semibold text-red-400">{fmtBRL(saidas)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#6b6b6b]">Saldo</p>
                      <p className={`text-xs font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(saldo)}</p>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => exportCSV(g.entries, g.label.replace(/[^a-zA-Z0-9]/g, '_'))}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-[#525252] text-[#a3a3a3] hover:text-white transition-colors">
                        <Download size={10} /> CSV
                      </button>
                      <button onClick={() => exportPDF(g.entries, g.label, '', obraNames)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-[#525252] text-[#a3a3a3] hover:text-white transition-colors">
                        <Download size={10} /> PDF
                      </button>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                          <th className="px-3 py-2 text-left">Data</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-left">Categoria</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f2937]">
                        {[...g.entries].sort((a, b) => b.data.localeCompare(a.data)).map((e) => (
                          <tr key={e.id} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2 text-[#a3a3a3] tabular-nums">{e.data}</td>
                            <td className="px-3 py-2 text-white">{e.descricao}</td>
                            <td className="px-3 py-2 text-[#a3a3a3] capitalize">{e.categoria.replace('_', ' ')}</td>
                            <td className={`px-3 py-2 text-right font-bold tabular-nums ${e.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {e.tipo === 'entrada' ? '+' : '-'}{fmtBRL(e.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
