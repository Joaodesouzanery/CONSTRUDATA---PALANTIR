/**
 * CapexRoiPanel — análise de CapEx dos ativos (substituir × reparar), inspirada na
 * tela "Capital Expenditures Analysis" (sem IA / sem ontologia). Deriva o histórico
 * de custo de reparo das ordens de serviço (manutenções) por ativo e mês; a
 * recomendação compara o custo de reparo anualizado com o custo de reposição
 * amortizado. O custo de reposição é um input "what-if" (sessão) com estimativa
 * default — não persiste (pode virar campo do ativo numa próxima entrega).
 */
import { useMemo, useState } from 'react'
import { DollarSign, Wrench, TrendingUp, Repeat, AlertTriangle } from 'lucide-react'
import { useManutencoesStore } from '@/store/manutencoesStore'
import type { MaintenanceAsset, MaintenanceWorkOrder } from '@/store/manutencoesStore'

const VIDA_UTIL_ANOS = 5   // horizonte de amortização da reposição

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function monthKey(w: MaintenanceWorkOrder) { return (w.completedAt || w.scheduledDate || w.dueDate || w.createdAt || '').slice(0, 7) }
function orderCost(w: MaintenanceWorkOrder) { return w.actualCost || w.estimatedCost || 0 }

interface AssetCapex {
  asset: MaintenanceAsset
  orders: MaintenanceWorkOrder[]
  total: number
  repair12m: number
  monthly: { month: string; valor: number }[]
}

