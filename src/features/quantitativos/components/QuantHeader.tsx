/**
 * QuantHeader — top navigation bar for the Quantitativos e Orçamento module.
 * Accent color: #8b5cf6 (violet-500)
 */
import { useState } from 'react'
import { Calculator, Download, Sparkles, Upload } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { exportToCsv, exportToXlsx } from '../utils/exportEngine'
import { ImportModal } from '@/components/shared/ImportModal'
import { ORCAMENTO_IMPORT_CONFIG } from '@/lib/importConfigs'
import { CalcWizardModal } from './CalcWizardModal'
import type { QuantTab } from '@/types'

const TABS: { key: QuantTab; label: string }[] = [
  { key: 'composicao', label: 'Composição' },
  { key: 'personalizado', label: 'Quantitativo Personalizado' },
  { key: 'resumo',     label: 'Resumo de Custos' },
  { key: 'banco',      label: 'Banco de Dados' },
  { key: 'historico',  label: 'Histórico' },
]

const ACCENT = '#8b5cf6'

interface QuantHeaderProps {
  /** Callback opcional para abrir o wizard "Criar Orçamento do Zero" */
  onCreateBudget?: () => void
}

export function QuantHeader({ onCreateBudget }: QuantHeaderProps = {}) {
  const { activeTab, setActiveTab, currentItems, bdiGlobal, addItems } = useQuantitativosStore()
  const [importOpen, setImportOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <Calculator size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">Quantitativos e Orçamento</h1>
            <p className="text-[#a3a3a3] text-xs">SINAPI · SEINFRA · Base Própria</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCalcOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors shadow-lg"
            style={{ backgroundColor: ACCENT }}
            title="Calcular Quantitativo — fluxo OrcaFascio"
          >
            <Calculator size={15} />
            Calcular
          </button>
          {onCreateBudget && (
            <button
              onClick={onCreateBudget}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#f97316]/50 text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
              title="Criar orçamento do zero (substitui o atual)"
            >
              <Sparkles size={15} />
              Criar Orçamento
            </button>
          )}
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            title="Importar orçamento de um Excel ou CSV"
          >
            <Upload size={15} />
            Importar
          </button>
          <button
            onClick={() => exportToCsv(currentItems)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Download size={15} />
            CSV
          </button>
          <button
            onClick={() => exportToXlsx(currentItems, bdiGlobal)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            <Download size={15} />
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {calcOpen && <CalcWizardModal onClose={() => setCalcOpen(false)} />}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Orçamento"
        description="Aceita .xlsx, .xls ou .csv no template Atlântico"
        config={ORCAMENTO_IMPORT_CONFIG}
        templateFilename="atlantico-orcamento-template.xlsx"
        commitLabel={(n) => `Importar ${n} ${n === 1 ? 'item' : 'itens'}`}
        onCommit={(rows) => addItems(rows)}
      />

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-white border-violet-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'
                }`}
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
