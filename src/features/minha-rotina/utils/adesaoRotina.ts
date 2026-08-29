/**
 * Adesão às rotinas — quantos ciclos cada um cumpriu, num período.
 *
 * ─── POR QUE ISTO FALTAVA, E POR QUE IMPORTA ──────────────────────────────────
 * O módulo só sabia do ciclo CORRENTE. A tela conseguia dizer "esta rotina está atrasada hoje", e
 * não conseguia dizer "o Eduardo cumpre 58% e o Valim cumpre 92%". Sem isso a conversa do gestor
 * vira "você não fez essa", quando o que ele precisa dizer é "você não faz".
 *
 * A boa notícia é que o dado sempre esteve gravado: uma linha por rotina por ciclo, com índice
 * único. Faltava só a conta.
 *
 * ─── AS CINCO REGRAS, E O ESPELHO COM O ATRASO ────────────────────────────────
 * Cada regra abaixo existe para NÃO discordar de `atrasoDaRotina`. Se as duas funções divergissem
 * sobre qual ciclo contava, o painel diria "em dia" e "50% de adesão" ao mesmo tempo, e ninguém
 * saberia qual acreditar.
 *
 * Puro: entra dado, sai dado.
 */
import type { WorkWeekMode } from '@/types'
import type { Rotina } from '@/store/rotinasStore'
import type { Periodo } from '@/lib/periodo'
import { ehDiaUtil } from '@/lib/diasUteis'
import {
  cicloDe, limitesDoCiclo, rotuloDoCiclo, diaDoCicloSeguinte, type FrequenciaRotina,
} from './cicloRotina'
import { hojeLocalISO } from '@/lib/utils'

/**
 * Mesma forma de `ContextoAtraso`, e de propósito: a chave de `feitas` é a MESMA string
 * (`${rotinaId}|${periodo}`), então a tela monta um `Set` só e alimenta as duas funções com ele.
 * Dois formatos de chave divergiriam na primeira mudança.
 */
export interface ContextoAdesao {
  feitas: Set<string>
  feriados: Set<string>
  jornada: WorkWeekMode
  hoje?: string
  /** Teto de voltas por rotina. Um período livre aceita 2015→hoje pelo seletor de data. */
  maxCiclos?: number
}

export interface CicloEsperado {
  /** A etiqueta: `2026-W33`. */
  ciclo: string
  de: string
  ate: string
  /** "semana de 10/08 a 16/08" — para listar o que ficou em aberto. */
  rotulo: string
  cumprido: boolean
}

export interface AdesaoDeRotina {
  rotinaId: string
  titulo: string
  frequencia: FrequenciaRotina
  responsavel?: string
  esperados: number
  cumpridos: number
  /** 0–100. **`null` quando `esperados === 0`** — zero de zero NÃO é 0%. */
  percentual: number | null
  /** Só os que ficaram em aberto, do mais recente para o mais antigo. */
  emAberto: CicloEsperado[]
  truncado: boolean
}

export interface AdesaoDePessoa {
  nome: string
  /** Quantas rotinas ela responde e foram avaliadas no período. */
  rotinas: number
  esperados: number
  cumpridos: number
  percentual: number | null
}

export interface AdesaoNoPeriodo {
  porRotina: AdesaoDeRotina[]
  porPessoa: AdesaoDePessoa[]
  total: { esperados: number; cumpridos: number; percentual: number | null }
  /** Nenhum ciclo fechado caiu inteiro no período. A tela diz isso, em vez de mostrar 0%. */
  vazio: boolean
}

const TETO_PADRAO = 400

const pctDe = (cumpridos: number, esperados: number): number | null =>
  esperados > 0 ? Math.round((cumpridos / esperados) * 1000) / 10 : null

/**
 * Os ciclos que esta rotina DEVIA ter cumprido dentro do período.
 *
 * As cinco regras, na ordem em que são aplicadas:
 *
 * 1. **Só ciclo INTEIRO dentro do período.** Uma rotina mensal olhada numa "semana" tem zero
 *    esperados — não um esperado e zero cumprido. Contar o ciclo que apenas encosta no período
 *    mostraria 0% para toda rotina mensal em qualquer visão semanal: um número falso, e falso
 *    para baixo, que é o pior tipo.
 * 2. **Só ciclo FECHADO.** Mesma regra do atraso: o ciclo corrente ainda dá tempo de fazer.
 * 3. **Piso em `criadaEm`.** Rotina criada em agosto não devia nada em julho.
 * 4. **Diária só em dia útil.** Senão agosto teria 31 esperados e a adesão máxima possível de uma
 *    rotina diária seria ~68%.
 * 5. **Teto de voltas**, sinalizado por `truncado`.
 */
