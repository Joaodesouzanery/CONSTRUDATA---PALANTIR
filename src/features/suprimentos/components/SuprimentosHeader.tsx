import { Upload } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export type SuprimentosTab =
  | 'fluxo' | 'conciliacao' | 'excecoes' | 'previsao' | 'inteligencia' | 'requisicoes' | 'bom'
  | 'materiais' | 'contratos' | 'estoque' | 'almoxarifado' | 'semaforo' | 'whatif' | 'parado'
  | 'entrada_dados' | 'resumo_nucleo' | 'consolidado_trechos' | 'materiais_pendentes'
  | 'cadeia_rede' | 'cadeia_alertas' | 'cadeia_planejamento'

/**
 * A seção "materiais" ("Análises e Alertas") deixou de existir: tudo o que estava lá passou para
 * "Fluxo da Obra". Eram duas navegações para o mesmo assunto, e três abas declaradas numa seção
 * eram roteadas para a outra — ao clicar nelas, nenhuma aba ficava marcada.
 */
export type SuprimentosSection = 'suprimentos' | 'planilhas' | 'cadeia'

interface Props {
  section: SuprimentosSection
  activeTab: SuprimentosTab
  onTabChange: (tab: SuprimentosTab) => void
  onImportMaterials?: () => void
}

// A ordem das cinco primeiras é a ordem em que a operação usa o módulo: olhar o painel, conferir
// o almoxarifado, ver onde o material está, checar o pedido, conciliar a nota. O resto vem depois.
const ALL_TABS: { key: SuprimentosTab; label: string; section: SuprimentosSection }[] = [
  { key: 'fluxo', label: 'Dashboard', section: 'suprimentos' },
  { key: 'almoxarifado', label: 'Estoque / Almoxarifado', section: 'suprimentos' },
  { key: 'estoque', label: 'Mapa de Estoques', section: 'suprimentos' },
  { key: 'parado', label: 'Estoque Parado', section: 'suprimentos' },
  { key: 'contratos', label: 'Pedidos / Contratos', section: 'suprimentos' },
  { key: 'conciliacao', label: 'Conciliação', section: 'suprimentos' },
  { key: 'materiais', label: 'Materiais & Fornecedores', section: 'suprimentos' },
  { key: 'requisicoes', label: 'Requisições', section: 'suprimentos' },
  { key: 'bom', label: 'Cotações / Lista', section: 'suprimentos' },
  { key: 'previsao', label: 'Previsão de Demanda', section: 'suprimentos' },
  { key: 'inteligencia', label: 'Inteligência', section: 'suprimentos' },
  { key: 'excecoes', label: 'Exceções', section: 'suprimentos' },
  { key: 'semaforo', label: 'Semáforo de Prontidão', section: 'suprimentos' },
  { key: 'whatif', label: 'What-if Logístico', section: 'suprimentos' },
  { key: 'entrada_dados', label: 'Importação / Entrada', section: 'planilhas' },
  { key: 'resumo_nucleo', label: 'Resumo por Núcleo', section: 'planilhas' },
  { key: 'consolidado_trechos', label: 'Consolidado Trechos', section: 'planilhas' },
  { key: 'materiais_pendentes', label: 'Materiais Pendentes', section: 'planilhas' },
  { key: 'cadeia_rede', label: 'Torre de Controle', section: 'cadeia' },
  { key: 'cadeia_alertas', label: 'Riscos e Alertas', section: 'cadeia' },
  { key: 'cadeia_planejamento', label: 'Planos de Contingência', section: 'cadeia' },
]

