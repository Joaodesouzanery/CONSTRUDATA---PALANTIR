/**
 * obraMedicao — cálculo do "Controle de Medição" por serviço do contrato de uma obra.
 * Compartilhado entre a Torre (ObraDetailPanel) e o RDO Compizzo (RdoDetalhe).
 *
 * Medido de um serviço = Σ das quantidades produzidas nos RDOs Compizzo FINALIZADOS dessa obra
 * vinculadas ao serviço (RdoCompizzoProducaoRow.contractServiceId) — a integração "camada única"
 * (o RDO alimenta a medição sozinho) — OU o override manual (qtdMedidaOverride) quando preenchido.
 */
import type { RDO, ObraContratoServico } from '@/types'
import { parseLocaleNumber } from '@/lib/numberFormat'

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
