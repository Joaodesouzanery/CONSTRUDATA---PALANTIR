import { useShallow } from 'zustand/react/shallow'
import { LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle, FileEdit, Activity, Printer } from 'lucide-react'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { Gestao360Tab } from '@/store/gestao360Store'
import { mergeProjectsWithSites, projetoDaObraAtiva } from '../utils/siteProjects'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { useActiveObraStore } from '@/store/activeObraStore'
import { PeriodoSelector } from '@/components/shared/PeriodoSelector'
import { useEffect } from 'react'
import { useSinais360 } from '@/features/relatorio360/utils/sinais360'
import { buildLedger } from '../utils/custoLedger'
import { openReuniaoWindow, printReuniaoInto, printReuniaoViaIframe, type Reuniao360Data } from '../utils/reuniao360Export'
import { dentroDoPeriodo } from '@/lib/periodo'
import { useAuth } from '@/lib/auth'
import { hojeLocalISO } from '@/lib/utils'

const TABS: Array<{ id: Gestao360Tab; label: string }> = [
  { id: 'dashboard',    label: 'Dashboard de Obras'    },
  { id: 'daily-report', label: 'Daily Report'           },
  { id: 'jobacosting',  label: 'Custo em Tempo Real'   },
  { id: 'changeorders', label: 'Ordens de Mudança'      },
  { id: 'relatorio360', label: 'Relatório 360'          },
]