export function SuprimentosHeader({ section, activeTab, onTabChange, onImportMaterials }: Props) {
  const {
    purchaseOrders,
    exceptions,
    estoqueItens,
    planilhaResumo,
    planilhaTrechos,
    supplyChainNodes,
    supplyChainAlerts,
    supplyChainPlans,
  } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders: s.purchaseOrders,
      exceptions: s.exceptions,
      estoqueItens: s.estoqueItens,
      planilhaResumo: s.planilhaResumo,
      planilhaTrechos: s.planilhaTrechos,
      supplyChainNodes: s.supplyChainNodes,
      supplyChainAlerts: s.supplyChainAlerts,
      supplyChainPlans: s.supplyChainPlans,
    })),
  )
  const visibleTabs = ALL_TABS.filter((tab) => tab.section === section)

  const totalPOs = purchaseOrders.length
  const openExceptions = exceptions.filter((exception) => exception.status === 'open' || exception.status === 'escalated').length

  const totalItens = estoqueItens.length
  const abaixoDoMinimo = estoqueItens.filter((item) => item.estoqueMinimo > 0 && item.qtdDisponivel <= item.estoqueMinimo).length
  const valorTotal = estoqueItens.reduce((total, item) => total + item.qtdDisponivel * (item.custoUnitario ?? 0), 0)

  const totalTrechos = planilhaResumo.length > 0 ? planilhaResumo.reduce((total, row) => total + row.trObra, 0) : planilhaTrechos.length
  const trechosExec = planilhaResumo.length > 0 ? planilhaResumo.reduce((total, row) => total + row.trExec, 0) : planilhaTrechos.filter((row) => row.status === 'EXECUTADO').length
  const trechosPend = planilhaResumo.length > 0 ? planilhaResumo.reduce((total, row) => total + row.trPend, 0) : planilhaTrechos.filter((row) => row.status === 'PENDENTE').length
  const pctExecGlobal = totalTrechos > 0 ? Math.round((trechosExec / totalTrechos) * 100) : 0

  const otifMedio = supplyChainNodes.length > 0
    ? Math.round(supplyChainNodes.reduce((total, node) => total + node.otif, 0) / supplyChainNodes.length)
    : 0

  // Com a fusão das duas seções, os quatro números do topo passam a ser os do estoque — que é o
  // que a operação olha todo dia — mais o pedido. `Conciliadas/Parciais/Com Exceção` continuam
  // dentro das próprias abas: são três números sobre a mesma coisa, e ocupavam o topo inteiro.
  const supKpis = [
    { label: 'Valor em Estoque', value: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Itens Cadastrados', value: totalItens, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
    { label: 'No mínimo ou abaixo', value: abaixoDoMinimo, color: abaixoDoMinimo ? 'text-[#fbbf24]' : 'text-[#4ade80]', bg: abaixoDoMinimo ? 'bg-[#ca8a04]/10 border-[#ca8a04]/30' : 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Pedidos de Compra', value: totalPOs, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
  ]
  const planKpis = [
    { label: 'Trechos em Obra', value: totalTrechos, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
    { label: 'Executados', value: trechosExec, color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Pendentes', value: trechosPend, color: 'text-[#f87171]', bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Progresso Geral', value: `${pctExecGlobal}%`, color: 'text-[#fbbf24]', bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
  ]
  const cadeiaKpis = [
    { label: 'No prazo e completo (OTIF)', value: `${otifMedio}%`, color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Nós da Rede', value: supplyChainNodes.length, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
    { label: 'Alertas Abertos', value: supplyChainAlerts.filter((alert) => alert.status === 'aberto' || alert.status === 'em_analise').length, color: 'text-[#f87171]', bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Planos Ativos', value: supplyChainPlans.filter((plan) => plan.status !== 'concluido').length, color: 'text-[#fbbf24]', bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
  ]

  const kpis = section === 'suprimentos' ? supKpis : section === 'planilhas' ? planKpis : cadeiaKpis

  return (
    <div className="flex shrink-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(({ label, value, color, bg }) => (
          <div key={label} className={cn('flex flex-col gap-1 rounded-xl border p-4', bg)}>
            <p className="text-xs text-[#6b6b6b]">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-[#525252] bg-[#3d3d3d] p-1 scrollbar-none lg:w-auto lg:flex-wrap">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'shrink-0 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                activeTab === tab.key ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {section === 'suprimentos' && openExceptions > 0 && (
          <span
            onClick={() => onTabChange('excecoes')}
            className="cursor-pointer rounded-full bg-[#dc2626]/20 px-2.5 py-1 text-xs font-semibold text-[#f87171] transition-colors hover:bg-[#dc2626]/30"
          >
            {openExceptions} {openExceptions === 1 ? 'exceção aberta' : 'exceções abertas'}
          </span>
        )}

        <button
          onClick={onImportMaterials}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#525252] bg-[#484848] px-3 py-1.5 text-xs font-medium text-[#f5f5f5] transition-colors hover:bg-[#525252] sm:w-auto lg:ml-auto"
          title="Importar materiais por planilha ou imagem guiada"
        >
          <Upload size={13} />
          Importar Materiais
        </button>
      </div>
    </div>
  )
}
