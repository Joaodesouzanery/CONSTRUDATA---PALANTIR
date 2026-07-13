/**
 * ExcelImportModal — Multi-step Excel import for Materiais & Estoque.
 * Step 1: Drag-and-drop file upload
 * Step 2: Column mapping (auto-suggested)
 * Step 3: Preview first 5 rows
 * Step 4: Confirm import → addItemEstoque
 */
import { useState, useRef } from 'react'
import { Upload, X, ChevronRight, CheckCircle2, FileSpreadsheet, AlertTriangle, FileImage, Plus, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { previewExcel, autoSuggestField, applyColumnMapping } from '../utils/parseExcelEstoque'
import type { ExcelPreview } from '../utils/parseExcelEstoque'
import { cn } from '@/lib/utils'
import { parseLocaleNumber } from '@/lib/numberFormat'

const KNOWN_FIELDS: { value: string; label: string }[] = [
  { value: 'ignorar',           label: '— Ignorar —'           },
  { value: 'descricao',         label: 'Descrição'             },
  { value: 'unidade',           label: 'Unidade'               },
  { value: 'qtdDisponivel',     label: 'Qtd. Disponível'       },
  { value: 'estoqueMinimo',     label: 'Estoque Mínimo'        },
  { value: 'custoUnitario',     label: 'Custo Unitário (R$)'   },
  { value: 'valorTotal',        label: 'Valor Total (R$)'      },
  { value: 'categoria',         label: 'Categoria'             },
  { value: 'fornecedorPrincipal', label: 'Fornecedor Principal' },
  { value: 'unidadeEmbalagem',  label: 'Embalagem (rótulo)'    },
  { value: 'qtdPorEmbalagem',   label: 'Un. por embalagem'     },
  { value: 'numEmbalagens',     label: 'Nº de embalagens'      },
  { value: 'valorPorEmbalagem', label: 'Valor por embalagem'   },
]

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'mapping' | 'preview' | 'image' | 'done'

type ImageMaterialRow = {
  descricao: string
  unidade: string
  qtdDisponivel: string
  custoUnitario: string
  categoria: string
}

const EMPTY_IMAGE_ROW: ImageMaterialRow = { descricao: '', unidade: '', qtdDisponivel: '', custoUnitario: '', categoria: '' }

const KNOWN_IMAGE_TEMPLATES: Record<string, ImageMaterialRow[]> = {
  spin: [
    { descricao: 'Abastecimento SPIN 01/04/2026', unidade: '', qtdDisponivel: '1', custoUnitario: '322.25', categoria: 'Combustível' },
    { descricao: 'Abastecimento SPIN 06/04/2026', unidade: '', qtdDisponivel: '1', custoUnitario: '321.23', categoria: 'Combustível' },
    { descricao: 'Abastecimento SPIN 13/04/2026', unidade: '', qtdDisponivel: '1', custoUnitario: '313.00', categoria: 'Combustível' },
    { descricao: 'Abastecimento SPIN 16/04/2026', unidade: '', qtdDisponivel: '1', custoUnitario: '278.97', categoria: 'Combustível' },
    { descricao: 'Abastecimento SPIN 24/04/2026', unidade: '', qtdDisponivel: '1', custoUnitario: '319.44', categoria: 'Combustível' },
    { descricao: 'Abastecimento SPIN 29/04/2026', unidade: '', qtdDisponivel: '1', custoUnitario: '334.97', categoria: 'Combustível' },
  ],
  insumos: [
    { descricao: 'Álcool', unidade: '', qtdDisponivel: '1', custoUnitario: '96.16', categoria: 'Insumos' },
    { descricao: 'Arame', unidade: '', qtdDisponivel: '2', custoUnitario: '18.99', categoria: 'Insumos' },
    { descricao: 'Bota NUBUCK', unidade: '', qtdDisponivel: '1', custoUnitario: '162.00', categoria: 'EPI' },
    { descricao: 'Carrinho de mão', unidade: '', qtdDisponivel: '1', custoUnitario: '215.00', categoria: 'Ferramentas' },
    { descricao: 'Disco diamantado', unidade: '', qtdDisponivel: '10', custoUnitario: '13.75', categoria: 'Ferramentas' },
    { descricao: 'Fita crepe', unidade: '', qtdDisponivel: '24', custoUnitario: '6.58', categoria: 'Insumos' },
    { descricao: 'Respirador PFF2', unidade: '', qtdDisponivel: '115', custoUnitario: '1.15', categoria: 'EPI' },
    { descricao: 'Rolo 9cm', unidade: '', qtdDisponivel: '48', custoUnitario: '9.14', categoria: 'Insumos' },
  ],
}

export function ExcelImportModal({ onClose }: Props) {
  const { depositos, selectedDepositoId, addItemEstoque } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:          s.depositos,
      selectedDepositoId: s.selectedDepositoId,
      addItemEstoque:     s.addItemEstoque,
    }))
  )

  const [step, setStep]           = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview]     = useState<ExcelPreview | null>(null)
  const [filename, setFilename]   = useState('')
  const [mapping, setMapping]     = useState<Record<string, string>>({})
  const [targetDeposito, setTargetDeposito] = useState(selectedDepositoId ?? depositos[0]?.id ?? '')
  const [error, setError]         = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [imageUrl, setImageUrl]   = useState('')
  const [imageRows, setImageRows] = useState<ImageMaterialRow[]>([{ ...EMPTY_IMAGE_ROW }])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    if (file.type.startsWith('image/')) {
      setFilename(file.name)
      setImageUrl(URL.createObjectURL(file))
      setImageRows([{ ...EMPTY_IMAGE_ROW }])
      setStep('image')
      return
    }
    try {
      const p = await previewExcel(file)
      if (p.headers.length === 0) {
        setError('Arquivo vazio ou sem dados reconhecíveis.')
        return
      }
      setFilename(file.name)
      setPreview(p)
      // Auto-suggest mapping
      const suggested: Record<string, string> = {}
      for (const h of p.headers) {
        suggested[h] = autoSuggestField(h)
      }
      setMapping(suggested)
      setStep('mapping')
    } catch {
      setError('Não foi possível ler o arquivo. Certifique-se que é um Excel (.xlsx/.xls) ou CSV válido.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleImport() {
    if (!preview) return
    setImporting(true)
    const items = applyColumnMapping(preview.rows, mapping)
    for (const item of items) {
      addItemEstoque({
        ...item,
        depositoId:   targetDeposito,
        qtdReservada: 0,
        qtdTransito:  0,
      })
    }
    setStep('done')
    setImporting(false)
  }

  function handleImageImport() {
    setImporting(true)
    for (const row of imageRows) {
      if (!row.descricao.trim()) continue
      const quantity = parseLocaleNumber(row.qtdDisponivel)
      const unitValue = parseLocaleNumber(row.custoUnitario)
      addItemEstoque({
        depositoId: targetDeposito,
        descricao: row.descricao.trim(),
        unidade: row.unidade.trim(),
        qtdDisponivel: quantity,
        qtdReservada: 0,
        qtdTransito: 0,
        estoqueMinimo: 0,
        custoUnitario: unitValue || undefined,
        categoria: row.categoria.trim() || undefined,
      })
    }
    setStep('done')
    setImporting(false)
  }

  function patchImageRow(index: number, patch: Partial<ImageMaterialRow>) {
    setImageRows((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  function applyImageTemplate(key: keyof typeof KNOWN_IMAGE_TEMPLATES) {
    setImageRows(KNOWN_IMAGE_TEMPLATES[key].map((row) => ({ ...row })))
  }

  const previewItems = preview ? applyColumnMapping(preview.rows.slice(0, 5), mapping) : []
  const totalItems   = preview ? applyColumnMapping(preview.rows, mapping).length : 0
  const imageTotalItems = imageRows.filter((row) => row.descricao.trim()).length
  const importedCount = totalItems || imageTotalItems
  const deposito     = depositos.find((d) => d.id === targetDeposito)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Planilha Excel</h2>
              <p className="text-[10px] text-[#6b6b6b]">
                {step === 'upload'  && 'Passo 1: Selecionar arquivo'}
                {step === 'mapping' && 'Passo 2: Mapear colunas'}
                {step === 'preview' && 'Passo 3: Confirmar importação'}
                {step === 'image'   && 'Imagem guiada: confirmar materiais'}
                {step === 'done'    && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-[#525252]">
          {(['upload', 'mapping', 'preview', 'done'] as Step[]).map((s, i, arr) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors',
                step === s ? 'bg-[#f97316] text-white'
                  : (arr.indexOf(step) > i) ? 'bg-[#22c55e] text-white'
                  : 'bg-[#525252] text-[#6b6b6b]',
              )}>
                {arr.indexOf(step) > i ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              {i < arr.length - 1 && (
                <div className={cn('h-px w-10', arr.indexOf(step) > i ? 'bg-[#22c55e]' : 'bg-[#525252]')} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                  isDragging
                    ? 'border-[#f97316] bg-[#f97316]/10'
                    : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5',
                )}
              >
                <Upload size={32} className={cn('transition-colors', isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste um arquivo aqui</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#3f3f3f] mt-2">.xlsx · .xls · .csv</p>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,image/*"
                className="hidden"
                onChange={handleInputChange}
              />
              {error && (
                <div className="flex items-start gap-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-[#ef4444] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#f87171]">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'mapping' && preview && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#6b6b6b]">
                  <span className="text-[#f97316] font-medium">{filename}</span> — {preview.rows.length} linhas detectadas
                </p>
              </div>

              {/* Deposito target */}
              <div>
                <label className="text-[10px] text-[#6b6b6b] mb-1 block">Importar para a frente:</label>
                <select
                  value={targetDeposito}
                  onChange={(e) => setTargetDeposito(e.target.value)}
                  className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                >
                  {depositos.filter((d) => d.ativo).map((d) => (
                    <option key={d.id} value={d.id}>{d.frente}</option>
                  ))}
                </select>
              </div>

              <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 px-3 py-2 text-[10px] text-[#6b6b6b] font-medium uppercase tracking-wide border-b border-[#525252]">
                  <span>Coluna no Excel</span>
                  <span>Campo do sistema</span>
                </div>
                <div className="divide-y divide-[#525252]">
                  {preview.headers.map((h) => (
                    <div key={h} className="grid grid-cols-2 px-3 py-2 items-center gap-3">
                      <span className="text-xs text-[#f5f5f5] font-medium truncate" title={h}>{h}</span>
                      <select
                        value={mapping[h] ?? 'ignorar'}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                        className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                      >
                        {KNOWN_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && preview && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-[#6b6b6b]">
                Serão importados <span className="text-[#f5f5f5] font-semibold">{totalItems} itens</span> para a frente{' '}
                <span className="text-[#f97316] font-medium">{deposito?.frente}</span>. Primeiras 5 linhas:
              </p>
              <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[#3d3d3d]">
                      {['Descrição', 'Un.', 'Qtd.', 'Mín.', 'Custo', 'Categoria', 'Fornecedor'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item, i) => (
                      <tr key={i} className="border-t border-[#525252]">
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] max-w-[140px] truncate" title={item.descricao}>{item.descricao}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b]">{item.unidade}</td>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] font-mono">{item.qtdDisponivel}</td>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] font-mono">{item.estoqueMinimo}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] font-mono">{item.custoUnitario ? `R$ ${item.custoUnitario}` : '—'}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] max-w-[100px] truncate">{item.categoria ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] max-w-[100px] truncate">{item.fornecedorPrincipal ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'image' && (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-[#525252] bg-[#2c2c2c]">
                  {imageUrl ? <img src={imageUrl} alt={filename} className="max-h-[360px] w-full object-contain" /> : <FileImage className="m-8 text-[#6b6b6b]" />}
                </div>
                <div className="grid gap-2">
                  <button type="button" onClick={() => applyImageTemplate('spin')} className="rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#f5f5f5] hover:border-[#f97316]/50">
                    Aplicar modelo SPIN
                  </button>
                  <button type="button" onClick={() => applyImageTemplate('insumos')} className="rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#f5f5f5] hover:border-[#f97316]/50">
                    Aplicar modelo gastos de insumos
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-[#f5f5f5]">Conferência manual da imagem</p>
                  <p className="mt-1 text-xs text-[#a3a3a3]">A imagem fica como referência visual. Confirme ou edite as linhas antes de gravar no estoque.</p>
                </div>
                <select
                  value={targetDeposito}
                  onChange={(e) => setTargetDeposito(e.target.value)}
                  className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                >
                  {depositos.filter((d) => d.ativo).map((d) => (
                    <option key={d.id} value={d.id}>{d.frente}</option>
                  ))}
                </select>
                <div className="space-y-2">
                  {imageRows.map((row, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] p-2 sm:grid-cols-[1fr_70px_80px_90px_120px_32px]">
                      <input className="rounded border border-[#525252] bg-[#3d3d3d] px-2 py-1 text-xs text-[#f5f5f5]" placeholder="Material" value={row.descricao} onChange={(e) => patchImageRow(index, { descricao: e.target.value })} />
                      <input className="rounded border border-[#525252] bg-[#3d3d3d] px-2 py-1 text-xs text-[#f5f5f5]" placeholder="Qtd." value={row.qtdDisponivel} onChange={(e) => patchImageRow(index, { qtdDisponivel: e.target.value })} />
                      <input className="rounded border border-[#525252] bg-[#3d3d3d] px-2 py-1 text-xs text-[#f5f5f5]" placeholder="Un." value={row.unidade} onChange={(e) => patchImageRow(index, { unidade: e.target.value })} />
                      <input className="rounded border border-[#525252] bg-[#3d3d3d] px-2 py-1 text-xs text-[#f5f5f5]" placeholder="Unitário" value={row.custoUnitario} onChange={(e) => patchImageRow(index, { custoUnitario: e.target.value })} />
                      <input className="rounded border border-[#525252] bg-[#3d3d3d] px-2 py-1 text-xs text-[#f5f5f5]" placeholder="Categoria" value={row.categoria} onChange={(e) => patchImageRow(index, { categoria: e.target.value })} />
                      <button type="button" onClick={() => setImageRows((rows) => rows.filter((_, i) => i !== index))} className="rounded text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setImageRows((rows) => [...rows, { ...EMPTY_IMAGE_ROW }])} className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#f5f5f5] hover:border-[#f97316]/50">
                  <Plus size={13} /> Adicionar linha
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 size={48} className="text-[#22c55e]" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída!</p>
                <p className="text-xs text-[#6b6b6b] mt-1">
                  {importedCount} ite{importedCount !== 1 ? 'ns foram adicionados' : 'm foi adicionado'} a{' '}
                  <span className="text-[#f97316]">{deposito?.frente}</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
          >
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          <div className="flex gap-2">
            {step === 'mapping' && (
              <button
                onClick={() => setStep('preview')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#f97316] text-white hover:bg-[#f97316]/80 transition-colors"
              >
                Pré-visualizar <ChevronRight size={12} />
              </button>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 text-xs text-[#6b6b6b] border border-[#525252] rounded-lg hover:text-[#f5f5f5] transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || totalItems === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#22c55e] text-white hover:bg-[#22c55e]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {importing ? 'Importando...' : `Importar ${totalItems} ite${totalItems !== 1 ? 'ns' : 'm'}`}
                </button>
              </>
            )}
            {step === 'image' && (
              <button
                onClick={handleImageImport}
                disabled={importing || imageTotalItems === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#22c55e] text-white hover:bg-[#22c55e]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? 'Importando...' : `Importar ${imageTotalItems} ite${imageTotalItems !== 1 ? 'ns' : 'm'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
