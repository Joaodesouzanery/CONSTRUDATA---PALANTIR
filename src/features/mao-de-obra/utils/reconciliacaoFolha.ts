/**
 * reconciliacaoFolha.ts — o que mudou nas folhas já emitidas depois da correção dos cálculos.
 *
 * POR QUE ISTO EXISTE. Sete erros de cálculo foram corrigidos numa folha que já era usada para
 * pagar gente. Corrigir daqui para a frente é metade do trabalho: sem saber **quem** foi afetado
 * e **em quanto**, não há como devolver o que foi descontado a mais nem acertar o que deixou de
 * ser pago. Este módulo recalcula cada holerite guardado com o motor corrigido e mostra a
 * diferença, linha a linha.
 *
 * COMO LER O RESULTADO. `diferencaLiquido` positivo significa que o trabalhador **tem a receber**
 * (o valor pago foi menor que o correto); negativo, que foi **pago a mais**. Os dois casos
 * existem nos mesmos dados: o INSS sem teto descontava demais (a favor do trabalhador na
 * correção), enquanto hora extra e adicional noturno não pagos vão no mesmo sentido — mas turno
 * "ausente" pago integralmente vai no sentido oposto.
 *
 * ── AS TRÊS RESSALVAS, E ELAS IMPORTAM ────────────────────────────────────────────────────────
 *
 * 1. **Depende dos turnos ainda existirem.** O recálculo usa os turnos daquele mês. Se algum foi
 *    apagado depois do fechamento, a comparação daquele funcionário fica sem base — por isso
 *    existe o estado `semTurnos`, que é reportado em vez de virar diferença silenciosa de 100%.
 *
 * 2. **O histórico vive só neste navegador.** `payrollHistory` não é sincronizado com o servidor
 *    (é um dos defeitos ainda em aberto). A reconciliação só enxerga as folhas geradas nesta
 *    máquina. Rode em cada computador que fechou folha.
 *
 * 3. **Isto não é cálculo de rescisão nem de encargo retroativo.** É a diferença bruta entre o
 *    que o sistema calculou antes e o que ele calcula agora. Reflexo em férias, 13º, FGTS
 *    recolhido e a forma de acerto são decisão do RH/contabilidade.
 */

import type { CLTSettings, PayrollMonth, Shift, Worker, WorkerPayslip } from '@/types'
import { generatePayslip } from './payrollEngine'

export type LinhaDiferenca = {
  rubrica: string
  antes: number
  agora: number
  diferenca: number
}

export type ItemReconciliacao = {
  workerId: string
  workerName: string
  competencia: string
  /** Não havia turnos guardados para recalcular — a comparação não é confiável. */
  semTurnos: boolean
  liquidoAntes: number
  liquidoAgora: number
  /** Positivo: o trabalhador tem a receber. Negativo: foi pago a mais. */
  diferencaLiquido: number
  linhas: LinhaDiferenca[]
}

export type ResumoReconciliacao = {
  itens: ItemReconciliacao[]
  competencias: string[]
  totalAReceber: number
  totalPagoAMais: number
  quantidadeAfetada: number
  quantidadeSemTurnos: number
}

/** `+ 0` normaliza o -0 que aparece ao somar conjunto vazio — no relatório vira "-0,00". */
const r2 = (n: number) => Math.round(n * 100) / 100 + 0
/** Diferenças de centavo vêm de arredondamento, não de erro de regra. */
const RELEVANTE = 0.01

function valorPorTipo(p: WorkerPayslip, grupo: 'allowances' | 'deductions', tipo: string): number {
  const lista = grupo === 'allowances' ? p.allowances : p.deductions
  return lista.filter((x) => x.type === tipo).reduce((s, x) => s + x.amount, 0)
}

/** As rubricas que os sete erros podiam mexer, na ordem em que aparecem no holerite. */
const RUBRICAS: { chave: string; rotulo: string; ler: (p: WorkerPayslip) => number }[] = [
  { chave: 'base',      rotulo: 'Salário base',        ler: (p) => p.baseSalary },
  { chave: 'overtime',  rotulo: 'Horas extras',        ler: (p) => valorPorTipo(p, 'allowances', 'overtime') },
  { chave: 'night',     rotulo: 'Adicional noturno',   ler: (p) => valorPorTipo(p, 'allowances', 'night_diff') },
  { chave: 'dsr',       rotulo: 'DSR sobre HE',        ler: (p) => valorPorTipo(p, 'allowances', 'dsr') },
  { chave: 'inss',      rotulo: 'INSS (desconto)',     ler: (p) => -valorPorTipo(p, 'deductions', 'inss') },
  { chave: 'irrf',      rotulo: 'IRRF (desconto)',     ler: (p) => -valorPorTipo(p, 'deductions', 'irrf') },
  { chave: 'vt',        rotulo: 'Vale-transporte',     ler: (p) => -valorPorTipo(p, 'deductions', 'vt') },
  { chave: 'va',        rotulo: 'Vale-alimentação',    ler: (p) => -valorPorTipo(p, 'deductions', 'va') },
]

