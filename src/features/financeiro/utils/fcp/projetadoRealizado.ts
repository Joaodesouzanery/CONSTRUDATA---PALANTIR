/**
 * Projetado × Realizado — o FCP contra o Controle de Caixa.
 *
 * ─── A PERGUNTA QUE ISTO RESPONDE ─────────────────────────────────────────────
 * "A obra está gastando o que a gente planejou?" Até aqui o produto tinha o plano numa aba e o
 * caixa noutra, e a pessoa fazia a conta de cabeça. Este arquivo faz a conta — e é PURO: recebe o
 * plano, as obras e os lançamentos, e não escreve nada.
 *
 * ─── AS TRÊS DECISÕES QUE DEFINEM O RESULTADO ─────────────────────────────────
 * **1. A régua é o MÊS.** O motor lança o custo do mês M no mês M+1 (é quando a folha é paga), e o
 * caixa é por data de pagamento. O mês absorve isso; a semana geraria picos artificiais.
 *
 * **2. Projetado comparável = `saiDoCaixa`, nunca `totalDespesas`.** Só o que a EMPRESA paga tem
 * contrapartida no Controle de Caixa. O que o consórcio banca vira desconto sobre a medição e
 * nunca passa pelo caixa da empresa — somá-lo daria um "estouro" que não existe.
 *
 * **3. Obra sem vínculo com o FCP não entra no total.** O plano projeta por CIDADE; a obra chega a
 * uma cidade pelo `fcpCidadeId` do contrato. Sem ele, o realizado da obra é mostrado à parte —
 * para o dinheiro não sumir — e nunca somado ao projetado. E com N obras na mesma cidade, o
 * projetado fica na linha da cidade: ratear por número de obras seria inventar.
 */
import type { ConstructionSite, FinanceiroEntry } from '@/types'
import type { PlanoFcp } from '@/store/fcpStore'
import type { Cenario, PremissasFcp } from './tipos'
import { CENARIOS } from './tipos'
import { fluxoMensal, diferencaEmDias, somarDias, semanaDoFcp } from './motor'
import type { ProducaoRealizada } from './motor'
import { vinculosDeObra } from '@/features/rdo/utils/wcrParaFcp'
import { ehDoCaixa } from '../caixaAgrupar'

// ─── Qual plano ───────────────────────────────────────────────────────────────

export type EscolhaDePlano =
  | { plano: PlanoFcp; motivo: 'da-obra' | 'unico' }
  | { plano: null; motivo: 'sem-plano' | 'ambiguo'; candidatos: number }

/**
 * O plano a usar para uma obra.
 *
 * ⚠️ O `FcpPanel` pega `planos[0]` — o primeiro da org, não o da obra. Aqui a regra é explícita:
 * o plano DA obra (aprovado antes de rascunho, mais recente antes de mais antigo); senão o único
 * plano da org; senão a tela diz que há N planos e nenhum é desta obra.
 */
export function planoDaObra(planos: PlanoFcp[], siteId: string | null): EscolhaDePlano {
  const daObra = siteId ? planos.filter((p) => p.obraId === siteId) : []
  if (daObra.length > 0) {
    const ordenado = [...daObra].sort((a, b) =>
      (b.status === 'aprovado' ? 1 : 0) - (a.status === 'aprovado' ? 1 : 0)
      || b.criadoEm.localeCompare(a.criadoEm))
    return { plano: ordenado[0], motivo: 'da-obra' }
  }
  if (planos.length === 1) return { plano: planos[0], motivo: 'unico' }
  return { plano: null, motivo: planos.length === 0 ? 'sem-plano' : 'ambiguo', candidatos: planos.length }
}

// ─── Rateio por dia ───────────────────────────────────────────────────────────

/**
 * Uma despesa "01 A 10/07" tem uma `data` só. Jogá-la inteira no dia 1 distorce qualquer régua —
 * semana, mês, dia parado. Aqui ela é dividida em partes iguais por dia.
 *
 * Sem `dataFim`, ou com `dataFim` antes de `data`, ou com mais de um ano de intervalo (erro de
 * digitação, não período), fica tudo em `data`.
 */
