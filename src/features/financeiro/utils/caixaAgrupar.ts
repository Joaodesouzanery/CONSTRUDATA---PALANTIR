/**
 * O que é "do Controle de Caixa", e como se agrupa.
 *
 * Extraído de `ControleDeCaixaPanel` porque o Projetado × Realizado e os indicadores precisam da
 * MESMA régua — dois lugares decidindo "o que entra no caixa" de jeitos diferentes seria a fonte
 * clássica de dois totais para a mesma pergunta.
 */
import type { FinanceiroEntry } from '@/types'

/**
 * Só o que passou pelo Controle de Caixa.
 *
 * ⚠️ Isto exclui, de propósito, o que o RDO Compizzo lança (`sourceRdoId`), a baixa de título
 * (`sourceTituloId`) e a nota (`sourceNotaId`): são outras telas, com outras fontes. Somar tudo
 * contaria a mesma folha duas vezes — uma pelo RDO, outra pela planilha.
 */
export function ehDoCaixa(e: FinanceiroEntry): boolean {
  return e.origem === 'planilha' || e.origem === 'manual' || e.origem === 'horas-extras'
}

export interface GrupoCaixa { chave: string; receitas: number; despesas: number; n: number }

/** Agrupa por uma (ou mais) chaves. Ordenado do maior volume para o menor. */
export function agruparCaixa(entries: FinanceiroEntry[], chave: (e: FinanceiroEntry) => string[]): GrupoCaixa[] {
  const m = new Map<string, GrupoCaixa>()
  for (const e of entries) {
    for (const k of chave(e)) {
      const v = m.get(k) ?? { chave: k, receitas: 0, despesas: 0, n: 0 }
      if (e.tipo === 'entrada') v.receitas += e.valor; else v.despesas += e.valor
      v.n++
      m.set(k, v)
    }
  }
  return [...m.values()].sort((a, b) => (b.despesas + b.receitas) - (a.despesas + a.receitas))
}
