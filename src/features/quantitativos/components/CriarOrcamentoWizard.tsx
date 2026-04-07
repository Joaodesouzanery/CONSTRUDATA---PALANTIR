/**
 * CriarOrcamentoWizard — Modal de 3 passos para criar um orçamento do zero.
 *
 * Passo 1: Tipo de obra
 * Passo 2: Base de custo + BDI + opção de itens iniciais
 * Passo 3: Confirmação visual + Criar
 */
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import type { CostBaseSource } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

type ObraType = 'saneamento' | 'edificacao' | 'pavimentacao' | 'geral'

const OBRA_OPTIONS: { value: ObraType; label: string; emoji: string; desc: string }[] = [
  { value: 'saneamento',   label: 'Saneamento',         emoji: '💧', desc: 'Redes de água, esgoto e drenagem' },
  { value: 'edificacao',   label: 'Edificação',         emoji: '🏗️', desc: 'Construção vertical, residencial ou comercial' },
  { value: 'pavimentacao', label: 'Pavimentação',       emoji: '🛣️', desc: 'Vias, calçadas e estacionamentos' },
  { value: 'geral',        label: 'Outro / Genérico',   emoji: '📋', desc: 'Começar com itens vazios' },
]

const COST_BASE_OPTIONS: { value: CostBaseSource; label: string; desc: string }[] = [
  { value: 'sinapi',  label: 'SINAPI',  desc: 'Sistema Nacional de Pesquisa de Custos' },
  { value: 'seinfra', label: 'SEINFRA', desc: 'Tabela de custos da Secretaria de Infraestrutura' },
  { value: 'custom',  label: 'Custom',  desc: 'Base própria importada' },
  { value: 'manual',  label: 'Manual',  desc: 'Inserir todos os custos manualmente' },
]

