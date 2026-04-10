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
import { Ruler, Plus, ChevronRight, FileSpreadsheet, BookOpen, Users, Package, CheckCircle, Calculator } from 'lucide-react'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import { SabespPlanilhaPanel }   from './components/SabespPlanilhaPanel'
import { CriteriosMedicaoPanel } from './components/CriteriosMedicaoPanel'
import { SubempreiteirosPanel }  from './components/SubempreiteirosPanel'
import { FornecedoresPanel }     from './components/FornecedoresPanel'
import { ConferenciaPanel }      from './components/ConferenciaPanel'
import { MedicaoFinalPanel }     from './components/MedicaoFinalPanel'
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

function StepperHeader() {
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
      {newOpen && <NewBoletimModal onClose={() => setNewOpen(false)} />}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicaoPage() {
  const { activeStep, getActiveBoletim, boletins } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const hasBoletins = boletins.length > 0

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

  if (!hasBoletins) {
    return (
      <div className="flex flex-col h-full bg-gray-950">
        <div className="bg-[#2c2c2c] border-b border-[#525252] px-6 py-3 flex items-center gap-3 print:hidden">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
            <Ruler size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-base">Módulo de Medição</h1>
            <p className="text-[#a3a3a3] text-xs">Boletim de Medição Sabesp</p>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <EmptyStateMedicao />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <StepperHeader />
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
