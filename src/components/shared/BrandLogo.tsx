import { cn } from '@/lib/utils'
import { BRAND_MARK_PATH, BRAND_MARK_VIEWBOX } from '@/lib/brandMark'

/**
 * Marca ConstruData — o símbolo "N" oficial (Grupo Nery): duas peças congruentes giradas 180°
 * (barra ortogonal + diagonal + retorno), caixa 327×334. Path extraído do PDF do manual da marca
 * (traçado + otimização contra o render vetorial; desvio ~2%, nível de anti-alias). A peça B é a
 * peça A girada 180° — simetria oficial. `currentColor`: sidebar = laranja do app; landing = coral
 * ou branca via prop.
 */
export function WaterDropLogo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox={BRAND_MARK_VIEWBOX}
      fill="currentColor"
      width={size}
      height={Math.round((size * 334) / 327)}
      className={cn('text-[#f97316]', className)}
      aria-hidden="true"
    >
      <path d={BRAND_MARK_PATH} />
    </svg>
  )
}

/** Escalas do lockup: a caixa da marca e o texto crescem JUNTOS (senão a marca fica
 *  subdimensionada ao lado do nome). `md` é o default do app; `lg` é usado na landing. */
const LOCKUP_SIZES = {
  sm: { box: 'h-9 w-9', mark: 18, text: 'text-sm', tracking: '0.10em' },
  md: { box: 'h-10 w-10', mark: 20, text: 'text-base', tracking: '0.11em' },
  lg: { box: 'h-12 w-12', mark: 26, text: 'text-xl', tracking: '0.12em' },
} as const

export function BrandLockup({
  markSize,
  dark = false,
  compact = false,
  accent,
  size = 'md',
}: {
  markSize?: number
  dark?: boolean
  compact?: boolean
  /** Classe de cor da marca (ex.: 'text-[#e5484d]' na landing). Default: laranja do app. */
  accent?: string
  /** Escala do conjunto (marca + nome). */
  size?: keyof typeof LOCKUP_SIZES
}) {
  const s = LOCKUP_SIZES[compact ? 'sm' : size]
  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl border',
          s.box,
          dark ? 'border-black/12 bg-white' : 'border-white/14 bg-[#0d0d0d]',
        )}
      >
        <WaterDropLogo size={markSize ?? s.mark} className={accent} />
      </div>
      {/* Nome em CAIXA ALTA: caixa alta pede tracking mais aberto que o 0.02em anterior. */}
      <span
        className={cn('font-bold uppercase leading-none whitespace-nowrap', s.text, dark ? 'text-[#1f2420]' : 'text-[#f5f5f5]')}
        style={{ letterSpacing: s.tracking }}
      >
        ConstruData
      </span>
    </>
  )
}
