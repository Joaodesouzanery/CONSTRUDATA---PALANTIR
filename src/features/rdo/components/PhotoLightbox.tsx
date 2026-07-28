/**
 * PhotoLightbox — visualizador de fotos em tela cheia (overlay hand-rolled, no
 * padrão dos modais do repo). Clicar numa miniatura do RdoDetalhe amplia aqui,
 * com navegação anterior/próxima (setas ou teclado) e fechar (Esc / clique fora).
 * Reusa RdoPhotoImg para resolver base64/URL assinada.
 */
import { useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { RdoPhotoImg } from './RdoPhotoImg'
import type { RdoPhoto } from '@/types'

export function PhotoLightbox({ photos, index, onClose, onIndexChange }: {
  photos: RdoPhoto[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const count = photos.length
  const prev = useCallback(() => onIndexChange((index - 1 + count) % count), [index, count, onIndexChange])
  const next = useCallback(() => onIndexChange((index + 1) % count), [index, count, onIndexChange])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) prev()
      else if (e.key === 'ArrowRight' && count > 1) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, count])

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-[#333333]/80 hover:bg-[#484848] text-[#f5f5f5] transition-colors"
        title="Fechar (Esc)"
      >
        <X size={18} />
      </button>

      {count > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-4 p-2 rounded-full bg-[#333333]/80 hover:bg-[#484848] text-[#f5f5f5] transition-colors"
          title="Anterior (←)"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      <div className="flex flex-col items-center gap-3 max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <RdoPhotoImg photo={photo} className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg border border-[#525252]" />
        <div className="text-center text-sm text-[#e5e5e5]">
          {photo.label?.trim() || `Foto ${index + 1}`}
          <span className="text-[#6b6b6b]"> · {index + 1}/{count}</span>
        </div>
      </div>

      {count > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-4 p-2 rounded-full bg-[#333333]/80 hover:bg-[#484848] text-[#f5f5f5] transition-colors"
          title="Próxima (→)"
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  )
}
