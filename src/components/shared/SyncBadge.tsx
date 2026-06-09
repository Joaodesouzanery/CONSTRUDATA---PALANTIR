/**
 * SyncBadge — selo discreto de status de sincronização com o servidor.
 * Torna visível quando os dados NÃO estão sendo salvos na nuvem (modo demo,
 * pendente, offline, erro) — evitando perda silenciosa de dados.
 *
 * Use junto com useStoreSync: const sync = useStoreSync(useXStore); <SyncBadge {...sync} />
 */
import { Cloud, CloudOff, Loader2, AlertTriangle, FlaskConical } from 'lucide-react'
import type { StoreSyncInfo } from '@/lib/useStoreSync'

export function SyncBadge({ syncStatus, pending, demo }: StoreSyncInfo & { className?: string }) {
  let icon = <Cloud size={12} />
  let label = 'Salvo na nuvem'
  let cls = 'text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10'

  if (demo) {
    icon = <FlaskConical size={12} />
    label = 'Modo demo · não sincroniza'
    cls = 'text-[#a3a3a3] border-[#525252] bg-[#3d3d3d]'
  } else if (syncStatus === 'syncing') {
    icon = <Loader2 size={12} className="animate-spin" />
    label = 'Salvando…'
    cls = 'text-[#38bdf8] border-[#38bdf8]/30 bg-[#38bdf8]/10'
  } else if (syncStatus === 'error') {
    icon = <AlertTriangle size={12} />
    label = 'Não sincronizado'
    cls = 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10'
  } else if (syncStatus === 'unauth') {
    icon = <CloudOff size={12} />
    label = 'Sessão pendente'
    cls = 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10'
  } else if (syncStatus === 'offline' || pending > 0) {
    icon = <CloudOff size={12} />
    label = pending > 0 ? `Pendente (${pending})` : 'Offline'
    cls = 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10'
  }

  return (
    <span
      title={demo ? 'Ambiente demo/homologação — alterações não são salvas no servidor.' : label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${cls}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}
