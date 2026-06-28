import { MapPin, ChevronDown } from 'lucide-react'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useProjetosStore } from '@/store/projetosStore'
import { cn } from '@/lib/utils'

interface ObraSwitcherProps {
  expanded?: boolean
}

/** Seletor de obra ativa (global). Espelha o OrganizationSwitcher, mas troca a
 *  obra ativa sem recarregar a página — os módulos reagem por selector. */
export function ObraSwitcher({ expanded = true }: ObraSwitcherProps) {
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const setActiveObra = useActiveObraStore((s) => s.setActiveObra)
  const selectProject = useProjetosStore((s) => s.selectProject)

  /** Troca a obra ativa e, se ela tiver projeto vinculado, foca esse projeto nos
   *  módulos baseados em projeto (EVM/Aditivos). "Todas as obras" não mexe no projeto. */
  function handleChange(siteId: string | null) {
    setActiveObra(siteId)
    const projectId = siteId ? (sites.find((s) => s.id === siteId)?.projectId ?? null) : null
    if (projectId) selectProject(projectId)
  }

  if (sites.length === 0) return null // sem obras cadastradas → não exibe

  const activeName = activeObraId
    ? sites.find((s) => s.id === activeObraId)?.name ?? 'Obra'
    : 'Todas as obras'

  if (!expanded) {
    return (
      <div
        title={activeName}
        className="mx-2 mb-2 flex h-10 items-center justify-center rounded-lg border border-[#525252] bg-[#262626] text-[#3b82f6]"
      >
        <MapPin size={17} />
      </div>
    )
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border border-[#525252] bg-[#262626] p-2">
      <div className="mb-1 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
        <MapPin size={12} className="text-[#3b82f6]" />
        Obra ativa
      </div>
      <div className="relative">
        <select
          value={activeObraId ?? ''}
          onChange={(event) => handleChange(event.target.value || null)}
          className={cn(
            'h-9 w-full appearance-none rounded-md border border-[#3f3f46] bg-[#1f1f1f] px-3 pr-8 text-left text-xs font-semibold text-[#f5f5f5]',
            'outline-none transition focus:border-[#3b82f6]/70',
          )}
        >
          <option value="">Todas as obras</option>
          {sites.map((site) => {
            const code = (site as { code?: string }).code
            return (
              <option key={site.id} value={site.id}>
                {code ? `${code} — ` : ''}{site.name}
              </option>
            )
          })}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
        />
      </div>
    </div>
  )
}
