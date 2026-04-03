/**
 * FluxoProducaoPanel — Intelligent production flow dashboard with 5 methodologies:
 * ABC-XYZ, Kanban, Slotting Dinâmico, FEFO, Kits JIT
 */
import { useState, useMemo, useEffect } from 'react'
import {
  RefreshCw, BarChart3, Columns3, MapPin, Clock, Package,
  AlertTriangle, ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { cn } from '@/lib/utils'
import type {
  ClassificacaoABCXYZ, KanbanCard, SlottingSugestao, AlertaFEFO, KitAtividade,
} from '@/types'

type SubTab = 'abcxyz' | 'kanban' | 'slotting' | 'fefo' | 'kits'

const SUB_TABS: { key: SubTab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'abcxyz',  label: 'Curva ABC-XYZ',     icon: BarChart3 },
  { key: 'kanban',  label: 'Kanban',             icon: Columns3 },
  { key: 'slotting', label: 'Slotting Dinâmico', icon: MapPin },
  { key: 'fefo',    label: 'FEFO',               icon: Clock },
  { key: 'kits',    label: 'Kits JIT',           icon: Package },
]

// ── KPI Card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className={cn('border rounded-xl p-3 flex flex-col gap-0.5', bg)}>
      <p className="text-[#a3a3a3] text-[10px]">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
    </div>
  )
}

// ── ABC-XYZ Matrix ────────────────────────────────────────────────────────────