export function CapexRoiPanel() {
  const assets = useManutencoesStore((s) => s.assets)
  const workOrders = useManutencoesStore((s) => s.workOrders)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replacementOverride, setReplacementOverride] = useState<Record<string, number>>({})

  const hoje = new Date()
  const limite12m = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().slice(0, 7)

  const rows = useMemo<AssetCapex[]>(() => {
    return assets
      .map((asset) => {
        const orders = workOrders.filter((w) => w.assetIds?.includes(asset.id))
        const total = orders.reduce((s, w) => s + orderCost(w), 0)
        const repair12m = orders.filter((w) => monthKey(w) >= limite12m).reduce((s, w) => s + orderCost(w), 0)
        const mMap = new Map<string, number>()
        for (const w of orders) {
          const k = monthKey(w)
          if (k) mMap.set(k, (mMap.get(k) ?? 0) + orderCost(w))
        }
        const monthly = [...mMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, valor]) => ({ month, valor }))
        return { asset, orders, total, repair12m, monthly }
      })
      .filter((r) => r.orders.length > 0)
      .sort((a, b) => b.repair12m - a.repair12m)
  }, [assets, workOrders, limite12m])

  const selected = rows.find((r) => r.asset.id === selectedId) ?? rows[0] ?? null

  const defaultReplacement = (r: AssetCapex) => Math.round((r.repair12m * 3) / 100) * 100   // estimativa: 3× o reparo anual
  const replacementCost = (r: AssetCapex) => replacementOverride[r.asset.id] ?? defaultReplacement(r)

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-auto">
      {/* Lista de ativos */}
      <div className="lg:w-[340px] shrink-0 space-y-2">
        <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Ativos por custo de reparo (12m)</p>
        {rows.length === 0 ? (
          <div className="text-[#6b6b6b] text-xs py-8 text-center rounded-xl border border-dashed border-[#525252]">
            Sem ordens de serviço com custo. Registre OS em Manutenções para ver o CapEx.
          </div>
        ) : rows.map((r) => {
          const isSel = selected?.asset.id === r.asset.id
          const rep = replacementCost(r)
          const substituir = r.repair12m > rep / VIDA_UTIL_ANOS
          return (
            <button
              key={r.asset.id}
              onClick={() => setSelectedId(r.asset.id)}
              className={`w-full text-left rounded-xl border p-3 transition-colors ${isSel ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#333333] hover:border-[#f97316]/50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-sm truncate">{r.asset.name || r.asset.code}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${substituir ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                  {substituir ? 'Substituir' : 'Reparar'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6b6b6b] mt-1">
                <span>{r.orders.length} OS · reparo 12m</span>
                <span className="text-[#f97316] font-mono">{fmtBRL(r.repair12m)}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Análise do ativo selecionado */}
      <div className="flex-1 min-w-0 space-y-5">
        {!selected ? (
          <div className="text-[#6b6b6b] text-sm py-16 text-center rounded-xl border border-dashed border-[#525252]">Selecione um ativo.</div>
        ) : (
          <CapexDetail
            row={selected}
            replacement={replacementCost(selected)}
            onReplacement={(v) => setReplacementOverride((prev) => ({ ...prev, [selected.asset.id]: v }))}
          />
        )}
      </div>
    </div>
  )
}

function CapexDetail({ row, replacement, onReplacement }: { row: AssetCapex; replacement: number; onReplacement: (v: number) => void }) {
  const repairAnual = row.repair12m
  const amortReposicao = replacement / VIDA_UTIL_ANOS
  const economiaAno1 = repairAnual - amortReposicao   // >0 → substituir compensa
  const substituir = economiaAno1 > 0

  return (
    <>
      {/* Recomendação */}
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-[#f97316]" />
          <h2 className="text-white font-semibold text-sm">Recomendação — {row.asset.name || row.asset.code}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RecCard label="Custo de reposição" value={fmtBRL(replacement)} tone="#38bdf8" />
          <RecCard label="Reparo (12m)" value={fmtBRL(repairAnual)} tone="#ef4444" />
          <RecCard label="Economia Ano 1" value={fmtBRL(economiaAno1)} tone={substituir ? '#22c55e' : '#ef4444'} />
        </div>
        <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${substituir ? 'bg-red-500/10 text-red-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
          {substituir ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Repeat size={16} className="mt-0.5 shrink-0" />}
          <div>
            <strong>{substituir ? 'Substituir o ativo' : 'Manter e reparar'}.</strong>{' '}
            {substituir
              ? `O reparo anual (${fmtBRL(repairAnual)}) supera a reposição amortizada em ${VIDA_UTIL_ANOS} anos (${fmtBRL(amortReposicao)}/ano) — troca economiza ~${fmtBRL(economiaAno1)}/ano.`
              : `O reparo anual (${fmtBRL(repairAnual)}) ainda é menor que a reposição amortizada (${fmtBRL(amortReposicao)}/ano) — reparar compensa.`}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <label className="text-[11px] text-[#a3a3a3]">Custo de reposição (ajuste o cenário):</label>
          <div className="flex items-center gap-1">
            <span className="text-[#6b6b6b] text-xs">R$</span>
            <input
              type="number" min={0} step={500}
              value={replacement}
              onChange={(e) => onReplacement(Math.max(0, Number(e.target.value) || 0))}
              className="w-32 bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#f97316]/60"
            />
          </div>
          <span className="text-[10px] text-[#6b6b6b]">Estimativa inicial = 3× o reparo anual · amortização em {VIDA_UTIL_ANOS} anos.</span>
        </div>
      </div>

      {/* Custo de reparo mensal */}
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wrench size={15} className="text-[#a3a3a3]" />
          <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Custo de reparo mensal</p>
        </div>
        <MonthlyBars data={row.monthly} />
      </div>
    </>
  )
}

function MonthlyBars({ data }: { data: { month: string; valor: number }[] }) {
  if (data.length === 0) return <p className="text-[#6b6b6b] text-xs py-6 text-center">Sem histórico de custo.</p>
  const max = Math.max(...data.map((d) => d.valor), 1)
  return (
    <div className="flex items-end gap-1.5 h-40 overflow-x-auto">
      {data.map((d) => (
        <div key={d.month} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 44 }}>
          <span className="text-[9px] text-[#a3a3a3] tabular-nums">{d.valor >= 1000 ? `${Math.round(d.valor / 1000)}k` : d.valor.toFixed(0)}</span>
          <div className="w-6 bg-red-500/60 rounded-t" style={{ height: `${Math.max(2, (d.valor / max) * 120)}px` }} title={fmtBRL(d.valor)} />
          <span className="text-[9px] text-[#6b6b6b]">{d.month.slice(2)}</span>
        </div>
      ))}
    </div>
  )
}

function RecCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <DollarSign size={13} style={{ color: tone }} />
        <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p>
      </div>
      <p className="text-lg font-bold font-mono" style={{ color: tone }}>{value}</p>
    </div>
  )
}
