import { HelpCircle } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { HELP_CONTENT } from '@/data/helpContent'

interface HelpTooltipProps {
  topic: string   // key into HELP_CONTENT
  size?: number   // icon size, default 14
}

export function HelpTooltip({ topic, size = 14 }: HelpTooltipProps) {
  const entry = HELP_CONTENT[topic]
  if (!entry) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[#525252] hover:text-[#f97316] transition-colors cursor-help inline-flex items-center"
          aria-label={`Ajuda: ${entry.title}`}
        >
          <HelpCircle size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <p className="text-[#f5f5f5] text-sm font-semibold mb-1">{entry.title}</p>
        <p className="text-[#a3a3a3] text-xs leading-relaxed">{entry.description}</p>
        {entry.terms && entry.terms.length > 0 && (
          <>
            <div className="border-t border-[#525252] my-2" />
            <ul className="space-y-1">
              {entry.terms.map((t) => (
                <li key={t.term} className="text-xs">
                  <span className="text-[#f97316] font-medium">{t.term}:</span>{' '}
                  <span className="text-[#a3a3a3]">{t.def}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
