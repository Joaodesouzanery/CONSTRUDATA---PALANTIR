/**
 * Monta o `FinanceiroEntry` de uma baixa de título — pura, sem zustand/persist/auth, para poder
 * ser testada direto. Reaproveitada tanto pela baixa manual (`financeiroTitulosStore.baixarTitulo`)
 * quanto pelo reparo automático de título que nasceu `pago` sem lançamento — ex.: uma nota do
 * extrato de faturamento marcada "Recebido" (ver `faturamentoParaFinanceiro.ts`).
 */
import { seededId } from '@/lib/seededId'
import type { EntradaCategoria, FinanceiroEntry, FinanceiroTitulo, SaidaCategoria } from '@/types'

/** Categoria default do lançamento gerado na baixa, por tipo. */
export function baixaCategoria(t: FinanceiroTitulo): EntradaCategoria | SaidaCategoria {
  if (t.categoria) return t.categoria
  return t.tipo === 'receber' ? 'medicao' : 'outro'
}

export function criarEntryDaBaixa(t: FinanceiroTitulo, orgId: string, dataPagamento: string): FinanceiroEntry {
  return {
    // Id DERIVADO do título, não sorteado. Com `crypto.randomUUID()`, dar baixa no mesmo título em
    // dois dispositivos criava DOIS lançamentos no Fluxo/DRE — e como o payload do título é
    // último-a-escrever-vence, só um `entryId` sobrevivia: o outro virava fantasma somando para
    // sempre, sem forma de removê-lo pela interface. Derivado, os dois lados chegam ao mesmo id.
    id: seededId(orgId, 'baixa-titulo', t.id),
    tipo: t.tipo === 'pagar' ? 'saida' : 'entrada',
    descricao: t.descricao,
    valor: t.valor,
    data: dataPagamento,
    categoria: baixaCategoria(t),
    referencia: t.numeroDoc,
    obraId: t.obraId,
    // Vínculo explícito com o título de origem: sem ele um lançamento órfão é irrastreável.
    sourceTituloId: t.id,
    createdAt: new Date().toISOString(),
  }
}
