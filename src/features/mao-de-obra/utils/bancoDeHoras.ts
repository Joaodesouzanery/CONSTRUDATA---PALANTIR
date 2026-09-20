/**
 * Banco de horas — o saldo entre o que a pessoa devia trabalhar e o que ela bateu.
 *
 * Construção nova: não havia nada disso no projeto (a única ocorrência de "banco de horas" em
 * `src/` era um comentário de passagem). Puro — sem store, sem React, sem `new Date()` implícito.
 *
 * ─── A DECISÃO QUE GOVERNA O ARQUIVO ──────────────────────────────────────────
 * O saldo é `trabalhado − previsto`. O trabalhado vem das batidas; o **previsto vem do REGIME
 * CONTRATUAL** (`Worker.scheduleType`), não da escala planejada. Foi escolha do cliente, e é a
 * única que funciona: hoje muita gente não tem turno lançado na aba Escala, e um banco de horas
 * cheio de dia "sem previsto" não serve para negociar nada.
 *
 * ⚠️ **Quando o sistema não sabe o previsto, ele DIZ que não sabe.** `BasePrevista` tem um caso
 * `indefinido`, e os dias assim ficam fora do saldo e aparecem contados à parte no relatório.
 * Devolver zero neles seria pior do que não ter o recurso: todo minuto trabalhado viraria crédito,
 * e o primeiro relatório levado à contabilidade estaria errado para mais.
 */
import type { CLTSettings, Worker } from '@/types'
import { dataLocalISO } from '@/lib/utils'
import type { Jornada } from '@/features/ponto/jornada'
import { minutosAlemDoPrevisto } from '@/features/ponto/jornada'

/** Por que este dia tem (ou não tem) previsto. */
export type BasePrevista =
  | { tipo: 'trabalha'; minutos: number }
  | { tipo: 'folga' }
  | { tipo: 'feriado' }
  | { tipo: 'indefinido'; motivo: MotivoSemPrevisto }

export type MotivoSemPrevisto =
  /** `daily` — diarista recebe por dia trabalhado; não existe jornada a compensar. */
  | 'diarista'
  /** `custom` ou regime em branco — ninguém disse quantas horas são. */
  | 'regime-sem-padrao'
  /** 12x36 precisa de uma data-âncora para saber de quem é o plantão de hoje. */
  | 'sem-ancora-12x36'

export const TEXTO_SEM_PREVISTO: Record<MotivoSemPrevisto, string> = {
  'diarista':          'Diarista — recebe por dia trabalhado, não acumula banco',
  'regime-sem-padrao': 'Regime não define jornada (personalizado ou em branco)',
  'sem-ancora-12x36':  '12x36 sem data de admissão — não dá para saber de quem é o plantão',
}

/** Meses de validade do crédito, quando as configurações não disserem outra coisa. */
export const MESES_DE_COMPENSACAO_PADRAO = 6

const MIN_POR_DIA_UTIL = (semanais: number, diasNaSemana: number) =>
  Math.round((semanais * 60) / diasNaSemana)

/**
 * O previsto de UM dia, pelo regime contratual.
 *
 * ⚠️ A jornada diária é **derivada** das horas semanais (`maxWeeklyHours`, 44 por padrão) divididas
 * pelos dias do regime — não é um 8 fixo. Num 5x2 de 44 horas o dia tem 8h48, e usar 8 produziria
 * 4 horas de crédito falso por semana, por pessoa. Num 6x1 o dia tem 7h20.
 */
