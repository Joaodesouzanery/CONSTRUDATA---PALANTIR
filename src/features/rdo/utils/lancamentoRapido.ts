/**
 * As regras do Lançamento Rápido, fora da tela — para poderem ser testadas.
 *
 * São três invariantes, e as três dizem a mesma coisa de jeitos diferentes: **"não informado" não
 * é "zero"**. É a mesma regra do `apontamentoWcr.ts`, e ela existe porque a equipe só escreve o que
 * fez — gravar `0` nas outras 12 siglas afirmaria que não se produziu nada delas, o que ninguém
 * disse, e essa afirmação vira número na medição e no FCP.
 */
import type { RdoWcrProducaoRow } from '@/types'
import { SIGLAS_WCR } from './apontamentoWcr'

/** O que uma linha da grade guarda de quantidade: sigla → o que foi digitado. */
export type QuantidadesDigitadas = Record<string, string>

/**
 * As linhas de produção de uma linha da grade.
 *
 * ⚠️ Sigla não digitada **não vira linha**. Só entra o que alguém escreveu — inclusive um `0`
 * explícito, que aí sim é a afirmação "produzi zero disto hoje" e é diferente de silêncio.
 */
export function producaoDasQuantidades(quantidades: QuantidadesDigitadas): RdoWcrProducaoRow[] {
  return SIGLAS_WCR
    .map((s) => ({ sigla: s.sigla, quantidade: (quantidades[s.sigla] ?? '').trim(), unidade: s.unidade }))
    .filter((p) => p.quantidade !== '')
}

/**
 * As horas do dia, ou `undefined`.
 *
 * ⚠️ Campo vazio devolve `undefined`, nunca `0`: o tipo diz "só existe quando alguém informou", e
 * um zero aqui faria o custo/hora dividir por uma jornada que ninguém declarou. Fora de 0–24 é
 * digitação errada, não jornada — também vira `undefined`.
 */
export function horasInformadas(texto: string): number | undefined {
  const t = String(texto ?? '').trim()
  if (t === '') return undefined
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n > 24) return undefined
  return n
}

/** O que a grade precisa saber de uma linha para decidir se ela vira lançamento. */
export interface LinhaConferivel {
  obraId: string
  quantidades: QuantidadesDigitadas
  observacoes: string
  textoOriginal: string
  semProducao: boolean
}

/**
 * A linha diz alguma coisa?
 *
 * Linha em branco é ignorada em silêncio — a grade nasce com uma linha vazia e ganha outra a cada
 * clique, então reclamar delas seria reclamar do próprio desenho. Já linha com obra e mais nada é
 * ignorada de propósito: gravar um RDO vazio afirmaria que a equipe esteve lá e não fez nada.
 */
export function linhaTemConteudo(l: LinhaConferivel): boolean {
  if (!l.obraId) return false
  if (l.semProducao) return true    // "não houve produção" é uma afirmação, e ela basta
  return Object.values(l.quantidades).some((v) => String(v ?? '').trim() !== '')
    || String(l.observacoes ?? '').trim() !== ''
    || String(l.textoOriginal ?? '').trim() !== ''
}
