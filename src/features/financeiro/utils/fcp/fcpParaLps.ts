/**
 * A ponte entre o plano de caixa e o Last Planner — nos dois sentidos.
 *
 * **Ida:** ao aprovar o plano, cada semana de cada cidade vira uma atividade no LPS com a meta de
 * produção. É o que transforma "precisamos de 96,67 serviços por semana em Bertioga" numa linha
 * que alguém assume na reunião de planejamento.
 *
 * **Volta:** o que o LPS registra como executado alimenta o PLANEJADO × REALIZADO do FCP. Aí a
 * medição, o recebimento e o capital recalculam sozinhos, com o dado que a obra já lançou — sem
 * ninguém digitar o mesmo número duas vezes.
 *
 * ⚠️ **A unidade é SERVIÇO, não metro.** O campo do LPS se chama `plannedMeters` por história, e
 * a tela do FCP diz "serviços" na cara. Tratar como metro faria a conta bater com um contrato que
 * não é este.
 */
import type { LpsActivity } from '@/types'
import type { PremissasFcp } from './tipos'
import { producaoPrevistaSemanal, semanasDoFluxo, ticketDaCidade } from './motor'
import type { ProducaoRealizada } from './motor'

/**
 * A semana ISO 8601 de uma data — `2026-W35`.
 *
 * ⚠️ Não é "a semana do ano" ingênua. Na ISO 8601 a semana 1 é a que contém a primeira
 * quinta-feira do ano, e por isso 01/01 pode cair na semana 52 do ano ANTERIOR. Chutar
 * `ceil(diaDoAno/7)` erra a virada de ano todo ano, e o LPS agrupa por essa string.
 */
export function semanaIso(dataISO: string): string {
  const [a, m, d] = dataISO.slice(0, 10).split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  // Anda até a quinta-feira da mesma semana (segunda = 1 … domingo = 7).
  const diaDaSemana = data.getUTCDay() || 7
  data.setUTCDate(data.getUTCDate() + 4 - diaDaSemana)
  const primeiroDeJaneiro = new Date(Date.UTC(data.getUTCFullYear(), 0, 1))
  const semana = Math.ceil(((data.getTime() - primeiroDeJaneiro.getTime()) / 86400000 + 1) / 7)
  return `${data.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`
}

/** O código de trecho que o FCP usa no LPS. Um por cidade, estável. */
export function trechoDaCidade(cidadeId: string): string {
  return `FCP-${cidadeId.toUpperCase()}`
}

/**
 * As atividades que o plano gera no LPS ao ser aprovado.
 *
 * ⚠️ Uma por cidade **por semana**, e não uma por serviço: o LPS é a tela do compromisso semanal,
 * e 96 linhas de "1 ligação de água" por semana afogariam a reunião. A meta vai no
 * `plannedMeters`, e a descrição diz a unidade.
 */
export function atividadesDoPlano(
  premissas: PremissasFcp,
  planoId: string,
  quantidadeDeSemanas = 12,
): Array<Omit<LpsActivity, 'id'>> {
  const semanas = semanasDoFluxo(premissas, quantidadeDeSemanas)
  const saida: Array<Omit<LpsActivity, 'id'>> = []

  for (const cidade of premissas.cidades) {
    const meta = producaoPrevistaSemanal(premissas, cidade)
    if (meta <= 0) continue
    for (const semana of semanas) {
      saida.push({
        week: semanaIso(semana.inicio),
        trechoCode: trechoDaCidade(cidade.id),
        description: `${cidade.nome} — meta do fluxo projetado: ${meta.toFixed(1)} serviços`,
        planned: true,
        completed: false,
        // ⚠️ Nasce VERMELHO de propósito: a atividade vem do plano financeiro, e ninguém ainda
        // olhou se as restrições (material, frente liberada, equipe) estão resolvidas. Nascer
        // verde seria o plano dizer que a obra está pronta para produzir sem ninguém ter visto.
        readyStatus: 'red',
        plannedMeters: Number(meta.toFixed(2)),
        // O vínculo de volta. É por ele que o realizado do LPS acha o plano.
        sourceFcpId: `${planoId}:${cidade.id}:${semana.numero}`,
      })
    }
  }
  return saida
}

/** Lê o vínculo de volta: `planoId:cidadeId:semana`. */
export function lerVinculo(source: string | undefined): { planoId: string; cidadeId: string; semana: number } | null {
  if (!source) return null
  const partes = source.split(':')
  if (partes.length !== 3) return null
  const semana = Number(partes[2])
  if (!Number.isInteger(semana) || semana < 1) return null
  return { planoId: partes[0], cidadeId: partes[1], semana }
}

/**
 * A volta: o executado do LPS vira a produção realizada do FCP.
 *
 * ⚠️ Atividade **sem executado lançado** não vira zero — fica de fora. Zero quer dizer "a equipe
 * não produziu nada nesta semana", e é um número muito diferente de "ninguém lançou ainda". Zerar
 * o que não foi lançado derrubaria a medição projetada de semanas que ainda nem aconteceram.
 */
export function realizadoDoLps(
  atividades: Array<Pick<LpsActivity, 'executedMeters'> & { sourceFcpId?: string }>,
  planoId: string,
): ProducaoRealizada {
  const saida: ProducaoRealizada = {}
  for (const a of atividades) {
    const v = lerVinculo(a.sourceFcpId)
    if (!v || v.planoId !== planoId) continue
    if (typeof a.executedMeters !== 'number' || !Number.isFinite(a.executedMeters)) continue
    const daCidade = saida[v.cidadeId] ?? (saida[v.cidadeId] = {})
    // Duas atividades para a mesma semana somam — é o caso de alguém quebrar a meta em duas linhas.
    daCidade[v.semana] = (daCidade[v.semana] ?? 0) + a.executedMeters
  }
  return saida
}

/**
 * O que muda no FCP se o realizado do LPS for adotado.
 *
 * Existe para a tela poder mostrar antes de gravar — mesma regra do resto do módulo: o sistema
 * mostra o que vai mudar, quem decide é a pessoa.
 */
export interface MudancaVindaDoLps {
  cidadeId: string
  cidadeNome: string
  semana: number
  previsto: number
  noFcp?: number
  noLps: number
  /** Quanto a medição da semana muda em reais, se adotado. */
  impactoEmReais: number
}

export function mudancasVindasDoLps(
  premissas: PremissasFcp,
  atual: ProducaoRealizada,
  doLps: ProducaoRealizada,
): MudancaVindaDoLps[] {
  const mudancas: MudancaVindaDoLps[] = []
  for (const cidade of premissas.cidades) {
    const previsto = producaoPrevistaSemanal(premissas, cidade)
    const ticket = ticketDaCidade(cidade)
    const doLpsNaCidade = doLps[cidade.id] ?? {}
    for (const [semanaTexto, noLps] of Object.entries(doLpsNaCidade)) {
      if (typeof noLps !== 'number') continue
      const semana = Number(semanaTexto)
      const noFcp = atual[cidade.id]?.[semana]
      if (noFcp === noLps) continue
      mudancas.push({
        cidadeId: cidade.id,
        cidadeNome: cidade.nome,
        semana,
        previsto,
        noFcp,
        noLps,
        impactoEmReais: (noLps - (noFcp ?? previsto)) * ticket,
      })
    }
  }
  return mudancas.sort((a, b) => a.semana - b.semana || a.cidadeNome.localeCompare(b.cidadeNome, 'pt-BR'))
}
