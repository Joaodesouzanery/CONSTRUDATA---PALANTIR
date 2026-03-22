import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgendaStore } from '@/store/agendaStore'
import { taskSchema, type TaskFormValues } from '../schemas'
import type { TaskColor } from '@/types'

const COLOR_OPTIONS: { value: TaskColor; bg: string; border: string; label: string }[] = [
  { value: 'blue',   bg: '#3b82f6', border: '#2563eb', label: 'Azul' },
  { value: 'orange', bg: '#f97316', border: '#ea580c', label: 'Laranja' },
  { value: 'green',  bg: '#22c55e', border: '#16a34a', label: 'Verde' },
  { value: 'red',    bg: '#ef4444', border: '#dc2626', label: 'Vermelho' },
  { value: 'purple', bg: '#a855f7', border: '#9333ea', label: 'Roxo' },
]

const STATUS_OPTIONS = [
  { value: 'scheduled',   label: 'Agendado' },
  { value: 'unscheduled', label: 'Não agendado' },
  { value: 'completed',   label: 'Concluído' },
] as const

export function TaskEditDialog() {
  const { editingTaskId, tasks, resources, addTask, updateTask, deleteTask, setEditingTask } =
    useAgendaStore()

  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew = editingTaskId === 'new'
  const existingTask = isNew ? null : tasks.find((t) => t.id === editingTaskId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      resourceId: resources[0]?.id ?? '',
      startDate: '',
      endDate: '',
      color: 'blue',
      status: 'scheduled',
      notes: '',
    },
  })

  // Populate form when dialog opens
  useEffect(() => {
    if (existingTask) {
      reset({
        title: existingTask.title,
        resourceId: existingTask.resourceId,
        startDate: existingTask.startDate,
        endDate: existingTask.endDate,
        color: existingTask.color,
        status: existingTask.status,
        notes: existingTask.notes ?? '',
      })
    } else if (isNew) {
      reset({
        title: '',
        resourceId: resources[0]?.id ?? '',
        startDate: '',
        endDate: '',
        color: 'blue',
        status: 'scheduled',
        notes: '',
      })
    }
    setConfirmDelete(false)
  }, [editingTaskId, isNew, existingTask, resources, reset])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() {
    setEditingTask(null)
    setConfirmDelete(false)
  }

  function onSubmit(values: TaskFormValues) {
    if (isNew) {
      addTask(values)
    } else if (existingTask) {
      updateTask(existingTask.id, values)
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (existingTask) {
      deleteTask(existingTask.id)
    }
    close()
  }

  const watchedColor = watch('color')

  if (!editingTaskId) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      {/* Panel */}
      <div
        className="w-full max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Nova Tarefa' : 'Editar Tarefa'}
          </h2>
          <button
            onClick={close}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#252525] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 px-6 py-5 max-h-[70vh] overflow-y-auto">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                Título <span className="text-[#ef4444]">*</span>
              </label>
              <input
                {...register('title')}
                placeholder="Ex: Escavação Fase 1"
                className={cn(
                  'bg-[#111111] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
                  errors.title
                    ? 'border-[#ef4444]'
                    : 'border-[#2a2a2a] focus:border-[#f97316]'
                )}
              />
              {errors.title && (
                <span className="text-[11px] text-[#ef4444]">{errors.title.message}</span>
              )}
            </div>

            {/* Resource */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                Recurso <span className="text-[#ef4444]">*</span>
              </label>
              <select
                {...register('resourceId')}
                className={cn(
                  'bg-[#111111] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors',
                  errors.resourceId
                    ? 'border-[#ef4444]'
                    : 'border-[#2a2a2a] focus:border-[#f97316]'
                )}
              >
                <option value="">Selecione um recurso</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
              {errors.resourceId && (
                <span className="text-[11px] text-[#ef4444]">{errors.resourceId.message}</span>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                  Data Início <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="date"
                  {...register('startDate')}
                  className={cn(
                    'bg-[#111111] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors',
                    errors.startDate
                      ? 'border-[#ef4444]'
                      : 'border-[#2a2a2a] focus:border-[#f97316]'
                  )}
                />
                {errors.startDate && (
                  <span className="text-[11px] text-[#ef4444]">{errors.startDate.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                  Data Fim <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="date"
                  {...register('endDate')}
                  className={cn(
                    'bg-[#111111] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none transition-colors',
                    errors.endDate
                      ? 'border-[#ef4444]'
                      : 'border-[#2a2a2a] focus:border-[#f97316]'
                  )}
                />
                {errors.endDate && (
                  <span className="text-[11px] text-[#ef4444]">{errors.endDate.message}</span>
                )}
              </div>
            </div>

            {/* Color */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                Cor
              </label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValue('color', opt.value)}
                    title={opt.label}
                    className="transition-transform hover:scale-110"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: opt.bg,
                      border: watchedColor === opt.value
                        ? `3px solid ${opt.border}`
                        : '2px solid transparent',
                      outline: watchedColor === opt.value ? `2px solid ${opt.bg}` : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                Status
              </label>
              <select
                {...register('status')}
                className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316] transition-colors"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
                Observações
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Informações adicionais..."
                className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316] transition-colors resize-none placeholder:text-[#3f3f3f]"
              />
              {errors.notes && (
                <span className="text-[11px] text-[#ef4444]">{errors.notes.message}</span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a2a]">
            {/* Delete */}
            {!isNew && (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-[#ef4444]" />
                    <span className="text-xs text-[#ef4444]">Confirmar exclusão?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="text-xs px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold transition-colors"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs px-2 py-1 rounded bg-[#252525] text-[#a3a3a3] hover:bg-[#2a2a2a] transition-colors"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors"
                  >
                    <Trash2 size={13} />
                    Excluir
                  </button>
                )}
              </div>
            )}
            {isNew && <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#3a3a3a] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea6a00] disabled:opacity-50 transition-colors"
              >
                {isNew ? 'Criar Tarefa' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
