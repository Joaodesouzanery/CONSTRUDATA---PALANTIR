/**
 * EvmHeader — top bar with KPI cards and tab navigation for EVM + Financeiro modules.
 */
import { DollarSign, Download, RefreshCw } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { useNotasFiscaisStore } from '@/store/notasFiscaisStore'
import { useFcpStore } from '@/store/fcpStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { SyncBadge } from '@/components/shared/SyncBadge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useAppModeStore } from '@/store/appModeStore'
import type { FinanceiroEvmTab } from '@/types'
import { OQueE } from '@/components/shared/OQueE'
import type { Explicacao } from '@/components/shared/explicacao'

export type CombinedTab = FinanceiroEvmTab

const TABS: { key: CombinedTab; label: string }[] = [
  { key: 'visao-geral',  label: 'Visão Geral' },
  { key: 'por-obra',     label: 'Por Obra' },
  // Renomeada de "Resultados": ela já continha o DRE, e uma aba nova para o mesmo assunto
  // deixaria DOIS DREs no módulo respondendo a mesma pergunta com números diferentes.
  { key: 'resultados',   label: 'DRE e Resultado' },
  // O boletim do contrato. Fica junto do DRE porque é dele que a receita nasce.
  { key: 'medicao',      label: 'Medição' },
  { key: 'pagamentos',   label: 'Pagamentos e Cobranças' },
  // Boletos e Nota Fiscal eram duas abas. São o mesmo assunto — o papel que comprova o
  // dinheiro — e já eram gêmeas no código ("Molde: BoletosPanel", diz o topo do
  // NotasFiscaisPanel). ⚠️ As LISTAS continuam separadas de propósito: boleto é 1→N
  // parcelas a vencer, nota já nasce paga, e misturá-las poluiria os KPIs de "a vencer".
  { key: 'documentos',   label: 'Documentos' },
  // Era "Medição Ponderada", e o nome fazia crer que era o boletim. É a matriz de peso do
  // EVM: 0,30·financeiro + 0,25·duração + 0,30·econômico + 0,15·específico.
  { key: 'avanco-ponderado', label: 'Avanço Ponderado' },
  { key: 'distribuicao', label: 'Distribuição' },
  // As duas telas de CONFIGURAR do módulo, que estavam em lugares diferentes: o Plano de
  // Contas (aba própria) e o mapeamento categoria → linha da DRE (escondido atrás de um
  // botão dentro do DRE). Mexe-se nelas uma vez; ficam no fim.
  { key: 'configuracao', label: 'Configuração' },
]

/**
 * ⚠️ `value` aceita `null`, e é isso que separa "não dá para calcular" de "vale zero".
 *
 * Antes o tipo era `number` puro: sem orçamento e sem apontamento, CPI e SPI apareciam como
 * `0.00` — que um índice de desempenho comunica como "péssimo", não como "sem base". A regra vem
 * do `indicadores.ts`: *dado ausente é cinza com "—", nunca colorido*.
 */
function KpiCard({
  label,
  value,
  isCurrency = false,
  isIndex = false,
  sub,
  explicacao,
}: {
  label: string
  value: number | null
  isCurrency?: boolean
  isIndex?: boolean
  sub?: string
  /** O `?` ao lado do rótulo. Quem abre esta tela não é obrigado a saber o que é EVM. */
  explicacao?: Explicacao
}) {
  const semDado = value === null || !Number.isFinite(value)

  const formatted = semDado
    ? '—'
    : isCurrency
      ? formatCurrency(value)
      : value.toFixed(2)

  const color = semDado
    ? '#6b6b6b'
    : isIndex
      ? value >= 1
        ? '#22c55e'
        : '#ef4444'
      : '#f5f5f5'

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]">
      <div className="mb-1 flex items-center justify-between gap-1">
        <p className="text-[#a3a3a3] text-xs">{label}</p>
        {explicacao && <OQueE titulo={label} explicacao={explicacao} />}
      </div>
      <p className="font-mono text-lg font-semibold" style={{ color }}>
        {formatted}
      </p>
      {semDado && sub && <p className="mt-0.5 text-[10px] text-[#6b6b6b]">{sub}</p>}
    </div>
  )
}

/**
 * O que cada sigla quer dizer, para quem nunca ouviu falar de EVM.
 *
 * ⚠️ Nenhum destes textos traduz a sigla. "EAC é Estimate At Completion" não ajuda ninguém — a
 * pessoa continua sem saber o que fazer com o número. O que ajuda é dizer que pergunta ele
 * responde e o que preencher quando ele não existe.
 */
const EXPLICA: Record<'cpi' | 'spi' | 'bac' | 'eac' | 'vac', Explicacao> = {
  cpi: {
    oQueE: 'Cada real gasto virou quanto de serviço. Acima de 1,00 a obra entrega mais do que '
      + 'gasta; abaixo, gasta mais do que entrega.',
    deOndeVem: 'Serviço entregue ÷ custo real. O custo vem dos lançamentos e das ordens de compra.',
    oQueFalta: 'Falta medir o serviço entregue por pacote de trabalho. Sem isso o sistema sabe '
      + 'quanto saiu do caixa, mas não sabe o que aquilo comprou.',
  },
  spi: {
    oQueE: 'A obra andou o quanto devia andar até hoje. Abaixo de 1,00 está atrasada em relação '
      + 'ao plano — o que não é a mesma coisa que estar cara.',
    deOndeVem: 'Serviço entregue ÷ serviço previsto para a data de hoje.',
    oQueFalta: 'Falta o plano de valor: quanto de serviço deveria estar pronto a cada mês. Sem a '
      + 'curva planejada não há com o que comparar.',
  },
  bac: {
    oQueE: 'Quanto a obra inteira foi orçada para custar. É a régua de todo o resto desta tela.',
    deOndeVem: 'Da soma das contas de custo lançadas no Plano de Contas.',
    oQueFalta: 'Nenhuma conta de custo foi cadastrada para esta obra.',
  },
  eac: {
    oQueE: 'Se a obra continuar no ritmo de gasto de hoje, quanto ela vai custar no total. É o '
      + 'orçamento corrigido pela realidade.',
    deOndeVem: 'Orçamento ÷ CPI. Depende, portanto, do serviço entregue.',
    oQueFalta: 'Depende do CPI, que precisa do serviço entregue por pacote.',
  },
  vac: {
    oQueE: 'Quanto vai sobrar ou faltar no fim, comparado ao orçado. Negativo é estouro previsto.',
    deOndeVem: 'Orçamento − custo estimado no fim (EAC).',
    oQueFalta: 'Depende do EAC, que depende do serviço entregue por pacote.',
  },
}

