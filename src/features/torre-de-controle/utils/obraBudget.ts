/**
 * obraBudget — orçamento (BAC) por obra a partir dos budgetLines da Torre de Controle.
 * Fonte única do orçamento da obra: o Planejamento lê daqui (Torre → Frente → Atividade).
 */
import type { ConstructionSite, ConstructionBudgetLine } from '@/types'

/** BAC (orçamento total) de uma obra: usa a linha 'Total' se existir, senão a soma das linhas. */
export function obraBacFromSite(site?: ConstructionSite | null): number {
  const lines = site?.budgetLines ?? []
  if (!lines.length) return 0
  const total = lines.find((l) => /total/i.test(l.label))
  return total ? (total.amount || 0) : lines.reduce((s, l) => s + (l.amount || 0), 0)
}

/** Atualiza (ou cria) a linha 'Total' do orçamento, preservando as demais categorias. */
export function withTotalBudgetLine(lines: ConstructionBudgetLine[] | undefined, amount: number): ConstructionBudgetLine[] {
  const rest = (lines ?? []).filter((l) => !/total/i.test(l.label))
  return [{ label: 'Total', amount, projected: amount }, ...rest]
}
