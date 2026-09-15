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
import { previewExcel, selecionarAbaExcel, autoSuggestField, refinarPorConteudo, applyColumnMapping, detectarConflitos } from '../utils/parseExcelEstoque'
import type { ExcelPreview } from '../utils/parseExcelEstoque'
import { compararComEstoque, chaveDoItem, ultimaConferencia, retiradasComFicha, MARCA_CONFERENCIA } from '../utils/diffEstoque'
import type { ItemEstoque, MovimentacaoEstoque } from '@/types'
import { hojeLocalISO, horaLocalHHMM } from '@/lib/utils'
import { cn, formatCurrency } from '@/lib/utils'
import { usePermissaoEscrita, ROLES_SUPRIMENTOS_WRITE } from '@/lib/roles'
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


export function ExcelImportModal({ onClose }: Props) {
  const { depositos, selectedDepositoId, estoqueItens, movimentacoes, addItemEstoque, updateItemEstoque, addMovimentacao } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:          s.depositos,
      selectedDepositoId: s.selectedDepositoId,
      estoqueItens:       s.estoqueItens,
      movimentacoes:      s.movimentacoes,
      addItemEstoque:     s.addItemEstoque,
      updateItemEstoque:  s.updateItemEstoque,
      addMovimentacao:    s.addMovimentacao,
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
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number; movimentos: number } | null>(null)
  const permissao = usePermissaoEscrita(ROLES_SUPRIMENTOS_WRITE)
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
      setMapping(criarMapeamento(p))
      setStep('mapping')
    } catch {
      setError('Não foi possível ler o arquivo. Certifique-se que é um Excel (.xlsx/.xls) ou CSV válido.')
    }
  }

  function criarMapeamento(p: ExcelPreview): Record<string, string> {
    // Palpite pelo nome da coluna, corrigido pelo que ela contém: coluna inteira de sim/não
    // é caixa de seleção, mesmo que o nome diga "quantidade".
    return Object.fromEntries(p.headers.map((h) => [
      h,
      refinarPorConteudo(autoSuggestField(h), p.rows.map((r) => r[h] ?? '')),
    ]))
  }

  function trocarAba(sheetName: string) {
    if (!preview) return
    const next = selecionarAbaExcel(preview, sheetName)
    setPreview(next)
    setMapping(criarMapeamento(next))
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
    const movimentosNovos: Omit<MovimentacaoEstoque, 'id'>[] = []
    const hoje = hojeLocalISO()
    let criados = 0
    let atualizados = 0
    for (const item of items) {
      const chave = chaveDoItem(item)
      if (jaGravadas.has(chave)) continue
      jaGravadas.add(chave)
      const linha = porChave.get(chave)
      if (!linha) continue
      // Linha sem mudança não vai para o servidor. Antes ia: numa planilha de 200 produtos, clicar
      // em "Aplicar (nada muda)" disparava 200 updates no Supabase para não mudar nada.
      if (linha.tipo === 'inalterado') continue

      if (linha.itemId) {
        // Só o que a planilha realmente trouxe. `undefined` aqui apagaria no banco um campo que a
        // planilha não tem coluna para representar — e é por isso que o parser distingue "célula
        // em branco" (undefined) de "a planilha disse zero" (0). `false` PASSA de propósito: é
        // assim que a marcação "Realizar Pedido" se apaga depois que o pedido foi feito.
        const patch: Partial<ItemEstoque> = {}
        for (const [k, v] of Object.entries(item)) {
          if (v !== undefined && v !== '' && v !== null) (patch as Record<string, unknown>)[k] = v
        }
        updateItemEstoque(linha.itemId, patch)
        atualizados++

        // ─── A MOVIMENTAÇÃO ─────────────────────────────────────────────────
        // O saldo mudar não bastava: o consumo não aparecia em relatório nenhum. Dashboard de
        // Suprimentos, custo por obra e o cartão do Gestão 360 leem MOVIMENTAÇÃO, não saldo — os
        // três mostravam R$ 0 com material saindo todo dia.
        //
        // Queda vira saída, aumento vira entrada. Não uso a RPC de baixa atômica aqui de propósito:
        // ela subtrai um delta, e a planilha traz o saldo ABSOLUTO — aplicar as duas coisas
        // descontaria duas vezes.
        if (linha.deltaQtd !== 0 && linha.qtdInformada) {
          movimentosNovos.push({
            itemId: linha.itemId,
            depositoId: targetDeposito,
            tipo: linha.deltaQtd < 0 ? 'saida' : 'entrada',
            quantidade: Math.abs(linha.deltaQtd),
            dataMovimento: hoje,
            horaMovimento: horaLocalHHMM(),
            custoUnitario: linha.custoUnitario || undefined,
            observacoes: `${MARCA_CONFERENCIA} de ${hoje.split('-').reverse().join('/')}`,
          })
        }
      } else {
        // Item novo: aqui "não informado" só pode virar zero mesmo — não existe saldo anterior.
        addItemEstoque({
          ...item,
          qtdDisponivel: item.qtdDisponivel ?? 0,
          estoqueMinimo: item.estoqueMinimo ?? 0,
          depositoId: targetDeposito,
          qtdReservada: 0,
          qtdTransito: 0,
        })
        criados++
      }
    }

    // As movimentações vão DEPOIS de todos os saldos: se alguma falhar, o saldo já está certo e o
    // que falta é o histórico. Na ordem inversa, perderia-se o número que o almoxarife conferiu.
    for (const mov of movimentosNovos) addMovimentacao(mov)

    setResultado({ criados, atualizados, movimentos: movimentosNovos.length })
    setStep('done')
    setImporting(false)
  }

  /**
   * Importar pela foto.
   *
   * Só INSERIA — reenviar a mesma foto duplicava tudo, o mesmo defeito que o caminho do Excel já
   * tinha corrigido. Agora casa pelo mesmo critério do diff (código, senão descrição normalizada)
   * e atualiza quem já existe.
   */
  function handleImageImport() {
    setImporting(true)
    const doDeposito = estoqueItens.filter((i) => i.depositoId === targetDeposito)
    const porChave = new Map(doDeposito.map((i) => [chaveDoItem(i), i]))
    let criados = 0
    let atualizados = 0

    for (const row of imageRows) {
      if (!row.descricao.trim()) continue
      const descricao = row.descricao.trim()
      const quantity = parseLocaleNumber(row.qtdDisponivel)
      const unitValue = parseLocaleNumber(row.custoUnitario)
      const existente = porChave.get(chaveDoItem({ descricao }))

      if (existente) {
        updateItemEstoque(existente.id, {
          qtdDisponivel: quantity,
          ...(row.unidade.trim()   ? { unidade: row.unidade.trim() }     : {}),
          ...(unitValue            ? { custoUnitario: unitValue }        : {}),
          ...(row.categoria.trim() ? { categoria: row.categoria.trim() } : {}),
        })
        atualizados++
      } else {
        addItemEstoque({
          depositoId: targetDeposito,
          descricao,
          unidade: row.unidade.trim(),
          qtdDisponivel: quantity,
          qtdReservada: 0,
          qtdTransito: 0,
          estoqueMinimo: 0,
          custoUnitario: unitValue || undefined,
          categoria: row.categoria.trim() || undefined,
        })
        criados++
      }
    }
    setResultado({ criados, atualizados, movimentos: 0 })
    setStep('done')
    setImporting(false)
  }

  function patchImageRow(index: number, patch: Partial<ImageMaterialRow>) {
    setImageRows((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  // Comparado só contra o estoque DESTA frente: a mesma descrição em dois depósitos são dois
  // saldos diferentes, e casar entre frentes moveria material de lugar sem ninguém pedir.
  // Sem `useMemo` de propósito: o React Compiler memoiza isto sozinho, e o `useMemo` manual aqui
  // fazia ele desistir de otimizar o componente inteiro ("memoization could not be preserved").
  const diff = compararComEstoque(
    preview ? applyColumnMapping(preview.rows, mapping) : [],
    estoqueItens.filter((i) => i.depositoId === targetDeposito),
  )

  // Duas colunas disputando o mesmo campo. Antes a última vencia calada, e era assim que
  // "Link do Produto" tomava o lugar de "Produto" — o nome do produto virava a URL.
  const conflitos = detectarConflitos(mapping)
  const rotuloCampo = (v: string) => KNOWN_FIELDS.find((f) => f.value === v)?.label ?? v

  // Quanto saiu COM ficha desde a última conferência. A diferença contra o que a planilha acusa é
  // o material que saiu sem registro — o número que dá sentido a rodar as duas coisas.
  const desdeAConferencia = ultimaConferencia(movimentacoes)
  const comFicha = retiradasComFicha(movimentacoes, desdeAConferencia)

  const totalItems  = diff.linhas.length
  const mudancas    = diff.novos + diff.alterados

  /**
   * Linhas da planilha que não viraram item — as que não têm nome de produto.
   *
   * Antes o número mudava entre um passo e outro ("35 linhas detectadas" no mapeamento, "34 lidas"
   * na conferência) sem uma palavra de explicação. Na planilha do cliente é uma linha só, que tem
   * unidade e código mas nenhum nome.
   */
  const descartadas = Math.max(0, (preview?.rows.length ?? 0) - totalItems)

  /**
   * Nome e código discordando no número.
   *
   * "Thinner 18L" com código "THN05L"; "Bota TAM 43" com "BTA42". Um dos dois está errado e o
   * sistema não tem como saber qual — então aponta, não corrige.
   */
  const divergenciasCodigo = (preview ? applyColumnMapping(preview.rows, mapping) : [])
    .flatMap((it) => {
      const cod = (it.codigoReferencia ?? '').trim()
      const desc = it.descricao ?? ''
      if (!cod || !desc) return []
      const numDesc = desc.match(/\d+/g)
      const numCod  = cod.match(/\d+/g)
      if (!numDesc?.length || !numCod?.length) return []
      // Só aponta quando os DOIS têm número e nenhum do código aparece no nome.
      return numCod.some((n) => numDesc.includes(n)) ? [] : [{ descricao: desc, codigo: cod }]
    })
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

        {/* Passos. Escondido no caminho da foto: ele não passa por "mapear/conferir", e o
            `indexOf(step)` devolvia -1 ali, deixando todos os círculos apagados. */}
        {step !== 'image' && (
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
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* O aviso vem antes de tudo: sem permissão, a importação inteira vira fila presa —
              a tela diria "23 itens criados" e cada insert voltaria 42501. */}
          {!permissao.pode && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>Este acesso não cadastra material.</strong> {permissao.explicacao} Dá para
                conferir o que a planilha mudaria, mas o botão de aplicar fica desligado.
              </span>
            </div>
          )}

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
                  <p className="text-[10px] text-[#3f3f3f] mt-2">Excel .xlsx/.xls/.ods · CSV (inclusive exportado do Google Sheets)</p>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.ods,.csv,text/csv,application/vnd.oasis.opendocument.spreadsheet,image/*"
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
                  <span className="text-[#f97316] font-medium">{filename}</span> — {preview.rows.length} linhas detectadas na aba <b>{preview.sheetName}</b>
                </p>
              </div>

              {preview.sheets.length > 1 && (
                <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2.5">
                  <label className="mb-1 block text-[10px] text-[#a3a3a3]">Aba do arquivo</label>
                  <select
                    value={preview.sheetName}
                    onChange={(e) => trocarAba(e.target.value)}
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                  >
                    {preview.sheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.rows.length} linhas</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[10px] text-[#6b6b6b]">A aba de estoque foi selecionada automaticamente. Escolha outra somente se ela também representar saldo de materiais.</p>
                </div>
              )}

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

              {conflitos.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Duas colunas apontam para o mesmo campo.</strong> Só a primeira é usada, e o
                    resto é ignorado — escolha qual vale, ou marque a outra como "Ignorar".
                    <span className="mt-1 block text-[#d4a44c]">
                      {conflitos.map((c) => `${rotuloCampo(c.campo)}: ${c.cabecalhos.join(' e ')}`).join(' · ')}
                    </span>
                  </span>
                </div>
              )}

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

              <p className="text-[11px] text-[#a3a3a3]">
                <span className="text-[#f97316] font-medium">{filename}</span> · {totalItems} linha{totalItems !== 1 ? 's' : ''} lida{totalItems !== 1 ? 's' : ''},
                comparadas com o estoque de <span className="text-[#f5f5f5]">{deposito?.frente}</span>.
                {mudancas === 0 && ' Nada mudou — pode aplicar sem receio, nenhum item será duplicado.'}
              </p>

              {descartadas > 0 && (
                <p className="rounded border border-[#525252] bg-[#3a3a3a]/50 px-2.5 py-1.5 text-[11px] text-[#d4d4d4]">
                  <b>{descartadas} linha{descartadas !== 1 ? 's' : ''}</b> da planilha
                  {descartadas !== 1 ? ' não viraram itens' : ' não virou item'} por não
                  {descartadas !== 1 ? ' terem' : ' ter'} nome de produto — costuma ser linha em
                  branco, subtotal ou cabeçalho repetido. Nada com nome foi perdido.
                </p>
              )}

              {divergenciasCodigo.length > 0 && (
                <div className="rounded border border-[#eab308]/40 bg-[#eab308]/10 px-2.5 py-2">
                  <p className="text-[11px] font-bold text-[#fbbf24]">
                    {divergenciasCodigo.length} item(ns) com o número do nome diferente do número do código
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {divergenciasCodigo.map((d) => (
                      <li key={`${d.descricao}-${d.codigo}`} className="text-[11px] text-[#e5e5e5]">
                        <b>{d.descricao}</b> → código <b>{d.codigo}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-[#d4d4d4]">
                    Importa do mesmo jeito — só vale conferir depois qual dos dois está certo.
                  </p>
                </div>
              )}

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
                      {['Item', 'Antes', 'Depois', 'Δ', 'Mínimo', 'Com ficha', 'Impacto', 'O que é'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#a3a3a3] font-medium whitespace-nowrap">{h}</th>
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
                        <td className="px-2.5 py-1.5 text-[#a3a3a3] font-mono">{l.qtdAntes ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] font-mono">{l.qtdDepois}</td>
                        <td className={cn('px-2.5 py-1.5 font-mono', l.deltaQtd < 0 ? 'text-[#f87171]' : l.deltaQtd > 0 ? 'text-[#22c55e]' : 'text-[#a3a3a3]')}>
                          {l.tipo === 'novo' ? '—' : l.deltaQtd > 0 ? `+${l.deltaQtd}` : l.deltaQtd || '—'}
                        </td>
                        {/* O mínimo antes → depois. Fica ao lado do saldo porque é o par que
                            decide o alerta de reposição: o alerta só dispara com mínimo > 0, e
                            uma importação que zerasse o mínimo o desligaria em silêncio. */}
                        <td className="px-2.5 py-1.5 font-mono">
                          {(() => {
                            const antes = l.minimoAntes
                            const depois = l.estoqueMinimo
                            if (antes === null) {
                              return depois > 0
                                ? <span className="text-[#e5e5e5]">{depois}</span>
                                : <span className="text-[#a3a3a3]" title="Sem mínimo, o alerta de reposição não dispara para este item">—</span>
                            }
                            if (antes === depois) return <span className="text-[#a3a3a3]">{depois || '—'}</span>
                            // Mínimo caindo para zero é o defeito que esta coluna existe para expor.
                            const perigo = depois === 0 && antes > 0
                            return (
                              <span className={perigo ? 'text-[#f87171]' : 'text-[#38bdf8]'}
                                    title={perigo ? 'O alerta de reposição deste item deixaria de disparar' : undefined}>
                                {antes} → {depois || '0'}
                              </span>
                            )
                          })()}
                        </td>
                        {/* A saída que a planilha acusa × a que tem ficha. Quando a planilha diz
                            que saíram 3 e a ficha registrou 0, três unidades saíram sem ninguém
                            assinar — e é isso que a conferência semanal existe para achar. */}
                        <td className="px-2.5 py-1.5 font-mono">
                          {(() => {
                            if (!l.itemId || l.deltaQtd >= 0) return <span className="text-[#a3a3a3]">—</span>
                            const saiu = Math.abs(l.deltaQtd)
                            const registrado = comFicha.get(l.itemId) ?? 0
                            const semFicha = Math.round((saiu - registrado) * 100) / 100
                            if (semFicha <= 0) return <span className="text-[#4ade80]">{registrado} ✓</span>
                            return (
                              <span className="text-[#fbbf24]" title={`${saiu} saíram, ${registrado} com ficha`}>
                                {registrado}/{saiu} · faltam {semFicha}
                              </span>
                            )
                          })()}
                        </td>
                        <td className={cn('px-2.5 py-1.5 font-mono', l.impactoBRL < 0 ? 'text-[#f87171]' : l.impactoBRL > 0 ? 'text-[#22c55e]' : 'text-[#a3a3a3]')}>
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
                <p className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-[10px] leading-relaxed text-[#6b6b6b]">
                  Havia aqui dois botões de "modelo" que gravavam linhas inventadas
                  ("Abastecimento SPIN — R$ 322,25", "Respirador PFF2 115un") direto no estoque de
                  produção, como se fossem reais. Saíram. Digite o que está na foto.
                </p>
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
                        {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? 's' : ''}
                        {resultado.movimentos > 0 && (
                          <>
                            {', '}
                            <span className="text-[#fb923c]">
                              {resultado.movimentos} movimentaç{resultado.movimentos !== 1 ? 'ões' : 'ão'} registrada{resultado.movimentos !== 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                        {' em '}
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
                  disabled={importing || totalItems === 0 || !permissao.pode}
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
                disabled={importing || imageTotalItems === 0 || !permissao.pode}
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
