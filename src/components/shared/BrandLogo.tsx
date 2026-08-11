import { cn } from '@/lib/utils'

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
      viewBox="0 0 327 334"
      fill="currentColor"
      width={size}
      height={Math.round((size * 334) / 327)}
      className={cn('text-[#f97316]', className)}
      aria-hidden="true"
    >
      <path d="M2.6 0 L130.2 0 L261.2 140.6 L263.1 55.8 L210.5 0 L327 0 L327 233 L268 233 L100.1 51.4 L2.6 51.4 Z M324.4 334 L196.8 334 L65.8 193.4 L63.9 278.2 L116.5 334 L0 334 L0 101 L59 101 L226.9 282.6 L324.4 282.6 Z" />
    </svg>
  )
}

export function BrandLockup({
  markSize = 20,
  dark = false,
  compact = false,
  accent,
}: {
  markSize?: number
  dark?: boolean
  compact?: boolean
  /** Classe de cor da marca (ex.: 'text-[#e5484d]' na landing). Default: laranja do app. */
  accent?: string
}) {
  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl border',
          compact ? 'h-9 w-9' : 'h-10 w-10',
          dark ? 'border-black/12 bg-white' : 'border-white/14 bg-[#0d0d0d]',
        )}
      >
        <WaterDropLogo size={markSize} className={accent} />
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={cn('text-sm font-bold whitespace-nowrap', dark ? 'text-[#1f2420]' : 'text-[#f5f5f5]')}
          style={{ letterSpacing: '0.02em' }}
        >
          ConstruData
        </span>
      </div>
    </>
  )
}
