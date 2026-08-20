/**
 * PendenciasDoDia — o que está pegando, no topo da primeira tela depois do login.
 *
 * ─── POR QUE AQUI ─────────────────────────────────────────────────────────────────────────────
 * As duas cobranças do produto viviam cada uma no seu módulo: a rotina atrasada só aparecia em
 * Rotinas, e a obra sem RDO só no Dashboard do RDO. Quem não abrisse aquelas duas telas não ficava
 * sabendo de nenhuma das duas — e a tela inicial é a única que todo mundo abre.
 *
 * Mostra só o que PEDE AÇÃO. Sem pendência, o bloco não existe: um painel que ocupa espaço dizendo
 * "está tudo bem" ensina a ignorá-lo, e aí ele não serve quando não estiver.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, ListChecks, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRotinasStore } from '@/store/rotinasStore'
import { useRdoStore } from '@/store/rdoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useDiasSemProducaoStore } from '@/store/diasSemProducaoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { lacunaDeRdo, type LacunaRdo } from '@/features/rdo/utils/statusRdoDia'
import { atrasoDaRotina, frasePendencia } from '../utils/atrasoRotina'
import { hojeLocalISO } from '@/lib/utils'

export function PendenciasDoDia() {
  const navigate = useNavigate()
  const { rotinas, execucoes } = useRotinasStore(
    useShallow((s) => ({ rotinas: s.rotinas, execucoes: s.execucoes })),
  )
  const rdos = useRdoStore((s) => s.rdos)
  const sites = useTorreStore((s) => s.sites)
  const torreSincronizada = useTorreStore((s) => s.lastSyncedAt)
  const dias = useDiasSemProducaoStore((s) => s.dias)
  const feriados = usePlanejamentoStore((s) => s.holidays)
  const jornada = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const setActiveObra = useActiveObraStore((s) => s.setActiveObra)

  const hoje = hojeLocalISO()

  const atrasadas = useMemo(() => {
    const feitas = new Set(execucoes.filter((e) => e.feita).map((e) => `${e.rotinaId}|${e.periodo}`))
    const feriadoSet = new Set(feriados.map((f) => f.date))
    return rotinas
      .filter((r) => r.ativa)
      .map((r) => ({ rotina: r, atraso: atrasoDaRotina(r, { feitas, feriados: feriadoSet, jornada, hoje }) }))
      .filter((x): x is { rotina: typeof x.rotina; atraso: NonNullable<typeof x.atraso> } => Boolean(x.atraso))
      .sort((a, b) => b.atraso.diasDeAtraso - a.atraso.diasDeAtraso)
  }, [rotinas, execucoes, feriados, jornada, hoje])

  const obrasSemRdo = useMemo(() => {
    // Enquanto a Torre não sincronizou neste aparelho, `sites` pode estar incompleto — e acusar
    // obra sem RDO com a lista pela metade é alarme falso. Mesma guarda do painel do RDO.
    if (!torreSincronizada) return []
    const semProducao = new Map<string, string>()
    for (const d of dias) semProducao.set(`${d.siteId}|${d.data}`, 'x')
    return sites
      .map((site) => ({ site, lacuna: lacunaDeRdo({ site, rdos, semProducao, hoje, feriados, jornada }) }))
      .filter((x): x is { site: typeof x.site; lacuna: LacunaRdo } => Boolean(x.lacuna))
      .sort((a, b) => b.lacuna.diasDesde - a.lacuna.diasDesde)
  }, [sites, rdos, dias, feriados, jornada, hoje, torreSincronizada])

  if (atrasadas.length === 0 && obrasSemRdo.length === 0) return null

  const total = atrasadas.length + obrasSemRdo.length
  // Vermelho só quando algo já está ACUMULANDO. Uma obra sem o RDO de hoje, às 9h da manhã, é
  // âmbar: ainda dá tempo.
  const grave = atrasadas.length > 0 || obrasSemRdo.some((o) => o.lacuna.diasEmAberto > 1)

  return (
    <div className={`mx-auto max-w-6xl px-6 pt-6`}>
      <div
        className={`rounded-xl border ${
          grave ? 'border-[#ef4444]/40 bg-[#ef4444]/[0.07]' : 'border-[#f59e0b]/40 bg-[#f59e0b]/[0.07]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <AlertTriangle size={15} className={`shrink-0 ${grave ? 'text-[#f87171]' : 'text-[#fbbf24]'}`} />
          <span className="text-sm font-bold text-[#f5f5f5]">
            {total} pendência{total !== 1 ? 's' : ''} esperando você
          </span>
          <span className="text-[11px] text-[#a3a3a3]">
            {atrasadas.length > 0 && `${atrasadas.length} rotina${atrasadas.length !== 1 ? 's' : ''} atrasada${atrasadas.length !== 1 ? 's' : ''}`}
            {atrasadas.length > 0 && obrasSemRdo.length > 0 && ' · '}
            {obrasSemRdo.length > 0 && `${obrasSemRdo.length} obra${obrasSemRdo.length !== 1 ? 's' : ''} sem RDO`}
          </span>
        </div>

        <div className="border-t border-[#525252]/50">
          {/* No máximo 4 de cada: a tela inicial não é lugar de lista longa, e o botão leva ao
              módulo onde ela está inteira. */}
          {atrasadas.slice(0, 4).map(({ rotina, atraso }) => (
            <div key={rotina.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#525252]/30 px-4 py-2 last:border-b-0">
              <ListChecks size={13} className="shrink-0 text-[#a3a3a3]" />
              <span className="min-w-0 truncate text-xs font-semibold text-[#f5f5f5]">{rotina.titulo}</span>
              <span className="text-[11px] text-[#f87171]">{frasePendencia(rotina, atraso)}</span>
            </div>
          ))}

          {obrasSemRdo.slice(0, 4).map(({ site, lacuna }) => (
            <div key={site.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#525252]/30 px-4 py-2 last:border-b-0">
              <ClipboardList size={13} className="shrink-0 text-[#a3a3a3]" />
              <span className="min-w-0 truncate text-xs font-semibold text-[#f5f5f5]">{site.name}</span>
              <span className={`text-[11px] ${lacuna.diasEmAberto > 1 ? 'text-[#f87171]' : 'text-[#fbbf24]'}`}>
                {lacuna.diasEmAberto > 1
                  ? `${lacuna.diasEmAberto} dias sem RDO${lacuna.truncado ? '+' : ''} — desde ${lacuna.maisAntigo.split('-').reverse().join('/')}`
                  : 'sem RDO hoje'}
              </span>
              <button
                onClick={() => { setActiveObra(site.id); navigate('/app/rdo') }}
                className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-[#525252] px-2 py-1 text-[10px] font-semibold text-[#f97316] hover:border-[#f97316]/50"
              >
                Fazer RDO <ChevronRight size={10} />
              </button>
            </div>
          ))}
        </div>

        {(atrasadas.length > 4 || obrasSemRdo.length > 4) && (
          <div className="border-t border-[#525252]/50 px-4 py-2 text-[10px] text-[#a3a3a3]">
            {atrasadas.length > 4 && `e mais ${atrasadas.length - 4} rotina(s) atrasada(s)`}
            {atrasadas.length > 4 && obrasSemRdo.length > 4 && ' · '}
            {obrasSemRdo.length > 4 && `e mais ${obrasSemRdo.length - 4} obra(s) sem RDO`}
          </div>
        )}
      </div>
    </div>
  )
}
