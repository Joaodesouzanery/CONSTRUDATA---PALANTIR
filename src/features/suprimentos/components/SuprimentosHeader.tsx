import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export type SuprimentosTab = 'conciliacao' | 'excecoes' | 'previsao' | 'requisicoes' | 'materiais' | 'contratos' | 'estoque' | 'semaforo' | 'whatif' | 'nucleoResumo'

export type SuprimentosSection = 'suprimentos' | 'materiais' | 'nucleos'

interface Props {
  section:    SuprimentosSection
  activeTab:  SuprimentosTab
  onTabChange: (tab: SuprimentosTab) => void
}

const ALL_TABS: { key: SuprimentosTab; label: string; section: SuprimentosSection }[] = [
  { key: 'conciliacao', label: 'Conciliação',              section: 'suprimentos' },
  { key: 'excecoes',    label: 'Exceções',                 section: 'suprimentos' },
  { key: 'previsao',    label: 'Previsão de Demanda',      section: 'suprimentos' },
  { key: 'requisicoes', label: 'Requisições',              section: 'suprimentos' },
  { key: 'materiais',   label: 'Materiais & Fornecedores', section: 'materiais'   },
  { key: 'contratos',   label: 'Contrato 360',             section: 'materiais'   },
  { key: 'estoque',     label: 'Mapa de Estoque',          section: 'materiais'   },
  { key: 'semaforo',    label: 'Semáforo de Prontidão',    section: 'materiais'   },
  { key: 'whatif',      label: 'What-if Logístico',        section: 'materiais'   },
  { key: 'nucleoResumo', label: 'Resumo por Núcleo',       section: 'nucleos'     },
]

export function SuprimentosHeader({ section, activeTab, onTabChange }: Props) {
  const { purchaseOrders, matches, exceptions, estoqueItens, nucleoResumos } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders: s.purchaseOrders,
      matches:        s.matches,
      exceptions:     s.exceptions,
      estoqueItens:   s.estoqueItens,
      nucleoResumos:  s.nucleoResumos,
    }))
  )

  const visibleTabs = ALL_TABS.filter((t) => t.section === section)

  // ── Suprimentos KPIs ──────────────────────────────────────────────────────
  const totalPOs       = purchaseOrders.length
  const conciliado     = matches.filter((m) => m.status === 'matched').length
  const parcial        = matches.filter((m) => m.status === 'partial').length
  const comExcecao     = matches.filter((m) => m.status === 'discrepancy').length
  const openExceptions = exceptions.filter((e) => e.status === 'open' || e.status === 'escalated').length

  // ── Materiais & Estoque KPIs ───────────────────────────────────────────────
  const totalItens  = estoqueItens.length
  const emRuptura   = estoqueItens.filter((i) => i.qtdDisponivel === 0).length
  const emTransito  = estoqueItens.filter((i) => i.qtdTransito > 0).length
  const valorTotal  = estoqueItens.reduce((s, i) => s + i.qtdDisponivel * (i.custoUnitario ?? 0), 0)

  const supKpis = [
    { label: 'Conciliadas',  value: conciliado,  color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Parciais',     value: parcial,     color: 'text-[#fbbf24]', bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
    { label: 'Com Exceção',  value: comExcecao,  color: 'text-[#f87171]', bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Total OCs',    value: totalPOs,    color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]'       },
  ]

  const matKpis = [
    { label: 'Total Itens',      value: totalItens,   color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]'       },
    { label: 'Em Ruptura',       value: emRuptura,    color: 'text-[#f87171]', bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Em Trânsito',      value: emTransito,   color: 'text-[#fbbf24]', bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
    { label: 'Valor em Estoque', value: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                                             color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
  ]

  // ── Núcleos KPIs ────────────────────────────────────────────────────────────
  const totalNucleos    = nucleoResumos.length
  const nucleoTrechos   = nucleoResumos.reduce((s, n) => s + n.trechosExecutados, 0)
  const nucleoTrechosT  = nucleoResumos.reduce((s, n) => s + n.trechosTotal, 0)
  const nucleoMetrosExec = nucleoResumos.reduce((s, n) => s + n.metrosExecutados, 0)
  const nucleoAvgProg   = totalNucleos > 0
    ? nucleoResumos.reduce((s, n) => s + n.progressoPct, 0) / totalNucleos
    : 0

  const nucKpis = [
    { label: 'Total Núcleos',       value: totalNucleos,    color: 'text-[#f5f5f5]', bg: 'bg-[#3d3d3d] border-[#525252]' },
    { label: 'Trechos Exec/Total',  value: `${nucleoTrechos}/${nucleoTrechosT}`, color: 'text-[#38bdf8]', bg: 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30' },
    { label: 'Metros Executados',   value: nucleoMetrosExec.toLocaleString('pt-BR'), color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: '% Progresso Médio',   value: `${nucleoAvgProg.toFixed(1)}%`,
                                             color: nucleoAvgProg >= 75 ? 'text-[#4ade80]' : nucleoAvgProg >= 40 ? 'text-[#fbbf24]' : 'text-[#f87171]',
                                             bg: nucleoAvgProg >= 75 ? 'bg-[#16a34a]/10 border-[#16a34a]/30' : nucleoAvgProg >= 40 ? 'bg-[#ca8a04]/10 border-[#ca8a04]/30' : 'bg-[#dc2626]/10 border-[#dc2626]/30' },
  ]

  const kpis = section === 'suprimentos' ? supKpis : section === 'materiais' ? matKpis : nucKpis

  return (
    <div className="flex flex-col gap-4 shrink-0">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({ label, value, color, bg }) => (
          <div key={label} className={cn('border rounded-xl p-4 flex flex-col gap-1', bg)}>
            <p className="text-[#6b6b6b] text-xs">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar + exception badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-[#3d3d3d] border border-[#525252] rounded-lg p-1 flex-wrap">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-[#f97316] text-white'
                  : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {section === 'suprimentos' && openExceptions > 0 && (
          <span
            onClick={() => onTabChange('excecoes')}
            className="px-2.5 py-1 rounded-full bg-[#dc2626]/20 text-[#f87171] text-xs font-semibold cursor-pointer hover:bg-[#dc2626]/30 transition-colors"
          >
            {openExceptions} exceção{openExceptions > 1 ? 'ões' : ''} aberta{openExceptions > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
