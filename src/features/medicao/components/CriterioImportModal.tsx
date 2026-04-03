/**
 * CriterioImportModal — specialized modal for importing Sabesp criteria PDFs.
 * Handles large multi-page PDFs with progress feedback.
 */
import { useState, useCallback, useRef } from 'react'
import { X, BookOpen, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseCriterioPdf, fileToBase64 } from '../utils/parseCriterioPdf'
import { useCriteriosStore } from '@/store/criteriosStore'
import type { CriterioMedicao } from '@/types'

interface CriterioImportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CriterioImportModal({ isOpen, onClose }: CriterioImportModalProps) {
  const { importCriterios, setPdf } = useCriteriosStore()

  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview'>('upload')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [parsedCriterios, setParsedCriterios] = useState<Omit<CriterioMedicao, 'id'>[]>([])
  const [savePdf, setSavePdf] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setStep('upload')
    setProgress({ current: 0, total: 0 })
    setParsedCriterios([])
    setSavePdf(true)
    setError(null)
    setDragging(false)
    setExpandedId(null)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const processFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Apenas arquivos PDF são aceitos.')
      return
    }

    setFile(f)
    setError(null)
    setStep('parsing')

    try {
      const criterios = await parseCriterioPdf(f, (p) => setProgress(p))
      if (criterios.length === 0) {
        setError('Nenhum critério encontrado no PDF. Verifique se o formato está correto.')
        setStep('upload')
        return
      }
      setParsedCriterios(criterios)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar PDF')
      setStep('upload')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) processFile(f)
    },
    [processFile],
  )

  const handleImport = useCallback(async () => {
    importCriterios(parsedCriterios)

    if (savePdf && file) {
      try {
        const base64 = await fileToBase64(file)
        setPdf(base64, file.name)
      } catch {
        // PDF save failed but criteria were imported - that's ok
      }
    }

    handleClose()
  }, [parsedCriterios, savePdf, file, importCriterios, setPdf, handleClose])

  if (!isOpen) return null

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">
              Importar Critérios de Medição
            </h2>
            <p className="text-[#a3a3a3] text-xs mt-0.5">
              PDF de Regulamentação de Preços e Critérios (Sabesp)
            </p>
          </div>
          <button onClick={handleClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Upload step */}
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors',
                dragging
                  ? 'border-[#f97316] bg-[#f97316]/10'
                  : 'border-[#525252] hover:border-[#a3a3a3] bg-[#3d3d3d]/50',
              )}
            >
              <BookOpen size={40} className="text-[#a3a3a3] mb-4" />
              <p className="text-[#f5f5f5] text-sm font-medium mb-1">
                Arraste o PDF de Critérios de Medição aqui
              </p>
              <p className="text-[#a3a3a3] text-xs">
                Aceita: PDF (.pdf) — suporta documentos com centenas de páginas
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) processFile(f)
                }}
                className="hidden"
              />
            </div>
          )}

          {/* Parsing step */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center py-12">
              <div className="w-12 h-12 border-3 border-[#f97316] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[#f5f5f5] text-sm font-medium mb-2">
                Analisando PDF...
              </p>
              <p className="text-[#a3a3a3] text-xs mb-4">
                Página {progress.current} de {progress.total}
              </p>
              <div className="w-64 bg-[#484848] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#f97316] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[#6b6b6b] text-xs mt-2">{progressPct}%</p>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#a3a3a3] text-xs">
                  <span className="text-[#f97316] font-semibold">{parsedCriterios.length}</span> critérios encontrados em {file?.name}
                </p>
                <label className="flex items-center gap-2 text-xs text-[#a3a3a3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePdf}
                    onChange={(e) => setSavePdf(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#f97316]"
                  />
                  Salvar PDF para consulta
                </label>
              </div>

              <div className="rounded-lg border border-[#525252] overflow-hidden max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#3d3d3d]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium w-20">N. Preço</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Descrição</th>
                      <th className="px-3 py-2 text-center text-[#a3a3a3] font-medium w-12">UN</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium w-20">Medição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedCriterios.slice(0, 50).map((c, i) => (
                      <>
                        <tr
                          key={i}
                          className="border-t border-[#525252] hover:bg-[#484848] transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expandedId === c.nPreco ? null : c.nPreco)}
                        >
                          <td className="px-3 py-2 text-[#f97316] font-mono font-semibold">{c.nPreco}</td>
                          <td className="px-3 py-2 text-[#f5f5f5] max-w-[300px] truncate">{c.descricao}</td>
                          <td className="px-3 py-2 text-[#a3a3a3] text-center">{c.unidade}</td>
                          <td className="px-3 py-2 text-[#a3a3a3] truncate max-w-[120px]">{c.medicao || '—'}</td>
                        </tr>
                        {expandedId === c.nPreco && (
                          <tr key={`${i}-detail`} className="bg-[#484848]/50">
                            <td colSpan={4} className="px-4 py-3">
                              {c.descricaoSints && (
                                <p className="text-[#a3a3a3] text-xs mb-2">
                                  <span className="font-medium text-[#6b6b6b]">SIntS:</span> {c.descricaoSints}
                                </p>
                              )}
                              {c.regulamentacao && (
                                <div className="mb-2">
                                  <p className="font-medium text-[#6b6b6b] text-xs mb-1">Regulamentação / Compreende:</p>
                                  <p className="text-[#a3a3a3] text-xs whitespace-pre-line leading-relaxed">{c.regulamentacao}</p>
                                </div>
                              )}
                              {c.medicao && (
                                <div className="mb-2">
                                  <p className="font-medium text-[#6b6b6b] text-xs mb-1">Medição:</p>
                                  <p className="text-[#a3a3a3] text-xs">{c.medicao}</p>
                                </div>
                              )}
                              {c.notas && (
                                <div>
                                  <p className="font-medium text-[#6b6b6b] text-xs mb-1">Notas:</p>
                                  <p className="text-[#a3a3a3] text-xs whitespace-pre-line">{c.notas}</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
                {parsedCriterios.length > 50 && (
                  <div className="px-4 py-2 border-t border-[#525252] bg-[#484848]/30 text-center">
                    <p className="text-[#6b6b6b] text-xs">
                      Mostrando 50 de {parsedCriterios.length} critérios
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#525252]">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            Cancelar
          </button>
          {step === 'preview' && parsedCriterios.length > 0 && (
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
            >
              <Check size={14} />
              Importar {parsedCriterios.length} Critérios
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
