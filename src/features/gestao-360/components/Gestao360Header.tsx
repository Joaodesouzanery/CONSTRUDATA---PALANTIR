import { useShallow } from 'zustand/react/shallow'
import { LayoutDashboard, Printer } from 'lucide-react'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { Gestao360Tab } from '@/store/gestao360Store'
import { mergeProjectsWithSites, projetoDaObraAtiva } from '../utils/siteProjects'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { useActiveObraStore } from '@/store/activeObraStore'
import { PainelIndicadores } from '@/features/indicadores/PainelIndicadores'
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
  { id: 'gestao-a-vista', label: 'Gestão à Vista'       },
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

  // As ordens de mudança em aberto DESTA obra. Antes isto somava a empresa inteira e ia para um
  // cartão que dizia "Obra: X" logo abaixo do seletor; agora é o número no rótulo da aba, onde o
  // escopo é o da própria aba.
  const openCOs = changeOrders.filter(
    (co) => co.status === 'submitted' && (!selectedProjectId || co.projectId === selectedProjectId),
  ).length

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
        // A marca acompanha a linha até o papel: é lá que ela mais importa.
        estimado: linha.estimado,
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

      {/* ─── OS SEIS KPIs QUE ESTAVAM AQUI ─────────────────────────────────────────
          EAC, Δ Orçamento, CPI e SPI liam `Project.budgetLines`, e para obra vinda da Torre o
          `siteToProject` grava `spent: 0` fixo — não por descuido: `ConstructionBudgetLine` NÃO TEM
          campo de realizado. O CPI caía no ramo `: 1` do ternário e mostrava **1,00 em verde**,
          sempre, para qualquer obra. O SPI mostrava "—" pelo mesmo motivo.

          "OMs em Aprovação" e "Alertas Críticos" somavam a empresa inteira enquanto o cabeçalho
          logo acima anuncia "Obra: X". A contagem de OMs virou o número no rótulo da própria aba,
          onde ela é verdadeira.

          No lugar, os quatro indicadores da tela inicial — mesma conta, mesma explicação, e cinza
          quando não se sabe. A conta de CPI não sumiu do produto: ela continua no Custo em Tempo
          Real, onde o realizado pode de fato vir do livro razão. */}
      <PainelIndicadores />

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
            {/* O número no rótulo, e não num cartão do cabeçalho: aqui o escopo é o da própria
                aba, então ele não pode discordar do que ela mostra. */}
            {tab.id === 'changeorders' && openCOs > 0 && (
              <span className="ml-1.5 rounded-full bg-[#f97316]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ffa055]">
                {openCOs}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
