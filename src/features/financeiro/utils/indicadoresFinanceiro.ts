/**
 * Os indicadores que cruzam RDO × Controle de Caixa × FCP.
 *
 * ─── A REGRA QUE VALE PARA TODOS ──────────────────────────────────────────────
 * Dado ausente é cinza, com `oQueFalta` dizendo o que preencher — nunca `0`, nunca verde. É a
 * mesma regra de `indicadores.ts`, e existe porque o produto já mostrou "R$ 0,00/m" em verde numa
 * obra que simplesmente não tinha RDO.
 *
 * ─── DE ONDE VEM O "CUSTO DO DIA" ─────────────────────────────────────────────
 * ⚠️ Do Controle de Caixa, não do RDO. O RDO WCR grava `employeeNames: []` e por isso nunca gera
 * lançamento no Financeiro; o RDO Compizzo gera, mas com `sourceRdoId` — e `ehDoCaixa` o exclui de
 * propósito, senão a folha contaria duas vezes. Custo = saídas do caixa por obra e dia, rateadas.
 *
 * Tudo aqui é puro: recebe os dados, devolve indicadores. Total e por obra em cada um.
 */
import type { ConstructionSite, FinanceiroEntry, RDO, PlanHoliday, WorkWeekMode } from '@/types'
import type { PlanoFcp } from '@/store/fcpStore'
import type { DiaSemProducao } from '@/store/diasSemProducaoStore'
import { rotuloMotivo } from '@/store/diasSemProducaoStore'
import type { Explicacao } from '@/components/shared/explicacao'
import { ehDiaCobravel } from '@/features/rdo/utils/statusRdoDia'
import { ehWcrFinalizado, producaoDosRdos, vinculosDeObra } from '@/features/rdo/utils/wcrParaFcp'
import { rotuloDaCategoria } from './controleDeCaixaModelo'
import { ehDoCaixa, agruparCaixa } from './caixaAgrupar'
import { ratearPorDia, acumuladoPorCenarioAteMes, cenarioMaisProximo, realizadoPorMes, recebidoPorMes } from './fcp/projetadoRealizado'
import { ticketDaCidade, semanaDoFcp, diferencaEmDias, mesesDeCaixa } from './fcp/motor'
import type { ProducaoRealizada } from './fcp/motor'
import { ROTULO_CENARIO } from './fcp/tipos'

export type TomFinanceiro = 'ok' | 'atencao' | 'grave' | 'sem-dado' | 'neutro'

export interface LinhaPorObra { siteId: string; nome: string; valor: string; detalhe?: string; tom: TomFinanceiro }

export interface IndicadorFinanceiro {
  id: string
  /** Rótulo = `${sigla} · ${titulo}`. A sigla sozinha não diz nada a quem não conhece a série. */
  sigla: string
  titulo: string
  valor: string
  detalhe: string
  tom: TomFinanceiro
  /** `oQueFalta` obrigatório quando `tom === 'sem-dado'`. */
  explicacao: Explicacao
  porObra: LinhaPorObra[]
  serie?: Array<{ periodo: string; valor: number | null }>
}

