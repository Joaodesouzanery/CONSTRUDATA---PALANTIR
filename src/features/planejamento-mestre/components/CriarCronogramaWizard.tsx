/**
 * CriarCronogramaWizard — Modal de 3 passos para criar um cronograma macro
 * do zero para empresas que estão começando na plataforma.
 *
 * Passo 1: Informações do projeto (nome, tipo, datas)
 * Passo 2: Estrutura inicial (frentes/comunidades + opcional Principais Serviços)
 * Passo 3: Confirmação visual + botão Criar
 */
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2 } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'

interface Props {
  open: boolean
  onClose: () => void
}

type NetworkType = 'agua' | 'esgoto' | 'civil' | 'geral'

const NETWORK_OPTIONS: { value: NetworkType; label: string }[] = [
  { value: 'geral',  label: 'Geral / Misto' },
  { value: 'agua',   label: 'Água' },
  { value: 'esgoto', label: 'Esgoto sanitário' },
  { value: 'civil',  label: 'Construção civil' },
]

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function plus90Days(): string {
  const d = new Date()
  d.setDate(d.getDate() + 90)
  return d.toISOString().slice(0, 10)
}

export function CriarCronogramaWizard({ open, onClose }: Props) {
  const createBlankProject = usePlanejamentoMestreStore((s) => s.createBlankProject)

  const [step, setStep] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [networkType, setNetworkType] = useState<NetworkType>('geral')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(plus90Days())
  const [fronts, setFronts] = useState<string[]>(['Frente 1', 'Frente 2', 'Frente 3'])
  const [includeServices, setIncludeServices] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function reset() {
    setStep(1)
    setProjectName('')
    setNetworkType('geral')
    setStartDate(todayStr())
    setEndDate(plus90Days())
    setFronts(['Frente 1', 'Frente 2', 'Frente 3'])
    setIncludeServices(true)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function nextStep() {
    setError(null)
    if (step === 1) {
      if (!projectName.trim()) { setError('Informe o nome do projeto.'); return }
      if (!startDate || !endDate) { setError('Informe as datas.'); return }
      if (new Date(endDate) <= new Date(startDate)) { setError('Data de fim deve ser posterior à data de início.'); return }
    }
    if (step === 2) {
      if (fronts.length === 0) { setError('Adicione pelo menos uma frente.'); return }
      if (fronts.some((f) => !f.trim())) { setError('Todas as frentes devem ter nome.'); return }
    }
    setStep((s) => Math.min(3, s + 1))
  }

  function prevStep() {
    setError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  function addFront() {
    setFronts((f) => [...f, `Frente ${f.length + 1}`])
  }

  function updateFront(idx: number, value: string) {
    setFronts((f) => f.map((x, i) => (i === idx ? value : x)))
  }

  function removeFront(idx: number) {
    setFronts((f) => f.filter((_, i) => i !== idx))
  }

  function handleCreate() {
    setError(null)
    try {
      createBlankProject({
        projectName: projectName.trim(),
        networkType,
        startDate,
        endDate,
        fronts: fronts.map((f) => f.trim()),
        includeServices,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar projeto.')
    }
  }

  const totalActivities = 1 + fronts.length + (includeServices ? fronts.length : 0)

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
              <h2 className="text-[#f5f5f5] font-bold text-base">Criar Cronograma do Zero</h2>
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
          <div
            className="h-full bg-[#f97316] transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ─── Passo 1: Info do Projeto ─── */}
          {step === 1 && (
            <>
              <h3 className="text-[#f5f5f5] font-semibold text-sm">Informações do Projeto</h3>
              <p className="text-[#a3a3a3] text-xs">
                Comece com o básico. Tudo é editável depois.
              </p>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-bold mb-1.5 block">
                  Nome do projeto *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="ex.: Consórcio Saneamento Setor Norte"
                  className="w-full bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-bold mb-1.5 block">
                  Tipo de obra
                </label>
                <select
                  value={networkType}
                  onChange={(e) => setNetworkType(e.target.value as NetworkType)}
                  className="w-full bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
                >
                  {NETWORK_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-bold mb-1.5 block">
                    Data de início *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-bold mb-1.5 block">
                    Data prevista de fim *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
                  />
                </div>
              </div>
            </>
          )}

          {/* ─── Passo 2: Estrutura WBS ─── */}
          {step === 2 && (
            <>
              <h3 className="text-[#f5f5f5] font-semibold text-sm">Estrutura Inicial (WBS)</h3>
              <p className="text-[#a3a3a3] text-xs">
                Quantas frentes/comunidades a obra terá? Você poderá adicionar mais e editar a hierarquia depois.
              </p>

              <div className="space-y-2">
                {fronts.map((front, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#6b6b6b] w-12">1.{idx + 1}</span>
                    <input
                      type="text"
                      value={front}
                      onChange={(e) => updateFront(idx, e.target.value)}
                      placeholder={`Frente ${idx + 1}`}
                      className="flex-1 bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
                    />
                    {fronts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFront(idx)}
                        className="p-2 text-[#a3a3a3] hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remover frente"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {fronts.length < 10 && (
                  <button
                    type="button"
                    onClick={addFront}
                    className="flex items-center gap-1.5 text-[#f97316] text-xs font-medium hover:text-[#ea580c] mt-2"
                  >
                    <Plus size={13} />
                    Adicionar frente
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-[#3a3a3a]">
                <input
                  type="checkbox"
                  checked={includeServices}
                  onChange={(e) => setIncludeServices(e.target.checked)}
                  className="w-4 h-4 accent-[#f97316]"
                />
                <span className="text-sm text-[#f5f5f5]">
                  Incluir nó <strong>"Principais Serviços"</strong> sob cada frente
                </span>
              </label>
              <p className="text-[10px] text-[#6b6b6b] pl-6 -mt-2">
                Cria automaticamente <code className="text-[#f97316]">1.1.1</code>, <code className="text-[#f97316]">1.2.1</code>, etc. para você começar a derivar serviços.
              </p>
            </>
          )}

          {/* ─── Passo 3: Confirmação ─── */}
          {step === 3 && (
            <>
              <h3 className="text-[#f5f5f5] font-semibold text-sm">Confirme e Crie</h3>
              <p className="text-[#a3a3a3] text-xs">
                Esta é a estrutura que será criada. Você pode editar tudo depois no painel macro.
              </p>

              <div className="bg-[#1f1f1f] border border-[#525252] rounded-lg p-4 font-mono text-xs space-y-1">
                <div className="text-[#f97316]">
                  <strong>1</strong> {projectName || '(sem nome)'} <span className="text-[#6b6b6b]">— Level 0, peso 100</span>
                </div>
                {fronts.map((front, idx) => (
                  <div key={idx}>
                    <div className="text-[#e5e5e5] pl-4">
                      <strong>1.{idx + 1}</strong> {front || `Frente ${idx + 1}`} <span className="text-[#6b6b6b]">— Level 1</span>
                    </div>
                    {includeServices && (
                      <div className="text-[#a3a3a3] pl-8">
                        <strong>1.{idx + 1}.1</strong> Principais Serviços <span className="text-[#6b6b6b]">— Level 2</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#3a3a3a] rounded-lg p-3">
                  <div className="text-xl font-bold text-[#f97316]">{totalActivities}</div>
                  <div className="text-[10px] text-[#a3a3a3] uppercase">Atividades</div>
                </div>
                <div className="bg-[#3a3a3a] rounded-lg p-3">
                  <div className="text-xl font-bold text-[#f97316]">{fronts.length}</div>
                  <div className="text-[10px] text-[#a3a3a3] uppercase">Frentes</div>
                </div>
                <div className="bg-[#3a3a3a] rounded-lg p-3">
                  <div className="text-xl font-bold text-[#f97316]">
                    {Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}d
                  </div>
                  <div className="text-[10px] text-[#a3a3a3] uppercase">Duração</div>
                </div>
              </div>

              <p className="text-[10px] text-[#6b6b6b] italic">
                ⚠ Esta ação irá <strong>substituir</strong> qualquer cronograma existente. Para preservar o atual, salve-o como Baseline antes.
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
              <Sparkles size={14} /> Criar Cronograma
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
