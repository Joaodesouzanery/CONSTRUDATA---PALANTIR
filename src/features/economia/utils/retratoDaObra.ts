/**
 * O retrato financeiro de UMA obra num mês — com a origem de cada linha à vista.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────
 * O cliente pediu "uma métrica de economia para a obra". A auditoria mostrou que o módulo não
 * tinha como responder: ele não lia contrato, não lia financeiro e não lia custo real de mão de
 * obra — e sem essas três é matematicamente impossível dizer quanto uma obra economizou.
 *
 * Este arquivo é a ligação que faltava. Ele **não estima nada**: cada número aqui é uma soma de
 * lançamentos que alguém registrou, e vem rotulado com a fonte. A estimativa continua morando no
 * `economiaEngine`, separada, e a tela mostra as duas colunas lado a lado sem somá-las.
 *
 * ─── O QUE NÃO PODE SER SOMADO ────────────────────────────────────────────────
 * A armadilha é dupla contagem, e ela é real neste repositório:
 *
 *  - a ponte RDO→Financeiro **já lança** custo de mão de obra como saída (`sourceRdoId`), então
 *    somar "saídas do Financeiro" com "folha do mês" contaria o mesmo dinheiro duas vezes;
 *  - por isso as saídas saem **separadas por categoria**, e a folha aparece ao lado da categoria
 *    `mao_de_obra` como **conferência**, nunca como parcela.
 *
 * Arquivo puro: recebe tudo por parâmetro, não lê store nenhum, e por isso é testável.
 */
import type {
  ConstructionSite, FinanceiroEntry, Worker, Shift, CLTSettings,
} from '@/types'
import { filterEntries } from '@/features/financeiro/lib/financeiroCalc'
import { valoresDoContrato, resumoFaturamento } from '@/features/torre-de-controle/utils/obraMedicao'
import { generateMonthPayroll } from '@/features/mao-de-obra/utils/payrollEngine'

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Primeiro e último dia de um mês `yyyy-MM`, em `yyyy-MM-dd`.
 *
 * ⚠️ **Valida a entrada, e isso não é zelo excessivo.** O período vem de um `<input type="month">`,
 * que no Firefox e no Safari de desktop é uma caixa de texto comum — e o valor é persistido. Com
 * `'2026'`, a versão anterior devolvia `ate: '2026-NaN'`; como `filterEntries` compara STRING,
 * `'2026-03-15' <= '2026-NaN'` é verdadeiro e **o ano inteiro** de lançamentos entrava na soma de
 * um mês. Período inválido devolve uma janela vazia: melhor zero do que doze meses somados.
 */
export function limitesDoMes(period: string): { de: string; ate: string } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period ?? '')
  if (!m) return { de: '', ate: '' }
  const ano = Number(m[1]), mes = Number(m[2])
  // Dia 0 do mês seguinte = último dia deste. Cobre fevereiro e ano bissexto sem tabela.
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return { de: `${period}-01`, ate: `${period}-${String(ultimo).padStart(2, '0')}` }
}

export interface SaidaPorCategoria {
  categoria: string
  valorBRL: number
  lancamentos: number
}

export interface RetratoDaObra {
  obraId: string
  obraNome: string
  period: string

  // ── Contrato (fonte: Torre de Controle) ────────────────────────────────────
  /** Valor de serviço do contrato. O material é faturado à parte e não entra no saldo. */
  contratoServicoBRL: number
  contratoMaterialBRL: number
  /** Quanto já foi faturado, somando serviço e material. */
  faturadoBRL: number
  /**
   * Só a parte de SERVIÇO do faturado.
   *
   * É esta que fecha a conta com o saldo: `contratoServicoBRL − faturadoServicoBRL =
   * saldoServicoBRL`. Mostrar o faturado total ao lado do saldo de serviço fazia o leitor tentar
   * subtrair e achar R$ 200 mil de diferença — a regra da carteira BSB é que o material é faturado
   * à parte, e a tela precisa exibir as duas parcelas para isso ficar visível.
   */
  faturadoServicoBRL: number
  faturadoMaterialBRL: number
  /** `contratoServicoBRL − faturado de serviço`. */
  saldoServicoBRL: number
  temContrato: boolean

