/**
 * Qual obra fica selecionada depois de uma sincronização.
 *
 * ─── 🔴 POR QUE ESTA FUNÇÃO EXISTE ────────────────────────────────────────────
 * Ela é o conserto de um bug que gravava dado de cliente no registro errado.
 *
 * O `pull()` da Torre fazia, incondicionalmente, `selectedId: sites[0]?.id ?? null`. Toda
 * sincronização jogava fora a obra que a pessoa tinha clicado. E `sites[0]` é **garantidamente**
 * outra obra: `pullTable` ordena por `created_at DESC` (é a cadastrada mais recentemente) e
 * `mergePull` empurra para o FIM os registros com op pendente — ou seja, justamente a obra que
 * acabou de ser editada.
 *
 * Como o `pull()` dispara sozinho o tempo todo (realtime em seis tabelas, montagem da Torre e do
 * Gestão 360, TTL de 30 s, telas do Predial, boot), a seleção trocava no meio da digitação. O
 * `ContratoCard` não remontava, o formulário seguia com os números da obra A, e o "Salvar" gravava
 * `updateSite(B.id, { contrato: rascunho_de_A })` — o contrato inteiro de B substituído pelo de A,
 * com serviços, faturamentos e de-para junto.
 *
 * A regra, em uma frase: **sincronizar não é escolher.**
 */
import type { ConstructionSite } from '@/types'

/**
 * A seleção que deve valer depois do merge.
 *
 * Mantém a escolha do usuário sempre que ela ainda existir. Só reseleciona quando não há escolha
 * nenhuma, ou quando a obra escolhida sumiu da lista — porque aí a tela ficaria apontando para uma
 * obra que não existe mais, e isso também é errado, só que de outro jeito.
 */
export function proximaSelecao(
  selecionadaHoje: string | null | undefined,
  sites: Array<Pick<ConstructionSite, 'id'>>,
): string | null {
  if (selecionadaHoje != null && sites.some((s) => s.id === selecionadaHoje)) return selecionadaHoje
  return sites[0]?.id ?? null
}
