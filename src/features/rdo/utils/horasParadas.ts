/**
 * Horas paradas por motivo — o indicador de maior retorno do RDO.
 *
 * ─── POR QUE ISTO IMPORTA MAIS DO QUE PARECE ──────────────────────────────────
 * Nas 105 obras brasileiras medidas pelo NORIE/UFRGS (Bortolazza & Formoso, IGLC-14, 2006),
 * **cerca de 70% das causas de não cumprimento do plano são internas** — mão de obra, materiais,
 * equipamentos, projeto, planejamento. Clima nunca passou de 14,2%. Ou seja: *"foi a chuva"* quase
 * nunca é a explicação, e sem medir as horas de cada motivo não há como mostrar isso a ninguém.
 *
 * A taxonomia de ocorrências do RDO Compizzo já era a certa. Este arquivo só transforma as sete
 * caixinhas de seleção em horas — que é o que separa "teve ocorrência" de "perdemos 14 h esperando
 * liberação de área do cliente".
 *
 * ⚠️ **Ausente não é zero, e a distinção viaja até a tela.** Marcar a ocorrência sem preencher a
 * hora quer dizer "aconteceu, ninguém mediu"; preencher zero quer dizer "aconteceu e não parou
 * ninguém". Tratar o primeiro caso como zero faria a obra parecer mais eficiente do que é — e é
 * exatamente o tipo de silêncio que este projeto já corrigiu em outros módulos.
 */
import type { MotivoDeParada, RDO, RdoCompizzoOcorrencias } from '@/types'

export const ROTULO_MOTIVO: Record<MotivoDeParada, string> = {
  chuva:                  'Chuva',
  areaNaoLiberada:        'Área não liberada',
  interferenciaTerceiros: 'Interferência de terceiros',
  faltaEnergia:           'Falta de energia',
  equipamentoDefeito:     'Equipamento com defeito',
  outros:                 'Outros',
}

export const MOTIVOS: MotivoDeParada[] = Object.keys(ROTULO_MOTIVO) as MotivoDeParada[]

/** `semOcorrencias` não é motivo: é a ausência deles. */
export function motivosMarcados(o?: RdoCompizzoOcorrencias | null): MotivoDeParada[] {
  if (!o) return []
  return MOTIVOS.filter((m) => o[m])
}

export interface ParadaPorMotivo {
  motivo: MotivoDeParada
  rotulo: string
  /** Horas somadas. Só do que foi MEDIDO. */
  horas: number
  /** Em quantos RDOs este motivo apareceu. */
  ocorrencias: number
  /** Em quantos deles ninguém preencheu a hora — a medida da própria cobertura. */
  semMedida: number
}

export interface ResumoDeParadas {
  porMotivo: ParadaPorMotivo[]
  /** Total de horas medidas no período. */
  horasTotais: number
  /** Ocorrências registradas sem hora — o denominador da confiança deste número. */
  semMedida: number
  ocorrenciasTotais: number
}

export const RESUMO_VAZIO: ResumoDeParadas = {
  porMotivo: [], horasTotais: 0, semMedida: 0, ocorrenciasTotais: 0,
}

/**
 * O resumo do período, do motivo que mais custou para o que menos custou.
 *
 * Devolve `semMedida` junto com as horas de propósito: um total de "14 h" construído sobre nove
 * ocorrências das quais seis ninguém mediu é um número que precisa da ressalva ao lado.
 */
export function resumirParadas(rdos: RDO[]): ResumoDeParadas {
  const acc = new Map<MotivoDeParada, ParadaPorMotivo>()
  let horasTotais = 0
  let semMedida = 0
  let ocorrenciasTotais = 0

  for (const rdo of rdos) {
    const c = rdo.compizzo
    if (!c) continue
    for (const motivo of motivosMarcados(c.ocorrencias)) {
      const atual = acc.get(motivo) ?? {
        motivo, rotulo: ROTULO_MOTIVO[motivo], horas: 0, ocorrencias: 0, semMedida: 0,
      }
      atual.ocorrencias += 1
      ocorrenciasTotais += 1
      const h = c.horasOcorrencia?.[motivo]
      // ⚠️ `undefined` cai aqui e NÃO soma zero. Zero preenchido soma zero, que é diferente.
      if (typeof h === 'number' && Number.isFinite(h)) {
        atual.horas += h
        horasTotais += h
      } else {
        atual.semMedida += 1
        semMedida += 1
      }
      acc.set(motivo, atual)
    }
  }

  const porMotivo = [...acc.values()].sort(
    (a, b) => b.horas - a.horas || b.ocorrencias - a.ocorrencias || a.rotulo.localeCompare(b.rotulo),
  )
  return { porMotivo, horasTotais, semMedida, ocorrenciasTotais }
}

/**
 * A frase para a tela e para a pauta da reunião.
 *
 * Diz o motivo que mais custou, e declara quantas ocorrências ficaram sem medida — porque um número
 * de horas sem essa ressalva convida a ser lido como se fosse o total real.
 */
export function fraseDasParadas(r: ResumoDeParadas): string {
  if (r.ocorrenciasTotais === 0) return 'Nenhuma ocorrência registrada no período.'
  if (r.horasTotais === 0 && r.semMedida > 0) {
    return `${r.ocorrenciasTotais} ocorrência(s) registrada(s), nenhuma com hora preenchida — não dá para dizer quanto custaram.`
  }
  const maior = r.porMotivo[0]
  const horas = r.horasTotais.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const base = `${horas} h paradas no período; o motivo que mais custou foi ${maior.rotulo.toLowerCase()} (${maior.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h).`
  return r.semMedida > 0
    ? `${base} ⚠️ ${r.semMedida} ocorrência(s) sem hora preenchida ficaram de fora da conta.`
    : base
}