export function Gestao360Header() {
  const { selectedProjectId, selectProject, activeTab, setActiveTab, changeOrders, periodo, setPeriodo } = useGestao360Store(
    useShallow((s) => ({
      selectedProjectId: s.selectedProjectId,
      selectProject:     s.selectProject,
      activeTab:         s.activeTab,
      setActiveTab:      s.setActiveTab,
      changeOrders:      s.changeOrders,
      periodo:           s.periodo,
      setPeriodo:        s.setPeriodo,
    }))
  )
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const baseProjects  = useProjetosStore((s) => s.projects)
  const healthScores  = useOtimizacaoFrotaStore((s) => s.healthScores)
  const sites         = useTorreStore((s) => s.sites)
  const projects      = mergeProjectsWithSites(baseProjects, sites)

  /**
   * O escopo de Gestão 360 é a OBRA ATIVA da barra lateral.
   *
   * Havia dois seletores concorrendo: o dropdown daqui e a obra da barra lateral, que o resto do
   * produto usa. Numa reunião, os dois discordando é pior do que um só — e o dropdown casava a
   * obra por PEDAÇO DO NOME, então "OBRA-1" trazia junto a "OBRA-10".
   */
  const projetoDaObra = projetoDaObraAtiva(projects, activeObraId, sites)
  useEffect(() => {
    // `selectProject` grava no store, que é lido por Custo em Tempo Real, Ordens de Mudança e
    // Daily Report. Sincronizar aqui mantém as três abas no mesmo escopo sem tocar em cada uma.
    if ((projetoDaObra?.id ?? null) !== selectedProjectId) selectProject(projetoDaObra?.id ?? null)
  }, [projetoDaObra, selectedProjectId, selectProject])

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null
  const scopeProjects = selectedProject ? [selectedProject] : projects

  // ─── EAC derived values ────────────────────────────────────────────
  const lines        = scopeProjects.flatMap((p) => p.budgetLines)
  const budgeted     = lines.reduce((s, l) => s + l.budgeted, 0)
  const spent        = lines.reduce((s, l) => s + l.spent, 0)
  const eac          = lines.reduce((s, l) => s + l.projected, 0)
  const budgetDelta  = budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0

  // ─── SPI/CPI from execution phases ────────────────────────────────
  const execPhases = scopeProjects.flatMap((p) => p.executionPhases)
  const avgProgress = execPhases.length
    ? execPhases.reduce((s, p) => s + p.progress, 0) / execPhases.length
    : 0

  const today = new Date()
  const start = scopeProjects.length
    ? new Date(Math.min(...scopeProjects.map((p) => new Date(p.startDate + 'T00:00:00').getTime())))
    : today
  const end = scopeProjects.length
    ? new Date(Math.max(...scopeProjects.map((p) => new Date(p.endDate + 'T00:00:00').getTime())))
    : today
  const totalMs    = Math.max(1, end.getTime() - start.getTime())
  const elapsedMs  = Math.min(totalMs, Math.max(0, today.getTime() - start.getTime()))
  const plannedPct = (elapsedMs / totalMs) * 100

  const spi = plannedPct > 0 ? avgProgress / plannedPct : 1
  const cpi = spent > 0 ? (budgeted * (avgProgress / 100)) / spent : 1

  // ─── Cross-module critical alerts ─────────────────────────────────
  const criticalEquip = isDemoModeEnabled() ? healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high').length : 0
  const criticalRisks = sites.flatMap((s) => s.risks).filter((r) => r.level === 'critical' && r.status === 'active').length
  const totalAlerts   = criticalEquip + criticalRisks
  const openCOs       = changeOrders.filter((co) => co.status === 'submitted').length

  // ── Exportar a pauta ─────────────────────────────────────────────────────────
  // Os MESMOS sinais da tela: o hook é a única fonte, então o papel não pode discordar do que a
  // reunião está vendo.
  const { sinais } = useSinais360({ periodo, siteId: activeObraId })
  const profile = useAuth((s) => s.profile)

  function montarDados(): Reuniao360Data {
    const custos = scopeProjects
      .flatMap((project, index) => buildLedger(project, {
        includeUnscoped: isDemoModeEnabled() ? (selectedProject ? true : index === 0) : false,
        includeEvm:      isDemoModeEnabled() ? (selectedProject ? true : index === 0) : false,
        // Mesma eleição do Custo em Tempo Real: as fontes sem obra entram UMA vez.
        incluirGlobais:  selectedProject ? true : index === 0,
      }))
      .filter((linha) => dentroDoPeriodo(linha.date, periodo))
      .map((linha) => ({
        data: linha.date,
        modulo: linha.module,
        categoria: linha.category,
        descricao: linha.description,
        valorBRL: linha.amountBRL,
        tipo: linha.type,
      }))

    return {
      empresa: selectedProject?.owner || profile?.full_name || 'ConstruData',
      obraLabel: selectedProject ? selectedProject.name : 'Todas as obras',
      periodoRotulo: periodo.rotulo,
      periodoDe: periodo.de,
      periodoAte: periodo.ate,
      hoje: hojeLocalISO(),
      emitidoPor: profile?.full_name ?? undefined,
      demo: isDemoModeEnabled(),
      sinais: sinais.map((s) => ({
        modulo: s.label,
        valor: s.value,
        detalhe: s.sub,
        tom: s.tone,
        escopo: s.escopo ?? 'periodo',
      })),
      custos,
    }
  }

  function exportarPauta() {
    // A janela precisa abrir SÍNCRONA no clique — depois de um `await` o browser bloqueia.
    const win = openReuniaoWindow()
    const dados = montarDados()
    if (win) void printReuniaoInto(win, dados)
    else void printReuniaoViaIframe(dados)
  }

  function spiCpiColor(v: number) {
    if (v >= 0.9) return '#22c55e'
    if (v >= 0.7) return '#eab308'
    return '#ef4444'
  }

  const kpis = [
    {
      label: 'EAC Projetado',
      value: eac > 0 ? `R$${(eac / 1_000_000).toFixed(1)}M` : '—',
      icon:  TrendingUp,
      color: '#f97316',
    },
    {
      label: 'Δ Orçamento',
      value: budgeted > 0 ? `${budgetDelta > 0 ? '+' : ''}${budgetDelta.toFixed(1)}%` : '—',
      icon:  budgetDelta > 5 ? TrendingUp : TrendingDown,
      color: Math.abs(budgetDelta) <= 5 ? '#22c55e' : Math.abs(budgetDelta) <= 15 ? '#eab308' : '#ef4444',
    },
    {
      label: 'CPI',
      value: cpi > 0 ? cpi.toFixed(2) : '—',
      icon:  Activity,
      color: spiCpiColor(cpi),
    },
    {
      label: 'SPI',
      value: spi > 0 ? spi.toFixed(2) : '—',
      icon:  Activity,
      color: spiCpiColor(spi),
    },
    {
      label: 'OMs em Aprovação',
      value: String(openCOs),
      icon:  FileEdit,
      color: openCOs === 0 ? '#22c55e' : '#f97316',
    },
    {
      label: 'Alertas Críticos',
      value: String(totalAlerts),
      icon:  AlertTriangle,
      color: totalAlerts === 0 ? '#22c55e' : totalAlerts <= 2 ? '#eab308' : '#ef4444',
    },
  ]

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-0">
      {/* Title + project selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
            <LayoutDashboard size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">
              Gestão de Projeto 360
            </h1>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              Centro de Comando · Custo em Tempo Real · Ordens de Mudança
            </p>
          </div>
        </div>

        <span className="ml-auto rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-1.5 text-xs text-[#a3a3a3]">
          {selectedProject
            ? <>Obra: <span className="font-medium text-[#f5f5f5]">{selectedProject.name}</span></>
            : <>Todas as obras</>}
          <span className="ml-1.5 text-[#6b6b6b]">· trocar na barra lateral</span>
        </span>
      </div>

      {/* O período que a reunião está olhando — vale para todas as abas */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelector valor={periodo} onChange={setPeriodo} />
        <button
          onClick={exportarPauta}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
          title="Gera a pauta do período em A4, para imprimir ou salvar em PDF"
        >
          <Printer size={13} /> Exportar pauta
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-3 py-3 flex items-center gap-2"
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
              style={{ backgroundColor: `${kpi.color}18` }}
            >
              <kpi.icon size={14} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#6b6b6b] text-[10px] truncate">{kpi.label}</p>
              <p className="text-[#f5f5f5] text-base font-bold leading-tight" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="flex gap-1 border-b border-[#525252] -mb-px overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-[#f97316] text-[#f97316] whitespace-nowrap shrink-0'
                : 'px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-[#6b6b6b] hover:text-[#f5f5f5] whitespace-nowrap shrink-0 transition-colors'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
