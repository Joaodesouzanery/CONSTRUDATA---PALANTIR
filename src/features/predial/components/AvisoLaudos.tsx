/**
 * AvisoLaudos — aviso IN-APP de vencimento de laudos, escalonado 60/30/7 (sem e-mail).
 * Recebe a lista de laudos JÁ ESCOPADA pelo chamador (obra ativa / organização) e mostra
 * quantas obrigações estão vencidas / a ≤7 / ≤30 / ≤60 dias. Cada segmento é clicável
 * (quando `onTier` é dado) para filtrar/abrir a aba. Tudo derivado da `validade` — nada
 * persistido, então funciona igual em modo demo e em dados reais.
 */
import { AlertTriangle, BellRing } from 'lucide-react'
import { cn } from '@/lib/utils'
import { contarLaudosPorTier, type LaudoAlertTier } from '../utils/laudos'

const SEG: { tier: LaudoAlertTier; label: string; text: string; dot: string }[] = [
  { tier: 'vencido', label: 'vencidos', text: 'text-[#f87171]', dot: 'bg-[#ef4444]' },
  { tier: 'd7',      label: '≤ 7 dias', text: 'text-[#fb7185]', dot: 'bg-[#f43f5e]' },
  { tier: 'd30',     label: '≤ 30 dias', text: 'text-[#fbbf24]', dot: 'bg-[#f59e0b]' },
  { tier: 'd60',     label: '≤ 60 dias', text: 'text-[#facc15]', dot: 'bg-[#eab308]' },
]

export function AvisoLaudos({
  laudos,
  onTier,
  className,
}: {
  laudos: { validade?: string }[]
  onTier?: (tier: LaudoAlertTier) => void
  className?: string
}) {
  const c = contarLaudosPorTier(laudos)
  const total = c.vencido + c.d7 + c.d30 + c.d60

  if (total === 0) {
    return (
      <div className={cn('flex items-center gap-2 rounded-xl border border-[#525252] bg-[#333333] px-4 py-2.5 text-xs text-[#6b6b6b]', className)}>
        <BellRing size={14} className="text-[#4ade80]" /> Nenhuma obrigação vencendo nos próximos 60 dias.
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/[0.07] px-4 py-2.5', className)}>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#fbbf24]">
        <AlertTriangle size={14} /> Aviso 60/30/7
      </span>
      {SEG.map((s) => c[s.tier] > 0 && (
        <button
          key={s.tier}
          type="button"
          onClick={() => onTier?.(s.tier)}
          disabled={!onTier}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#333333]/70 px-2.5 py-1 text-xs font-semibold tabular-nums',
            s.text,
            onTier ? 'hover:border-[#f97316]/60' : 'cursor-default',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', s.dot)} /> {c[s.tier]} {s.label}
        </button>
      ))}
      <span className="ml-auto text-[10px] text-[#a3a3a3]">aviso no painel — sem e-mail</span>
    </div>
  )
}
