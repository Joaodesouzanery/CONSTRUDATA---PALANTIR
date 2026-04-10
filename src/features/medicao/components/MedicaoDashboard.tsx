import { useMedicaoStore } from '@/store/medicaoStore'
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }

export function MedicaoDashboard() {
  const { segments, getGlobalKpis, getNucleoSummaries } = useMedicaoStore()
  const kpis = getGlobalKpis()
  const summaries = getNucleoSummaries()

  if (segments.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-6">Importe o consolidado para ver o dashboard.</div>
  }

  // Progress by tipo
  const esgSegs = segments.filter((s) => s.tipo === 'ESGOTO' && s.status !== 'CADASTRO')
  const agSegs = segments.filter((s) => s.tipo === 'AGUA' && s.status !== 'CADASTRO')
  const esgExec = esgSegs.filter((s) => s.status === 'EXECUTADO').length
  const agExec = agSegs.filter((s) => s.status === 'EXECUTADO').length
  const esgPct = esgSegs.length > 0 ? Math.round((esgExec / esgSegs.length) * 100) : 0
  const agPct = agSegs.length > 0 ? Math.round((agExec / agSegs.length) * 100) : 0

  // Execution timeline (group by date)
  const execByDate = new Map<string, number>()
  for (const seg of segments) {
    if (seg.status === 'EXECUTADO' && seg.dataExec && !seg.dataExec.includes('nan')) {
      execByDate.set(seg.dataExec, (execByDate.get(seg.dataExec) ?? 0) + 1)
    }
  }
  const timeline = [...execByDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-20)

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<CheckCircle2 size={18} className="text-emerald-400" />} label="Executados" value={`${kpis.totalExec} trechos`} sub={`${fmt(kpis.kmExec)} km`} />
        <KpiCard icon={<AlertTriangle size={18} className="text-red-400" />} label="Pendentes" value={`${kpis.totalPend} trechos`} sub={`${fmt(kpis.kmPend)} km`} alert />
        <KpiCard icon={<BarChart3 size={18} className="text-cyan-400" />} label="Progresso Obra" value={`${kpis.pctExec}%`} sub={`${fmt(kpis.kmExec + kpis.kmPend)} km total obra`} />
        <KpiCard icon={<TrendingUp size={18} className="text-gray-400" />} label="Cadastro (excluído)" value={`${kpis.totalCad} trechos`} sub={`${fmt(kpis.kmCad)} km`} />
      </div>

      {/* Global Progress */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Progresso Geral da Obra</p>
          <p className="text-xs text-white font-bold">{kpis.pctExec}%</p>
        </div>
        <div className="h-4 bg-[#1f2937] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(kpis.pctExec, 100)}%`, background: 'linear-gradient(90deg, #06b6d4, #22d3ee)' }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-500">
          <span>{fmt(kpis.kmExec * 1000)}m executados</span>
          <span>{fmt(kpis.kmPend * 1000)}m pendentes</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By tipo */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Progresso por Tipo</p>
          <div className="space-y-3">
            <ProgressBar label="Esgoto" pct={esgPct} count={esgExec} total={esgSegs.length} color="#f59e0b" />
            <ProgressBar label="Agua" pct={agPct} count={agExec} total={agSegs.length} color="#3b82f6" />
          </div>
        </div>

        {/* By nucleo */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Progresso por Nucleo</p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {summaries.map((s) => (
              <div key={`${s.nucleo}-${s.tipo}`} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-28 shrink-0 truncate">{s.nucleo}</span>
                <div className="flex-1 h-3 bg-[#1f2937] rounded overflow-hidden">
                  <div className="h-full bg-cyan-500/60 rounded" style={{ width: `${s.pctExec}%` }} />
                </div>
                <span className="text-[10px] text-white font-medium w-10 text-right">{s.pctExec}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline de Execucao</p>
          <div className="flex items-end gap-1 h-24">
            {timeline.map(([date, count]) => {
              const maxCount = Math.max(...timeline.map(([, c]) => c))
              const h = (count / maxCount) * 100
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1" title={`${date}: ${count} trechos`}>
                  <div className="w-full bg-cyan-500/50 rounded-t" style={{ height: `${h}%` }} />
                  <span className="text-[7px] text-gray-600 rotate-45 origin-left whitespace-nowrap">{date}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`bg-[#111827] border rounded-xl p-4 ${alert ? 'border-red-500/30' : 'border-[#1f2937]'}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p></div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ProgressBar({ label, pct, count, total, color }: { label: string; pct: number; count: number; total: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-300">{label}</span>
        <span className="text-xs text-white font-bold">{pct}% ({count}/{total})</span>
      </div>
      <div className="h-2.5 bg-[#1f2937] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
