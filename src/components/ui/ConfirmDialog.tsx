/**
 * ConfirmDialog — reusable confirmation modal (esp. for destructive actions).
 * Renders nothing when `open` is false. Matches the app's dark modal style and
 * is responsive on mobile.
 */
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#525252] bg-[#333333] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#525252] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                destructive ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-[#f97316]/15 text-[#f97316]'
              }`}
            >
              <AlertTriangle size={16} />
            </span>
            <h3 className="text-sm font-bold text-[#f5f5f5]">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-[#6b6b6b] transition-colors hover:text-[#f5f5f5]"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {message && <p className="px-5 py-4 text-sm leading-relaxed text-[#a3a3a3]">{message}</p>}

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="min-h-10 rounded-lg border border-[#525252] px-4 py-2 text-xs font-medium text-[#a3a3a3] transition-colors hover:text-[#f5f5f5]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-10 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors ${
              destructive ? 'bg-[#ef4444] hover:bg-[#dc2626]' : 'bg-[#f97316] hover:bg-[#ea580c]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
