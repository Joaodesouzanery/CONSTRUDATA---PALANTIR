/**
 * obraMedicao — cálculo do "Controle de Medição" por serviço do contrato de uma obra.
 * Compartilhado entre a Torre (ObraDetailPanel) e o RDO Compizzo (RdoDetalhe).
 *
 * Medido de um serviço = Σ das quantidades produzidas nos RDOs Compizzo FINALIZADOS dessa obra
 * vinculadas ao serviço (RdoCompizzoProducaoRow.contractServiceId) — a integração "camada única"
 * (o RDO alimenta a medição sozinho) — OU o override manual (qtdMedidaOverride) quando preenchido.
 */
import type { RDO, ObraContratoServico, ObraContrato, ObraFaturamento } from '@/types'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { classificarUnidade, somarMetragem, type Metragem } from '@/lib/unidadesMedida'

/** Mapa contractServiceId → quantidade medida (auto) somada dos RDOs finalizados da obra. */
export function medidoAutoPorServico(rdos: RDO[], siteId: string | null | undefined): Map<string, number> {
  const m = new Map<string, number>()
  if (!siteId) return m
  for (const rdo of rdos) {
    if ((rdo.siteId ?? null) !== siteId) continue
    if (rdo.template !== 'compizzo' || !rdo.compizzo) continue
    if (rdo.status === 'rascunho') continue   // só finalizados (isRdoFinalized)
    for (const p of rdo.compizzo.producao ?? []) {
      if (!p.contractServiceId) continue
      const q = parseLocaleNumber(p.quantidade)
      if (q > 0) m.set(p.contractServiceId, (m.get(p.contractServiceId) ?? 0) + q)
    }
  }
  return m
}

/** Preço efetivo = preço cheio × (% aplicado / 100). % ausente = 100%. */
export function precoEfetivo(svc: ObraContratoServico): number {
  return (svc.valorUnitario || 0) * ((svc.pctAplicado ?? 100) / 100)
}

/** Qtd medida do serviço: override manual quando preenchido, senão o auto dos RDOs. */
export function qtdMedida(svc: ObraContratoServico, medidoAuto: Map<string, number>): number {
  return svc.qtdMedidaOverride != null ? svc.qtdMedidaOverride : (medidoAuto.get(svc.id) ?? 0)
}

/** Saldo (em unidade) = contratada − medido anterior − medido. */
export function saldoQtd(svc: ObraContratoServico, medido: number): number {
  return (svc.qtdContrato || 0) - (svc.qtdAnterior ?? 0) - medido
}

export interface ServicoMedicaoCalc {
  medido:        number
  precoEfetivo:  number
  saldo:         number   // em unidade
  valorBruto:    number   // medido × preço efetivo
  valorSaldo:    number   // saldo × preço efetivo
  valorContrato: number   // qtdContrato × preço efetivo
}

/** Consolida os computados de um serviço para exibição na tabela de Controle de Medição. */
export function calcServico(svc: ObraContratoServico, medidoAuto: Map<string, number>): ServicoMedicaoCalc {
  const pe = precoEfetivo(svc)
  const medido = qtdMedida(svc, medidoAuto)
  const saldo = saldoQtd(svc, medido)
  return {
    medido,
    precoEfetivo: pe,
    saldo,
    valorBruto: medido * pe,
    valorSaldo: saldo * pe,
    valorContrato: (svc.qtdContrato || 0) * pe,
  }
}

/**
 * Serviço de valor fechado — "verba", sem metragem.
 *
 * O contrato real do cliente tem uma linha de "Faturamento direto" de R$ 607.620,00 que é **50,6%
 * do contrato** e não tem quantidade nenhuma. O modelo só sabia quantidade × preço, então ela só
 * entraria como `qtd 1 × R$ 607.620` — e a tela pediria "Qtd contratada" para algo que não tem.
 *
 * A convenção é a unidade `vb`: quantidade fixa em 1, e o formulário esconde o campo.
 *
 * A definição mora em `@/lib/unidadesMedida`, junto com a de área e comprimento — é lá que se
 * decide o que é cada unidade, para não haver duas respostas para a mesma pergunta.
 */
export { UNIDADE_VERBA, ehVerba } from '@/lib/unidadesMedida'

/**
 * Metragem contratada da obra, **separada por unidade**.
 *
 * É o que passa a alimentar o campo "Área / Extensão": em vez de um número digitado à mão, sem
 * relação nenhuma com o contrato, a soma do que foi de fato contratado. No contrato real dá
 * 18.605,01 m² + 6.962,01 m — duas parcelas, porque somá-las daria 25.567,02, um número que
 * mistura metro quadrado com metro linear e que ninguém consegue conferir.
 *
 * Linhas de verba não entram: elas não têm metragem.
 */
