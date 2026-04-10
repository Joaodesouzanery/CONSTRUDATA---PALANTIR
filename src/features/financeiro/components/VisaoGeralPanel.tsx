import { useFinanceiroStore } from '@/store/financeiroStore'
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export function VisaoGeralPanel() {
  const { getTotalEntradas, getTotalSaidas, getSaldo, getMonthlyData, entries } = useFinanceiroStore()
  const entradas = getTotalEntradas()
  const saidas = getTotalSaidas()
  const saldo = getSaldo()
  const margem = entradas > 0 ? (saldo / entradas) * 100 : 0
  const monthly = getMonthlyData()

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp size={18} className="text-emerald-400" />} label="Total Entradas" value={fmtBRL(entradas)} color="text-emerald-400" />
        <KpiCard icon={<TrendingDown size={18} className="text-red-400" />} label="Total Saídas" value={fmtBRL(saidas)} color="text-red-400" />
        <KpiCard icon={<DollarSign size={18} className={saldo >= 0 ? 'text-emerald-400' : 'text-red-400'} />}
          label="Saldo (Lucro/Prejuízo)" value={fmtBRL(saldo)} color={saldo >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <KpiCard icon={<BarChart3 size={18} className="text-cyan-400" />} label="Margem" value={`${margem.toFixed(1)}%`} color="text-cyan-400" />
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm">
          Nenhum lançamento financeiro. Adicione entradas e saídas nas respectivas abas.
        </div>
      ) : (
        <>
          {/* Monthly Chart */}
          {monthly.length > 0 && (
            <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
              <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-4">Receita × Despesa Mensal</p>
              <div className="space-y-3">
                {monthly.map((m) => {
                  const max = Math.max(...monthly.map((x) => Math.max(x.entradas, x.saidas)), 1)
                  return (
                    <div key={m.month}>
                      <div className="flex items-center justify-between text-[10px] text-[#a3a3a3] mb-1">
                        <span>{m.month}</span>
                        <span className={m.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}>Saldo: {fmtBRL(m.saldo)}</span>
                      </div>
                      <div className="flex gap-1 h-4">
                        <div className="bg-emerald-500/40 rounded" style={{ width: `${(m.entradas / max) * 50}%` }} title={`Entradas: ${fmtBRL(m.entradas)}`} />
                        <div className="bg-red-500/40 rounded" style={{ width: `${(m.saidas / max) * 50}%` }} title={`Saídas: ${fmtBRL(m.saidas)}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3 text-[10px] text-[#6b6b6b]">
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/40 rounded" /> Entradas</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/40 rounded" /> Saídas</span>
              </div>
            </div>
          )}

          {/* Recent entries */}
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Últimos Lançamentos</p>
            <div className="space-y-1.5">
              {[...entries].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-[#525252]/50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${e.tipo === 'entrada' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-xs text-white">{e.descricao}</span>
                    <span className="text-[10px] text-[#6b6b6b]">{e.data}</span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${e.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {e.tipo === 'entrada' ? '+' : '-'}{fmtBRL(e.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <p className={`text-xl font-bold ${color || 'text-white'}`}>{value}</p>
    </div>
  )
}
