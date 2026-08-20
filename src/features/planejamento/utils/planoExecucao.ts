/**
 * planoExecucao — cálculos e utilidades do "Planejamento de Execução" (modo Compizzo).
 * Regras espelham os PDFs do cliente: faturamento = área × preço/m²;
 * bonificação por colaborador = R$/m² × área; bônus diário = total ÷ dias corridos.
 */
import type { PlanoAtividade, PlanoExecucao, RDO, WorkerAbsence } from '@/types'
import { parseLocaleNumber } from '@/lib/numberFormat'

export const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

/** RUP referência de mercado (TCPO) para piso/pintura industrial (homem-hora/m²). */
export const TCPO_RUP_PADRAO = 0.45

export function dayOfWeekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : (WEEKDAY_SHORT[d.getDay()] ?? '')
}

export function isWeekend(iso: string): boolean {
  const g = new Date(`${iso}T00:00:00`).getDay()
  return g === 0 || g === 6
}

/** Todos os dias corridos entre início e fim (inclusive). */
export function eachDay(inicio: string, fim: string): string[] {
  const out: string[] = []
  if (!inicio || !fim) return out
  const start = new Date(`${inicio}T00:00:00`)
  const end = new Date(`${fim}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return out
  const cur = new Date(start)
  let guard = 0
  while (cur <= end && guard < 400) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  return out
}

export function diasCorridos(p: Pick<PlanoExecucao, 'periodoInicio' | 'periodoFim'>): number {
  return eachDay(p.periodoInicio, p.periodoFim).length
}

export function faturamento(p: Pick<PlanoExecucao, 'areaM2' | 'precoM2' | 'faturamentoOverride'>): number {
  if (p.faturamentoOverride != null && Number.isFinite(p.faturamentoOverride)) return p.faturamentoOverride
  return (p.areaM2 || 0) * (p.precoM2 || 0)
}

export function bonificacaoValor(rPorM2: number, areaM2: number): number {
  return (rPorM2 || 0) * (areaM2 || 0)
}

export function bonificacaoTotal(p: Pick<PlanoExecucao, 'bonificacao' | 'areaM2'>): number {
  return p.bonificacao.reduce((s, b) => s + bonificacaoValor(b.rPorM2, p.areaM2), 0)
}

/** Bônus diário = total da bonificação ÷ dias corridos (como no PDF). */
export function bonusDiario(
  p: Pick<PlanoExecucao, 'bonificacao' | 'areaM2' | 'periodoInicio' | 'periodoFim'>,
): number {
  const dias = diasCorridos(p)
  return dias > 0 ? bonificacaoTotal(p) / dias : 0
}

export function fmtBRL(v: number): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** dd/MM (formato curto usado na tabela do cronograma). */
export function fmtDataCurta(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}` : iso
}

/** dd/MM/yyyy (usado no cabeçalho META). */
export function fmtDataLonga(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// ── Fase 2: faltas → redistribuição do bônus ──────────────────────────────────
/** Faltas (não cobertas) da equipe do plano dentro do período. */
export function faltasNoPeriodo(
  p: Pick<PlanoExecucao, 'periodoInicio' | 'periodoFim' | 'equipe'>,
  absences: WorkerAbsence[],
): WorkerAbsence[] {
  const ids = new Set(p.equipe.map((m) => m.workerId).filter(Boolean) as string[])
  return absences.filter(
    (a) =>
      a.status !== 'covered' &&
      a.date >= p.periodoInicio &&
      a.date <= p.periodoFim &&
      (ids.size === 0 || ids.has(a.workerId)),
  )
}

/** Bônus diário redistribuído entre os presentes num dia (total do dia ÷ presentes). */
export function bonusDiarioPorPresente(
  p: Pick<PlanoExecucao, 'bonificacao' | 'areaM2' | 'periodoInicio' | 'periodoFim' | 'equipe'>,
  presentes: number,
): number {
  const base = p.equipe.length > 0 ? p.equipe.length : Math.max(1, p.bonificacao.length)
  const pres = presentes > 0 ? presentes : base
  return bonusDiario(p) / pres
}

// ── Fase 3: alertas do plano ──────────────────────────────────────────────────
export type PlanoAlertaSeveridade = 'vermelho' | 'amarelo'
export interface PlanoAlerta { severidade: PlanoAlertaSeveridade; msg: string }

export function alertasDoPlano(
  p: PlanoExecucao,
  absences: WorkerAbsence[],
  hojeIso: string,
  rdos: RDO[] = [],
): PlanoAlerta[] {
  const out: PlanoAlerta[] = []
  if (!p.precoConfirmado) out.push({ severidade: 'amarelo', msg: 'Preço do m² não confirmado' })
  if (p.status !== 'concluido' && p.periodoFim && hojeIso > p.periodoFim) {
    out.push({ severidade: 'vermelho', msg: 'Período de execução vencido' })
  }
  const faltas = faltasNoPeriodo(p, absences)
  if (faltas.length > 0) {
    out.push({ severidade: 'amarelo', msg: `${faltas.length} falta(s) no período — bônus redistribuído aos presentes` })
  }
  if (p.status === 'ativo' && p.bonificacao.length === 0) {
    out.push({ severidade: 'amarelo', msg: 'Plano ativo sem bonificação configurada' })
  }
  // Fase 4 — planejado × executado (só quando o plano está ativo e há período)
  if (p.status === 'ativo' && p.periodoInicio && p.periodoFim) {
    const ritmo = ritmoDiarioMeta(p)
    const fimJanela = hojeIso < p.periodoFim ? hojeIso : p.periodoFim
    const diasDecorridos = hojeIso >= p.periodoInicio ? eachDay(p.periodoInicio, fimJanela).length : 0
    const esperado = ritmo * diasDecorridos
    const executado = m2ExecutadoNoPeriodo(p, rdos)
    if (diasDecorridos > 0 && executado > 0 && executado < esperado * 0.9) {
      out.push({ severidade: 'vermelho', msg: `Atrás do ritmo: ${Math.round(executado)} m² executados vs ${Math.round(esperado)} m² esperados` })
    }
    const hh = hhExecutadoNoPeriodo(p, rdos)
    if (executado > 0 && hh > 0) {
      const rup = hh / executado
      if (rup > TCPO_RUP_PADRAO) {
        out.push({ severidade: 'amarelo', msg: `RUP real ${rup.toFixed(2)} HH/m² acima do TCPO (${TCPO_RUP_PADRAO})` })
      }
    }
  }
  return out
}

// ── Fase 4: atividades — produtividade & custo (diária por pessoa) ─────────────
/** Ritmo diário meta = área total ÷ dias corridos (ex.: 2.700 ÷ 15 = 180 m²/dia). */
export function ritmoDiarioMeta(
  p: Pick<PlanoExecucao, 'areaM2' | 'periodoInicio' | 'periodoFim'>,
): number {
  const dias = diasCorridos(p)
  return dias > 0 ? (p.areaM2 || 0) / dias : 0
}

/** Produção diária efetiva da atividade (m²/dia da equipe). */
export function producaoDiariaAtividade(a: PlanoAtividade): number {
  const pes = Math.max(0, a.pessoas || 0)
  if (a.rendimentoBase === 'equipe') return a.rendimento || 0
  return (a.rendimento || 0) * pes
}

/** Rendimento por pessoa/dia (para o RUP), independente do toggle. */
export function rendimentoPorPessoa(a: PlanoAtividade): number {
  if (a.rendimentoBase === 'pessoa') return a.rendimento || 0
  const pes = Math.max(1, a.pessoas || 0)
  return (a.rendimento || 0) / pes
}

/** Dias necessários = área ÷ produção diária (arredondado p/ cima; 0 se produção 0). */
export function diasNecessariosAtividade(a: PlanoAtividade): number {
  const prod = producaoDiariaAtividade(a)
  return prod > 0 ? Math.ceil((a.areaM2 || 0) / prod) : 0
}

/** Pessoa-dias = pessoas × dias necessários. */
export function pessoaDiasAtividade(a: PlanoAtividade): number {
  return Math.max(0, a.pessoas || 0) * diasNecessariosAtividade(a)
}

/** Custo estimado = pessoa-dias × custo/dia por pessoa (diária). */
export function custoEstimadoAtividade(a: PlanoAtividade): number {
  return pessoaDiasAtividade(a) * (a.custoDiaPessoa || 0)
}

/** RUP planejado (HH/m²) = jornada ÷ rendimento por pessoa/dia. */
export function rupPlanejadoAtividade(a: PlanoAtividade, horasDia = 8): number {
  const rpp = rendimentoPorPessoa(a)
  return rpp > 0 ? horasDia / rpp : 0
}

/** Custo total estimado do plano = Σ custoEstimado das atividades. */
export function custoTotalEstimado(p: Pick<PlanoExecucao, 'atividades'>): number {
  return (p.atividades ?? []).reduce((s, a) => s + custoEstimadoAtividade(a), 0)
}

/** Fábrica de atividade padrão (herda área/diária do plano). */
export function novaAtividade(p: Pick<PlanoExecucao, 'areaM2' | 'custoDiaPessoaPadrao'>): PlanoAtividade {
  return {
    id: crypto.randomUUID(), nome: '', areaM2: p.areaM2 || 0,
    rendimento: 0, rendimentoBase: 'equipe', pessoas: 1,
    custoDiaPessoa: p.custoDiaPessoaPadrao || 0,
  }
}

// ── Fase 4: executado (via RDO Compizzo) + planejado × executado ───────────────
function rdosDoPlano(
  p: Pick<PlanoExecucao, 'siteId' | 'periodoInicio' | 'periodoFim'>,
  rdos: RDO[],
): RDO[] {
  return rdos.filter((r) =>
    (r as { template?: string }).template === 'compizzo'
    // RASCUNHO NÃO CONTA. Rascunho não alimenta Financeiro, estoque nem Planejamento Mestre —
    // contá-lo aqui inflava `m2Executado` e `diasComRdo`, subestimava o `rupReal` e fazia o
    // alerta "Atrás do ritmo" disparar falso, acendendo o badge da Sidebar. O Controle de
    // Medição por contrato (`obraMedicao.ts:19`) já filtrava; este ficou para trás.
    && (r as { status?: string }).status !== 'rascunho'
    && ((r as { siteId?: string | null }).siteId ?? null) === (p.siteId ?? null)
    && !!p.periodoInicio && !!p.periodoFim
    && (r as { date?: string }).date! >= p.periodoInicio
    && (r as { date?: string }).date! <= p.periodoFim)
}

/** m² executados: soma da produção (linhas em m²) dos RDOs Compizzo da obra no período. */
export function m2ExecutadoNoPeriodo(
  p: Pick<PlanoExecucao, 'siteId' | 'periodoInicio' | 'periodoFim'>,
  rdos: RDO[],
): number {
  return rdosDoPlano(p, rdos).reduce((sum, r) => {
    const linhas = (r.compizzo?.producao ?? []).filter((row) => /m²|m2/i.test(row.servico))
    return sum + linhas.reduce((s, row) => s + parseLocaleNumber(row.quantidade), 0)
  }, 0)
}

/** m² executados (linhas em m²) dos RDOs Compizzo da obra numa data específica. */
export function m2ExecutadoEmData(
  date: string,
  p: Pick<PlanoExecucao, 'siteId' | 'periodoInicio' | 'periodoFim'>,
  rdos: RDO[],
): number {
  return rdosDoPlano(p, rdos)
    .filter((r) => (r as { date?: string }).date === date)
    .reduce((sum, r) => sum + (r.compizzo?.producao ?? [])
      .filter((row) => /m²|m2/i.test(row.servico))
      .reduce((s, row) => s + parseLocaleNumber(row.quantidade), 0), 0)
}

/** Meta de m² do dia = produção diária da atividade cujo nome casa com o texto do dia. */
export function metaDiaM2(dia: { atividade: string }, atividades: PlanoAtividade[] = []): number | null {
  const alvo = (dia.atividade || '').trim().toLowerCase()
  if (!alvo) return null
  const a = atividades.find((x) => x.nome.trim().toLowerCase() === alvo)
  return a ? producaoDiariaAtividade(a) : null
}

/** HH executadas: soma de horasTrabalhadas dos RDOs Compizzo no período (fallback 0). */
export function hhExecutadoNoPeriodo(
  p: Pick<PlanoExecucao, 'siteId' | 'periodoInicio' | 'periodoFim'>,
  rdos: RDO[],
): number {
  return rdosDoPlano(p, rdos).reduce((s, r) => s + (r.compizzo?.horasTrabalhadas ?? 0), 0)
}

export interface PlanejadoVsExecutado {
  m2Planejado: number
  m2Executado: number
  progressoPct: number
  ritmoMeta: number
  ritmoReal: number
  diasComRdo: number
  projecaoConclusaoDias: number   // 0 quando não há ritmo real (UI mostra "—")
  rupReal: number                 // 0 quando não há HH/m²
}

export function planejadoVsExecutado(p: PlanoExecucao, rdos: RDO[]): PlanejadoVsExecutado {
  const m2Planejado = p.areaM2 || 0
  const m2Executado = m2ExecutadoNoPeriodo(p, rdos)
  const hh = hhExecutadoNoPeriodo(p, rdos)
  const diasComRdo = new Set(rdosDoPlano(p, rdos).map((r) => (r as { date?: string }).date)).size
  const ritmoMeta = ritmoDiarioMeta(p)
  const ritmoReal = diasComRdo > 0 ? m2Executado / diasComRdo : 0
  const restante = Math.max(0, m2Planejado - m2Executado)
  return {
    m2Planejado,
    m2Executado,
    progressoPct: m2Planejado > 0 ? (m2Executado / m2Planejado) * 100 : 0,
    ritmoMeta,
    ritmoReal,
    diasComRdo,
    projecaoConclusaoDias: ritmoReal > 0 ? Math.ceil(restante / ritmoReal) : 0,
    rupReal: m2Executado > 0 ? hh / m2Executado : 0,
  }
}
