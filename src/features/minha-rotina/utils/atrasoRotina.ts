/**
 * atrasoRotina.ts — há quanto tempo esta rotina deixou de ser feita.
 *
 * ─── O QUE EXISTIA ANTES ──────────────────────────────────────────────────────────────────────
 * Um único aviso, por GRUPO inteiro de frequência, e só quando 100% das rotinas do grupo tinham
 * falhado no ciclo anterior. Na prática ele quase nunca aparecia — bastava uma rotina do grupo
 * estar feita para o grupo inteiro ficar silencioso. Ninguém era cobrado por nada.
 *
 * ─── AS TRÊS DECISÕES ─────────────────────────────────────────────────────────────────────────
 *
 * 1. **Conta do ciclo FECHADO mais recente para trás, enquanto estiver em aberto.**
 *    Se a semana passada foi feita, não há atraso — mesmo que a de três semanas atrás tenha
 *    falhado. Um contador que só cresce vira ruído e para de ser lido. O ciclo CORRENTE nunca conta
 *    como atraso: ainda dá tempo de fazer.
 *
 * 2. **Piso na criação da rotina.** Sem ele, uma rotina cadastrada ontem apareceria "atrasada há 5
 *    anos", porque a varredura para trás não teria onde parar.
 *
 * 3. **Rotina diária pula domingo, sábado (conforme a jornada) e feriado.** Senão, toda
 *    segunda-feira o painel abriria dizendo que tudo está atrasado há dois dias. Reusa
 *    `@/lib/diasUteis`, a mesma regra que o alerta de RDO usa — duas cópias divergiriam.
 */
import type { WorkWeekMode } from '@/types'
import type { Rotina } from '@/store/rotinasStore'
import { hojeLocalISO, dataLocalISO } from '@/lib/utils'
import { ehDiaUtil, diasEntre } from '@/lib/diasUteis'
import { cicloDe, limitesDoCiclo, rotuloDoCiclo, type FrequenciaRotina } from './cicloRotina'

export interface AtrasoRotina {
  /** A etiqueta do ciclo em aberto mais antigo da sequência: '2026-W33'. */
  cicloEmAberto: string
  /** "semana de 10/08 a 16/08" */
  rotulo: string
  /** O último dia daquele ciclo, `yyyy-MM-dd` — quando ele fechou. */
  fechouEm: string
  /** Dias de calendário entre o fechamento e hoje. Sempre ≥ 1. */
  diasDeAtraso: number
  /** Quantos ciclos fechados seguidos ficaram sem execução. */
  ciclosSeguidos: number
  /** A varredura bateu o teto — o atraso é pelo menos isso. */
  truncado: boolean
}

export interface ContextoAtraso {
  /** Chaves `${rotinaId}|${periodo}` das execuções marcadas como feitas. */
  feitas: Set<string>
  feriados: Set<string>
  jornada: WorkWeekMode
  hoje?: string
  /** Teto de ciclos varridos para trás. */
  maxCiclos?: number
}

/** O ciclo imediatamente anterior a este, pela etiqueta. */
function anteriorAo(frequencia: FrequenciaRotina, dataDoCiclo: string): string {
  const { de } = limitesDoCiclo(frequencia, dataDoCiclo)
  const d = new Date(`${de}T00:00:00`)
  d.setDate(d.getDate() - 1)   // um dia antes do início cai dentro do ciclo anterior
  return dataLocalISO(d)
}

/**
 * A rotina está atrasada? Devolve `null` quando não está.
 *
 * "Não está" cobre três casos: o ciclo fechado mais recente foi feito; a rotina é nova demais para
 * ter um ciclo fechado; ou a rotina está inativa.
 */
