import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpDown,
  Box,
  Edit2,
  Filter,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { ItemEstoque } from '@/types'
import { cn } from '@/lib/utils'

type MovementType = 'entrada' | 'saida'

interface MovementForm {
  item: ItemEstoque
  tipo: MovementType
  quantidade: string
  fornecedor: string
  nf: string
}

interface ItemForm {
  depositoId: string
  descricao: string
  categoria: string
  unidade: string
  qtdDisponivel: string
  estoqueMinimo: string
  custoUnitario: string
  fornecedorPrincipal: string
}

const inputClass = 'w-full rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60'

const emptyForm: ItemForm = {
  depositoId: '',
  descricao: '',
  categoria: '',
  unidade: '',
  qtdDisponivel: '',
  estoqueMinimo: '',
  custoUnitario: '',
  fornecedorPrincipal: '',
}

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AlmoxarifadoPanel() {
  const {
    depositos,
    estoqueItens,
    addItemEstoque,
    updateItemEstoque,
    removeItemEstoque,
    addMovimentacao,
    consumirMaterial,
  } = useSuprimentosStore(
    useShallow((s) => ({
      depositos: s.depositos,
      estoqueItens: s.estoqueItens,
      addItemEstoque: s.addItemEstoque,
      updateItemEstoque: s.updateItemEstoque,
      removeItemEstoque: s.removeItemEstoque,
      addMovimentacao: s.addMovimentacao,
      consumirMaterial: s.consumirMaterial,
    }))
  )

  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [category, setCategory] = useState('Todas')
  const [depositoId, setDepositoId] = useState('todos')
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [movement, setMovement] = useState<MovementForm | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm)

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(estoqueItens.map((item) => item.categoria || 'Sem categoria')))],
    [estoqueItens],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return estoqueItens.filter((item) => {
      const deposito = depositos.find((dep) => dep.id === item.depositoId)
      const low = item.qtdDisponivel < item.estoqueMinimo
      const text = [
        item.id,
        item.descricao,
        item.categoria,
        item.fornecedorPrincipal,
        deposito?.frente,
        deposito?.descricao,
      ].join(' ').toLowerCase()

      if (q && !text.includes(q)) return false
      if (lowOnly && !low) return false
      if (category !== 'Todas' && (item.categoria || 'Sem categoria') !== category) return false
      if (depositoId !== 'todos' && item.depositoId !== depositoId) return false
      return true
    })
  }, [category, depositoId, depositos, estoqueItens, lowOnly, search])

  const totalValue = estoqueItens.reduce((sum, item) => sum + item.qtdDisponivel * (item.custoUnitario ?? 0), 0)
  const lowItems = estoqueItens.filter((item) => item.qtdDisponivel < item.estoqueMinimo)
  const activeCategories = new Set(estoqueItens.map((item) => item.categoria || 'Sem categoria')).size

  function depositoLabel(item: ItemEstoque, field: 'frente' | 'descricao') {
    const deposito = depositos.find((dep) => dep.id === item.depositoId)
    if (field === 'descricao') return deposito?.descricao || 'Almoxarifado Central'
    return deposito?.frente || 'Projeto nao informado'
  }

  function openNewItemForm() {
    setEditingItemId(null)
    setForm({ ...emptyForm, depositoId: depositos[0]?.id ?? '' })
    setShowItemForm(true)
  }

  function openEditItemForm(item: ItemEstoque) {
    setEditingItemId(item.id)
    setForm({
      depositoId: item.depositoId,
      descricao: item.descricao,
      categoria: item.categoria ?? '',
      unidade: item.unidade,
      qtdDisponivel: String(item.qtdDisponivel),
      estoqueMinimo: String(item.estoqueMinimo),
      custoUnitario: String(item.custoUnitario ?? 0),
      fornecedorPrincipal: item.fornecedorPrincipal ?? '',
    })
    setShowItemForm(true)
  }

  function closeItemForm() {
    setShowItemForm(false)
    setEditingItemId(null)
    setForm(emptyForm)
  }

  function handleSaveItem() {
    const depId = form.depositoId || depositos[0]?.id || 'dep-default'
    if (!form.descricao.trim() || !form.unidade.trim()) return

    const payload = {
      depositoId: depId,
      descricao: form.descricao.trim(),
      unidade: form.unidade.trim(),
      qtdDisponivel: Number(form.qtdDisponivel) || 0,
      qtdReservada: 0,
      qtdTransito: 0,
      estoqueMinimo: Number(form.estoqueMinimo) || 0,
      custoUnitario: Number(form.custoUnitario) || 0,
      categoria: form.categoria.trim() || undefined,
      fornecedorPrincipal: form.fornecedorPrincipal.trim() || undefined,
    }

    if (editingItemId) {
      updateItemEstoque(editingItemId, payload)
    } else {
      addItemEstoque(payload)
    }
    closeItemForm()
  }

  function handleDeleteItem(item: ItemEstoque) {
    const ok = window.confirm(`Excluir "${item.descricao}" do almoxarifado?`)
    if (!ok) return
    removeItemEstoque(item.id)
  }

  function handleMovementSave() {
    if (!movement) return
    const qty = Number(movement.quantidade)
    if (!Number.isFinite(qty) || qty <= 0) return

    if (movement.tipo === 'saida') {
      consumirMaterial(movement.item.id, qty, { observacoes: `Almoxarifado - NF: ${movement.nf || '-'}` })
    } else {
      updateItemEstoque(movement.item.id, {
        qtdDisponivel: movement.item.qtdDisponivel + qty,
      })
      addMovimentacao({
        itemId: movement.item.id,
        depositoId: movement.item.depositoId,
        tipo: 'entrada',
        quantidade: qty,
        dataMovimento: new Date().toISOString().slice(0, 10),
        fornecedor: movement.fornecedor || undefined,
        nf: movement.nf || undefined,
      })
    }

    setMovement(null)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#525252] bg-[#2f2f2f] p-5 text-[#f5f5f5]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#f5f5f5]">Almoxarifado</h2>
          <p className="text-sm text-[#a3a3a3]">Controle operacional de materiais, estoque minimo e movimentacoes.</p>
        </div>
        <button
          type="button"
          onClick={openNewItemForm}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
        >
          <Plus size={16} />
          Novo Item
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total de Itens', value: estoqueItens.length, icon: Box, tone: 'text-[#38bdf8]' },
          { label: 'Estoque Baixo', value: lowItems.length, icon: AlertTriangle, tone: 'text-[#f87171]' },
          { label: 'Valor Total', value: brl(totalValue), icon: TrendingUp, tone: 'text-[#4ade80]' },
          { label: 'Categorias', value: activeCategories, icon: Package, tone: 'text-[#fbbf24]' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#a3a3a3]">{label}</span>
              <Icon size={18} className={tone} />
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', label === 'Estoque Baixo' && lowItems.length > 0 ? 'text-[#f87171]' : 'text-[#f5f5f5]')}>
              {value}
            </div>
            {label === 'Estoque Baixo' && <p className="mt-2 text-xs text-[#6b6b6b]">Itens abaixo do estoque minimo</p>}
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-[#525252] bg-[#333333] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, codigo, local ou fornecedor..."
              className="w-full rounded-lg border border-[#525252] bg-[#3d3d3d] py-2.5 pl-10 pr-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60"
            />
          </div>
          <button
            type="button"
            onClick={() => setLowOnly((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors',
              lowOnly ? 'border-[#f87171]/40 bg-[#dc2626]/15 text-[#f87171]' : 'border-[#525252] bg-[#3d3d3d] text-[#e5e5e5] hover:bg-[#484848]',
            )}
          >
            <AlertTriangle size={16} />
            Estoque Baixo
            <span className="ml-1 rounded-full border border-[#525252] px-2 py-0.5 text-xs">{lowItems.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors',
              showFilters ? 'border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316]' : 'border-[#525252] bg-[#3d3d3d] text-[#e5e5e5] hover:bg-[#484848]',
            )}
          >
            <Filter size={16} />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-[#525252] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select value={depositoId} onChange={(event) => setDepositoId(event.target.value)} className={inputClass}>
              <option value="todos">Todos os projetos</option>
              {depositos.map((dep) => <option key={dep.id} value={dep.id}>{dep.frente}</option>)}
            </select>
            <button
              type="button"
              onClick={() => { setSearch(''); setLowOnly(false); setCategory('Todas'); setDepositoId('todos') }}
              className="rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#484848]"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {showItemForm && (
        <div className="mb-5 rounded-xl border border-[#525252] bg-[#333333] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#f5f5f5]">{editingItemId ? 'Editar material' : 'Cadastrar material'}</h3>
            <button type="button" onClick={closeItemForm} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white" title="Fechar">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={form.depositoId} onChange={(event) => setForm((item) => ({ ...item, depositoId: event.target.value }))} className={inputClass}>
              <option value="">Projeto / deposito padrao</option>
              {depositos.map((dep) => <option key={dep.id} value={dep.id}>{dep.frente}</option>)}
            </select>
            <input value={form.descricao} onChange={(event) => setForm((item) => ({ ...item, descricao: event.target.value }))} placeholder="Material" className={inputClass} />
            <input value={form.categoria} onChange={(event) => setForm((item) => ({ ...item, categoria: event.target.value }))} placeholder="Categoria" className={inputClass} />
            <input value={form.unidade} onChange={(event) => setForm((item) => ({ ...item, unidade: event.target.value }))} placeholder="Unidade" className={inputClass} />
            <input type="number" value={form.qtdDisponivel} onChange={(event) => setForm((item) => ({ ...item, qtdDisponivel: event.target.value }))} placeholder="Quantidade" className={inputClass} />
            <input type="number" value={form.estoqueMinimo} onChange={(event) => setForm((item) => ({ ...item, estoqueMinimo: event.target.value }))} placeholder="Estoque minimo" className={inputClass} />
            <input type="number" value={form.custoUnitario} onChange={(event) => setForm((item) => ({ ...item, custoUnitario: event.target.value }))} placeholder="Valor unitario" className={inputClass} />
            <input value={form.fornecedorPrincipal} onChange={(event) => setForm((item) => ({ ...item, fornecedorPrincipal: event.target.value }))} placeholder="Fornecedor" className={inputClass} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeItemForm} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#a3a3a3] hover:bg-[#3d3d3d]">Cancelar</button>
            <button type="button" onClick={handleSaveItem} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
              <Save size={15} />
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[#f5f5f5]">Materiais em Estoque</h3>
          <p className="text-sm text-[#a3a3a3]">Gerencie materiais disponiveis, faltantes e movimentacoes do almoxarifado.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-[#525252] text-left text-[#a3a3a3]">
                {['Codigo', 'Material', 'Categoria', 'Projeto', 'Qtd.', 'Minimo', 'Comprar', 'Un.', 'Localizacao', 'Status', 'Acoes'].map((head) => (
                  <th key={head} className="px-3 py-3 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {filtered.map((item) => {
                const missing = Math.max(0, item.estoqueMinimo - item.qtdDisponivel)
                const low = missing > 0
                return (
                  <tr key={item.id} className="hover:bg-[#3d3d3d]">
                    <td className="px-3 py-4 font-mono text-xs text-[#a3a3a3]">{item.id.slice(0, 8)}</td>
                    <td className="max-w-[190px] px-3 py-4 font-semibold text-[#f5f5f5]">{item.descricao}</td>
                    <td className="px-3 py-4">
                      <span className="rounded-full border border-[#525252] px-3 py-1 text-xs font-medium text-[#e5e5e5]">
                        {item.categoria || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-[#e5e5e5]">{depositoLabel(item, 'frente')}</td>
                    <td className={cn('px-3 py-4 tabular-nums', low ? 'font-semibold text-[#f87171]' : 'text-[#f5f5f5]')}>{item.qtdDisponivel}</td>
                    <td className="px-3 py-4 tabular-nums text-[#e5e5e5]">{item.estoqueMinimo}</td>
                    <td className={cn('px-3 py-4 tabular-nums', missing > 0 ? 'font-semibold text-[#f87171]' : 'text-[#6b6b6b]')}>{missing || '-'}</td>
                    <td className="px-3 py-4 text-[#e5e5e5]">{item.unidade}</td>
                    <td className="px-3 py-4 text-[#a3a3a3]">{depositoLabel(item, 'descricao')}</td>
                    <td className="px-3 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold',
                        low ? 'bg-[#dc2626]/20 text-[#f87171]' : 'bg-[#16a34a]/15 text-[#4ade80]',
                      )}>
                        {low && <AlertTriangle size={12} />}
                        {low ? 'Baixo' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setMovement({ item, tipo: 'entrada', quantidade: '', fornecedor: item.fornecedorPrincipal || '', nf: '' })}
                          className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-[#f5f5f5]"
                          title="Registrar entrada ou saida"
                        >
                          <ArrowUpDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditItemForm(item)}
                          className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-[#f5f5f5]"
                          title="Editar item"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"
                          title="Excluir item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-[#a3a3a3]">Nenhum material encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {movement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#f5f5f5]">Movimentar estoque</h3>
                <p className="text-sm text-[#a3a3a3]">{movement.item.descricao}</p>
              </div>
              <button type="button" onClick={() => setMovement(null)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white" title="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3">
              <select value={movement.tipo} onChange={(event) => setMovement((formValue) => formValue ? { ...formValue, tipo: event.target.value as MovementType } : formValue)} className={inputClass}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
              </select>
              <input type="number" value={movement.quantidade} onChange={(event) => setMovement((formValue) => formValue ? { ...formValue, quantidade: event.target.value } : formValue)} placeholder="Quantidade" className={inputClass} />
              <input value={movement.fornecedor} onChange={(event) => setMovement((formValue) => formValue ? { ...formValue, fornecedor: event.target.value } : formValue)} placeholder="Fornecedor" className={inputClass} />
              <input value={movement.nf} onChange={(event) => setMovement((formValue) => formValue ? { ...formValue, nf: event.target.value } : formValue)} placeholder="NF / Documento" className={inputClass} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMovement(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#a3a3a3] hover:bg-[#3d3d3d]">Cancelar</button>
              <button type="button" onClick={handleMovementSave} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
                <ArrowDownToLine size={15} />
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