export function ratearPorDia(e: Pick<FinanceiroEntry, 'valor' | 'data' | 'dataFim'>): Array<{ data: string; valor: number }> {
  if (!e.dataFim) return [{ data: e.data, valor: e.valor }]
  const dias = diferencaEmDias(e.data, e.dataFim) + 1
  if (dias < 1 || dias > 366) return [{ data: e.data, valor: e.valor }]
  const porDia = e.valor / dias
  const saida: Array<{ data: string; valor: number }> = []
  for (let i = 0; i < dias; i++) saida.push({ data: somarDias(e.data, i), valor: porDia })
  return saida
}

// ─── Realizado ────────────────────────────────────────────────────────────────

export interface RealizadoDoPeriodo {
  /** `yyyy-MM` no mensal; o número da semana no semanal. */
  periodo: string
  saidas: number
  /** Só `medicao` e `adiantamento` — é o fallback de receita quando o contrato não tem notas. */
  entradas: number
  lancamentos: number
  porCategoria: Record<string, number>
}

const dentro = (dia: string, f: { from?: string; to?: string }) =>
  (!f.from || dia >= f.from) && (!f.to || dia <= f.to)

function acumular(
  entries: FinanceiroEntry[],
  obraIds: ReadonlySet<string>,
  chaveDoDia: (dia: string) => string | null,
  f: { from?: string; to?: string },
): RealizadoDoPeriodo[] {
  const m = new Map<string, RealizadoDoPeriodo>()
  for (const e of entries) {
    if (!ehDoCaixa(e)) continue
    if (!e.obraId || !obraIds.has(e.obraId)) continue
    const ehReceita = e.tipo === 'entrada'
    if (ehReceita && e.categoria !== 'medicao' && e.categoria !== 'adiantamento') continue
    let contou = false
    for (const parte of ratearPorDia(e)) {
      if (!dentro(parte.data, f)) continue
      const k = chaveDoDia(parte.data)
      if (k === null) continue
      const v = m.get(k) ?? { periodo: k, saidas: 0, entradas: 0, lancamentos: 0, porCategoria: {} }
      if (ehReceita) v.entradas += parte.valor
      else {
        v.saidas += parte.valor
        v.porCategoria[e.categoria] = (v.porCategoria[e.categoria] ?? 0) + parte.valor
      }
      if (!contou) { v.lancamentos++; contou = true }
      m.set(k, v)
    }
  }
  return [...m.values()].sort((a, b) => a.periodo.localeCompare(b.periodo, undefined, { numeric: true }))
}

export function realizadoPorMes(entries: FinanceiroEntry[], f: { obraIds: string[]; from?: string; to?: string }): RealizadoDoPeriodo[] {
  return acumular(entries, new Set(f.obraIds), (dia) => dia.slice(0, 7), f)
}

export function realizadoPorSemana(
  entries: FinanceiroEntry[], p: PremissasFcp, f: { obraIds: string[]; quantidade?: number },
): RealizadoDoPeriodo[] {
  const max = f.quantidade ?? 12
  return acumular(entries, new Set(f.obraIds), (dia) => {
    const s = semanaDoFcp(dia, p)
    return s === null || s > max ? null : String(s)
  }, {})
}

/**
 * Receita realizada pela fonte primária: as notas do contrato marcadas como RECEBIDAS.
 *
 * O `recebimento` do FCP é "o cliente pagou a medição" — e o lugar onde a equipe registra isso é
 * o extrato de notas da obra, não o caixa. Usar as duas fontes somaria a mesma nota duas vezes
 * (a baixa do título também vira lançamento). Nota recebida sem `dataRecebimento` não cabe em mês
 * nenhum: é contada em `semData` e a tela diz.
 */
