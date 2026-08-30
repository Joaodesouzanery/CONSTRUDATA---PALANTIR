/**
 * Os mapas base do sistema, num lugar só.
 *
 * ⚠️ **Por que isto existe:** o CARTO passou a exigir chave e carimba "API KEY REQUIRED" DENTRO da
 * imagem do tile. O aviso de falha do app nunca dispara, porque o tile volta HTTP 200 — só que com
 * a marca d'água pintada. Estavam espalhadas **13 URLs do CARTO em 6 arquivos**, cada mapa com a
 * sua cópia; a próxima troca de provedor custaria seis arquivos de novo.
 *
 * O substituto é o **Esri** (`server.arcgisonline.com`), que não pede chave nenhuma. Conferido em
 * 30/08/2026: os cinco endpoints abaixo respondem 200 com imagem de verdade.
 *
 * ⚠️ **O escuro são DUAS camadas**: a base não tem texto, e os rótulos vêm por cima. É isso que dá
 * o visual de mapa escuro com cidades legíveis — uma camada só fica ou sem nome nenhum, ou com o
 * texto ilegível sobre o fundo.
 */

export type EstiloDeMapa = 'escuro' | 'ruas' | 'satelite' | 'relevo'

export interface CamadaDeMapa {
  url: string
  attribution: string
  subdomains?: string
  maxZoom: number
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const CREDITO_ESRI = 'Tiles &copy; Esri'
const CREDITO_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** A base de cada estilo. */
export const BASE: Record<EstiloDeMapa, CamadaDeMapa> = {
  escuro:   { url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,  attribution: CREDITO_ESRI, maxZoom: 16 },
  ruas:     { url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,             attribution: CREDITO_ESRI, maxZoom: 19 },
  satelite: { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,                attribution: CREDITO_ESRI, maxZoom: 19 },
  relevo:   { url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,               attribution: CREDITO_ESRI, maxZoom: 19 },
}

/**
 * A camada de RÓTULOS que vai por cima — só existe para os estilos sem texto na base.
 *
 * O satélite ganha nomes de lugar e limites, senão vira foto sem referência. As ruas e o relevo já
 * trazem o texto na própria base e não levam nada por cima.
 */
export const ROTULOS: Partial<Record<EstiloDeMapa, CamadaDeMapa>> = {
  escuro:   { url: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,        attribution: '', maxZoom: 16 },
  satelite: { url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,   attribution: '', maxZoom: 19 },
}

export const ROTULO_ESTILO: Record<EstiloDeMapa, string> = {
  escuro: 'Escuro', ruas: 'Ruas', satelite: 'Satélite', relevo: 'Relevo',
}

/**
 * O OpenStreetMap puro, para os mapas pequenos de escolher coordenada.
 *
 * Não precisa de chave e é o único lugar onde ele ainda faz sentido: num seletor de ponto, o mapa
 * de ruas comum é mais legível do que o estilizado.
 */
export const OSM: CamadaDeMapa = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: CREDITO_OSM,
  maxZoom: 19,
}
