/**
 * Frequência, absenteísmo e efetivo — o quadro de Gestão à Vista, em números.
 *
 * ─── DE ONDE VEIO A ESPECIFICAÇÃO ─────────────────────────────────────────────
 * De uma foto. O cliente mostrou o quadro impresso que a construtora mantém na parede do canteiro:
 * efetivo por cargo, situação do dia em barras, frequência média, absenteísmo médio, e as duas
 * séries mensais embaixo. É o que o gestor de obra realmente olha — e o produto não tinha nenhuma
 * dessas contas. Não uma versão ruim: nenhuma. Buscar por "frequência" ou "absenteísmo" no módulo
 * de Mão de Obra não devolvia nada.
 *
 * O dado bruto, porém, sempre esteve todo aqui: funcionários com cargo e departamento, faltas com
 * tipo, turnos com folga. Só faltava somar.
 *
 * ─── O QUE NÃO DÁ PARA REPRODUZIR, E POR QUÊ ──────────────────────────────────
 * O quadro da construtora tem "Externo", "INSS" e "Bndes" entre as situações. O modelo daqui vai
 * só até `sick_leave | justified | unjustified | vacation | accident | other`. Essas três caem em
 * **"Outros"** enquanto ninguém criar os tipos — um balde honesto vale mais que três fatias
 * inventadas com nome bonito.
 *
 * Arquivo puro: tudo entra por parâmetro, nada lê store, nada chama `new Date()`.
 */
import type { Worker, WorkerAbsence, Shift, TimecardEntry, WorkWeekMode } from '@/types'
import { ehDiaUtil } from '@/lib/diasUteis'
import { entraNaFolha } from '@/lib/funcionarioAtivo'

/** As situações que o quadro separa. `outros` é o balde honesto — ver o cabeçalho. */
export type SituacaoDoDia = 'presente' | 'folga' | 'falta' | 'atestado' | 'ferias' | 'outros'

export const ROTULO_SITUACAO: Record<SituacaoDoDia, string> = {
  presente: 'Presente',
  folga:    'Folga',
  falta:    'Falta',
  atestado: 'Atestado',
  ferias:   'Férias',
  outros:   'Outros',
}

export interface EfetivoPorCargo {
  cargo: string
  /** Separação do quadro. Depende de `Worker.department` estar preenchido. */
  administrativo: number
  producao: number
  total: number
}

export interface SituacaoContada {
  situacao: SituacaoDoDia
  pessoas: number
  /** Fatia do efetivo do dia, 0–100. */
  pct: number
}

/**
 * A situação de cada pessoa num dia, contada.
 *
 * **A soma das fatias é sempre o efetivo inteiro.** Cada pessoa cai em exatamente um balde — é o
 * invariante que o teste cobra, porque contar alguém duas vezes (de férias E ausente) ou nenhuma
 * (sem turno e sem falta) faz o percentual mentir sem dar sinal.
 */
