/**
 * NovaFvsPanel — Formulário preenchível IDÊNTICO ao formulário oficial
 * FOR-FVS-02 Rev 00 do Consórcio Integra (Verificação de Solda PEAD).
 *
 * Layout espelha pixel-a-pixel a foto enviada pelo cliente:
 *   - Header com logo + título + código/rev
 *   - Linha de Contrato / Data / Nº FVS
 *   - Tabela única com 9 itens em 2 grupos (Verificação Solda PEAD + Controle Parâmetros)
 *     com colunas: Item | Verificação | Critérios | Conforme | Não conforme | Conforme após reinspeção | Data
 *   - Tabela "Descrição do Problema e Ações de Adequação"
 *   - Linha de NC (SIM/NÃO + Nº NC)
 *   - Bloco "Fechamento da FVS" (4 campos de assinatura)
 */
import { useState } from 'react'
import { Save, Plus, Trash2 } from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { FVS_ITEMS_TEMPLATE } from '../schemas'
import type { FvsItem, FvsConformity, FvsProblemAction } from '@/types'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function makeBlankItems(): FvsItem[] {
  return FVS_ITEMS_TEMPLATE.map((tpl) => ({
    id:          crypto.randomUUID(),
    number:      tpl.number,
    group:       tpl.group,
    description: tpl.description,
    criteria:    '',
    conformity:  null,
    date:        null,
  }))
}

// ─── Reusable cells ───────────────────────────────────────────────────────────