export interface EntradaIndicadores {
  plano: PlanoFcp | null
  sites: ConstructionSite[]
  entries: FinanceiroEntry[]
  rdos: RDO[]
  diasSemProducao: DiaSemProducao[]
  feriados: PlanHoliday[]
  jornada: WorkWeekMode
  hoje: string
  periodo: { from?: string; to?: string }
  obraIds?: string[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const pct = (n: number) => `${(n * 100).toFixed(0)}%`
const dentro = (dia: string, f: { from?: string; to?: string }) => (!f.from || dia >= f.from) && (!f.to || dia <= f.to)

function semDado(base: Omit<IndicadorFinanceiro, 'valor' | 'tom' | 'porObra'> & { porObra?: LinhaPorObra[] }, oQueFalta: string): IndicadorFinanceiro {
  return { ...base, valor: '—', tom: 'sem-dado', porObra: base.porObra ?? [], explicacao: { ...base.explicacao, oQueFalta } }
}

// ─── Índices compartilhados ───────────────────────────────────────────────────

function obrasAlvo(e: EntradaIndicadores): ConstructionSite[] {
  return e.obraIds ? e.sites.filter((s) => e.obraIds!.includes(s.id)) : e.sites
}

/** Saídas do caixa por obra e por dia, rateadas. `categoria` restringe (ex.: só mão de obra). */
function custoPorObraDia(e: EntradaIndicadores, obras: ConstructionSite[], categoria?: string): Map<string, Map<string, number>> {
  const ids = new Set(obras.map((s) => s.id))
  const m = new Map<string, Map<string, number>>()
  for (const x of e.entries) {
    if (!ehDoCaixa(x) || x.tipo !== 'saida' || !x.obraId || !ids.has(x.obraId)) continue
    if (categoria && x.categoria !== categoria) continue
    for (const parte of ratearPorDia(x)) {
      if (!dentro(parte.data, e.periodo)) continue
      const porDia = m.get(x.obraId) ?? new Map<string, number>()
      porDia.set(parte.data, (porDia.get(parte.data) ?? 0) + parte.valor)
      m.set(x.obraId, porDia)
    }
  }
  return m
}

/** Produção WCR por obra e por dia. Só RDO finalizado com apontamento. */
function producaoPorObraDia(e: EntradaIndicadores, obras: ConstructionSite[]): Map<string, Map<string, { metros: number; unidades: number }>> {
  const ids = new Set(obras.map((s) => s.id))
  const m = new Map<string, Map<string, { metros: number; unidades: number }>>()
  for (const r of e.rdos) {
    if (!ehWcrFinalizado(r) || !r.siteId || !ids.has(r.siteId) || !dentro(r.date, e.periodo)) continue
    const prod = producaoDosRdos([r])
    const porDia = m.get(r.siteId) ?? new Map()
    const v = porDia.get(r.date) ?? { metros: 0, unidades: 0 }
    v.metros += prod.metros
    v.unidades += prod.unidades
    porDia.set(r.date, v)
    m.set(r.siteId, porDia)
  }
  return m
}

// ─── A · produtividade de campo ───────────────────────────────────────────────

/** Razão das somas, não média das razões — um dia de 2 m e R$ 5 mil não pode pesar como um de 200 m. */
function custoPorMetroDe(custo: Map<string, number> | undefined, prod: Map<string, { metros: number }> | undefined): { custo: number; metros: number } {
  let c = 0, mts = 0
  for (const [dia, p] of prod ?? []) {
    if (p.metros <= 0) continue
    mts += p.metros
    c += custo?.get(dia) ?? 0
  }
  return { custo: c, metros: mts }
}

export function custoPorMetro(e: EntradaIndicadores): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const custo = custoPorObraDia(e, obras, 'mao_de_obra')
  const prod = producaoPorObraDia(e, obras)
  const base = {
    id: 'a1', sigla: 'A1', titulo: 'custo por metro executado', detalhe: '',
    explicacao: {
      oQueE: 'Quanto de mão de obra a empresa pagou por metro de rede executado. É o número que se compara com o ticket do FCP — em tempo real, não só no fechamento.',
      deOndeVem: 'Mão de obra do Controle de Caixa (por obra e dia) ÷ metros lançados nos RDOs WCR dos mesmos dias. Só dias com metragem entram.',
    },
  }
  const porObra: LinhaPorObra[] = []
  let cT = 0, mT = 0
  for (const s of obras) {
    const { custo: c, metros } = custoPorMetroDe(custo.get(s.id), prod.get(s.id))
    if (metros <= 0) { porObra.push({ siteId: s.id, nome: s.name, valor: '—', tom: 'sem-dado', detalhe: 'sem RDO com metragem' }); continue }
    cT += c; mT += metros
    porObra.push({ siteId: s.id, nome: s.name, valor: `${brl(c / metros)}/m`, tom: 'neutro', detalhe: `${num(metros, 0)} m · ${brl(c)}` })
  }
  if (mT <= 0) return semDado({ ...base, porObra }, 'lance RDO WCR com metragem (PRA/PRE) e despesas de mão de obra no Controle de Caixa com a obra preenchida')
  return { ...base, valor: `${brl(cT / mT)}/m`, detalhe: `${num(mT, 0)} m executados · ${brl(cT)} de mão de obra`, tom: 'neutro', porObra }
}

export function diasComDespesaSemRdo(e: EntradaIndicadores): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const custo = custoPorObraDia(e, obras, 'mao_de_obra')
  const feriados = new Set(e.feriados.map((f) => f.date))
  const comRdo = new Set(e.rdos.filter((r) => r.status !== 'rascunho' && r.siteId).map((r) => `${r.siteId}|${r.date}`))
  const parados = new Set(e.diasSemProducao.map((d) => `${d.siteId}|${d.data}`))
  const base = {
    id: 'a2', sigla: 'A2', titulo: 'dias com mão de obra e sem RDO', detalhe: '',
    explicacao: {
      oQueE: 'Dias em que saiu dinheiro de mão de obra e não existe RDO daquele dia. Ou faltou o relatório, ou a despesa está na obra errada — os dois merecem olhar.',
      deOndeVem: 'Dias úteis da obra (feriados e jornada do Planejamento) com saída de mão de obra no caixa, sem RDO finalizado e sem registro de dia parado.',
    },
  }
  const porObra: LinhaPorObra[] = []
  let total = 0, valorTotal = 0, temMO = false
  for (const s of obras) {
    const porDia = custo.get(s.id)
    if (!porDia) { porObra.push({ siteId: s.id, nome: s.name, valor: '—', tom: 'sem-dado' }); continue }
    temMO = true
    let n = 0, v = 0
    for (const [dia, valor] of porDia) {
      if (dia > e.hoje || valor <= 0) continue
      if (!ehDiaCobravel(s, dia, feriados, e.jornada).cobra) continue
      if (comRdo.has(`${s.id}|${dia}`) || parados.has(`${s.id}|${dia}`)) continue
      n++; v += valor
    }
    total += n; valorTotal += v
    porObra.push({ siteId: s.id, nome: s.name, valor: String(n), detalhe: n ? brl(v) : undefined, tom: n === 0 ? 'ok' : n < 5 ? 'atencao' : 'grave' })
  }
  if (!temMO) return semDado({ ...base, porObra }, 'lançamentos de mão de obra no Controle de Caixa com a obra preenchida')
  return { ...base, valor: String(total), detalhe: total ? `${brl(valorTotal)} sem relatório do dia` : 'todo gasto de mão de obra tem RDO', tom: total === 0 ? 'ok' : total < 5 ? 'atencao' : 'grave', porObra }
}

