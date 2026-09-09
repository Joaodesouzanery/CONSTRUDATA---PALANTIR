/**
 * conferenciaHorasExtras — a HE PAGA pelo Caixa contra o que a CLT diria.
 *
 * ─── O QUE ISTO É, E O QUE NÃO É ──────────────────────────────────────────────
 * É ALERTA. A planilha de Controle de Caixa traz "R$ X para Fulano, dia D", sem horas. A CLT paga
 * hora extra a `salário ÷ 220 × 1,5` (dia comum) ou `× 2,0` (domingo/feriado). Sem as horas não
 * há como dizer "pagou errado" — o que dá para dizer é: **quantas horas aquele valor compraria** à
 * hora CLT daquela pessoa. Se um lançamento de um dia equivale a 6 horas extras, alguém precisa
 * olhar: ou a diária não é HE, ou é HE de mais de um dia, ou o salário do cadastro está errado.
 *
 * A referência do desvio é o LIMITE legal: 2 horas extras por dia (`maxOvertimeHours`). Pago
 * acima do que 2h valeriam é desvio positivo; abaixo, negativo. Nunca corrige nada.
 *
 * ─── QUEM CASA COM QUEM ───────────────────────────────────────────────────────
 * `casarNome`, e não `matchWorkerByName`: exato entra; provável entra MARCADO; ambíguo não gera
 * linha de desvio — vira uma pendência "N candidatos para 'X' — resolva no cadastro". Um homônimo
 * aqui puxaria o salário da pessoa errada e o desvio pareceria medido.
 */
import type { FinanceiroEntry, Worker } from '@/types'
import { entraNaFolha } from '@/lib/funcionarioAtivo'
import { casarNome } from './casarNome'

export const HORAS_MES_CLT = 220

export interface LinhaHe {
  workerId: string
  workerName: string
  /** `yyyy-MM`. */
  competencia: string
  /** `provavel` = casou por aproximação; a tela marca "confirme". */
  casamento: 'exato' | 'provavel'
  lancamentos: number
  pago: number
  /** Hora extra CLT em dia comum (salário ÷ 220 × 1,5). */
  horaClt: number
  /** Quantas horas o valor pago compraria, respeitando 2,0× nos domingos/feriados. */
  horasImplicitas: number
  /** O que 2h/dia valeriam nos dias lançados. */
  referencia: number
  /** `(pago − referencia) / referencia`. */
  desvio: number
}

export interface PendenciaHe {
  nome: string
  motivo: 'ambiguo' | 'sem-cadastro' | 'sem-salario'
  candidatos?: string[]
  lancamentos: number
  pago: number
}

export interface ConferenciaHe {
  linhas: LinhaHe[]
  pendencias: PendenciaHe[]
  totalPago: number
  totalConferido: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function ehHoraExtra(e: FinanceiroEntry): boolean {
  return e.tipo === 'saida' && (e.subcategoria === 'horas_extras' || e.origem === 'horas-extras') && !!e.funcionarioNome
}

/** Domingo ou feriado paga 100%; o resto, 50%. */
export function fatorDoDia(dataISO: string, feriados: Set<string>): 1.5 | 2 {
  if (feriados.has(dataISO)) return 2
  const d = new Date(`${dataISO}T00:00:00`)
  return d.getDay() === 0 ? 2 : 1.5
}

export function conferirHorasExtras(
  entries: FinanceiroEntry[],
  workers: Worker[],
  feriados: Iterable<string> = [],
  opts: { maxOvertimeHours?: number } = {},
): ConferenciaHe {
  const fer = new Set(feriados)
  const limiteDia = opts.maxOvertimeHours && opts.maxOvertimeHours > 0 ? opts.maxOvertimeHours : 2
  const ativos = workers.filter(entraNaFolha)

  const porNome = new Map<string, FinanceiroEntry[]>()
  for (const e of entries) {
    if (!ehHoraExtra(e)) continue
    const k = e.funcionarioNome!.trim()
    porNome.set(k, [...(porNome.get(k) ?? []), e])
  }

  const linhas = new Map<string, LinhaHe>()
  const pendencias: PendenciaHe[] = []
  let totalPago = 0
  let totalConferido = 0

  for (const [nome, lancs] of porNome) {
    const pago = r2(lancs.reduce((s, e) => s + e.valor, 0))
    totalPago += pago
    const c = casarNome(nome, ativos)
    if (c.tipo === 'nenhum') { pendencias.push({ nome, motivo: 'sem-cadastro', lancamentos: lancs.length, pago }); continue }
    if (c.tipo === 'ambiguo') {
      pendencias.push({ nome, motivo: 'ambiguo', candidatos: c.candidatos.map((w) => w.name), lancamentos: lancs.length, pago })
      continue
    }
    const w = c.worker
    const salario = w.grossSalary ?? 0
    if (salario <= 0) { pendencias.push({ nome, motivo: 'sem-salario', lancamentos: lancs.length, pago }); continue }
    const horaClt = salario / HORAS_MES_CLT * 1.5
    totalConferido += pago

    for (const e of lancs) {
      const comp = e.data.slice(0, 7)
      const chave = `${w.id}|${comp}`
      const fator = fatorDoDia(e.data, fer)
      const horaDoDia = salario / HORAS_MES_CLT * fator
      const atual = linhas.get(chave) ?? {
        workerId: w.id, workerName: w.name, competencia: comp, casamento: c.tipo,
        lancamentos: 0, pago: 0, horaClt: r2(horaClt), horasImplicitas: 0, referencia: 0, desvio: 0,
      }
      atual.lancamentos += 1
      atual.pago = r2(atual.pago + e.valor)
      atual.horasImplicitas += e.valor / horaDoDia
      atual.referencia += horaDoDia * limiteDia
      linhas.set(chave, atual)
    }
  }

  const lista = [...linhas.values()].map((l) => ({
    ...l,
    horasImplicitas: Math.round(l.horasImplicitas * 10) / 10,
    referencia: r2(l.referencia),
    desvio: l.referencia > 0 ? (l.pago - l.referencia) / l.referencia : 0,
  }))
  lista.sort((a, b) => b.competencia.localeCompare(a.competencia) || Math.abs(b.desvio) - Math.abs(a.desvio))

  return { linhas: lista, pendencias, totalPago: r2(totalPago), totalConferido: r2(totalConferido) }
}