export function previstoDoDia(
  worker: Pick<Worker, 'scheduleType' | 'admissionDate'>,
  data: string,
  settings: Pick<CLTSettings, 'maxWeeklyHours'>,
  feriados: ReadonlySet<string> = new Set(),
): BasePrevista {
  if (feriados.has(data)) return { tipo: 'feriado' }

  const semanais = settings.maxWeeklyHours || 44
  const diaSemana = new Date(data + 'T00:00:00').getDay() // 0=dom … 6=sáb

  switch (worker.scheduleType) {
    case 'standard':
    case '5x2':
      // Segunda a sexta.
      return diaSemana >= 1 && diaSemana <= 5
        ? { tipo: 'trabalha', minutos: MIN_POR_DIA_UTIL(semanais, 5) }
        : { tipo: 'folga' }

    case '6x1':
      // Segunda a sábado; domingo é o descanso semanal.
      return diaSemana >= 1 && diaSemana <= 6
        ? { tipo: 'trabalha', minutos: MIN_POR_DIA_UTIL(semanais, 6) }
        : { tipo: 'folga' }

    case '12x36': {
      // ⚠️ 12 horas de trabalho e 36 de descanso fecham um ciclo de 48 horas: trabalha-se dia sim,
      // dia não. Qual dos dois é o de trabalho depende de onde a escala começou, e a única âncora
      // que o cadastro tem é a admissão. Sem ela o sistema não tem como saber — e chutar
      // produziria metade dos plantões com previsto trocado.
      if (!worker.admissionDate) return { tipo: 'indefinido', motivo: 'sem-ancora-12x36' }
      const dias = diasEntre(worker.admissionDate, data)
      return dias % 2 === 0 ? { tipo: 'trabalha', minutos: 12 * 60 } : { tipo: 'folga' }
    }

    case 'daily':
      return { tipo: 'indefinido', motivo: 'diarista' }

    default:
      return { tipo: 'indefinido', motivo: 'regime-sem-padrao' }
  }
}

function diasEntre(de: string, ate: string): number {
  const a = new Date(de + 'T00:00:00').getTime()
  const b = new Date(ate + 'T00:00:00').getTime()
  return Math.round((b - a) / 86_400_000)
}

function diasDoPeriodo(de: string, ate: string): string[] {
  const out: string[] = []
  const fim = new Date(ate + 'T00:00:00')
  for (const d = new Date(de + 'T00:00:00'); d <= fim; d.setDate(d.getDate() + 1)) out.push(dataLocalISO(d))
  return out
}

export interface DiaDoBanco {
  data: string
  base: BasePrevista
  previstoMin: number
  trabalhadoMin: number
  /** `trabalhado − previsto`, já com a tolerância do art. 58 §1º aplicada. */
  saldoMin: number
  /** `true` quando o dia não entrou na conta porque o previsto é desconhecido. */
  foraDaConta: boolean
}

export interface SaldoDoPeriodo {
  de: string
  ate: string
  previstoMin: number
  trabalhadoMin: number
  saldoMin: number
  dias: DiaDoBanco[]
  /** Dias em que o previsto é desconhecido — ficaram fora, e o relatório precisa dizer. */
  diasIndefinidos: number
  /** Presente quando TODOS os dias são indefinidos: não há banco para esta pessoa. */
  semBanco?: MotivoSemPrevisto
}

/**
 * O saldo de um trabalhador no período.
 *
 * ⚠️ A tolerância do art. 58 §1º entra DIA A DIA, não no total. Cinco minutos a mais em vinte dias
 * não são cem minutos de crédito — são vinte variações irrelevantes, e a lei diz isso. Aplicar a
 * tolerância só no fim transformaria ruído de marcação em hora extra a pagar.
 */
