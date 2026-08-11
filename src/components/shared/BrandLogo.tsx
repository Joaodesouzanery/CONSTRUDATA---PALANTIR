import { cn } from '@/lib/utils'

/**
 * Marca ConstruData — glifo geométrico de "nós conectados" (a base operacional / ontologia).
 * Usa `currentColor`, então herda a cor do container (sidebar = laranja do app; landing = coral).
 * Placeholder editável: para usar o SVG oficial, troque os paths abaixo ou aponte para
 * `public/logos/construdata-logo.svg`. O nome do export é mantido para não quebrar os importadores.
 */
export function WaterDropLogo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={cn('text-[#f97316]', className)}
      aria-hidden="true"
    >
      <path d="M16 6 L26 24 L6 24 Z" />
      <circle cx="16" cy="6" r="3" fill="currentColor" stroke="none" />
      <circle cx="6" cy="24" r="3" fill="currentColor" stroke="none" />
      <circle cx="26" cy="24" r="3" fill="currentColor" stroke="none" />
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