  // ── Financeiro (fonte: lançamentos de entrada/saída da obra no mês) ─────────
  //
  // ⚠️ É o que está LANÇADO, não necessariamente o que saiu do banco. O Financeiro aceita
  // lançamento previsto: a Execução do Planejamento posta "Mão de obra estimada" com categoria
  // `mao_de_obra` (`ExecucaoPanel.tsx:245`). Chamar isto de "saiu do caixa" na tela seria vender
  // estimativa como medição — exatamente o que este módulo acabou de parar de fazer.
  saidasBRL: number
  entradasBRL: number
  saidasPorCategoria: SaidaPorCategoria[]
  /** A fatia da saída categorizada como mão de obra — de TODAS as origens. */
  saidaMaoDeObraBRL: number
  /**
   * Só o que a ponte RDO→Financeiro lançou (`sourceRdoId` preenchido).
   *
   * ⚠️ É esta, e não a categoria inteira, que se compara com a folha. A categoria `mao_de_obra`
   * tem **pelo menos cinco** produtores independentes do mesmo custo: a ponte do RDO, a Execução
   * do Planejamento ("Bonificação" e "Mão de obra estimada"), a baixa de título de folha, a
   * distribuição do EVM e o lançamento manual. Comparar a folha contra a soma de todos acusaria
   * um rombo permanente que é, na verdade, o mesmo trabalho lançado várias vezes.
   */
  saidaMaoDeObraRdoBRL: number
  /** O resto da categoria: plano, baixa de título, distribuição, manual. Não entra na conferência. */
  saidaMaoDeObraOutrasBRL: number

  // ── Mão de obra (fonte: apontamentos + turnos, com encargos) ───────────────
  /** Custo do empregador no mês: bruto + FGTS + INSS patronal, de quem está na folha da obra. */
  folhaDaObraBRL: number
  folhaHeadcount: number
  /**
   * `folhaDaObraBRL − saidaMaoDeObraRdoBRL`.
   *
   * Não é economia: é **conferência entre duas contagens do mesmo trabalho**. A folha vem dos
   * turnos da Escala (`hourlyRate × horas`, mais encargos); a ponte do RDO soma `custoDiaWorker`
   * de quem esteve presente (`grossSalary` com encargos ÷ 22, ou `hourlyRate × 8` sem encargo
   * nenhum quando não há salário bruto cadastrado).
   *
   * ⚠️ **As duas bases nem sempre são comparáveis**, e é por isso que a tela nunca chama a
   * diferença de erro: são dois caminhos com fórmulas diferentes. A diferença serve para PROCURAR
   * — turno sem RDO, RDO sem turno, cadastro sem salário bruto — não para concluir.
   *
   * Positivo = a folha é maior do que o que o RDO lançou. Negativo = o inverso.
   */
  diferencaFolhaCaixaBRL: number

  /** Alguma das três fontes tem dado neste mês? Se nenhuma tem, a tela não deve fingir retrato. */
  temDados: boolean
}

/**
 * Monta o retrato.
 *
 * `workers` e `shifts` devem chegar **já recortados para a obra** — o recorte tem regra própria
 * (quem não tem obra é "geral" e entra em todas) e mora em `useObraScopedLabor`, que é hook e não
 * pode ser chamado aqui.
 */
