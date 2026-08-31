/**
 * O lado "depois" da linha de base: o que a plataforma MEDIU, no mesmo formato do período-espelho.
 *
 * ─── Por que este arquivo existe separado ──────────────────────────────────────
 * `retratoDaObra` responde por UM mês. A comparação com a linha de base não pode ser de um mês
 * contra doze — isso compara sazonalidade, não desempenho, e o próprio
 * `compararComALinhaDeBase` recusa quando os tamanhos diferem mais que o dobro. Então o lado de cá
 * precisa somar uma JANELA de meses, e é isso que este módulo faz.
 *
 * ⚠️ **A regra que manda aqui é a da unidade.** Só entra na quantidade o serviço cuja unidade é a
 * mesma que foi declarada no ajuste. Somar 200 m de rodapé com 800 m² de piso daria 1.000 de coisa
 * nenhuma, e o R$/unidade sairia diluído — parecendo economia. O que sobra não some: volta em
 * `ignoradoPorUnidade` para a tela mostrar.
 */
import type { FinanceiroEntry, RDO, Shift } from '@/types'
import { filterEntries } from '@/features/financeiro/lib/financeiroCalc'
import { calcShiftHours } from '@/features/mao-de-obra/utils/cltEngine'
import type { Indicadores } from './linhaDeBaseMedida'

const r2 = (n: number) => Math.round(n * 100) / 100

/** `2026-08` menos 2 → `['2026-06','2026-07','2026-08']`. */
export function janelaDeMeses(ate: string, quantos: number): string[] {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ate ?? '')
  if (!m || quantos < 1) return []
  const ano = Number(m[1])
  const mes = Number(m[2])
  const saida: string[] = []
  for (let i = quantos - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1))
    saida.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return saida
}

/** Primeiro e último dia de uma janela de meses, em ISO. */
export function limitesDaJanela(meses: string[]): { de: string; ate: string } | null {
  if (!meses.length) return null
  const primeiro = meses[0]
  const ultimo = meses[meses.length - 1]
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ultimo)
  if (!m || !/^\d{4}-(0[1-9]|1[0-2])$/.test(primeiro)) return null
  const fim = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()
  return { de: `${primeiro}-01`, ate: `${ultimo}-${String(fim).padStart(2, '0')}` }
}

/**
 * Unidade comparável: sem acento, sem espaço, maiúscula, e `M2` valendo `M²`.
 *
 * ⚠️ `M` e `M2` continuam **diferentes** de propósito. Metro e metro quadrado medem coisas
 * distintas, e a hora em que este normalizador juntar os dois é a hora em que o número da tela
 * deixa de significar alguma coisa.
 */
export function unidadeComparavel(u: string): string {
  const base = (u ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
  return base.replace(/^M2$/, 'M²').replace(/^M3$/, 'M³')
}

export interface ProducaoDaPlataforma {
  /** Só o que casa com a unidade declarada. */
  quantidade: number
  /** Horas de turno da obra na janela. `null` quando não há turno nenhum — não é zero, é ausência. */
  homensHora: number | null
  custoBRL: number
  meses: number
  /** O que ficou de fora, por unidade. Para a tela mostrar; nunca para somar. */
  ignoradoPorUnidade: { unidade: string; quantidade: number }[]
  rdosLidos: number
  /** RDO em rascunho não conta — o número dele ainda vai mudar. */
  rdosRascunho: number
}

export interface ParamsProducao {
  obraId: string
  meses: string[]
  unidade: string
  rdos: RDO[]
  entries: FinanceiroEntry[]
  /** Já recortados para a obra por quem chama — o recorte tem regra própria. */
  shifts: Shift[]
}

export function producaoDaPlataforma(p: ParamsProducao): ProducaoDaPlataforma {
  const limites = limitesDaJanela(p.meses)
  const vazio: ProducaoDaPlataforma = {
    quantidade: 0, homensHora: null, custoBRL: 0, meses: p.meses.length,
    ignoradoPorUnidade: [], rdosLidos: 0, rdosRascunho: 0,
  }
  if (!limites || !p.obraId) return vazio

  const { de, ate } = limites
  const alvo = unidadeComparavel(p.unidade)

  // ── Quantidade: RDO finalizado, desta obra, dentro da janela ───────────────
  let quantidade = 0
  let rdosLidos = 0
  let rdosRascunho = 0
  const ignorado = new Map<string, number>()

  for (const rdo of p.rdos) {
    if ((rdo.siteId ?? null) !== p.obraId) continue
    if (rdo.date < de || rdo.date > ate) continue
    if (rdo.status === 'rascunho') { rdosRascunho++; continue }
    rdosLidos++
    for (const s of rdo.services ?? []) {
      const q = Number(s.quantity) || 0
      if (q <= 0) continue
      const u = unidadeComparavel(s.unit)
      if (u === alvo) quantidade += q
      else ignorado.set(u || '(sem unidade)', (ignorado.get(u || '(sem unidade)') ?? 0) + q)
    }
  }

  // ── Custo: saídas lançadas nesta obra, na janela ───────────────────────────
  // Mesma regra do retrato: lançamento sem obra NÃO é rateado. Ratear despesa administrativa é
  // uma decisão de negócio que ninguém tomou.
  const custoBRL = r2(
    filterEntries(p.entries, { from: de, to: ate, obraId: p.obraId })
      .filter((e) => e.tipo === 'saida')
      .reduce((s, e) => s + e.valor, 0),
  )

  // ── Homens-hora: turno de verdade, com início, fim e intervalo ─────────────
  const naJanela = p.shifts.filter((sh) => sh.date >= de && sh.date <= ate)
  const homensHora = naJanela.length
    ? r2(naJanela.reduce((s, sh) => s + calcShiftHours(sh), 0))
    : null

  return {
    quantidade: r2(quantidade),
    homensHora,
    custoBRL,
    meses: p.meses.length,
    ignoradoPorUnidade: [...ignorado]
      .map(([unidade, q]) => ({ unidade, quantidade: r2(q) }))
      .sort((a, b) => b.quantidade - a.quantidade),
    rdosLidos,
    rdosRascunho,
  }
}

/**
 * O que a plataforma mediu, no formato que a comparação come.
 *
 * ⚠️ Divisão por zero devolve `null`, não `0`. Um `R$ 0,00/m²` no lugar de "não dá para calcular"
 * seria lido como custo zero — e num painel de economia isso é a leitura mais cara possível.
 */
export function indicadoresDaProducao(p: ProducaoDaPlataforma): Indicadores {
  return {
    quantidade: p.quantidade,
    custoBRL: p.custoBRL,
    homensHora: p.homensHora,
    custoPorUnidade: p.quantidade > 0 ? r2(p.custoBRL / p.quantidade) : null,
    hhPorUnidade: p.homensHora !== null && p.quantidade > 0 ? p.homensHora / p.quantidade : null,
    meses: p.meses,
  }
}
