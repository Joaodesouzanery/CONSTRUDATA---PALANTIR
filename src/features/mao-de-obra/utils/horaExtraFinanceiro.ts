/**
 * horaExtraFinanceiro.ts — a ponte "marquei Pago" → despesa no Controle de Caixa.
 *
 * ─── A REGRA, QUE JÁ ERA DO PROJETO ANTES DESTE ARQUIVO ───────────────────────
 * **Só hora extra PAGA vira despesa.** Enquanto está só lançada na grade, é previsão: a empresa
 * ainda não desembolsou, e jogar tudo no caixa faria a despesa aparecer antes de existir, deixando
 * o saldo do mês pior do que é. A regra está escrita em `controleDeCaixaImport.ts` desde a
 * importação de planilha; aqui ela vale igual para o lançamento nativo.
 *
 * O gesto é explícito (alguém clica em "Pago"), o que coloca isto do lado permitido da regra
 * "custo automático só pelo RDO, o resto é botão" — mesmo formato da baixa de título.
 *
 * ⚠️ O id do lançamento é DERIVADO da hora extra. É ele que torna marcar/desmarcar idempotente:
 * marcar duas vezes regrava a mesma linha em vez de criar duas, e desmarcar sabe exatamente qual
 * remover. Mesma lição da ARMADILHA #5 (`docs/ARMADILHAS_CONHECIDAS.md`): a guarda é o
 * lançamento existir, nunca o status dizer que existe.
 */
import { seededId } from '@/lib/seededId'
import type { FinanceiroEntry, HoraExtra } from '@/types'

export function idDoLancamentoDaHoraExtra(orgId: string | null | undefined, heId: string): string {
  return seededId(orgId, 'mao-obra-hora-extra', heId)
}

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Descrição que permite achar a origem sem abrir o sistema — é o que o caixa lê no extrato. */
export function descricaoDaHoraExtra(he: HoraExtra): string {
  if (he.tipo === 'ponto-saida') {
    const dias = he.detalhe?.diasTexto?.trim() || dataBR(he.data)
    return `Ponto saída — devolução + HE — ${he.workerNome} (${dias})`
  }
  return `Hora extra — ${he.workerNome} (${dataBR(he.data)})`
}

/**
 * O lançamento de despesa de uma hora extra paga.
 *
 * Uma linha por pessoa por dia — é o que a importação de planilha já faz, e é o que mantém o
 * relatório "por solicitante"/por pessoa possível no Financeiro. A grade agrupa na tela; o extrato
 * guarda o detalhe.
 */
export function lancamentoDaHoraExtra(
  he: HoraExtra,
  orgId: string | null | undefined,
  opcoes: { agora: string; pagoEm?: string },
): FinanceiroEntry {
  return {
    id: idDoLancamentoDaHoraExtra(orgId, he.id),
    tipo: 'saida',
    descricao: descricaoDaHoraExtra(he),
    valor: he.valor,
    // A data do lançamento é a do PAGAMENTO, não a do trabalho: é quando o dinheiro saiu, e é
    // isso que o fluxo de caixa e a DRE do mês precisam enxergar.
    data: opcoes.pagoEm ?? he.pagoEm ?? he.data,
    categoria: 'mao_de_obra',
    subcategoria: 'horas_extras',
    obraId: he.obraId,
    origem: 'horas-extras',
    funcionarioNome: he.workerNome,
    cargo: he.cargo,
    createdAt: opcoes.agora,
  }
}
