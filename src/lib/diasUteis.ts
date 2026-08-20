/**
 * diasUteis.ts — a regra de dia útil da organização, num lugar só.
 *
 * ─── POR QUE FOI EXTRAÍDA ─────────────────────────────────────────────────────────────────────
 * Esta regra — domingo nunca, sábado conforme a jornada, feriado nunca — vivia dentro de
 * `ehDiaCobravel` (`features/rdo/utils/statusRdoDia.ts`), misturada com as checagens de estado da
 * obra. Agora dois módulos precisam dela:
 *
 *   · o RDO, para contar quantos dias a obra está sem lançamento;
 *   · as Rotinas, para não abrir toda segunda-feira dizendo que a rotina diária está atrasada há
 *     dois dias por causa do fim de semana.
 *
 * Duas cópias da mesma regra divergem na primeira vez que alguém mexe numa. Então: uma cópia,
 * aqui, e `ehDiaCobravel` passa a chamá-la.
 *
 * ─── RESSALVA CONHECIDA ───────────────────────────────────────────────────────────────────────
 * Feriado é cadastrado por ORGANIZAÇÃO, não por obra (`plan_holidays`). Um feriado municipal de uma
 * cidade vale para todas as obras da empresa. Fica isolado aqui para o override por obra caber
 * depois sem tocar em mais nada.
 */
import type { WorkWeekMode } from '@/types'
import { dataLocalISO } from '@/lib/utils'

export interface DiaUtil {
  util: boolean
  /** Preenchido quando não é útil: 'domingo' | 'sábado fora da jornada' | 'feriado'. */
  razao?: string
}

/**
 * Este dia conta como dia de trabalho?
 *
 * Mesma regra do `scheduleEngine.buildWorkDays`, que é a definição de dia útil do Planejamento.
 */
export function ehDiaUtil(dataISO: string, feriados: Set<string>, jornada: WorkWeekMode): DiaUtil {
  // Meio-dia local: `new Date('yyyy-MM-dd')` é lido como UTC e devolveria o dia anterior no Brasil,
  // trocando o dia da semana na virada. É o mesmo cuidado que `hojeLocalISO` toma.
  const diaDaSemana = new Date(`${dataISO}T12:00:00`).getDay()
  if (diaDaSemana === 0) return { util: false, razao: 'domingo' }
  if (diaDaSemana === 6 && jornada === 'mon_fri') return { util: false, razao: 'sábado fora da jornada' }
  if (feriados.has(dataISO)) return { util: false, razao: 'feriado' }
  return { util: true }
}

/** `yyyy-MM-dd` → `Date` no fuso local, à meia-noite. */
function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** O dia seguinte, em `yyyy-MM-dd` local. */
export function diaSeguinte(dataISO: string): string {
  const d = comoData(dataISO)
  d.setDate(d.getDate() + 1)
  return dataLocalISO(d)
}

/** O dia anterior, em `yyyy-MM-dd` local. */
export function diaAnterior(dataISO: string): string {
  const d = comoData(dataISO)
  d.setDate(d.getDate() - 1)
  return dataLocalISO(d)
}

/** Diferença em dias de calendário entre duas datas (`ate − de`). Negativo se `ate` for antes. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((comoData(ate).getTime() - comoData(de).getTime()) / 86_400_000)
}

/**
 * Quantos dias ÚTEIS existem no intervalo, contando as duas pontas.
 *
 * `maxDias` é um teto de segurança contra intervalo absurdo (data mal digitada, obra com
 * `startDate` em 1970): sem ele, um erro de digitação vira um laço de milhares de voltas a cada
 * render.
 */
export function contarDiasUteis(
  de: string,
  ate: string,
  feriados: Set<string>,
  jornada: WorkWeekMode,
  maxDias = 3650,
): number {
  if (ate < de) return 0
  let n = 0
  let cursor = de
  for (let guarda = 0; guarda <= maxDias && cursor <= ate; guarda++) {
    if (ehDiaUtil(cursor, feriados, jornada).util) n++
    cursor = diaSeguinte(cursor)
  }
  return n
}

/**
 * Os dias úteis do intervalo, do mais recente para o mais antigo.
 *
 * A ordem importa: quem conta lacuna quer parar assim que achar o limite, e quem exibe quer o dia
 * mais recente primeiro. `maxDias` limita quantos dias de CALENDÁRIO são varridos.
 */
export function diasUteisRegressivos(
  de: string,
  ate: string,
  feriados: Set<string>,
  jornada: WorkWeekMode,
  maxDias = 365,
): string[] {
  const dias: string[] = []
  let cursor = ate
  for (let guarda = 0; guarda < maxDias && cursor >= de; guarda++) {
    if (ehDiaUtil(cursor, feriados, jornada).util) dias.push(cursor)
    cursor = diaAnterior(cursor)
  }
  return dias
}