export function ciclosEsperados(rotina: Rotina, periodo: Periodo, ctx: ContextoAdesao): {
  ciclos: CicloEsperado[]
  truncado: boolean
} {
  const hoje = ctx.hoje ?? hojeLocalISO()
  const teto = ctx.maxCiclos ?? TETO_PADRAO
  if (!rotina.ativa) return { ciclos: [], truncado: false }

  // `criadaEm` é timestamp UTC. O `.slice(0,10)` repete, de propósito, o mesmo corte que
  // `atrasoRotina` faz: uma rotina criada às 22h de 31/07 no Brasil vira 01/08 nas duas. Corrigir
  // só de um lado faria as duas discordarem sobre quando a rotina passou a existir.
  const nasceuEm = rotina.criadaEm?.slice(0, 10)

  const ciclos: CicloEsperado[] = []
  let cursor = periodo.de
  let truncado = false

  for (let guarda = 0; ; guarda++) {
    if (guarda >= teto) { truncado = true; break }
    const { de, ate } = limitesDoCiclo(rotina.frequencia, cursor)
    if (de > periodo.ate) break            // passou do fim: acabou a varredura

    const inteiroNoPeriodo = de >= periodo.de && ate <= periodo.ate
    const jaFechou = ate < hoje
    const depoisDeNascer = !nasceuEm || de >= nasceuEm
    const diaValido = rotina.frequencia !== 'diaria' || ehDiaUtil(de, ctx.feriados, ctx.jornada).util

    if (inteiroNoPeriodo && jaFechou && depoisDeNascer && diaValido) {
      const ciclo = cicloDe(rotina.frequencia, cursor)
      ciclos.push({
        ciclo, de, ate,
        rotulo: rotuloDoCiclo(rotina.frequencia, cursor),
        cumprido: ctx.feitas.has(`${rotina.id}|${ciclo}`),
      })
    }
    cursor = diaDoCicloSeguinte(rotina.frequencia, cursor)
  }

  return { ciclos, truncado }
}

export function adesaoDaRotina(rotina: Rotina, periodo: Periodo, ctx: ContextoAdesao): AdesaoDeRotina {
  const { ciclos, truncado } = ciclosEsperados(rotina, periodo, ctx)
  const cumpridos = ciclos.filter((c) => c.cumprido).length
  return {
    rotinaId: rotina.id,
    titulo: rotina.titulo,
    frequencia: rotina.frequencia,
    responsavel: rotina.responsavel?.trim() || undefined,
    esperados: ciclos.length,
    cumpridos,
    percentual: pctDe(cumpridos, ciclos.length),
    emAberto: ciclos.filter((c) => !c.cumprido).reverse(),
    truncado,
  }
}

export function adesaoNoPeriodo(rotinas: Rotina[], periodo: Periodo, ctx: ContextoAdesao): AdesaoNoPeriodo {
  const porRotina = rotinas.filter((r) => r.ativa).map((r) => adesaoDaRotina(r, periodo, ctx))

  // ⚠️ Soma de numeradores e denominadores, NUNCA média dos percentuais. Uma diária com 21 ciclos
  // e uma mensal com 1 não podem ter o mesmo peso: quem cumpriu 21/21 e 0/1 fez 95%, não 50%.
  const acc = new Map<string, AdesaoDePessoa>()
  for (const r of porRotina) {
    if (!r.responsavel) continue          // rotina sem dono entra no total, não no placar por pessoa
    if (r.esperados === 0) continue       // não avaliada no período: não conta nem a favor nem contra
    const atual = acc.get(r.responsavel) ?? { nome: r.responsavel, rotinas: 0, esperados: 0, cumpridos: 0, percentual: null }
    atual.rotinas += 1
    atual.esperados += r.esperados
    atual.cumpridos += r.cumpridos
    acc.set(r.responsavel, atual)
  }
  const porPessoa = [...acc.values()]
    .map((p) => ({ ...p, percentual: pctDe(p.cumpridos, p.esperados) }))
    // Pior primeiro: o placar existe para mostrar quem precisa de conversa.
    .sort((a, b) => (a.percentual ?? 101) - (b.percentual ?? 101))

  const esperados = porRotina.reduce((s, r) => s + r.esperados, 0)
  const cumpridos = porRotina.reduce((s, r) => s + r.cumpridos, 0)
  return {
    porRotina,
    porPessoa,
    total: { esperados, cumpridos, percentual: pctDe(cumpridos, esperados) },
    vazio: esperados === 0,
  }
}