export function CriarOrcamentoWizard({ open, onClose }: Props) {
  const createBlankBudget = useQuantitativosStore((s) => s.createBlankBudget)

  const [step, setStep] = useState(1)
  const [obraType, setObraType] = useState<ObraType>('saneamento')
  const [costBase, setCostBase] = useState<CostBaseSource>('sinapi')
  const [bdiGlobal, setBdiGlobal] = useState(25)
  const [includeStarterItems, setIncludeStarterItems] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function reset() {
    setStep(1)
    setObraType('saneamento')
    setCostBase('sinapi')
    setBdiGlobal(25)
    setIncludeStarterItems(true)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function nextStep() {
    setError(null)
    if (step === 2 && (bdiGlobal < 0 || bdiGlobal > 100)) {
      setError('BDI deve estar entre 0 e 100%.')
      return
    }
    setStep((s) => Math.min(3, s + 1))
  }

  function prevStep() {
    setError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  function handleCreate() {
    setError(null)
    try {
      createBlankBudget({ obraType, costBase, bdiGlobal, includeStarterItems })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar orçamento.')
    }
  }

  const obraLabel = OBRA_OPTIONS.find((o) => o.value === obraType)?.label ?? obraType
  const costLabel = COST_BASE_OPTIONS.find((c) => c.value === costBase)?.label ?? costBase

  return (
    <div
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f97316] flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-[#f5f5f5] font-bold text-base">Criar Orçamento do Zero</h2>
              <p className="text-[#a3a3a3] text-xs">Passo {step} de 3</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#3a3a3a]">
          <div className="h-full bg-[#f97316] transition-all" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ─── Passo 1: Tipo de obra ─── */}
          {step === 1 && (
            <>
              <h3 className="text-[#f5f5f5] font-semibold text-sm">Qual é o tipo da obra?</h3>
              <p className="text-[#a3a3a3] text-xs">
                Vamos sugerir 5 itens iniciais conforme a categoria.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OBRA_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setObraType(opt.value)}
                    className={`p-4 rounded-xl border text-left transition-colors ${
                      obraType === opt.value
                        ? 'border-[#f97316] bg-[#f97316]/10'
                        : 'border-[#525252] hover:border-[#6b6b6b] bg-[#3a3a3a]'
                    }`}
                  >
                    <div className="text-2xl mb-2">{opt.emoji}</div>
                    <div className={`font-semibold text-sm ${obraType === opt.value ? 'text-[#f97316]' : 'text-[#f5f5f5]'}`}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-[#a3a3a3] mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── Passo 2: Base de custo + BDI ─── */}
          {step === 2 && (
            <>
              <h3 className="text-[#f5f5f5] font-semibold text-sm">Base de Custo e BDI</h3>
              <p className="text-[#a3a3a3] text-xs">
                Escolha qual base de preços vai usar e o BDI inicial. Tudo é editável depois.
              </p>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-bold mb-2 block">
                  Base de custo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {COST_BASE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCostBase(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        costBase === opt.value
                          ? 'border-[#f97316] bg-[#f97316]/10'
                          : 'border-[#525252] hover:border-[#6b6b6b] bg-[#3a3a3a]'
                      }`}
                    >
                      <div className={`font-bold text-xs ${costBase === opt.value ? 'text-[#f97316]' : 'text-[#f5f5f5]'}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-[#a3a3a3] mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-bold mb-2 block">
                  BDI Global ({bdiGlobal}%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={bdiGlobal}
                    onChange={(e) => setBdiGlobal(Number(e.target.value))}
                    className="flex-1 accent-[#f97316]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bdiGlobal}
                    onChange={(e) => setBdiGlobal(Number(e.target.value) || 0)}
                    className="w-20 bg-[#3a3a3a] border border-[#525252] rounded-lg px-2 py-1.5 text-sm text-[#f5f5f5] text-center focus:outline-none focus:border-[#f97316]"
                  />
                </div>
                <p className="text-[10px] text-[#6b6b6b] mt-1.5">
                  BDI = Benefícios e Despesas Indiretas (impostos, lucro, riscos)
                </p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-[#3a3a3a]">
                <input
                  type="checkbox"
                  checked={includeStarterItems}
                  onChange={(e) => setIncludeStarterItems(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#f97316]"
                />
                <div>
                  <span className="text-sm text-[#f5f5f5]">
                    Incluir <strong>5 itens iniciais</strong> de {obraLabel}
                  </span>
                  <p className="text-[10px] text-[#6b6b6b]">
                    Os itens vêm com quantidade e preço zerados — você só preenche os números.
                  </p>
                </div>
              </label>
            </>
          )}

          {/* ─── Passo 3: Confirmação ─── */}
          {step === 3 && (
            <>
              <h3 className="text-[#f5f5f5] font-semibold text-sm">Confirme e Crie</h3>

              <div className="bg-[#1f1f1f] border border-[#525252] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#a3a3a3]">Tipo de obra</span>
                  <span className="text-[#f5f5f5] font-semibold">{obraLabel}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#a3a3a3]">Base de custo</span>
                  <span className="text-[#f5f5f5] font-semibold">{costLabel}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#a3a3a3]">BDI Global</span>
                  <span className="text-[#f5f5f5] font-semibold">{bdiGlobal}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#a3a3a3]">Itens iniciais</span>
                  <span className="text-[#f5f5f5] font-semibold">
                    {includeStarterItems ? '5 itens placeholder' : 'Vazio'}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-[#3a3a3a]">
                  <span className="text-[#a3a3a3]">Total estimado</span>
                  <span className="text-[#f97316] font-bold">R$ 0,00 (a preencher)</span>
                </div>
              </div>

              <p className="text-[10px] text-[#6b6b6b] italic">
                ⚠ Esta ação irá <strong>substituir</strong> os itens atualmente em edição.
                Para preservar o atual, salve-o no histórico antes (botão "Salvar Orçamento").
              </p>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-xs px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#525252] bg-[#1f1f1f] shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] px-3 py-2 rounded transition-colors"
            >
              <ChevronLeft size={14} /> Voltar
            </button>
          ) : <span />}

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg transition-colors"
            >
              Próximo <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg transition-colors"
            >
              <Sparkles size={14} /> Criar Orçamento
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
