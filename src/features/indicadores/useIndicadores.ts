/**
 * Os quatro indicadores, prontos para a tela.
 *
 * Lê os stores e chama as funções puras de `utils/indicadores.ts`. Tudo memoizado: este hook roda
 * em `/app/minha-rotina`, que é a tela que todo mundo abre — e `lacunaDeRdo` varre até 90 dias por
 * obra a cada chamada.
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { useDiasSemProducaoStore } from '@/store/diasSemProducaoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useRotinasStore } from '@/store/rotinasStore'
import { hojeLocalISO } from '@/lib/utils'
import { separarPorAtividade } from '@/lib/obraAtiva'
import {
  dinheiroDoContrato, obrasReportando, execucaoContratada, rotinasEmDia, montarIndicadores,
  type Indicador,
} from './utils/indicadores'

export function useIndicadores(): { indicadores: Indicador[]; obrasAtivas: number } {
  const sites = useTorreStore((s) => s.sites)
  const torreSincronizada = useTorreStore((s) => s.lastSyncedAt)
  const rdos = useRdoStore((s) => s.rdos)
  const dias = useDiasSemProducaoStore((s) => s.dias)
  const feriados = usePlanejamentoStore((s) => s.holidays)
  const jornada = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const { rotinas, execucoes } = useRotinasStore(
    useShallow((s) => ({ rotinas: s.rotinas, execucoes: s.execucoes })),
  )

  const hoje = hojeLocalISO()

  return useMemo(() => {
    // Obra arquivada sai da conta de dinheiro e de execução: ela não está mais gerando nota nem
    // sendo executada, e mantê-la diluiria o percentual da carteira para sempre. O cartão de RDO
    // não precisa deste corte — `ehDiaCobravel` já rejeita arquivada por dentro.
    const { ativas } = separarPorAtividade(sites)

    const semProducao = new Map<string, string>()
    for (const d of dias) semProducao.set(`${d.siteId}|${d.data}`, 'x')

    const indicadores = montarIndicadores({
      dinheiro:   dinheiroDoContrato(ativas, hoje),
      executado:  execucaoContratada(ativas, hoje),
      reportando: obrasReportando({
        sites, rdos, semProducao, feriados, jornada, hoje,
        torreSincronizada: Boolean(torreSincronizada),
      }),
      rotinas: rotinasEmDia({
        rotinas, execucoes, feriados: new Set(feriados.map((f) => f.date)), jornada, hoje,
      }),
    })

    return { indicadores, obrasAtivas: ativas.length }
  }, [sites, torreSincronizada, rdos, dias, feriados, jornada, rotinas, execucoes, hoje])
}
