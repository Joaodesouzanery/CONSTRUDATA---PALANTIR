import { cn } from '@/lib/utils'
import React from 'react'

interface FlowHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children?: React.ReactNode
  variant?: 'accent' | 'ghost' | 'white'
  href?: string
  /** Para links externos (ex.: Calendly). Quando definido, força rel seguro. */
  target?: '_blank' | '_self' | '_parent' | '_top'
  /** Sobrescrever rel — por padrão, links com target="_blank" recebem 'noopener noreferrer nofollow' */
  rel?: string
}

export const FlowHoverButton: React.FC<FlowHoverButtonProps> = ({
  icon,
  children,
  variant = 'accent',
  className,
  href,
  target,
  rel,
  ...props
}) => {
  const base = cn(
    `relative cursor-pointer z-0 inline-flex items-center justify-center gap-2 overflow-hidden
    px-6 py-2.5 font-semibold text-sm tracking-wide transition-all duration-300
    before:absolute before:inset-0 before:-z-10 before:translate-x-[150%] before:translate-y-[150%] before:scale-[2.5]
    before:rounded-[100%] before:transition-transform before:duration-700 before:content-[""]
    hover:before:translate-x-[0%] hover:before:translate-y-[0%] active:scale-95`,
    variant === 'accent'
      ? 'border border-[#f97316] text-[#f97316] before:bg-[#f97316] hover:text-black'
      : variant === 'white'
      ? 'border border-white/30 text-white before:bg-white hover:text-black'
      : 'border border-white/15 text-white/70 before:bg-white/10 hover:text-white hover:border-white/30',
    className
  )

  if (href) {
    // Segurança: links externos (target=_blank) sempre recebem rel seguro
    // para prevenir tabnabbing (CWE-1022) e remover Referer header.
    const isExternal = target === '_blank'
    const safeRel = rel ?? (isExternal ? 'noopener noreferrer nofollow' : undefined)

    return (
      <a href={href} target={target} rel={safeRel} className={base}>
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
      </a>
    )
  }

  return (
    <button className={base} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