export function reconciliarFolhas(
  historico: PayrollMonth[],
  workers: Worker[],
  shifts: Shift[],
  settings: CLTSettings,
): ResumoReconciliacao {
  const porId = new Map(workers.map((w) => [w.id, w]))
  const itens: ItemReconciliacao[] = []

  for (const folha of historico) {
    for (const antigo of folha.payslips) {
      const worker = porId.get(antigo.workerId)
      if (!worker) continue

      const turnosDoMes = shifts.filter((s) => s.workerId === worker.id && s.date.startsWith(folha.month))
      const novo = generatePayslip(worker, shifts, settings, folha.month)

      const linhas = RUBRICAS
        .map(({ rotulo, ler }) => {
          const antes = r2(ler(antigo))
          const agora = r2(ler(novo))
          return { rubrica: rotulo, antes, agora, diferenca: r2(agora - antes) }
        })
        .filter((l) => Math.abs(l.diferenca) >= RELEVANTE)

      const diferencaLiquido = r2(novo.netTotal - antigo.netTotal)
      if (linhas.length === 0 && Math.abs(diferencaLiquido) < RELEVANTE) continue

      itens.push({
        workerId: worker.id,
        workerName: worker.name,
        competencia: folha.month,
        // Sem turnos guardados o recálculo zera tudo, e a "diferença" seria o holerite inteiro —
        // ruído, não informação. Fica marcado para conferência manual.
        semTurnos: turnosDoMes.length === 0,
        liquidoAntes: r2(antigo.netTotal),
        liquidoAgora: r2(novo.netTotal),
        diferencaLiquido,
        linhas,
      })
    }
  }

  itens.sort((a, b) =>
    a.competencia === b.competencia
      ? Math.abs(b.diferencaLiquido) - Math.abs(a.diferencaLiquido)
      : b.competencia.localeCompare(a.competencia))

  const confiaveis = itens.filter((i) => !i.semTurnos)
  return {
    itens,
    competencias: [...new Set(itens.map((i) => i.competencia))].sort(),
    totalAReceber:  r2(confiaveis.filter((i) => i.diferencaLiquido > 0).reduce((s, i) => s + i.diferencaLiquido, 0)),
    totalPagoAMais: r2(-confiaveis.filter((i) => i.diferencaLiquido < 0).reduce((s, i) => s + i.diferencaLiquido, 0)),
    quantidadeAfetada: confiaveis.length,
    quantidadeSemTurnos: itens.filter((i) => i.semTurnos).length,
  }
}

/** CSV para levar ao RH. Ponto e vírgula e vírgula decimal — é o que o Excel pt-BR entende. */
export function reconciliacaoParaCSV(resumo: ResumoReconciliacao): string {
  const num = (n: number) => n.toFixed(2).replace('.', ',')
  const txt = (v: string) => `"${v.replace(/"/g, '""')}"`

  const linhas = [
    ['Competencia', 'Funcionario', 'Rubrica', 'Valor anterior', 'Valor corrigido', 'Diferenca', 'Situacao'].join(';'),
  ]

  for (const item of resumo.itens) {
    const situacao = item.semTurnos
      ? 'CONFERIR A MAO — sem turnos guardados'
      : item.diferencaLiquido > 0 ? 'A receber' : 'Pago a mais'

    for (const l of item.linhas) {
      linhas.push([
        item.competencia, txt(item.workerName), txt(l.rubrica),
        num(l.antes), num(l.agora), num(l.diferenca), txt(situacao),
      ].join(';'))
    }
    linhas.push([
      item.competencia, txt(item.workerName), txt('LIQUIDO'),
      num(item.liquidoAntes), num(item.liquidoAgora), num(item.diferencaLiquido), txt(situacao),
    ].join(';'))
  }

  linhas.push('')
  linhas.push([txt('Total a receber pelos trabalhadores'), num(resumo.totalAReceber)].join(';'))
  linhas.push([txt('Total pago a mais'), num(resumo.totalPagoAMais)].join(';'))
  linhas.push([txt('Holerites afetados'), String(resumo.quantidadeAfetada)].join(';'))
  linhas.push([txt('Sem turnos para recalcular'), String(resumo.quantidadeSemTurnos)].join(';'))
  return linhas.join('\n')
}
