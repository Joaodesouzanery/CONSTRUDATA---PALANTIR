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

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent?: boolean
  className?: string
  sparkline?: number[]   // 5–8 values, will be auto-normalized
  trend?: string         // e.g. "+0.94% last year"
}

export function StatCard({ label, value, sub, icon: Icon, accent, className, sparkline, trend }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-4',
        className
      )}
    >
      {/* Top row: label + icon/sparkline */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b6b] leading-none mt-0.5">
          {label}
        </span>
        {sparkline ? (
          <Sparkline values={sparkline} color={accent ? '#f97316' : '#3a3a3a'} />
        ) : (
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
              accent ? 'bg-[#f97316]/15 text-[#f97316]' : 'bg-[#262626] text-[#6b6b6b]'
            )}
          >
            <Icon size={15} />
          </div>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-bold font-mono leading-none',
            accent ? 'text-[#f97316]' : 'text-[#f5f5f5]'
          )}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-[#6b6b6b]">{sub}</span>}
      </div>

      {/* Trend row */}
      {trend && (
        <span className={cn(
          'text-[10px] font-medium',
          trend.startsWith('+') ? 'text-[#22c55e]' : trend.startsWith('-') ? 'text-[#ef4444]' : 'text-[#6b6b6b]'
        )}>
          {trend}
        </span>
      )}
    </div>
  )
}
