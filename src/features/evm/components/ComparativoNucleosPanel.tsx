import { formatCurrency } from '@/lib/utils'
import { useEvmStore } from '@/store/evmStore'

function calc(n: ReturnType<typeof useEvmStore.getState>['nucleos'][number]) {
  const latest = n.evm.at(-1)
  const pv = latest?.pv ?? 0
  const ev = n.workPackages.reduce((sum, wp) => sum + wp.evReconhecido, 0)
  const ac = n.saidas.reduce((sum, s) => sum + s.valor, 0)
  const cpi = ac > 0 ? ev / ac : 0
  const spi = pv > 0 ? ev / pv : 0
  return { pv, ev, ac, cpi, spi, eac: cpi > 0 ? n.bacAlocado / Math.max(0.35, cpi * (latest?.ppcMedio ?? 0.8)) : 0 }
}

export function ComparativoNucleosPanel() {
  const nucleos = useEvmStore((s) => s.nucleos)
  const totals = nucleos.reduce(
    (acc, n) => {
      const m = calc(n)
      return { bac: acc.bac + n.bacAlocado, pv: acc.pv + m.pv, ev: acc.ev + m.ev, ac: acc.ac + m.ac }
    },
    { bac: 0, pv: 0, ev: 0, ac: 0 },
  )
  const consolidatedCpi = totals.ac > 0 ? totals.ev / totals.ac : 0
  const consolidatedSpi = totals.pv > 0 ? totals.ev / totals.pv : 0

  return (
    <div className="space-y-4 p-6">
      <div>
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Comparativo por Nucleo</h2>
        <p className="text-xs text-[#8a8a8a]">Consolidado soma PV, EV, AC e BAC antes de recalcular CPI/SPI.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-lg border border-[#525252] bg-[#343434] p-3"><p className="text-xs text-[#8a8a8a]">BAC</p><p className="font-semibold text-[#f5f5f5]">{formatCurrency(totals.bac)}</p></div>
        <div className="rounded-lg border border-[#525252] bg-[#343434] p-3"><p className="text-xs text-[#8a8a8a]">PV</p><p className="font-semibold text-[#f5f5f5]">{formatCurrency(totals.pv)}</p></div>
        <div className="rounded-lg border border-[#525252] bg-[#343434] p-3"><p className="text-xs text-[#8a8a8a]">EV</p><p className="font-semibold text-[#f97316]">{formatCurrency(totals.ev)}</p></div>
        <div className="rounded-lg border border-[#525252] bg-[#343434] p-3"><p className="text-xs text-[#8a8a8a]">CPI consolidado</p><p className="font-semibold text-[#f5f5f5]">{consolidatedCpi.toFixed(2)}</p></div>
        <div className="rounded-lg border border-[#525252] bg-[#343434] p-3"><p className="text-xs text-[#8a8a8a]">SPI consolidado</p><p className="font-semibold text-[#f5f5f5]">{consolidatedSpi.toFixed(2)}</p></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#525252] bg-[#343434]">
        <table className="w-full text-sm">
          <thead className="bg-[#2c2c2c] text-xs text-[#8a8a8a]">
            <tr>
              <th className="px-4 py-3 text-left">Nucleo</th>
              <th className="px-4 py-3 text-right">BAC</th>
              <th className="px-4 py-3 text-right">PV</th>
              <th className="px-4 py-3 text-right">EV</th>
              <th className="px-4 py-3 text-right">AC</th>
              <th className="px-4 py-3 text-right">CPI</th>
              <th className="px-4 py-3 text-right">SPI</th>
              <th className="px-4 py-3 text-right">EAC</th>
            </tr>
          </thead>
          <tbody>
            {nucleos.map((n) => {
              const m = calc(n)
              return (
                <tr key={n.id} className="border-t border-[#525252]/60">
                  <td className="px-4 py-3 text-[#f5f5f5]">{n.codigo} - {n.nome}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#a3a3a3]">{formatCurrency(n.bacAlocado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#a3a3a3]">{formatCurrency(m.pv)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f97316]">{formatCurrency(m.ev)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#a3a3a3]">{formatCurrency(m.ac)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f5f5f5]">{m.cpi.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f5f5f5]">{m.spi.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f5f5f5]">{formatCurrency(m.eac)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