export function recebidoPorMes(sites: ConstructionSite[], obraIds: string[]): {
  meses: Array<{ periodo: string; valor: number; notas: number }>
  semData: number
  temNotas: boolean
} {
  const alvo = new Set(obraIds)
  const m = new Map<string, { periodo: string; valor: number; notas: number }>()
  let semData = 0
  let temNotas = false
  for (const s of sites) {
    if (!alvo.has(s.id)) continue
    for (const n of s.contrato?.faturamentos ?? []) {
      temNotas = true
      if (n.situacao !== 'recebido') continue
      if (!n.dataRecebimento) { semData++; continue }
      const k = n.dataRecebimento.slice(0, 7)
      const v = m.get(k) ?? { periodo: k, valor: 0, notas: 0 }
      v.valor += n.valor
      v.notas++
      m.set(k, v)
    }
  }
  return { meses: [...m.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)), semData, temNotas }
}

// ─── A comparação ─────────────────────────────────────────────────────────────

export interface LinhaComparada {
  periodo: string
  rotulo: string
  /** `null` = não há projetado honesto (obra sem vínculo; cidade com N obras). */
  projetado: number | null
  /** `null` = mês futuro. */
  realizado: number | null
  /** Mês corrente: o realizado ainda está andando. */
  parcial: boolean
  diferenca: number | null
  /** realizado ÷ projetado. `null` quando um dos dois não existe ou projetado é 0. */
  aderencia: number | null
}