export function custoDoDiaParado(e: EntradaIndicadores): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const ids = new Set(obras.map((s) => s.id))
  const custo = custoPorObraDia(e, obras)
  const base = {
    id: 'a3', sigla: 'A3', titulo: 'custo do dia parado', detalhe: '',
    explicacao: {
      oQueE: 'Dinheiro que saiu em dia sem produção — chuva, área não liberada, falta de material. É o custo de a obra existir sem andar.',
      deOndeVem: 'Dias marcados como "sem produção" no RDO × saídas do Controle de Caixa da obra nesses dias, rateadas.',
    },
  }
  const parados = e.diasSemProducao.filter((d) => ids.has(d.siteId) && dentro(d.data, e.periodo))
  if (parados.length === 0) return semDado(base, 'registre os dias sem produção na tela do RDO (chuva, área não liberada…)')
  const porMotivo = new Map<string, number>()
  const porObra: LinhaPorObra[] = []
  let total = 0
  for (const s of obras) {
    const dias = parados.filter((d) => d.siteId === s.id)
    if (dias.length === 0) continue
    const porDia = custo.get(s.id)
    let v = 0
    for (const d of dias) {
      const x = porDia?.get(d.data) ?? 0
      v += x
      porMotivo.set(d.categoria, (porMotivo.get(d.categoria) ?? 0) + x)
    }
    total += v
    porObra.push({ siteId: s.id, nome: s.name, valor: porDia ? brl(v) : '—', detalhe: `${dias.length} dia(s) parado(s)`, tom: porDia ? 'neutro' : 'sem-dado' })
  }
  const motivos = [...porMotivo.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${rotuloMotivo(k)} ${brl(v)}`).join(' · ')
  return { ...base, valor: brl(total), detalhe: `${parados.length} dia(s) · ${motivos}`, tom: 'neutro', porObra }
}

export function tendenciaCustoPorMetro(e: EntradaIndicadores): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const custo = custoPorObraDia(e, obras, 'mao_de_obra')
  const prod = producaoPorObraDia(e, obras)
  const chave = (dia: string) => e.plano ? (semanaDoFcp(dia, e.plano.premissas) ?? 0) && `S${semanaDoFcp(dia, e.plano.premissas)}` : dia.slice(0, 7)
  const acc = new Map<string, { c: number; m: number }>()
  for (const s of obras) {
    for (const [dia, p] of prod.get(s.id) ?? []) {
      if (p.metros <= 0) continue
      const k = chave(dia); if (!k) continue
      const v = acc.get(k) ?? { c: 0, m: 0 }
      v.c += custo.get(s.id)?.get(dia) ?? 0; v.m += p.metros
      acc.set(k, v)
    }
  }
  const serie = [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([periodo, v]) => ({ periodo, valor: v.m > 0 ? v.c / v.m : null }))
  const base = {
    id: 'a4', sigla: 'A4', titulo: 'tendência do custo por metro', detalhe: '',
    explicacao: {
      oQueE: 'Se a equipe está ficando mais cara (ou mais lenta) com o tempo. A seta compara o último período com a média dos três anteriores.',
      deOndeVem: 'O mesmo custo por metro, por semana do FCP (ou por mês, sem plano).',
    },
    serie,
  }
  const validos = serie.filter((s) => s.valor !== null)
  if (validos.length < 2) return semDado(base, 'pelo menos duas semanas com metragem e mão de obra')
  const ultimo = validos[validos.length - 1].valor!
  const anteriores = validos.slice(-4, -1).map((s) => s.valor!)
  const media = anteriores.reduce((a, b) => a + b, 0) / anteriores.length
  const delta = (ultimo - media) / media
  const seta = delta > 0.05 ? '↑ piorou' : delta < -0.05 ? '↓ melhorou' : '→ estável'
  return { ...base, valor: `${brl(ultimo)}/m ${seta}`, detalhe: `${validos[validos.length - 1].periodo} vs média de ${anteriores.length} anteriores (${brl(media)}/m)`, tom: 'neutro', porObra: [] }
}

// ─── B · concentração ─────────────────────────────────────────────────────────

function topN(e: EntradaIndicadores, id: string, sigla: string, titulo: string, chave: (x: FinanceiroEntry) => string[], oQueE: string, nota?: string): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const ids = new Set(obras.map((s) => s.id))
  const saidas = e.entries.filter((x) => ehDoCaixa(x) && x.tipo === 'saida' && x.obraId && ids.has(x.obraId) && dentro(x.data, e.periodo))
  const base = { id, sigla, titulo, detalhe: nota ?? '', explicacao: { oQueE, deOndeVem: 'Saídas do Controle de Caixa no período, agrupadas.' } }
  if (saidas.length === 0) return semDado(base, 'importe a planilha do Controle de Caixa com a obra preenchida')
  const total = saidas.reduce((a, x) => a + x.valor, 0)
  const top = agruparCaixa(saidas, chave).slice(0, 5)
  const porObra: LinhaPorObra[] = obras.map((s) => {
    const mine = saidas.filter((x) => x.obraId === s.id)
    const t = mine.reduce((a, x) => a + x.valor, 0)
    const g = agruparCaixa(mine, chave)[0]
    return g ? { siteId: s.id, nome: s.name, valor: `${g.chave} ${pct(g.despesas / t)}`, tom: 'neutro' as const } : { siteId: s.id, nome: s.name, valor: '—', tom: 'sem-dado' as const }
  })
  return { ...base, valor: `${top[0].chave} ${pct(top[0].despesas / total)}`, detalhe: [top.map((g) => `${g.chave} ${pct(g.despesas / total)}`).join(' · '), nota].filter(Boolean).join(' — '), tom: 'neutro', porObra }
}

export const topCategorias = (e: EntradaIndicadores) => topN(e, 'b1', 'B1', 'top 5 categorias por gasto',
  (x) => [rotuloDaCategoria(x.categoria)], 'Onde o dinheiro está indo. Se Frota é 90% do mês, isto mostra sem abrir o DRE linha a linha.')
export const topSolicitantes = (e: EntradaIndicadores) => topN(e, 'b2', 'B2', 'top 5 solicitantes por valor',
  (x) => (x.solicitantes?.length ? x.solicitantes : ['Sem solicitante']), 'Quem está autorizando mais gasto — útil para saber quem revisar primeiro na Conferência.',
  'lançamento com dois solicitantes conta nos dois')

// ─── C · giro ─────────────────────────────────────────────────────────────────

export function defasagemReal(e: EntradaIndicadores): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const premissa = e.plano?.premissas.defasagemDias
  const base = {
    id: 'c1', sigla: 'C1', titulo: 'defasagem real de recebimento', detalhe: '',
    explicacao: {
      oQueE: 'Quantos dias o cliente demora a pagar depois da nota. Se for mais que a premissa do FCP, a necessidade de capital está subestimada.',
      deOndeVem: 'Média de (data do recebimento − data de emissão) das notas marcadas como recebidas no contrato da obra. A régua é a emissão da NF: o sistema não guarda a data de fechamento da medição.',
    },
  }
  const porObra: LinhaPorObra[] = []
  let soma = 0, n = 0, semData = 0
  for (const s of obras) {
    let so = 0, sn = 0
    for (const nota of s.contrato?.faturamentos ?? []) {
      if (nota.situacao !== 'recebido') continue
      if (!nota.dataRecebimento) { semData++; continue }
      so += diferencaEmDias(nota.data, nota.dataRecebimento); sn++
    }
    soma += so; n += sn
    porObra.push(sn ? { siteId: s.id, nome: s.name, valor: `${num(so / sn, 0)} dias`, detalhe: `${sn} nota(s)`, tom: tomDefasagem(so / sn, premissa) } : { siteId: s.id, nome: s.name, valor: '—', tom: 'sem-dado' })
  }
  if (n === 0) return semDado({ ...base, porObra }, 'marque as notas como recebidas, com a data, em Torre de Controle → Contrato → Faturamento')
  const media = soma / n
  return {
    ...base, valor: `${num(media, 0)} dias`,
    detalhe: `${n} nota(s)${premissa !== undefined ? ` · premissa do FCP: ${premissa} dias` : ''}${semData ? ` · ${semData} recebida(s) sem data` : ''}`,
    tom: tomDefasagem(media, premissa), porObra,
  }
}
function tomDefasagem(media: number, premissa?: number): TomFinanceiro {
  if (premissa === undefined) return 'neutro'
  return media <= premissa + 5 ? 'ok' : media <= premissa + 15 ? 'atencao' : 'grave'
}

export function velocidadeDeConferencia(e: EntradaIndicadores): IndicadorFinanceiro {
  const obras = obrasAlvo(e)
  const ids = new Set(obras.map((s) => s.id))
  const doCaixa = e.entries.filter((x) => (x.origem === 'planilha' || x.origem === 'manual') && x.obraId && ids.has(x.obraId) && dentro(x.data, e.periodo))
  const base = {
    id: 'c3', sigla: 'C3', titulo: 'velocidade de conferência', detalhe: '',
    explicacao: {
      oQueE: 'Quanto tempo um lançamento fica no caixa até alguém conferir. Lançamento velho sem conferência é dinheiro que ninguém olhou.',
      deOndeVem: 'Mediana de (conferido em − criado em) dos lançamentos conferidos; e a idade do pendente mais antigo. Hora extra fica de fora: nasce conferida.',
    },
  }
  const dias = doCaixa.filter((x) => x.conferido && x.conferidoEm).map((x) => (new Date(x.conferidoEm!).getTime() - new Date(x.createdAt).getTime()) / 86_400_000).sort((a, b) => a - b)
  const pendentes = doCaixa.filter((x) => !x.conferido)
  const maisAntigo = pendentes.reduce<number | null>((a, x) => { const d = diferencaEmDias(x.data, e.hoje); return a === null || d > a ? d : a }, null)
  const tom: TomFinanceiro = maisAntigo === null ? 'ok' : maisAntigo <= 7 ? 'ok' : maisAntigo <= 30 ? 'atencao' : 'grave'
  const porObra: LinhaPorObra[] = obras.map((s) => {
    const p = pendentes.filter((x) => x.obraId === s.id).length
    return { siteId: s.id, nome: s.name, valor: `${p} pendente(s)`, tom: p === 0 ? 'ok' : 'atencao' }
  })
  if (dias.length === 0 && pendentes.length === 0) return semDado({ ...base, porObra }, 'confira lançamentos em Controle de Caixa → Conferência')
  const mediana = dias.length ? dias[Math.floor(dias.length / 2)] : null
  return {
    ...base, valor: mediana === null ? '—' : `${num(mediana, 1)} dias`,
    detalhe: `${dias.length} conferido(s) · ${pendentes.length} pendente(s)${maisAntigo !== null ? ` · o mais antigo há ${maisAntigo} dias` : ''}`,
    tom, porObra,
  }
}

// ─── D · E · por cidade do FCP ────────────────────────────────────────────────

function porCidadeDoPlano(e: EntradaIndicadores) {
  const obras = obrasAlvo(e)
  const vinculos = vinculosDeObra(obras)
  const cidades = e.plano?.premissas.cidades ?? []
  return cidades.map((c) => ({ cidade: c, obras: obras.filter((s) => vinculos.some((v) => v.siteId === s.id && v.cidadeId === c.id)) }))
}

export function mobilizacaoAmortizada(e: EntradaIndicadores): IndicadorFinanceiro {
  const base = {
    id: 'd2', sigla: 'D2', titulo: 'mobilização amortizada', detalhe: '',
    explicacao: {
      oQueE: 'Quanto do dinheiro posto no início da obra (mobilização) já voltou pelas medições recebidas. 100% = a obra se pagou o que custou para começar.',
      deOndeVem: 'Recebido nas notas do contrato das obras da cidade ÷ mobilização da cidade nas premissas do FCP.',
    },
  }
  if (!e.plano) return semDado(base, 'importe o Fluxo de Caixa Projetado')
  const porObra: LinhaPorObra[] = []
  let rec = 0, mob = 0
  for (const { cidade, obras } of porCidadeDoPlano(e)) {
    if (obras.length === 0) continue
    const r = recebidoPorMes(e.sites, obras.map((s) => s.id)).meses.reduce((a, m) => a + m.valor, 0)
    rec += r; mob += cidade.mobilizacao
    porObra.push({
      siteId: cidade.id, nome: `${cidade.nome} (${obras.length} obra${obras.length > 1 ? 's' : ''})`,
      valor: cidade.mobilizacao > 0 ? pct(r / cidade.mobilizacao) : '—',
      detalhe: `${brl(r)} recebido de ${brl(cidade.mobilizacao)}`, tom: cidade.mobilizacao > 0 ? (r >= cidade.mobilizacao ? 'ok' : 'neutro') : 'sem-dado',
    })
  }
  if (mob === 0) return semDado({ ...base, porObra }, 'vincule as obras às cidades do FCP (Torre de Controle → Contrato → De-para)')
  if (rec === 0) return semDado({ ...base, porObra }, 'marque notas como recebidas no contrato das obras')
  return { ...base, valor: pct(rec / mob), detalhe: `${brl(rec)} recebido de ${brl(mob)} de mobilização`, tom: rec >= mob ? 'ok' : 'neutro', porObra }
}

export function ticketEfetivo(e: EntradaIndicadores): IndicadorFinanceiro {
  const base = {
    id: 'e3', sigla: 'E3', titulo: 'ticket efetivo vs premissa', detalhe: '',
    explicacao: {
      oQueE: 'Quanto a obra está faturando por serviço entregue, de verdade, contra o ticket que o FCP assumiu. Se cai abaixo, o plano está otimista.',
      deOndeVem: 'Notas de serviço emitidas no período (contrato das obras da cidade) ÷ serviços em UN dos RDOs WCR finalizados no período.',
    },
  }
  if (!e.plano) return semDado(base, 'importe o Fluxo de Caixa Projetado')
  const prod = producaoPorObraDia(e, obrasAlvo(e))
  const curto = e.periodo.from && e.periodo.to ? diferencaEmDias(e.periodo.from, e.periodo.to) < 60 : false
  const porObra: LinhaPorObra[] = []
  let fat = 0, un = 0, ticketPond = 0
  for (const { cidade, obras } of porCidadeDoPlano(e)) {
    if (obras.length === 0) continue
    let f = 0, u = 0
    for (const s of obras) {
      for (const n of s.contrato?.faturamentos ?? []) if ((n.categoria ?? 'servico') === 'servico' && dentro(n.data, e.periodo)) f += n.valor
      for (const [, p] of prod.get(s.id) ?? []) u += p.unidades
    }
    const t = ticketDaCidade(cidade)
    fat += f; un += u; ticketPond += t * u
    const desvio = u > 0 && t > 0 ? f / u / t - 1 : null
    porObra.push({
      siteId: cidade.id, nome: `${cidade.nome} (${obras.length} obra${obras.length > 1 ? 's' : ''})`,
      valor: u > 0 ? brl(f / u) : '—', detalhe: `premissa ${brl(t)} · ${num(u, 0)} UN`,
      tom: desvio === null ? 'sem-dado' : curto ? 'neutro' : Math.abs(desvio) <= 0.15 ? 'ok' : Math.abs(desvio) <= 0.30 ? 'atencao' : 'grave',
    })
  }
  if (un === 0) return semDado({ ...base, porObra }, 'RDOs WCR finalizados com serviços em UN, e obras vinculadas às cidades do FCP')
  if (fat === 0) return semDado({ ...base, porObra }, 'notas de faturamento de serviço no contrato das obras')
  const t = ticketPond / un
  const desvio = fat / un / t - 1
  return {
    ...base, valor: brl(fat / un), detalhe: `premissa ponderada ${brl(t)} · ${desvio >= 0 ? '+' : ''}${pct(desvio)}${curto ? ' · período curto: faturamento atrasa a produção' : ''}`,
    tom: curto ? 'neutro' : Math.abs(desvio) <= 0.15 ? 'ok' : Math.abs(desvio) <= 0.30 ? 'atencao' : 'grave', porObra,
  }
}

export function cenarioReal(e: EntradaIndicadores): IndicadorFinanceiro {
  const base = {
    id: 'cen', sigla: 'Cenário', titulo: 'em qual cenário a obra está', detalhe: '',
    explicacao: {
      oQueE: 'Das quatro margens do FCP (Mínima, Média, Boa, Ótima), qual o caixa real mais se parece. Você fixou uma nas premissas; isto diz se a obra está entregando aquela.',
      deOndeVem: 'Caixa acumulado real (recebido − pago) até o último mês completo, contra o acumulado que cada cenário projeta para o mesmo mês. Compara caixa com caixa — nunca com o econômico, que inclui o que o consórcio banca.',
    },
  }
  if (!e.plano) return semDado(base, 'importe o Fluxo de Caixa Projetado')
  const p = e.plano.premissas
  const mesAtual = e.hoje.slice(0, 7)
  const completos = mesesDeCaixa(p).map((m) => m.mes).filter((m) => m.slice(0, 7) < mesAtual)
  const ultimo = completos[completos.length - 1]
  if (!ultimo) return semDado(base, 'o primeiro mês do plano ainda não fechou')
  const porObra: LinhaPorObra[] = []
  let realT = 0
  const cidadeIds = new Set<string>()
  for (const { cidade, obras } of porCidadeDoPlano(e)) {
    if (obras.length === 0) continue
    cidadeIds.add(cidade.id)
    const ids = obras.map((s) => s.id)
    const saidas = realizadoPorMes(e.entries, { obraIds: ids, to: `${ultimo.slice(0, 7)}-31` }).reduce((a, r) => a + r.saidas, 0)
    const rec = recebidoPorMes(e.sites, ids).meses.filter((m) => m.periodo <= ultimo.slice(0, 7)).reduce((a, m) => a + m.valor, 0)
    const real = rec - saidas
    realT += real
    const por = acumuladoPorCenarioAteMes(p, e.plano.realizado as ProducaoRealizada, ultimo, new Set([cidade.id]))
    const melhor = cenarioMaisProximo(real, por)
    porObra.push({ siteId: cidade.id, nome: cidade.nome, valor: melhor ? ROTULO_CENARIO[melhor.cenario] : '—', detalhe: `caixa real ${brl(real)}`, tom: melhor ? 'neutro' : 'sem-dado' })
  }
  if (cidadeIds.size === 0) return semDado(base, 'vincule as obras às cidades do FCP')
  if (realT === 0) return semDado({ ...base, porObra }, 'lançamentos no Controle de Caixa e notas recebidas no contrato')
  const por = acumuladoPorCenarioAteMes(p, e.plano.realizado as ProducaoRealizada, ultimo, cidadeIds)
  const melhor = cenarioMaisProximo(realT, por)
  if (!melhor) return semDado({ ...base, porObra }, 'o mês ainda não está no horizonte do plano')
  return {
    ...base, valor: ROTULO_CENARIO[melhor.cenario],
    detalhe: `até ${ultimo.slice(0, 7)} · caixa real ${brl(realT)} · o adotado é ${ROTULO_CENARIO[p.cenario]}${melhor.cenario === p.cenario ? ' ✓' : ''}`,
    tom: 'neutro', porObra,
  }
}

// ─── O que não dá, dito na tela ───────────────────────────────────────────────

const CINZA: Array<{ id: string; sigla: string; titulo: string; oQueE: string; oQueFalta: string }> = [
  { id: 'b3', sigla: 'B3', titulo: 'concentração de locador', oQueE: 'Quanto vai para cada dono de máquina ou veículo alugado. Um locador com 40%+ é conversa de contrato.', oQueFalta: 'o Controle de Caixa não tem campo de fornecedor, só descrição. Precisa de uma coluna FORNECEDOR no modelo da planilha e no lançamento.' },
  { id: 'b4', sigla: 'B4', titulo: 'hora extra vs tabela por cargo', oQueE: 'Se algum cargo está recebendo diária de hora extra acima do combinado.', oQueFalta: 'não existe tabela de diária por cargo (250/300/350) no sistema — o valor vem da célula da planilha. Cadastre a tabela.' },
  { id: 'c2', sigla: 'C2', titulo: 'runway de caixa', oQueE: 'Quantas semanas o dinheiro em caixa aguenta no ritmo de gasto atual.', oQueFalta: 'não há saldo bancário inicial cadastrado — o saldo começa do zero e o runway sairia negativo. Informe o saldo de abertura do Controle de Caixa.' },
  { id: 'd1', sigla: 'D1', titulo: 'projeção de estouro por categoria', oQueE: 'Se o ritmo de gasto de uma categoria vai passar o previsto antes do fim da obra.', oQueFalta: 'o FCP orça por bloco (folha, engenheiro, estrutura, indiretos) e o caixa classifica por categoria; não há de-para entre os dois. Precisa da tabela bloco ↔ categoria.' },
  { id: 'd3', sigla: 'D3', titulo: 'custo recorrente sem revisão', oQueE: 'Item de custo geral lançado como mensal há muitos meses sem ninguém olhar.', oQueFalta: 'o custo geral do FCP não guarda data de revisão. Precisa de um "revisado em" no item.' },
]

export function montarIndicadoresFinanceiro(e: EntradaIndicadores): IndicadorFinanceiro[] {
  return [
    custoPorMetro(e), diasComDespesaSemRdo(e), custoDoDiaParado(e), tendenciaCustoPorMetro(e),
    topCategorias(e), topSolicitantes(e), defasagemReal(e), velocidadeDeConferencia(e),
    mobilizacaoAmortizada(e), ticketEfetivo(e), cenarioReal(e),
    ...CINZA.map((c) => semDado({ id: c.id, sigla: c.sigla, titulo: c.titulo, detalhe: '', explicacao: { oQueE: c.oQueE, deOndeVem: 'Ainda não há fonte no sistema.' } }, c.oQueFalta)),
  ]
}
