/**
 * CriterioPdfPageModal — Renders a specific page from the stored PDF as an image
 * so the user can compare extracted data with the original document.
 */
import { useState, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import { renderPdfPageToImage } from '../utils/parseCriterioPdf'

interface Props {
  isOpen: boolean
  onClose: () => void
  pdfBase64: string
  pageNumber: number
  nPreco: string
}

export function CriterioPdfPageModal({ isOpen, onClose, pdfBase64, pageNumber, nPreco }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.5)

  useEffect(() => {
    if (!isOpen || !pdfBase64 || !pageNumber) return
    setLoading(true)
    setError(null)
    renderPdfPageToImage(pdfBase64, pageNumber, scale)
      .then(setImageUrl)
      .catch(() => setError('Erro ao renderizar página do PDF'))
      .finally(() => setLoading(false))
  }, [isOpen, pdfBase64, pageNumber, scale])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl w-[90vw] max-w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">
              Critério {nPreco} — Página {pageNumber}
            </h2>
            <p className="text-[#a3a3a3] text-xs">Documento PDF original</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              className="p-1.5 rounded-lg bg-[#484848] text-[#a3a3a3] hover:text-white transition-colors"
              title="Diminuir zoom"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-[#a3a3a3] text-xs font-mono w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.25))}
              className="p-1.5 rounded-lg bg-[#484848] text-[#a3a3a3] hover:text-white transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#484848] text-[#a3a3a3] hover:text-white transition-colors ml-2"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-[#f97316] animate-spin" />
              <span className="ml-3 text-[#a3a3a3] text-sm">Renderizando página...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-16">
              <p className="text-[#ef4444] text-sm">{error}</p>
            </div>
          )}
          {imageUrl && !loading && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt={`Página ${pageNumber} do PDF de critérios`}
                className="rounded-lg border border-[#525252] shadow-lg max-w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
