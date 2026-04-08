/**
 * ImportModal — Modal genérico de importação XLSX/CSV reutilizável.
 *
 * Usado por todos os 5 módulos (Quantitativos, Planejamento, Torre, Mão de Obra,
 * Suprimentos). Cada módulo passa o `config` e o `onCommit` callback.
 *
 * Fluxo do usuário:
 *  1. Drag & drop ou clique para selecionar arquivo
 *  2. Sistema parseia + valida (mostra preview)
 *  3. Usuário revisa erros e linhas válidas
 *  4. Clica "Importar X linhas" → onCommit é chamado com as linhas válidas
 *  5. Modal fecha e o módulo recebe os dados
 */
import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, FileSpreadsheet, Download, AlertTriangle,
  CheckCircle2, Loader2, ArrowRight,
} from 'lucide-react'
import {
  parseAndValidate,
  validateFileBeforeParse,
  downloadTemplate,
  type ImportConfig,
  type ImportResult,
} from '@/lib/importEngine'

interface ImportModalProps<T extends Record<string, unknown>> {
  open: boolean
  onClose: () => void
  /** Título do modal (ex: "Importar Orçamento") */
  title: string
  /** Texto curto explicando o que esperar */
  description: string
  /** Config do importEngine */
  config: ImportConfig<T>
  /** Nome sugerido para o template baixado */
  templateFilename: string
  /** Callback chamado quando o usuário confirma a importação */
  onCommit: (rows: T[]) => void
  /** Label do botão final (ex: "Importar 47 trechos") — recebe o count */
  commitLabel?: (count: number) => string
}