export interface Comparacao {
  despesas: LinhaComparada[]
  receitas: LinhaComparada[]
  total: { despesas: LinhaComparada; receitas: LinhaComparada }
  porCidade: Array<{ cidadeId: string; nome: string; obras: number; despesas: LinhaComparada; receitas: LinhaComparada }>
  porObra: Array<{ siteId: string; nome: string; cidadeId: string; despesas: LinhaComparada; receitas: LinhaComparada; oQueFalta?: string }>
  /** Obras selecionadas sem `fcpCidadeId`. Aparecem, com o realizado — e NUNCA somam no total. */
  semVinculo: Array<{ siteId: string; nome: string; realizadoSaidas: number }>
  /** De onde veio a receita realizada. */
  fonteDaReceita: 'contrato' | 'caixa'
  notasRecebidasSemData: number
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloDoMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`

function linha(periodo: string, rotulo: string, projetado: number | null, realizado: number | null, parcial: boolean): LinhaComparada {
  const ambos = projetado !== null && realizado !== null
  return {
    periodo, rotulo, projetado, realizado, parcial,
    diferenca: ambos ? realizado - projetado : null,
    aderencia: ambos && projetado !== 0 ? realizado / projetado : null,
  }
}

function somar(linhas: LinhaComparada[], rotulo: string): LinhaComparada {
  const comReal = linhas.filter((l) => l.realizado !== null)
  const proj = comReal.reduce((a, l) => a + (l.projetado ?? 0), 0)
  const temProj = comReal.some((l) => l.projetado !== null)
  const real = comReal.reduce((a, l) => a + (l.realizado ?? 0), 0)
  return linha('total', rotulo, temProj ? proj : null, comReal.length ? real : null, comReal.some((l) => l.parcial))
}

export function compararProjetadoRealizado(args: {
  plano: PlanoFcp
  sites: ConstructionSite[]
  entries: FinanceiroEntry[]
  /** Sem `obraIds`, todas as obras. */
  obraIds?: string[]
  periodo: { from?: string; to?: string }
  hoje: string
}): Comparacao {
  const { plano, sites, entries, periodo, hoje } = args
  const p = plano.premissas
  const cidadesDoPlano = new Map(p.cidades.map((c) => [c.id, c]))
  const selecionadas = args.obraIds ? sites.filter((s) => args.obraIds!.includes(s.id)) : sites
  const vinculos = vinculosDeObra(selecionadas).filter((v) => cidadesDoPlano.has(v.cidadeId))
  const cidadeDaObra = new Map(vinculos.map((v) => [v.siteId, v.cidadeId]))
  const obrasVinculadas = selecionadas.filter((s) => cidadeDaObra.has(s.id))
  const semVinculoSites = selecionadas.filter((s) => !cidadeDaObra.has(s.id))
  const cidadesUsadas = new Set(vinculos.map((v) => v.cidadeId))
  const mesAtual = hoje.slice(0, 7)

  const colunas = fluxoMensal(p, plano.realizado as ProducaoRealizada)
    .filter((c) => {
      const ym = c.mes.mes.slice(0, 7)
      return (!periodo.from || ym >= periodo.from.slice(0, 7)) && (!periodo.to || ym <= periodo.to.slice(0, 7))
    })

  const realizadoIds = obrasVinculadas.map((s) => s.id)
  const realMes = new Map(realizadoPorMes(entries, { obraIds: realizadoIds, ...periodo }).map((r) => [r.periodo, r]))
  const recebido = recebidoPorMes(sites, realizadoIds)
  const fonteDaReceita: Comparacao['fonteDaReceita'] = recebido.temNotas ? 'contrato' : 'caixa'
  const recMes = new Map(recebido.meses.map((r) => [r.periodo, r.valor]))

  const projetadoDasCidades = (col: (typeof colunas)[number], ids: ReadonlySet<string>, campo: 'saiDoCaixa' | 'recebimento') =>
    col.porCidade.filter((c) => ids.has(c.cidadeId)).reduce((a, c) => a + c[campo], 0)

  const receitaReal = (ym: string, ids: string[]) => fonteDaReceita === 'contrato'
    ? recebidoPorMes(sites, ids).meses.find((r) => r.periodo === ym)?.valor ?? 0
    : realizadoPorMes(entries, { obraIds: ids, ...periodo }).find((r) => r.periodo === ym)?.entradas ?? 0

  const despesas: LinhaComparada[] = []
  const receitas: LinhaComparada[] = []
  for (const col of colunas) {
    const ym = col.mes.mes.slice(0, 7)
    const futuro = ym > mesAtual
    const parcial = ym === mesAtual
    despesas.push(linha(ym, rotuloDoMes(ym), projetadoDasCidades(col, cidadesUsadas, 'saiDoCaixa'),
      futuro ? null : (realMes.get(ym)?.saidas ?? 0), parcial))
    receitas.push(linha(ym, rotuloDoMes(ym), projetadoDasCidades(col, cidadesUsadas, 'recebimento'),
      futuro ? null : (fonteDaReceita === 'contrato' ? (recMes.get(ym) ?? 0) : (realMes.get(ym)?.entradas ?? 0)), parcial))
  }

  // Por cidade e por obra: o acumulado do período (só meses ≤ hoje).
  const colunasAteHoje = colunas.filter((c) => c.mes.mes.slice(0, 7) <= mesAtual)
  const parcialNoPeriodo = colunas.some((c) => c.mes.mes.slice(0, 7) === mesAtual)
  const somaReal = (ids: string[], campo: 'saidas' | 'entradas') =>
    realizadoPorMes(entries, { obraIds: ids, ...periodo })
      .filter((r) => r.periodo <= mesAtual).reduce((a, r) => a + r[campo], 0)
  const somaReceita = (ids: string[]) => colunasAteHoje.reduce((a, c) => a + receitaReal(c.mes.mes.slice(0, 7), ids), 0)

  const porCidade: Comparacao['porCidade'] = []
  const porObra: Comparacao['porObra'] = []
  for (const cidadeId of cidadesUsadas) {
    const cidade = cidadesDoPlano.get(cidadeId)!
    const obras = obrasVinculadas.filter((s) => cidadeDaObra.get(s.id) === cidadeId)
    const ids = obras.map((s) => s.id)
    const so = new Set([cidadeId])
    const projD = colunasAteHoje.reduce((a, c) => a + projetadoDasCidades(c, so, 'saiDoCaixa'), 0)
    const projR = colunasAteHoje.reduce((a, c) => a + projetadoDasCidades(c, so, 'recebimento'), 0)
    porCidade.push({
      cidadeId, nome: cidade.nome, obras: obras.length,
      despesas: linha('total', cidade.nome, projD, somaReal(ids, 'saidas'), parcialNoPeriodo),
      receitas: linha('total', cidade.nome, projR, somaReceita(ids), parcialNoPeriodo),
    })
    for (const s of obras) {
      // Uma obra só na cidade: o projetado da cidade É o da obra. Duas ou mais: não há rateio honesto.
      const unica = obras.length === 1
      porObra.push({
        siteId: s.id, nome: s.name, cidadeId,
        despesas: linha('total', s.name, unica ? projD : null, somaReal([s.id], 'saidas'), parcialNoPeriodo),
        receitas: linha('total', s.name, unica ? projR : null, somaReceita([s.id]), parcialNoPeriodo),
        oQueFalta: unica ? undefined : `o FCP projeta por cidade, e ${cidade.nome} tem ${obras.length} obras — o projetado está na linha da cidade`,
      })
    }
  }

  const semVinculo = semVinculoSites.map((s) => ({
    siteId: s.id, nome: s.name, realizadoSaidas: somaReal([s.id], 'saidas'),
  }))

  return {
    despesas, receitas,
    total: { despesas: somar(despesas, 'Despesas'), receitas: somar(receitas, 'Receitas') },
    porCidade, porObra, semVinculo, fonteDaReceita, notasRecebidasSemData: recebido.semData,
  }
}

// ─── O semáforo, só no acumulado ──────────────────────────────────────────────

export type TomAderencia = 'ok' | 'atencao' | 'grave' | 'sem-dado'

/**
 * Só faz sentido no ACUMULADO: o mês isolado tem ruído estrutural (custo lançado em M+1, rateio de
 * "01 A 10", mês corrente parcial). Despesa abaixo do projetado também é atenção — a causa mais
 * provável é caixa incompleto, não economia.
 */
export function tomDaAderencia(aderencia: number | null, sentido: 'despesa' | 'receita'): TomAderencia {
  if (aderencia === null || !Number.isFinite(aderencia)) return 'sem-dado'
  if (sentido === 'despesa') {
    if (aderencia < 0.75) return 'atencao'
    if (aderencia <= 1.10) return 'ok'
    if (aderencia <= 1.25) return 'atencao'
    return 'grave'
  }
  if (aderencia >= 0.90) return 'ok'
  if (aderencia >= 0.75) return 'atencao'
  return 'grave'
}

// ─── Qual cenário a obra está performando ─────────────────────────────────────

/**
 * O caixa acumulado que cada cenário projeta até um mês, só para as cidades pedidas.
 *
 * ⚠️ Compara-se contra `acumuladoDepois` do fluxo de CAIXA — não contra o econômico, que é
 * competência e inclui o que o consórcio banca. O caixa real não tem nada disso.
 */
export function acumuladoPorCenarioAteMes(
  p: PremissasFcp, realizado: ProducaoRealizada, mesISO: string, cidadeIds: ReadonlySet<string>,
): Record<Cenario, number | null> {
  const ym = mesISO.slice(0, 7)
  const saida = {} as Record<Cenario, number | null>
  for (const cenario of CENARIOS) {
    const col = fluxoMensal({ ...p, cenario }, realizado).find((c) => c.mes.mes.slice(0, 7) === ym)
    saida[cenario] = col
      ? col.porCidade.filter((c) => cidadeIds.has(c.cidadeId)).reduce((a, c) => a + c.acumuladoDepois, 0)
      : null
  }
  return saida
}

export function cenarioMaisProximo(real: number, porCenario: Record<Cenario, number | null>): { cenario: Cenario; distancia: number } | null {
  let melhor: { cenario: Cenario; distancia: number } | null = null
  for (const c of CENARIOS) {
    const v = porCenario[c]
    if (v === null) continue
    const d = Math.abs(real - v)
    if (!melhor || d < melhor.distancia) melhor = { cenario: c, distancia: d }
  }
  return melhor
}
