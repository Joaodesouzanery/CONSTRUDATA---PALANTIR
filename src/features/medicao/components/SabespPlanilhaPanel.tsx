/**
 * SabespPlanilhaPanel — Step 1: Planilha de Medição Sabesp.
 *
 * Allows entering/editing contract items (itens de contrato) for the
 * active boletim. Groups items by 01/02/03 (Canteiros, Esgoto, Água).
 */
import { useState, useRef, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, AlertCircle, X as XIcon, FileDown, Save, CheckCircle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import { getAllCriterios } from '../data/criterios'
import type { ItemContrato } from '@/store/medicaoBillingStore'
import { readWorkbook, parseSabespSheet } from '../utils/xlsxParsers'
import type { SabespParseResult } from '../utils/xlsxParsers'
import { exportSabespPdf } from '../utils/exportPdf'

/** Export current boletim items as XLSX for backup/sharing */
function exportSabespXlsx(itens: ItemContrato[], periodo: string, contrato: string) {
  const rows = itens.map(i => ({
    'Item': i.itemEAP,
    'N. Preço': i.nPreco,
    'Descrição': i.descricao,
    'Unid.': i.unidade,
    'Qtd Contrato': i.qtdContrato,
    'Vl. Unitário': i.valorUnitario,
    'Qtd Anterior': i.qtdAnterior,
    'Qtd Período': i.qtdMedida,
    'Qtd Acumulada': i.qtdAnterior + i.qtdMedida,
    'Total Período (R$)': Math.round(i.qtdMedida * i.valorUnitario * 100) / 100,
    'Saldo Qtd': i.qtdContrato - i.qtdAnterior - i.qtdMedida,
    'Saldo (R$)': Math.round((i.qtdContrato - i.qtdAnterior - i.qtdMedida) * i.valorUnitario * 100) / 100,
    'Grupo': i.grupo,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Medição ${periodo}`)
  XLSX.writeFile(wb, `Medicao_Sabesp_${contrato}_${periodo.replace('/', '-')}.xlsx`)
}

/** Download empty template XLSX for Sabesp measurement */
function downloadTemplateSabesp() {
  const template = [{
    'Item': '01010101',
    'N. Preço': '500001',
    'Descrição': 'IMPLANTAÇÃO DO CANTEIRO ESGOTO',
    'Unid.': 'GB',
    'Qtd Contrato': 1,
    'Vl. Unitário': 5381388.60,
    'Qtd Anterior': 0,
    'Qtd Período': 0,
  }]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Medição')
  XLSX.writeFile(wb, 'Template_Medicao_Sabesp_ConstruData.xlsx')
}

const GRUPOS = [
  { id: '01', nome: 'Canteiros e Planos' },
  { id: '02', nome: 'Esgoto' },
  { id: '03', nome: 'Água' },
  { id: 'EX', nome: 'Extra / Aditivos' },
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AddItemFormProps {
  onAdd: (item: Omit<ItemContrato, 'id'>) => void
}

function AddItemForm({ onAdd }: AddItemFormProps) {
  const [open, setOpen] = useState(false)
  const [itemEAP, setItemEAP]             = useState('')
  const [nPreco, setNPreco]               = useState('')
  const [descricao, setDescricao]         = useState('')
  const [unidade, setUnidade]             = useState('M')
  const [grupo, setGrupo]                 = useState<'01'|'02'|'03'>('02')
  const [qtdContrato, setQtdContrato]     = useState('')
  const [qtdAnterior, setQtdAcumulada]   = useState('')
  const [qtdMedida, setQtdMedida]         = useState('')
  const [valorUnitario, setValorUnitario] = useState('')

  // Auto-fill from criterios catalog
  function handleNPrecoChange(val: string) {
    setNPreco(val)
    const crit = getAllCriterios().find((c) => c.nPreco === val.trim())
    if (crit) {
      setDescricao(crit.descricao)
      setUnidade(crit.unidade)
      setGrupo(crit.grupo)
    }
  }

  function handleAdd() {
    if (!nPreco.trim() || !descricao.trim()) return
    onAdd({
      itemEAP:       itemEAP.trim(),
      nPreco:        nPreco.trim(),
      descricao:     descricao.trim(),
      unidade:       unidade.trim() || 'M',
      grupo,
      qtdContrato:   parseFloat(qtdContrato) || 0,
      qtdAnterior:  parseFloat(qtdAnterior) || 0,
      qtdMedida:     parseFloat(qtdMedida)   || 0,
      valorUnitario: parseFloat(valorUnitario.replace(',', '.')) || 0,
    })
    setItemEAP(''); setNPreco(''); setDescricao(''); setUnidade('M'); setGrupo('02')
    setQtdContrato(''); setQtdAcumulada(''); setQtdMedida(''); setValorUnitario('')
    setOpen(false)
  }

  return (
    <div className="border border-dashed border-[#525252] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#f97316] hover:bg-[#f97316]/5 transition-colors"
      >
        <Plus size={15} />
        Adicionar item de contrato
        {open ? <ChevronDown size={14} className="ml-auto" /> : <ChevronRight size={14} className="ml-auto" />}
      </button>
      {open && (
        <div className="p-4 border-t border-[#525252] grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1f1f1f]">
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Item (EAP)</label>
            <input
              value={itemEAP}
              onChange={(e) => setItemEAP(e.target.value)}
              placeholder="ex.: 01010101"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Nº Preço</label>
            <input
              value={nPreco}
              onChange={(e) => handleNPrecoChange(e.target.value)}
              placeholder="ex.: 420009"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do serviço"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Grupo</label>
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value as '01'|'02'|'03')}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            >
              {GRUPOS.map((g) => <option key={g.id} value={g.id}>{g.id} — {g.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Unidade</label>
            <input
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="M"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Qtd Contrato</label>
            <input
              type="number"
              min={0}
              value={qtdContrato}
              onChange={(e) => setQtdContrato(e.target.value)}
              placeholder="0"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Qtd Anterior</label>
            <input
              type="number"
              min={0}
              value={qtdAnterior}
              onChange={(e) => setQtdAcumulada(e.target.value)}
              placeholder="0"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Qtd Medida (período)</label>
            <input
              type="number"
              min={0}
              value={qtdMedida}
              onChange={(e) => setQtdMedida(e.target.value)}
              placeholder="0"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Valor Unitário (R$)</label>
            <input
              value={valorUnitario}
              onChange={(e) => setValorUnitario(e.target.value)}
              placeholder="0,00"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div className="col-span-2 sm:col-span-4 flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!nPreco.trim() || !descricao.trim()}
              className="px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#f97316' }}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── XLSX Import section ──────────────────────────────────────────────────────

function XlsxImportSabesp() {
  const { getActiveBoletim, importItensContrato } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<SabespParseResult | null>(null)
  const [previewFileName, setPreviewFileName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const wb = await readWorkbook(file)
      setPreview(parseSabespSheet(wb))
      setPreviewFileName(file.name)
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleConfirm() {
    if (!preview || preview.errors.length > 0) return
    importItensContrato(preview.itens, true, {
      sourceName: previewFileName,
      sourceTotals: preview.sourceTotals,
      anchors: preview.anchors,
      validations: preview.validations,
    })
    setPreview(null)
    setPreviewFileName('')
  }

  const hasItems = (boletim?.itensContrato.length ?? 0) > 0

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-50 transition-colors"
        >
          <Upload size={13} />
          {loading ? 'Lendo...' : 'Importar XLSX / CSV'}
        </button>
        {hasItems && (
          <span className="text-[10px] text-[#6b6b6b]">Re-importar irá substituir todos os itens.</span>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
              <span className="text-white font-semibold text-sm">Pré-visualização — Planilha Sabesp</span>
              <button onClick={() => setPreview(null)} className="text-[#6b6b6b] hover:text-white"><XIcon size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {preview.errors.length > 0 ? (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div>{preview.errors.join(' ')}</div>
                </div>
              ) : (
                <>
                  <p className="text-[#a3a3a3] text-xs">{preview.itens.length} itens encontrados. Os itens atuais serão substituídos.</p>
                  {preview.sourceTotals && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] md:grid-cols-4">
                      {[
                        ['Contrato', preview.sourceTotals.totalContrato],
                        ['Periodo', preview.sourceTotals.totalPeriodo],
                        ['Acumulado', preview.sourceTotals.totalAcumulado],
                        ['Saldo', preview.sourceTotals.saldo],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded border border-[#525252] bg-[#1f1f1f] p-2">
                          <div className="text-[#a3a3a3] uppercase">{label}</div>
                          <div className="text-[#f5f5f5] font-semibold">R$ {fmt(Number(value) || 0)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.extras && preview.extras.length > 0 && (
                    <div className="rounded-lg border border-blue-700/30 bg-blue-900/20 p-2 text-[10px] text-blue-200">
                      {preview.extras.length} item(ns) identificado(s) em Extras / Aditivos. Eles serao preservados em tabela separada.
                    </div>
                  )}
                  {preview.validations && preview.validations.length > 0 && (
                    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-2 text-[10px] text-[#d4d4d4]">
                      Validacoes: {preview.validations.map((item) => `${item.label}: ${item.ok ? 'OK' : `dif. R$ ${fmt(item.diff)}`}`).join(' · ')}
                    </div>
                  )}
                  {preview.warnings && preview.warnings.length > 0 && (
                    <div className="flex items-start gap-2 text-amber-400 text-[10px] bg-amber-900/20 border border-amber-700/30 rounded-lg p-2">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <div>{preview.warnings.length} aviso(s): {preview.warnings.slice(0, 3).join(' · ')}{preview.warnings.length > 3 ? ` (+${preview.warnings.length - 3})` : ''}</div>
                    </div>
                  )}
                  <div className="overflow-x-auto max-h-56 border border-[#525252] rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#1f1f1f] text-[#6b6b6b] uppercase text-[9px]">
                          <th className="px-2 py-2 text-left">Item</th>
                          <th className="px-2 py-2 text-left">Nº Preço</th>
                          <th className="px-2 py-2 text-left">Descrição</th>
                          <th className="px-2 py-2 text-center">Un</th>
                          <th className="px-2 py-2 text-right">Qtd Anter.</th>
                          <th className="px-2 py-2 text-right">Qtd Medida</th>
                          <th className="px-2 py-2 text-right">Vl. Unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.itens.slice(0, 8).map((item, i) => (
                          <tr key={i} className="border-t border-[#525252]">
                            <td className="px-2 py-1.5 font-mono text-[#a3a3a3] text-[10px]">{item.itemEAP || '—'}</td>
                            <td className="px-2 py-1.5 font-mono text-[#f97316]">{item.nPreco}</td>
                            <td className="px-2 py-1.5 text-[#f5f5f5] max-w-[160px] truncate">{item.descricao}</td>
                            <td className="px-2 py-1.5 text-center text-[#a3a3a3]">{item.unidade}</td>
                            <td className="px-2 py-1.5 text-right">{item.qtdAnterior}</td>
                            <td className="px-2 py-1.5 text-right">{item.qtdMedida}</td>
                            <td className="px-2 py-1.5 text-right">{item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        {preview.itens.length > 8 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-2 text-center text-[#6b6b6b] text-[10px]">
                              + {preview.itens.length - 8} itens adicionais
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
              <button onClick={() => setPreview(null)} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
              {preview.errors.length === 0 && (
                <button
                  onClick={handleConfirm}
                  className="px-5 py-2 text-xs font-medium text-white rounded-lg transition-colors"
                  style={{ backgroundColor: '#f97316' }}
                >
                  Importar {preview.itens.length} itens
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SabespPlanilhaPanel() {
  const {
    getActiveBoletim,
    addItemContrato,
    updateItemContrato,
    removeItemContrato,
    savePlanilhaBase,
    setPlanilhaBaseEnabled,
  } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(() => {
    savePlanilhaBase()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [savePlanilhaBase])

  if (!boletim) return (
    <div className="p-8 text-center text-[#6b6b6b] text-sm">
      Nenhum boletim ativo. Crie um boletim para começar.
    </div>
  )

  function toggleGroup(g: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const totalContrato = boletim.itensContrato.reduce((s, i) => s + i.qtdContrato * i.valorUnitario, 0)
  const totalPeriodo = boletim.itensContrato.reduce((s, i) => s + i.qtdMedida * i.valorUnitario, 0)
  const totalAcumulado = boletim.itensContrato.reduce((s, i) => s + (i.qtdAnterior + i.qtdMedida) * i.valorUnitario, 0)
  const totalSaldo = boletim.itensContrato.reduce((s, i) => s + (i.qtdContrato - i.qtdAnterior - i.qtdMedida) * i.valorUnitario, 0)

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-semibold text-base">Planilha de Medição Sabesp</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Contrato {boletim.contrato} · {boletim.consorcio} · Período: {boletim.periodo}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <XlsxImportSabesp />
          <button type="button" onClick={downloadTemplateSabesp}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-dashed border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#a3a3a3] transition-colors">
            <Download size={13} /> Template XLSX
          </button>
          {boletim.itensContrato.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportSabespXlsx(boletim.itensContrato, boletim.periodo, boletim.contrato)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                <FileDown size={13} /> Exportar XLSX
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  saved
                    ? 'bg-emerald-600 text-white'
                    : 'border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]'
                }`}
              >
                {saved ? <CheckCircle size={13} /> : <Save size={13} />}
                {saved ? 'Salvo!' : 'Salvar Planilha'}
              </button>
              <button
                type="button"
                onClick={() => exportSabespPdf(boletim.itensContrato, boletim.periodo, boletim.contrato, boletim.consorcio, boletim.planilhaBase?.sourceTotals)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                <FileDown size={13} />
                Exportar PDF
              </button>
            </>
          )}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] text-[#a3a3a3] uppercase">Contrato</div>
              <div className="text-[#f5f5f5] font-bold text-sm">
                R$ {fmt(totalContrato)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#a3a3a3] uppercase">Total período</div>
              <div className="text-[#f97316] font-bold text-base">
                R$ {fmt(totalPeriodo)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#a3a3a3] uppercase">Acumulado</div>
              <div className="text-[#a3a3a3] font-bold text-sm">
                R$ {fmt(totalAcumulado)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#a3a3a3] uppercase">Saldo</div>
              <div className={`font-bold text-sm ${totalSaldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R$ {fmt(totalSaldo)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {boletim.planilhaBase && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#2c2c2c] px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-[#f5f5f5]">Planilha-base salva</div>
            <div className="text-xs text-[#a3a3a3]">
              {boletim.planilhaBase.itensSnapshot.length} itens
              {boletim.planilhaBase.sourceName ? ` · ${boletim.planilhaBase.sourceName}` : ''}
              {' · '}
              {new Date(boletim.planilhaBase.savedAt).toLocaleString('pt-BR')}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#f5f5f5]">
            <input
              type="checkbox"
              checked={boletim.planilhaBase.enabled}
              onChange={(event) => setPlanilhaBaseEnabled(event.target.checked)}
              className="h-4 w-4 accent-[#f97316]"
            />
            Usar como base dos cálculos
          </label>
        </div>
      )}

      {/* Alert banner for items with negative balance */}
      {boletim.itensContrato.some((i) => (i.qtdContrato - i.qtdAnterior - i.qtdMedida) < 0) && (
        <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>{boletim.itensContrato.filter((i) => (i.qtdContrato - i.qtdAnterior - i.qtdMedida) < 0).length} item(ns) com saldo negativo</strong>
            {' '}— a medição excede a quantidade contratual. Verifique se é aditivo autorizado ou erro de lançamento.
          </div>
        </div>
      )}

      {/* Alert banner for items without N. Preço */}
      {boletim.itensContrato.some((i) => i.nPreco.startsWith('EXT')) && (
        <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>{boletim.itensContrato.filter((i) => i.nPreco.startsWith('EXT')).length} item(ns) sem código N. Preço Sabesp.</strong>
            {' '}Edite o N. Preço diretamente na tabela ou marque como Aditivo. Itens sem código podem ser rejeitados pela fiscalização.
          </div>
        </div>
      )}

      {GRUPOS.map((grupo) => {
        const items = boletim.itensContrato.filter((i) => i.grupo === grupo.id)
        const subtotal = items.reduce((s, i) => s + i.qtdMedida * i.valorUnitario, 0)
        const isCollapsed = collapsed.has(grupo.id)
        return (
          <div key={grupo.id} className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(grupo.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#3a3a3a] hover:bg-[#444] transition-colors"
            >
              {isCollapsed ? <ChevronRight size={16} className="text-[#f97316]" /> : <ChevronDown size={16} className="text-[#f97316]" />}
              <span className="text-white font-semibold text-sm">{grupo.id} — {grupo.nome}</span>
              <span className="ml-auto text-[#a3a3a3] text-xs">{items.length} itens · R$ {fmt(subtotal)}</span>
            </button>
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#1f1f1f] text-[#a3a3a3] text-[9px] uppercase tracking-wider">
                      <th className="px-2 py-2 text-left border-r border-[#525252] whitespace-nowrap">Item</th>
                      <th className="px-2 py-2 text-left border-r border-[#525252] whitespace-nowrap">Descrição / N. Preço</th>
                      <th className="px-2 py-2 text-center border-r border-[#525252] whitespace-nowrap">Un</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Qtd Contrato</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Qtd Anterior</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Qtd Período</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Qtd Acumulada</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Vl. Unitário</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Total Período (R$)</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Saldo Qtd</th>
                      <th className="px-2 py-2 text-right border-r border-[#525252] whitespace-nowrap">Saldo (R$)</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-5 text-center text-xs text-[#6b6b6b] italic border-b border-[#525252]">
                          Nenhum item neste grupo. Adicione abaixo.
                        </td>
                      </tr>
                    ) : items.map((item) => {
                      const qtdAcum = item.qtdAnterior + item.qtdMedida
                      const saldoQtd = item.qtdContrato - qtdAcum
                      const totalPeriodo = item.qtdMedida * item.valorUnitario
                      const saldoR$ = saldoQtd * item.valorUnitario
                      const inputCls = "w-full bg-transparent text-right text-[#f5f5f5] focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-0.5 text-[10px]"
                      return (
                      <tr key={item.id} className={`border-b border-[#525252] hover:bg-[#333] ${
                        item.nPreco.startsWith('EXT') ? 'bg-amber-950/20 border-l-2 border-l-red-500' :
                        saldoQtd < 0 ? 'bg-red-950/15 border-l-2 border-l-amber-500' : ''
                      }`} title={
                        item.nPreco.startsWith('EXT') ? 'Serviço sem código de catálogo Sabesp — insira o N. Preço ou marque como Aditivo' :
                        saldoQtd < 0 ? `Saldo negativo: medição excede contrato em ${Math.abs(saldoQtd).toLocaleString('pt-BR')} ${item.unidade}` : undefined
                      }>
                        {/* Item (EAP) */}
                        <td className="px-2 py-2 border-r border-[#525252] font-mono text-[#a3a3a3] text-[10px] whitespace-nowrap">{item.itemEAP || '—'}</td>
                        {/* Descrição + N. Preço */}
                        <td className="px-2 py-2 border-r border-[#525252] text-[10px]">
                          <div className="text-[#f5f5f5] leading-tight">{item.descricao}</div>
                          {item.nPreco.startsWith('EXT') ? (
                            <input
                              type="text"
                              value={item.nPreco}
                              onChange={(e) => updateItemContrato(item.id, { nPreco: e.target.value })}
                              placeholder="Insira N. Preço"
                              className="mt-0.5 w-24 bg-red-900/30 border border-red-500/50 rounded px-1 py-0.5 text-[9px] text-red-300 font-mono focus:outline-none focus:border-red-400"
                            />
                          ) : (
                            <div className="text-[#f97316] font-mono text-[9px] mt-0.5">{item.nPreco}</div>
                          )}
                        </td>
                        {/* Un */}
                        <td className="px-2 py-2 border-r border-[#525252] text-center text-[#a3a3a3] text-[10px]">{item.unidade}</td>
                        {/* Qtd Contrato */}
                        <td className="px-1 py-1 border-r border-[#525252]">
                          <input type="number" min={0} value={item.qtdContrato}
                            onChange={(e) => updateItemContrato(item.id, { qtdContrato: parseFloat(e.target.value) || 0 })}
                            className={inputCls} />
                        </td>
                        {/* Qtd Anterior */}
                        <td className="px-1 py-1 border-r border-[#525252]">
                          <input type="number" min={0} value={item.qtdAnterior}
                            onChange={(e) => updateItemContrato(item.id, { qtdAnterior: parseFloat(e.target.value) || 0 })}
                            className={inputCls} />
                        </td>
                        {/* Qtd Período (atual) */}
                        <td className="px-1 py-1 border-r border-[#525252]">
                          <input type="number" min={0} value={item.qtdMedida}
                            onChange={(e) => updateItemContrato(item.id, { qtdMedida: parseFloat(e.target.value) || 0 })}
                            className={inputCls} />
                        </td>
                        {/* Qtd Acumulada (calculada) */}
                        <td className="px-2 py-2 border-r border-[#525252] text-right text-[#a3a3a3] text-[10px] tabular-nums">{fmt(qtdAcum)}</td>
                        {/* Vl. Unitário */}
                        <td className="px-1 py-1 border-r border-[#525252]">
                          <input type="number" min={0} step={0.01} value={item.valorUnitario}
                            onChange={(e) => updateItemContrato(item.id, { valorUnitario: parseFloat(e.target.value) || 0 })}
                            className={inputCls} />
                        </td>
                        {/* Total Período R$ */}
                        <td className="px-2 py-2 border-r border-[#525252] text-right font-medium text-emerald-400 text-[10px] tabular-nums whitespace-nowrap">
                          R$ {fmt(totalPeriodo)}
                        </td>
                        {/* Saldo Qtd */}
                        <td className={`px-2 py-2 border-r border-[#525252] text-right text-[10px] tabular-nums ${saldoQtd >= 0 ? 'text-[#a3a3a3]' : 'text-red-400 font-bold'}`}>
                          {fmt(saldoQtd)}
                        </td>
                        {/* Saldo R$ */}
                        <td className={`px-2 py-2 border-r border-[#525252] text-right font-medium text-[10px] tabular-nums whitespace-nowrap ${saldoR$ >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          R$ {fmt(saldoR$)}
                        </td>
                        {/* Delete */}
                        <td className="px-1 py-2 text-center">
                          <button type="button" onClick={() => removeItemContrato(item.id)}
                            className="text-red-400 hover:bg-red-900/20 rounded p-1 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#1a1a1a] border-t-2 border-[#f97316]/30">
                        <td colSpan={8} className="px-2 py-2.5 text-right text-[10px] font-bold text-white uppercase tracking-wider border-r border-[#525252]">
                          Total do Grupo — {grupo.nome}
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold text-[#f97316] border-r border-[#525252] text-xs tabular-nums whitespace-nowrap">
                          R$ {fmt(subtotal)}
                        </td>
                        <td className="px-2 py-2.5 border-r border-[#525252]" />
                        <td className="px-2 py-2.5 text-right font-bold text-[#a3a3a3] border-r border-[#525252] text-xs tabular-nums whitespace-nowrap">
                          R$ {fmt(items.reduce((s, i) => s + (i.qtdContrato - i.qtdAnterior - i.qtdMedida) * i.valorUnitario, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )
      })}

      <AddItemForm onAdd={addItemContrato} />
    </div>
  )
}
