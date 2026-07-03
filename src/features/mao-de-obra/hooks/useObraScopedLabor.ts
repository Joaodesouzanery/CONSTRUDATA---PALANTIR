/**
 * useObraScopedLabor — fatia mão de obra / apontamentos / escala / planos / RDO
 * pela obra ativa. Timecards e Shifts NÃO têm siteId próprio, então o vínculo é
 * feito pelo `worker.siteId` (join workerId → obra). Planos/RDO já têm siteId.
 */
import { useMemo } from 'react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePlanoExecucaoStore } from '@/store/planoExecucaoStore'
import { useRdoStore } from '@/store/rdoStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { byActiveObra } from '@/hooks/useActiveObra'
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { Shift, TimecardEntry, Worker, PlanoExecucao } from '@/types'

export interface ObraScopedLabor {
  activeObraId: string | null
  workers: Worker[]
  timecards: TimecardEntry[]
  shifts: Shift[]
  planos: PlanoExecucao[]
  /** m² executados (linhas em m²) de RDOs Compizzo da obra ativa no período. */
  rdoM2InPeriod: (start: string, end: string) => number
  /** funcionários sem obra vinculada (sinal de dado incompleto). */
  unassignedWorkerCount: number
}

export function useObraScopedLabor(): ObraScopedLabor {
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const allWorkers = useMaoDeObraStore((s) => s.workers)
  const allTimecards = useMaoDeObraStore((s) => s.timecards)
  const allShifts = useMaoDeObraStore((s) => s.shifts)
  const allPlanos = usePlanoExecucaoStore((s) => s.planos)
  const rdos = useRdoStore((s) => s.rdos)

  return useMemo(() => {
    const workers = activeObraId ? allWorkers.filter((w) => (w.siteId || null) === activeObraId) : allWorkers
    const idsInObra = new Set(workers.map((w) => w.id))
    const timecards = activeObraId ? allTimecards.filter((tc) => idsInObra.has(tc.workerId)) : allTimecards
    const shifts = activeObraId ? allShifts.filter((s) => idsInObra.has(s.workerId)) : allShifts
    const planos = byActiveObra(allPlanos, activeObraId)
    const unassignedWorkerCount = allWorkers.filter((w) => !w.siteId).length

    const rdoM2InPeriod = (start: string, end: string) =>
      rdos
        .filter((r) =>
          (r as { template?: string }).template === 'compizzo'
          && (!activeObraId || ((r as { siteId?: string | null }).siteId ?? null) === activeObraId)
          && (r as { date?: string }).date! >= start
          && (r as { date?: string }).date! <= end)
        .reduce((sum, r) => sum + (r.compizzo?.producao ?? [])
          .filter((row) => /m²|m2/i.test(row.servico))
          .reduce((s, row) => s + parseLocaleNumber(row.quantidade), 0), 0)

    return { activeObraId, workers, timecards, shifts, planos, rdoM2InPeriod, unassignedWorkerCount }
  }, [activeObraId, allWorkers, allTimecards, allShifts, allPlanos, rdos])
}
