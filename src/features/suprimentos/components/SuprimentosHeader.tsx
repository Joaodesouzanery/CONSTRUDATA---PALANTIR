import { useState } from 'react'
import { Upload } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ImportModal } from '@/components/shared/ImportModal'
import { cn } from '@/lib/utils'
import { SUPPLIER_IMPORT_CONFIG } from '@/lib/importConfigs'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export type SuprimentosTab =
  | 'fluxo' | 'conciliacao' | 'excecoes' | 'previsao' | 'inteligencia' | 'requisicoes' | 'bom'
  | 'materiais' | 'contratos' | 'estoque' | 'almoxarifado' | 'semaforo' | 'whatif'
  | 'entrada_dados' | 'resumo_nucleo' | 'consolidado_trechos' | 'materiais_pendentes'
  | 'cadeia_rede' | 'cadeia_alertas' | 'cadeia_planejamento'

export type SuprimentosSection = 'suprimentos' | 'materiais' | 'planilhas' | 'cadeia'

interface Props {
  section: SuprimentosSection
  activeTab: SuprimentosTab
  onTabChange: (tab: SuprimentosTab) => void
}

const ALL_TABS: { key: SuprimentosTab; label: string; section: SuprimentosSection }[] = [
  { key: 'fluxo', label: 'Fluxo do Gestor', section: 'suprimentos' },
  { key: 'conciliacao', label: 'Conciliação', section: 'suprimentos' },
  { key: 'excecoes', label: 'Exceções', section: 'suprimentos' },
  { key: 'previsao', label: 'Previsão de Demanda', section: 'suprimentos' },
  { key: 'requisicoes', label: 'Requisições', section: 'suprimentos' },
  { key: 'inteligencia', label: 'Inteligência', section: 'suprimentos' },
  { key: 'bom', label: 'Lista de Compras', section: 'suprimentos' },
  { key: 'materiais', label: 'Materiais & Fornecedores', section: 'materiais' },
  { key: 'contratos', label: 'Contrato 360', section: 'materiais' },
  { key: 'estoque', label: 'Mapa de Estoque', section: 'materiais' },
  { key: 'almoxarifado', label: 'Almoxarifado', section: 'materiais' },
  { key: 'semaforo', label: 'Semáforo de Prontidão', section: 'materiais' },
  { key: 'whatif', label: 'What-if Logístico', section: 'materiais' },
  { key: 'entrada_dados', label: 'Entrada de Dados', section: 'planilhas' },
  { key: 'resumo_nucleo', label: 'Resumo por Núcleo', section: 'planilhas' },
  { key: 'consolidado_trechos', label: 'Consolidado Trechos', section: 'planilhas' },
  { key: 'materiais_pendentes', label: 'Materiais Pendentes', section: 'planilhas' },
  { key: 'cadeia_rede', label: 'Rede', section: 'cadeia' },
  { key: 'cadeia_alertas', label: 'Alertas', section: 'cadeia' },
  { key: 'cadeia_planejamento', label: 'Planejamento', section: 'cadeia' },
]

export function SuprimentosHeader({ section, activeTab, onTabChange }: Props) {
  const {
    purchaseOrders,
    matches,
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
      matches: s.matches,
      exceptions: s.exceptions,
      estoqueItens: s.estoqueItens,
      planilhaResumo: s.planilhaResumo,
      planilhaTrechos: s.planilhaTrechos,
      supplyChainNodes: s.supplyChainNodes,
      supplyChainAlerts: s.supplyChainAlerts,
      supplyChainPlans: s.supplyChainPlans,
    })),
  )
  const addSupplier = useSuprimentosStore((s) => s.addSupplier)
  const [importOpen, setImportOpen] = useState(false)

  const visibleTabs = ALL_TABS.filter((tab) => tab.section === section)

  const totalPOs = purchaseOrders.length
  const conciliado = matches.filter((match) => match.status === 'matched').length
  const parcial = matches.filter((match) => match.status === 'partial').length
  const comExcecao = matches.filter((match) => match.status === 'discrepancy').length
  const openExceptions = exceptions.filter((exception) => exception.status === 'open' || exception.status === 'escalated').length

  const totalItens = estoqueItens.length
  const emRuptura = estoqueItens.filter((item) => item.qtdDisponivel === 0).length
  const emTransito = estoqueItens.filter((item) => item.qtdTransito > 0).length
  const valorTotal = estoqueItens.reduce((total, item) => total + item.qtdDisponivel * (item.custoUnitario ?? 0), 0)

  const totalTrechos = planilhaResumo.length > 0 ? planilhaResumo.reduce((total, row) => total + row.trObra, 0) : planilhaTrechos.length
  const trechosExec = planilhaResumo.length > 0 ? planilhaResumo.reduce((total, row) => total + row.trExec, 0) : planilhaTrechos.filter((row) => row.status === 'EXECUTADO').length
  const trechosPend = planilhaResumo.length > 0 ? planilhaResumo.reduce((total, row) => total + row.trPend, 0) : planilhaTrechos.filter((row) => row.status === 'PENDENTE').length
  const pctExecGlobal = totalTrechos > 0 ? Math.round((trechosExec / totalTrechos) * 100) : 0

  const otifMedio = supplyChainNodes.length > 0
    ? Math.round(supplyChainNodes.reduce((total, node) => total + node.otif, 0) / supplyChainNodes.length)
    : 0

  const supKpis = [
    { label: 'Conciliadas', value: conciliado, color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Parciais', value: parcial, color: 'text-[#fbbf24]', bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
    { label: 'Com Exceção', value: comExcecao, color: 'text-[#f87171]', bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Total OCs', value: totalPOs, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
  ]
  const matKpis = [
    { label: 'Total Itens', value: totalItens, color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
    { label: 'Em Ruptura', value: emRuptura, color: 'text-[#f87171]', bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Em Trânsito', value: emTransito, color: 'text-[#fbbf24]', bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
    { label: 'Valor em Estoque', value: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
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

  const kpis = section === 'suprimentos' ? supKpis : section === 'materiais' ? matKpis : section === 'planilhas' ? planKpis : cadeiaKpis

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[#525252] bg-[#3d3d3d] p-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
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
          onClick={() => setImportOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-lg border border-[#525252] bg-[#484848] px-3 py-1.5 text-xs font-medium text-[#f5f5f5] transition-colors hover:bg-[#525252]"
          title="Importar fornecedores de Excel/CSV"
        >
          <Upload size={13} />
          Importar Fornecedores
        </button>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Fornecedores"
        description="Aceita .xlsx, .xls ou .csv no template Atlântico"
        config={SUPPLIER_IMPORT_CONFIG}
        templateFilename="atlantico-fornecedores-template.xlsx"
        commitLabel={(n) => `Importar ${n} ${n === 1 ? 'fornecedor' : 'fornecedores'}`}
        onCommit={(rows) => rows.forEach((supplier) => addSupplier(supplier))}
      />
    </div>
  )
}
