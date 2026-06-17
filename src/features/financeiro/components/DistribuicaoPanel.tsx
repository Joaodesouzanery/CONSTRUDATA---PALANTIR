import { useMemo, useState } from 'react'
import { Plus, Trash2, Users, DollarSign, Equal, Sliders } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { formatMoneyInput, parseLocaleNumber } from '@/lib/numberFormat'

const inputCls = 'w-full bg-[#1e1e2e] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-emerald-500/60 placeholder:text-[#525252]'
const labelCls = 'block text-[#a3a3a3] text-xs mb-1'

interface Linha {
  id: string
  nome: string
  valor: string
}

export function DistribuicaoPanel() {
  useStoreSync(useMaoDeObraStore)
  const workers = useMaoDeObraStore((s) => s.workers)

  const [titulo, setTitulo] = useState('')
  const [metrica, setMetrica] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [modo, setModo] = useState<'igual' | 'custom'>('igual')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [workerPick, setWorkerPick] = useState('')
  const [nomeInput, setNomeInput] = useState('')

  const total = parseLocaleNumber(valorTotal)
  const n = linhas.length

  const valorIgual = n > 0 && total > 0 ? total / n : 0

  const somaCustom = useMemo(
    () => linhas.reduce((acc, l) => acc + parseLocaleNumber(l.valor), 0),
    [linhas],
  )

  function addLinha(nome: string) {
    const v = nome.trim()
    if (!v) return
    const val = modo === 'igual' ? '' : ''
    setLinhas((prev) => [...prev, { id: crypto.randomUUID(), nome: v, valor: val }])
  }

  function removeLinha(id: string) {
    setLinhas((prev) => prev.filter((l) => l.id !== id))
  }

  function updateValor(id: string, val: string) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, valor: val } : l)))
  }

  function distribuirIgual() {
    if (n === 0 || total === 0) return
    const each = formatMoneyInput(total / n)
    setLinhas((prev) => prev.map((l) => ({ ...l, valor: each })))
    setModo('igual')
  }

  const diff = Math.abs(somaCustom - total)
  const somaDivergente = modo === 'custom' && total > 0 && diff > 0.02

  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function pct(v: number) {
    if (!total) return '—'
    return ((v / total) * 100).toFixed(1) + '%'
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/15">
          <DollarSign size={18} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-[#f5f5f5] font-semibold text-base">Distribuição de Orçamento / Tarefa</h2>
          <p className="text-[#6b6b6b] text-xs">Divida um valor ou quantidade entre funcionários ou frentes</p>
        </div>
      </div>

      {/* Configuração geral */}
      <section className="rounded-xl border border-[#525252] bg-[#333333] p-4 space-y-3">
        <h3 className="text-[#f5f5f5] font-semibold text-sm">Configuração</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Título da tarefa</label>
            <input className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Escavação Trecho A, Mão de Obra Março..." />
          </div>
          <div>
            <label className={labelCls}>Valor total (R$)</label>
            <input
              className={inputCls}
              inputMode="decimal"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className={labelCls}>Métrica / Quantidade (opcional)</label>
            <input className={inputCls} value={metrica} onChange={(e) => setMetrica(e.target.value)} placeholder="Ex: 12.000 m, 500 m², 30 dias" />
          </div>
        </div>
      </section>

      {/* Modo de distribuição */}
      <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
        <h3 className="text-[#f5f5f5] font-semibold text-sm mb-3">Modo de distribuição</h3>
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            type="button"
            onClick={() => { setModo('igual'); distribuirIgual() }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${modo === 'igual' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'}`}
          >
            <Equal size={13} /> Dividir igualmente
          </button>
          <button
            type="button"
            onClick={() => setModo('custom')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${modo === 'custom' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'}`}
          >
            <Sliders size={13} /> Distribuição customizada
          </button>
        </div>

        {/* Adicionar funcionário */}
        <div className="space-y-2 mb-4">
          {workers.length > 0 && (
            <div>
              <label className={labelCls}><Users size={11} className="inline mr-1 text-emerald-400" />Selecionar funcionário cadastrado</label>
              <select
                className={inputCls}
                value={workerPick}
                onChange={(e) => { addLinha(e.target.value); setWorkerPick('') }}
              >
                <option value="">— Selecione um funcionário —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.name} disabled={linhas.some((l) => l.nome === w.name)}>
                    {w.name}{w.role ? ` — ${w.role}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLinha(nomeInput); setNomeInput('') } }}
              placeholder="Ou digite um nome (Enter para adicionar)"
            />
            <button type="button" onClick={() => { addLinha(nomeInput); setNomeInput('') }} className="px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"><Plus size={15} /></button>
          </div>
        </div>

        {/* Tabela de linhas */}
        {linhas.length > 0 && (
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[1fr_160px_80px_32px] gap-2 px-1">
              {['Funcionário / Frente', 'Valor (R$)', '%', ''].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{h}</span>
              ))}
            </div>
            {linhas.map((linha) => {
              const v = modo === 'igual' ? valorIgual : parseLocaleNumber(linha.valor)
              return (
                <div key={linha.id} className="grid grid-cols-[1fr_160px_80px_32px] gap-2 items-center">
                  <span className="text-sm text-[#f5f5f5] truncate px-1">{linha.nome}</span>
                  {modo === 'igual' ? (
                    <span className="text-sm text-emerald-400 tabular-nums px-1">{fmt(valorIgual)}</span>
                  ) : (
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      value={linha.valor}
                      onChange={(e) => updateValor(linha.id, e.target.value)}
                      placeholder="0,00"
                    />
                  )}
                  <span className="text-xs text-[#a3a3a3] tabular-nums text-center">{pct(v)}</span>
                  <button type="button" onClick={() => removeLinha(linha.id)} className="text-red-400 hover:text-red-300 flex items-center justify-center"><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
        )}

        {linhas.length === 0 && (
          <p className="text-[#6b6b6b] text-sm italic text-center py-4">Adicione funcionários ou frentes acima para distribuir o valor.</p>
        )}

        {somaDivergente && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            A soma dos valores ({fmt(somaCustom)}) difere do total ({fmt(total)}) em {fmt(diff)}.
          </div>
        )}
      </section>

      {/* Resumo */}
      {linhas.length > 0 && total > 0 && (
        <section className="rounded-xl border border-[#525252] bg-[#1e1e2e] p-4">
          <h3 className="text-[#f5f5f5] font-semibold text-sm mb-3">Resumo</h3>
          {titulo && <p className="text-[#a3a3a3] text-xs mb-1"><span className="text-[#f5f5f5] font-medium">{titulo}</span></p>}
          {metrica && <p className="text-[#a3a3a3] text-xs mb-3">Métrica: <span className="text-[#f5f5f5]">{metrica}</span></p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252] text-left text-[#a3a3a3] text-xs">
                <th className="pb-2 font-semibold">Funcionário / Frente</th>
                <th className="pb-2 font-semibold text-right">Valor</th>
                <th className="pb-2 font-semibold text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/40">
              {linhas.map((linha) => {
                const v = modo === 'igual' ? valorIgual : parseLocaleNumber(linha.valor)
                return (
                  <tr key={linha.id}>
                    <td className="py-2 text-[#f5f5f5]">{linha.nome}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-400 font-semibold">{fmt(v)}</td>
                    <td className="py-2 text-right tabular-nums text-[#a3a3a3]">{pct(v)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#525252]">
                <td className="pt-2 font-bold text-[#f5f5f5]">Total</td>
                <td className="pt-2 text-right tabular-nums font-bold text-[#f5f5f5]">{fmt(total)}</td>
                <td className="pt-2 text-right text-[#a3a3a3]">100%</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  )
}
