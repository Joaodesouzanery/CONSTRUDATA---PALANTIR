import { useMedicaoStore } from '@/store/medicaoStore'

function fmt(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }

export function ResumoNucleoPanel() {
  const { getNucleoSummaries, segments } = useMedicaoStore()
  const summaries = getNucleoSummaries()

  if (segments.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-6">Importe o consolidado primeiro na aba "Consolidado".</div>
  }

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Resumo por Nucleo</p>

      <div className="overflow-auto rounded-xl border border-[#1f2937]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0d1117] text-gray-400 uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left">Nucleo</th>
              <th className="px-3 py-2 text-center">Tipo</th>
              <th className="px-3 py-2 text-right">Tr Total</th>
              <th className="px-3 py-2 text-right">Tr Obra</th>
              <th className="px-3 py-2 text-right">Tr Cad</th>
              <th className="px-3 py-2 text-right">Tr Exec</th>
              <th className="px-3 py-2 text-right">Tr Pend</th>
              <th className="px-3 py-2 text-right">km Obra</th>
              <th className="px-3 py-2 text-right">km Exec</th>
              <th className="px-3 py-2 text-right">km Pend</th>
              <th className="px-3 py-2 text-right">% Exec</th>
              <th className="px-3 py-2 text-left w-[120px]">Progresso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {summaries.map((s) => (
              <tr key={`${s.nucleo}-${s.tipo}`} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2 text-white font-medium">{s.nucleo}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${s.tipo === 'ESGOTO' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {s.tipo}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{s.trTotal}</td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{s.trObra}</td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums italic">{s.trCad}</td>
                <td className="px-3 py-2 text-right text-emerald-400 tabular-nums font-medium">{s.trExec}</td>
                <td className="px-3 py-2 text-right text-red-400 tabular-nums font-medium">{s.trPend}</td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{fmt(s.kmObra)}</td>
                <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{fmt(s.kmExec)}</td>
                <td className="px-3 py-2 text-right text-red-400 tabular-nums">{fmt(s.kmPend)}</td>
                <td className="px-3 py-2 text-right text-cyan-400 font-bold tabular-nums">{s.pctExec}%</td>
                <td className="px-3 py-2">
                  <div className="h-2 bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(s.pctExec, 100)}%`,
                        background: s.pctExec >= 80 ? '#10b981' : s.pctExec >= 40 ? '#06b6d4' : '#f59e0b',
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
