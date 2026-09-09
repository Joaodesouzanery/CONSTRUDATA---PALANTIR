/**
 * financeiroCalc — helpers puros de cálculo/filtragem do módulo Financeiro.
 * Usado por Visão Geral (análise filtrada), DRE simplificada e Fluxo de Caixa.
 * Nada aqui muta store — só lê `FinanceiroEntry[]` + `DreConfig`.
 */
import type { SubcategoriaSaida } from '@/types'
import type {
  FinanceiroEntry,
  DreConfig,
  DreLineKey,
  DreMappableKey,
  FinanceiroCategoria,
  EntradaCategoria,
  SaidaCategoria,
} from '@/types'

export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function fmtBRL(n: number): string {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtBRLcompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
  return fmtBRL(n)
}

// ─── Rótulos das categorias ───────────────────────────────────────────────────
export const ENTRADA_CAT_LABELS: Record<EntradaCategoria, string> = {
  medicao: 'Medição',
  adiantamento: 'Adiantamento',
  reajuste: 'Reajuste',
  outro: 'Outro',
}
export const SAIDA_CAT_LABELS: Record<SaidaCategoria, string> = {
  materiais: 'Materiais',
  mao_de_obra: 'Mão de Obra',
  equipamentos: 'Equipamentos',
  subempreiteiros: 'Subempreiteiros',
  administrativo: 'Administrativo',
  outro: 'Outro',
}
/**
 * Percentual para a tela, com "—" quando não há denominador.
 *
 * Existe para que nenhuma tela precise decidir sozinha o que fazer com `null` — e para que a
 * decisão seja a mesma em todas.
 */
// Formata em yyyy-MM-dd usando o fuso LOCAL (toISOString usaria UTC e poderia
// deslocar o dia/mês nos limites do preset).
function ym(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * O intervalo de cada atalho.
 *
 * ⚠️ **Exportado de propósito.** As telas do Financeiro nasciam com `useState({})` — ou seja, no
 * atalho "Tudo" — e somavam o histórico inteiro sem ninguém pedir: uma receita de janeiro contra
 * despesas de agosto, e o resultado parecia bom. Agora elas nascem com `presetDePeriodo('mes')`.
 */
export function presetDePeriodo(kind: 'mes' | 'ano' | '12m' | 'tudo'): { from?: string; to?: string } {
  const now = new Date()
  if (kind === 'tudo') return { from: undefined, to: undefined }
  if (kind === 'mes') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: ym(first), to: ym(last) }
  }
  if (kind === 'ano') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  // 12m
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return { from: ym(from), to: ym(now) }
}

