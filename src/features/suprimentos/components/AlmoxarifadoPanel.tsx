import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpDown, Box, Filter, Package, Plus, Search, TrendingUp } from 'lucide-react'
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

const inputClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500'

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AlmoxarifadoPanel() {
  const {
    depositos,
    estoqueItens,
    addItemEstoque,
    addMovimentacao,
    consumirMaterial,
  } = useSuprimentosStore(
    useShallow((s) => ({
      depositos: s.depositos,
      estoqueItens: s.estoqueItens,
      addItemEstoque: s.addItemEstoque,
      addMovimentacao: s.addMovimentacao,
      consumirMaterial: s.consumirMaterial,
    }))
  )

  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [category, setCategory] = useState('Todas')
  const [depositoId, setDepositoId] = useState('todos')
  const [showNewItem, setShowNewItem] = useState(false)
  const [movement, setMovement] = useState<MovementForm | null>(null)
  const [newItem, setNewItem] = useState({
    depositoId: '',
    descricao: '',
    categoria: '',
    unidade: '',
    qtdDisponivel: '',
    estoqueMinimo: '',
    custoUnitario: '',
    fornecedorPrincipal: '',
  })

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

  function handleAddItem() {
    const depId = newItem.depositoId || depositos[0]?.id
    if (!depId || !newItem.descricao.trim() || !newItem.unidade.trim()) return

    addItemEstoque({
      depositoId: depId,
      descricao: newItem.descricao.trim(),
      unidade: newItem.unidade.trim(),
      qtdDisponivel: Number(newItem.qtdDisponivel) || 0,
      qtdReservada: 0,
      qtdTransito: 0,
      estoqueMinimo: Number(newItem.estoqueMinimo) || 0,
      custoUnitario: Number(newItem.custoUnitario) || 0,
      categoria: newItem.categoria.trim() || undefined,
      fornecedorPrincipal: newItem.fornecedorPrincipal.trim() || undefined,
    })
    setNewItem({
      depositoId: '',
      descricao: '',
      categoria: '',
      unidade: '',
      qtdDisponivel: '',
      estoqueMinimo: '',
      custoUnitario: '',
      fornecedorPrincipal: '',
    })
    setShowNewItem(false)
  }

  function handleMovementSave() {
    if (!movement) return
    const qty = Number(movement.quantidade)
    if (!Number.isFinite(qty) || qty <= 0) return

    if (movement.tipo === 'saida') {
      consumirMaterial(movement.item.id, qty, { observacoes: `Almoxarifado - NF: ${movement.nf || '-'}` })
    } else {
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
    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-5 text-slate-950">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Almoxarifado</h2>
          <p className="text-sm text-slate-500">Controle operacional de materiais em estoque.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewItem((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Novo Item
        </button>
      </div>

      <div className="mb-6 grid gap-5 md:grid-cols-4">
        {[
          { label: 'Total de Itens', value: estoqueItens.length, icon: Box, tone: 'text-slate-600' },
          { label: 'Estoque Baixo', value: lowItems.length, icon: AlertTriangle, tone: 'text-red-500' },
          { label: 'Valor Total', value: brl(totalValue), icon: TrendingUp, tone: 'text-slate-600' },
          { label: 'Categorias', value: activeCategories, icon: Package, tone: 'text-slate-600' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-950">{label}</span>
              <Icon size={18} className={tone} />
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', label === 'Estoque Baixo' && lowItems.length > 0 ? 'text-red-500' : 'text-slate-950')}>
              {value}
            </div>
            {label === 'Estoque Baixo' && <p className="mt-2 text-xs text-slate-500">Itens abaixo do estoque minimo</p>}
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[260px] flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, codigo ou fornecedor..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setLowOnly((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold',
              lowOnly ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-950 hover:bg-slate-50',
            )}
          >
            <AlertTriangle size={16} />
            Estoque Baixo
            <span className="ml-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs">{lowItems.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold',
              showFilters ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-950 hover:bg-slate-50',
            )}
          >
            <Filter size={16} />
            Filtros Avancados
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select value={depositoId} onChange={(event) => setDepositoId(event.target.value)} className={inputClass}>
              <option value="todos">Todos os nucleos</option>
              {depositos.map((dep) => <option key={dep.id} value={dep.id}>{dep.frente}</option>)}
            </select>
            <button
              type="button"
              onClick={() => { setSearch(''); setLowOnly(false); setCategory('Todas'); setDepositoId('todos') }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {showNewItem && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-950">Cadastrar material</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={newItem.depositoId} onChange={(event) => setNewItem((item) => ({ ...item, depositoId: event.target.value }))} className={inputClass}>
              <option value="">Nucleo</option>
              {depositos.map((dep) => <option key={dep.id} value={dep.id}>{dep.frente}</option>)}
            </select>
            <input value={newItem.descricao} onChange={(event) => setNewItem((item) => ({ ...item, descricao: event.target.value }))} placeholder="Material" className={inputClass} />
            <input value={newItem.categoria} onChange={(event) => setNewItem((item) => ({ ...item, categoria: event.target.value }))} placeholder="Categoria" className={inputClass} />
            <input value={newItem.unidade} onChange={(event) => setNewItem((item) => ({ ...item, unidade: event.target.value }))} placeholder="Unidade" className={inputClass} />
            <input type="number" value={newItem.qtdDisponivel} onChange={(event) => setNewItem((item) => ({ ...item, qtdDisponivel: event.target.value }))} placeholder="Quantidade" className={inputClass} />
            <input type="number" value={newItem.estoqueMinimo} onChange={(event) => setNewItem((item) => ({ ...item, estoqueMinimo: event.target.value }))} placeholder="Estoque minimo" className={inputClass} />
            <input type="number" value={newItem.custoUnitario} onChange={(event) => setNewItem((item) => ({ ...item, custoUnitario: event.target.value }))} placeholder="Valor unitario" className={inputClass} />
            <input value={newItem.fornecedorPrincipal} onChange={(event) => setNewItem((item) => ({ ...item, fornecedorPrincipal: event.target.value }))} placeholder="Fornecedor" className={inputClass} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowNewItem(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={handleAddItem} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Salvar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-slate-950">Materiais em Estoque</h3>
          <p className="text-sm text-slate-500">Gerencie os materiais disponiveis no almoxarifado</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                {['Codigo', 'Material', 'Categoria', 'Projeto', 'Quantidade', 'Estoque Minimo', 'O que Precisa Comprar', 'Unidade', 'Localizacao', 'Status', ''].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const deposito = depositos.find((dep) => dep.id === item.depositoId)
                const missing = Math.max(0, item.estoqueMinimo - item.qtdDisponivel)
                const low = missing > 0
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-mono text-xs text-slate-900">{item.id.slice(0, 4)}</td>
                    <td className="max-w-[180px] px-4 py-4 font-semibold text-slate-950">{item.descricao}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-900">
                        {item.categoria || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{deposito?.frente || '-'}</td>
                    <td className={cn('px-4 py-4 tabular-nums', low ? 'font-semibold text-red-500' : 'text-slate-900')}>{item.qtdDisponivel}</td>
                    <td className="px-4 py-4 tabular-nums text-slate-900">{item.estoqueMinimo}</td>
                    <td className={cn('px-4 py-4 tabular-nums', missing > 0 ? 'font-semibold text-red-500' : 'text-slate-500')}>{missing || '-'}</td>
                    <td className="px-4 py-4 text-slate-900">{item.unidade}</td>
                    <td className="px-4 py-4 text-slate-700">{deposito?.descricao || '-'}</td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white',
                        low ? 'bg-red-500' : 'bg-blue-500',
                      )}>
                        {low && <AlertTriangle size={12} />}
                        {low ? 'Baixo' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setMovement({ item, tipo: 'entrada', quantidade: '', fornecedor: item.fornecedorPrincipal || '', nf: '' })}
                        className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                        title="Registrar entrada ou saida"
                      >
                        <ArrowUpDown size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum material encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {movement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">Movimentar estoque</h3>
            <p className="mb-4 text-sm text-slate-500">{movement.item.descricao}</p>
            <div className="grid gap-3">
              <select value={movement.tipo} onChange={(event) => setMovement((form) => form ? { ...form, tipo: event.target.value as MovementType } : form)} className={inputClass}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
              </select>
              <input type="number" value={movement.quantidade} onChange={(event) => setMovement((form) => form ? { ...form, quantidade: event.target.value } : form)} placeholder="Quantidade" className={inputClass} />
              <input value={movement.fornecedor} onChange={(event) => setMovement((form) => form ? { ...form, fornecedor: event.target.value } : form)} placeholder="Fornecedor" className={inputClass} />
              <input value={movement.nf} onChange={(event) => setMovement((form) => form ? { ...form, nf: event.target.value } : form)} placeholder="NF / Documento" className={inputClass} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMovement(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={handleMovementSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
