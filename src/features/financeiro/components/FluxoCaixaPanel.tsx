import { useFinanceiroStore } from '@/store/financeiroStore'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export function FluxoCaixaPanel() {
  const { getMonthlyData, entries } = useFinanceiroStore()
  const monthly = getMonthlyData()

  if (entries.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-[#6b6b6b] text-sm p-6">Adicione lançamentos para ver o fluxo de caixa.</div>
  }

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <p className="text-xs text-[#a3a3a3] uppercase tracking-wider font-semibold">Fluxo de Caixa Mensal</p>

      <div className="overflow-auto rounded-xl border border-[#525252]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
              <th className="px-4 py-2 text-left">Mês</th>
              <th className="px-4 py-2 text-right">Entradas</th>
              <th className="px-4 py-2 text-right">Saídas</th>
              <th className="px-4 py-2 text-right">Resultado Mês</th>
              <th className="px-4 py-2 text-right">Saldo Acumulado</th>
              <th className="px-4 py-2 text-left w-[200px]">Gráfico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {monthly.map((m) => {
              const resultado = m.entradas - m.saidas
              const maxVal = Math.max(...monthly.map((x) => Math.max(x.entradas, x.saidas)), 1)
              return (
                <tr key={m.month} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-white font-medium">{m.month}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-400 tabular-nums font-medium">{fmtBRL(m.entradas)}</td>
                  <td className="px-4 py-2.5 text-right text-red-400 tabular-nums font-medium">{fmtBRL(m.saidas)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {resultado >= 0 ? '+' : ''}{fmtBRL(resultado)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${m.saldo >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    {fmtBRL(m.saldo)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-0.5 h-4">
                      <div className="bg-emerald-500/40 rounded" style={{ width: `${(m.entradas / maxVal) * 100}px` }} />
                      <div className="bg-red-500/40 rounded" style={{ width: `${(m.saidas / maxVal) * 100}px` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
