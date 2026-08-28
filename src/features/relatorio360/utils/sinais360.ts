/**
 * sinais360.ts — os dez sinais do Radar 360, um por módulo.
 *
 * ─── POR QUE FICA SEPARADO DA TELA ────────────────────────────────────────────────────────────
 * Os mesmos números aparecem em três lugares: o Radar na aba Dashboard, o Radar compacto do Daily
 * Report e o PDF da pauta da reunião. Se cada um calculasse por conta, um dia a reunião discutiria
 * um número e o papel levaria outro.
 *
 * ─── O QUE NÃO DÁ PARA RECORTAR, E É DITO NA CARA ─────────────────────────────────────────────
 * Nem todo módulo guarda data ou obra. Onde falta, o sinal vem com `escopo: 'acumulado'` (ou
 * `'sem-obra'`) e quem exibe CARIMBA isso — no cartão e no PDF. Um número acumulado exibido como
 * se fosse do período faz duas reuniões seguidas parecerem idênticas.
 */
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  HardHat,
  PackageCheck,
  RadioTower,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEvmStore } from '@/store/evmStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useRdoStore } from '@/store/rdoStore'
import { useRede360Store } from '@/store/rede360Store'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { formatCurrencyCompact } from '@/lib/utils'
import { dentroDoPeriodo, periodoLivre, type Periodo } from '@/lib/periodo'
import { ListChecks } from 'lucide-react'
import { hojeLocalISO } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useDiasSemProducaoStore } from '@/store/diasSemProducaoStore'
import { useRotinasStore } from '@/store/rotinasStore'
import { obrasReportando, rotinasEmDia } from '@/features/indicadores/utils/indicadores'

export interface Signal {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
  /**
   * `periodo`   — o número é do intervalo escolhido.
   * `acumulado` — não dá para recortar por data; é o total de sempre.
   * `sem-obra`  — respeita o período, mas o dado não tem obra, então soma todas.
   */
  escopo?: 'periodo' | 'acumulado' | 'sem-obra'
}

function metricTone(value: number, warnAt: number, dangerAt: number): Signal['tone'] {
  if (value >= dangerAt) return 'danger'
  if (value >= warnAt) return 'warn'
  return 'ok'
}

/** Casa o registro com a obra em escopo. Sem escopo, tudo passa. */
function daObra(registro: { siteId?: string | null }, siteId: string | null | undefined): boolean {
  if (!siteId) return true
  return registro.siteId === siteId
}

export interface EscopoDosSinais {
  /** O período da reunião. Quando ausente, `date` vira um período de um dia só. */
  periodo?: Periodo
  /** Modo dia único (Relatório 360 diário). */
  date?: string
  /** Obra em escopo (`construction_sites.id`). `null`/ausente = todas. */
  siteId?: string | null
}

