import { useMemo } from 'react'
import { AlertTriangle, Info, XCircle, CheckCircle } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { buildEventLog } from '../utils/buildEventLog'
import { detectAnomalias } from '../utils/detectAnomalias'

export function AnomaliasFeed() {
  const sites = useTorreStore((s) => s.sites) ?? []
  const events = useMemo(() => buildEventLog(), [])
  const anomalias = useMemo(() => detectAnomalias(events, sites), [events, sites])

  const severidadeConfig = {
    critical: { color: '#ef4444', bg: '#ef444422', Icon: XCircle, label: 'Crítico' },
    warning: { color: '#eab308', bg: '#eab30822', Icon: AlertTriangle, label: 'Atenção' },
    info: { color: '#3b82f6', bg: '#3b82f622', Icon: Info, label: 'Info' },
  }

  if (anomalias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#6b6b6b]">
        <CheckCircle className="w-12 h-12 mb-3 text-[#22c55e]" />
        <p className="text-base font-medium text-[#a3a3a3]">Nenhuma anomalia detectada</p>
        <p className="text-sm mt-1">Todos os processos estão dentro do esperado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[#a3a3a3] text-sm mb-2">{anomalias.length} anomalia(s) detectada(s)</p>
      {anomalias.map((a) => {
        const cfg = severidadeConfig[a.severidade]
        const Icon = cfg.Icon
        return (
          <div
            key={a.id}
            className="bg-[#2c2c2c] rounded-lg p-4 border border-[#525252] flex gap-3"
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: cfg.bg }}
            >
              <Icon className="w-4 h-4" style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ color: cfg.color, backgroundColor: cfg.bg }}
                >
                  {cfg.label}
                </span>
                {a.obraName && (
                  <span className="text-xs text-[#a3a3a3] bg-[#1c1c1c] px-2 py-0.5 rounded-full">
                    {a.obraName}
                  </span>
                )}
              </div>
              <p className="text-[#f5f5f5] font-medium text-sm">{a.titulo}</p>
              <p className="text-[#a3a3a3] text-xs mt-0.5">{a.descricao}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
