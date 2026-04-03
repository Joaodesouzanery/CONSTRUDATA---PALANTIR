/**
 * HorasExtrasPanel — import and manage overtime hours for measurement calculation.
 */
import { useState } from 'react'
import { Plus, Trash2, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { HorasExtrasEntry } from '@/types'

const inputCls = 'bg-[#484848] border border-[#5e5e5e] rounded-lg px-2 py-1.5 text-xs text-gray-100 placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors'

export function HorasExtrasPanel() {
  const [entries, setEntries] = useState<HorasExtrasEntry[]>([])
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7))

  function addEntry() {
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        funcionario: '',
        cargo: '',
        horasNormais: 0,
        horasExtras50: 0,
        horasExtras100: 0,
        valorHora: 0,
        valorTotal: 0,
        mes: mesFiltro,
      },
    ])
  }

  function updateEntry(id: string, patch: Partial<HorasExtrasEntry>) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        const updated = { ...e, ...patch }
        updated.valorTotal = parseFloat(
          (
            updated.horasNormais * updated.valorHora +
            updated.horasExtras50 * updated.valorHora * 1.5 +
            updated.horasExtras100 * updated.valorHora * 2
          ).toFixed(2),
        )
        return updated
      }),
    )
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const filtered = entries.filter((e) => e.mes === mesFiltro)
  const totalValor = filtered.reduce((s, e) => s + e.valorTotal, 0)
  const totalHE50 = filtered.reduce((s, e) => s + e.horasExtras50, 0)
  const totalHE100 = filtered.reduce((s, e) => s + e.horasExtras100, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Importar Horas Extras</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Adicione ou importe horas extras para incluir na medição
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[#a3a3a3] text-xs">Mês:</label>
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            onClick={addEntry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-12 text-center">
          <Clock size={40} className="mx-auto text-[#6b6b6b] mb-3" />
          <p className="text-[#a3a3a3] text-sm">Nenhuma hora extra registrada para {mesFiltro}.</p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            Adicione manualmente ou importe uma planilha.
          </p>
        </div>
      ) : (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#484848]/60">
                  <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium">Funcionário</th>
                  <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium w-24">Cargo</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-20">H. Normais</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-20">HE 50%</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-20">HE 100%</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-24">Valor/Hora</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-28">Valor Total</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#525252] hover:bg-[#484848] transition-colors">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.funcionario}
                        onChange={(e) => updateEntry(entry.id, { funcionario: e.target.value })}
                        placeholder="Nome"
                        className={`${inputCls} w-full`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.cargo || ''}
                        onChange={(e) => updateEntry(entry.id, { cargo: e.target.value })}
                        placeholder="Cargo"
                        className={`${inputCls} w-full`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.horasNormais || ''}
                        onChange={(e) => updateEntry(entry.id, { horasNormais: Number(e.target.value) })}
                        min={0}
                        className={`${inputCls} w-full text-right`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.horasExtras50 || ''}
                        onChange={(e) => updateEntry(entry.id, { horasExtras50: Number(e.target.value) })}
                        min={0}
                        className={`${inputCls} w-full text-right`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.horasExtras100 || ''}
                        onChange={(e) => updateEntry(entry.id, { horasExtras100: Number(e.target.value) })}
                        min={0}
                        className={`${inputCls} w-full text-right`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.valorHora || ''}
                        onChange={(e) => updateEntry(entry.id, { valorHora: Number(e.target.value) })}
                        min={0}
                        step={0.01}
                        className={`${inputCls} w-full text-right`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-[#f5f5f5] font-mono font-semibold">
                      {formatCurrency(entry.valorTotal)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="text-[#6b6b6b] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#525252] bg-[#484848]/40 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[#a3a3a3] text-xs">
              {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-[#a3a3a3] text-xs">
                HE 50%: <span className="text-[#f5f5f5] font-mono">{totalHE50}h</span>
              </span>
              <span className="text-[#a3a3a3] text-xs">
                HE 100%: <span className="text-[#f5f5f5] font-mono">{totalHE100}h</span>
              </span>
              <span className="text-[#a3a3a3] text-xs">
                Total: <span className="text-[#f97316] font-mono font-semibold">{formatCurrency(totalValor)}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