export function situacaoNoDia(entrada: {
  workers: Worker[]
  absences: WorkerAbsence[]
  shifts: Shift[]
  /**
   * Apontamentos do dia — e eles NÃO são opcionais no espírito, só na assinatura.
   *
   * ⚠️ Presença não pode depender só de turno. A ponte RDO→Mão de Obra grava **apontamento**
   * (`TimecardEntry`), não turno: numa empresa que opera por RDO e não usa a Escala, ninguém tem
   * turno lançado — e olhar só para turnos jogaria a equipe inteira em "Outros" e mostraria
   * frequência de 0%. Seria o mesmo "zero que não é zero" que este trabalho existe para eliminar.
   *
   * Um apontamento com horas é a evidência mais forte de presença que existe: alguém registrou
   * que a pessoa trabalhou N horas naquele dia.
   */
  timecards?: TimecardEntry[]
  data: string
}): { total: number; contagem: SituacaoContada[] } {
  const { workers, absences, shifts, timecards = [], data } = entrada
  // Só quem está na folha: desligado e suspenso não têm situação num dia de trabalho.
  const efetivo = workers.filter(entraNaFolha)

  const faltaPorWorker = new Map<string, WorkerAbsence>()
  for (const a of absences) if (a.date === data) faltaPorWorker.set(a.workerId, a)

  const turnoPorWorker = new Map<string, Shift>()
  for (const s of shifts) if (s.date === data) turnoPorWorker.set(s.workerId, s)

  const apontou = new Set<string>()
  for (const t of timecards) if (t.date === data && (Number(t.hoursWorked) || 0) > 0) apontou.add(t.workerId)

  const baldes: Record<SituacaoDoDia, number> = {
    presente: 0, folga: 0, falta: 0, atestado: 0, ferias: 0, outros: 0,
  }

  for (const w of efetivo) {
    const ausencia = faltaPorWorker.get(w.id)
    if (ausencia) {
      // A ausência vence o turno: se a pessoa faltou, não interessa que havia turno marcado.
      if (ausencia.type === 'sick_leave')      baldes.atestado += 1
      else if (ausencia.type === 'vacation')   baldes.ferias += 1
      else if (ausencia.type === 'unjustified') baldes.falta += 1
      else baldes.outros += 1   // justified, accident, other — e o que o modelo ainda não tem
      continue
    }
    const turno = turnoPorWorker.get(w.id)
    // Folga marcada vence o apontamento: se o turno diz folga e ainda assim há horas lançadas, o
    // que se sabe com mais certeza é que aquele dia foi declarado folga.
    if (turno && (turno.type === 'day_off' || turno.type === 'holiday')) { baldes.folga += 1; continue }
    // Turno OU apontamento. Empresa que usa a Escala tem o primeiro; empresa que opera por RDO tem
    // o segundo. Exigir os dois deixaria metade dos clientes com 0% de frequência.
    if (turno || apontou.has(w.id)) { baldes.presente += 1; continue }
    // Sem falta, sem turno e sem apontamento: o dia simplesmente não foi registrado para esta
    // pessoa. Não é presença — presumir presença infla a frequência com base em ausência de dado.
    baldes.outros += 1
  }

  const total = efetivo.length
  const contagem = (Object.keys(baldes) as SituacaoDoDia[]).map((situacao) => ({
    situacao,
    pessoas: baldes[situacao],
    pct: total > 0 ? Math.round((baldes[situacao] / total) * 1000) / 10 : 0,
  }))
  return { total, contagem }
}

/** O efetivo por cargo, com a separação administrativo × produção. */
export function efetivoPorCargo(workers: Worker[]): { linhas: EfetivoPorCargo[]; total: EfetivoPorCargo } {
  const porCargo = new Map<string, EfetivoPorCargo>()
  for (const w of workers.filter(entraNaFolha)) {
    const cargo = (w.role || 'Sem cargo').trim()
    const atual = porCargo.get(cargo) ?? { cargo, administrativo: 0, producao: 0, total: 0 }
    // `department` é texto livre. Quem escreve "Administrativo" cai de um lado; todo o resto —
    // inclusive quem deixou em branco — é produção, que é a resposta certa numa construtora.
    if (/administrativ/i.test(w.department ?? '')) atual.administrativo += 1
    else atual.producao += 1
    atual.total += 1
    porCargo.set(cargo, atual)
  }
  const linhas = [...porCargo.values()].sort((a, b) => a.cargo.localeCompare(b.cargo, 'pt-BR'))
  return {
    linhas,
    total: {
      cargo: 'Total',
      administrativo: linhas.reduce((s, l) => s + l.administrativo, 0),
      producao: linhas.reduce((s, l) => s + l.producao, 0),
      total: linhas.reduce((s, l) => s + l.total, 0),
    },
  }
}

export interface FrequenciaDoPeriodo {
  /** Presenças ÷ (efetivo × dias úteis), em 0–100. `null` quando não houve dia útil. */
  frequenciaPct: number | null
  /** `100 − frequência`. `null` pelo mesmo motivo. */
  absenteismoPct: number | null
  diasUteis: number
  presencas: number
  /** Efetivo × dias úteis: quantas presenças seriam possíveis. */
  possiveis: number
}

/**
 * Frequência e absenteísmo num intervalo.
 *
 * Denominador = efetivo × dias úteis do período. Contar dia de calendário faria a frequência
 * máxima de um mês comum ficar em ~68%, e o quadro inteiro pareceria uma catástrofe.
 *
 * Devolve `null`, e não `0`, num período sem dia útil nenhum: 0% se lê como "ninguém apareceu".
 */
