/**
 * O id de uma linha da composição do contrato — derivado, nunca sorteado.
 *
 * ─── POR QUE ─────────────────────────────────────────────────────────────────
 * Importar a composição SUBSTITUI a lista inteira (é o que se espera ao subir "a planilha do
 * contrato"). Enquanto o id era `crypto.randomUUID()`, reimportar a MESMA planilha — para corrigir
 * um preço, para acrescentar uma linha no fim — trocava o id de todos os itens. E tudo que aponta
 * para eles ficava órfão **sem erro nenhum**:
 *
 *  · `ObraContrato.deParaSiglas` — o mapa sigla do apontamento WCR → item do contrato;
 *  · `contractServiceId` nas linhas de produção dos RDOs — é por ele que a obra sabe o que já foi
 *    medido. O "Medido" voltava a zero.
 *
 * ⚠️ A chave é **ordem + descrição + unidade**: o que identifica a linha na proposta. Preço e
 * quantidade ficam de fora de propósito — corrigir um valor é editar a mesma linha, não criar
 * outra. Renomear a descrição, sim, cria uma linha nova: é o que o de-para precisa saber.
 */
import { seededUuidLegado } from '@/lib/seededId'

export function idDoItemDeComposicao(ordem: number, descricao: string, unidade: string): string {
  const limpo = (v: string) =>
    String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
  return seededUuidLegado(`contrato-servico:${ordem}:${limpo(descricao)}:${limpo(unidade)}`)
}
