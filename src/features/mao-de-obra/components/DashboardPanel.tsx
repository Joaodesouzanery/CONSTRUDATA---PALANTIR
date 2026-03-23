import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore, getCertExpiringSoon } from '@/store/maoDeObraStore'

// ─── Bar Chart — Planned HH vs Actual HH per day (last 7 days) ───────────────

function HHBarChart({ timecards }: { timecards: import('@/types').TimecardEntry[] }) {
  const days: Array<{ label: string; actual: number }> = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
    const actual = timecards
      .filter((tc) => tc.date === iso)
      .reduce((sum, tc) => sum + tc.hoursWorked, 0)
    days.push({ label, actual })
  }

  // Planned HH per day (target: 8h × active workers in the day — use max observed as reference)
  const maxActual = Math.max(...days.map((d) => d.actual), 1)
  const plannedPerDay = Math.round(maxActual * 1.15)   // mock: planned is ~15% above actual average

  const chartH = 120

  return (
    <div className="bg-[#222222] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-4">HH Planejado vs Realizado (7 dias)</p>
      <div className="flex items-end gap-2 h-[120px]">
        {days.map((day, i) => {
          const actualH  = Math.round((day.actual   / plannedPerDay) * chartH)
          const plannedH = chartH   // always full height for planned

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex items-end justify-center gap-0.5" style={{ height: chartH }}>
                {/* planned bar */}
                <div
                  className="w-[45%] rounded-sm bg-[#3b82f6]/25 border border-[#3b82f6]/40"
                  style={{ height: plannedH }}
                  title={`Planejado: ${plannedPerDay}h`}
                />
                {/* actual bar */}
                <div
                  className="w-[45%] rounded-sm"
                  style={{
                    height: Math.max(4, actualH),
                    backgroundColor: actualH >= plannedH * 0.85 ? '#22c55e' : '#f59e0b',
                  }}
                  title={`Realizado: ${day.actual}h`}
                />
              </div>
              <span className="text-[#6b6b6b] text-[10px] truncate w-full text-center">{day.label}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-[#6b6b6b] text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]/40 inline-block" />
          Planejado
        </span>
        <span className="flex items-center gap-1.5 text-[#6b6b6b] text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e] inline-block" />
          Realizado ≥ 85%
        </span>
        <span className="flex items-center gap-1.5 text-[#6b6b6b] text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] inline-block" />
          Realizado {'<'} 85%
        </span>
      </div>
    </div>
  )
}

// ─── Physical Progress Summary ────────────────────────────────────────────────

function PhysicalProgressSummary({ progress }: { progress: import('@/types').PhysicalProgress[] }) {
  // Group by activityName, sum planned/reported
  const map = new Map<string, { planned: number; reported: number; unit: string }>()
  for (const p of progress) {
    const ex = map.get(p.activityName)
    if (ex) {
      ex.planned  += p.plannedQty
      ex.reported += p.reportedQty
    } else {
      map.set(p.activityName, { planned: p.plannedQty, reported: p.reportedQty, unit: p.unit })
    }
  }

  const rows = Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v, pct: v.planned > 0 ? Math.round((v.reported / v.planned) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)   // worst first
    .slice(0, 6)

  return (
    <div className="bg-[#222222] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Progresso Físico por Atividade</p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.name} className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-[#f5f5f5] text-xs truncate max-w-[60%]">{row.name}</span>
              <span
                className="text-xs font-medium"
                style={{ color: row.pct >= 90 ? '#22c55e' : row.pct >= 70 ? '#f59e0b' : '#ef4444' }}
              >
                {row.reported}/{row.planned} {row.unit} ({row.pct}%)
              </span>
            </div>
            <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, row.pct)}%`,
                  backgroundColor: row.pct >= 90 ? '#22c55e' : row.pct >= 70 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Cert Expiry Table ────────────────────────────────────────────────────────

function CertExpiryTable({ workers }: { workers: import('@/types').Worker[] }) {
  const expiring = getCertExpiringSoon(workers, 60)

  return (
    <div className="bg-[#222222] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">
        Certificações a Vencer (60 dias)
        {expiring.length > 0 && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-[#f59e0b]/20 text-[#f59e0b]">
            {expiring.length}
          </span>
        )}
      </p>
      {expiring.length === 0 ? (
        <p className="text-[#6b6b6b] text-sm">Nenhuma certificação vencendo nos próximos 60 dias.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-[#6b6b6b] text-xs font-medium pb-2">Funcionário</th>
                <th className="text-left text-[#6b6b6b] text-xs font-medium pb-2">Certificação</th>
                <th className="text-left text-[#6b6b6b] text-xs font-medium pb-2">Vence em</th>
                <th className="text-left text-[#6b6b6b] text-xs font-medium pb-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((item, i) => (
                <tr key={i} className="border-b border-[#1e1e1e] last:border-0">
                  <td className="py-2 text-[#f5f5f5] text-xs">{item.worker.name}</td>
                  <td className="py-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#2a2a2a] text-[#f5f5f5]">
                      {item.certType}
                    </span>
                  </td>
                  <td className="py-2 text-[#6b6b6b] text-xs">
                    {new Date(item.expiryDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: item.daysLeft <= 15 ? '#ef4444' : item.daysLeft <= 30 ? '#f59e0b' : '#22c55e' }}
                    >
                      {item.daysLeft}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function DashboardPanel() {
  const { workers, timecards, progress } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, timecards: s.timecards, progress: s.progress }))
  )

  return (
    <div className="flex flex-col gap-4">
      <HHBarChart timecards={timecards} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PhysicalProgressSummary progress={progress} />
        <CertExpiryTable workers={workers} />
      </div>
    </div>
  )
}
