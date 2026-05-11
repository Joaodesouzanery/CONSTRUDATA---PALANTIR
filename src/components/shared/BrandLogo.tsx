import { cn } from '@/lib/utils'

export function WaterDropLogo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 36 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={Math.round((size * 44) / 36)}
      className={cn('text-[#f97316]', className)}
      aria-hidden="true"
    >
      <path d="M18 2 C18 2 33 17 33 28 C33 37.2 26.3 43 18 43 C9.7 43 3 37.2 3 28 C3 17 18 2 18 2Z" />
      <path d="M18 12 C18 12 27 23 27 29.5 C27 35.5 23 39.5 18 39.5 C13 39.5 9 35.5 9 29.5 C9 23 18 12 18 12Z" />
    </svg>
  )
}

export function BrandLockup({
  markSize = 20,
  dark = false,
  compact = false,
}: {
  markSize?: number
  dark?: boolean
  compact?: boolean
}) {
  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          compact ? 'h-9 w-9 rounded-xl' : 'h-10 w-10 rounded-xl',
        )}
        style={{
          background: dark
            ? 'radial-gradient(circle at 40% 35%, #fffaf0 0%, #fffdf8 100%)'
            : 'radial-gradient(circle at 40% 35%, #333333 0%, #222222 100%)',
          boxShadow: dark
            ? '0 12px 30px rgba(31,36,32,0.08), inset 0 1px 0 rgba(249,115,22,0.14)'
            : '0 0 12px rgba(249,115,22,0.25), inset 0 1px 0 rgba(249,115,22,0.15)',
          border: '1px solid rgba(249,115,22,0.3)',
        }}
      >
        <WaterDropLogo size={markSize} />
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
