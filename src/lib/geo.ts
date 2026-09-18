/**
 * geo.ts — distância entre dois pontos, e a cerca virtual do ponto eletrônico.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 * O mesmo haversine estava escrito TRÊS vezes no projeto, em duas unidades diferentes:
 * `otimizacaoFrotaStore.haversineKm` (km), `MapaCanvas.haversine` (metros),
 * `ControlMap.distanciaKm` (km). Três cópias da mesma fórmula divergem na primeira vez que alguém
 * mexe numa.
 *
 * ⚠️ E a de frota **arredonda para 100 m** (`.toFixed(1)` em km). Para otimizar rota, tudo bem;
 * para decidir se alguém pode bater o ponto, não — a cerca precisa da distância cheia.
 */

const RAIO_DA_TERRA_M = 6_371_000
const rad = (g: number) => (g * Math.PI) / 180

export interface Ponto { lat: number; lng: number }

/** Distância em METROS, sem arredondar. É a unidade da cerca. */
export function distanciaM(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return RAIO_DA_TERRA_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// ─── A cerca ──────────────────────────────────────────────────────────────────

/**
 * Por que a cerca não pôde ser avaliada. `undefined` = foi avaliada.
 *
 * ⚠️ Cada um destes é um caso em que o sistema **não sabe onde a pessoa está** — e não saber não é
 * o mesmo que saber que está fora. Bloquear aqui criaria um buraco no registro de jornada sem
 * provar nada; o certo é registrar marcado, para o gestor conferir.
 */
export type MotivoSemCerca =
  /** O usuário negou a permissão de localização. */
  | 'permissao-negada'
  /** GPS indisponível (sem sinal, aparelho sem hardware). */
  | 'posicao-indisponivel'
  /** A leitura demorou demais. */
  | 'tempo-esgotado'
  /**
   * A precisão informada pelo aparelho é pior que o próprio raio.
   *
   * ⚠️ Este é o caso mais traiçoeiro e o único que exige olhar o `accuracy`: um fix de Wi-Fi pode
   * errar quilômetros. Sem esta checagem, um aparelho sem GPS "passaria" em qualquer cerca —
   * inclusive numa de 300 m — só porque devolveu um par de coordenadas plausível.
   */
  | 'precisao-insuficiente'
  /** A obra não tem coordenada cadastrada — não há de onde medir. */
  | 'obra-sem-coordenada'

export interface AvaliacaoDaCerca {
  /** `true` dentro, `false` fora, `null` quando não deu para avaliar. */
  dentro: boolean | null
  /** Metros até o centro da obra. `null` quando não deu para medir. */
  distanciaM: number | null
  motivo?: MotivoSemCerca
}

export interface LeituraDeLocal {
  lat: number
  lng: number
  /** Raio de incerteza em metros, como o navegador informa. */
  precisaoM?: number
}

/**
 * A pessoa está dentro da cerca da obra?
 *
 * Só devolve `dentro: false` quando o sistema **sabe** que está fora: obra com coordenada, leitura
 * existente e precisa o bastante, e distância acima do raio. Em qualquer outro caso devolve `null`
 * com o motivo — e quem chama decide (a regra do projeto é registrar marcado, nunca recusar).
 */
export function avaliarCerca(
  leitura: LeituraDeLocal | null,
  obra: Ponto | null,
  raioM: number,
): AvaliacaoDaCerca {
  if (!obra) return { dentro: null, distanciaM: null, motivo: 'obra-sem-coordenada' }
  if (!leitura) return { dentro: null, distanciaM: null, motivo: 'posicao-indisponivel' }

  const distancia = distanciaM(leitura, obra)

  // ⚠️ A precisão é comparada com o RAIO, não com um número fixo. Numa cerca de 5 km, um erro de
  // 200 m é irrelevante; numa de 300 m, o mesmo erro decide sozinho o resultado.
  if (leitura.precisaoM != null && leitura.precisaoM > raioM) {
    return { dentro: null, distanciaM: distancia, motivo: 'precisao-insuficiente' }
  }

  return { dentro: distancia <= raioM, distanciaM: distancia }
}

/** Erro do `navigator.geolocation` → motivo nosso. O código 1/2/3 é do padrão W3C. */
export function motivoDoErroDeGeo(codigo: number | undefined): MotivoSemCerca {
  if (codigo === 1) return 'permissao-negada'
  if (codigo === 3) return 'tempo-esgotado'
  return 'posicao-indisponivel'
}

export const TEXTO_DO_MOTIVO: Record<MotivoSemCerca, string> = {
  'permissao-negada':      'Localização não autorizada neste aparelho',
  'posicao-indisponivel':  'Não foi possível obter a localização',
  'tempo-esgotado':        'A localização demorou demais para responder',
  'precisao-insuficiente': 'A localização veio imprecisa demais para conferir a cerca',
  'obra-sem-coordenada':   'Esta obra ainda não tem coordenada cadastrada',
}

/** Distância para a tela: metros abaixo de 1 km, km acima. */
export function distanciaLegivel(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}
