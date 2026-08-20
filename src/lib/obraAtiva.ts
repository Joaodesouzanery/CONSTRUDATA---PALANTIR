/**
 * obraAtiva.ts — arquivar obra sem perder nada dela.
 *
 * Uma empresa com trinta obras entregues não quer as trinta poluindo o mapa. Mas "sumir do mapa"
 * não pode virar "sumir do sistema": o histórico, o financeiro, os RDOs e os relatórios daquela
 * obra continuam valendo, e é preciso conseguir reativá-la.
 *
 * Daí a regra deste módulo: **o filtro é sempre visual, nunca no dado.** Quem esconde é a tela do
 * mapa e o strip de cards. A store devolve todas as obras, sempre — se o filtro descesse para lá,
 * a obra arquivada sumiria do Financeiro, do EVM e dos relatórios junto, que é o oposto do pedido.
 *
 * Arquivo folha: não importa nada além do tipo, para poder ser usado tanto por componentes
 * compartilhados quanto por features sem risco de ciclo.
 */
import type { ConstructionSite } from '@/types'

/** Ausente = ativa. As obras cadastradas antes deste campo não precisam de migração de dado. */
export function obraEstaAtiva(site: Pick<ConstructionSite, 'ativa'>): boolean {
  return site.ativa !== false
}

/** Separa em ativas e arquivadas preservando a ordem original de cada grupo. */
export function separarPorAtividade<T extends Pick<ConstructionSite, 'ativa'>>(sites: T[]): {
  ativas: T[]
  inativas: T[]
} {
  const ativas: T[] = []
  const inativas: T[] = []
  for (const site of sites) (obraEstaAtiva(site) ? ativas : inativas).push(site)
  return { ativas, inativas }
}
