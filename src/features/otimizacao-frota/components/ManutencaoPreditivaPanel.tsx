import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useThemeStore } from '@/store/themeStore'
import type { PredictiveHealth, HealthRisk } from '@/types'

// ─── Risk meta ────────────────────────────────────────────────────────────────

const RISK_META: Record<HealthRisk, { label: string; color: string; bg: string }> = {
  critical: { label: 'Crítico', color: '#ef4444', bg: '#ef444415' },
  high:     { label: 'Alto',    color: '#2abfdc', bg: '#2abfdc15' },
  medium:   { label: 'Médio',   color: '#eab308', bg: '#eab30815' },
  low:      { label: 'Baixo',   color: '#22c55e', bg: '#22c55e15' },
}

// ─── SVG arc health gauge ─────────────────────────────────────────────────────

function HealthGauge({ score, color }: { score: number; color: string }) {
  const theme = useThemeStore((s) => s.theme)
  const trackColor = theme === 'dark' ? '#1c3658' : '#e5e8ed'
  const textColor  = theme === 'dark' ? '#f5f5f5' : '#1a1d23'

  const r = 24
  const cx = 32
  const cy = 32
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth="6" />
      {/* Progress */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      {/* Score text */}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
        {score}
      </text>
    </svg>
  )
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard({ h }: { h: PredictiveHealth }) {
  const meta = RISK_META[h.riskLevel]

  return (
    <div
      className="bg-[#112240] rounded-xl p-4 flex gap-4"
      style={{ border: `1px solid ${meta.color}30` }}
    >
      <HealthGauge score={h.healthScore} color={meta.color} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono text-xs font-bold text-[#2abfdc]">{h.equipmentCode}</span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1c3658] text-[#6b6b6b]"
          >
            {h.predictedFailureWindow}
          </span>
        </div>
        <p className="text-[#f5f5f5] text-sm font-medium mb-1.5 truncate">{h.equipmentName}</p>

        {/* Main factors */}
        <ul className="flex flex-col gap-0.5 mb-2">
          {h.mainFactors.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[#6b6b6b] text-xs">
              <span className="mt-0.5 shrink-0" style={{ color: meta.color }}>•</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Recommended action */}
        <p className="text-xs font-medium" style={{ color: meta.color }}>{h.recommendedAction}</p>

        {/* Cost/downtime */}
        <div className="flex gap-3 mt-1.5 text-xs text-[#6b6b6b]">
          <span>Parada estimada: <span className="text-[#f5f5f5]">{h.estimatedDowntimeDays}d</span></span>
          <span>Custo estimado: <span className="text-[#f5f5f5]">R${h.estimatedRepairCostBRL.toLocaleString('pt-BR')}</span></span>
        </div>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ManutencaoPreditivaPanel() {
  const { healthScores, runHealthEngine } = useOtimizacaoFrotaStore(
    useShallow((s) => ({ healthScores: s.healthScores, runHealthEngine: s.runHealthEngine }))
  )

  const critical = healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high')
  const others   = healthScores.filter((h) => h.riskLevel === 'medium' || h.riskLevel === 'low')
  const sorted   = [...critical.sort((a, b) => a.healthScore - b.healthScore), ...others.sort((a, b) => a.healthScore - b.healthScore)]

  return (
    <div className="flex flex-col gap-4">
      {/* Engine button */}
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">
          Saúde da Frota ({healthScores.length} equipamentos)
        </p>
        <button
          onClick={runHealthEngine}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-xs font-medium hover:bg-[#162e50] transition-colors"
        >
          <RefreshCw size={13} /> Rodar Engine
        </button>
      </div>

      {/* Priority queue alert */}
      {critical.length > 0 && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-3 flex gap-3">
          <AlertTriangle size={16} className="text-[#ef4444] shrink-0 mt-0.5" />
          <div>
            <p className="text-[#ef4444] text-sm font-semibold mb-1">
              {critical.length} equipamento{critical.length !== 1 ? 's' : ''} com risco crítico ou alto
            </p>
            <p className="text-[#6b6b6b] text-xs">
              {critical.map((h) => h.equipmentCode).join(', ')} — intervenção imediata recomendada
            </p>
          </div>
        </div>
      )}

      {/* Health cards grid */}
      {sorted.length === 0 ? (
        <div className="bg-[#112240] border border-[#1c3658] rounded-xl p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">Clique em "Rodar Engine" para calcular os scores.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map((h) => <HealthCard key={h.equipmentId} h={h} />)}
        </div>
      )}
    </div>
  )
}
