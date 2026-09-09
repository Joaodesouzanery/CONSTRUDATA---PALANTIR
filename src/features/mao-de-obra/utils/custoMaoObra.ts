/**
 * custoMaoObra — custo de mão de obra a partir do SALÁRIO BRUTO + encargos.
 * Até então o app só usava hourlyRate; o grossSalary era guardado e ignorado.
 * Aproximação de custo-empregador: bruto + FGTS (8%) + encargos patronais (20% + RAT + Sistema S,
 * ou sem os 20% na CPRB — `calcEncargosPatronais`). Sem `settings`, usa os padrões.
 * Não substitui a folha real (CLT), mas dá custo/dia e custo/mês para o planejamento.
 */
import type { CLTSettings, Worker } from '@/types'
import { calcFGTS, calcEncargosPatronais } from './payrollEngine'

type Encargos = Pick<CLTSettings, 'ratPct' | 'sistemaSPct' | 'regimeCprb'>

/** Normaliza um nome para casar cadastro × texto livre (trim, minúsculas, sem acento). */
export function normalizeName(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/** Casa um nome (texto livre do RDO) com um Worker cadastrado. */
export function matchWorkerByName<T extends Pick<Worker, 'name'>>(name: string, workers: T[]): T | undefined {
  const target = normalizeName(name)
  if (!target) return undefined
  return workers.find((w) => normalizeName(w.name) === target)
}

/** Dias úteis médios no mês (base do custo/dia). Configurável por chamada. */
export const DIAS_UTEIS_MES_PADRAO = 22

/** Custo mensal do empregador (bruto + FGTS + encargos patronais). 0 se não houver salário. */
export function custoMesWorker(w: Pick<Worker, 'grossSalary'>, settings?: Encargos): number {
  const gross = w.grossSalary || 0
  return gross > 0 ? gross + calcFGTS(gross) + calcEncargosPatronais(gross, settings) : 0
}

/**
 * Custo/dia por funcionário. Usa o salário bruto + encargos ÷ dias úteis do mês.
 * Sem salário bruto, cai para o valor/hora × jornada (fallback).
 */
export function custoDiaWorker(
  w: Pick<Worker, 'grossSalary' | 'hourlyRate'>,
  opts: { diasMes?: number; jornada?: number; settings?: Encargos } = {},
): number {
  const diasMes = opts.diasMes && opts.diasMes > 0 ? opts.diasMes : DIAS_UTEIS_MES_PADRAO
  const mensal = custoMesWorker(w, opts.settings)
  if (mensal > 0) return mensal / diasMes
  const jornada = opts.jornada && opts.jornada > 0 ? opts.jornada : 8
  return (w.hourlyRate || 0) * jornada
}
