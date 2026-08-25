import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { usePermissaoEscrita, ROLES_MAO_DE_OBRA_WRITE } from '@/lib/roles'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useShallow } from 'zustand/react/shallow'
import { timecardSchema, type TimecardFormData } from '../../schemas'
import type { TimecardEntry } from '@/types'
import { hojeLocalISO } from '@/lib/utils'

interface Props {
  onClose: () => void
  /** Quando informado, o diálogo corrige este apontamento em vez de criar um novo. */
  apontamento?: TimecardEntry
}

const emptyForm: TimecardFormData = {
  workerId:            '',
  date:                hojeLocalISO(),
  hoursWorked:         8,
  projectRef:          'PRJ-001',
  phaseRef:            'Construção',
  activityDescription: '',
  reportedQty:         0,
  unit:                'm²',
  notes:               '',
}

const UNITS = ['m²', 'm³', 'kg', 'un', 'm', 'serv']

export function TimecardDialog({ onClose, apontamento }: Props) {
  const { workers, addTimecard, updateTimecard } = useMaoDeObraStore(useShallow((s) => ({
    workers: s.workers, addTimecard: s.addTimecard, updateTimecard: s.updateTimecard,
  })))
  const [form, setForm]     = useState<TimecardFormData>(
    apontamento
      ? {
          workerId:            apontamento.workerId,
          date:                apontamento.date,
          hoursWorked:         apontamento.hoursWorked,
          projectRef:          apontamento.projectRef,
          phaseRef:            apontamento.phaseRef,
          activityDescription: apontamento.activityDescription,
          reportedQty:         apontamento.reportedQty,
          unit:                apontamento.unit,
          notes:               apontamento.notes ?? '',
        }
      : emptyForm,
  )
  const [errors, setErrors] = useState<Partial<Record<keyof TimecardFormData, string>>>({})
  const permissao = usePermissaoEscrita(ROLES_MAO_DE_OBRA_WRITE)

  function handleField<K extends keyof TimecardFormData>(key: K, val: TimecardFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = timecardSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof TimecardFormData, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof TimecardFormData
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    // `addTimecard` devolve sem fazer nada quando o papel não autoriza. Fechar o diálogo aqui
    // jogava fora o apontamento inteiro sem uma palavra de aviso.
    if (!permissao.pode) return
    if (apontamento) updateTimecard(apontamento.id, parsed.data)
    else addTimecard(parsed.data)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#333333] border border-[#525252] rounded-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[#f5f5f5] text-base font-semibold">{apontamento ? 'Corrigir Apontamento' : 'Novo Apontamento'}</h2>
          <button onClick={onClose} className="text-[#adadad] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        {!permissao.pode && (
          <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span><strong>Este acesso não lança apontamento.</strong> {permissao.explicacao}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Worker */}
          <label className="flex flex-col gap-1">
            <span className="text-[#adadad] text-xs font-medium">Funcionário *</span>
            <select
              value={form.workerId}
              onChange={(e) => handleField('workerId', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            >
              <option value="">Selecionar...</option>
              {workers
                .filter((w) => w.status === 'active')
                .map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </select>
            {errors.workerId && <span className="text-[#fca5a5] text-xs">{errors.workerId}</span>}
          </label>

          {/* Date + HH row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[#adadad] text-xs font-medium">Data *</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleField('date', e.target.value)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              />
              {errors.date && <span className="text-[#fca5a5] text-xs">{errors.date}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[#adadad] text-xs font-medium">Horas trabalhadas *</span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={form.hoursWorked}
                onChange={(e) => handleField('hoursWorked', parseFloat(e.target.value) || 0)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              />
              {errors.hoursWorked && <span className="text-[#fca5a5] text-xs">{errors.hoursWorked}</span>}
            </label>
          </div>

          {/* Activity */}
          <label className="flex flex-col gap-1">
            <span className="text-[#adadad] text-xs font-medium">Atividade *</span>
            <input
              type="text"
              maxLength={200}
              value={form.activityDescription}
              onChange={(e) => handleField('activityDescription', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              placeholder="Ex: Elevação de alvenaria bloco A"
            />
            {errors.activityDescription && (
              <span className="text-[#fca5a5] text-xs">{errors.activityDescription}</span>
            )}
          </label>

          {/* Qty + Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[#adadad] text-xs font-medium">Quantidade produzida</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.reportedQty}
                onChange={(e) => handleField('reportedQty', parseFloat(e.target.value) || 0)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[#adadad] text-xs font-medium">Unidade</span>
              <select
                value={form.unit}
                onChange={(e) => handleField('unit', e.target.value)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>

          {/* Notes */}
          <label className="flex flex-col gap-1">
            <span className="text-[#adadad] text-xs font-medium">Observações</span>
            <textarea
              maxLength={500}
              rows={2}
              value={form.notes}
              onChange={(e) => handleField('notes', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] resize-none"
              placeholder="Opcional..."
            />
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-sm hover:bg-[#484848] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!permissao.pode}
              className="px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
