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

/** As peças da ordem de serviço, uma por linha do texto. */
export function pecasDoTexto(texto: string): string[] {
  return String(texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

/** O que a grade precisa saber de uma linha para decidir se ela vira lançamento. */
export interface LinhaConferivel {
  obraId: string
  quantidades: QuantidadesDigitadas
  observacoes: string
  textoOriginal: string
  semProducao: boolean
  /** Campos da ordem de serviço — vazios nas linhas de produção. */
  endereco?: string
  servico?: string
  pecas?: string
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
    // Ordem de serviço: o endereço é a identidade do atendimento; serviço e peças também contam.
    || String(l.endereco ?? '').trim() !== ''
    || String(l.servico ?? '').trim() !== ''
    || pecasDoTexto(l.pecas ?? '').length > 0
    || String(l.observacoes ?? '').trim() !== ''
    || String(l.textoOriginal ?? '').trim() !== ''
}

// ─── O rascunho local da grade ────────────────────────────────────────────────
//
// ⚠️ Isto NÃO é rascunho de RDO. A grade grava direto como `finalizado` de propósito — ela é para
// quem fecha o dia, e meio-RDO no servidor é pior que nenhum. O que isto resolve é outra coisa: a
// pessoa digita 9 mensagens olhando para o WhatsApp, o telefone toca, a aba fecha, e o trabalho de
// digitação some. O rascunho vive **só neste navegador** e morre na gravação.

export const CHAVE_RASCUNHO = 'cdata-lancamento-rapido'

export interface RascunhoDaGrade<T> {
  data: string
  linhas: T[]
}

/**
 * ⚠️ Todo acesso é envolvido em try/catch: em aba anônima, com cookies bloqueados ou com a cota
 * estourada, `localStorage` **lança** em vez de devolver null — e uma exceção aqui derrubaria a
 * tela inteira por causa de uma conveniência.
 */
export function lerRascunho<T>(hoje: string): RascunhoDaGrade<T> | null {
  try {
    const cru = localStorage.getItem(CHAVE_RASCUNHO)
    if (!cru) return null
    const r = JSON.parse(cru) as RascunhoDaGrade<T>
    if (!r || typeof r.data !== 'string' || !Array.isArray(r.linhas)) return null
    // Rascunho de outro dia não volta: reabrir amanhã e ver o lançamento de ontem meio digitado é
    // convite a gravar data errada.
    if (r.data !== hoje) return null
    return r
  } catch { return null }
}

export function gravarRascunho<T>(r: RascunhoDaGrade<T>): void {
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r)) } catch { /* sem espaço ou sem permissão: segue sem rascunho */ }
}

/** ⚠️ Chamado DEPOIS de gravar. Rascunho que sobrevive viraria lançamento em dobro na próxima abertura. */
export function limparRascunho(): void {
  try { localStorage.removeItem(CHAVE_RASCUNHO) } catch { /* idem */ }
}
