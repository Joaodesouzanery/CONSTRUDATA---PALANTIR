/**
 * A jornada — batidas soltas viram o dia de trabalho de alguém.
 *
 * `batida.ts` responde "qual é a próxima batida AGORA"; este arquivo responde "o que aconteceu no
 * mês". A regra de encadeamento é a mesma (`HORAS_ENTRE_JORNADAS`), o alcance é que muda: lá a
 * última cadeia, aqui todas.
 *
 * ─── POR QUE A JORNADA NÃO É UM `Shift` ───────────────────────────────────────
 * Vira um, no fim (`jornadaParaShift`), porque o motor CLT só sabe ler `Shift[]`. Mas a jornada
 * carrega o que o `Shift` não tem e o registro de ponto precisa ter: **as pendências**. Um turno
 * planejado é uma afirmação ("das 7 às 17, com 1h de intervalo"); uma jornada derivada é uma
 * leitura de marcações, e marcação falta. Achatar as duas coisas cedo demais é o que produz
 * violação legal inventada — ver `conferirJornadasCLT`.
 *
 * ⚠️ **Nada aqui escreve em `state.shifts`.** O planejado e o realizado são coisas diferentes, e é
 * da comparação entre os dois que saem atraso, hora extra e aderência.
 */
import type { CLTSettings, CLTViolation, RegistroDePonto, Shift, Worker } from '@/types'
import { runAllCLTChecks } from '@/features/mao-de-obra/utils/cltEngine'
import { dataLocalISO } from '@/lib/utils'
import { HORAS_ENTRE_JORNADAS, HORAS_MAX_JORNADA } from './batida'

/** O que está faltando ou merece conferência nesta jornada. */
export type PendenciaDaJornada =
  /** Número ímpar de batidas: entrou e não registrou a saída. */
  | 'sem-saida'
  /** Só entrada e saída numa jornada que passa de 4h — o intervalo não foi MARCADO. */
  | 'sem-marcacao-de-intervalo'
  /** Saiu para o intervalo e não registrou a volta. */
  | 'intervalo-incompleto'
  /** Alguma batida caiu fora da cerca ou sem localização. */
  | 'batida-a-conferir'
  /** O aparelho afirma ter batido no futuro do servidor — relógio adulterado. */
  | 'relogio-divergente'

export const TEXTO_DA_PENDENCIA: Record<PendenciaDaJornada, string> = {
  'sem-saida':                  'Sem saída registrada',
  'sem-marcacao-de-intervalo':  'Intervalo não foi marcado',
  'intervalo-incompleto':       'Saiu para o intervalo e não voltou',
  'batida-a-conferir':          'Batida fora da cerca ou sem localização',
  'relogio-divergente':         'Relógio do aparelho adiantado',
}

export interface Jornada {
  /** `${workerId}|${data}` — estável, para chave de React e id de Shift. */
  id: string
  workerId: string
  /** `yyyy-MM-dd` da PRIMEIRA batida. Turno que vira o dia pertence ao dia em que começou. */
  data: string
  siteId: string | null
  entrada?: RegistroDePonto
  saida?: RegistroDePonto
  /** Minutos parados entre um par de batidas e o seguinte. */
  intervaloMin: number
  /** Minutos efetivamente dentro — soma dos períodos FECHADOS. */
  minutosTrabalhados: number
  /** O que falta ou merece conferência. Vazio = jornada limpa. */
  pendencias: PendenciaDaJornada[]
  batidas: RegistroDePonto[]
  /** Os NSR das batidas, na ordem. É o que o espelho imprime. */
  nsrs: number[]
}

/**
 * Divergência de relógio, em segundos, a partir da qual a jornada é marcada.
 *
 * ⚠️ Só o lado NEGATIVO importa. Positivo significa que o aparelho estava atrasado em relação ao
 * servidor — o normal de uma batida feita sem rede e sincronizada depois. Negativo é o aparelho
 * afirmando ter batido no futuro, e isso não acontece sem alguém mexer no relógio.
 */
const DIVERGENCIA_SUSPEITA_S = -120

const MS_POR_HORA = 3_600_000

