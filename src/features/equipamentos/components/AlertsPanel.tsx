import { useState } from 'react'
import { Bell, ChevronDown, ChevronUp, AlertTriangle, Info, Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import type { AlertSeverity } from '@/types'
import { ALERT_CONFIG } from '../constants'

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'warning', 'info']

export function AlertsPanel() {
  const [open, setOpen] = useState(true)
  const equipamentos      = useEquipamentosStore((s) => s.equipamentos)
  const acknowledgeAlert  = useEquipamentosStore((s) => s.acknowledgeAlert)
  const selectEquipamento = useEquipamentosStore((s) => s.selectEquipamento)

  const allAlerts = equipamentos
    .flatMap((eq) =>
      eq.alerts
        .filter((a) => !a.acknowledged)
        .map((a) => ({
          ...a,
          equipmentName: eq.name,
          equipmentCode: eq.code,
        }))
    )
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    )

  if (allAlerts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-6 py-3 border-t border-[#1c3658] bg-[#0e1f38] shrink-0 text-xs text-[#3f3f3f]">
        <CheckCheck size={13} className="text-[#22c55e]" />
        Nenhum alerta ativo — todos os equipamentos estão dentro dos parâmetros
      </div>
    )
  }

  return (
    <div
      className="border-t border-[#1c3658] bg-[#0e1f38] shrink-0"
      style={{ overflow: 'hidden', maxHeight: open ? 220 : 44, transition: 'max-height 0.2s ease' }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 h-11 hover:bg-[#112240] transition-colors shrink-0"
      >
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-[#ef4444]" />
          <span className="text-xs font-semibold text-[#f5f5f5]">Alertas Ativos</span>
          <span className="text-[10px] font-bold text-white bg-[#ef4444] rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
            {allAlerts.length}
          </span>
        </div>
        {open
          ? <ChevronDown size={14} className="text-[#6b6b6b]" />
          : <ChevronUp   size={14} className="text-[#6b6b6b]" />}
      </button>

      {/* Alert rows */}
      <div className="overflow-y-auto" style={{ maxHeight: 176 }}>
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {allAlerts.map((alert) => {
            const cfg = ALERT_CONFIG[alert.severity]
            const Icon = alert.severity === 'info' ? Info : AlertTriangle
            return (
              <div
                key={alert.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: cfg.colorMuted }}
              >
                <Icon size={13} style={{ color: cfg.color }} className="shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <button
                      className="text-[10px] text-[#2abfdc] hover:underline font-semibold"
                      onClick={() => selectEquipamento(alert.equipmentId)}
                    >
                      {alert.equipmentCode} — {alert.equipmentName}
                    </button>
                  </div>
                  <p className="text-xs text-[#a3a3a3] truncate">{alert.message}</p>
                </div>

                <button
                  onClick={() => acknowledgeAlert(alert.equipmentId, alert.id)}
                  title="Reconhecer alerta"
                  className={cn(
                    'shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors',
                    'border-[#1c3658] text-[#6b6b6b] hover:border-[#22c55e] hover:text-[#22c55e]'
                  )}
                >
                  <Check size={9} />
                  OK
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
