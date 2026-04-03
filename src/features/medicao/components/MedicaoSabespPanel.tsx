/**
 * MedicaoSabespPanel — Sabesp measurement tab with editable table,
 * sheet management, and import/export functionality.
 */
import { useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  ChevronRight,
} from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { cn, formatCurrency } from '@/lib/utils'
import { exportMedicaoExcel } from '../utils/exportMedicaoExcel'
import { ImportModal } from './ImportModal'
import type { MedicaoItem } from '@/types'

export function MedicaoSabespPanel() {
  const {
    sheets,
    addSheet,
    updateSheet,
    addItem,
    updateItem,
    removeItem,
    importItems,
  } = useMedicaoStore()

  const sabespSheets = sheets.filter((s) => s.tipo === 'sabesp')

  const [activeSheetId, setActiveSheetId] = useState<string | null>(
    sabespSheets[0]?.id ?? null,
  )
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<{
    itemId: string
    field: 'qtdMedida' | 'qtdAcumulada'
  } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState({
    item: '',
    nPreco: '',
    descricao: '',
    unidade: 'un',
    qtdContratada: 0,
    qtdMedida: 0,
    qtdAcumulada: 0,
    precoUnitario: 0,
  })

  // Sync active sheet if deleted or first load
  const activeSheet =
    sabespSheets.find((s) => s.id === activeSheetId) ?? sabespSheets[0] ?? null

  const filteredItems =
    activeSheet?.items.filter(
      (it) =>
        !search ||
        it.item.toLowerCase().includes(search.toLowerCase()) ||
        it.descricao.toLowerCase().includes(search.toLowerCase()),
    ) ?? []

  const handleCreateSheet = useCallback(() => {
    const id = addSheet({
      tipo: 'sabesp',
      titulo: `Medicao Sabesp ${sabespSheets.length + 1}`,
      referencia: new Date().toISOString().slice(0, 7),
      items: [],
    })
    setActiveSheetId(id)
  }, [addSheet, sabespSheets.length])

  const handleCellClick = useCallback(
    (itemId: string, field: 'qtdMedida' | 'qtdAcumulada', currentVal: number) => {
      setEditingCell({ itemId, field })
      setEditValue(String(currentVal))
    },
    [],
  )

  const handleCellBlur = useCallback(() => {
    if (editingCell && activeSheet) {
      const val = parseFloat(editValue) || 0
      updateItem(activeSheet.id, editingCell.itemId, {
        [editingCell.field]: val,
      })
    }
    setEditingCell(null)
  }, [editingCell, editValue, activeSheet, updateItem])

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCellBlur()
      if (e.key === 'Escape') setEditingCell(null)
    },
    [handleCellBlur],
  )

  const handleAddItem = useCallback(() => {
    if (!activeSheet || !newItem.descricao) return
    addItem(activeSheet.id, newItem)
    setNewItem({
      item: '',
      nPreco: '',
      descricao: '',
      unidade: 'un',
      qtdContratada: 0,
      qtdMedida: 0,
      qtdAcumulada: 0,
      precoUnitario: 0,
    })
    setShowAddForm(false)
  }, [activeSheet, newItem, addItem])

  const handleImport = useCallback(
    (items: Omit<MedicaoItem, 'id'>[]) => {
      if (!activeSheet) return
      importItems(activeSheet.id, items)
    },
    [activeSheet, importItems],
  )

  const handleExport = useCallback(() => {
    if (!activeSheet) return
    exportMedicaoExcel(activeSheet)
  }, [activeSheet])

  const totalValor = filteredItems.reduce((s, it) => s + it.valorMedido, 0)
  const totalQtdMedida = filteredItems.reduce((s, it) => s + it.qtdMedida, 0)

  return (
    <div className="p-6 space-y-4">
      {/* Sheet selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sabespSheets.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSheetId(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                s.id === activeSheet?.id
                  ? 'bg-[#f97316] text-white'
                  : 'bg-[#3d3d3d] text-[#a3a3a3] hover:text-[#f5f5f5] border border-[#525252]',
              )}
            >
              <FileSpreadsheet size={13} />
              {s.titulo}
            </button>
          ))}
        </div>
        <button
          onClick={handleCreateSheet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#3d3d3d] text-[#a3a3a3] hover:text-[#f5f5f5] border border-dashed border-[#525252] transition-colors"
        >
          <Plus size={13} />
          Nova Planilha
        </button>
        {activeSheet && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[#a3a3a3] text-xs">Tipo:</span>
            <select
              value={activeSheet.orcamentoTipo || 'sabesp'}
              onChange={(e) => updateSheet(activeSheet.id, { orcamentoTipo: e.target.value as 'sabesp' | 'empreiteiro' })}
              className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="sabesp">Orçamento Sabesp</option>
              <option value="empreiteiro">Orçamento Empreiteiro</option>
            </select>
          </div>
        )}
      </div>

      {!activeSheet ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-12 text-center">
          <FileSpreadsheet size={40} className="mx-auto text-[#6b6b6b] mb-3" />
          <p className="text-[#a3a3a3] text-sm">
            Nenhuma planilha encontrada. Crie uma nova ou carregue dados demo.
          </p>
        </div>
      ) : (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-[#525252] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={14} className="text-[#a3a3a3]" />
              <input
                type="text"
                placeholder="Buscar item ou descricao..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-[#f5f5f5] text-xs placeholder:text-[#6b6b6b] outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                <Upload size={13} />
                Importar Excel/PDF
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                <Download size={13} />
                Exportar Excel
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
              >
                <Plus size={13} />
                Novo Item
              </button>
            </div>
          </div>

          {/* Add item inline form */}
          {showAddForm && (
            <div className="px-4 py-3 border-b border-[#525252] bg-[#484848]/50">
              <div className="grid grid-cols-9 gap-2">
                <input
                  placeholder="Item"
                  value={newItem.item}
                  onChange={(e) => setNewItem((p) => ({ ...p, item: e.target.value }))}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <input
                  placeholder="N. Preço"
                  value={newItem.nPreco ?? ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, nPreco: e.target.value }))}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <input
                  placeholder="Descricao"
                  value={newItem.descricao}
                  onChange={(e) => setNewItem((p) => ({ ...p, descricao: e.target.value }))}
                  className="col-span-2 bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <input
                  placeholder="UN"
                  value={newItem.unidade}
                  onChange={(e) => setNewItem((p) => ({ ...p, unidade: e.target.value }))}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <input
                  type="number"
                  placeholder="Qtd Contrat."
                  value={newItem.qtdContratada || ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, qtdContratada: Number(e.target.value) }))}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <input
                  type="number"
                  placeholder="Qtd Medida"
                  value={newItem.qtdMedida || ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, qtdMedida: Number(e.target.value) }))}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <input
                  type="number"
                  placeholder="PU (R$)"
                  value={newItem.precoUnitario || ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, precoUnitario: Number(e.target.value) }))}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b]"
                />
                <button
                  onClick={handleAddItem}
                  className="flex items-center justify-center gap-1 rounded-lg text-xs font-medium bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
                >
                  <ChevronRight size={14} />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#484848]/60">
                  <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium w-16">Item</th>
                  <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium">Descrição</th>
                  <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium w-20">N. Preço</th>
                  <th className="px-3 py-2.5 text-center text-[#a3a3a3] font-medium w-12">UN</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-24">Qtd Contrat.</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-24">Qtd Medida</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-24">Acumulada</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-24">PU (R$)</th>
                  <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-28">Valor Medido (R$)</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr
                    key={it.id}
                    className="border-t border-[#525252] hover:bg-[#484848] transition-colors"
                  >
                    <td className="px-3 py-2 text-[#f5f5f5] font-mono">{it.item}</td>
                    <td className="px-3 py-2 text-[#f5f5f5] max-w-[300px] truncate">
                      {it.descricao}
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono text-sm">{it.nPreco || '—'}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] text-center">{it.unidade}</td>
                    <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">
                      {it.qtdContratada.toLocaleString('pt-BR')}
                    </td>
                    <td
                      className="px-3 py-2 text-right cursor-pointer"
                      onClick={() => handleCellClick(it.id, 'qtdMedida', it.qtdMedida)}
                    >
                      {editingCell?.itemId === it.id &&
                      editingCell?.field === 'qtdMedida' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-[#2c2c2c] border border-[#f97316] rounded px-1 py-0.5 text-xs text-[#f5f5f5] font-mono text-right outline-none"
                        />
                      ) : (
                        <span className="text-[#f5f5f5] font-mono hover:text-[#f97316]">
                          {it.qtdMedida.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 text-right cursor-pointer"
                      onClick={() => handleCellClick(it.id, 'qtdAcumulada', it.qtdAcumulada)}
                    >
                      {editingCell?.itemId === it.id &&
                      editingCell?.field === 'qtdAcumulada' ? (
                        <input
                          autoFocus
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full bg-[#2c2c2c] border border-[#f97316] rounded px-1 py-0.5 text-xs text-[#f5f5f5] font-mono text-right outline-none"
                        />
                      ) : (
                        <span className="text-[#f5f5f5] font-mono hover:text-[#f97316]">
                          {it.qtdAcumulada.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">
                      {it.precoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right font-semibold">
                      {formatCurrency(it.valorMedido)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeItem(activeSheet.id, it.id)}
                        className="text-[#6b6b6b] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-[#6b6b6b] text-sm"
                    >
                      Nenhum item encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer totals */}
          {filteredItems.length > 0 && (
            <div className="px-4 py-3 border-t border-[#525252] bg-[#484848]/40 flex items-center justify-between">
              <span className="text-[#a3a3a3] text-xs">
                {filteredItems.length} itens
              </span>
              <div className="flex items-center gap-6">
                <span className="text-[#a3a3a3] text-xs">
                  Qtd Medida Total:{' '}
                  <span className="text-[#f5f5f5] font-mono font-semibold">
                    {totalQtdMedida.toLocaleString('pt-BR')}
                  </span>
                </span>
                <span className="text-[#a3a3a3] text-xs">
                  Valor Total:{' '}
                  <span className="text-[#f97316] font-mono font-semibold">
                    {formatCurrency(totalValor)}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        tipo="sabesp"
      />
    </div>
  )
}
