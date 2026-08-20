/**
 * ExcelImportModal — importar a planilha do almoxarifado.
 *   1. arquivo  2. mapear colunas  3. CONFERIR o que muda  4. aplicar
 *
 * O passo 3 era uma amostra de 5 linhas e o botão gravava tudo por INSERT. Quem reenviava a
 * planilha atualizada — que é o uso normal: o almoxarife mantém a planilha e sobe de novo —
 * ficava com o estoque inteiro duplicado. Agora a planilha é comparada com o que já existe
 * (`compararComEstoque`), a tela mostra o que muda e quanto isso pesa em R$, e a gravação
 * atualiza quem já existe em vez de criar de novo.
 */
import { useState, useRef } from 'react'
import { Upload, X, ChevronRight, CheckCircle2, FileSpreadsheet, AlertTriangle, FileImage, Plus, Trash2, Copy } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { previewExcel, autoSuggestField, applyColumnMapping } from '../utils/parseExcelEstoque'
import type { ExcelPreview } from '../utils/parseExcelEstoque'
import { compararComEstoque, chaveDoItem } from '../utils/diffEstoque'
import type { ItemEstoque } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'
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
  { value: 'codigoReferencia',  label: 'Código de Referência'  },
  { value: 'dataUltimoPedido',  label: 'Data do Último Pedido' },
  { value: 'unidadeEmbalagem',  label: 'Embalagem (rótulo)'    },
  { value: 'qtdPorEmbalagem',   label: 'Un. por embalagem'     },
  { value: 'numEmbalagens',     label: 'Nº de embalagens'      },
  { value: 'valorPorEmbalagem', label: 'Valor por embalagem'   },
  { value: 'linkProduto',       label: 'Link do Produto'       },
  { value: 'realizarPedido',    label: 'Realizar Pedido'       },
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
  const { depositos, selectedDepositoId, estoqueItens, addItemEstoque, updateItemEstoque } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:          s.depositos,
      selectedDepositoId: s.selectedDepositoId,
      estoqueItens:       s.estoqueItens,
      addItemEstoque:     s.addItemEstoque,
      updateItemEstoque:  s.updateItemEstoque,
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
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number } | null>(null)
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
    // As duas listas casam pelo índice: `compararComEstoque` percorre `items` na ordem e só pula
    // linha sem descrição nem código. Reindexar pela chave evita depender dessa ordem.
    const porChave = new Map(diff.linhas.map((l) => [l.chave, l]))
    // A planilha pode repetir um produto. A conferência conta a primeira linha e ignora as outras;
    // a gravação faz igual, senão escreveria duas vezes e o número aplicado não bateria com o
    // número conferido.
    const jaGravadas = new Set<string>()
    let criados = 0
    let atualizados = 0
    for (const item of items) {
      const chave = chaveDoItem(item)
      if (jaGravadas.has(chave)) continue
      jaGravadas.add(chave)
      const linha = porChave.get(chave)
      if (!linha) continue
      if (linha?.itemId) {
        // Só o que a planilha realmente trouxe. Um `undefined` aqui apagaria no banco um campo
        // que a planilha simplesmente não tem coluna para representar.
        const patch: Partial<ItemEstoque> = {}
        for (const [k, v] of Object.entries(item)) {
          if (v !== undefined && v !== '' && v !== null) (patch as Record<string, unknown>)[k] = v
        }
        updateItemEstoque(linha.itemId, patch)
        atualizados++
      } else {
        addItemEstoque({ ...item, depositoId: targetDeposito, qtdReservada: 0, qtdTransito: 0 })
        criados++
      }
    }
    setResultado({ criados, atualizados })
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

  // Comparado só contra o estoque DESTA frente: a mesma descrição em dois depósitos são dois
  // saldos diferentes, e casar entre frentes moveria material de lugar sem ninguém pedir.
  // Sem `useMemo` de propósito: o React Compiler memoiza isto sozinho, e o `useMemo` manual aqui
  // fazia ele desistir de otimizar o componente inteiro ("memoization could not be preserved").
  const diff = compararComEstoque(
    preview ? applyColumnMapping(preview.rows, mapping) : [],
    estoqueItens.filter((i) => i.depositoId === targetDeposito),
  )

  const totalItems  = diff.linhas.length
  const mudancas    = diff.novos + diff.alterados
  // Ordem da conferência: o que muda primeiro; o que ficou igual não precisa de atenção.
  const linhasOrdenadas = [...diff.linhas].sort((a, b) => {
    const peso = (t: string) => (t === 'inalterado' ? 1 : 0)
    return peso(a.tipo) - peso(b.tipo) || Math.abs(b.impactoBRL) - Math.abs(a.impactoBRL)
  })
  const imageTotalItems = imageRows.filter((row) => row.descricao.trim()).length
  const importedCount = resultado ? resultado.criados + resultado.atualizados : imageTotalItems
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
                {step === 'preview' && 'Passo 3: Conferir o que muda'}
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

          {/* Passo 3: conferência — o que a planilha muda no estoque */}
          {step === 'preview' && preview && (
            <div className="flex flex-col gap-4">
              {/* Placar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { rotulo: 'Itens novos',   valor: String(diff.novos),        cor: 'text-[#22c55e]' },
                  { rotulo: 'Alterados',     valor: String(diff.alterados),    cor: 'text-[#f97316]' },
                  { rotulo: 'Sem mudança',   valor: String(diff.inalterados),  cor: 'text-[#6b6b6b]' },
                  {
                    rotulo: 'Impacto em caixa',
                    valor: formatCurrency(diff.impactoTotalBRL),
                    cor: diff.impactoTotalBRL < 0 ? 'text-[#f87171]' : diff.impactoTotalBRL > 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]',
                  },
                ].map((c) => (
                  <div key={c.rotulo} className="rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">{c.rotulo}</p>
                    <p className={cn('mt-0.5 text-sm font-bold font-mono', c.cor)}>{c.valor}</p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-[#6b6b6b]">
                <span className="text-[#f97316] font-medium">{filename}</span> · {totalItems} linha{totalItems !== 1 ? 's' : ''} lida{totalItems !== 1 ? 's' : ''},
                comparadas com o estoque de <span className="text-[#f5f5f5]">{deposito?.frente}</span>.
                {mudancas === 0 && ' Nada mudou — pode aplicar sem receio, nenhum item será duplicado.'}
              </p>

              {/* Abaixo do mínimo */}
              {diff.abaixoDoMinimo.length > 0 && (
                <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#fbbf24]">
                    <AlertTriangle size={13} /> {diff.abaixoDoMinimo.length} ite{diff.abaixoDoMinimo.length !== 1 ? 'ns ficam' : 'm fica'} no mínimo ou abaixo
                  </p>
                  <p className="mt-1 text-[11px] text-[#d4a44c]">
                    {diff.abaixoDoMinimo.slice(0, 6).map((l) => `${l.descricao} (${l.qtdDepois}/${l.estoqueMinimo})`).join(' · ')}
                    {diff.abaixoDoMinimo.length > 6 && ` e mais ${diff.abaixoDoMinimo.length - 6}`}
                  </p>
                </div>
              )}

              {/* Impacto por fornecedor */}
              {diff.impactoPorFornecedor.length > 0 && (
                <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Impacto por fornecedor</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {diff.impactoPorFornecedor.map((f) => (
                      <span key={f.fornecedor} className="text-[11px] text-[#a3a3a3]">
                        {f.fornecedor} <span className={cn('font-mono', f.impactoBRL < 0 ? 'text-[#f87171]' : 'text-[#22c55e]')}>{formatCurrency(f.impactoBRL)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linha a linha */}
              <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-auto max-h-[320px]">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0">
                    <tr className="bg-[#3d3d3d]">
                      {['Item', 'Antes', 'Depois', 'Δ', 'Impacto', 'O que é'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasOrdenadas.map((l) => (
                      <tr key={l.chave} className={cn('border-t border-[#525252]', l.tipo === 'inalterado' && 'opacity-45')}>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] max-w-[180px] truncate" title={l.descricao}>
                          {l.abaixoDoMinimo && <AlertTriangle size={10} className="mr-1 inline text-[#fbbf24]" />}
                          {l.descricao}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] font-mono">{l.qtdAntes ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] font-mono">{l.qtdDepois}</td>
                        <td className={cn('px-2.5 py-1.5 font-mono', l.deltaQtd < 0 ? 'text-[#f87171]' : l.deltaQtd > 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]')}>
                          {l.tipo === 'novo' ? '—' : l.deltaQtd > 0 ? `+${l.deltaQtd}` : l.deltaQtd || '—'}
                        </td>
                        <td className={cn('px-2.5 py-1.5 font-mono', l.impactoBRL < 0 ? 'text-[#f87171]' : l.impactoBRL > 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]')}>
                          {l.impactoBRL ? formatCurrency(l.impactoBRL) : '—'}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium',
                            l.tipo === 'novo'       ? 'bg-[#22c55e]/15 text-[#4ade80]'
                            : l.tipo === 'quantidade' ? 'bg-[#f97316]/15 text-[#fb923c]'
                            : l.tipo === 'custo'      ? 'bg-[#a855f7]/15 text-[#c084fc]'
                            : l.tipo === 'dados'      ? 'bg-[#0ea5e9]/15 text-[#38bdf8]'
                            : 'bg-[#525252]/40 text-[#8b8b8b]',
                          )}>
                            {l.tipo === 'novo' ? 'novo' : l.tipo === 'quantidade' ? 'quantidade' : l.tipo === 'custo' ? 'custo' : l.tipo === 'dados' ? 'cadastro' : 'igual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* O que o sistema tem e a planilha não trouxe — nunca apagado sozinho */}
              {diff.ausentesNaPlanilha.length > 0 && (
                <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-[#a3a3a3]">
                    {diff.ausentesNaPlanilha.length} ite{diff.ausentesNaPlanilha.length !== 1 ? 'ns estão' : 'm está'} no sistema e não vei{diff.ausentesNaPlanilha.length !== 1 ? 'o' : 'o'} na planilha
                  </p>
                  <p className="mt-1 text-[11px] text-[#6b6b6b]">
                    Ficam como estão. A planilha pode ser parcial, e apagar por ausência destruiria saldo real.{' '}
                    {diff.ausentesNaPlanilha.slice(0, 8).map((a) => a.descricao).join(' · ')}
                    {diff.ausentesNaPlanilha.length > 8 && ` e mais ${diff.ausentesNaPlanilha.length - 8}`}
                  </p>
                </div>
              )}

              {/* O mesmo produto repetido dentro da planilha */}
              {diff.duplicadosNaPlanilha.length > 0 && (
                <div className="rounded-lg border border-[#0ea5e9]/40 bg-[#0ea5e9]/[0.08] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#38bdf8]">
                    <Copy size={13} /> {diff.duplicadosNaPlanilha.length} linha{diff.duplicadosNaPlanilha.length !== 1 ? 's repetidas' : ' repetida'} na planilha
                  </p>
                  <p className="mt-1 text-[11px] text-[#7cc4e8]">
                    O mesmo produto aparece mais de uma vez. Vale a primeira linha; as outras são ignoradas,
                    porque somar saldos seria um palpite. Vale conferir a planilha.{' '}
                    {diff.duplicadosNaPlanilha.slice(0, 6).map((d) => `${d.descricao} (${d.qtdDisponivel})`).join(' · ')}
                    {diff.duplicadosNaPlanilha.length > 6 && ` e mais ${diff.duplicadosNaPlanilha.length - 6}`}
                  </p>
                </div>
              )}

              {/* Duplicatas herdadas do importador antigo */}
              {diff.duplicadosNoSistema.length > 0 && (
                <div className="rounded-lg border border-[#a855f7]/40 bg-[#a855f7]/[0.08] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c084fc]">
                    <Copy size={13} /> {diff.duplicadosNoSistema.length} ite{diff.duplicadosNoSistema.length !== 1 ? 'ns repetidos' : 'm repetido'} no estoque
                  </p>
                  <p className="mt-1 text-[11px] text-[#b18bd4]">
                    Mesmo produto cadastrado mais de uma vez — sobra de importações anteriores, que duplicavam.
                    A planilha atualiza só a primeira linha; as outras ficam para você conferir e excluir no Almoxarifado.{' '}
                    {diff.duplicadosNoSistema.slice(0, 6).map((d) => `${d.descricao} (${d.qtdDisponivel})`).join(' · ')}
                    {diff.duplicadosNoSistema.length > 6 && ` e mais ${diff.duplicadosNoSistema.length - 6}`}
                  </p>
                </div>
              )}
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
                  {resultado
                    ? <>
                        {resultado.criados} ite{resultado.criados !== 1 ? 'ns criados' : 'm criado'} e{' '}
                        {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? 's' : ''} em{' '}
                        <span className="text-[#f97316]">{deposito?.frente}</span>.
                      </>
                    : <>
                        {importedCount} ite{importedCount !== 1 ? 'ns foram adicionados' : 'm foi adicionado'} a{' '}
                        <span className="text-[#f97316]">{deposito?.frente}</span>.
                      </>}
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
                Conferir mudanças <ChevronRight size={12} />
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
                  {importing ? 'Aplicando...'
                    : mudancas === 0 ? 'Aplicar (nada muda)'
                    : `Aplicar ${mudancas} mudança${mudancas !== 1 ? 's' : ''}`}
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