/** Lê todos os stores e devolve os dez sinais já recortados. */
export function useSinais360({ periodo, date, siteId }: EscopoDosSinais): { sinais: Signal[]; periodo: Periodo } {
  // Um dia só continua sendo um período — assim existe UM caminho de cálculo, e o Relatório 360
  // diário não precisa de um ramo próprio que envelhece separado.
  const p: Periodo = periodo ?? periodoLivre(date ?? '', date ?? '')
  const noPeriodo = (d: string | null | undefined) => dentroDoPeriodo(d, p)

  const reports = useRelatorio360Store((s) => s.reports)
  const rdos = useRdoStore((s) => s.rdos)
  const fvss = useQualidadeStore((s) => s.fvss)
  const nonConformities = useQualidadeStore((s) => s.nonConformities)
  const equipmentOrders = useGestaoEquipamentosStore((s) => s.orders)
  const { purchaseOrders, requisitions, estoqueItens, movimentacoes, planilhaItensOperacionais } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders: s.purchaseOrders,
      requisitions: s.requisitions,
      estoqueItens: s.estoqueItens,
      movimentacoes: s.movimentacoes,
      planilhaItensOperacionais: s.planilhaItensOperacionais,
    }))
  )
  const evmMetrics = useEvmStore((s) => s.evmMetrics)
  const { trechos, isScheduleDirty, projectEndDate } = usePlanejamentoStore(
    useShallow((s) => ({
      trechos: s.trechos,
      isScheduleDirty: s.isScheduleDirty,
      projectEndDate: s.projectEndDate,
    }))
  )
  const { workers, timecards, violations, absences } = useMaoDeObraStore(
    useShallow((s) => ({
      workers: s.workers,
      timecards: s.timecards,
      violations: s.violations,
      absences: s.absences,
    }))
  )
  const weeklyPpcResults = useOperacaoCampoStore((s) => s.weeklyPpcResults)
  // Para os cartões de RDO em falta e de Rotinas atrasadas.
  const sites = useTorreStore((s) => s.sites)
  const diasSemProducao = useDiasSemProducaoStore((s) => s.dias)
  const feriados = usePlanejamentoStore((s) => s.holidays)
  const jornada = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const rotinas = useRotinasStore((s) => s.rotinas)
  const execucoesRotina = useRotinasStore((s) => s.execucoes)
  const getMedicaoKpis = useMedicaoStore((s) => s.getGlobalKpis)
  const medicaoKpis = getMedicaoKpis()
  const { outages, serviceOrders } = useRede360Store(
    useShallow((s) => ({ outages: s.outages, serviceOrders: s.serviceOrders }))
  )

  // ── RDO ──────────────────────────────────────────────────────────────────────
  // O RDO da Sabesp vive num store local próprio e não tem obra; entra pelo período apenas.
  const sabespRdos = readLocalRdoSabesp().filter((rdo) => noPeriodo(rdo.report_date))
  const reportList = Object.values(reports).filter((r) => noPeriodo(r.date))
  const rdoList = rdos.filter((rdo) => noPeriodo(rdo.date) && daObra(rdo, siteId))
  const rdosFinalizados = rdoList.filter((rdo) => rdo.status !== 'rascunho').length
  const rdosRascunho = rdoList.length - rdosFinalizados

  // ── Qualidade ────────────────────────────────────────────────────────────────
  // Duas leituras diferentes, e as duas importam: o que foi ABERTO no período (o ritmo) e o que
  // continua aberto hoje (a dívida). O cartão mostra a dívida, que é o que trava obra, e cita o
  // ritmo embaixo.
  const ncsDoEscopo = nonConformities.filter((nc) => daObra(nc, siteId))
  const ncsAbertasHoje = ncsDoEscopo.filter((nc) => nc.status !== 'concluida').length
  const ncsAbertasNoPeriodo = ncsDoEscopo.filter((nc) => noPeriodo(nc.date)).length
  const fvsNoPeriodo = fvss.filter((f) => noPeriodo(f.date) && daObra(f, siteId)).length

  // ── Equipamentos ─────────────────────────────────────────────────────────────
  const manutencoesNoPeriodo = equipmentOrders.filter((o) => noPeriodo(o.scheduledDate))
  const manutencoesAtrasadas = manutencoesNoPeriodo.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length

  // ── Suprimentos ──────────────────────────────────────────────────────────────
  const ocsNoPeriodo = purchaseOrders.filter((po) => noPeriodo(po.issuedDate)).length
  const reqsPendentes = requisitions.filter((r) => !['ordered', 'cancelled'].includes(r.status) && daObra(r, siteId)).length
  const itensDaObra = estoqueItens.filter((i) => daObra(i, siteId))
  const abaixoDoMinimo = itensDaObra.filter((i) => i.estoqueMinimo > 0 && i.qtdDisponivel <= i.estoqueMinimo).length
  const saidasNoPeriodo = movimentacoes.filter((m) => m.tipo === 'saida' && noPeriodo(m.dataMovimento) && daObra(m, siteId))
  const consumoBRL = saidasNoPeriodo.reduce((s, m) => {
    const custo = m.custoUnitario ?? estoqueItens.find((i) => i.id === m.itemId)?.custoUnitario ?? 0
    return s + m.quantidade * custo
  }, 0)
  const materiaisPendentes = planilhaItensOperacionais.filter((item) => item.status === 'pend').length

  // ── Mão de obra ──────────────────────────────────────────────────────────────
  const apontamentosNoPeriodo = timecards.filter((t) => noPeriodo(t.date) && daObra(t, siteId))
  const horasNoPeriodo = apontamentosNoPeriodo.reduce((s, t) => s + (t.hoursWorked ?? 0), 0)
  const faltasNoPeriodo = absences.filter((a) => noPeriodo(a.date) && daObra(a, siteId) && a.type !== 'vacation').length
  const ativos = workers.filter((w) => w.status === 'active' && daObra(w, siteId)).length

  // ── Planejamento ─────────────────────────────────────────────────────────────
  const concluidos = trechos.filter((t) => t.executionStatus === 'completed').length
  const pctPlanejamento = trechos.length ? Math.round((concluidos / trechos.length) * 100) : 0
  const atrasados = trechos.filter((t) => t.executionStatus === 'in_progress' && (t.physicalProgressPct ?? 0) < 70).length

  // ── Rede 360 ─────────────────────────────────────────────────────────────────
  const ocorrenciasAbertas = outages.filter((o) => o.status !== 'resolved').length
  const osAbertas = serviceOrders.filter((o) => ['pending', 'in_progress'].includes(o.status)).length

  const latestPpc = weeklyPpcResults.at(-1)?.ppc ?? null
  const totalRdos = reportList.length + rdoList.length + sabespRdos.length

  // ── Obras sem RDO ────────────────────────────────────────────────────────────
  // Sempre em relação a HOJE, não ao período: "quantas obras estão sem RDO agora" é a pergunta que
  // a reunião faz. Contar lacuna dentro de um período passado não teria significado.
  const semProducaoMapa = new Map<string, string>()
  for (const d of diasSemProducao) semProducaoMapa.set(`${d.siteId}|${d.data}`, 'x')
  const hojeISO = hojeLocalISO()

  // Estas duas contas são as MESMAS que o painel de indicadores da tela inicial faz. Elas moram em
  // `features/indicadores/utils/indicadores.ts` e são chamadas daqui de propósito: duas
  // implementações do mesmo fato divergem na primeira mudança, e aí o Radar e a tela de abertura
  // passam a discordar sobre quantas obras estão sem RDO — sem ninguém perceber qual está certa.
  const reportando = obrasReportando({
    sites: siteId ? sites.filter((s) => s.id === siteId) : sites,
    rdos, semProducao: semProducaoMapa, feriados, jornada, hoje: hojeISO,
    // Aqui não há guarda de sincronização: o Radar já roda dentro de uma tela que carregou a Torre.
    torreSincronizada: true,
  })
  const obrasComLacuna = reportando.semRdo.length
  const piorLacuna = reportando.piorLacunaDiasUteis

  // ── Rotinas ──────────────────────────────────────────────────────────────────
  const feriadoSet = new Set(feriados.map((f) => f.date))
  const emDia = rotinasEmDia({ rotinas, execucoes: execucoesRotina, feriados: feriadoSet, jornada, hoje: hojeISO })
  const rotinasAtivas = emDia.ativas
  const rotinasAtrasadas = emDia.atrasadas
  const rotinasFeitasNoCiclo = emDia.feitasNoCiclo

  const signals: Signal[] = [
    {
      label: 'RDOs',
      value: String(totalRdos),
      // A lacuna vem primeiro quando existe: "2 obras sem RDO há 3 dias" muda a reunião; "5
      // finalizados" só informa.
      sub: obrasComLacuna > 0
        ? `${obrasComLacuna} obra${obrasComLacuna !== 1 ? 's' : ''} sem RDO${piorLacuna > 1 ? ` — a pior há ${piorLacuna} dias` : ' hoje'}`
        : rdosRascunho > 0
          ? `${rdosFinalizados} finalizados · ${rdosRascunho} em rascunho`
          : `${reportList.length} R360 · ${rdoList.length + sabespRdos.length} campo`,
      icon: ClipboardList,
      tone: piorLacuna > 1 ? 'danger' : obrasComLacuna > 0 || rdosRascunho > 0 ? 'warn' : totalRdos > 0 ? 'ok' : 'warn',
      escopo: 'periodo',
    },
    {
      label: 'Rotinas',
      value: String(rotinasAtrasadas),
      sub: rotinasAtrasadas > 0
        ? `atrasadas · ${rotinasFeitasNoCiclo}/${rotinasAtivas} feitas no ciclo`
        : rotinasAtivas > 0 ? `${rotinasFeitasNoCiclo}/${rotinasAtivas} feitas no ciclo` : 'nenhuma cadastrada',
      icon: ListChecks,
      tone: rotinasAtrasadas > 2 ? 'danger' : rotinasAtrasadas > 0 ? 'warn' : rotinasAtivas > 0 ? 'ok' : 'neutral',
      // A rotina tem ciclo próprio (diário, semanal, quinzenal, mensal) e não obedece ao período
      // da reunião: dizer "3 atrasadas na semana selecionada" seria inventar um recorte.
      escopo: 'acumulado',
    },
    {
      label: 'Qualidade',
      value: String(ncsAbertasHoje),
      sub: `NCs em aberto · ${ncsAbertasNoPeriodo} abertas no período · ${fvsNoPeriodo} FVS`,
      icon: ShieldAlert,
      tone: metricTone(ncsAbertasHoje, 1, 3),
      escopo: 'periodo',
    },
    {
      label: 'Suprimentos',
      value: formatCurrencyCompact(consumoBRL),
      sub: `consumo · ${saidasNoPeriodo.length} retiradas · ${abaixoDoMinimo} no mínimo · ${ocsNoPeriodo} OCs · ${reqsPendentes} req.`,
      icon: PackageCheck,
      tone: abaixoDoMinimo > 0 ? 'warn' : 'ok',
      escopo: 'periodo',
    },
    {
      label: 'Equipamentos',
      value: String(manutencoesAtrasadas),
      sub: `manutenções não concluídas · ${manutencoesNoPeriodo.length} previstas no período`,
      icon: Wrench,
      tone: metricTone(manutencoesAtrasadas, 1, 4),
      escopo: 'sem-obra',
    },
    {
      label: 'Mão de obra',
      value: `${Math.round(horasNoPeriodo)}h`,
      sub: `${apontamentosNoPeriodo.length} apontamentos · ${faltasNoPeriodo} faltas · ${ativos} ativos${violations.length ? ` · ${violations.length} alertas CLT` : ''}`,
      icon: Users,
      tone: violations.length ? 'warn' : horasNoPeriodo > 0 ? 'ok' : 'neutral',
      escopo: 'periodo',
    },
    {
      label: 'Planejamento',
      value: `${pctPlanejamento}%`,
      sub: projectEndDate ? `fim previsto ${projectEndDate}` : (isScheduleDirty ? 'cronograma pendente' : 'sem data final'),
      icon: BarChart3,
      tone: atrasados > 0 || isScheduleDirty ? 'warn' : 'ok',
      escopo: 'acumulado',
    },
    {
      label: 'Financeiro / EVM',
      value: evmMetrics.BAC ? formatCurrencyCompact(evmMetrics.VAC) : 'sem orçamento',
      sub: `CPI ${evmMetrics.CPI.toFixed(2)} · SPI ${evmMetrics.SPI.toFixed(2)}`,
      icon: FileText,
      tone: evmMetrics.CPI < 0.9 || evmMetrics.SPI < 0.9 ? 'danger' : evmMetrics.CPI < 1 || evmMetrics.SPI < 1 ? 'warn' : 'ok',
      escopo: 'acumulado',
    },
    {
      label: 'Medição',
      value: `${medicaoKpis.pctExec}%`,
      sub: `${medicaoKpis.kmExec.toFixed(1)} km exec · ${medicaoKpis.kmPend.toFixed(1)} km pend`,
      icon: CheckCircle2,
      tone: medicaoKpis.pctExec >= 70 ? 'ok' : medicaoKpis.pctExec >= 35 ? 'warn' : 'info',
      escopo: 'acumulado',
    },
    {
      label: 'Rede 360',
      value: String(ocorrenciasAbertas + osAbertas),
      sub: `${ocorrenciasAbertas} ocorrências · ${osAbertas} OS abertas`,
      icon: RadioTower,
      tone: metricTone(ocorrenciasAbertas + osAbertas, 1, 4),
      escopo: 'acumulado',
    },
    {
      label: 'Campo / PPC',
      value: latestPpc === null ? '—' : `${latestPpc}%`,
      sub: `${materiaisPendentes} materiais pendentes · última semana fechada`,
      icon: HardHat,
      tone: latestPpc === null ? 'neutral' : latestPpc >= 80 ? 'ok' : latestPpc >= 60 ? 'warn' : 'danger',
      escopo: 'acumulado',
    },
  ]


  return { sinais: signals, periodo: p }
}
