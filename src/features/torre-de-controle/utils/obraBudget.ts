/**
 * obraBudget — o valor (BAC) de uma obra. Fonte única, consumida pelo Planejamento e pelo EVM.
 *
 * ─── O problema que isto resolve ───────────────────────────────────────────────
 * Havia TRÊS campos guardando "o valor da obra", cadastrados em telas diferentes e lidos por
 * módulos diferentes, sem nenhum aviso quando divergiam:
 *
 *   - `contrato.valorServico` + `valorMaterial` — em "Contrato & Medição"
 *   - `budgetLines['Total']`                    — no painel de detalhe da obra
 *   - `orcamentoBRL`                            — no diálogo de cadastro
 *
 * Dava para ter os três preenchidos com números diferentes e ninguém saber qual valia. Agora o
 * **contrato manda**: quando ele tem valor, é ele que responde. Os outros dois continuam existindo
 * como recurso para obra sem contrato cadastrado — nada quebra.
 */
import type { ConstructionSite, ConstructionBudgetLine } from '@/types'
import { valoresDoContrato } from './obraMedicao'

/**
 * BAC (valor total) de uma obra, na ordem de confiança: contrato → linha 'Total' → soma das
 * linhas → orçamento do cadastro.
 *
 * O contrato entra pelo valor CHEIO (serviço + material), que é o que a obra vale. O saldo
 * acompanhado é só o do serviço — mas isso é conta de faturamento, não de orçamento.
 */
export function obraBacFromSite(site?: ConstructionSite | null): number {
  const doContrato = valoresDoContrato(site?.contrato).total
  if (doContrato > 0) return doContrato

  const lines = site?.budgetLines ?? []
  if (lines.length) {
    const total = lines.find((l) => ehLinhaTotal(l.label))
    return total ? (total.amount || 0) : lines.reduce((s, l) => s + (l.amount || 0), 0)
  }
  return Number(site?.orcamentoBRL) || 0
}

/**
 * A linha 'Total' do orçamento — casando o rótulo INTEIRO, não um `/total/i` solto.
 *
 * Com o teste antigo, uma linha "Total de materiais" seria confundida com o total geral e
 * sequestraria o BAC da obra: o Planejamento passaria a planejar contra o valor do material.
 */
function ehLinhaTotal(label: string): boolean {
  return /^\s*total\s*(geral)?\s*$/i.test(label ?? '')
}

/** Atualiza (ou cria) a linha 'Total' do orçamento, preservando as demais categorias. */
export function withTotalBudgetLine(lines: ConstructionBudgetLine[] | undefined, amount: number): ConstructionBudgetLine[] {
  const rest = (lines ?? []).filter((l) => !ehLinhaTotal(l.label))
  return [{ label: 'Total', amount, projected: amount }, ...rest]
}

/** `true` quando o valor vem do contrato — a tela usa isto para não oferecer edição em duplicata. */
export function bacVemDoContrato(site?: ConstructionSite | null): boolean {
  return valoresDoContrato(site?.contrato).total > 0
}