/**
 * Um índice só existe quando há base para ele. Sem base, `null` — nunca 0.
 *
 * ⚠️ `bases` é plural e isso conserta um defeito real. O CPI é `EV / AC`: olhar só o AC dizia que
 * havia base assim que alguém cadastrasse um centavo de custo, e o cartão passava a exibir
 * **`0.00` em VERMELHO** — que um índice de desempenho comunica como "péssimo", quando a verdade é
 * "não sei". O que falta ali é o EV, não o AC.
 *
 * A regra: **todas** as pernas da conta precisam existir. Falta uma, o índice não existe.
 */
function indiceOuNada(valor: number, ...bases: number[]): number | null {
  return bases.every((b) => b > 0) && Number.isFinite(valor) ? valor : null
}

interface EvmHeaderProps {
  activeTab:    CombinedTab
  setActiveTab: (tab: CombinedTab) => void
}

export function EvmHeader({ activeTab, setActiveTab }: EvmHeaderProps) {
  const { evmMetrics, loadDemoData, recalculateMetrics } = useEvmStore()
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const residuoDemoRemovido = useEvmStore((s) => s.residuoDemoRemovido)
  const { CPI, SPI, BAC, EAC, VAC, AC, PV, EV } = evmMetrics
  const sync = useStoreSync(useFinanceiroStore)
  // Títulos (abas "Pagamentos e Cobranças" e "Boletos") vivem noutro store e não
  // sincronizavam ao abrir o módulo — o que o colega cadastrou só aparecia no próximo
  // login. Fica no header porque ele não desmonta ao trocar de aba (não re-puxa a cada clique).
  useStoreSync(useFinanceiroTitulosStore)
  useStoreSync(useNotasFiscaisStore)
  // Idem para os planos de fluxo projetado (sub-aba "Fluxo de Caixa Projetado").
  useStoreSync(useFcpStore)

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Aviso de uma vez: havia dado de demonstração guardado neste navegador e ele foi
          removido. Sem isso, os números simplesmente mudariam de valor sem explicação. */}
      {residuoDemoRemovido && (
        <div className="border-b border-[#f59e0b]/30 bg-[#f59e0b]/[0.09] px-6 py-3 text-xs leading-5 text-[#fbbf24]">
          <strong>Dados de demonstração removidos.</strong> Este navegador tinha um contrato de
          exemplo guardado (orçamento de R$ 4.891.304, EAC de R$ 13,9 milhões), carregado por um
          botão que não checava o Modo Demo. Ele não era seu e não estava no servidor — os
          indicadores acima agora refletem só o que você cadastrou.
        </div>
      )}
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">
              Financeiro
            </h1>
            <p className="text-[#a3a3a3] text-xs">Gestão Financeira do Contrato · EVM</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SyncBadge {...sync} />
          {/* SÓ com o Modo Demo ligado. Este botão era um laranja fixo no cabeçalho, sem
              condição nenhuma, e o que ele carrega é persistido no navegador: um clique
              plantava R$ 4.891.304 de orçamento e um EAC de R$ 13,9 milhões que voltavam a
              cada login, com o Modo Demo desligado. É o padrão que MapaHeader.tsx já usa. */}
          {isDemoMode && (
            <button
              onClick={loadDemoData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] transition-colors hover:bg-[#ea580c]"
            >
              <Download size={15} />
              Carregar Demo
            </button>
          )}
          <button
            onClick={recalculateMetrics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <RefreshCw size={15} />
            Recalcular
          </button>
        </div>
      </div>

      {/* KPI cards — sigla SEMPRE com a descrição ao lado. Quem abre esta tela não é obrigado a
          saber o que é EVM; o `?` traz o texto longo, mas o rótulo já tem de dizer o essencial. */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        {/* Cada índice declara TODAS as pernas de que depende. Sem uma delas, "—" e o motivo. */}
        <KpiCard label="CPI · real gasto virou serviço" value={indiceOuNada(CPI, AC, EV)} isIndex
          sub="falta o serviço entregue" explicacao={EXPLICA.cpi} />
        <KpiCard label="SPI · andou o que devia" value={indiceOuNada(SPI, PV, EV)} isIndex
          sub="falta o plano de valor" explicacao={EXPLICA.spi} />
        <KpiCard label="BAC · orçamento da obra" value={BAC > 0 ? BAC : null} isCurrency
          sub="obra sem orçamento" explicacao={EXPLICA.bac} />
        <KpiCard label="EAC · custo estimado no fim" value={indiceOuNada(EAC, BAC, EV)} isCurrency
          sub="depende do orçamento e do avanço" explicacao={EXPLICA.eac} />
        <KpiCard label="VAC · sobra ou falta no fim" value={indiceOuNada(VAC, BAC, EV)} isCurrency
          sub="depende do orçamento e do avanço" explicacao={EXPLICA.vac} />
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
