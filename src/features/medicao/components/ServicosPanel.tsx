/**
 * ServicosPanel — contract services list with accumulated measurement tracking.
 */
import { useState } from 'react'
import { Download, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import type { MedicaoServico } from '@/types'
import { OBRAS_LIST } from '@/types'

function pct(medida: number, contratada: number) {
  if (!contratada) return 0
  return Math.min(100, Math.round((medida / contratada) * 100))
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ServicosPanel() {
  const { boletins, importFromQuantitativos } = useMedicaoStore()

  // Aggregate all measured quantities from emitted BMs
  const accumulated = boletins
    .filter((b) => b.status === 'emitido')
    .flatMap((b) => b.itens)

  const acumMap = new Map<string, number>()
  accumulated.forEach((i) => {
    acumMap.set(i.codigo, (acumMap.get(i.codigo) ?? 0) + i.qtdMesAtual)
  })

  const [servicos, setServicos] = useState<MedicaoServico[]>([])
  const [showImportMsg, setShowImportMsg] = useState(false)

  function handleImport() {
    const imported = importFromQuantitativos()
    if (imported.length === 0) {
      setShowImportMsg(true)
      setTimeout(() => setShowImportMsg(false), 3000)
      return
    }
    setServicos(imported)
  }

  function addManual() {
    const s: MedicaoServico = {
      id: crypto.randomUUID(),
      codigo: `ITEM-${servicos.length + 1}`,
      descricao: 'Novo serviço',
      unidade: 'un',
      qtdContratada: 0,
      qtdMedidaAcumulada: 0,
      qtdMesAtual: 0,
      valorUnitario: 0,
      valorTotal: 0,
    }
    setServicos((prev) => [...prev, s])
  }

  function patch(id: string, field: keyof MedicaoServico, value: string | number) {
    setServicos((prev) => prev.map((s) => {
      if (s.id !== id) return s
      const updated = { ...s, [field]: value }
      updated.valorTotal = updated.qtdMesAtual * updated.valorUnitario
      return updated
    }))
  }

  function remove(id: string) {
    setServicos((prev) => prev.filter((s) => s.id !== id))
  }

  function handleExportCsv() {
    const BOM = '\uFEFF'
    const header = 'Código,Descrição,Unidade,Qtd Contratada,Qtd Medida Acum.,% Físico,Valor Unit.,Valor Total\r\n'
    const rows = servicos.map((s) => {
      const medAcum = acumMap.get(s.codigo) ?? s.qtdMedidaAcumulada
      const p = pct(medAcum, s.qtdContratada)
      return [s.codigo, `"${s.descricao}"`, s.unidade, s.qtdContratada, medAcum, `${p}%`,
        s.valorUnitario.toFixed(2), s.valorTotal.toFixed(2)].join(',')
    }).join('\r\n')
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `servicos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const totalContratado = servicos.reduce((s, i) => s + i.qtdContratada * i.valorUnitario, 0)
  const totalMedido = servicos.reduce((s, i) => s + (acumMap.get(i.codigo) ?? i.qtdMedidaAcumulada) * i.valorUnitario, 0)

  return (
    <div className="flex flex-col h-full p-4 gap-4">

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          { label: 'Valor Contratado', value: fmtBRL(totalContratado), color: '#a3a3a3' },
          { label: 'Valor Medido Acum.', value: fmtBRL(totalMedido), color: '#f97316' },
          { label: '% Físico Geral', value: `${pct(totalMedido, totalContratado)}%`, color: totalMedido / (totalContratado || 1) > 0.8 ? '#22c55e' : '#f97316' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#2c2c2c] rounded-lg border border-[#525252] p-3">
            <div className="text-[10px] text-[#6b6b6b] mb-1">{kpi.label}</div>
            <div className="text-lg font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f97316] text-white text-xs font-medium hover:bg-[#ea6c0a] transition-colors"
        >
          <RefreshCw size={13} /> Importar do Orçamento
        </button>
        <button
          onClick={addManual}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3d3d3d] text-[#f5f5f5] text-xs hover:bg-[#525252] transition-colors"
        >
          <Plus size={13} /> Adicionar Linha
        </button>
        <button
          onClick={handleExportCsv}
          disabled={servicos.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3d3d3d] text-[#f5f5f5] text-xs hover:bg-[#525252] transition-colors disabled:opacity-40"
        >
          <Download size={13} /> Exportar CSV
        </button>
        {showImportMsg && (
          <span className="text-xs text-yellow-400">Nenhum item no orçamento. Cadastre itens primeiro em Quantitativos.</span>
        )}
      </div>

      {/* Table */}
      {servicos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#6b6b6b] text-sm">
          Nenhum serviço carregado. Importe do orçamento ou adicione manualmente.
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border border-[#525252]">
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#2c2c2c]">
              <tr>
                {['Código', 'Descrição', 'Un.', 'Qtd Contratada', 'Qtd Medida Acum.', '% Físico', 'Valor Unit.', 'Valor Total', ''].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-[#6b6b6b] border-b border-[#525252] font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servicos.map((s, i) => {
                const medAcum = acumMap.get(s.codigo) ?? s.qtdMedidaAcumulada
                const p = pct(medAcum, s.qtdContratada)
                return (
                  <tr key={s.id} className={`border-b border-[#2c2c2c] ${i % 2 === 0 ? 'bg-[#1f1f1f]' : 'bg-[#1a1a1a]'}`}>
                    <td className="px-2 py-1.5 font-mono text-[#a3a3a3]">
                      <input type="text" value={s.codigo}
                        onChange={(e) => patch(s.id, 'codigo', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-[#525252] focus:border-[#f97316]/50 outline-none w-20 text-[10px] text-[#a3a3a3]" />
                    </td>
                    <td className="px-2 py-1.5 text-[#f5f5f5]">
                      <input type="text" value={s.descricao}
                        onChange={(e) => patch(s.id, 'descricao', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-[#525252] focus:border-[#f97316]/50 outline-none w-full min-w-[160px] text-[10px] text-[#f5f5f5]" />
                    </td>
                    <td className="px-2 py-1.5 text-[#a3a3a3]">
                      <input type="text" value={s.unidade}
                        onChange={(e) => patch(s.id, 'unidade', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-[#525252] focus:border-[#f97316]/50 outline-none w-10 text-[10px] text-[#a3a3a3] text-center" />
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3]">
                      <input type="number" min={0} value={s.qtdContratada}
                        onChange={(e) => patch(s.id, 'qtdContratada', Number(e.target.value))}
                        className="bg-transparent border-b border-transparent hover:border-[#525252] focus:border-[#f97316]/50 outline-none w-20 text-[10px] text-right text-[#a3a3a3]" />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold" style={{ color: '#f97316' }}>
                      {medAcum.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-[#3d3d3d] rounded-full overflow-hidden w-16">
                          <div
                            className={`h-full rounded-full ${p >= 80 ? 'bg-green-500' : p >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${p}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-semibold ${p >= 80 ? 'text-green-400' : p >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {p}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3]">
                      <input type="number" min={0} step={0.01} value={s.valorUnitario}
                        onChange={(e) => patch(s.id, 'valorUnitario', Number(e.target.value))}
                        className="bg-transparent border-b border-transparent hover:border-[#525252] focus:border-[#f97316]/50 outline-none w-24 text-[10px] text-right text-[#a3a3a3]" />
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#f5f5f5]">
                      {fmtBRL(medAcum * s.valorUnitario)}
                    </td>
                    <td className="px-1 py-1.5">
                      <button onClick={() => remove(s.id)} className="text-[#525252] hover:text-red-400 transition-colors p-0.5">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// suppress unused import warning
void OBRAS_LIST
