/**
 * rdoEstoqueMovimentos — leitura SOMENTE-LEITURA das baixas de estoque que um RDO
 * finalizado gerou no servidor. O trigger `trg_rdo_to_estoque` insere movimentações
 * em `suprimentos_estoque_movimentacoes` com `rdo_id` + `origem='rdo'`, mas o cliente
 * (suprimentosStore) NÃO espelha esse vínculo — por isso a prova real exige consultar
 * a tabela diretamente por `rdo_id`. Usado pelo "Status de Integração" do RDO.
 * Nunca escreve; RLS por organização já se aplica (mesma tabela que o pull() lê).
 */
import { supabase } from '@/lib/supabase'

export interface RdoEstoqueMov {
  id:            string
  itemId:        string
  quantidade:    number
  observacoes:   string | null
  dataMovimento: string | null
  /** id do material no payload do RDO (origem_ref) — liga a movimentação à linha. */
  origemRef:     string | null
}

/**
 * Movimentações de saída ativas geradas por este RDO. `throw` em erro de rede/RLS
 * (o chamador decide o fallback "previsto (offline)"). Array vazio = RDO sem baixa.
 */
export async function fetchRdoEstoqueMovimentos(rdoId: string): Promise<RdoEstoqueMov[]> {
  const { data, error } = await supabase
    .from('suprimentos_estoque_movimentacoes')
    .select('id, item_id, quantidade, observacoes, data_movimento, origem_ref')
    .eq('rdo_id', rdoId)
    .eq('origem', 'rdo')
    .is('deleted_at', null)

  if (error) throw error
  return (data ?? []).map((r) => ({
    id:            String(r.id),
    itemId:        String(r.item_id),
    quantidade:    Number(r.quantidade) || 0,
    observacoes:   (r.observacoes as string | null) ?? null,
    dataMovimento: (r.data_movimento as string | null) ?? null,
    origemRef:     (r.origem_ref as string | null) ?? null,
  }))
}
