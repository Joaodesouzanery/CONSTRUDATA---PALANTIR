import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpDown,
  Edit2,
  Filter,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  FileSpreadsheet,
  PackageMinus,
  ExternalLink,
  RotateCcw,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { ItemEstoque } from '@/types'
import { cn } from '@/lib/utils'
import { formatDecimalInput, formatMoneyInput, parseLocaleNumber } from '@/lib/numberFormat'
import { buildFrenteOptions, resolveFrenteDeposito } from '../utils/frentes'
import { ExcelImportModal } from './ExcelImportModal'
import { FichaRetiradaModal } from './FichaRetiradaModal'
import { importRollbackConflicts, loadEstoqueImportBatches, saveEstoqueImportBatches, type EstoqueImportBatch } from '../utils/importHistory'

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
  unidadeEmbalagem: string   // ex.: "caixa" (vazio = sem embalagem)
  qtdPorEmbalagem: string    // un por embalagem (ex.: 96)
  numEmbalagens: string      // nº de embalagens (ex.: 10)
  valorPorEmbalagem: string  // R$ por embalagem (ex.: 346,56)
  qtdDisponivel: string
  estoqueMinimo: string
  custoUnitario: string
  valorTotal: string
  fornecedorPrincipal: string
  codigoReferencia: string
  dataUltimoPedido: string   // yyyy-MM-dd (input date)
  // Duas colunas da planilha do almoxarifado. Entravam pelo import e não eram editáveis em
  // lugar nenhum — quem corrigisse um link errado teria de reimportar a planilha inteira.
  linkProduto: string
  realizarPedido: boolean
}


const inputClass = 'w-full rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60'