function ABCXYZPanel({ data }: { data: ClassificacaoABCXYZ[] }) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  const matrix = useMemo(() => {
    const m: Record<string, ClassificacaoABCXYZ[]> = {}
    for (const abc of ['A', 'B', 'C']) {
      for (const xyz of ['X', 'Y', 'Z']) {
        m[`${abc}${xyz}`] = data.filter(d => d.classeABC === abc && d.classeXYZ === xyz)
      }
    }
    return m
  }, [data])

  const filtered = selectedCell ? (matrix[selectedCell] ?? []) : data
  const totalValor = data.reduce((s, d) => s + d.valorConsumo, 0)
  const pctA = data.length > 0 ? ((data.filter(d => d.classeABC === 'A').length / data.length) * 100).toFixed(0) : '0'
  const valorA = data.filter(d => d.classeABC === 'A').reduce((s, d) => s + d.valorConsumo, 0)
  const pctValorA = totalValor > 0 ? ((valorA / totalValor) * 100).toFixed(0) : '0'

  const cellColors: Record<string, string> = {
    AX: 'bg-emerald-600/30 border-emerald-500/50 hover:bg-emerald-600/40',
    AY: 'bg-emerald-600/20 border-emerald-500/40 hover:bg-emerald-600/30',
    AZ: 'bg-yellow-600/20 border-yellow-500/40 hover:bg-yellow-600/30',
    BX: 'bg-emerald-600/15 border-emerald-500/30 hover:bg-emerald-600/25',
    BY: 'bg-yellow-600/15 border-yellow-500/30 hover:bg-yellow-600/25',
    BZ: 'bg-orange-600/15 border-orange-500/30 hover:bg-orange-600/25',
    CX: 'bg-yellow-600/10 border-yellow-500/20 hover:bg-yellow-600/20',
    CY: 'bg-orange-600/10 border-orange-500/20 hover:bg-orange-600/20',
    CZ: 'bg-neutral-600/20 border-neutral-500/30 hover:bg-neutral-600/30',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Itens Classificados" value={data.length} color="text-[#f5f5f5]" bg="bg-[#3d3d3d] border-[#525252]" />
        <Kpi label="% Itens Classe A" value={`${pctA}%`} color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/30" />
        <Kpi label="% Valor em A" value={`${pctValorA}%`} color="text-sky-400" bg="bg-sky-500/10 border-sky-500/30" />
        <Kpi label="Itens AX (Prioridade)" value={matrix['AX']?.length ?? 0} color="text-[#f97316]" bg="bg-orange-500/10 border-orange-500/30" />
      </div>

      {/* Matrix 3x3 */}
      <div className="flex gap-4">
        <div className="shrink-0">
          <p className="text-[#a3a3a3] text-[10px] mb-2 text-center">Valor (ABC) × Variabilidade (XYZ)</p>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            <div />
            {['X', 'Y', 'Z'].map(x => <div key={x} className="text-[#a3a3a3] font-semibold py-1">{x}</div>)}
            {['A', 'B', 'C'].map(abc => (
              <>
                <div key={`l-${abc}`} className="text-[#a3a3a3] font-semibold flex items-center justify-center">{abc}</div>
                {['X', 'Y', 'Z'].map(xyz => {
                  const k = `${abc}${xyz}`
                  const items = matrix[k] ?? []
                  const val = items.reduce((s, d) => s + d.valorConsumo, 0)
                  return (
                    <button
                      key={k}
                      onClick={() => setSelectedCell(selectedCell === k ? null : k)}
                      className={cn(
                        'border rounded-lg p-2 cursor-pointer transition-all min-w-[80px]',
                        cellColors[k],
                        selectedCell === k && 'ring-2 ring-[#f97316]',
                      )}
                    >
                      <p className="text-[#f5f5f5] font-bold">{items.length}</p>
                      <p className="text-[#a3a3a3] text-[9px]">R$ {(val / 1000).toFixed(0)}k</p>
                    </button>
                  )
                })}
              </>
            ))}
          </div>
          <div className="mt-2 text-[9px] text-[#6b6b6b] space-y-0.5">
            <p><span className="inline-block w-2 h-2 rounded bg-emerald-500 mr-1" /> Frente do almoxarifado</p>
            <p><span className="inline-block w-2 h-2 rounded bg-yellow-500 mr-1" /> Posição intermediária</p>
            <p><span className="inline-block w-2 h-2 rounded bg-neutral-500 mr-1" /> Fundo / Área remota</p>
          </div>
        </div>

        {/* Items table */}
        <div className="flex-1 overflow-auto max-h-[300px] border border-[#525252] rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#3d3d3d] z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[#a3a3a3]">Descrição</th>
                <th className="px-2 py-2 text-center text-[#a3a3a3]">ABC</th>
                <th className="px-2 py-2 text-center text-[#a3a3a3]">XYZ</th>
                <th className="px-3 py-2 text-right text-[#a3a3a3]">Valor Consumo</th>
                <th className="px-2 py-2 text-right text-[#a3a3a3]">CV</th>
                <th className="px-3 py-2 text-left text-[#a3a3a3]">Posição</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const item = useSuprimentosStore.getState().estoqueItens.find(i => i.id === d.itemId)
                return (
                  <tr key={d.itemId} className="border-t border-[#525252] hover:bg-[#484848]">
                    <td className="px-3 py-1.5 text-[#f5f5f5] truncate max-w-[200px]">{item?.descricao ?? d.itemId}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold',
                        d.classeABC === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                        d.classeABC === 'B' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-neutral-500/20 text-neutral-400'
                      )}>{d.classeABC}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold',
                        d.classeXYZ === 'X' ? 'bg-sky-500/20 text-sky-400' :
                        d.classeXYZ === 'Y' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      )}>{d.classeXYZ}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[#f5f5f5] font-mono">
                      R$ {d.valorConsumo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#a3a3a3] font-mono">{d.coeficienteVariacao.toFixed(2)}</td>
                    <td className="px-3 py-1.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded',
                        d.posicaoSugerida === 'frente' ? 'bg-emerald-500/20 text-emerald-400' :
                        d.posicaoSugerida === 'meio' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-neutral-500/20 text-neutral-400'
                      )}>{d.posicaoSugerida}</span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#6b6b6b]">Nenhum item classificado. Clique "Recalcular".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Board ──────────────────────────────────────────────────────────────