function ConformityCheckbox({
  checked,
  onChange,
  color,
}: {
  checked: boolean
  onChange: () => void
  color: 'green' | 'red' | 'blue'
}) {
  const colorMap = {
    green: 'border-emerald-500 hover:bg-emerald-500/15 text-emerald-400',
    red:   'border-red-500 hover:bg-red-500/15 text-red-400',
    blue:  'border-blue-500 hover:bg-blue-500/15 text-blue-400',
  }
  const fillMap = {
    green: 'bg-emerald-500/30 text-emerald-300',
    red:   'bg-red-500/30 text-red-300',
    blue:  'bg-blue-500/30 text-blue-300',
  }
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-6 h-6 border-2 rounded flex items-center justify-center transition-colors ${
        checked ? fillMap[color] : `bg-transparent ${colorMap[color]}`
      }`}
      aria-label={checked ? 'Marcado' : 'Desmarcado'}
    >
      {checked && <span className="text-base font-black leading-none">✓</span>}
    </button>
  )
}

interface FvsItemRowProps {
  item: FvsItem
  onChange: (next: Partial<FvsItem>) => void
}

function FvsItemRow({ item, onChange }: FvsItemRowProps) {
  function setConformity(value: FvsConformity) {
    onChange({ conformity: value })
  }
  return (
    <tr className="border-b border-[#525252]">
      <td className="border-r border-[#525252] px-2 py-2 text-center align-middle">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#3a3a3a] text-[#f97316] text-sm font-bold">
          {item.number}
        </span>
      </td>
      <td className="border-r border-[#525252] px-3 py-2 text-[#f5f5f5] text-sm font-medium align-middle">
        {item.description}
      </td>
      <td className="border-r border-[#525252] px-2 py-1 align-middle">
        <input
          type="text"
          value={item.criteria}
          onChange={(e) => onChange({ criteria: e.target.value })}
          placeholder="Critério de aceitação…"
          className="w-full bg-transparent border-0 px-2 py-1 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:bg-[#3a3a3a] rounded"
        />
      </td>
      <td className="border-r border-[#525252] px-2 py-2 text-center align-middle">
        <div className="flex items-center justify-center">
          <ConformityCheckbox
            checked={item.conformity === 'conforme'}
            onChange={() => setConformity(item.conformity === 'conforme' ? null : 'conforme')}
            color="green"
          />
        </div>
      </td>
      <td className="border-r border-[#525252] px-2 py-2 text-center align-middle">
        <div className="flex items-center justify-center">
          <ConformityCheckbox
            checked={item.conformity === 'nao_conforme'}
            onChange={() => setConformity(item.conformity === 'nao_conforme' ? null : 'nao_conforme')}
            color="red"
          />
        </div>
      </td>
      <td className="border-r border-[#525252] px-2 py-2 text-center align-middle">
        <div className="flex items-center justify-center">
          <ConformityCheckbox
            checked={item.conformity === 'reinspecao_ok'}
            onChange={() => setConformity(item.conformity === 'reinspecao_ok' ? null : 'reinspecao_ok')}
            color="blue"
          />
        </div>
      </td>
      <td className="px-2 py-1 text-center align-middle">
        <input
          type="date"
          value={item.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value || null })}
          className="w-full bg-transparent border-0 px-1 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:bg-[#3a3a3a] rounded"
        />
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NovaFvsPanel() {
  const { addFvs, setActiveTab, fvss } = useQualidadeStore()
  const { logos, companyName } = useCompanySettingsStore()
  const nextNumber = fvss.length > 0 ? Math.max(...fvss.map((f) => f.number)) + 1 : 1

  // Header fields
  const [documentCode,      setDocumentCode]      = useState('FOR-FVS-02')
  const [revision,          setRevision]          = useState('00')
  const [identificationNo,  setIdentificationNo]  = useState(`FVS-${String(nextNumber).padStart(3, '0')}/${new Date().getFullYear()}`)
  const [contractNo,        setContractNo]        = useState('00.954/24')
  const [date,              setDate]              = useState(todayStr())
  const [selectedLogoId,    setSelectedLogoId]    = useState<string | undefined>(undefined)

  // Items + Problems
  const [items,             setItems]             = useState<FvsItem[]>(makeBlankItems)
  const [problems,          setProblems]          = useState<Omit<FvsProblemAction, 'id'>[]>([])

  // NC + Closure
  const [ncRequired,        setNcRequired]        = useState(false)
  const [ncNumber,          setNcNumber]          = useState('')
  const [responsibleLeader, setResponsibleLeader] = useState('')
  const [weldTrackingNo,    setWeldTrackingNo]    = useState('')
  const [welderSignature,   setWelderSignature]   = useState('')
  const [qualitySignature,  setQualitySignature]  = useState('')

  // UI feedback
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSubmitting,  setIsSubmitting]  = useState(false)

  const verificacaoSoldaItems = items.filter((i) => i.group === 'verificacao_solda')
  const controleParametrosItems = items.filter((i) => i.group === 'controle_parametros')

  const selectedLogo = selectedLogoId
    ? logos.find((l) => l.id === selectedLogoId)
    : logos[0]

  function updateItem(id: string, patch: Partial<FvsItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function addProblem() {
    setProblems((prev) => [...prev, { itemNumber: 1, description: '', action: '' }])
  }
  function updateProblem(idx: number, patch: Partial<Omit<FvsProblemAction, 'id'>>) {
    setProblems((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function removeProblem(idx: number) {
    setProblems((prev) => prev.filter((_, i) => i !== idx))
  }

  function resetForm() {
    setDocumentCode('FOR-FVS-02')
    setRevision('00')
    setIdentificationNo(`FVS-${String(nextNumber + 1).padStart(3, '0')}/${new Date().getFullYear()}`)
    setContractNo('00.954/24')
    setDate(todayStr())
    setItems(makeBlankItems())
    setProblems([])
    setNcRequired(false)
    setNcNumber('')
    setResponsibleLeader('')
    setWeldTrackingNo('')
    setWelderSignature('')
    setQualitySignature('')
    setSelectedLogoId(undefined)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSubmitError(null)

    // Anti-duplicate: bloqueia cliques múltiplos / double submit
    if (isSubmitting || submitSuccess) return

    // Validações
    if (!identificationNo.trim()) { setSubmitError('Nº Identificação FVS é obrigatório.');     return }
    if (!contractNo.trim())       { setSubmitError('Contrato é obrigatório.');                  return }
    if (!date)                    { setSubmitError('Data é obrigatória.');                       return }
    if (!responsibleLeader.trim()){ setSubmitError('Líder Responsável é obrigatório.');         return }

    const decided = items.filter((i) => i.conformity !== null).length
    if (decided === 0) {
      setSubmitError('Marque a conformidade de pelo menos um item antes de salvar.')
      return
    }

    if (ncRequired && !ncNumber.trim()) {
      setSubmitError('Informe o Nº da Não Conformidade quando NC estiver marcada.')
      return
    }

    setIsSubmitting(true)

    try {
      addFvs({
        documentCode,
        revision,
        identificationNo,
        contractNo,
        date,
        items,
        problems: problems.map((p) => ({ ...p, id: crypto.randomUUID() })),
        ncRequired,
        ncNumber,
        responsibleLeader,
        weldTrackingNo,
        welderSignature,
        qualitySignature,
        logoId: selectedLogoId,
      })

      setSubmitSuccess(true)
      resetForm()

      setTimeout(() => {
        setSubmitSuccess(false)
        setIsSubmitting(false)
        setActiveTab('historico')
      }, 1500)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar FVS.')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-w-[1100px] mx-auto">
      {/* ─── Logo selector (não faz parte do formulário oficial — fica antes) ─── */}
      {logos.length > 0 && (
        <div className="bg-[#2c2c2c] border border-[#525252] rounded-lg p-4">
          <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#a3a3a3] mb-2">
            Logo para o PDF
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedLogoId(undefined)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                selectedLogoId === undefined
                  ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                  : 'border-[#525252] text-[#a3a3a3] hover:border-[#6b6b6b]'
              }`}
            >
              {logos[0] ? `Padrão (${logos[0].name})` : 'Sem logo'}
            </button>
            {logos.map((logo) => (
              <button
                key={logo.id}
                type="button"
                onClick={() => setSelectedLogoId(logo.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  selectedLogoId === logo.id
                    ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                    : 'border-[#525252] text-[#e5e5e5] hover:border-[#6b6b6b]'
                }`}
              >
                <div className="w-8 h-5 bg-white rounded flex items-center justify-center overflow-hidden shrink-0">
                  <img src={logo.base64} alt={logo.name} className="max-h-4 max-w-full object-contain" />
                </div>
                {logo.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Header bordered (espelha a foto) ───────────────────────────────── */}
      <div className="bg-[#2c2c2c] border-2 border-[#525252] overflow-hidden">
        {/* Linha 1: Logo + Título + Código/Rev */}
        <div className="grid grid-cols-[100px_1fr_140px] border-b-2 border-[#525252]">
          {/* Logo cell */}
          <div className="border-r-2 border-[#525252] p-3 flex flex-col items-center justify-center bg-[#1f1f1f]">
            <div className="w-14 h-14 bg-white rounded flex items-center justify-center overflow-hidden p-1">
              {selectedLogo ? (
                <img src={selectedLogo.base64} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="w-full h-full bg-[#f97316] rounded flex items-center justify-center text-white text-xl font-black">Q</div>
              )}
            </div>
            <div className="text-[8px] text-[#a3a3a3] mt-1 text-center font-semibold tracking-wider uppercase truncate w-full">
              {companyName}
            </div>
          </div>

          {/* Title cell */}
          <div className="border-r-2 border-[#525252] flex items-center justify-center px-4 py-3">
            <h2 className="text-white text-base sm:text-lg font-bold tracking-wide text-center uppercase">
              Ficha de Verificação de Serviço Solda
            </h2>
          </div>

          {/* Código + Rev cells (editáveis) */}
          <div className="grid grid-rows-2 divide-y-2 divide-[#525252]">
            <div className="px-2 py-1 text-center bg-[#1f1f1f] flex flex-col items-center justify-center">
              <div className="text-[9px] text-[#a3a3a3] font-bold uppercase">Código</div>
              <input
                type="text"
                value={documentCode}
                onChange={(e) => setDocumentCode(e.target.value)}
                className="w-full bg-transparent text-center text-xs text-[#f5f5f5] font-bold focus:outline-none focus:bg-[#3a3a3a] rounded"
              />
            </div>
            <div className="px-2 py-1 text-center bg-[#1f1f1f] flex flex-col items-center justify-center">
              <div className="text-[9px] text-[#a3a3a3] font-bold uppercase">Rev</div>
              <input
                type="text"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                className="w-full bg-transparent text-center text-xs text-[#f5f5f5] font-bold focus:outline-none focus:bg-[#3a3a3a] rounded"
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Contrato / Data / Nº FVS */}
        <div className="grid grid-cols-3 divide-x-2 divide-[#525252] border-b-2 border-[#525252]">
          <div className="px-3 py-2 flex items-center gap-2">
            <label className="text-xs text-[#a3a3a3] font-semibold whitespace-nowrap">Contrato n°:</label>
            <input
              type="text"
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#f5f5f5] font-medium focus:outline-none focus:bg-[#3a3a3a] rounded px-1"
            />
          </div>
          <div className="px-3 py-2 flex items-center gap-2">
            <label className="text-xs text-[#a3a3a3] font-semibold whitespace-nowrap">Data:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#f5f5f5] font-medium focus:outline-none focus:bg-[#3a3a3a] rounded px-1"
            />
          </div>
          <div className="px-3 py-2 flex items-center gap-2">
            <label className="text-xs text-[#a3a3a3] font-semibold whitespace-nowrap">Nº Identificação FVS:</label>
            <input
              type="text"
              value={identificationNo}
              onChange={(e) => setIdentificationNo(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#f5f5f5] font-medium focus:outline-none focus:bg-[#3a3a3a] rounded px-1"
            />
          </div>
        </div>

        {/* ─── Tabela principal ──────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1f1f1f]">
                <th className="border-r border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-12">Item</th>
                <th className="border-r border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-[18%]">Verificação</th>
                <th className="border-r border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3]">Critérios de aceitação</th>
                <th className="border-r border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-[10%]">Conforme</th>
                <th className="border-r border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-[10%]">Não conforme</th>
                <th className="border-r border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-[12%]">Conforme após reinspeção</th>
                <th className="border-b-2 border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-[13%]">Data</th>
              </tr>
            </thead>
            <tbody>
              {/* Grupo 1 */}
              <tr className="bg-[#3a3a3a]">
                <td colSpan={7} className="border-b border-[#525252] px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#f97316]">
                  Verificação de Solda PEAD
                </td>
              </tr>
              {verificacaoSoldaItems.map((item) => (
                <FvsItemRow key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} />
              ))}

              {/* Grupo 2 */}
              <tr className="bg-[#3a3a3a]">
                <td colSpan={7} className="border-b border-t border-[#525252] px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#f97316]">
                  Controle de Parâmetros de Solda
                </td>
              </tr>
              {controleParametrosItems.map((item) => (
                <FvsItemRow key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Descrição do Problema e Ações de Adequação ────────────────────── */}
      <div className="bg-[#2c2c2c] border-2 border-[#525252] overflow-hidden">
        <div className="bg-[#3a3a3a] px-3 py-2 border-b-2 border-[#525252] text-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#f97316]">
            Descrição do Problema e Ações de Adequação
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1f1f1f]">
                <th className="border-r border-b border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-14">Item</th>
                <th className="border-r border-b border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-[45%]">Descrição do Problema</th>
                <th className="border-r border-b border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3]">Ação</th>
                <th className="border-b border-[#525252] px-2 py-2 text-[10px] font-bold uppercase text-[#a3a3a3] w-12"></th>
              </tr>
            </thead>
            <tbody>
              {problems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-[#6b6b6b] italic border-b border-[#525252]">
                    Nenhum problema registrado. Clique em "+ Adicionar problema" abaixo se houver não conformidades a tratar.
                  </td>
                </tr>
              ) : (
                problems.map((p, idx) => (
                  <tr key={idx} className="border-b border-[#525252]">
                    <td className="border-r border-[#525252] px-2 py-1 text-center align-middle">
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={p.itemNumber}
                        onChange={(e) => updateProblem(idx, { itemNumber: Number(e.target.value) })}
                        className="w-full bg-transparent text-center text-sm text-[#f5f5f5] font-bold focus:outline-none focus:bg-[#3a3a3a] rounded"
                      />
                    </td>
                    <td className="border-r border-[#525252] px-2 py-1 align-top">
                      <textarea
                        rows={2}
                        value={p.description}
                        onChange={(e) => updateProblem(idx, { description: e.target.value })}
                        placeholder="Descreva o problema…"
                        className="w-full bg-transparent text-xs text-[#f5f5f5] placeholder-[#6b6b6b] resize-none focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-1"
                      />
                    </td>
                    <td className="border-r border-[#525252] px-2 py-1 align-top">
                      <textarea
                        rows={2}
                        value={p.action}
                        onChange={(e) => updateProblem(idx, { action: e.target.value })}
                        placeholder="Descreva a ação corretiva…"
                        className="w-full bg-transparent text-xs text-[#f5f5f5] placeholder-[#6b6b6b] resize-none focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-1"
                      />
                    </td>
                    <td className="px-2 py-1 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => removeProblem(idx)}
                        className="text-red-400 hover:bg-red-900/20 rounded p-1"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-[#525252] bg-[#1f1f1f]">
          <button
            type="button"
            onClick={addProblem}
            className="flex items-center gap-1.5 text-[#f97316] text-xs font-medium hover:text-[#ea580c] transition-colors"
          >
            <Plus size={13} /> Adicionar problema/ação
          </button>
        </div>
      </div>

      {/* ─── Linha de NC ────────────────────────────────────────────────────── */}
      <div className="bg-[#2c2c2c] border-2 border-[#525252] px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-xs text-[#f5f5f5] font-semibold">Necessário abertura de NC:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ncRequired}
            onChange={() => { setNcRequired(true) }}
            className="w-4 h-4 accent-[#f97316]"
          />
          <span className="text-xs text-[#f5f5f5] font-medium">( {ncRequired ? '✓' : ' '} ) SIM</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!ncRequired}
            onChange={() => { setNcRequired(false); setNcNumber('') }}
            className="w-4 h-4 accent-[#f97316]"
          />
          <span className="text-xs text-[#f5f5f5] font-medium">( {!ncRequired ? '✓' : ' '} ) NÃO</span>
        </label>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label className="text-xs text-[#f5f5f5] font-semibold whitespace-nowrap">Nº Não Conformidade:</label>
          <input
            type="text"
            value={ncNumber}
            onChange={(e) => setNcNumber(e.target.value)}
            disabled={!ncRequired}
            placeholder={ncRequired ? 'ex.: NC-2026-007' : '—'}
            className="flex-1 bg-transparent border-b border-[#525252] text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316] disabled:opacity-50"
          />
        </div>
      </div>

      {/* ─── Fechamento da FVS ──────────────────────────────────────────────── */}
      <div className="bg-[#2c2c2c] border-2 border-[#525252] overflow-hidden">
        <div className="bg-[#3a3a3a] px-3 py-2 border-b-2 border-[#525252] text-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#f97316]">
            Fechamento da FVS
          </h3>
        </div>
        <div className="divide-y divide-[#525252]">
          <div className="px-4 py-2 flex items-center gap-2">
            <label className="text-xs text-[#f5f5f5] font-semibold whitespace-nowrap">Líder Responsável:</label>
            <input
              type="text"
              value={responsibleLeader}
              onChange={(e) => setResponsibleLeader(e.target.value)}
              className="flex-1 bg-transparent border-b border-[#525252] text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] py-1"
            />
          </div>
          <div className="px-4 py-2 flex items-center gap-2">
            <label className="text-xs text-[#f5f5f5] font-semibold whitespace-nowrap">N° de rastreio da solda:</label>
            <input
              type="text"
              value={weldTrackingNo}
              onChange={(e) => setWeldTrackingNo(e.target.value)}
              className="flex-1 bg-transparent border-b border-[#525252] text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] py-1"
            />
          </div>
          <div className="px-4 py-2 flex items-center gap-2">
            <label className="text-xs text-[#f5f5f5] font-semibold whitespace-nowrap">Assinatura soldador:</label>
            <input
              type="text"
              value={welderSignature}
              onChange={(e) => setWelderSignature(e.target.value)}
              placeholder="Nome / matrícula"
              className="flex-1 bg-transparent border-b border-[#525252] text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316] py-1"
            />
          </div>
          <div className="px-4 py-2 flex items-center gap-2">
            <label className="text-xs text-[#f5f5f5] font-semibold whitespace-nowrap">Assinatura Resp. Qualidade:</label>
            <input
              type="text"
              value={qualitySignature}
              onChange={(e) => setQualitySignature(e.target.value)}
              placeholder="Nome / CREA"
              className="flex-1 bg-transparent border-b border-[#525252] text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316] py-1"
            />
          </div>
        </div>
      </div>

      {/* ─── Submit ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
        <div className="text-xs text-[#a3a3a3]">
          FVS Nº <span className="font-bold text-[#f5f5f5]">#{nextNumber}</span> · Os dados são salvos no histórico do sistema
        </div>
        <div className="flex items-center gap-3">
          {submitError && <span className="text-red-400 text-sm font-medium">{submitError}</span>}
          {submitSuccess && <span className="text-emerald-400 text-sm font-medium">✓ FVS salva com sucesso!</span>}
          <button
            type="submit"
            disabled={isSubmitting || submitSuccess}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {isSubmitting ? 'Salvando…' : 'Salvar FVS'}
          </button>
        </div>
      </div>
    </form>
  )
}