function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Agrupa as batidas de UM trabalhador em jornadas fechadas.
 *
 * ⚠️ A régua é a folga ENTRE batidas, nunca a data. Turno que começa às 22h de segunda e termina
 * às 6h de terça é UMA jornada, de segunda — filtrar por dia civil é o defeito que a Etapa 3 já
 * consertou na tela do funcionário, e ele não pode voltar aqui.
 *
 * ⚠️ E a régua DEPENDE DA PARIDADE, exatamente como em `jornadaAberta`. Uma folga longa entre duas
 * batidas significa coisas opostas conforme a pessoa esteja dentro ou fora:
 *
 *  · número ÍMPAR de batidas na cadeia = ela entrou e não saiu, está trabalhando. Dez horas de
 *    silêncio aí são dez horas de trabalho sem marcação intermediária — dividir isso em duas
 *    jornadas de uma batida cada inventa dois dias e perde o dia real;
 *  · número PAR = ela está fora, e só volta à mesma jornada dentro de `HORAS_ENTRE_JORNADAS`.
 *
 * Sem essa distinção, quem bate só entrada e saída — o caso mais comum de quem esquece o
 * intervalo — nunca produz uma jornada inteira.
 */
function agruparPorJornada(doTrabalhador: readonly RegistroDePonto[]): RegistroDePonto[][] {
  const ordenadas = [...doTrabalhador]
    .filter((r) => Number.isFinite(Date.parse(r.momentoDispositivo)))
    .sort((a, b) => a.momentoDispositivo.localeCompare(b.momentoDispositivo))
  if (ordenadas.length === 0) return []

  const grupos: RegistroDePonto[][] = [[ordenadas[0]]]
  for (let i = 1; i < ordenadas.length; i++) {
    const cadeia = grupos[grupos.length - 1]
    const dentro = cadeia.length % 2 === 1
    const limiteMs = (dentro ? HORAS_MAX_JORNADA : HORAS_ENTRE_JORNADAS) * MS_POR_HORA
    const anterior = Date.parse(cadeia[cadeia.length - 1].momentoDispositivo)
    const atual = Date.parse(ordenadas[i].momentoDispositivo)
    if (atual - anterior >= limiteMs) grupos.push([ordenadas[i]])
    else cadeia.push(ordenadas[i])
  }
  return grupos
}

/**
 * Uma jornada a partir das batidas dela.
 *
 * ⚠️ O tempo é contado por PARIDADE, não pelo rótulo da batida. As batidas alternam dentro/fora:
 * o 1º par é trabalho, o intervalo é o vão até o par seguinte, e assim por diante. Confiar no
 * `tipo` quebraria a hora extra chamada à noite (a 5ª batida do dia é "entrada" de novo) e
 * quebraria qualquer dia em que alguém tocou o botão na ordem errada — que é justamente o dia em
 * que a conta precisa continuar fazendo sentido.
 */
function montarJornada(batidas: RegistroDePonto[]): Jornada {
  const t = batidas.map((b) => Date.parse(b.momentoDispositivo))
  const pares = Math.floor(batidas.length / 2)

  let trabalhados = 0
  for (let k = 0; k < pares; k++) trabalhados += t[2 * k + 1] - t[2 * k]

  let parado = 0
  for (let k = 0; k + 1 < pares; k++) parado += t[2 * k + 2] - t[2 * k + 1]

  const aberta = batidas.length % 2 === 1
  const minutosTrabalhados = Math.max(0, Math.round(trabalhados / 60_000))
  const intervaloMin = Math.max(0, Math.round(parado / 60_000))

  const pendencias: PendenciaDaJornada[] = []
  if (aberta) {
    // Ímpar: ou esqueceu a saída (1 batida), ou saiu para o intervalo e não voltou (3, 5…).
    pendencias.push(batidas.length === 1 ? 'sem-saida' : 'intervalo-incompleto')
  }
  // ⚠️ Duas batidas numa jornada que passa de 4h: o intervalo não foi MARCADO. Isso NÃO é o mesmo
  // que intervalo não concedido, e o sistema não tem como saber a diferença — por isso vira
  // pendência para o gestor resolver, e não violação do art. 71. Ver `conferirJornadasCLT`.
  if (batidas.length === 2 && minutosTrabalhados > 4 * 60) pendencias.push('sem-marcacao-de-intervalo')
  if (batidas.some((b) => b.dentroDaCerca === false || b.motivoSemCerca)) pendencias.push('batida-a-conferir')
  if (batidas.some((b) => (b.divergenciaRelogioS ?? 0) < DIVERGENCIA_SUSPEITA_S)) pendencias.push('relogio-divergente')

  const primeira = batidas[0]
  return {
    id: `${primeira.workerId}|${primeira.data}`,
    workerId: primeira.workerId,
    data: primeira.data,
    siteId: primeira.siteId,
    entrada: primeira,
    saida: aberta ? undefined : batidas[batidas.length - 1],
    intervaloMin,
    minutosTrabalhados,
    pendencias,
    batidas,
    nsrs: batidas.map((b) => b.nsr).filter((n): n is number => typeof n === 'number'),
  }
}