export function metragemContratada(services: ObraContratoServico[]): Metragem {
  return somarMetragem(services.map((s) => ({ unidade: s.unidade, quantidade: s.qtdContrato || 0 })))
}

/** Metragem que ainda falta executar, por unidade — o outro lado da metragem contratada. */
export function metragemSaldo(services: ObraContratoServico[], medidoAuto: Map<string, number>): Metragem {
  return somarMetragem(services.map((s) => ({
    unidade: s.unidade,
    quantidade: Math.max(0, saldoQtd(s, qtdMedida(s, medidoAuto))),
  })))
}

/**
 * Preço médio por m² da obra — e por que ele não substitui o preço de cada serviço.
 *
 * `ConstructionSite.precoM2` guarda UM valor. O contrato real tem quatro preços diferentes
 * (R$ 28,94 · R$ 27,65 · R$ 8,75 · R$ 28,70); a média ponderada da área dá R$ 28,5638/m², que não
 * é nenhum deles. Serve para exibir uma referência e para precificar linha de RDO que não esteja
 * vinculada a serviço nenhum — nunca para substituir `precoEfetivo(servico)`.
 *
 * Só considera os serviços em m²: incluir os de metro linear dividiria reais por uma soma de
 * unidades diferentes.
 */
export function precoMedioM2(services: ObraContratoServico[]): number | null {
  let valor = 0, area = 0
  for (const s of services) {
    if (classificarUnidade(s.unidade) !== 'area') continue
    const q = s.qtdContrato || 0
    valor += q * precoEfetivo(s)
    area  += q
  }
  return area > 0 ? valor / area : null
}

export interface TotaisContrato {
  valorContrato:  number   // Σ qtdContrato × preço efetivo
  medidoBruto:    number   // Σ medido × preço efetivo
  saldo:          number   // Σ saldo × preço efetivo (em R$)
  descontoNfPct:  number   // % de desconto de NF de materiais aplicado
  descontoNf:     number   // medidoBruto × (descontoNfPct/100)
  medidoLiquido:  number   // medidoBruto − descontoNf
}

/**
 * Totais do Controle de Medição da obra. O desconto de NF de materiais (%) abate do medido
 * bruto → medido líquido (valor efetivamente faturado). Ausente/0 = líquido == bruto.
 */
export function totaisContrato(
  services: ObraContratoServico[],
  medidoAuto: Map<string, number>,
  descontoNfPctRaw?: number,
): TotaisContrato {
  const acc = services.reduce(
    (a, s) => {
      const c = calcServico(s, medidoAuto)
      return { valorContrato: a.valorContrato + c.valorContrato, medidoBruto: a.medidoBruto + c.valorBruto, saldo: a.saldo + c.valorSaldo }
    },
    { valorContrato: 0, medidoBruto: 0, saldo: 0 },
  )
  const pct = Number.isFinite(descontoNfPctRaw) ? Math.max(0, descontoNfPctRaw as number) : 0
  const descontoNf = acc.medidoBruto * (pct / 100)
  return { ...acc, descontoNfPct: pct, descontoNf, medidoLiquido: acc.medidoBruto - descontoNf }
}

export interface ConferenciaDoTotal {
  declarado: number
  somado: number
  /** `somado − declarado`. Positivo = os itens somam mais do que o contrato diz. */
  diferenca: number
  /** Diferença em relação ao declarado, em %. */
  percentual: number
  /** Diferença desprezível — cabe em arredondamento de preço unitário. */
  arredondamento: boolean
}

/**
 * O total digitado no contrato bate com a soma dos serviços?
 *
 * `ObraContrato.valorTotal` era gravado, exportado no .xlsx e **nunca comparado** com nada. No
 * contrato real do cliente a diferença existe e é pequena: o documento declara R$ 1.199.944,15, a
 * soma dos itens dá R$ 1.199.967,68 — R$ 23,53, arredondamento nos preços unitários. Irrelevante
 * ali; num contrato com um preço digitado errado, é exatamente o que pega.
 *
 * O limiar de "arredondamento" é 0,1% ou R$ 100, o que for maior: acima disso não é dízima, é erro
 * de digitação ou serviço faltando, e a tela precisa dizer.
 */