export function frequenciaNoPeriodo(entrada: {
  workers: Worker[]
  absences: WorkerAbsence[]
  shifts: Shift[]
  timecards?: TimecardEntry[]
  de: string
  ate: string
  feriados: Set<string>
  jornada: WorkWeekMode
}): FrequenciaDoPeriodo {
  const { workers, absences, shifts, timecards = [], de, ate, feriados, jornada } = entrada
  const efetivo = workers.filter(entraNaFolha).length

  let diasUteis = 0, presencas = 0
  for (const dia of diasEntreISO(de, ate)) {
    if (!ehDiaUtil(dia, feriados, jornada).util) continue
    diasUteis += 1
    presencas += situacaoNoDia({ workers, absences, shifts, timecards, data: dia })
      .contagem.find((c) => c.situacao === 'presente')?.pessoas ?? 0
  }

  const possiveis = efetivo * diasUteis
  const frequenciaPct = possiveis > 0 ? Math.round((presencas / possiveis) * 1000) / 10 : null
  return {
    frequenciaPct,
    absenteismoPct: frequenciaPct === null ? null : Math.round((100 - frequenciaPct) * 10) / 10,
    diasUteis,
    presencas,
    possiveis,
  }
}

export interface PontoMensal {
  /** `yyyy-MM`. */
  mes: string
  frequenciaPct: number | null
  absenteismoPct: number | null
  /** Funcionários na folha no fim do mês — o denominador de faltas/funcionário. */
  ativos: number
  faltas: number
  /** `faltas ÷ ativos`. `null` sem ninguém na folha. */
  faltasPorFuncionario: number | null
}

/** A série mensal dos dois quadros de baixo: frequência/absenteísmo e faltas por funcionário. */
export function serieMensal(entrada: {
  workers: Worker[]
  absences: WorkerAbsence[]
  shifts: Shift[]
  timecards?: TimecardEntry[]
  /** `yyyy-MM`, do mais antigo ao mais recente. */
  meses: string[]
  feriados: Set<string>
  jornada: WorkWeekMode
}): PontoMensal[] {
  const { workers, absences, shifts, timecards = [], meses, feriados, jornada } = entrada
  const efetivo = workers.filter(entraNaFolha)

  return meses.map((mes) => {
    const de = `${mes}-01`
    const ate = ultimoDiaDoMes(mes)
    const f = frequenciaNoPeriodo({ workers, absences, shifts, timecards, de, ate, feriados, jornada })
    const faltas = absences.filter((a) => a.date >= de && a.date <= ate).length
    return {
      mes,
      frequenciaPct: f.frequenciaPct,
      absenteismoPct: f.absenteismoPct,
      ativos: efetivo.length,
      faltas,
      faltasPorFuncionario: efetivo.length > 0 ? Math.round((faltas / efetivo.length) * 100) / 100 : null,
    }
  })
}

// ── Datas, sem `Date` onde dá para evitar ─────────────────────────────────────

/** O último dia do mês `yyyy-MM`, em `yyyy-MM-dd`. Cobre fevereiro bissexto sem tabela. */
export function ultimoDiaDoMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(Date.UTC(ano, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Os dias de `de` a `ate`, inclusive, em `yyyy-MM-dd`. */
function diasEntreISO(de: string, ate: string): string[] {
  if (!de || !ate || de > ate) return []
  const out: string[] = []
  // Meio-dia UTC evita que o horário de verão empurre a data para o dia anterior.
  const cursor = new Date(`${de}T12:00:00Z`)
  const fim = new Date(`${ate}T12:00:00Z`)
  // Teto de ~3 anos: a tela oferece intervalo livre, e um erro de digitação não pode travar a aba.
  for (let guarda = 0; cursor <= fim && guarda < 1200; guarda++) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/** Os N meses até `mesFinal`, inclusive, do mais antigo ao mais recente. */
export function ultimosMeses(mesFinal: string, quantos: number): string[] {
  const [ano, m] = mesFinal.split('-').map(Number)
  const out: string[] = []
  for (let i = quantos - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, m - 1 - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