export function ImportModal<T extends Record<string, unknown>>({
  open,
  onClose,
  title,
  description,
  config,
  templateFilename,
  onCommit,
  commitLabel,
}: ImportModalProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ImportResult<T> | null>(null)
  const [committing, setCommitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    async (f: File) => {
      const validation = validateFileBeforeParse(f)
      if (!validation.ok) {
        setResult({
          validRows: [],
          errors: [{ rowNumber: 0, message: validation.error }],
          totalProcessed: 0,
          fileHash: '',
        })
        return
      }
      setFile(f)
      setParsing(true)
      try {
        const r = await parseAndValidate<T>(f, config)
        setResult(r)
      } catch (e) {
        setResult({
          validRows: [],
          errors: [{
            rowNumber: 0,
            message: e instanceof Error ? e.message : 'Erro ao processar arquivo',
          }],
          totalProcessed: 0,
          fileHash: '',
        })
      } finally {
        setParsing(false)
      }
    },
    [config],
  )

  function handleSelectClick() {
    inputRef.current?.click()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  function handleDownloadTemplate() {
    downloadTemplate(config, templateFilename)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setParsing(false)
    setCommitting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleCommit() {
    if (!result || result.validRows.length === 0) return
    setCommitting(true)
    try {
      onCommit(result.validRows)
      handleClose()
    } catch (e) {
      console.error('[ImportModal] commit failed:', e)
      setCommitting(false)
    }
  }

  if (!open) return null

  const validCount = result?.validRows.length ?? 0
  const errorCount = result?.errors.length ?? 0

  return (
    <div
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[#525252] bg-[#2c2c2c] shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f97316] flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-[#f5f5f5] font-bold text-base">{title}</h2>
              <p className="text-[#a3a3a3] text-xs">{description}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Estado 1: nenhum arquivo selecionado ─────────────────── */}
          {!file && !parsing && (
            <>
              <div
                onClick={handleSelectClick}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#f97316] bg-[#f97316]/10'
                    : 'border-[#525252] hover:border-[#6b6b6b] bg-[#3a3a3a]/40'
                }`}
              >
                <Upload size={40} className="mx-auto text-[#a3a3a3] mb-3" />
                <div className="text-[#f5f5f5] text-base font-semibold mb-2">
                  Arraste um arquivo aqui ou clique para selecionar
                </div>
                <div className="text-[#a3a3a3] text-xs">
                  Aceita .xlsx, .xls ou .csv até 5 MB
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[10px] text-[#6b6b6b]">
                  Não tem o arquivo? Baixe nosso template de exemplo:
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 text-xs text-[#f97316] hover:text-[#ea580c] underline"
                >
                  <Download size={13} />
                  Baixar template Atlântico
                </button>
              </div>
            </>
          )}

          {/* ── Estado 2: parsing ────────────────────────────────────── */}
          {parsing && (
            <div className="text-center py-12">
              <Loader2 size={32} className="mx-auto text-[#f97316] animate-spin mb-3" />
              <div className="text-[#f5f5f5] text-sm">Processando arquivo…</div>
            </div>
          )}

          {/* ── Estado 3: result com erros e/ou válidos ──────────────── */}
          {!parsing && result && file && (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-[#3a3a3a] border border-[#525252] rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase text-[#a3a3a3] tracking-wider">Processadas</div>
                  <div className="text-2xl font-bold text-[#f5f5f5] mt-1">{result.totalProcessed}</div>
                </div>
                <div
                  className={`border rounded-lg p-3 text-center ${
                    validCount > 0
                      ? 'bg-emerald-900/15 border-emerald-700/40'
                      : 'bg-[#3a3a3a] border-[#525252]'
                  }`}
                >
                  <div className="text-[10px] uppercase text-emerald-300 tracking-wider">Válidas</div>
                  <div className="text-2xl font-bold text-emerald-300 mt-1">{validCount}</div>
                </div>
                <div
                  className={`border rounded-lg p-3 text-center ${
                    errorCount > 0
                      ? 'bg-red-900/15 border-red-700/40'
                      : 'bg-[#3a3a3a] border-[#525252]'
                  }`}
                >
                  <div className="text-[10px] uppercase text-red-300 tracking-wider">Erros</div>
                  <div className="text-2xl font-bold text-red-300 mt-1">{errorCount}</div>
                </div>
              </div>

              {/* Lista de erros */}
              {errorCount > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <h3 className="text-xs font-bold text-red-300 uppercase tracking-wider">
                      Erros encontrados
                    </h3>
                  </div>
                  <div className="bg-[#1f1f1f] border border-red-900/40 rounded-lg max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-red-900/40">
                          <th className="text-left py-1.5 px-3 text-red-300 font-semibold">Linha</th>
                          <th className="text-left py-1.5 px-3 text-red-300 font-semibold">Coluna</th>
                          <th className="text-left py-1.5 px-3 text-red-300 font-semibold">Erro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.slice(0, 50).map((err, i) => (
                          <tr key={i} className="border-b border-red-900/20">
                            <td className="py-1.5 px-3 text-[#fca5a5] font-mono">{err.rowNumber || '—'}</td>
                            <td className="py-1.5 px-3 text-[#fca5a5]">{err.column ?? '—'}</td>
                            <td className="py-1.5 px-3 text-[#fca5a5]">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.errors.length > 50 && (
                      <div className="px-3 py-2 text-[10px] text-[#a3a3a3] italic border-t border-red-900/40">
                        ... e mais {result.errors.length - 50} erros. Corrija o arquivo e tente novamente.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview de algumas linhas válidas */}
              {validCount > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      Preview ({Math.min(5, validCount)} de {validCount} linhas)
                    </h3>
                  </div>
                  <div className="bg-[#1f1f1f] border border-emerald-900/40 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <pre className="text-[10px] text-emerald-200 leading-relaxed">
                      {JSON.stringify(result.validRows.slice(0, 5), null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="text-[10px] text-[#6b6b6b] italic">
                Arquivo: <span className="font-mono">{file.name}</span> · Hash: <span className="font-mono">{result.fileHash}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#525252] bg-[#1f1f1f] shrink-0">
          {file ? (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-[#a3a3a3] hover:text-[#f5f5f5] px-3 py-2 transition-colors"
            >
              ← Trocar arquivo
            </button>
          ) : (
            <span />
          )}

          {validCount > 0 && (
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing}
              className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {committing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {commitLabel ? commitLabel(validCount) : `Importar ${validCount} ${validCount === 1 ? 'linha' : 'linhas'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