export function fmtPct(v: number | null | undefined, casas = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(casas)}%`
}

/** A cor de uma margem: cinza quando não há dado, e só então verde ou vermelho. */
export function corDaMargem(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'text-[#6b6b6b]'
  return v >= 0 ? 'text-emerald-400' : 'text-red-400'
}

export function catLabel(c: FinanceiroCategoria): string {
  return (ENTRADA_CAT_LABELS as Record<string, string>)[c] ?? (SAIDA_CAT_LABELS as Record<string, string>)[c] ?? c
}

/** O segundo nível, só para as categorias que têm. Hoje: Mão de Obra. */
export const SUBCATEGORIAS_POR_CATEGORIA: Partial<Record<SaidaCategoria, Array<{ key: SubcategoriaSaida; label: string }>>> = {
  mao_de_obra: [
    { key: 'salario',      label: 'Salário' },
    { key: 'horas_extras', label: 'Horas extras' },
    { key: 'diaria',       label: 'Diária' },
  ],
}

/** "Mão de Obra · Horas extras" — a categoria com o segundo nível, quando ele existe. */
export function catLabelCompleto(e: Pick<FinanceiroEntry, 'categoria' | 'subcategoria'>): string {
  const base = catLabel(e.categoria)
  if (!e.subcategoria) return base
  const sub = SUBCATEGORIAS_POR_CATEGORIA[e.categoria as SaidaCategoria]?.find((s) => s.key === e.subcategoria)
  return sub ? `${base} · ${sub.label}` : base
}

export const ENTRADA_CATS = Object.keys(ENTRADA_CAT_LABELS) as EntradaCategoria[]
export const SAIDA_CATS = Object.keys(SAIDA_CAT_LABELS) as SaidaCategoria[]

// ─── Mapeamento categoria → linha da DRE ─────────────────────────────────────
export const DRE_LINE_LABELS: Record<DreLineKey, string> = {
  receita_bruta: 'Receita Operacional Bruta',
  deducao: 'Deduções / Impostos',
  custo: 'Custos Diretos da Obra',
  despesa_adm: 'Despesas Administrativas',
  despesa_outra: 'Outras Despesas',
}

/** Chave de mapeamento da DRE — desambigua 'outro' por tipo. */
export function dreKey(cat: FinanceiroCategoria, tipo: 'entrada' | 'saida'): DreMappableKey {
  if (cat === 'outro') return tipo === 'entrada' ? 'entrada_outro' : 'saida_outro'
  return cat as DreMappableKey
}

const DEFAULT_MAP: Record<DreMappableKey, DreLineKey> = {
  // Entradas → receita
  medicao: 'receita_bruta',
  adiantamento: 'receita_bruta',
  reajuste: 'receita_bruta',
  entrada_outro: 'receita_bruta',
  // Saídas
  materiais: 'custo',
  mao_de_obra: 'custo',
  equipamentos: 'custo',
  subempreiteiros: 'custo',
  administrativo: 'despesa_adm',
  saida_outro: 'despesa_outra',
}

/** Linha default de uma categoria (considerando o tipo p/ 'outro'). */
export function defaultDreLine(cat: FinanceiroCategoria, tipo: 'entrada' | 'saida'): DreLineKey {
  return DEFAULT_MAP[dreKey(cat, tipo)]
}

/** Linha efetiva de uma entrada, aplicando overrides do config (chave desambiguada). */
export function resolveDreLine(e: FinanceiroEntry, config: DreConfig): DreLineKey {
  return config.mapping[dreKey(e.categoria, e.tipo)] ?? defaultDreLine(e.categoria, e.tipo)
}

// ─── Filtragem ────────────────────────────────────────────────────────────────
export interface FinanceiroFilter {
  from?: string          // yyyy-MM-dd (inclusive)
  to?: string            // yyyy-MM-dd (inclusive)
  obraId?: string        // '' = todas
  categoria?: string     // '' = todas
  tipo?: '' | 'entrada' | 'saida'
}

export function filterEntries(entries: FinanceiroEntry[], f: FinanceiroFilter): FinanceiroEntry[] {
  return entries.filter((e) => {
    if (f.from && e.data < f.from) return false
    if (f.to && e.data > f.to) return false
    if (f.obraId && (e.obraId ?? '') !== f.obraId) return false
    if (f.categoria && e.categoria !== f.categoria) return false
    if (f.tipo && e.tipo !== f.tipo) return false
    return true
  })
}

// ─── Séries temporais ─────────────────────────────────────────────────────────
export interface MonthlyPoint { month: string; entradas: number; saidas: number; resultado: number; saldo: number }

export function monthlySeries(entries: FinanceiroEntry[]): MonthlyPoint[] {
  const map = new Map<string, { entradas: number; saidas: number }>()
  for (const e of entries) {
    const month = e.data.slice(0, 7)
    if (!map.has(month)) map.set(month, { entradas: 0, saidas: 0 })
    const m = map.get(month)!
    if (e.tipo === 'entrada') m.entradas += num(e.valor)
    else m.saidas += num(e.valor)
  }
  let acc = 0
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { entradas, saidas }]) => {
      const resultado = entradas - saidas
      acc += resultado
      return { month, entradas, saidas, resultado, saldo: acc }
    })
}

/** Lista de meses (yyyy-MM) presentes nas entries, ordenada. */
export function monthsOf(entries: FinanceiroEntry[]): string[] {
  return [...new Set(entries.map((e) => e.data.slice(0, 7)))].sort()
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const idx = Math.max(0, Math.min(11, Number(m) - 1))
  return `${meses[idx]}/${(y ?? '').slice(2)}`
}

/** Próximo mês (yyyy-MM). */
export function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return d
}

/** Soma n meses a um yyyy-MM. */
export function addMonthsYM(ym: string, n: number): string {
  let cur = ym
  for (let i = 0; i < n; i++) cur = nextMonth(cur)
  return cur
}

/** Lista inclusiva de meses (yyyy-MM) de startYM a endYM. Vazia se end < start. */
export function monthsRange(startYM: string, endYM: string): string[] {
  if (endYM < startYM) return []
  const out: string[] = []
  let cur = startYM
  // guarda contra ranges patológicos
  for (let i = 0; i < 600 && cur <= endYM; i++) { out.push(cur); cur = nextMonth(cur) }
  return out
}

/** Distribui um total uniformemente entre startYM..endYM (inclusive). */
export function spreadValue(total: number, startYM: string, endYM: string): { month: string; valor: number }[] {
  const months = monthsRange(startYM, endYM)
  if (months.length === 0) return []
  const per = total / months.length
  return months.map((month) => ({ month, valor: per }))
}

// ─── DRE ──────────────────────────────────────────────────────────────────────
export interface DreResult {
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  custos: number
  lucroBruto: number
  despesaAdm: number
  despesaOutra: number
  resultado: number
  /**
   * ⚠️ `null` quando NÃO HÁ RECEITA — não zero.
   *
   * Um mês só com saídas e nenhuma receita é prejuízo puro. Devolvendo 0, a tela caía em
   * `margem >= 0` e pintava **"0.0%" de verde esmeralda** sobre o pior mês possível. Ausência de
   * denominador não é desempenho neutro: é "não dá para calcular", e a tela precisa poder dizer
   * isso. É a mesma regra que `indicadores.ts` já declara — "dado ausente é cinza com '—', nunca
   * verde".
   */
  margemBruta: number | null    // lucroBruto / receitaBruta
  margemLiquida: number | null  // resultado / receitaBruta
  /** Detalhamento por categoria dentro de cada linha (para expandir). */
  byLine: Record<DreLineKey, { categoria: FinanceiroCategoria; valor: number }[]>
}

/** Como calcular a linha de deduções. 'auto' decide pelo próprio escopo. */
export type DeducaoMode = 'auto' | 'lancada' | 'pct'

/**
 * DRE simplificada. Deduções:
 *  - modo 'lancada' → soma dos lançamentos mapeados como 'deducao';
 *  - modo 'pct'     → `config.deducaoPct` sobre a receita bruta;
 *  - modo 'auto'    → 'lancada' se houver dedução lançada no escopo, senão 'pct'.
 *
 * Ao renderizar colunas por período (DrePanel), passe um modo FIXO calculado
 * sobre o conjunto inteiro — assim as colunas mensais somam exatamente o Total
 * (o modo 'auto' por escopo quebraria essa reconciliação).
 */
export function computeDre(entries: FinanceiroEntry[], config: DreConfig, deducaoMode: DeducaoMode = 'auto'): DreResult {
  const acc: Record<DreLineKey, number> = {
    receita_bruta: 0, deducao: 0, custo: 0, despesa_adm: 0, despesa_outra: 0,
  }
  const byLine: DreResult['byLine'] = {
    receita_bruta: [], deducao: [], custo: [], despesa_adm: [], despesa_outra: [],
  }
  const catAcc: Partial<Record<DreLineKey, Map<FinanceiroCategoria, number>>> = {}

  for (const e of entries) {
    const line = resolveDreLine(e, config)
    const v = num(e.valor)
    acc[line] += v
    if (!catAcc[line]) catAcc[line] = new Map()
    const m = catAcc[line]!
    m.set(e.categoria, (m.get(e.categoria) ?? 0) + v)
  }
  for (const line of Object.keys(byLine) as DreLineKey[]) {
    const m = catAcc[line]
    if (m) byLine[line] = [...m.entries()].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor)
  }

  const receitaBruta = acc.receita_bruta
  const deducoesLancadas = acc.deducao
  const mode: 'lancada' | 'pct' = deducaoMode === 'auto'
    ? (deducoesLancadas > 0 ? 'lancada' : 'pct')
    : deducaoMode
  const deducoes = mode === 'lancada'
    ? deducoesLancadas
    : receitaBruta * (num(config.deducaoPct) / 100)
  const receitaLiquida = receitaBruta - deducoes
  const custos = acc.custo
  const lucroBruto = receitaLiquida - custos
  const despesaAdm = acc.despesa_adm
  const despesaOutra = acc.despesa_outra
  const resultado = lucroBruto - despesaAdm - despesaOutra

  return {
    receitaBruta, deducoes, receitaLiquida, custos, lucroBruto,
    despesaAdm, despesaOutra, resultado,
    margemBruta: receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : null,
    margemLiquida: receitaBruta > 0 ? (resultado / receitaBruta) * 100 : null,
    byLine,
  }
}