export function retratoDaObra(params: {
  site: ConstructionSite
  period: string
  entries: FinanceiroEntry[]
  workers: Worker[]
  shifts: Shift[]
  cltSettings: CLTSettings
  /** `yyyy-MM-dd`; separa nota vencida de nota a vencer no resumo do contrato. */
  hoje: string
}): RetratoDaObra {
  const { site, period, entries, workers, shifts, cltSettings, hoje } = params
  const { de, ate } = limitesDoMes(period)
  // Janela vazia = período inválido. `filterEntries` com `from: ''` não filtraria nada (string
  // vazia é falsy lá dentro), então o corte precisa ser aqui.
  const periodoValido = de !== ''

  // ── Contrato ───────────────────────────────────────────────────────────────
  const valores = valoresDoContrato(site.contrato)
  const faturamento = resumoFaturamento(site.contrato, hoje)
  const temContrato = valores.total > 0

  // ── Financeiro: só o que tem ESTA obra. Lançamento sem obra não é rateado ──
  // aqui: ratear despesa administrativa entre obras é uma decisão de negócio que ninguém tomou, e
  // inventá-la mudaria o custo de cada obra sem ninguém pedir.
  const doMes = periodoValido ? filterEntries(entries, { from: de, to: ate, obraId: site.id }) : []
  const saidas = doMes.filter((e) => e.tipo === 'saida')
  const entradas = doMes.filter((e) => e.tipo === 'entrada')

  const porCategoria = new Map<string, { valorBRL: number; lancamentos: number }>()
  for (const e of saidas) {
    const atual = porCategoria.get(e.categoria) ?? { valorBRL: 0, lancamentos: 0 }
    porCategoria.set(e.categoria, { valorBRL: atual.valorBRL + e.valor, lancamentos: atual.lancamentos + 1 })
  }
  const saidasPorCategoria = [...porCategoria]
    .map(([categoria, v]) => ({ categoria, valorBRL: r2(v.valorBRL), lancamentos: v.lancamentos }))
    .sort((a, b) => b.valorBRL - a.valorBRL)

  const saidasBRL = r2(saidas.reduce((s, e) => s + e.valor, 0))
  const entradasBRL = r2(entradas.reduce((s, e) => s + e.valor, 0))
  const maoDeObra = saidas.filter((e) => e.categoria === 'mao_de_obra')
  const saidaMaoDeObraBRL = r2(maoDeObra.reduce((s, e) => s + e.valor, 0))
  // `sourceRdoId` é o que a ponte carimba. Sem este recorte, a conferência somava plano, baixa de
  // título e distribuição do EVM ao mesmo custo, e acusava rombo onde havia repetição.
  const saidaMaoDeObraRdoBRL = r2(maoDeObra.filter((e) => e.sourceRdoId).reduce((s, e) => s + e.valor, 0))

  // ── Mão de obra: o custo do empregador, que é o que a obra realmente paga ──
  // `generateMonthPayroll` filtra o mês por dentro e corta quem não está `active`.
  const folha = periodoValido
    ? generateMonthPayroll(workers, shifts, cltSettings, period)
    : { totalEmployerCost: 0, headcount: 0 }
  const folhaDaObraBRL = r2(folha.totalEmployerCost)

  return {
    obraId: site.id,
    obraNome: site.name,
    period,

    contratoServicoBRL: r2(valores.servico),
    contratoMaterialBRL: r2(valores.material),
    faturadoBRL: r2(faturamento.faturado),
    faturadoServicoBRL: r2(faturamento.faturadoServico),
    faturadoMaterialBRL: r2(faturamento.faturadoMaterial),
    saldoServicoBRL: r2(faturamento.saldo),
    temContrato,

    saidasBRL,
    entradasBRL,
    saidasPorCategoria,
    saidaMaoDeObraBRL,
    saidaMaoDeObraRdoBRL,
    saidaMaoDeObraOutrasBRL: r2(saidaMaoDeObraBRL - saidaMaoDeObraRdoBRL),

    folhaDaObraBRL,
    folhaHeadcount: folha.headcount,
    diferencaFolhaCaixaBRL: r2(folhaDaObraBRL - saidaMaoDeObraRdoBRL),

    temDados: temContrato || doMes.length > 0 || folhaDaObraBRL > 0,
  }
}