export function conferirTotal(declaradoRaw: number | undefined, somado: number): ConferenciaDoTotal | null {
  const declarado = Number(declaradoRaw) || 0
  if (declarado <= 0) return null   // sem total declarado não há o que conferir
  const diferenca = somado - declarado
  const tolerancia = Math.max(100, declarado * 0.001)
  return {
    declarado,
    somado,
    diferenca,
    percentual: (diferenca / declarado) * 100,
    arredondamento: Math.abs(diferenca) <= tolerancia,
  }
}

// ─── Carteira: SERVIÇO × MATERIAL e o extrato de faturamento ──────────────────
//
// Modelado a partir da planilha "Obras em Andamento - BSB", que o cliente mantém à mão. Cada obra
// tem DOIS valores de contrato (serviço e material), um extrato de notas, e um saldo que considera
// só o serviço. A conta da planilha fecha nos quatro blocos, no total e na retenção — os números
// estão nos testes.

export interface ValoresDoContrato {
  servico:  number
  material: number
  /** Serviço + material. É o valor cheio da obra, e o que a lista de obras exibe. */
  total:    number
}

/**
 * Os dois valores do contrato, com a compatibilidade do campo antigo.
 *
 * `valorTotal` guardava um número só. Obra cadastrada antes desta mudança continua funcionando:
 * o valor antigo é lido como SERVIÇO, que é o que ele sempre representou na prática (o saldo era
 * calculado contra ele). Material vazio = 0, não "desconhecido" — a soma continua correta.
 */
export function valoresDoContrato(contrato?: ObraContrato | null): ValoresDoContrato {
  const servico  = Number(contrato?.valorServico ?? contrato?.valorTotal ?? 0) || 0
  const material = Number(contrato?.valorMaterial ?? 0) || 0
  return { servico, material, total: servico + material }
}

export interface ResumoFaturamento {
  /** Σ de todas as notas do extrato. */
  faturado:   number
  /** Σ das notas já recebidas. */
  recebido:   number
  /** Σ das notas emitidas e ainda não recebidas. */
  aReceber:   number
  /** Σ da retenção técnica/contratual de todas as notas. */
  retencao:   number
  /** Valor da linha marcada como entrada (a primeira parcela). `null` quando não há. */
  entrada:    number | null
  /**
   * `valorServico − faturado`.
   *
   * O MATERIAL não entra: na planilha do cliente ele é faturado à parte e o saldo acompanhado é
   * o do serviço. Conferido nos quatro blocos — ex.: SUPERA 592.324,14 − 138.558,20 = 453.765,94.
   */
  saldo:      number
  /** Notas vencidas: previstas para antes de hoje e ainda não recebidas. */
  vencidas:   ObraFaturamento[]
}

export function resumoFaturamento(
  contrato: ObraContrato | null | undefined,
  hojeISO: string,
): ResumoFaturamento {
  const notas = contrato?.faturamentos ?? []
  const { servico } = valoresDoContrato(contrato)

  let faturado = 0, recebido = 0, aReceber = 0, retencao = 0
  let entrada: number | null = null
  const vencidas: ObraFaturamento[] = []

  for (const n of notas) {
    const v = Number(n.valor) || 0
    faturado += v
    retencao += Number(n.retencaoTecnica) || 0
    if (n.situacao === 'recebido') recebido += v
    else {
      aReceber += v
      // Comparação de string ISO — 'yyyy-mm-dd' ordena lexicograficamente igual à data.
      if (n.previsaoRecebimento && n.previsaoRecebimento < hojeISO) vencidas.push(n)
    }
    if (n.entrada && entrada == null) entrada = v
  }

  return { faturado, recebido, aReceber, retencao, entrada, saldo: servico - faturado, vencidas }
}

export interface LinhaCarteira {
  siteId:   string
  nome:     string
  servico:  number
  material: number
  faturado: number
  saldo:    number
  retencao: number
  aReceber: number
}

export interface TotaisCarteira {
  servico:  number
  material: number
  faturado: number
  /** O "Valor Serviço Restante" do rodapé da planilha. */
  saldo:    number
  /** A "Retenção Técnica / Contratual" do rodapé. */
  retencao: number
  aReceber: number
}

/** Rodapé da carteira — os mesmos totais que o cliente fecha à mão hoje. */
export function totaisCarteira(linhas: LinhaCarteira[]): TotaisCarteira {
  return linhas.reduce<TotaisCarteira>(
    (a, l) => ({
      servico:  a.servico  + l.servico,
      material: a.material + l.material,
      faturado: a.faturado + l.faturado,
      saldo:    a.saldo    + l.saldo,
      retencao: a.retencao + l.retencao,
      aReceber: a.aReceber + l.aReceber,
    }),
    { servico: 0, material: 0, faturado: 0, saldo: 0, retencao: 0, aReceber: 0 },
  )
}
