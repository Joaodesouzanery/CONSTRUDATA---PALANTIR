/**
 * MateriaisPendentesPanel — Materiais Pendentes from Planilhas Consolidadas.
 * Accordion by Núcleo > Rua with material tables and totals.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Package, ShoppingCart, Upload } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { MaterialNucleo, MaterialRua } from '@/data/mockPlanilhasConsolidadas'
import { cn } from '@/lib/utils'

function RuaAccordion({
  rua,
  isOpen,
  onToggle,
  selected,
  onSelect,
}: {
  rua: MaterialRua
  isOpen: boolean
  onToggle: () => void
  selected: Set<string>
  onSelect: (id: string, checked: boolean) => void
}) {
  const totalQtd = rua.items.reduce((s, i) => s + i.qtd, 0)
  return (
    <div className="border-t border-[#525252]/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-6 py-2 text-xs hover:bg-[#484848]/30 transition-colors"
      >
        {isOpen ? <ChevronDown size={12} className="text-[#6b6b6b]" /> : <ChevronRight size={12} className="text-[#6b6b6b]" />}
        <span className="text-[#a3a3a3] font-medium">{rua.rua}</span>
        <span className="text-[#6b6b6b] ml-auto tabular-nums">{rua.items.length} itens — {totalQtd.toLocaleString('pt-BR')} un total</span>
      </button>
      {isOpen && (
        <div className="px-6 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b]">
                <th className="text-left py-1 pr-2 font-medium">Material</th>
                <th className="text-center py-1 px-2 font-medium w-8"></th>
                <th className="text-center py-1 px-2 font-medium w-12">UN</th>
                <th className="text-center py-1 px-2 font-medium w-12">Rede</th>
                <th className="text-right py-1 px-2 font-medium w-16">QTD</th>
                <th className="text-right py-1 pl-2 font-medium w-20">Metragem</th>
              </tr>
            </thead>
            <tbody>
              {rua.items.map((item, idx) => (
                <tr key={idx} className="border-t border-[#525252]/20 hover:bg-[#484848]/20 transition-colors">
                  <td className={cn('py-1.5 pr-2 text-[#f5f5f5]', item.isSubItem && 'pl-4 text-[#a3a3a3]')}>{item.material}</td>
                  <td className="py-1.5 px-2 text-center">
                    {item.id && !item.isSubItem && (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={(e) => onSelect(item.id!, e.target.checked)}
                        className="accent-[#f97316]"
                      />
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center text-[#a3a3a3]">{item.un}</td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={cn(
                      'px-1 py-0.5 rounded text-[10px] font-bold',
                      item.rede === 'ESG' ? 'bg-[#a855f7]/20 text-[#c084fc]' : 'bg-[#3b82f6]/20 text-[#60a5fa]',
                    )}>
                      {item.rede}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-[#f5f5f5] tabular-nums font-medium">{item.qtd.toLocaleString('pt-BR')}</td>
                  <td className="py-1.5 pl-2 text-right text-[#a3a3a3] tabular-nums">{item.metragem ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NucleoAccordion({
  nucleo,
  selected,
  onSelect,
}: {
  nucleo: MaterialNucleo
  selected: Set<string>
  onSelect: (id: string, checked: boolean) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [openRuas, setOpenRuas] = useState<Set<string>>(new Set())

  const totalItems = nucleo.ruas.reduce((s, r) => s + r.items.length, 0)
  const totalQtd = nucleo.ruas.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.qtd, 0), 0)

  const toggleRua = (rua: string) => {
    setOpenRuas((prev) => {
      const next = new Set(prev)
      if (next.has(rua)) next.delete(rua)
      else next.add(rua)
      return next
    })
  }

  return (
    <div className="border border-[#525252] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#3d3d3d] hover:bg-[#484848] transition-colors"
      >
        {isOpen ? <ChevronDown size={14} className="text-[#f97316]" /> : <ChevronRight size={14} className="text-[#6b6b6b]" />}
        <Package size={14} className="text-[#f97316]" />
        <span className="text-sm font-semibold text-[#f5f5f5]">{nucleo.nucleo}</span>
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span className="text-[#a3a3a3]">{nucleo.ruas.length} rua{nucleo.ruas.length > 1 ? 's' : ''}</span>
          <span className="text-[#6b6b6b]">|</span>
          <span className="text-[#a3a3a3]">{totalItems} materiais</span>
          <span className="text-[#6b6b6b]">|</span>
          <span className="text-[#fbbf24] font-semibold tabular-nums">{totalQtd.toLocaleString('pt-BR')} un</span>
        </div>
      </button>
      {isOpen && (
        <div className="bg-[#2d2d2d]">
          {nucleo.ruas.map((rua) => (
            <RuaAccordion
              key={rua.rua}
              rua={rua}
              isOpen={openRuas.has(rua.rua)}
              onToggle={() => toggleRua(rua.rua)}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MateriaisPendentesPanel() {
  const {
    materiaisPendentes,
    ordens,
    createOrdemSuprimentos,
  } = useSuprimentosStore((s) => ({
    materiaisPendentes: s.planilhaMateriais,
    ordens: s.planilhaOrdens,
    createOrdemSuprimentos: s.createOrdemSuprimentos,
  }))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (materiaisPendentes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
        <div className="w-14 h-14 rounded-2xl bg-[#3d3d3d] border border-[#525252] flex items-center justify-center">
          <Upload size={24} className="text-[#6b6b6b]" />
        </div>
        <p className="text-[#6b6b6b] text-sm font-medium">Nenhum dado de Materiais importado</p>
        <p className="text-[#525252] text-xs">Use o botão "Importar Planilha" acima para carregar a planilha de Materiais Pendentes.</p>
      </div>
    )
  }

  const totalNucleos = materiaisPendentes.length
  const totalItens = materiaisPendentes.reduce(
    (s, n) => s + n.ruas.reduce((ss, r) => ss + r.items.length, 0), 0,
  )
  const totalQtd = materiaisPendentes.reduce(
    (s, n) => s + n.ruas.reduce((ss, r) => ss + r.items.reduce((sss, i) => sss + i.qtd, 0), 0), 0,
  )

  function toggleItem(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleGerarOrdem() {
    setSaving(true)
    setError(null)
    try {
      await createOrdemSuprimentos([...selected])
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar ordem de compra.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 overflow-auto flex-1">
      {/* Summary */}
      <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-[#3d3d3d] border border-[#525252] text-xs shrink-0">
        <span className="text-[#a3a3a3]">
          <span className="font-semibold text-[#f5f5f5]">{totalNucleos}</span> núcleos
        </span>
        <span className="text-[#6b6b6b]">|</span>
        <span className="text-[#a3a3a3]">
          <span className="font-semibold text-[#f5f5f5]">{totalItens}</span> itens de material
        </span>
        <span className="text-[#6b6b6b]">|</span>
        <span className="text-[#a3a3a3]">
          Total: <span className="font-semibold text-[#fbbf24]">{totalQtd.toLocaleString('pt-BR')}</span> unidades
        </span>
        <button
          onClick={handleGerarOrdem}
          disabled={selected.size === 0 || saving}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart size={13} />
          {saving ? 'Gerando...' : `Gerar Ordem (${selected.size})`}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Accordion list */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3 overflow-hidden flex-1">
      <div className="flex flex-col gap-2 overflow-auto">
        {materiaisPendentes.map((nucleo) => (
          <NucleoAccordion key={nucleo.nucleo} nucleo={nucleo} selected={selected} onSelect={toggleItem} />
        ))}
      </div>
      <aside className="border border-[#525252] rounded-xl bg-[#2f2f2f] overflow-hidden min-h-0">
        <div className="px-4 py-3 bg-[#3d3d3d] border-b border-[#525252]">
          <p className="text-sm font-semibold text-[#f5f5f5]">Historico de ordens</p>
          <p className="text-[11px] text-[#a3a3a3]">{ordens.length} geradas</p>
        </div>
        <div className="overflow-auto max-h-full">
          {ordens.map((ordem) => (
            <div key={ordem.id} className="px-4 py-3 border-b border-[#525252]/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#f5f5f5] font-semibold">{ordem.codigo}</p>
                <span className="text-[10px] text-[#4ade80] bg-[#16a34a]/10 px-1.5 py-0.5 rounded">{ordem.status}</span>
              </div>
              <p className="text-[11px] text-[#a3a3a3] mt-1">{ordem.totalItens} itens</p>
              <p className="text-[10px] text-[#6b6b6b]">{new Date(ordem.createdAt).toLocaleString('pt-BR')}</p>
            </div>
          ))}
          {ordens.length === 0 && (
            <div className="p-5 text-center text-xs text-[#6b6b6b]">Nenhuma ordem gerada ainda.</div>
          )}
        </div>
      </aside>
      </div>
    </div>
  )
}
