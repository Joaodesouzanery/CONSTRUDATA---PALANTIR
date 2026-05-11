import { cn } from '@/lib/utils'

interface MarqueeProps {
  children: React.ReactNode
  className?: string
  repeat?: number
  reverse?: boolean
  vertical?: boolean
}

export function Marquee({ children, className, repeat = 4, reverse = false, vertical = false }: MarqueeProps) {
  return (
    <div className={cn('group flex overflow-hidden [--gap:1rem]', vertical ? 'flex-col' : 'flex-row', className)}>
      {Array.from({ length: repeat }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'flex shrink-0 justify-around gap-[var(--gap)]',
            vertical ? 'min-h-full flex-col animate-marquee-vertical' : 'min-w-full flex-row animate-marquee',
            reverse && '[animation-direction:reverse]',
          )}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
