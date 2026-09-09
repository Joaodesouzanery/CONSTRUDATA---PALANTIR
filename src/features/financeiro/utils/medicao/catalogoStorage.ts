/**
 * Onde o catálogo do contrato é guardado: `app_state`, um documento por contrato.
 *
 * ─── POR QUE `app_state` E NÃO UMA TABELA ─────────────────────────────────────
 * O catálogo é do CONTRATO e as obras são várias — guardá-lo em `ObraContrato` (payload da obra)
 * o copiaria em cada uma, que é exatamente o que o domínio proíbe. Uma tabela nova resolveria,
 * mas custaria migração aplicada à mão no SQL Editor, e este projeto não tem etapa de migração no
 * deploy: enquanto ela não fosse colada, o app gravaria numa tabela inexistente.
 *
 * `app_state` já existe, já tem RLS por organização, e já é o mecanismo de quatro slices
 * (Planejamento, Planejamento Mestre, Restrições e o financeiro do RDO). Zero migração.
 *
 * ⚠️ `pushBlob` faz upsert DIRETO, fora da fila de sincronização: ele devolve `false` em vez de
 * enfileirar. Quem chama tem de olhar o retorno — falha aqui é silenciosa por natureza, e o
 * caminho certo é a tela dizer "não consegui salvar", não fingir que salvou.
 */
import type { CatalogoDoContrato } from '@/types'
import { pushBlob, pullBlob } from '@/lib/blobSync'
import { chaveDoCatalogo } from './catalogoContrato'

/** O catálogo deste contrato, ou `null` se ainda não foi importado (ou se não há rede). */
export async function lerCatalogo(numeroContrato: string): Promise<CatalogoDoContrato | null> {
  const r = await pullBlob<CatalogoDoContrato>(chaveDoCatalogo(numeroContrato))
  if (!r?.payload?.numeroContrato) return null
  return r.payload
}

/** Grava o catálogo. Devolve `false` quando não salvou — a tela precisa dizer isso. */
export async function gravarCatalogo(catalogo: CatalogoDoContrato): Promise<boolean> {
  return pushBlob(chaveDoCatalogo(catalogo.numeroContrato), catalogo)
}
