/**
 * EvmHeader — top bar with KPI cards and tab navigation for EVM + Financeiro modules.
 */
import { DollarSign, Download, RefreshCw } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { useFcpStore } from '@/store/fcpStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { SyncBadge } from '@/components/shared/SyncBadge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useAppModeStore } from '@/store/appModeStore'
import type { FinanceiroEvmTab } from '@/types'

export type CombinedTab = FinanceiroEvmTab

const TABS: { key: CombinedTab; label: string }[] = [
  { key: 'visao-geral',  label: 'Visão Geral' },
  { key: 'por-obra',     label: 'Por Obra' },
  // Renomeada de "Resultados": ela já continha o DRE, e uma aba nova para o mesmo assunto
  // deixaria DOIS DREs no módulo respondendo a mesma pergunta com números diferentes.
  { key: 'resultados',   label: 'DRE e Resultado' },
  { key: 'pagamentos',   label: 'Pagamentos e Cobranças' },
  { key: 'boletos',      label: 'Boletos' },
  { key: 'medicao',      label: 'Medição Ponderada' },
  { key: 'plano-contas', label: 'Plano de Contas' },
  { key: 'distribuicao', label: 'Distribuição' },
]

function KpiCard({
  label,
  value,
  isCurrency = false,
  isIndex = false,
}: {
  label: string
  value: number
  isCurrency?: boolean
  isIndex?: boolean
}) {
  const formatted = isCurrency
    ? formatCurrency(value)
    : value.toFixed(2)

  const color = isIndex
    ? value >= 1
      ? '#22c55e'
      : '#ef4444'
    : '#f5f5f5'

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]">
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color }}>
        {formatted}
      </p>
    </div>
  )
}

interface EvmHeaderProps {
  activeTab:    CombinedTab
  setActiveTab: (tab: CombinedTab) => void
}

export function EvmHeader({ activeTab, setActiveTab }: EvmHeaderProps) {
  const { evmMetrics, loadDemoData, recalculateMetrics } = useEvmStore()
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const residuoDemoRemovido = useEvmStore((s) => s.residuoDemoRemovido)
  const { CPI, SPI, BAC, EAC, VAC } = evmMetrics
  const sync = useStoreSync(useFinanceiroStore)
  // Títulos (abas "Pagamentos e Cobranças" e "Boletos") vivem noutro store e não
  // sincronizavam ao abrir o módulo — o que o colega cadastrou só aparecia no próximo
  // login. Fica no header porque ele não desmonta ao trocar de aba (não re-puxa a cada clique).
  useStoreSync(useFinanceiroTitulosStore)
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

      {/* KPI cards */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="CPI" value={CPI} isIndex />
        <KpiCard label="SPI" value={SPI} isIndex />
        <KpiCard label="Orçamento planejado" value={BAC} isCurrency />
        <KpiCard label="EAC (R$)" value={EAC} isCurrency />
        <KpiCard label="VAC (R$)" value={VAC} isCurrency />
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
