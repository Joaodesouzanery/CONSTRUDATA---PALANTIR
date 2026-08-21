/**
 * SyncBadge — selo discreto de status de sincronização com o servidor.
 *
 * Depois que a fila deixou de morrer por contagem de tentativas (ver `storeSync.ts`), **ter algo
 * pendente virou um estado passageiro, não um problema**: aquilo vai subir. Então o selo mostra
 * "enviando", em azul, e não mais "reenviar (3)" em amarelo com o número na cara de quem só
 * queria trabalhar. Amarelo ficou reservado para o que a pessoa precisa saber: sem conexão e
 * sessão ainda carregando.
 *
 * O que exige decisão humana (falta de permissão, depois de mais de uma hora insistindo) aparece
 * uma vez só, no indicador global da barra lateral — não repetido em cada módulo.
 *
 * Use junto com useStoreSync: const sync = useStoreSync(useXStore); <SyncBadge {...sync} />
 */
import { Cloud, CloudOff, Loader2, FlaskConical } from 'lucide-react'
import type { StoreSyncInfo } from '@/lib/useStoreSync'

export function SyncBadge({ syncStatus, syncError, pending, demo }: StoreSyncInfo & { className?: string }) {
  let icon = <Cloud size={12} />
  let label = 'Salvo na nuvem'
  let cls = 'text-[#22c55e] border-[#22c55e]/30 bg-[#22c55e]/10'
  let title = label

  if (demo) {
    icon = <FlaskConical size={12} />
    label = 'Modo demo · não sincroniza'
    cls = 'text-[#a3a3a3] border-[#525252] bg-[#3d3d3d]'
    title = 'Ambiente demo/homologação — alterações não são salvas no servidor.'
  } else if (syncStatus === 'unauth') {
    icon = <CloudOff size={12} />
    label = 'Sessão pendente'
    cls = 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10'
    title = 'Sessão ainda carregando — os dados sincronizam assim que o perfil estiver pronto.'
  } else if (syncStatus === 'offline') {
    icon = <CloudOff size={12} />
    label = 'Offline'
    cls = 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10'
    title = 'Sem conexão. Está tudo salvo no aparelho e sobe sozinho quando a rede voltar.'
  } else if (syncStatus === 'syncing' || syncStatus === 'error' || pending > 0) {
    // 'error' cai aqui de propósito: uma falha de rede ou uma migração ainda não aplicada não é
    // assunto de quem está preenchendo um RDO — o reenvio é automático e não tem fim. O motivo
    // continua no tooltip, para quando alguém precisar diagnosticar.
    icon = <Loader2 size={12} className="animate-spin" />
    label = 'Enviando…'
    cls = 'text-[#38bdf8] border-[#38bdf8]/30 bg-[#38bdf8]/10'
    title = syncError
      ? `Salvo no aparelho e a caminho da nuvem. Última resposta do servidor: ${syncError}. O envio se repete sozinho — não precisa fazer nada.`
      : 'Salvo no aparelho e a caminho da nuvem. Pode continuar; não precisa atualizar a página.'
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${cls}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}
