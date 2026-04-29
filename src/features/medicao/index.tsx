/**
 * MedicaoPage — 6-step financial billing workflow for Sabesp contract measurement.
 *
 * Steps:
 *   1. Planilha Sabesp  — enter contract items (nPreco, qtd, valor)
 *   2. Critérios        — reference viewer for measurement criteria
 *   3. Subempreiteiros  — subcontractor measurement sheets
 *   4. Fornecedores     — supplier billing
 *   5. Conferência      — auto-computed cross-check (Sabesp vs. subcontractors)
 *   6. Medição Final    — summary + PDF export
 *
 * The existing medicaoStore (segment tracking for operational reporting) is
 * kept intact and accessible via a toggle at the bottom of the page.
 */
import { useState } from 'react'
import { Ruler, Plus, ChevronRight, FileSpreadsheet, BookOpen, Users, Package, CheckCircle, Calculator, History, Download, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import { SabespPlanilhaPanel }   from './components/SabespPlanilhaPanel'
import { CriteriosMedicaoPanel } from './components/CriteriosMedicaoPanel'
import { SubempreiteirosPanel }  from './components/SubempreiteirosPanel'
import { FornecedoresPanel }     from './components/FornecedoresPanel'
import { ConferenciaPanel }      from './components/ConferenciaPanel'
import { MedicaoFinalPanel }     from './components/MedicaoFinalPanel'
import { HistoricoPanel }        from './components/HistoricoPanel'
import { MedicaoAssistidaPanel } from './components/MedicaoAssistidaPanel'
import { RdoEmpreiteiroMedicaoPanel } from './components/RdoEmpreiteiroMedicaoPanel'
import type { BillingStep } from '@/store/medicaoBillingStore'

// ─── Steps metadata ───────────────────────────────────────────────────────────

const STEPS: { step: BillingStep; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { step: 1, label: 'Planilha Sabesp',    shortLabel: 'Sabesp',          icon: FileSpreadsheet },
  { step: 2, label: 'Critérios',          shortLabel: 'Critérios',        icon: BookOpen        },
  { step: 3, label: 'Subempreiteiros',    shortLabel: 'Subempreit.',      icon: Users           },
  { step: 4, label: 'Fornecedores',       shortLabel: 'Fornecedores',     icon: Package         },
  { step: 5, label: 'Conferência',        shortLabel: 'Conferência',      icon: CheckCircle     },
  { step: 6, label: 'Medição Final',      shortLabel: 'Medição Final',    icon: Calculator      },
]

function downloadMedicaoTemplate() {
  // Header row with all contract fields
  const title = ['ATLÂNTICO CONSTRUDATA — TEMPLATE DE MEDIÇÃO CONTRATUAL']
  const subtitle = ['Contrato:', '', 'Período:', '', 'Consórcio/Empresa:', '', 'Responsável:', '']
  const blank: string[] = []
  const headers = [
    'Item', 'nPreço', 'SiiS (Código Resumido)', 'Descrição do Serviço', 'Unidade',
    'Qtd Contratada', 'P. Unitário (R$)', 'Total Contratado (R$)',
    'Qtd Medida Anterior', 'Qtd Medida Período', 'Qtd Acumulada', 'Saldo Qtd',
    'Valor Medido Período (R$)', 'Valor Acumulado (R$)', 'Saldo Valor (R$)',
    'Grupo', 'Status',
  ]

  // 01 - CANTEIROS E PLANOS DE GESTÃO
  const g01 = ['01000000', '', '', 'CANTEIROS E PLANOS DE GESTÃO', '', '', '', '', '', '', '', '', '', '', '', '01', '']
  const r1 = ['01010101', '500001', 'CANT OBRAS IMPL ESG', 'Implantação do Canteiro Esgoto', 'GB', '1', '5381388.60', '5381388.60', '', '', '', '', '', '', '', '01', '']
  const r2 = ['01010102', '500101', 'CANT OBRAS MANUT ESG', 'Manutenção do Canteiro Esgoto', 'MÊS', '24', '165518.49', '3972443.76', '1', '', '', '', '', '', '', '01', '']
  const r3 = ['01020101', '500003', 'PLANO COMERC LIG', 'Plano de Comercialização de Ligações', 'UN', '28031', '207.10', '5805220.10', '', '', '', '', '', '', '', '01', '']
  const r4 = ['01020102', '500004', 'PLANO QUALIDADE', 'Plano de Qualidade Total', 'MÊS', '24', '425619.19', '10214860.56', '1', '', '', '', '', '', '', '01', '']

  // 02 - ESGOTO
  const g02 = ['02000000', '', '', 'ESGOTO', '', '', '', '', '', '', '', '', '', '', '', '02', '']
  const r5 = ['02010101', '420009', 'ASSENT MEC ESG DN150', 'Assentamento mecanizado rede esgoto PVC DN150 até 2m', 'M', '13205.59', '1648.38', '21767830.44', '', '', '', '', '', '', '', '02', '']
  const r6 = ['02010103', '420010', 'ASSENT MEC ESG DN200', 'Assentamento mecanizado rede esgoto PVC DN200 até 2m', 'M', '6918.11', '1888.49', '13064781.55', '', '', '', '', '', '', '', '02', '']
  const r7 = ['02010107', '500008', 'PV CONCRETO 2M MEC', 'PV em tubo de concreto PBJE até 2.00m (escavação mecanizada)', 'UN', '4617', '1721.66', '7948904.22', '', '', '', '', '', '', '', '02', '']

  // 03 - ÁGUA
  const g03 = ['03000000', '', '', 'ÁGUA', '', '', '', '', '', '', '', '', '', '', '', '03', '']
  const r8 = ['03020101', '410355', 'PRA PEAD 32MM C/REP', 'Assentamento rede água PEAD 32mm c/ reposição', 'M', '25552.83', '170.06', '4345514.27', '', '', '', '', '', '', '', '03', '']
  const r9 = ['03030101', '500033', 'LAG ATE 32MM AVUL', 'Ligação/subst ligação avulsa água até 32mm s/repos', 'UN', '2043', '894.48', '1827422.64', '', '', '', '', '', '', '', '03', '']

  // Subempreiteiros sheet
  const subHeaders = ['FECHAMENTO DE MEDIÇÃO — SUBEMPREITEIRO / FORNECEDOR']
  const subFields = [
    ['Mês de Referência:', '', 'Empresa:', '', 'Contrato:', '', 'Obra/Núcleo:', ''],
    blank,
    ['Campo', 'Valor (R$)', 'Observação'],
    ['Medição do Período', '', 'Valor total medido no mês'],
    ['Medição Aprovada', '', 'Valor aprovado após conferência'],
    ['Descontos', '', 'Adiantamentos, taxas, etc.'],
    ['Taxa Adm (%)', '', 'Percentual sobre descontos'],
    ['Adiantamento', '', 'Valor de adiantamento descontado'],
    ['Fechamento Mês Anterior', '', 'Saldo do mês anterior'],
    ['Retenção', '', 'Valor retido (% da medição)'],
    blank,
    ['VALOR DA NF', '', 'Valor final para emissão de Nota Fiscal'],
  ]

  // Instruções
  const instr = [
    ['ATLÂNTICO CONSTRUDATA — INSTRUÇÕES DO TEMPLATE DE MEDIÇÃO'], [''],
    ['ABA', 'CAMPO', 'DESCRIÇÃO', 'OBRIGATÓRIO?', 'EXEMPLO'],
    ['Medição', 'Item', 'Código hierárquico do item na planilha contratual', 'SIM', '02010101'],
    ['Medição', 'nPreço', 'Número de preço Sabesp (identificador único do serviço)', 'SIM', '420009'],
    ['Medição', 'SiiS', 'Código resumido do sistema SiiS da Sabesp', 'Não', 'ASSENT MEC ESG DN150'],
    ['Medição', 'Descrição do Serviço', 'Nome completo do serviço conforme contrato', 'SIM', 'Assentamento mecanizado...'],
    ['Medição', 'Unidade', 'Unidade de medição: M, M², M³, UN, MÊS, GB, EQD', 'SIM', 'M'],
    ['Medição', 'Qtd Contratada', 'Quantidade total prevista no contrato', 'SIM', '13205.59'],
    ['Medição', 'P. Unitário (R$)', 'Preço unitário do contrato (usar ponto como decimal)', 'SIM', '1648.38'],
    ['Medição', 'Total Contratado', 'Fórmula: Qtd Contratada × P. Unitário', 'Auto', '=F×G'],
    ['Medição', 'Qtd Medida Anterior', 'Quantidade acumulada de medições anteriores', 'Não', '0'],
    ['Medição', 'Qtd Medida Período', 'Quantidade medida NESTE período (preencher)', 'SIM', '618.86'],
    ['Medição', 'Qtd Acumulada', 'Fórmula: Anterior + Período', 'Auto', '=I+J'],
    ['Medição', 'Saldo Qtd', 'Fórmula: Contratada - Acumulada', 'Auto', '=F-K'],
    ['Medição', 'Valor Medido Período', 'Fórmula: Qtd Período × P. Unitário', 'Auto', '=J×G'],
    ['Medição', 'Valor Acumulado', 'Fórmula: Qtd Acumulada × P. Unitário', 'Auto', '=K×G'],
    ['Medição', 'Saldo Valor', 'Fórmula: Total Contratado - Valor Acumulado', 'Auto', '=H-N'],
    ['Medição', 'Grupo', '01=Canteiros, 02=Esgoto, 03=Água', 'Recomendado', '02'],
    ['Medição', 'Status', 'Não Iniciado / Em Andamento / Concluído', 'Não', 'Em Andamento'],
    [''],
    ['Subempreiteiros', 'Medição do Período', 'Valor total executado pelo subempreiteiro no mês', 'SIM', '398835.64'],
    ['Subempreiteiros', 'Medição Aprovada', 'Valor aprovado pela fiscalização', 'SIM', '198556.72'],
    ['Subempreiteiros', 'Retenção', 'Valor retido como garantia contratual', 'Não', '200278.93'],
    [''],
    ['REGRAS DE CONFERÊNCIA'],
    ['1. Soma dos subempreiteiros não pode ultrapassar o valor medido na planilha Sabesp'],
    ['2. nPreço deve existir no documento de Critérios de Medição do contrato'],
    ['3. Qtd Medida Período não pode ultrapassar Saldo Qtd disponível'],
    ['4. Grupo deve corresponder à frente de serviço (01=Canteiros, 02=Esgoto, 03=Água)'],
  ]

  const wb = XLSX.utils.book_new()

  // Sheet 1: Medição
  const wsMed = XLSX.utils.aoa_to_sheet([title, subtitle, blank, headers, g01, r1, r2, r3, r4, blank, g02, r5, r6, r7, blank, g03, r8, r9])
  wsMed['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 50 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 16 },
    { wch: 8 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsMed, 'Medição Sabesp')

  // Sheet 2: Subempreiteiros
  const wsSub = XLSX.utils.aoa_to_sheet([subHeaders, ...subFields])
  wsSub['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsSub, 'Subempreiteiros')

  // Sheet 3: Instruções
  const wsInstr = XLSX.utils.aoa_to_sheet(instr)
  wsInstr['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 55 }, { wch: 14 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções')

  XLSX.writeFile(wb, 'atlantico-medicao-template.xlsx')
}

// ─── New Boletim modal ────────────────────────────────────────────────────────

function NewBoletimModal({ onClose }: { onClose: () => void }) {
  const { createBoletim } = useMedicaoBillingStore()
  const [periodo,   setPeriodo]   = useState('')
  const [contrato,  setContrato]  = useState('11481051')
  const [consorcio, setConsorcio] = useState('SE LIGA NA REDE - SANTOS')

  function handleCreate() {
    if (!periodo.trim()) return
    createBoletim(periodo.trim(), contrato.trim(), consorcio.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Novo Boletim de Medição</span>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Período de Medição *</label>
            <input
              autoFocus
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="ex.: mar/26"
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Número do Contrato</label>
            <input
              value={contrato}
              onChange={(e) => setContrato(e.target.value)}
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Consórcio / Empresa</label>
            <input
              value={consorcio}
              onChange={(e) => setConsorcio(e.target.value)}
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={!periodo.trim()}
            className="px-5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#f97316' }}
          >
            Criar Boletim
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stepper header ───────────────────────────────────────────────────────────

function StepperHeader({ onShowHistorico, onShowAssistida, onShowRdoEmpreiteiros }: { onShowHistorico: () => void; onShowAssistida: () => void; onShowRdoEmpreiteiros: () => void }) {
  const { activeStep, setActiveStep, getActiveBoletim, boletins, setActiveBoletim } = useMedicaoBillingStore()
  const [newOpen, setNewOpen] = useState(false)
  const boletim = getActiveBoletim()

  return (
    <>
      <div className="bg-[#2c2c2c] border-b border-[#525252] shrink-0 print:hidden">
        {/* Title bar */}
        <div className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap border-b border-[#525252]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
              <Ruler size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base leading-tight">Módulo de Medição</h1>
              {boletim ? (
                <p className="text-[#a3a3a3] text-xs">
                  Contrato {boletim.contrato} · {boletim.periodo} ·{' '}
                  <span className={`font-medium ${
                    boletim.status === 'finalizado'     ? 'text-emerald-400' :
                    boletim.status === 'em_conferencia' ? 'text-amber-400'   :
                    'text-[#6b6b6b]'
                  }`}>
                    {boletim.status === 'finalizado' ? 'Finalizado' : boletim.status === 'em_conferencia' ? 'Em Conferência' : 'Rascunho'}
                  </span>
                </p>
              ) : (
                <p className="text-[#a3a3a3] text-xs">Boletim de Medição Sabesp</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Boletim selector */}
            {boletins.length > 1 && (
              <select
                value={boletim?.id ?? ''}
                onChange={(e) => setActiveBoletim(e.target.value)}
                className="bg-[#484848] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              >
                {boletins.map((b) => (
                  <option key={b.id} value={b.id}>{b.periodo} — {b.contrato}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onShowAssistida}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20 transition-colors"
            >
              <Calculator size={14} />
              Medição Assistida
            </button>
            <button
              type="button"
              onClick={onShowRdoEmpreiteiros}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              <FileText size={14} />
              RDO por Empreiteiro
            </button>
            <button
              type="button"
              onClick={onShowHistorico}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              <History size={14} />
              Histórico
            </button>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              <Plus size={14} />
              Novo Boletim
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex px-4 py-2 gap-1 min-w-max">
            {STEPS.map((s, idx) => {
              const isActive = activeStep === s.step
              const isPast   = activeStep > s.step
              const Icon     = s.icon
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  disabled={!boletim}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-[#f97316] text-white'
                      : isPast
                      ? 'bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/20'
                      : 'bg-[#3a3a3a] text-[#a3a3a3] hover:bg-[#444] hover:text-[#f5f5f5]'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isActive ? 'bg-white/20' : isPast ? 'bg-[#f97316]/30' : 'bg-[#525252]'
                  }`}>
                    {isPast ? '✓' : s.step}
                  </span>
                  <Icon size={13} className="shrink-0" />
                  <span className="hidden sm:inline">{s.shortLabel}</span>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight size={11} className="ml-1 opacity-40 hidden md:block" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {newOpen && <NewBoletimModal onClose={() => setNewOpen(false)} />}
    </>
  )
}

// ─── Empty state (no boletins) ────────────────────────────────────────────────

function EmptyStateMedicao() {
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: '#f97316' }}
      >
        <Ruler size={32} className="text-white" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Nenhum boletim criado</h2>
      <p className="text-[#a3a3a3] text-sm max-w-md mb-8">
        Crie um Boletim de Medição para registrar as quantidades executadas no período, conferir com os subempreiteiros
        e gerar o relatório final para o contratante (Sabesp).
      </p>
      <button
        type="button"
        onClick={() => setNewOpen(true)}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: '#f97316' }}
      >
        <Plus size={16} />
        Criar Primeiro Boletim
      </button>

      <button
        onClick={downloadMedicaoTemplate}
        className="mt-4 flex items-center gap-2 text-[#f97316] hover:text-[#ea580c] text-xs font-medium transition-colors"
      >
        <Download size={13} />
        Baixar template padronizado (.xlsx)
      </button>

      {newOpen && <NewBoletimModal onClose={() => setNewOpen(false)} />}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicaoPage() {
  const { activeStep, getActiveBoletim, boletins } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const hasBoletins = boletins.length > 0
  const [view, setView] = useState<'stepper' | 'historico' | 'assistida' | 'rdo_empreiteiros'>('stepper')

  function renderStep() {
    switch (activeStep) {
      case 1: return <SabespPlanilhaPanel />
      case 2: return <CriteriosMedicaoPanel />
      case 3: return <SubempreiteirosPanel />
      case 4: return <FornecedoresPanel />
      case 5: return <ConferenciaPanel />
      case 6: return <MedicaoFinalPanel />
      default: return <SabespPlanilhaPanel />
    }
  }

  if (view === 'assistida') {
    return (
      <div className="flex flex-col h-full bg-gray-950">
        <div className="bg-[#2c2c2c] border-b border-[#525252] px-6 py-3 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
              <Calculator size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base">Medição Assistida</h1>
              <p className="text-[#a3a3a3] text-xs">Fluxo completo de medição dentro do sistema</p>
            </div>
          </div>
          <button
            onClick={() => setView('stepper')}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            ← Voltar ao fluxo atual
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <MedicaoAssistidaPanel />
        </div>
      </div>
    )
  }

  if (view === 'rdo_empreiteiros') {
    return (
      <div className="flex flex-col h-full bg-gray-950">
        <div className="bg-[#2c2c2c] border-b border-[#525252] px-6 py-3 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base">RDO por Empreiteiro</h1>
              <p className="text-[#a3a3a3] text-xs">Medicao por nucleo, empreiteira e origem auditavel</p>
            </div>
          </div>
          <button
            onClick={() => setView('stepper')}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            Voltar ao fluxo atual
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <RdoEmpreiteiroMedicaoPanel />
        </div>
      </div>
    )
  }

  if (!hasBoletins || view === 'historico') {
    return (
      <div className="flex flex-col h-full bg-gray-950">
        <div className="bg-[#2c2c2c] border-b border-[#525252] px-6 py-3 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
              <Ruler size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base">Módulo de Medição</h1>
              <p className="text-[#a3a3a3] text-xs">Boletim de Medição Sabesp</p>
            </div>
          </div>
          {view === 'historico' && hasBoletins && (
            <button
              onClick={() => setView('stepper')}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              ← Voltar ao Boletim
            </button>
          )}
          {view !== 'historico' && (
            <div className="flex gap-2">
              <button
                onClick={() => setView('assistida')}
                className="px-3 py-2 rounded-lg text-xs font-medium border border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20 transition-colors"
              >
                Medição Assistida
              </button>
              <button
                onClick={() => setView('rdo_empreiteiros')}
                className="px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                RDO por Empreiteiro
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {view === 'historico'
            ? <HistoricoPanel onOpenBoletim={() => setView('stepper')} />
            : <EmptyStateMedicao />
          }
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <StepperHeader onShowHistorico={() => setView('historico')} onShowAssistida={() => setView('assistida')} onShowRdoEmpreiteiros={() => setView('rdo_empreiteiros')} />
      <div className="flex-1 overflow-auto">
        {boletim ? renderStep() : (
          <div className="p-8 text-center text-[#6b6b6b] text-sm">
            Selecione ou crie um boletim para começar.
          </div>
        )}
      </div>
    </div>
  )
}