function KanbanPanel({ cards }: { cards: KanbanCard[] }) {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')
  const updateKanbanStatus = useSuprimentosStore(s => s.updateKanbanStatus)

  const columns: { status: KanbanCard['status']; label: string; color: string; borderColor: string }[] = [
    { status: 'normal', label: 'Normal', color: 'text-emerald-400', borderColor: 'border-emerald-500/30' },
    { status: 'atencao', label: 'Atenção', color: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
    { status: 'critico', label: 'Crítico', color: 'text-red-400', borderColor: 'border-red-500/30' },
    { status: 'pedido_gerado', label: 'Pedido Gerado', color: 'text-sky-400', borderColor: 'border-sky-500/30' },
  ]

  const grouped = useMemo(() => {
    const m: Record<string, KanbanCard[]> = {}
    for (const col of columns) m[col.status] = cards.filter(c => c.status === col.status)
    return m
  }, [cards])

  const totalAtencao = (grouped['atencao']?.length ?? 0) + (grouped['critico']?.length ?? 0)
  const avgDias = cards.length > 0 ? Math.round(cards.reduce((s, c) => s + (c.diasEstoque < 999 ? c.diasEstoque : 0), 0) / cards.filter(c => c.diasEstoque < 999).length || 0) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-4 gap-2 flex-1 mr-4">
          <Kpi label="Total Itens" value={cards.length} color="text-[#f5f5f5]" bg="bg-[#3d3d3d] border-[#525252]" />
          <Kpi label="Em Atenção" value={totalAtencao} color="text-yellow-400" bg="bg-yellow-500/10 border-yellow-500/30" />
          <Kpi label="Críticos" value={grouped['critico']?.length ?? 0} color="text-red-400" bg="bg-red-500/10 border-red-500/30" />
          <Kpi label="Dias Médio Estoque" value={avgDias} color="text-sky-400" bg="bg-sky-500/10 border-sky-500/30" />
        </div>
        <div className="flex gap-1 bg-[#3d3d3d] border border-[#525252] rounded-lg p-0.5">
          <button onClick={() => setViewMode('board')} className={cn('px-2 py-1 rounded text-[10px]', viewMode === 'board' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b]')}>Board</button>
          <button onClick={() => setViewMode('table')} className={cn('px-2 py-1 rounded text-[10px]', viewMode === 'table' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b]')}>Tabela</button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[400px]">
          {columns.map(col => (
            <div key={col.status} className={cn('border rounded-xl p-2 space-y-2', col.borderColor, 'bg-[#3d3d3d]/30')}>
              <div className="flex items-center gap-2 px-1">
                <span className={cn('text-xs font-semibold', col.color)}>{col.label}</span>
                <span className="text-[10px] text-[#6b6b6b] bg-[#484848] px-1.5 rounded-full">{grouped[col.status]?.length ?? 0}</span>
              </div>
              {(grouped[col.status] ?? []).map(card => (
                <div key={card.id} className="bg-[#484848] border border-[#525252] rounded-lg p-2.5 space-y-1.5">
                  <p className="text-[#f5f5f5] text-xs font-medium truncate">{card.descricao}</p>
                  <div className="flex justify-between text-[10px] text-[#a3a3a3]">
                    <span>Qtd: {card.qtdAtual}</span>
                    <span>Mín: {card.estoqueMinimo}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#a3a3a3]">
                    <span>{card.diasEstoque < 999 ? `${card.diasEstoque}d estoque` : '∞'}</span>
                    <span>{card.fornecedor}</span>
                  </div>
                  {card.status === 'critico' && (
                    <button
                      onClick={() => updateKanbanStatus(card.id, 'pedido_gerado')}
                      className="w-full mt-1 px-2 py-1 bg-[#f97316] text-white text-[10px] rounded font-medium hover:bg-[#ea580c]"
                    >
                      Gerar Pedido
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-auto max-h-[400px] border border-[#525252] rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#3d3d3d] z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[#a3a3a3]">Item</th>
                <th className="px-2 py-2 text-right text-[#a3a3a3]">Qtd Atual</th>
                <th className="px-2 py-2 text-right text-[#a3a3a3]">Mínimo</th>
                <th className="px-2 py-2 text-right text-[#a3a3a3]">Ponto Pedido</th>
                <th className="px-2 py-2 text-right text-[#a3a3a3]">Dias</th>
                <th className="px-2 py-2 text-left text-[#a3a3a3]">Fornecedor</th>
                <th className="px-2 py-2 text-center text-[#a3a3a3]">Status</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => (
                <tr key={c.id} className="border-t border-[#525252] hover:bg-[#484848]">
                  <td className="px-3 py-1.5 text-[#f5f5f5] truncate max-w-[200px]">{c.descricao}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#f5f5f5]">{c.qtdAtual}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#a3a3a3]">{c.estoqueMinimo}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#a3a3a3]">{c.pontoPedido.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#f5f5f5]">{c.diasEstoque < 999 ? c.diasEstoque : '∞'}</td>
                  <td className="px-2 py-1.5 text-[#a3a3a3]">{c.fornecedor}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold',
                      c.status === 'normal' ? 'bg-emerald-500/20 text-emerald-400' :
                      c.status === 'atencao' ? 'bg-yellow-500/20 text-yellow-400' :
                      c.status === 'critico' ? 'bg-red-500/20 text-red-400' :
                      'bg-sky-500/20 text-sky-400'
                    )}>{c.status === 'pedido_gerado' ? 'Pedido' : c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Slotting Dinâmico ─────────────────────────────────────────────────────────

function SlottingPanel({ data }: { data: SlottingSugestao[] }) {
  const zones: { key: SlottingSugestao['zonaSugerida']; label: string; color: string; icon: string }[] = [
    { key: 'zona_transbordo', label: 'Zona Transbordo', color: 'bg-red-500/20 border-red-500/40 text-red-400', icon: '🔴' },
    { key: 'prateleira_frente', label: 'Prateleira Frente', color: 'bg-orange-500/20 border-orange-500/40 text-orange-400', icon: '🟠' },
    { key: 'prateleira_meio', label: 'Prateleira Meio', color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400', icon: '🟡' },
    { key: 'prateleira_fundo', label: 'Prateleira Fundo', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400', icon: '🟢' },
    { key: 'area_remota', label: 'Área Remota', color: 'bg-neutral-500/20 border-neutral-500/40 text-neutral-400', icon: '⚪' },
  ]

  const needsMoving = data.filter(d => d.zonaAtual !== d.zonaSugerida)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {zones.map(z => {
          const count = data.filter(d => d.zonaSugerida === z.key).length
          return (
            <div key={z.key} className={cn('border rounded-xl p-3 text-center', z.color)}>
              <p className="text-lg">{z.icon}</p>
              <p className="text-xs font-semibold mt-1">{count}</p>
              <p className="text-[9px] opacity-70">{z.label}</p>
            </div>
          )
        })}
      </div>

      {needsMoving.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#f97316]/10 border border-[#f97316]/30 rounded-lg">
          <AlertTriangle size={14} className="text-[#f97316]" />
          <span className="text-xs text-[#f97316]">{needsMoving.length} item(ns) precisam ser reposicionados</span>
        </div>
      )}

      <div className="overflow-auto max-h-[350px] border border-[#525252] rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#3d3d3d] z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[#a3a3a3]">Item</th>
              <th className="px-2 py-2 text-left text-[#a3a3a3]">Zona Atual</th>
              <th className="px-2 py-2 text-center text-[#a3a3a3]" />
              <th className="px-2 py-2 text-left text-[#a3a3a3]">Zona Sugerida</th>
              <th className="px-2 py-2 text-right text-[#a3a3a3]">Dias até Uso</th>
              <th className="px-3 py-2 text-left text-[#a3a3a3]">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const needsMove = d.zonaAtual !== d.zonaSugerida
              return (
                <tr key={d.itemId} className={cn('border-t border-[#525252]', needsMove ? 'bg-[#f97316]/5' : 'hover:bg-[#484848]')}>
                  <td className="px-3 py-1.5 text-[#f5f5f5] truncate max-w-[180px]">{d.descricao}</td>
                  <td className="px-2 py-1.5 text-[#a3a3a3] text-[10px]">{d.zonaAtual.replace(/_/g, ' ')}</td>
                  <td className="px-1 py-1.5 text-center">
                    {needsMove && <ArrowRight size={12} className="text-[#f97316]" />}
                  </td>
                  <td className="px-2 py-1.5 text-[10px] font-medium text-[#f5f5f5]">{d.zonaSugerida.replace(/_/g, ' ')}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#f5f5f5]">{d.diasAteUso < 999 ? d.diasAteUso : '—'}</td>
                  <td className="px-3 py-1.5 text-[#a3a3a3] text-[10px] truncate max-w-[220px]">{d.motivo}</td>
                </tr>
              )
            })}
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[#6b6b6b]">Sem dados. Clique "Recalcular".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── FEFO Panel ────────────────────────────────────────────────────────────────

function FEFOPanel({ alerts }: { alerts: AlertaFEFO[] }) {
  const vencidos = alerts.filter(a => a.severidade === 'vencido').length
  const urgentes = alerts.filter(a => a.severidade === 'urgente').length
  const atencao = alerts.filter(a => a.severidade === 'atencao').length

  const sevColor = (sev: AlertaFEFO['severidade']) =>
    sev === 'vencido' ? 'text-red-500 bg-red-500/10' :
    sev === 'urgente' ? 'text-red-400 bg-red-500/10' :
    sev === 'atencao' ? 'text-yellow-400 bg-yellow-500/10' :
    'text-emerald-400 bg-emerald-500/10'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Vencidos" value={vencidos} color="text-red-500" bg="bg-red-500/10 border-red-500/30" />
        <Kpi label="Urgente (< 7d)" value={urgentes} color="text-red-400" bg="bg-red-500/10 border-red-500/30" />
        <Kpi label="Atenção (< 30d)" value={atencao} color="text-yellow-400" bg="bg-yellow-500/10 border-yellow-500/30" />
        <Kpi label="OK" value={alerts.length - vencidos - urgentes - atencao} color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/30" />
      </div>

      <div className="overflow-auto max-h-[350px] border border-[#525252] rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#3d3d3d] z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[#a3a3a3]">Material</th>
              <th className="px-2 py-2 text-left text-[#a3a3a3]">Lote</th>
              <th className="px-2 py-2 text-left text-[#a3a3a3]">Validade</th>
              <th className="px-2 py-2 text-right text-[#a3a3a3]">Dias</th>
              <th className="px-2 py-2 text-right text-[#a3a3a3]">Qtd</th>
              <th className="px-2 py-2 text-center text-[#a3a3a3]">Severidade</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id} className={cn('border-t border-[#525252]', a.severidade === 'vencido' && 'bg-red-500/5')}>
                <td className="px-3 py-1.5 text-[#f5f5f5]">{a.descricao}</td>
                <td className="px-2 py-1.5 text-[#a3a3a3] font-mono">{a.lote}</td>
                <td className="px-2 py-1.5 text-[#f5f5f5]">{new Date(a.dataValidade).toLocaleDateString('pt-BR')}</td>
                <td className="px-2 py-1.5 text-right font-mono text-[#f5f5f5]">{a.diasRestantes}</td>
                <td className="px-2 py-1.5 text-right font-mono text-[#f5f5f5]">{a.qtdDisponivel}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', sevColor(a.severidade))}>
                    {a.severidade === 'vencido' ? 'VENCIDO' : a.severidade === 'urgente' ? 'URGENTE' : a.severidade === 'atencao' ? 'ATENÇÃO' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[#6b6b6b]">Sem itens com validade cadastrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Kits JIT Panel ────────────────────────────────────────────────────────────

function KitsJITPanel({ kits }: { kits: KitAtividade[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const updateKitStatus = useSuprimentosStore(s => s.updateKitStatus)

  const statusColor = (s: KitAtividade['status']) =>
    s === 'preparando' ? 'bg-yellow-500/20 text-yellow-400' :
    s === 'pronto' ? 'bg-emerald-500/20 text-emerald-400' :
    'bg-sky-500/20 text-sky-400'

  const nextStatus: Record<KitAtividade['status'], KitAtividade['status'] | null> = {
    preparando: 'pronto',
    pronto: 'entregue',
    entregue: null,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Total Kits" value={kits.length} color="text-[#f5f5f5]" bg="bg-[#3d3d3d] border-[#525252]" />
        <Kpi label="Preparando" value={kits.filter(k => k.status === 'preparando').length} color="text-yellow-400" bg="bg-yellow-500/10 border-yellow-500/30" />
        <Kpi label="Prontos" value={kits.filter(k => k.status === 'pronto').length} color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/30" />
        <Kpi label="Entregues" value={kits.filter(k => k.status === 'entregue').length} color="text-sky-400" bg="bg-sky-500/10 border-sky-500/30" />
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {kits.map(kit => (
          <div key={kit.id} className="bg-[#3d3d3d] border border-[#525252] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === kit.id ? null : kit.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#484848] transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedId === kit.id ? <ChevronDown size={14} className="text-[#a3a3a3]" /> : <ChevronRight size={14} className="text-[#a3a3a3]" />}
                <div className="text-left">
                  <p className="text-[#f5f5f5] text-xs font-medium">{kit.descricaoAtividade}</p>
                  <p className="text-[#a3a3a3] text-[10px]">Semana {kit.semana} | {kit.itens.length} itens</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', statusColor(kit.status))}>{kit.status}</span>
                {nextStatus[kit.status] && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateKitStatus(kit.id, nextStatus[kit.status]!) }}
                    className="px-2 py-1 bg-[#f97316] text-white text-[10px] rounded hover:bg-[#ea580c]"
                  >
                    {nextStatus[kit.status] === 'pronto' ? 'Marcar Pronto' : 'Marcar Entregue'}
                  </button>
                )}
              </div>
            </button>
            {expandedId === kit.id && (
              <div className="border-t border-[#525252] px-4 py-2 space-y-1">
                {kit.itens.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="text-[#f5f5f5]">{item.descricao}</span>
                    <span className="text-[#a3a3a3] font-mono">{item.qtdNecessaria} {item.unidade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {kits.length === 0 && (
          <div className="text-center text-[#6b6b6b] text-xs py-8">Nenhum kit criado ainda.</div>
        )}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function FluxoProducaoPanel() {
  const [subTab, setSubTab] = useState<SubTab>('abcxyz')

  const { abcxyzClassification, kanbanCards, slottingSugestoes, alertasFEFO, kitsAtividade, recalcularFluxoProducao } = useSuprimentosStore(
    useShallow(s => ({
      abcxyzClassification: s.abcxyzClassification,
      kanbanCards: s.kanbanCards,
      slottingSugestoes: s.slottingSugestoes,
      alertasFEFO: s.alertasFEFO,
      kitsAtividade: s.kitsAtividade,
      recalcularFluxoProducao: s.recalcularFluxoProducao,
    }))
  )

  // Auto-recalculate on mount if empty
  useEffect(() => {
    if (abcxyzClassification.length === 0 && kanbanCards.length === 0) {
      recalcularFluxoProducao()
    }
  }, [])

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Sub-tab bar + recalculate */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-1 bg-[#3d3d3d] border border-[#525252] rounded-lg p-1">
          {SUB_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap',
                subTab === tab.key ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
              )}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={recalcularFluxoProducao}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
        >
          <RefreshCw size={13} />
          Recalcular
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {subTab === 'abcxyz' && <ABCXYZPanel data={abcxyzClassification} />}
        {subTab === 'kanban' && <KanbanPanel cards={kanbanCards} />}
        {subTab === 'slotting' && <SlottingPanel data={slottingSugestoes} />}
        {subTab === 'fefo' && <FEFOPanel alerts={alertasFEFO} />}
        {subTab === 'kits' && <KitsJITPanel kits={kitsAtividade} />}
      </div>
    </div>
  )
}
