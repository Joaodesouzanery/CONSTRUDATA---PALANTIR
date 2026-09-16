/**
 * gradeHoraExtra.ts — quais dias do mês entram na grade de hora extra, e quem aparece em cada linha.
 *
 * ─── POR QUE O CALENDÁRIO NÃO É UMA TABELA ────────────────────────────────────
 * Dia da semana se calcula; não precisa ser cadastrado nem sincronizado. O que precisa de cadastro
 * é o **feriado** — e esse já existe (`plan_holidays`, por organização). Então a grade é a união
 * de dois conjuntos: os sábados e domingos do mês (calculados) e os feriados cadastrados que caem
 * em dia de semana (lidos). Feriado paga como domingo — é a regra que o cliente aplica.
 *
 * ⚠️ Feriado é por EMPRESA, não por obra (a ressalva já registrada em `src/lib/diasUteis.ts`). Um
 * feriado municipal de uma cidade aparece na grade de todas as obras.
 */
import type { Cargo, HoraExtra, PlanHoliday, Worker } from '@/types'
import { diariaSugerida } from './cargosPadrao'
import { chaveDaPessoa } from './horaExtraCalculo'

export type TipoDeDia = 'sabado' | 'domingo' | 'feriado'

export interface DiaDeHoraExtra {
  /** yyyy-MM-dd */
  data: string
  dia: number
  tipo: TipoDeDia
  /** Nome do feriado, quando for um. Vai no `title` da coluna. */
  descricao?: string
  /** Feriado e domingo pagam pela mesma coluna do cargo. */
  pagaComoDomingo: boolean
}

/**
 * Os dias do mês em que uma presença vira hora extra.
 *
 * `mes` é 1-12. Usa UTC para percorrer o calendário (só interessa o dia da semana, e UTC não tem
 * horário de verão para trocar a data na virada).
 */
export function diasDePagamentoDoMes(mes: number, ano: number, feriados: PlanHoliday[] = []): DiaDeHoraExtra[] {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}-`
  const porData = new Map<string, PlanHoliday>()
  for (const f of feriados) if (f.date?.startsWith(prefixo)) porData.set(f.date, f)

  const dias: DiaDeHoraExtra[] = []
  for (let d = 1; d <= ultimo; d++) {
    const data = `${prefixo}${String(d).padStart(2, '0')}`
    const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()
    const feriado = porData.get(data)
    // Feriado vence o dia da semana no RÓTULO (é a informação nova), mas sábado que também é
    // feriado continua pagando como domingo — feriado é sempre a régua mais alta.
    if (feriado) dias.push({ data, dia: d, tipo: 'feriado', descricao: feriado.description, pagaComoDomingo: true })
    else if (semana === 0) dias.push({ data, dia: d, tipo: 'domingo', pagaComoDomingo: true })
    else if (semana === 6) dias.push({ data, dia: d, tipo: 'sabado', pagaComoDomingo: false })
  }
  return dias
}

export interface CelulaDaGrade {
  data: string
  lancamento?: HoraExtra
  /** O que a precedência sugere para este dia. `null` = nada configurado (nunca 0). */
  sugestao: number | null
}

export interface LinhaDaGrade {
  workerId?: string
  nome: string
  cargo?: string
  celulas: CelulaDaGrade[]
  total: number
  totalPago: number
}

/**
 * Uma linha por pessoa, uma célula por dia.
 *
 * Entram os funcionários ativos **mais** qualquer pessoa que já tenha lançamento no mês e não
 * esteja (ou não esteja mais) no cadastro — hora extra importada de planilha nem sempre casou com
 * um `Worker`, e sumir com a linha esconderia dinheiro já lançado.
 */
export function montarGrade(
  workers: Worker[],
  horasExtras: HoraExtra[],
  dias: DiaDeHoraExtra[],
  cargos: Cargo[],
): LinhaDaGrade[] {
  const doMes = horasExtras.filter((h) => h.tipo === 'fim-de-semana' && dias.some((d) => d.data === h.data))
  const porChave = new Map<string, HoraExtra[]>()
  for (const h of doMes) {
    const k = chaveDaPessoa(h)
    const lista = porChave.get(k)
    if (lista) lista.push(h)
    else porChave.set(k, [h])
  }

  const linhas: LinhaDaGrade[] = []
  const vistos = new Set<string>()

  for (const w of workers) {
    const k = chaveDaPessoa({ workerId: w.id, workerNome: w.name })
    vistos.add(k)
    // Lançamento antigo pode ter casado pelo NOME (sem workerId); junta os dois conjuntos.
    const porNome = chaveDaPessoa({ workerNome: w.name })
    vistos.add(porNome)
    const lancamentos = [...(porChave.get(k) ?? []), ...(k === porNome ? [] : porChave.get(porNome) ?? [])]
    linhas.push(linhaDe(w.name, w.role, w.id, lancamentos, dias, w, cargos))
  }

  for (const [k, lancamentos] of porChave) {
    if (vistos.has(k)) continue
    const primeiro = lancamentos[0]
    linhas.push(linhaDe(primeiro.workerNome, primeiro.cargo, primeiro.workerId, lancamentos, dias, undefined, cargos))
  }

  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function linhaDe(
  nome: string,
  cargo: string | undefined,
  workerId: string | undefined,
  lancamentos: HoraExtra[],
  dias: DiaDeHoraExtra[],
  worker: Worker | undefined,
  cargos: Cargo[],
): LinhaDaGrade {
  const porData = new Map(lancamentos.map((h) => [h.data, h]))
  let total = 0
  let totalPago = 0
  const celulas = dias.map((d) => {
    const lancamento = porData.get(d.data)
    if (lancamento) {
      total += lancamento.valor
      if (lancamento.pago) totalPago += lancamento.valor
    }
    return { data: d.data, lancamento, sugestao: diariaSugerida(worker, cargos, d.pagaComoDomingo) }
  })
  return { workerId, nome, cargo, celulas, total, totalPago }
}