export function saldoDoPeriodo(
  worker: Pick<Worker, 'id' | 'scheduleType' | 'admissionDate'>,
  jornadas: readonly Jornada[],
  de: string,
  ate: string,
  settings: Pick<CLTSettings, 'maxWeeklyHours' | 'toleranciaPontoMin'>,
  feriados: ReadonlySet<string> = new Set(),
): SaldoDoPeriodo {
  const trabalhadoPorDia = new Map<string, number>()
  for (const j of jornadas) {
    if (j.workerId !== worker.id) continue
    trabalhadoPorDia.set(j.data, (trabalhadoPorDia.get(j.data) ?? 0) + j.minutosTrabalhados)
  }

  const dias: DiaDoBanco[] = diasDoPeriodo(de, ate).map((data) => {
    const base = previstoDoDia(worker, data, settings, feriados)
    const trabalhadoMin = trabalhadoPorDia.get(data) ?? 0
    const foraDaConta = base.tipo === 'indefinido'
    const previstoMin = base.tipo === 'trabalha' ? base.minutos : 0
    return {
      data,
      base,
      previstoMin,
      trabalhadoMin,
      saldoMin: foraDaConta ? 0 : minutosAlemDoPrevisto(trabalhadoMin, previstoMin, settings),
      foraDaConta,
    }
  })

  const naConta = dias.filter((d) => !d.foraDaConta)
  const indefinidos = dias.filter((d) => d.foraDaConta)

  // Se NENHUM dia tem previsto conhecido, não existe banco para esta pessoa — e a razão é sempre a
  // mesma (o regime dela). Dizer isso é melhor que mostrar um saldo de zero que parece calculado.
  const semBanco = naConta.length === 0 && indefinidos.length > 0
    ? (indefinidos[0].base as { motivo: MotivoSemPrevisto }).motivo
    : undefined

  return {
    de,
    ate,
    previstoMin: naConta.reduce((s, d) => s + d.previstoMin, 0),
    trabalhadoMin: naConta.reduce((s, d) => s + d.trabalhadoMin, 0),
    saldoMin: naConta.reduce((s, d) => s + d.saldoMin, 0),
    dias,
    diasIndefinidos: indefinidos.length,
    semBanco,
  }
}

export interface CreditoAVencer {
  /** `yyyy-MM` em que o crédito foi gerado. */
  competencia: string
  minutos: number
  /** `yyyy-MM-dd` — o último dia para compensar. */
  venceEm: string
}

/**
 * Créditos que ainda não foram compensados e estão perto de vencer.
 *
 * ⚠️ **Crédito de banco de horas tem prazo.** Pelo art. 59 §5º da CLT, o acordo individual permite
 * compensar dentro de **seis meses**; passado o prazo, a hora não compensada vira hora extra a
 * pagar, com adicional. Um banco de horas que só acumula e nunca avisa é uma dívida trabalhista
 * crescendo em silêncio — por isso esta função existe desde o primeiro dia, e não "depois".
 *
 * A conta é por competência mensal, FIFO: o crédito mais antigo é o primeiro a ser consumido por
 * um mês de saldo negativo.
 */
export function creditosAVencer(
  saldosPorMes: ReadonlyArray<{ competencia: string; saldoMin: number }>,
  hoje: string,
  mesesDeCompensacao = MESES_DE_COMPENSACAO_PADRAO,
  janelaDeAvisoDias = 30,
): CreditoAVencer[] {
  const creditos: Array<{ competencia: string; minutos: number }> = []

  for (const m of [...saldosPorMes].sort((a, b) => a.competencia.localeCompare(b.competencia))) {
    if (m.saldoMin > 0) { creditos.push({ competencia: m.competencia, minutos: m.saldoMin }); continue }
    // Mês negativo consome os créditos mais antigos primeiro.
    let aCompensar = -m.saldoMin
    while (aCompensar > 0 && creditos.length > 0) {
      const usa = Math.min(aCompensar, creditos[0].minutos)
      creditos[0].minutos -= usa
      aCompensar -= usa
      if (creditos[0].minutos === 0) creditos.shift()
    }
  }

  const limite = new Date(hoje + 'T00:00:00')
  limite.setDate(limite.getDate() + janelaDeAvisoDias)

  return creditos
    .filter((c) => c.minutos > 0)
    .map((c) => ({ ...c, venceEm: venceEm(c.competencia, mesesDeCompensacao) }))
    .filter((c) => c.venceEm <= dataLocalISO(limite))
    .sort((a, b) => a.venceEm.localeCompare(b.venceEm))
}

/** Último dia do mês que está `meses` à frente da competência. */
function venceEm(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-').map(Number)
  // Dia 0 do mês seguinte = último dia do mês alvo.
  return dataLocalISO(new Date(ano, mes + meses, 0))
}
