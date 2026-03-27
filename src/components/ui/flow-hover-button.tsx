import { cn } from '@/lib/utils'
import React from 'react'

interface FlowHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children?: React.ReactNode
  variant?: 'dark' | 'light'
  as?: 'button' | 'a'
  href?: string
}

export const FlowHoverButton: React.FC<FlowHoverButtonProps> = ({
  icon,
  children,
  variant = 'dark',
  className,
  as: Tag = 'button',
  href,
  ...props
}) => {
  const base = cn(
    `relative cursor-pointer z-0 flex items-center justify-center gap-2 overflow-hidden rounded-lg
    px-6 py-3 font-semibold text-sm transition-all duration-500
    before:absolute before:inset-0 before:-z-10 before:translate-x-[150%] before:translate-y-[150%] before:scale-[2.5]
    before:rounded-[100%] before:transition-transform before:duration-1000 before:content-[""]
    hover:scale-105 hover:before:translate-x-[0%] hover:before:translate-y-[0%] active:scale-95`,
    variant === 'dark'
      ? 'border border-[#2abfdc] bg-[#0a1628] text-[#2abfdc] before:bg-[#2abfdc] hover:text-[#0a1628]'
      : 'border border-[#0a1628] bg-white text-[#0a1628] before:bg-[#0a1628] hover:text-white',
    className
  )

  if (href) {
    return (
      <a href={href} className={base}>
        {icon}
        <span>{children}</span>
      </a>
    )
  }

  return (
    <button className={base} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}