export function atrasoDaRotina(rotina: Rotina, ctx: ContextoAtraso): AtrasoRotina | null {
  if (!rotina.ativa) return null

  const hoje = ctx.hoje ?? hojeLocalISO()
  const maxCiclos = ctx.maxCiclos ?? 12
  const criadaEm = rotina.criadaEm ? rotina.criadaEm.slice(0, 10) : null

  const abertos: { ciclo: string; fechouEm: string; dataDoCiclo: string }[] = []
  // Começa no ciclo anterior ao corrente: o de hoje ainda não venceu.
  let cursor = anteriorAo(rotina.frequencia, hoje)
  let truncado = false

  for (let i = 0; ; i++) {
    if (i >= maxCiclos) { truncado = abertos.length > 0; break }

    const { de, ate } = limitesDoCiclo(rotina.frequencia, cursor)
    // A rotina não existia quando este ciclo COMEÇOU — não há o que cobrar dele nem de nada antes.
    if (criadaEm && de < criadaEm) break

    // Uma rotina diária só é cobrada em dia útil. Nas outras frequências o ciclo sempre contém
    // pelo menos um dia útil, então a checagem só faz diferença na diária.
    const cobravel = rotina.frequencia !== 'diaria' || ehDiaUtil(de, ctx.feriados, ctx.jornada).util
    if (cobravel) {
      const ciclo = cicloDe(rotina.frequencia, cursor)
      if (ctx.feitas.has(`${rotina.id}|${ciclo}`)) break   // a sequência aberta terminou aqui
      abertos.push({ ciclo, fechouEm: ate, dataDoCiclo: cursor })
    }

    cursor = anteriorAo(rotina.frequencia, cursor)
  }

  if (abertos.length === 0) return null
  const maisAntigo = abertos[abertos.length - 1]
  return {
    cicloEmAberto: maisAntigo.ciclo,
    rotulo: rotuloDoCiclo(rotina.frequencia, maisAntigo.dataDoCiclo),
    fechouEm: maisAntigo.fechouEm,
    diasDeAtraso: Math.max(1, diasEntre(maisAntigo.fechouEm, hoje)),
    ciclosSeguidos: abertos.length,
    truncado,
  }
}

/** "Valim não fez · atrasada há 6 dias (semana de 10/08 a 16/08) · 2 semanas seguidas" */
export function frasePendencia(rotina: Rotina, atraso: AtrasoRotina): string {
  const quem = rotina.responsavel?.trim()
  const abertura = quem ? `${quem} não fez` : 'não foi feita'
  const dias = `atrasada há ${atraso.diasDeAtraso} dia${atraso.diasDeAtraso !== 1 ? 's' : ''}${atraso.truncado ? '+' : ''}`
  const seguidos = atraso.ciclosSeguidos > 1
    ? ` · ${atraso.ciclosSeguidos} ${PLURAL_CICLO[rotina.frequencia]} seguid${rotina.frequencia === 'mensal' ? 'os' : 'as'}`
    : ''
  return `${abertura} · ${dias} (${atraso.rotulo})${seguidos}`
}

const PLURAL_CICLO: Record<FrequenciaRotina, string> = {
  diaria: 'diárias', semanal: 'semanas', quinzenal: 'quinzenas', mensal: 'meses',
}

/** Cor determinística por nome, para a mesma pessoa ficar sempre da mesma cor na lista. */
const PALETA = ['#f97316', '#0ea5e9', '#22c55e', '#a855f7', '#eab308', '#ec4899', '#14b8a6', '#f43f5e']

export function corDaPessoa(nome: string): string {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

/** "Valim" → "VA"; "Tony do Vale" → "TV"; "" e "   " → "?" */
export function iniciaisDe(nome: string): string {
  // O `filter(Boolean)` importa: `'   '.trim().split(/\s+/)` devolve `['']`, e sem ele a string
  // vazia sobrevivia ao resto do filtro e virava um selo em branco.
  const partes = nome.trim().split(/\s+/).filter(Boolean).filter((p) => p.length > 2 || partesCurtasValem(p))
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** "do", "da", "de" não viram inicial; nomes de duas letras, sim. */
function partesCurtasValem(p: string): boolean {
  return !['do', 'da', 'de', 'dos', 'das', 'e'].includes(p.toLowerCase())
}
