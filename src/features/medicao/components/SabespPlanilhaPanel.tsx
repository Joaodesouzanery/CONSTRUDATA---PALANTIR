/**
 * SabespPlanilhaPanel — Step 1: Planilha de Medição Sabesp.
 *
 * Allows entering/editing contract items (itens de contrato) for the
 * active boletim. Groups items by 01/02/03 (Canteiros, Esgoto, Água).
 */
import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import { CRITERIOS_MEDICAO } from '../data/criterios'
import type { ItemContrato } from '@/store/medicaoBillingStore'

const GRUPOS = [
  { id: '01', nome: 'Canteiros e Planos' },
  { id: '02', nome: 'Esgoto' },
  { id: '03', nome: 'Água' },
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AddItemFormProps {
  onAdd: (item: Omit<ItemContrato, 'id'>) => void
}

function AddItemForm({ onAdd }: AddItemFormProps) {
  const [open, setOpen] = useState(false)
  const [nPreco, setNPreco]               = useState('')
  const [descricao, setDescricao]         = useState('')
  const [unidade, setUnidade]             = useState('M')
  const [grupo, setGrupo]                 = useState<'01'|'02'|'03'>('02')
  const [qtdContrato, setQtdContrato]     = useState('')
  const [qtdMedida, setQtdMedida]         = useState('')
  const [valorUnitario, setValorUnitario] = useState('')

  // Auto-fill from criterios catalog
  function handleNPrecoChange(val: string) {
    setNPreco(val)
    const crit = CRITERIOS_MEDICAO.find((c) => c.nPreco === val.trim())
    if (crit) {
      setDescricao(crit.descricao)
      setUnidade(crit.unidade)
      setGrupo(crit.grupo)
    }
  }

  function handleAdd() {
    if (!nPreco.trim() || !descricao.trim()) return
    onAdd({
      nPreco:        nPreco.trim(),
      descricao:     descricao.trim(),
      unidade:       unidade.trim() || 'M',
      grupo,
      qtdContrato:   parseFloat(qtdContrato) || 0,
      qtdMedida:     parseFloat(qtdMedida)   || 0,
      valorUnitario: parseFloat(valorUnitario.replace(',', '.')) || 0,
    })
    setNPreco(''); setDescricao(''); setUnidade('M'); setGrupo('02')
    setQtdContrato(''); setQtdMedida(''); setValorUnitario('')
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
        <div className="p-4 border-t border-[#525252] grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#1f1f1f]">
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
          <div className="col-span-2 sm:col-span-3 flex justify-end gap-2 mt-1">
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

export function SabespPlanilhaPanel() {
  const { getActiveBoletim, addItemContrato, updateItemContrato, removeItemContrato } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

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

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Planilha de Medição Sabesp</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Contrato {boletim.contrato} · {boletim.consorcio} · Período: {boletim.periodo}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#a3a3a3] uppercase">Total período</div>
          <div className="text-[#f97316] font-bold text-lg">
            R$ {fmt(boletim.itensContrato.reduce((s, i) => s + i.qtdMedida * i.valorUnitario, 0))}
          </div>
        </div>
      </div>

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
                    <tr className="bg-[#1f1f1f] text-[#a3a3a3] text-[10px] uppercase">
                      <th className="px-3 py-2 text-left border-r border-[#525252] w-24">Nº Preço</th>
                      <th className="px-3 py-2 text-left border-r border-[#525252]">Descrição</th>
                      <th className="px-3 py-2 text-center border-r border-[#525252] w-16">Un</th>
                      <th className="px-3 py-2 text-right border-r border-[#525252] w-28">Qtd Contrato</th>
                      <th className="px-3 py-2 text-right border-r border-[#525252] w-28">Qtd Medida</th>
                      <th className="px-3 py-2 text-right border-r border-[#525252] w-32">Vl. Unitário</th>
                      <th className="px-3 py-2 text-right border-r border-[#525252] w-36">Vl. Período</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-5 text-center text-xs text-[#6b6b6b] italic border-b border-[#525252]">
                          Nenhum item neste grupo. Adicione abaixo.
                        </td>
                      </tr>
                    ) : items.map((item) => (
                      <tr key={item.id} className="border-b border-[#525252] hover:bg-[#333]">
                        <td className="px-3 py-2 border-r border-[#525252] font-mono text-[#f97316] text-xs">{item.nPreco}</td>
                        <td className="px-3 py-2 border-r border-[#525252] text-[#f5f5f5]">{item.descricao}</td>
                        <td className="px-3 py-2 border-r border-[#525252] text-center text-[#a3a3a3]">{item.unidade}</td>
                        <td className="px-3 py-1 border-r border-[#525252] text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.qtdContrato}
                            onChange={(e) => updateItemContrato(item.id, { qtdContrato: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent text-right text-[#f5f5f5] focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1 border-r border-[#525252] text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.qtdMedida}
                            onChange={(e) => updateItemContrato(item.id, { qtdMedida: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent text-right text-[#f5f5f5] focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1 border-r border-[#525252] text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.valorUnitario}
                            onChange={(e) => updateItemContrato(item.id, { valorUnitario: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent text-right text-[#f5f5f5] focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 border-r border-[#525252] text-right font-medium text-emerald-400">
                          R$ {fmt(item.qtdMedida * item.valorUnitario)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemContrato(item.id)}
                            className="text-red-400 hover:bg-red-900/20 rounded p-1 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#1f1f1f]">
                        <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-[#a3a3a3] border-r border-[#525252]">
                          Subtotal {grupo.nome}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#f97316] border-r border-[#525252]">
                          R$ {fmt(subtotal)}
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
