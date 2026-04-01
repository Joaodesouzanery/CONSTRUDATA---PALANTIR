import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Mini sparkline bar chart ─────────────────────────────────────────────────

function Sparkline({ values, color = '#f97316' }: { values: number[]; color?: string }) {
  const W = 44
  const H = 24
  const max = Math.max(...values, 1)
  const barW = Math.max(2, Math.floor((W - (values.length - 1) * 1.5) / values.length))
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      {values.map((v, i) => {
        const barH = Math.max(2, Math.round((v / max) * (H - 2)))
        const x = i * (barW + 1.5)
        return (
          <rect
            key={i}
            x={x}
            y={H - barH}
            width={barW}
            height={barH}
            rx={1}
            fill={color}
            opacity={i === values.length - 1 ? 1 : 0.5}
          />
        )
      })}
    </svg>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

type StatVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent?: boolean
  variant?: StatVariant
  className?: string
  sparkline?: number[]   // 5–8 values, will be auto-normalized
  trend?: string         // e.g. "+0.94% last year"
}

const VARIANT_CONFIG: Record<StatVariant, { leftBorder: string; iconBg: string; iconText: string; valueText: string; sparklineColor: string }> = {
  default: {
    leftBorder:    'border-l-[#404040]',
    iconBg:        'bg-[#484848]',
    iconText:      'text-[#a3a3a3]',
    valueText:     'text-[#f5f5f5]',
    sparklineColor: '#4a4a4a',
  },
  accent: {
    leftBorder:    'border-l-[#f97316]',
    iconBg:        'bg-[#f97316]/15',
    iconText:      'text-[#f97316]',
    valueText:     'text-[#f97316]',
    sparklineColor: '#f97316',
  },
  success: {
    leftBorder:    'border-l-[#22c55e]',
    iconBg:        'bg-[#22c55e]/15',
    iconText:      'text-[#22c55e]',
    valueText:     'text-[#22c55e]',
    sparklineColor: '#22c55e',
  },
  warning: {
    leftBorder:    'border-l-[#eab308]',
    iconBg:        'bg-[#eab308]/15',
    iconText:      'text-[#eab308]',
    valueText:     'text-[#eab308]',
    sparklineColor: '#eab308',
  },
  danger: {
    leftBorder:    'border-l-[#ef4444]',
    iconBg:        'bg-[#ef4444]/15',
    iconText:      'text-[#ef4444]',
    valueText:     'text-[#ef4444]',
    sparklineColor: '#ef4444',
  },
}

export function StatCard({
  label, value, sub, icon: Icon, accent, variant: variantProp, className, sparkline, trend,
}: StatCardProps) {
  const variant: StatVariant = variantProp ?? (accent ? 'accent' : 'default')
  const cfg = VARIANT_CONFIG[variant]

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border border-[#525252] border-l-4 bg-[#3d3d3d] p-4 min-w-0',
        cfg.leftBorder,
        className,
      )}
    >
      {/* Top row: label + icon/sparkline */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3] leading-none mt-0.5 truncate min-w-0">
          {label}
        </span>
        {sparkline ? (
          <Sparkline values={sparkline} color={cfg.sparklineColor} />
        ) : (
          <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg shrink-0', cfg.iconBg, cfg.iconText)}>
            <Icon size={15} />
          </div>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={cn('text-xl font-bold font-mono leading-tight truncate block min-w-0', cfg.valueText)}>
          {value}
        </span>
        {sub && <span className="text-[11px] text-[#6b6b6b] shrink-0">{sub}</span>}
      </div>

      {/* Trend row */}
      {trend && (
        <span className={cn(
          'text-[10px] font-medium',
          trend.startsWith('+') ? 'text-[#22c55e]' : trend.startsWith('-') ? 'text-[#ef4444]' : 'text-[#6b6b6b]',
        )}>
          {trend}
        </span>
      )}
    </div>
  )
}
