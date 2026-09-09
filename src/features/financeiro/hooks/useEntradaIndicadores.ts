/**
 * Reúne, de uma vez, tudo que `montarIndicadoresFinanceiro` precisa.
 *
 * Existe para a Visão Geral e o Projetado × Realizado lerem os MESMOS stores do mesmo jeito —
 * duas coletas independentes seriam dois números diferentes para a mesma pergunta.
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFcpStore } from '@/store/fcpStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useRdoStore } from '@/store/rdoStore'
import { useDiasSemProducaoStore } from '@/store/diasSemProducaoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { hojeLocalISO } from '@/lib/utils'
import { planoDaObra } from '../utils/fcp/projetadoRealizado'
import { montarIndicadoresFinanceiro, type IndicadorFinanceiro } from '../utils/indicadoresFinanceiro'

export function useEntradaIndicadores(periodo: { from?: string; to?: string }, obraId?: string | null): IndicadorFinanceiro[] {
  const planos = useFcpStore((s) => s.planos)
  const sites = useTorreStore((s) => s.sites)
  const entries = useFinanceiroStore((s) => s.entries)
  const rdos = useRdoStore((s) => s.rdos)
  const diasSemProducao = useDiasSemProducaoStore((s) => s.dias)
  const { feriados, jornada } = usePlanejamentoStore(useShallow((s) => ({ feriados: s.holidays, jornada: s.scheduleConfig.workWeekMode })))
  const hoje = hojeLocalISO()
  const obraIds = useMemo(() => (obraId ? [obraId] : undefined), [obraId])
  const plano = useMemo(() => planoDaObra(planos, obraId ?? null).plano, [planos, obraId])
  return useMemo(
    () => montarIndicadoresFinanceiro({ plano, sites, entries, rdos, diasSemProducao, feriados, jornada, hoje, periodo, obraIds }),
    [plano, sites, entries, rdos, diasSemProducao, feriados, jornada, hoje, periodo, obraIds],
  )
}
