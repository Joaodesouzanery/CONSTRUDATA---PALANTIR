import { Wrench, Clock } from 'lucide-react'
import { formatCurrency, formatHours } from '@/lib/utils'
import { useCurrentReport } from '@/hooks/useRelatorio360'

export function EquipmentPanel() {
  const report = useCurrentReport()
  const logs = report?.equipmentLogs ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Wrench size={13} />
          Equipamentos Utilizados
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{logs.length} itens</span>
      </div>

      <div className="rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#6b6b6b]">Nenhum equipamento registrado</div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {/* Header */}
            <div className="grid grid-cols-4 px-4 py-2 text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
              <span>ID / Tipo</span>
              <span>Atividade</span>
              <span className="text-right">Horas</span>
              <span className="text-right">Custo</span>
            </div>
            {logs.map((log) => {
              const activity = report?.activities.find((a) => a.id === log.activityId)
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-4 px-4 py-3 text-sm items-center hover:bg-[#252525] transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-[#f97316] font-semibold">{log.equipmentId}</span>
                    <span className="text-[#f5f5f5] text-xs font-medium">{log.type}</span>
                  </div>
                  <span className="text-[#a3a3a3] text-xs truncate pr-2">
                    {activity?.name ?? '—'}
                  </span>
                  <div className="flex items-center justify-end gap-1 text-xs text-[#a3a3a3]">
                    <Clock size={11} />
                    <span className="font-mono">{formatHours(log.utilizationHours)}</span>
                  </div>
                  <span className="text-right font-mono text-xs text-[#f97316] font-semibold">
                    {formatCurrency(log.utilizationHours * log.hourlyRate)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