/**
 * Todas as jornadas do período, de todos os trabalhadores presentes nos registros.
 *
 * `de`/`ate` em `yyyy-MM-dd`, inclusivos, comparados contra `Jornada.data` — ou seja, contra o dia
 * em que a jornada COMEÇOU. Um turno da noite iniciado no último dia do mês pertence àquele mês
 * inteiro, mesmo terminando no mês seguinte.
 */
export function jornadasDoPeriodo(
  registros: readonly RegistroDePonto[],
  de: string,
  ate: string,
): Jornada[] {
  const porTrabalhador = new Map<string, RegistroDePonto[]>()
  for (const r of registros) {
    const arr = porTrabalhador.get(r.workerId) ?? []
    arr.push(r)
    porTrabalhador.set(r.workerId, arr)
  }

  const out: Jornada[] = []
  for (const batidas of porTrabalhador.values()) {
    for (const grupo of agruparPorJornada(batidas)) {
      const j = montarJornada(grupo)
      if (j.data >= de && j.data <= ate) out.push(j)
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.workerId.localeCompare(b.workerId))
}

/**
 * A jornada como `Shift`, para o motor CLT ler.
 *
 * Devolve `null` para jornada aberta: sem saída não existe `endTime`, e inventar um fecharia a
 * jornada com um horário que ninguém bateu. Jornada aberta vira pendência no espelho, não turno.
 *
 * ⚠️ O `id` é DETERMINÍSTICO. O `makeId()` do cltEngine é `Math.random`, e sem id estável as
 * violações trocam de identidade a cada render — a lista pisca e nada pode ser dispensado.
 */
export function jornadaParaShift(j: Jornada): Shift | null {
  if (!j.entrada || !j.saida) return null
  return {
    id: `ponto|${j.workerId}|${j.data}`,
    workerId: j.workerId,
    date: j.data,
    startTime: hhmm(j.entrada.momentoDispositivo),
    endTime: hhmm(j.saida.momentoDispositivo),
    breakMinutes: j.intervaloMin,
    type: 'regular',
    // `confirmed` porque a pessoa bateu: é a evidência mais forte que existe no sistema.
    status: 'confirmed',
    siteId: j.siteId,
  }
}

/** Todos os dias `yyyy-MM-dd` entre `de` e `ate`, inclusive. */
function diasDoPeriodo(de: string, ate: string): string[] {
  const out: string[] = []
  const fim = new Date(ate + 'T00:00:00')
  for (const d = new Date(de + 'T00:00:00'); d <= fim; d.setDate(d.getDate() + 1)) {
    out.push(dataLocalISO(d))
  }
  return out
}

/**
 * Folgas sintéticas — o conserto do falso positivo de DSR.
 *
 * ⚠️ `validateDSR` exige, em toda semana, um `Shift` com `type: 'day_off'` ou `'holiday'`. Jornada
 * derivada de batida NUNCA é folga: dia sem batida simplesmente não vira turno nenhum. Sem estas
 * linhas, **cada pessoa ganha quatro ou cinco violações BLOQUEANTES por mês** — todas falsas, todas
 * dizendo que a empresa não deu descanso semanal justamente a quem descansou.
 *
 * Um dia sem batida e sem turno planejado é, por eliminação, um dia em que a pessoa não trabalhou.
 * É exatamente o que a folga afirma.
 */
export function folgasSinteticas(
  workerId: string,
  de: string,
  ate: string,
  diasComJornada: ReadonlySet<string>,
  feriados: ReadonlySet<string> = new Set(),
): Shift[] {
  return diasDoPeriodo(de, ate)
    .filter((dia) => !diasComJornada.has(dia))
    .map((dia) => ({
      id: `ponto-folga|${workerId}|${dia}`,
      workerId,
      date: dia,
      startTime: '00:00',
      endTime: '00:00',
      breakMinutes: 0,
      type: feriados.has(dia) ? ('holiday' as const) : ('day_off' as const),
      status: 'confirmed' as const,
      siteId: null,
    }))
}

export interface OpcoesDaConferencia {
  de: string
  ate: string
  feriados?: ReadonlySet<string>
}

/**
 * As violações CLT das jornadas REALIZADAS — sem inventar nenhuma.
 *
 * Reusa `runAllCLTChecks` inteiro, em vez de reimplementar as regras: se o motor ganhar uma
 * validação nova, ela vale aqui de graça. O que este wrapper faz é só cercar os dois falsos
 * positivos que a derivação por batidas cria, e que não existem quando a entrada é escala
 * planejada:
 *
 * 1. **DSR** — resolvido ANTES, com `folgasSinteticas`.
 * 2. **Art. 71** — resolvido DEPOIS, filtrando. `validateBreaks` olha só `breakMinutes`, e uma
 *    jornada de duas batidas tem zero por falta de MARCAÇÃO, não por falta de intervalo. Acusar
 *    violação bloqueante aí é afirmar que a empresa negou o descanso quando o que houve foi o
 *    funcionário não tocar o botão. A pendência fica no espelho, onde o gestor conserta.
 */
export function conferirJornadasCLT(
  workers: readonly Worker[],
  jornadas: readonly Jornada[],
  settings: CLTSettings,
  opcoes: OpcoesDaConferencia,
): CLTViolation[] {
  const shifts: Shift[] = []
  const porTrabalhador = new Map<string, Set<string>>()

  for (const j of jornadas) {
    const s = jornadaParaShift(j)
    if (s) shifts.push(s)
    const dias = porTrabalhador.get(j.workerId) ?? new Set<string>()
    dias.add(j.data)
    porTrabalhador.set(j.workerId, dias)
  }

  for (const [workerId, dias] of porTrabalhador) {
    shifts.push(...folgasSinteticas(workerId, opcoes.de, opcoes.ate, dias, opcoes.feriados))
  }

  // As duplas (trabalhador, dia) em que o intervalo não foi marcado.
  const semMarcacao = new Set(
    jornadas
      .filter((j) => j.pendencias.includes('sem-marcacao-de-intervalo'))
      .map((j) => `${j.workerId}|${j.data}`),
  )

  return runAllCLTChecks([...workers], shifts, settings)
    .filter((v) => !(v.type === 'break_required' && semMarcacao.has(`${v.workerId}|${v.date}`)))
}

/**
 * Minutos que passam do previsto, já com a tolerância do art. 58 §1º descontada.
 *
 * ⚠️ `CLTSettings.toleranciaPontoMin` existe no tipo desde que o ponto foi desenhado, está
 * documentado como "art. 58 §1º: 5+5" e **nunca foi lido por ninguém**. É aqui.
 *
 * A lei: variação de até 5 minutos por marcação, no limite de 10 minutos por dia, não é hora extra
 * nem atraso. Quem chega 4 minutos adiantado e sai 3 atrasado não trabalhou 7 minutos a mais — e
 * quem passa do limite recebe (ou deve) o período INTEIRO, não só o excedente. É o que a súmula
 * 366 do TST diz, e é o que este sinal `>` produz.
 */
export function minutosAlemDoPrevisto(
  minutosTrabalhados: number,
  minutosPrevistos: number,
  settings: Pick<CLTSettings, 'toleranciaPontoMin'>,
): number {
  const diferenca = minutosTrabalhados - minutosPrevistos
  const tolerancia = settings.toleranciaPontoMin ?? 0
  return Math.abs(diferenca) > tolerancia ? diferenca : 0
}
