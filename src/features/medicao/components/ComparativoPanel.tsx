/**
 * ComparativoPanel — Previsto × Medido comparison with bar chart and KPI cards.
 */
import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useQuantitativosStore } from '@/store/quantitativosStore'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(a: number, b: number) {
  if (!b) return 0
  return Math.min(100, Math.round((a / b) * 100))
}

export function ComparativoPanel() {
  const { boletins } = useMedicaoStore()
  const { currentItems } = useQuantitativosStore()

  // Build item-level comparison: contratado × medido acumulado
  const comparison = useMemo(() => {
    // Aggregate measured from all emitted BMs
    const medMap = new Map<string, number>()
    boletins
      .filter((b) => b.status === 'emitido')
      .flatMap((b) => b.itens)
      .forEach((i) => { medMap.set(i.codigo, (medMap.get(i.codigo) ?? 0) + i.qtdMesAtual) })

    // Use quantitativos as the "contratado" baseline
    return currentItems.map((item) => {
      const medido = medMap.get(item.code) ?? 0
      const contratado = item.quantity
      const valorContratado = contratado * item.unitCost
      const valorMedido = medido * item.unitCost
      const p = pct(medido, contratado)
      return { codigo: item.code, descricao: item.description, unidade: item.unit, contratado, medido, valorContratado, valorMedido, p }
    })
  }, [boletins, currentItems])

  // BM timeline (one point per BM)
  const bmTimeline = useMemo(() => {
    let acum = 0
    return [...boletins]
      .filter((b) => b.status === 'emitido')
      .sort((a, b) => a.numero - b.numero)
      .map((bm) => {
        acum += bm.valorTotal
        return { label: `BM #${bm.numero}`, valorBm: bm.valorTotal, valorAcum: acum, obra: bm.obra }
      })
  }, [boletins])

  const totalContratado = comparison.reduce((s, i) => s + i.valorContratado, 0)
  const totalMedido = comparison.reduce((s, i) => s + i.valorMedido, 0)
  const pctGeral = pct(totalMedido, totalContratado)
  const saldo = totalContratado - totalMedido

  const emptyState = comparison.length === 0 && boletins.length === 0

  if (emptyState) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#6b6b6b] text-sm p-8 text-center">
        <div>
          <TrendingUp size={40} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
          <p>Sem dados para comparação.</p>
          <p className="text-xs mt-1">Cadastre itens em Quantitativos e crie Boletins de Medição para visualizar o comparativo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Valor Contratado', value: fmtBRL(totalContratado), color: '#a3a3a3', icon: Minus },
          { label: 'Valor Medido Acum.', value: fmtBRL(totalMedido), color: '#f97316', icon: TrendingUp },
          { label: 'Saldo a Medir', value: fmtBRL(saldo), color: saldo > 0 ? '#a3a3a3' : '#ef4444', icon: TrendingDown },
          { label: '% Físico Geral', value: `${pctGeral}%`, color: pctGeral >= 80 ? '#22c55e' : pctGeral >= 40 ? '#f97316' : '#ef4444', icon: TrendingUp },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#2c2c2c] rounded-lg border border-[#525252] p-3 flex items-start gap-2">
            <kpi.icon size={16} style={{ color: kpi.color }} className="mt-1 shrink-0" />
            <div>
              <div className="text-[10px] text-[#6b6b6b] mb-0.5">{kpi.label}</div>
              <div className="text-base font-bold leading-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-[#2c2c2c] rounded-lg border border-[#525252] p-4 shrink-0">
        <div className="flex justify-between text-[10px] text-[#6b6b6b] mb-2">
          <span>Avanço Físico-Financeiro</span>
          <span>{pctGeral}%</span>
        </div>
        <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctGeral >= 80 ? 'bg-green-500' : pctGeral >= 40 ? 'bg-[#f97316]' : 'bg-red-500'}`}
            style={{ width: `${pctGeral}%` }}
          />
        </div>
      </div>

      {/* BM Timeline chart */}
      {bmTimeline.length > 0 && (
        <div className="bg-[#2c2c2c] rounded-lg border border-[#525252] p-4 shrink-0">
          <div className="text-xs font-semibold text-[#a3a3a3] mb-3 uppercase tracking-wide">Evolução dos Boletins</div>
          <div className="flex items-end gap-3 h-32 overflow-x-auto">
            {bmTimeline.map((bm, i) => {
              const maxAcum = bmTimeline[bmTimeline.length - 1]?.valorAcum || 1
              const barH = Math.max(4, Math.round((bm.valorBm / maxAcum) * 112))
              const acumH = Math.max(4, Math.round((bm.valorAcum / maxAcum) * 112))
              return (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0 group">
                  <div className="relative flex items-end gap-1 h-28">
                    {/* BM bar */}
                    <div
                      className="w-8 bg-[#f97316] rounded-t opacity-80 group-hover:opacity-100 transition-opacity"
                      style={{ height: barH }}
                      title={`Valor BM: ${fmtBRL(bm.valorBm)}`}
                    />
                    {/* Accumulated bar */}
                    <div
                      className="w-8 bg-blue-500 rounded-t opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ height: acumH }}
                      title={`Acumulado: ${fmtBRL(bm.valorAcum)}`}
                    />
                  </div>
                  <div className="text-[9px] text-[#6b6b6b] text-center">{bm.label}</div>
                  <div className="text-[9px] text-[#f97316] text-center">{fmtBRL(bm.valorBm)}</div>
                </div>
              )
            })}
            <div className="flex items-end gap-3 ml-4 shrink-0 self-end pb-8">
              <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#f97316] rounded opacity-80 inline-block"/><span className="text-[9px] text-[#6b6b6b]">Por BM</span></div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded opacity-60 inline-block"/><span className="text-[9px] text-[#6b6b6b]">Acumulado</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Item-level comparison table */}
      {comparison.length > 0 && (
        <div className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wide">Comparativo por Item</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[#1f1f1f]">
                  {['Código', 'Descrição', 'Un.', 'Qtd Contratada', 'Qtd Medida', '% Físico', 'Vlr Contratado', 'Vlr Medido', 'Saldo'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-[#6b6b6b] border-b border-[#525252] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.codigo} className={`border-b border-[#2c2c2c] ${i % 2 === 0 ? 'bg-[#1f1f1f]' : 'bg-[#1a1a1a]'}`}>
                    <td className="px-2 py-1.5 font-mono text-[#a3a3a3]">{row.codigo}</td>
                    <td className="px-2 py-1.5 text-[#f5f5f5] max-w-[180px] truncate" title={row.descricao}>{row.descricao}</td>
                    <td className="px-2 py-1.5 text-[#a3a3a3] text-center">{row.unidade}</td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3]">{row.contratado.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-1.5 text-right text-[#f97316] font-semibold">{row.medido.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-[#3d3d3d] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.p >= 80 ? 'bg-green-500' : row.p >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${row.p}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-semibold ${row.p >= 80 ? 'text-green-400' : row.p >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {row.p}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3]">{fmtBRL(row.valorContratado)}</td>
                    <td className="px-2 py-1.5 text-right text-[#f97316]">{fmtBRL(row.valorMedido)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${row.valorContratado - row.valorMedido > 0 ? 'text-[#a3a3a3]' : 'text-red-400'}`}>
                      {fmtBRL(row.valorContratado - row.valorMedido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
