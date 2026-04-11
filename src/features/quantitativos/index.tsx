/**
 * QuantitativosPage — root of the Quantitativos e Orçamento module.
 *
 * Empty state quando não há itens em edição — usuário cria do zero (wizard)
 * ou carrega exemplo via demo mode.
 */
import { useState } from 'react'
import { Sparkles, FlaskConical, FileSpreadsheet, Download, ArrowRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { QuantHeader }     from './components/QuantHeader'
import { ComposicaoPanel } from './components/ComposicaoPanel'
import { ResumoPanel }     from './components/ResumoPanel'
import { BancoDadosPanel } from './components/BancoDadosPanel'
import { HistoricoPanel }  from './components/HistoricoPanel'
import { CriarOrcamentoWizard } from './components/CriarOrcamentoWizard'

export function QuantitativosPage() {
  const activeTab    = useQuantitativosStore((s) => s.activeTab)
  const currentItems = useQuantitativosStore((s) => s.currentItems)
  const loadDemoData = useQuantitativosStore((s) => s.loadDemoData)

  const [wizardOpen, setWizardOpen] = useState(false)

  function renderPanel() {
    switch (activeTab) {
      case 'composicao': return <ComposicaoPanel />
      case 'resumo':     return <ResumoPanel />
      case 'banco':      return <BancoDadosPanel />
      case 'historico':  return <HistoricoPanel />
      default:           return <ComposicaoPanel />
    }
  }

  function downloadOrcamentoTemplate() {
    const headers = ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Custo Unitário (R$)', 'BDI (%)', 'Categoria', 'Fonte', 'Observações']
    const ex1 = ['SINAPI-93358', 'Escavação mecânica em vala', 'm³', '500', '32.50', '25', 'Escavação', 'sinapi', '']
    const ex2 = ['SINAPI-94573', 'Tubo PVC JEI DN 200mm - NTS 048', 'm', '1200', '78.40', '25', 'Tubulação', 'sinapi', '']
    const ex3 = ['CUSTOM-001', 'Poço de Visita D=1.20m (pré-moldado)', 'un', '25', '3250.00', '25', 'Poço de Visita', 'manual', 'Orçamento fornecedor ABC']
    const instr = [
      ['INSTRUÇÕES'], [''],
      ['Coluna', 'Descrição', 'Obrigatório?'],
      ['Código', 'Código SINAPI, SEINFRA ou customizado', 'Não'],
      ['Descrição', 'Nome do serviço ou material', 'SIM'],
      ['Unidade', 'm, m², m³, un, kg, etc.', 'SIM'],
      ['Quantidade', 'Quantidade necessária', 'SIM'],
      ['Custo Unitário (R$)', 'Preço por unidade. Usar ponto decimal.', 'SIM'],
      ['BDI (%)', 'BDI específico do item (padrão: 25%)', 'Não'],
      ['Categoria', 'Ex: Escavação, Tubulação, Pavimentação', 'Não'],
      ['Fonte', 'sinapi, seinfra, custom, ou manual', 'Não'],
      ['Observações', 'Notas livres', 'Não'],
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ex1, ex2, ex3]), 'Orçamento')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instr), 'Instruções')
    XLSX.writeFile(wb, 'atlantico-orcamento-template.xlsx')
  }

  // Empty state — orçamento ainda não existe
  if (currentItems.length === 0 && activeTab === 'composicao') {
    return (
      <div className="flex flex-col h-full bg-[#1f1f1f]">
        <QuantHeader onCreateBudget={() => setWizardOpen(true)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#f97316]/15 flex items-center justify-center">
              <Sparkles size={36} className="text-[#f97316]" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Criar Orçamento</h2>
            <p className="text-[#a3a3a3] text-sm mb-6 leading-relaxed">
              Siga o fluxo para montar seu orçamento de obra:
            </p>

            {/* Flow steps visual */}
            <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
              {['Escolher Base', 'Montar Itens', 'Calcular BDI', 'Exportar'].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3d3d3d] border border-[#525252]">
                    <span className="w-5 h-5 rounded-full bg-[#f97316] text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-xs text-[#f5f5f5] font-medium">{step}</span>
                  </div>
                  {i < 3 && <ArrowRight size={12} className="text-[#525252] hidden sm:block" />}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-[#f97316]/20"
              >
                <Sparkles size={16} />
                Criar Orçamento do Zero
              </button>
              <button
                onClick={() => {
                  // Trigger the import from QuantHeader
                  const input = document.querySelector<HTMLInputElement>('[data-quant-import]')
                  if (input) input.click()
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3a3a3a] hover:bg-[#484848] text-[#f5f5f5] border border-[#525252] rounded-xl font-semibold text-sm transition-colors"
              >
                <FileSpreadsheet size={16} />
                Importar Orçamento Existente
              </button>
              <button
                onClick={loadDemoData}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3a3a3a] hover:bg-[#484848] text-[#f5f5f5] border border-[#525252] rounded-xl font-semibold text-sm transition-colors"
              >
                <FlaskConical size={16} />
                Carregar Exemplo
              </button>
            </div>

            {/* Template download */}
            <button
              onClick={downloadOrcamentoTemplate}
              className="mt-4 flex items-center justify-center gap-2 mx-auto text-[#f97316] hover:text-[#ea580c] text-xs font-medium transition-colors"
            >
              <Download size={13} />
              Baixar template padronizado (.xlsx)
            </button>

            <p className="mt-6 text-[10px] text-[#525252] leading-relaxed">
              Já tem materiais em planilha? Use "Importar Orçamento Existente" — o sistema mapeia as colunas automaticamente.
            </p>
          </div>
        </div>

        <CriarOrcamentoWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#1f1f1f]">
      <QuantHeader onCreateBudget={() => setWizardOpen(true)} />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
      <CriarOrcamentoWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
