/**
 * ResumoNucleoPanel — Resumo por Núcleo from Planilhas Consolidadas.
 * Shows summary table with 11 nucleos + progress bars + KPI totals.
 */
import { resumoNucleos, resumoGlobal } from '@/data/mockPlanilhasConsolidadas'
import { cn } from '@/lib/utils'

function ProgressBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const color = pct >= 50 ? '#22c55e' : pct >= 25 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className={cn('rounded-full bg-[#525252] flex-1', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  )
}

export function ResumoNucleoPanel() {
  const totals = {
    trObra: resumoNucleos.reduce((s, r) => s + r.trObra, 0),
    trExec: resumoNucleos.reduce((s, r) => s + r.trExec, 0),
    trPend: resumoNucleos.reduce((s, r) => s + r.trPend, 0),
    trCad:  resumoNucleos.reduce((s, r) => s + r.trCad, 0),
    kmObra: resumoNucleos.reduce((s, r) => s + r.kmObra, 0),
    kmExec: resumoNucleos.reduce((s, r) => s + r.kmExec, 0),
    kmPend: resumoNucleos.reduce((s, r) => s + r.kmPend, 0),
  }

  return (
    <div className="flex flex-col gap-4 overflow-auto flex-1">
      {/* Info banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3d3d3d] border border-[#525252] text-xs text-[#a3a3a3]">
        <span className="font-semibold text-[#f5f5f5]">{resumoGlobal.contrato}</span>
        <span>|</span>
        <span>Data ref.: {resumoGlobal.dataRef}</span>
        <span>|</span>
        <span>{resumoGlobal.execMetros.toLocaleString('pt-BR')}m executados de {(resumoGlobal.execMetros + resumoGlobal.pendMetros).toLocaleString('pt-BR')}m em obra</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#3d3d3d] border-[#525252]">
          <p className="text-[#6b6b6b] text-xs">Trechos em Obra</p>
          <p className="text-2xl font-bold tabular-nums text-[#f5f5f5]">{totals.trObra}</p>
        </div>
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#16a34a]/10 border-[#16a34a]/30">
          <p className="text-[#6b6b6b] text-xs">Executados</p>
          <p className="text-2xl font-bold tabular-nums text-[#4ade80]">{totals.trExec}</p>
        </div>
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#dc2626]/10 border-[#dc2626]/30">
          <p className="text-[#6b6b6b] text-xs">Pendentes</p>
          <p className="text-2xl font-bold tabular-nums text-[#f87171]">{totals.trPend}</p>
        </div>
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#ca8a04]/10 border-[#ca8a04]/30">
          <p className="text-[#6b6b6b] text-xs">km Executados / Obra</p>
          <p className="text-2xl font-bold tabular-nums text-[#fbbf24]">{totals.kmExec.toFixed(1)} / {totals.kmObra.toFixed(1)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#525252] rounded-xl overflow-hidden flex-1">
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <table className="w-full text-xs">
            <thead className="bg-[#3d3d3d] sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 text-[#a3a3a3] font-semibold">Núcleo</th>
                <th className="text-center px-2 py-2.5 text-[#a3a3a3] font-semibold">Tipo</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">Tr Obra</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">Tr Exec</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">Tr Pend</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">Tr Cad</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">km Obra</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">km Exec</th>
                <th className="text-right px-2 py-2.5 text-[#a3a3a3] font-semibold">km Pend</th>
                <th className="text-center px-2 py-2.5 text-[#a3a3a3] font-semibold">Ratio</th>
                <th className="px-3 py-2.5 text-[#a3a3a3] font-semibold w-32">% Exec</th>
              </tr>
            </thead>
            <tbody>
              {resumoNucleos.map((r, i) => (
                <tr
                  key={`${r.nucleo}-${r.tipo}`}
                  className={cn(
                    'border-t border-[#525252]/50 hover:bg-[#484848]/50 transition-colors',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-[#3d3d3d]/30',
                  )}
                >
                  <td className="px-3 py-2 text-[#f5f5f5] font-medium">{r.nucleo}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-bold',
                      r.tipo === 'AGUA'
                        ? 'bg-[#3b82f6]/20 text-[#60a5fa]'
                        : 'bg-[#a855f7]/20 text-[#c084fc]',
                    )}>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-[#a3a3a3] tabular-nums">{r.trObra}</td>
                  <td className="px-2 py-2 text-right text-[#4ade80] tabular-nums font-medium">{r.trExec}</td>
                  <td className="px-2 py-2 text-right text-[#f87171] tabular-nums">{r.trPend}</td>
                  <td className="px-2 py-2 text-right text-[#6b6b6b] tabular-nums">{r.trCad}</td>
                  <td className="px-2 py-2 text-right text-[#a3a3a3] tabular-nums">{r.kmObra}</td>
                  <td className="px-2 py-2 text-right text-[#4ade80] tabular-nums">{r.kmExec}</td>
                  <td className="px-2 py-2 text-right text-[#f87171] tabular-nums">{r.kmPend}</td>
                  <td className="px-2 py-2 text-center text-[#a3a3a3] tabular-nums">{r.ratio}</td>
                  <td className="px-3 py-2"><ProgressBar pct={r.pctExec} size="sm" /></td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-[#f97316]/30 bg-[#3d3d3d] font-bold">
                <td className="px-3 py-2.5 text-[#f97316]">TOTAL</td>
                <td className="px-2 py-2.5 text-center text-[#6b6b6b]">—</td>
                <td className="px-2 py-2.5 text-right text-[#f5f5f5] tabular-nums">{totals.trObra}</td>
                <td className="px-2 py-2.5 text-right text-[#4ade80] tabular-nums">{totals.trExec}</td>
                <td className="px-2 py-2.5 text-right text-[#f87171] tabular-nums">{totals.trPend}</td>
                <td className="px-2 py-2.5 text-right text-[#6b6b6b] tabular-nums">{totals.trCad}</td>
                <td className="px-2 py-2.5 text-right text-[#f5f5f5] tabular-nums">{totals.kmObra.toFixed(1)}</td>
                <td className="px-2 py-2.5 text-right text-[#4ade80] tabular-nums">{totals.kmExec.toFixed(1)}</td>
                <td className="px-2 py-2.5 text-right text-[#f87171] tabular-nums">{totals.kmPend.toFixed(1)}</td>
                <td className="px-2 py-2.5 text-center text-[#6b6b6b]">—</td>
                <td className="px-3 py-2.5"><ProgressBar pct={resumoGlobal.progressoObra} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
