/**
 * GlobalSyncIndicator — aviso global e discreto quando o ambiente NÃO salva
 * dados no servidor (modo demo / homologação). Fica na sidebar, abaixo do
 * seletor de organização. Em produção normal não aparece (dados sincronizam).
 */
import { FlaskConical } from 'lucide-react'
import { useAppModeStore } from '@/store/appModeStore'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'

export function GlobalSyncIndicator({ expanded }: { expanded: boolean }) {
  // Reage à troca de modo demo e de organização ativa.
  useAppModeStore((s) => s.isDemoMode)
  useAuth((s) => s.profile?.organization_id)

  if (!isDemoModeEnabled()) return null

  if (!expanded) {
    return (
      <div className="flex justify-center py-1" title="Modo demo/homologação — alterações NÃO são salvas no servidor.">
        <span className="size-2 rounded-full bg-[#eab308]" />
      </div>
    )
  }

  return (
    <div className="mx-2 my-1 flex items-start gap-2 rounded-lg border border-[#eab308]/30 bg-[#eab308]/10 px-2.5 py-1.5 text-[10px] leading-snug text-[#eab308]">
      <FlaskConical size={13} className="mt-0.5 shrink-0" />
      <span>Modo demo/homologação — alterações <b>não</b> são salvas no servidor.</span>
    </div>
  )
}
