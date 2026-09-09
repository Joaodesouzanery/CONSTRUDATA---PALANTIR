/**
 * Os dias comprovados por RDO que a folha não estava pagando.
 *
 * ─── O BURACO ─────────────────────────────────────────────────────────────────
 * A folha lê `shifts` (aba Escala) e **ignora** os apontamentos vindos do RDO. Um dia com RDO
 * finalizado, o funcionário presente na lista de efetivo e as horas já rateadas por cabeça
 * **não paga nada** se ninguém tiver lançado o turno na Escala.
 *
 * O RDO é assinado no canteiro — é a prova mais forte que existe de que a pessoa estava lá. Então
 * ele passa a valer como dia trabalhado.
 *
 * ─── MAS NÃO EM SILÊNCIO ──────────────────────────────────────────────────────
 * Isto muda valor de folha. Nada aqui altera nada sozinho: estas funções só **descrevem** a
 * diferença, para a tela mostrar a conferência e a pessoa aprovar. É a tela que decide aplicar.
 */
import type { CLTSettings, Shift, TimecardEntry, Worker } from '@/types'
import { custoDiaWorker } from './custoMaoObra'

/** Turno que não conta como dia trabalhado — mesma regra do `payrollEngine`. */
function turnoNaoPago(s: Shift): boolean {
  return s.type === 'day_off' || s.type === 'holiday' || s.status === 'absent' || s.status === 'cancelled'
}

export interface DiaSoNoRdo {
  workerId: string
  workerName: string
  data: string
  /** Horas rateadas que o RDO registrou para esta pessoa neste dia. */
  horas: number
}

export interface ConferenciaDaFolha {
  /** Dias com RDO e sem turno na Escala — os que passam a contar. */
  dias: DiaSoNoRdo[]
  /** Quantas pessoas são afetadas. */
  pessoas: number
  /** Diferença estimada no total da folha, em R$. */
  diferencaBRL: number
  /** Por funcionário, para a tela listar. */
  porFuncionario: Array<{ workerId: string; workerName: string; dias: number; valorBRL: number }>
}

/**
 * Compara o que a Escala diz com o que o RDO comprova, no mês.
 *
 * Só entra o apontamento que veio de RDO (`sourceRdoId`) — apontamento digitado à mão não é
 * comprovação independente, é a mesma pessoa dizendo a mesma coisa em outro lugar.
 *
 * Um dia que tem RDO **e** turno não entra: ele já está pago. É a trava contra pagar duas vezes.
 */
export function conferirDiasDeRdo(
  workers: Worker[],
  shifts: Shift[],
  timecards: TimecardEntry[],
  month: string,
  /** Encargos configurados. Sem eles o valor desta conferência discorda do holerite ao lado. */
  settings?: Pick<CLTSettings, 'ratPct' | 'sistemaSPct' | 'regimeCprb'>,
): ConferenciaDaFolha {
  const doMes = (d: string) => d.startsWith(month)

  // Dias já cobertos pela Escala, por funcionário. Turno não pago (folga, falta) NÃO cobre —
  // se a pessoa foi marcada ausente e mesmo assim aparece no RDO, isso é uma divergência que
  // merece aparecer, não ser escondida.
  const cobertos = new Set<string>()
  for (const s of shifts) {
    if (!doMes(s.date) || turnoNaoPago(s)) continue
    cobertos.add(`${s.workerId}|${s.date}`)
  }

  const porNome = new Map(workers.map((w) => [w.id, w]))
  const vistos = new Set<string>()
  const dias: DiaSoNoRdo[] = []

  for (const tc of timecards) {
    if (!tc.sourceRdoId || !doMes(tc.date)) continue
    const chave = `${tc.workerId}|${tc.date}`
    if (cobertos.has(chave) || vistos.has(chave)) continue
    const w = porNome.get(tc.workerId)
    if (!w || w.status !== 'active') continue
    vistos.add(chave)
    dias.push({
      workerId: tc.workerId,
      workerName: w.name,
      data: tc.date,
      horas: Number(tc.hoursWorked) || 0,
    })
  }

  // `custoDiaWorker` já é a conta de "quanto vale um dia desta pessoa" usada no resto do módulo
  // (custo mensal ÷ dias úteis, com recurso na hora × jornada). Reaproveitada para a estimativa
  // não discordar do que o CMO mostra.

  const agrupado = new Map<string, { workerName: string; dias: number; valorBRL: number }>()
  for (const d of dias) {
    const w = porNome.get(d.workerId)!
    const atual = agrupado.get(d.workerId) ?? { workerName: d.workerName, dias: 0, valorBRL: 0 }
    atual.dias += 1
    atual.valorBRL += custoDiaWorker(w, { settings })
    agrupado.set(d.workerId, atual)
  }

  const porFuncionario = [...agrupado.entries()]
    .map(([workerId, v]) => ({ workerId, ...v }))
    .sort((a, b) => b.valorBRL - a.valorBRL)

  return {
    dias: dias.sort((a, b) => a.data.localeCompare(b.data)),
    pessoas: agrupado.size,
    diferencaBRL: porFuncionario.reduce((s, f) => s + f.valorBRL, 0),
    porFuncionario,
  }
}

/**
 * Os turnos que faltam para a Escala refletir o que o RDO comprova.
 *
 * Devolve turnos prontos para serem inseridos — a tela grava depois que a pessoa aprova a
 * conferência. Assim a folha continua tendo **uma** fonte (a Escala), e o RDO passa a alimentá-la
 * em vez de disputar com ela: menos um lugar onde dois números podem discordar.
 */
export function turnosQueFaltam(conferencia: ConferenciaDaFolha, siteId?: string | null): Shift[] {
  return conferencia.dias.map((d) => ({
    id: `rdo-${d.workerId}-${d.data}`,
    workerId: d.workerId,
    date: d.data,
    startTime: '07:00',
    endTime: '16:00',
    breakMinutes: 60,
    type: 'regular' as const,
    status: 'confirmed' as const,
    ...(siteId ? { siteId } : {}),
  }))
}
