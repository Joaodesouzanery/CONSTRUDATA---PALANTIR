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
    if (total) return total.amount || 0
    // Sem linha 'Total': soma as categorias, mas NUNCA uma linha derivada (Saldo/Resultado) —
    // ela já é a diferença de outras linhas, e somá-la junto conta o mesmo dinheiro duas vezes.
    // Foi assim que uma obra com "Faturamento previsto" + "Despesas previstas" + "Saldo líquido
    // de referência" (sem linha Total) virou um BAC de R$ 667 mil sem sentido nenhum.
    return lines.reduce((s, l) => (ehLinhaDerivada(l.label) ? s : s + (l.amount || 0)), 0)
  }
  return Number(site?.orcamentoBRL) || 0
}

/**
 * A linha 'Total' do orçamento — casando o rótulo INTEIRO, não um `/total/i` solto.
 *
 * Com o teste antigo, uma linha "Total de materiais" seria confundida com o total geral e
 * sequestraria o BAC da obra: o Planejamento passaria a planejar contra o valor do material.
 */
export function ehLinhaTotal(label: string): boolean {
  return /^\s*total\s*(geral)?\s*$/i.test(label ?? '')
}

/**
 * Linha cujo valor É a diferença/consequência de outras linhas (Saldo, Resultado, Lucro,
 * Margem) — não uma categoria de custo/receita a somar. Some-a junto com as que a compõem e o
 * total dobra a conta.
 */
export function ehLinhaDerivada(label: string): boolean {
  return /saldo|resultado|lucro|margem/i.test(label ?? '')
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

/**
 * A VIGÊNCIA da obra — de quando até quando olhar.
 *
 * ─── POR QUE ESTA FUNÇÃO EXISTE ───────────────────────────────────────────────
 * O Financeiro somava entradas e saídas sem janela nenhuma: uma medição de janeiro contra despesas
 * de agosto, e o resultado parecia bom. Fechar a janela no mês corrente resolve o caso comum, mas
 * não o que o dono descreveu com todas as letras: *"chegou um contrato de X até Y — as saídas
 * nesse período que serão olhadas"*.
 *
 * Para isso é preciso saber X e Y, e havia **três** lugares onde eles poderiam estar, com um
 * problema cada: o contrato não tinha datas; `periodoReferencia` é texto livre que ninguém parseia;
 * e a obra tem `startDate`/`expectedEnd`, que o Financeiro nunca leu.
 *
 * A ordem de confiança aqui é a mesma do `obraBacFromSite`: **o contrato manda**, e a obra é o
 * recurso. Assim, quem preencher a vigência no contrato passa a ter a janela exata; quem não
 * preencher continua tendo a aproximação do cadastro, em vez de nada.
 */
export interface VigenciaDaObra {
  de: string
  ate: string
  /** De onde vieram as datas — vai para a tela, para ninguém confundir exato com aproximado. */
  origem: 'contrato' | 'obra'
}

const ehData = (v?: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function vigenciaDaObra(site?: ConstructionSite | null): VigenciaDaObra | null {
  const c = site?.contrato
  if (ehData(c?.vigenciaInicio) && ehData(c?.vigenciaFim) && c!.vigenciaInicio! <= c!.vigenciaFim!) {
    return { de: c!.vigenciaInicio!, ate: c!.vigenciaFim!, origem: 'contrato' }
  }
  // ⚠️ Recurso, não equivalente: a data da obra é quando o canteiro abre e fecha, que nem sempre é
  // a vigência do contrato. A tela precisa dizer qual das duas está usando.
  if (ehData(site?.startDate) && ehData(site?.expectedEnd) && site!.startDate <= site!.expectedEnd) {
    return { de: site!.startDate, ate: site!.expectedEnd, origem: 'obra' }
  }
  return null
}
