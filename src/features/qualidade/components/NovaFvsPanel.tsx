/**
 * NovaFvsPanel — Formulário para criar uma nova Ficha de Verificação de Solda.
 *
 * Estrutura:
 *  1. Cabeçalho (Identificação, Contrato, Data)
 *  2. Verificação de Solda PEAD  (itens 1-4)
 *  3. Controle de Parâmetros de Solda (itens 5-9)
 *  4. Descrição do Problema e Ações de Adequação
 *  5. Não Conformidade (NC)
 *  6. Fechamento (assinaturas)
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronDown, ChevronRight, Plus, Trash2,
  ClipboardList, Settings, AlertTriangle, FileWarning, PenLine, Save,
} from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { fvsSchema, FVS_ITEMS_TEMPLATE } from '../schemas'
import type { FvsFormData } from '../schemas'
import type { FvsItem, FvsConformity, FvsProblemAction } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const inputCls = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors'
const textareaCls = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors resize-none'

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-red-400 text-xs mt-1">{msg}</p>
}

// ─── Section component ────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ─── Conformity selector ──────────────────────────────────────────────────────

interface ConformityButtonsProps {
  value: FvsConformity
  onChange: (next: FvsConformity) => void
}

function ConformityButtons({ value, onChange }: ConformityButtonsProps) {
  const options: Array<{ key: NonNullable<FvsConformity>; label: string; bg: string; ring: string }> = [
    { key: 'conforme',      label: 'Conforme',     bg: 'bg-emerald-600 hover:bg-emerald-500', ring: 'ring-emerald-400' },
    { key: 'nao_conforme',  label: 'Não Conforme', bg: 'bg-red-600 hover:bg-red-500',         ring: 'ring-red-400'     },
    { key: 'reinspecao_ok', label: 'Reinsp. OK',   bg: 'bg-blue-600 hover:bg-blue-500',       ring: 'ring-blue-400'    },
  ]
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(active ? null : opt.key)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              active
                ? `${opt.bg} text-white ring-2 ${opt.ring}`
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Item row component ───────────────────────────────────────────────────────

interface ItemRowProps {
  item: FvsItem
  onChange: (next: Partial<FvsItem>) => void
}

function ItemRow({ item, onChange }: ItemRowProps) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b border-gray-700/50 last:border-b-0">
      <div className="col-span-1 pt-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-teal-900/40 text-teal-300 text-sm font-bold">
          {item.number}
        </span>
      </div>
      <div className="col-span-3">
        <div className="text-gray-100 text-sm font-medium pt-1.5">{item.description}</div>
      </div>
      <div className="col-span-4">
        <input
          type="text"
          value={item.criteria}
          onChange={(e) => onChange({ criteria: e.target.value })}
          placeholder="Critério de aceitação"
          className={inputCls}
        />
      </div>
      <div className="col-span-3">
        <ConformityButtons value={item.conformity} onChange={(next) => onChange({ conformity: next })} />
      </div>
      <div className="col-span-1">
        <input
          type="date"
          value={item.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value || null })}
          className={inputCls}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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

export function NovaFvsPanel() {
  const { addFvs, setActiveTab, fvss } = useQualidadeStore()
  const logos = useCompanySettingsStore((s) => s.logos)
  const nextNumber = fvss.length > 0 ? Math.max(...fvss.map((f) => f.number)) + 1 : 1
  const [selectedLogoId, setSelectedLogoId] = useState<string | undefined>(undefined)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FvsFormData>({
    resolver: zodResolver(fvsSchema),
    defaultValues: {
      identificationNo:  `FVS-${String(nextNumber).padStart(3, '0')}/${new Date().getFullYear()}`,
      contractNo:        '00.954/24',
      date:              todayStr(),
      ncRequired:        false,
      ncNumber:          '',
      responsibleLeader: '',
      weldTrackingNo:    '',
      welderSignature:   '',
      qualitySignature:  '',
    },
  })

  const ncRequiredValue = watch('ncRequired')

  const [items, setItems]       = useState<FvsItem[]>(makeBlankItems)
  const [problems, setProblems] = useState<Omit<FvsProblemAction, 'id'>[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const verificacaoSoldaItems = items.filter((i) => i.group === 'verificacao_solda')
  const controleParametrosItems = items.filter((i) => i.group === 'controle_parametros')

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

  function onSubmit(data: FvsFormData) {
    setSubmitError(null)

    // Basic sanity check: at least one item should have a conformity decision
    const decided = items.filter((i) => i.conformity !== null).length
    if (decided === 0) {
      setSubmitError('Marque a conformidade de pelo menos um item antes de salvar.')
      return
    }

    try {
      addFvs({
        identificationNo:  data.identificationNo,
        contractNo:        data.contractNo,
        date:              data.date,
        items:             items,
        problems:          problems.map((p) => ({ ...p, id: crypto.randomUUID() })),
        ncRequired:        data.ncRequired,
        ncNumber:          data.ncNumber,
        responsibleLeader: data.responsibleLeader,
        weldTrackingNo:    data.weldTrackingNo,
        welderSignature:   data.welderSignature,
        qualitySignature:  data.qualitySignature,
        logoId:            selectedLogoId,
      })

      setSubmitSuccess(true)
      reset()
      setItems(makeBlankItems())
      setProblems([])
      setSelectedLogoId(undefined)

      setTimeout(() => {
        setSubmitSuccess(false)
        setActiveTab('historico')
      }, 1500)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar FVS.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Cabeçalho */}
      <Section title="Informações Gerais" icon={<ClipboardList size={16} className="text-teal-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">Nº Identificação FVS *</label>
            <input type="text" {...register('identificationNo')} className={inputCls} />
            <FieldError msg={errors.identificationNo?.message} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">Contrato n° *</label>
            <input type="text" {...register('contractNo')} className={inputCls} />
            <FieldError msg={errors.contractNo?.message} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">Data *</label>
            <input type="date" {...register('date')} className={inputCls} />
            <FieldError msg={errors.date?.message} />
          </div>
        </div>

        {/* Logo selector */}
        {logos.length > 0 && (
          <div className="mt-4">
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-2">
              Logo para o PDF
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedLogoId(undefined)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  selectedLogoId === undefined
                    ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                Sem logo
              </button>
              {logos.map((logo) => (
                <button
                  key={logo.id}
                  type="button"
                  onClick={() => setSelectedLogoId(logo.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    selectedLogoId === logo.id
                      ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-gray-100'
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
      </Section>

      {/* Verificação de Solda PEAD */}
      <Section title="Verificação de Solda PEAD" icon={<ClipboardList size={16} className="text-teal-400" />}>
        <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-gray-700 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
          <div className="col-span-1 text-center">Item</div>
          <div className="col-span-3">Verificação</div>
          <div className="col-span-4">Critérios de Aceitação</div>
          <div className="col-span-3">Conformidade</div>
          <div className="col-span-1">Data</div>
        </div>
        {verificacaoSoldaItems.map((item) => (
          <ItemRow key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} />
        ))}
      </Section>

      {/* Controle de Parâmetros de Solda */}
      <Section title="Controle de Parâmetros de Solda" icon={<Settings size={16} className="text-teal-400" />}>
        <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-gray-700 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
          <div className="col-span-1 text-center">Item</div>
          <div className="col-span-3">Verificação</div>
          <div className="col-span-4">Critérios de Aceitação</div>
          <div className="col-span-3">Conformidade</div>
          <div className="col-span-1">Data</div>
        </div>
        {controleParametrosItems.map((item) => (
          <ItemRow key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} />
        ))}
      </Section>

      {/* Problemas e Ações */}
      <Section
        title="Descrição do Problema e Ações de Adequação"
        icon={<AlertTriangle size={16} className="text-yellow-400" />}
        defaultOpen={false}
      >
        {problems.length === 0 && (
          <p className="text-gray-500 text-sm italic mb-3">Nenhum problema registrado.</p>
        )}
        {problems.map((p, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 mb-3 p-3 bg-gray-700/30 rounded-lg">
            <div className="col-span-1">
              <label className="text-[10px] text-gray-400 block">Item</label>
              <input
                type="number"
                min={1}
                max={9}
                value={p.itemNumber}
                onChange={(e) => updateProblem(idx, { itemNumber: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div className="col-span-5">
              <label className="text-[10px] text-gray-400 block">Descrição do Problema</label>
              <textarea
                rows={2}
                value={p.description}
                onChange={(e) => updateProblem(idx, { description: e.target.value })}
                className={textareaCls}
              />
            </div>
            <div className="col-span-5">
              <label className="text-[10px] text-gray-400 block">Ação</label>
              <textarea
                rows={2}
                value={p.action}
                onChange={(e) => updateProblem(idx, { action: e.target.value })}
                className={textareaCls}
              />
            </div>
            <div className="col-span-1 flex items-end justify-center">
              <button
                type="button"
                onClick={() => removeProblem(idx)}
                className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                title="Remover"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addProblem}
          className="flex items-center gap-1.5 text-teal-400 text-sm hover:text-teal-300 transition-colors"
        >
          <Plus size={14} /> Adicionar problema/ação
        </button>
      </Section>

      {/* NC */}
      <Section
        title="Não Conformidade (NC)"
        icon={<FileWarning size={16} className="text-red-400" />}
        defaultOpen={false}
      >
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('ncRequired')}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm text-gray-200">Necessário abertura de NC</span>
          </label>
          {ncRequiredValue && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-400 block mb-1">Nº Não Conformidade</label>
              <input
                type="text"
                {...register('ncNumber')}
                placeholder="ex.: NC-2026-007"
                className={inputCls}
              />
            </div>
          )}
        </div>
      </Section>

      {/* Fechamento */}
      <Section title="Fechamento da FVS" icon={<PenLine size={16} className="text-teal-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">Líder Responsável *</label>
            <input type="text" {...register('responsibleLeader')} className={inputCls} />
            <FieldError msg={errors.responsibleLeader?.message} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">N° de Rastreio da Solda</label>
            <input type="text" {...register('weldTrackingNo')} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">Assinatura Soldador</label>
            <input
              type="text"
              {...register('welderSignature')}
              placeholder="Nome do soldador"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-medium">Assinatura Resp. Qualidade</label>
            <input
              type="text"
              {...register('qualitySignature')}
              placeholder="Nome do responsável pela qualidade"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* Submit */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-xs text-gray-500">
          FVS Nº <span className="font-bold text-gray-300">#{nextNumber}</span> · Salvamento gera registro no histórico
        </div>
        <div className="flex items-center gap-3">
          {submitError && <span className="text-red-400 text-sm">{submitError}</span>}
          {submitSuccess && <span className="text-emerald-400 text-sm font-medium">✓ FVS salva com sucesso!</span>}
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Save size={16} />
            Salvar FVS
          </button>
        </div>
      </div>
    </form>
  )
}
