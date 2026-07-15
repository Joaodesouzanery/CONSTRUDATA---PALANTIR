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
  /** m² + HH executados via RDO Compizzo no período, com quebra por data. */
  rdoExecInPeriod: (start: string, end: string) => { m2: number; hh: number; byDate: Map<string, { m2: number; hh: number }> }
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
    // Worker sem obra = geral (entra em todas). Só fica de fora quem é de OUTRA obra.
    const workers = activeObraId ? allWorkers.filter((w) => !w.siteId || w.siteId === activeObraId) : allWorkers
    const idsInObra = new Set(workers.map((w) => w.id))
    // Apontamentos: por worker OU pelo siteId do próprio timecard (RDO carimba a obra no timecard),
    // para os apontamentos vindos do RDO aparecerem no Dashboard/Produtividade da obra.
    const timecards = activeObraId
      ? allTimecards.filter((tc) => idsInObra.has(tc.workerId) || (tc.siteId ?? null) === activeObraId)
      : allTimecards
    const shifts = activeObraId ? allShifts.filter((s) => idsInObra.has(s.workerId)) : allShifts
    const planos = byActiveObra(allPlanos, activeObraId)
    const unassignedWorkerCount = allWorkers.filter((w) => !w.siteId).length

    const compizzoRdosInPeriod = (start: string, end: string) =>
      rdos.filter((r) =>
        (r as { template?: string }).template === 'compizzo'
        && (!activeObraId || ((r as { siteId?: string | null }).siteId ?? null) === activeObraId)
        && (r as { date?: string }).date! >= start
        && (r as { date?: string }).date! <= end)

    const rdoRowM2 = (r: { compizzo?: { producao?: Array<{ servico: string; quantidade: string }> } }) =>
      (r.compizzo?.producao ?? []).filter((row) => /m²|m2/i.test(row.servico))
        .reduce((s, row) => s + parseLocaleNumber(row.quantidade), 0)

    const rdoM2InPeriod = (start: string, end: string) =>
      compizzoRdosInPeriod(start, end).reduce((sum, r) => sum + rdoRowM2(r), 0)

    const rdoExecInPeriod = (start: string, end: string) => {
      const byDate = new Map<string, { m2: number; hh: number }>()
      let m2 = 0, hh = 0
      for (const r of compizzoRdosInPeriod(start, end)) {
        const rm2 = rdoRowM2(r)
        const rhh = r.compizzo?.horasTrabalhadas ?? 0
        m2 += rm2; hh += rhh
        const d = (r as { date?: string }).date!
        const cur = byDate.get(d) ?? { m2: 0, hh: 0 }
        cur.m2 += rm2; cur.hh += rhh
        byDate.set(d, cur)
      }
      return { m2, hh, byDate }
    }

    return { activeObraId, workers, timecards, shifts, planos, rdoM2InPeriod, rdoExecInPeriod, unassignedWorkerCount }
  }, [activeObraId, allWorkers, allTimecards, allShifts, allPlanos, rdos])
}
