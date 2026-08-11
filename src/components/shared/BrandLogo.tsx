import { cn } from '@/lib/utils'

/**
 * Marca ConstruData — o símbolo "N" (Grupo Nery): um N geométrico de duas peças a 45°.
 * Recriado como SVG em `currentColor`, então herda a cor do container (sidebar = laranja do app;
 * landing = coral). Interpretação vetorial do símbolo oficial; para pixel-exato, exporte o símbolo
 * em .svg (não .pdf) e troque o path abaixo (ou aponte para public/logos/construdata-logo.svg).
 */
export function WaterDropLogo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      width={size}
      height={size}
      className={cn('text-[#f97316]', className)}
      aria-hidden="true"
    >
      <path d="M13 87 V13 H35 L65 53 V13 H87 V87 H65 L35 47 V87 Z" />
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