const emptyForm: ItemForm = {
  depositoId: '',
  descricao: '',
  categoria: '',
  unidade: '',
  unidadeEmbalagem: '',
  qtdPorEmbalagem: '',
  numEmbalagens: '',
  valorPorEmbalagem: '',
  qtdDisponivel: '',
  estoqueMinimo: '',
  custoUnitario: '',
  valorTotal: '',
  fornecedorPrincipal: '',
  codigoReferencia: '',
  dataUltimoPedido: '',
  linkProduto: '',
  realizarPedido: false,
}

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AlmoxarifadoPanel() {
  const {
    depositos,
    estoqueItens,
    addDeposito,
    addItemEstoque,
    updateItemEstoque,
    removeItemEstoque,
    entradaMaterial,
    removeMovimentacao,
    consumirMaterial,
    pendingSync,
    syncStatus,
    syncError,
  } = useSuprimentosStore(
    useShallow((s) => ({
      depositos: s.depositos,
      estoqueItens: s.estoqueItens,
      addDeposito: s.addDeposito,
      addItemEstoque: s.addItemEstoque,
      updateItemEstoque: s.updateItemEstoque,
      removeItemEstoque: s.removeItemEstoque,
      entradaMaterial: s.entradaMaterial,
      removeMovimentacao: s.removeMovimentacao,
      consumirMaterial: s.consumirMaterial,
      pendingSync: s.pendingSync,
      syncStatus: s.syncStatus,
      syncError: s.syncError,
    }))
  )

  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [groupBySupplier, setGroupBySupplier] = useState(false)
  const [category, setCategory] = useState('Todas')
  const [depositoId, setDepositoId] = useState('todos')
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [movement, setMovement] = useState<MovementForm | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [importBatches, setImportBatches] = useState<EstoqueImportBatch[]>([])
  // A ficha pode abrir vazia (pelo botão do topo) ou já com o item da linha — que é de onde faz
  // sentido: "dar baixa NESTE aqui". A prop `itemInicial` existia e nenhum chamador usava.
  const [retiradaOpen, setRetiradaOpen] = useState<boolean | ItemEstoque>(false)
  const itemFormRef = useRef<HTMLDivElement | null>(null)

  const refreshImportHistory = () => { void loadEstoqueImportBatches().then(setImportBatches) }
  useEffect(() => { refreshImportHistory() }, [])

  function undoImport(batch: EstoqueImportBatch) {
    const conflicts = importRollbackConflicts(batch, estoqueItens)
    const conflictText = conflicts.length ? `\n\n${conflicts.length} item(ns) sofreram edição posterior. Confirmar restaura o estado anterior desses itens também.` : ''
    if (!window.confirm(`Desfazer o lote “${batch.filename}” (${batch.changes.length} item(ns))?${conflictText}`)) return
    for (const change of batch.changes) {
      if (change.created) removeItemEstoque(change.itemId)
      else if (change.before) updateItemEstoque(change.itemId, change.before)
    }
    for (const movementId of batch.movementIds) removeMovimentacao(movementId)
    const next = importBatches.map((item) => item.id === batch.id ? { ...item, revertedAt: new Date().toISOString() } : item)
    setImportBatches(next)
    void saveEstoqueImportBatches(next)
  }

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(estoqueItens.map((item) => item.categoria || 'Sem categoria')))],
    [estoqueItens],
  )

  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)

  // Opções de frente/depósito (frentes criadas + obras da Torre) — util compartilhado.
  const frenteOptions = useMemo(() => buildFrenteOptions(depositos, sites), [depositos, sites])
  const resolveDeposito = (raw: string) => resolveFrenteDeposito(raw, depositos, sites, addDeposito)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return estoqueItens.filter((item) => {
      const deposito = depositos.find((dep) => dep.id === item.depositoId)
      const itemSite = item.siteId ?? deposito?.siteId ?? null
      // Estoque sem obra = geral (aparece em todas). Só esconde item de OUTRA obra.
      if (activeObraId && itemSite && itemSite !== activeObraId) return false
      const low = item.qtdDisponivel < item.estoqueMinimo
      const text = [
        item.id,
        item.codigoReferencia,
        item.descricao,
        item.categoria,
        item.fornecedorPrincipal,
        deposito?.frente,
        deposito?.descricao,
      ].join(' ').toLowerCase()

      if (q && !text.includes(q)) return false
      if (lowOnly && !low) return false
      if (category !== 'Todas' && (item.categoria || 'Sem categoria') !== category) return false
      if (depositoId !== 'todos') {
        if (depositoId.startsWith('site:')) {
          if (itemSite !== depositoId.slice(5)) return false
        } else if (item.depositoId !== depositoId) return false
      }
      return true
    })
  }, [category, depositoId, depositos, estoqueItens, lowOnly, search, activeObraId])

  const formQuantity = parseLocaleNumber(form.qtdDisponivel)
  const formUnitValue = parseLocaleNumber(form.custoUnitario)
  // Resultado RECONCILIADO — uma conta só: embalagem → unidades; e Valor total ÷ unidades → unitário.
  // (o unitário digitado tem prioridade; senão deriva do total). Tudo derivado dos mesmos números.
  const formPorEmb  = parseLocaleNumber(form.qtdPorEmbalagem)
  const formNumEmb  = parseLocaleNumber(form.numEmbalagens)
  const formUsaEmb  = formPorEmb > 0 && formNumEmb > 0
  const formQtdUn   = formUsaEmb ? formNumEmb * formPorEmb : formQuantity
  const formUnitCalc = formUnitValue > 0
    ? formUnitValue
    : (formQtdUn > 0 && parseLocaleNumber(form.valorTotal) > 0 ? parseLocaleNumber(form.valorTotal) / formQtdUn : 0)
  const formTotalCalc = parseLocaleNumber(form.valorTotal) || formQtdUn * formUnitCalc
  const formRPorEmb   = formPorEmb > 0 ? formUnitCalc * formPorEmb : 0
  const formTemResumo = formQtdUn > 0 || formTotalCalc > 0
  const estoquePendingSync = pendingSync.filter((op) => op.table.startsWith('suprimentos_'))
  const lowItems = estoqueItens.filter((item) => item.qtdDisponivel < item.estoqueMinimo)

  function openNewItemForm() {
    setEditingItemId(null)
    setForm({ ...emptyForm, depositoId: depositos[0]?.id ?? '' })
    setShowItemForm(true)
    window.setTimeout(() => itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function openEditItemForm(item: ItemEstoque) {
    setEditingItemId(item.id)
    const porEmb = item.qtdPorEmbalagem ?? 0
    setForm({
      depositoId: item.depositoId,
      descricao: item.descricao,
      categoria: item.categoria ?? '',
      unidade: item.unidade,
      unidadeEmbalagem: item.unidadeEmbalagem ?? '',
      qtdPorEmbalagem: porEmb > 0 ? String(porEmb) : '',
      numEmbalagens: porEmb > 0 ? formatDecimalInput(item.qtdDisponivel / porEmb, 6) : '',
      valorPorEmbalagem: porEmb > 0 ? formatMoneyInput((item.custoUnitario ?? 0) * porEmb) : '',
      qtdDisponivel: String(item.qtdDisponivel),
      estoqueMinimo: String(item.estoqueMinimo),
      custoUnitario: formatDecimalInput(item.custoUnitario ?? 0, 4),
      valorTotal: formatMoneyInput(item.qtdDisponivel * (item.custoUnitario ?? 0)),
      fornecedorPrincipal: item.fornecedorPrincipal ?? '',
      codigoReferencia: item.codigoReferencia ?? '',
      linkProduto: item.linkProduto ?? '',
      realizarPedido: item.realizarPedido ?? false,
      dataUltimoPedido: item.dataUltimoPedido ?? '',
    })
    setShowItemForm(true)
    window.setTimeout(() => itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function closeItemForm() {
    setShowItemForm(false)
    setEditingItemId(null)
    setForm(emptyForm)
  }

  function handleSaveItem() {
    if (!form.descricao.trim()) return
    const resolved = form.depositoId ? resolveDeposito(form.depositoId) : { id: '', siteId: null }
    const depId = resolved.id || depositos[0]?.id || 'dep-default'
    const existingItem = editingItemId ? estoqueItens.find((item) => item.id === editingItemId) : null

    const porEmb = parseLocaleNumber(form.qtdPorEmbalagem)
    const payload = {
      depositoId: depId,
      siteId: resolved.siteId ?? existingItem?.siteId ?? null,
      descricao: form.descricao.trim(),
      unidade: form.unidade.trim(),
      qtdDisponivel: totalUnOf(form),   // sempre a quantidade em unidades-base (com ou sem embalagem)
      qtdReservada: existingItem?.qtdReservada ?? 0,
      qtdTransito: existingItem?.qtdTransito ?? 0,
      estoqueMinimo: parseLocaleNumber(form.estoqueMinimo),
      custoUnitario: parseLocaleNumber(form.custoUnitario),
      categoria: form.categoria.trim() || undefined,
      fornecedorPrincipal: form.fornecedorPrincipal.trim() || undefined,
      qtdPorEmbalagem: porEmb > 0 ? porEmb : undefined,
      // Rótulo só com o substantivo (ex.: "caixa") — a contagem é calculada, não parte do rótulo.
      unidadeEmbalagem: form.unidadeEmbalagem.trim().replace(/^\s*[\d.,]+\s*/, '') || undefined,
      codigoReferencia: form.codigoReferencia.trim() || undefined,
      dataUltimoPedido: form.dataUltimoPedido || undefined,
      linkProduto: form.linkProduto.trim() || undefined,
      realizarPedido: form.realizarPedido || undefined,
    }

    if (editingItemId) {
      updateItemEstoque(editingItemId, payload)
    } else {
      addItemEstoque(payload)
    }
    closeItemForm()
  }

  // Total em unidades-base: com embalagem = nº × un/embalagem; senão a quantidade direta.
  function totalUnOf(f: ItemForm): number {
    const porEmb = parseLocaleNumber(f.qtdPorEmbalagem)
    const num = parseLocaleNumber(f.numEmbalagens)
    return porEmb > 0 && num > 0 ? num * porEmb : parseLocaleNumber(f.qtdDisponivel)
  }

  // Quantidade (un). Com embalagem, back-solve nº de embalagens; recalcula valor total.
  function updateQuantity(value: string) {
    setForm((item) => {
      const porEmb = parseLocaleNumber(item.qtdPorEmbalagem)
      const qty = parseLocaleNumber(value)
      const unit = parseLocaleNumber(item.custoUnitario)
      return {
        ...item,
        qtdDisponivel: value,
        numEmbalagens: porEmb > 0 ? (qty > 0 ? formatDecimalInput(qty / porEmb, 6) : '') : item.numEmbalagens,
        valorTotal: unit > 0 && qty > 0 ? formatMoneyInput(qty * unit) : item.valorTotal,
      }
    })
  }

  // Valor unitário (R$/un) = preço canônico → deriva total e valor por embalagem.
  function updateUnitValue(value: string) {
    setForm((item) => {
      const unit = parseLocaleNumber(value)
      const totalUn = totalUnOf(item)
      const porEmb = parseLocaleNumber(item.qtdPorEmbalagem)
      return {
        ...item,
        custoUnitario: value,
        valorTotal: unit > 0 && totalUn > 0 ? formatMoneyInput(totalUn * unit) : item.valorTotal,
        valorPorEmbalagem: porEmb > 0 && unit > 0 ? formatMoneyInput(unit * porEmb) : item.valorPorEmbalagem,
      }
    })
  }

  // Valor por embalagem (R$/caixa) → deriva unitário e total.
  function updatePackageValue(value: string) {
    setForm((item) => {
      const porEmb = parseLocaleNumber(item.qtdPorEmbalagem)
      const totalUn = totalUnOf(item)
      const unit = porEmb > 0 ? parseLocaleNumber(value) / porEmb : parseLocaleNumber(item.custoUnitario)
      return {
        ...item,
        valorPorEmbalagem: value,
        custoUnitario: unit > 0 ? formatDecimalInput(unit, 4) : item.custoUnitario,
        valorTotal: unit > 0 && totalUn > 0 ? formatMoneyInput(totalUn * unit) : item.valorTotal,
      }
    })
  }

  // Valor total → deriva unitário e valor por embalagem.
  function updateTotalValue(value: string) {
    setForm((item) => {
      const totalUn = totalUnOf(item)
      const total = parseLocaleNumber(value)
      const unit = totalUn > 0 ? total / totalUn : 0
      const porEmb = parseLocaleNumber(item.qtdPorEmbalagem)
      return {
        ...item,
        valorTotal: value,
        custoUnitario: totalUn > 0 ? formatDecimalInput(unit, 4) : item.custoUnitario,
        valorPorEmbalagem: porEmb > 0 && unit > 0 ? formatMoneyInput(unit * porEmb) : item.valorPorEmbalagem,
      }
    })
  }

  // nº de embalagens / un por embalagem / rótulo → recomputa quantidade (un) + valores.
  function recalcEmbalagem(next: Partial<ItemForm>) {
    setForm((item) => {
      const merged = { ...item, ...next }
      const porEmb = parseLocaleNumber(merged.qtdPorEmbalagem)
      const num = parseLocaleNumber(merged.numEmbalagens)
      const packaging = porEmb > 0 && num > 0
      const totalUn = packaging ? num * porEmb : parseLocaleNumber(merged.qtdDisponivel)
      let unit = parseLocaleNumber(merged.custoUnitario)
      // Sem unitário mas com valor total → deriva o unitário a partir do total.
      if (!(unit > 0) && parseLocaleNumber(merged.valorTotal) > 0 && totalUn > 0) {
        unit = parseLocaleNumber(merged.valorTotal) / totalUn
        merged.custoUnitario = formatDecimalInput(unit, 4)
      }
      return {
        ...merged,
        qtdDisponivel: packaging ? String(totalUn) : merged.qtdDisponivel,
        valorTotal: unit > 0 && totalUn > 0 ? formatMoneyInput(totalUn * unit) : merged.valorTotal,
        valorPorEmbalagem: porEmb > 0 && unit > 0 ? formatMoneyInput(unit * porEmb) : merged.valorPorEmbalagem,
      }
    })
  }

  function handleDeleteItem(item: ItemEstoque) {
    const ok = window.confirm(`Excluir "${item.descricao}" do almoxarifado?`)
    if (!ok) return
    removeItemEstoque(item.id)
  }

  function toggleItemSelection(id: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisibleSelection() {
    const visibleIds = filtered.map((item) => item.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedItemIds.has(id))
    setSelectedItemIds((current) => {
      const next = new Set(current)
      for (const id of visibleIds) allSelected ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    const selected = estoqueItens.filter((item) => selectedItemIds.has(item.id))
    if (selected.length === 0) return
    const nomes = selected.slice(0, 5).map((item) => item.descricao).join(', ')
    const resto = selected.length > 5 ? ` e mais ${selected.length - 5}` : ''
    if (!window.confirm(`Excluir ${selected.length} material(is)?\n\n${nomes}${resto}\n\nA exclusão poderá ser auditada e não remove o histórico físico.`)) return
    for (const item of selected) removeItemEstoque(item.id)
    setSelectedItemIds(new Set())
  }


  function handleMovementSave() {
    if (!movement) return
    const qty = parseLocaleNumber(movement.quantidade)
    if (!Number.isFinite(qty) || qty <= 0) return

    if (movement.tipo === 'saida') {
      consumirMaterial(movement.item.id, qty, { observacoes: `Almoxarifado - NF: ${movement.nf || '-'}` })
    } else {
      // A conta (saldo + histórico) e a data local vivem em `entradaMaterial`. Aqui a data saía de
      // `new Date().toISOString()`, que é UTC: depois das 21h a entrada nascia no dia seguinte.
      entradaMaterial(movement.item.id, qty, {
        depositoId: movement.item.depositoId,
        fornecedor: movement.fornecedor || undefined,
        nf: movement.nf || undefined,
      })
    }

    setMovement(null)
  }

  // Agrupamento por fornecedor (view) — subtotais + total geral, sem mexer no schema.
  const supplierGroups = useMemo(() => {
    const map = new Map<string, ItemEstoque[]>()
    for (const it of filtered) {
      const key = it.fornecedorPrincipal?.trim() || 'Sem fornecedor'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    return [...map.entries()]
      .map(([fornecedor, items]) => ({ fornecedor, items, subtotal: items.reduce((s, i) => s + i.qtdDisponivel * (i.custoUnitario ?? 0), 0) }))
      .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor))
  }, [filtered])
  const grandTotalFiltered = filtered.reduce((s, i) => s + i.qtdDisponivel * (i.custoUnitario ?? 0), 0)

  // "Usado" por item = Σ saídas (inclui baixas de RDO, que chegam como tipo='saida').
  // Chaveado por itemId (id único) → 0 quando não há saída.
  function itemRow(item: ItemEstoque) {
    const missing = Math.max(0, item.estoqueMinimo - item.qtdDisponivel)
    const low = missing > 0
    const emb = (item.qtdPorEmbalagem ?? 0) > 0
    // Rótulo da embalagem sem o número (o campo às vezes guarda "10 caixas"); a contagem já é calculada.
    const embLabel = (item.unidadeEmbalagem || 'emb.').replace(/^\s*[\d.,]+\s*/, '') || 'emb.'
    return (
      <tr key={item.id} className={cn('hover:bg-[#3d3d3d] align-top even:bg-[#2f2f2f]/70', selectedItemIds.has(item.id) && 'bg-[#f97316]/10')}>
        <td className="px-3 py-3">
          <input type="checkbox" aria-label={`Selecionar ${item.descricao}`} checked={selectedItemIds.has(item.id)} onChange={() => toggleItemSelection(item.id)} className="h-4 w-4 accent-[#f97316]" />
        </td>
        {/* Material — nome em destaque + código e categoria como subtexto */}
        <td className="px-3 py-3 min-w-[220px]">
          <div className="font-semibold text-[#f5f5f5] leading-snug">{item.descricao}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8a8a8a]">
            <span className="font-mono">{item.codigoReferencia || item.id.slice(0, 8)}</span>
            <span className="rounded-full border border-[#525252] px-1.5 py-0.5 text-[#a3a3a3]">{item.categoria || 'Sem categoria'}</span>
            {item.dataUltimoPedido && <span title="Data do último pedido">· últ. pedido {item.dataUltimoPedido.split('-').reverse().join('/')}</span>}
            {/* Duas colunas da planilha que entravam no banco e não apareciam em tela nenhuma.
                O link é o que resolve "onde eu compro isso mesmo?" na hora de repor. */}
            {item.realizarPedido && (
              <span className="rounded bg-[#f97316]/20 px-1.5 py-0.5 font-semibold text-[#fb923c]" title="Marcado na planilha como 'Realizar Pedido'">
                pedir
              </span>
            )}
            {item.linkProduto && (
              <a
                href={item.linkProduto}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 text-[#7dd3fc] underline-offset-2 hover:underline"
                title={item.linkProduto}
              >
                <ExternalLink size={9} /> link
              </a>
            )}
          </div>
        </td>
        {/* Qtd. — com unidade e equivalência em embalagem */}
        <td className={cn('px-3 py-3 text-right whitespace-nowrap tabular-nums', low ? 'font-semibold text-[#f87171]' : 'text-[#f5f5f5]')}>
          {item.qtdDisponivel}{item.unidade ? ` ${item.unidade}` : ''}
          {emb && (
            <span className="mt-0.5 block text-[10px] font-normal text-[#8a8a8a]">
              {Math.round((item.qtdDisponivel / item.qtdPorEmbalagem!) * 100) / 100} {embLabel} × {item.qtdPorEmbalagem}
            </span>
          )}
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-[#e5e5e5]">{item.fornecedorPrincipal || '—'}</td>
        <td className="px-3 py-3 whitespace-nowrap font-mono text-[#d4d4d4]">{item.codigoReferencia || '—'}</td>
        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-[#a3a3a3]">{item.estoqueMinimo || '—'}</td>
        <td className="px-3 py-3 whitespace-nowrap text-[#a3a3a3]">{item.dataUltimoPedido ? item.dataUltimoPedido.split('-').reverse().join('/') : '—'}</td>
        {/* Status (+ quanto comprar) */}
        <td className="px-3 py-3 whitespace-nowrap">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold', low ? 'bg-[#dc2626]/20 text-[#f87171]' : 'bg-[#16a34a]/15 text-[#4ade80]')}>
            {low && <AlertTriangle size={12} />}
            {low ? `Comprar ${missing}` : 'Normal'}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button type="button" onClick={() => setMovement({ item, tipo: 'entrada', quantidade: '', fornecedor: item.fornecedorPrincipal || '', nf: '' })} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-[#f5f5f5]" title="Registrar entrada ou saída">
              <ArrowUpDown size={16} /><span className="hidden text-[11px] font-semibold 2xl:inline">Mov.</span>
            </button>
            <button type="button" onClick={() => openEditItemForm(item)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-[#f5f5f5]" title="Editar item">
              <Edit2 size={16} /><span className="hidden text-[11px] font-semibold 2xl:inline">Editar</span>
            </button>
            <button type="button" onClick={() => handleDeleteItem(item)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]" title="Excluir item">
              <Trash2 size={16} /><span className="hidden text-[11px] font-semibold 2xl:inline">Excluir</span>
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#525252] bg-[#2f2f2f] p-5 text-[#f5f5f5]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#f5f5f5]">Almoxarifado</h2>
          <p className="text-sm text-[#a3a3a3]">Controle operacional de materiais, estoque mínimo e movimentações.</p>
        </div>
        {/* O import só era alcançável pelo botão "Importar Materiais" da barra de abas, que aparece
            em todas as outras abas junto e fica longe daqui — que é onde o almoxarife trabalha. */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
            title="Sobe a planilha atualizada e mostra o que mudou antes de gravar"
          >
            <FileSpreadsheet size={13} /> Importar planilha atualizada
          </button>
          <button
            onClick={() => setRetiradaOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c]"
          >
            <PackageMinus size={13} /> Registrar retirada
          </button>
          {importBatches.some((batch) => !batch.revertedAt) && (
            <button type="button" onClick={() => document.getElementById('historico-importacoes')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs font-medium text-[#a3a3a3] hover:text-white">
              <RotateCcw size={13} /> Histórico
            </button>
          )}
        </div>
      </div>

      {importBatches.length > 0 && (
        <section id="historico-importacoes" className="mb-5 rounded-xl border border-[#525252] bg-[#333333] p-3">
          <p className="text-xs font-semibold text-[#f5f5f5]">Histórico de importações</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {importBatches.slice(0, 5).map((batch) => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#2c2c2c] px-3 py-2 text-[11px] text-[#a3a3a3]">
              <span><b className="text-[#e5e5e5]">{batch.filename}</b> · {batch.changes.length} item(ns) · {new Date(batch.createdAt).toLocaleString('pt-BR')}</span>
              {batch.revertedAt ? <span className="text-[#6b6b6b]">Desfeito</span> : <button type="button" onClick={() => undoImport(batch)} className="inline-flex items-center gap-1 text-[#fbbf24] hover:text-white"><RotateCcw size={13} /> Desfazer lote</button>}
            </div>)}
          </div>
        </section>
      )}

      {(syncStatus === 'error' || estoquePendingSync.length > 0) && (
        <div className={cn(
          'mb-5 rounded-xl border px-4 py-3 text-sm',
          syncStatus === 'error' ? 'border-[#dc2626]/40 bg-[#dc2626]/10 text-[#fecaca]' : 'border-[#f97316]/40 bg-[#f97316]/10 text-[#fed7aa]',
        )}>
          <strong>{syncStatus === 'error' ? 'Sincronização pendente com erro.' : 'Sincronização em andamento.'}</strong>{' '}
          {syncStatus === 'error'
            ? (syncError ?? 'Alguma alteração ainda não foi confirmada no banco.')
            : `${estoquePendingSync.length} alteração(ões) aguardando confirmação do banco.`}
        </div>
      )}

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
          <button
            type="button"
            onClick={() => setGroupBySupplier((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors',
              groupBySupplier ? 'border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316]' : 'border-[#525252] bg-[#3d3d3d] text-[#e5e5e5] hover:bg-[#484848]',
            )}
            title="Agrupar por fornecedor com subtotais e total geral"
          >
            <Package size={16} />
            Por fornecedor
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-[#525252] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select value={depositoId} onChange={(event) => setDepositoId(event.target.value)} className={inputClass}>
              <option value="todos">Todas as frentes / obras</option>
              {frenteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        <div ref={itemFormRef} className="mb-5 rounded-xl border border-[#525252] bg-[#333333] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#f5f5f5]">{editingItemId ? 'Editar material em estoque' : 'Cadastrar material em estoque'}</h3>
              {editingItemId && <p className="mt-1 text-xs text-[#fdba74]">Você está alterando um item existente. Salve para atualizar o almoxarifado.</p>}
            </div>
            <button type="button" onClick={closeItemForm} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white" title="Fechar">
              <X size={16} />
            </button>
          </div>
          {/* Frente / Depósito — onde o material fica (inclui as obras da Torre de Controle) */}
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9a9a9a]">Frente / Depósito</span>
            <select value={form.depositoId} onChange={(event) => setForm((item) => ({ ...item, depositoId: event.target.value }))} className={inputClass}>
              <option value="">Estoque geral (sem frente específica)</option>
              {frenteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-4">
            <input value={form.descricao} onChange={(event) => setForm((item) => ({ ...item, descricao: event.target.value }))} placeholder="Material" className={inputClass} />
            <input value={form.categoria} onChange={(event) => setForm((item) => ({ ...item, categoria: event.target.value }))} placeholder="Categoria" className={inputClass} />
            <input value={form.unidade} onChange={(event) => setForm((item) => ({ ...item, unidade: event.target.value }))} placeholder="Unidade (opcional)" className={inputClass} />
            <input type="text" inputMode="decimal" value={form.qtdDisponivel} onChange={(event) => updateQuantity(event.target.value)} placeholder="Quantidade" className={inputClass} />
            <input type="text" inputMode="decimal" value={form.estoqueMinimo} onChange={(event) => setForm((item) => ({ ...item, estoqueMinimo: event.target.value }))} placeholder="Estoque mínimo" className={inputClass} />
            <input type="text" inputMode="decimal" value={form.custoUnitario} onChange={(event) => updateUnitValue(event.target.value)} placeholder="Valor unitário" className={inputClass} />
            <input type="text" inputMode="decimal" value={form.valorTotal} onChange={(event) => updateTotalValue(event.target.value)} placeholder="Valor total (R$ da nota)" className={inputClass} />
            <input value={form.fornecedorPrincipal} onChange={(event) => setForm((item) => ({ ...item, fornecedorPrincipal: event.target.value }))} placeholder="Fornecedor" className={inputClass} />
            <input value={form.codigoReferencia} onChange={(event) => setForm((item) => ({ ...item, codigoReferencia: event.target.value }))} placeholder="Código (referência)" className={inputClass} />
            <input value={form.linkProduto} onChange={(event) => setForm((item) => ({ ...item, linkProduto: event.target.value }))} placeholder="Link do produto (onde comprar)" className={inputClass} />
            <label className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm text-[#f5f5f5]">
              <input
                type="checkbox"
                checked={form.realizarPedido}
                onChange={(event) => setForm((item) => ({ ...item, realizarPedido: event.target.checked }))}
                className="h-4 w-4 accent-[#f97316]"
              />
              Realizar pedido
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 text-xs text-[#6b6b6b]">
              <span className="whitespace-nowrap">Últ. pedido</span>
              <input type="date" value={form.dataUltimoPedido} onChange={(event) => setForm((item) => ({ ...item, dataUltimoPedido: event.target.value }))} className="flex-1 bg-transparent py-2 text-sm text-[#f5f5f5] outline-none" />
            </label>
          </div>

          {/* Embalagem (facilitador) — nº de embalagens × un/embalagem = quantidade em unidades */}
          <div className="mt-3 rounded-lg border border-[#525252] bg-[#2f2f2f] p-3">
            <p className="mb-2 text-xs font-semibold text-[#e5e5e5]">Embalagem <span className="font-normal text-[#a3a3a3]">(opcional — ex.: 10 caixas × 96 un = 960 un.)</span></p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input value={form.unidadeEmbalagem} onChange={(event) => recalcEmbalagem({ unidadeEmbalagem: event.target.value })} placeholder="Embalagem (ex.: caixa)" className={inputClass} />
              <input type="text" inputMode="decimal" value={form.qtdPorEmbalagem} onChange={(event) => recalcEmbalagem({ qtdPorEmbalagem: event.target.value })} placeholder="Un por embalagem (ex.: 96)" className={inputClass} />
              <input type="text" inputMode="decimal" value={form.numEmbalagens} onChange={(event) => recalcEmbalagem({ numEmbalagens: event.target.value })} placeholder="Nº de embalagens (ex.: 10)" className={inputClass} />
              <input type="text" inputMode="decimal" value={form.valorPorEmbalagem} onChange={(event) => updatePackageValue(event.target.value)} placeholder="Valor por embalagem (R$)" className={inputClass} />
            </div>
          </div>

          {/* Resultado RECONCILIADO — uma conta só, o que o fornecedor manda vira estoque + custo. */}
          <div className="mt-3 rounded-lg border border-[#f97316]/30 bg-[#f97316]/10 px-3 py-2.5">
            {formTemResumo ? (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                <span className="text-[#a3a3a3]">Resultado:</span>
                <span><strong className="text-sm text-[#f5f5f5]">{formQtdUn.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong> <span className="text-[#a3a3a3]">un em estoque</span></span>
                <span><strong className="text-sm text-[#f5f5f5]">{brl(formUnitCalc)}</strong> <span className="text-[#a3a3a3]">/ un</span></span>
                <span><span className="text-[#a3a3a3]">Total</span> <strong className="text-sm text-[#22c55e]">{brl(formTotalCalc)}</strong></span>
                {formUsaEmb && (
                  <span className="text-[#a3a3a3]">
                    ({formNumEmb.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {form.unidadeEmbalagem.trim() || 'emb.'} × {formPorEmb.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un · {brl(formRPorEmb)}/{form.unidadeEmbalagem.trim() || 'emb.'})
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#a3a3a3]">Preencha a <strong className="text-[#e5e5e5]">quantidade</strong> (ou a embalagem) e o <strong className="text-[#e5e5e5]">Valor total</strong> da nota — o valor unitário e o R$/embalagem saem sozinhos.</p>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#6b6b6b]">
              Igual o fornecedor manda: <span className="text-[#a3a3a3]">“10 caixas (960 un.) = R$&nbsp;3.465,60”</span> → Embalagem <strong className="text-[#a3a3a3]">caixa · 96 · 10</strong> + Valor total <strong className="text-[#a3a3a3]">3.465,60</strong>.
              Item simples <span className="text-[#a3a3a3]">“8 galochas = R$&nbsp;317,84”</span> → Quantidade <strong className="text-[#a3a3a3]">8</strong> + Valor total <strong className="text-[#a3a3a3]">317,84</strong>.
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeItemForm} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#a3a3a3] hover:bg-[#3d3d3d]">Cancelar</button>
            <button type="button" onClick={handleSaveItem} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
              <Save size={15} />
              {editingItemId ? 'Salvar alterações' : 'Salvar material'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
          <h3 className="text-lg font-bold text-[#f5f5f5]">Materiais em Estoque</h3>
          <p className="text-sm text-[#a3a3a3]">Gerencie materiais disponíveis, faltantes e movimentações do almoxarifado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedItemIds.size > 0 && <button type="button" onClick={handleBulkDelete} className="inline-flex items-center gap-2 rounded-lg border border-[#dc2626]/50 px-4 py-2 text-sm font-semibold text-[#f87171] hover:bg-[#dc2626]/15"><Trash2 size={16} /> Excluir {selectedItemIds.size}</button>}
            <button type="button" onClick={openNewItemForm} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"><Plus size={16} /> Adicionar Material</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs xl:text-sm min-w-[980px]">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-[#525252] bg-[#3d3d3d] text-left text-[#a3a3a3]">
                <th className="px-3 py-3"><input type="checkbox" aria-label="Selecionar todos os materiais filtrados" checked={filtered.length > 0 && filtered.every((item) => selectedItemIds.has(item.id))} onChange={toggleVisibleSelection} className="h-4 w-4 accent-[#f97316]" /></th>
                {[['Produto', 'w-auto'], ['Quantidade', 'text-right'], ['Fornecedor', ''], ['Código', ''], ['Crítico', 'text-right'], ['Último pedido', ''], ['Status', ''], ['Ações', 'text-right']].map(([head, cls]) => (
                  <th key={head} className={cn('px-3 py-3 font-semibold whitespace-nowrap', cls)}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {groupBySupplier ? (
                <>
                  {supplierGroups.map((g) => (
                    <Fragment key={g.fornecedor}>
                      <tr className="bg-[#2b2c6b]/30 border-b border-[#525252]">
                        <td colSpan={7} className="px-3 py-2 font-bold text-[#f5f5f5]">{g.fornecedor} <span className="text-[10px] font-normal text-[#a3a3a3]">({g.items.length} item{g.items.length !== 1 ? 's' : ''})</span></td>
                        <td colSpan={2} className="px-3 py-2 text-right font-bold text-[#f59e0b]">{brl(g.subtotal)}</td>
                      </tr>
                      {g.items.map(itemRow)}
                    </Fragment>
                  ))}
                  <tr className="border-t-2 border-[#f97316] bg-[#2c2c2c]">
                    <td colSpan={7} className="px-3 py-2 font-bold text-[#f59e0b]">TOTAL GERAL</td>
                    <td colSpan={2} className="px-3 py-2 text-right font-bold text-[#f59e0b]">{brl(grandTotalFiltered)}</td>
                  </tr>
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#a3a3a3]">Nenhum material encontrado.</td></tr>
                  )}
                </>
              ) : (
                <>
                  {filtered.map(itemRow)}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#a3a3a3]">Nenhum material encontrado.</td></tr>
                  )}
                </>
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
                <option value="saida">Saída</option>
              </select>
              <input type="text" inputMode="decimal" value={movement.quantidade} onChange={(event) => setMovement((formValue) => formValue ? { ...formValue, quantidade: event.target.value } : formValue)} placeholder="Quantidade" className={inputClass} />
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

      {importOpen && <ExcelImportModal onClose={() => setImportOpen(false)} onImported={refreshImportHistory} />}
      {retiradaOpen && (
        <FichaRetiradaModal
          itemInicial={typeof retiradaOpen === 'object' ? retiradaOpen : undefined}
          onClose={() => setRetiradaOpen(false)}
        />
      )}
    </div>
  )
}
