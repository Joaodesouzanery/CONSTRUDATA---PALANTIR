/**
 * CapexRoiPanel — análise de CapEx dos ativos (substituir × reparar), inspirada na tela
 * "Capital Expenditures Analysis" (sem IA/ontologia). Deriva o histórico de custo de
 * reparo das ordens de serviço por ativo e mês; a recomendação compara o reparo anual
 * com a reposição amortizada. Colunas ROI / Capex proposto / Custo anual como a imagem.
 * O custo de reposição e os metadados (modelo/serial) PERSISTEM no payload jsonb do ativo
 * (updateAsset) — sem migração. Chamados similares por heurística (lib/similarity).
 */
import { useMemo, useState } from 'react'
import { DollarSign, Wrench, TrendingUp, Repeat, AlertTriangle, Copy } from 'lucide-react'
import { useManutencoesStore } from '@/store/manutencoesStore'
import type { MaintenanceAsset, MaintenanceWorkOrder } from '@/store/manutencoesStore'
import { rankBySimilarity } from '../lib/similarity'

const VIDA_UTIL_PADRAO = 5   // fallback quando o ativo não tem vida útil NBR cadastrada (Tela 1)

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function monthKey(w: MaintenanceWorkOrder) { return (w.completedAt || w.scheduledDate || w.dueDate || w.createdAt || '').slice(0, 7) }
function orderCost(w: MaintenanceWorkOrder) { return w.actualCost || w.estimatedCost || 0 }
const defaultReplacement = (repair12m: number) => Math.round((repair12m * 3) / 100) * 100   // estimativa: 3× o reparo anual

interface AssetCapex {
  asset: MaintenanceAsset
  orders: MaintenanceWorkOrder[]
  repair12m: number
  monthly: { month: string; valor: number }[]
  replacement: number
  roi: number          // economia Ano 1 (reparo anual − reposição amortizada pela vida útil)
  substituir: boolean
  vidaUtil: number     // anos — vida útil NBR do ativo (Tela 1) ou padrão
  idadeAnos: number | null      // idade a partir da data de instalação (Tela 1)
  vidaRestante: number | null   // anos restantes de vida útil
  mesesComCusto: number         // meses distintos com OS custeada nos últimos 12m
  maturo: boolean               // ≥12 meses de dados → base automática (não mais "de papel")
}

export function CapexRoiPanel() {
  const assets = useManutencoesStore((s) => s.assets)
  const workOrders = useManutencoesStore((s) => s.workOrders)
  const updateAsset = useManutencoesStore((s) => s.updateAsset)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const assetTypeById = useMemo(() => new Map(assets.map((a) => [a.id, a.type])), [assets])

  const rows = useMemo<AssetCapex[]>(() => {
    const now = new Date()
    const limite12m = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 7)
    const nowKey = now.toISOString().slice(0, 7)
    return assets
      .map((asset) => {
        const orders = workOrders.filter((w) => w.assetIds?.includes(asset.id))
        // Janela de 12m REALIZADOS (não conta OS agendadas no futuro): custo anual e "meses
        // de dados" honestos para o badge de maturidade.
        const orders12m = orders.filter((w) => { const kk = monthKey(w); return kk >= limite12m && kk <= nowKey })
        const repair12m = orders12m.reduce((s, w) => s + orderCost(w), 0)
        const mMap = new Map<string, number>()
        for (const w of orders) { const k = monthKey(w); if (k) mMap.set(k, (mMap.get(k) ?? 0) + orderCost(w)) }
        const monthly = [...mMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, valor]) => ({ month, valor }))
        const mesesComCusto = new Set(orders12m.filter((w) => orderCost(w) > 0).map(monthKey)).size
        const vidaUtil = asset.vidaUtilAnosNBR && asset.vidaUtilAnosNBR > 0 ? asset.vidaUtilAnosNBR : VIDA_UTIL_PADRAO
        const inst = asset.dataInstalacao ? new Date(asset.dataInstalacao + 'T12:00:00').getTime() : NaN
        const idadeAnos = Number.isFinite(inst) ? Math.max(0, Math.floor((now.getTime() - inst) / (365.25 * 86_400_000))) : null
        const vidaRestante = idadeAnos != null ? Math.max(0, vidaUtil - idadeAnos) : null
        const replacement = asset.replacementCostBRL ?? defaultReplacement(repair12m)
        const roi = repair12m - replacement / vidaUtil
        return { asset, orders, repair12m, monthly, replacement, roi, substituir: roi > 0, vidaUtil, idadeAnos, vidaRestante, mesesComCusto, maturo: mesesComCusto >= 12 }
      })
      .filter((r) => r.orders.length > 0)
      .sort((a, b) => b.repair12m - a.repair12m)
  }, [assets, workOrders])

  const selected = rows.find((r) => r.asset.id === selectedId) ?? rows[0] ?? null

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-auto">
      {/* Lista de ativos */}
      <div className="lg:w-[360px] shrink-0 space-y-2">
        <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Ativos por custo de reparo (12m)</p>
        {rows.length === 0 ? (
          <div className="text-[#6b6b6b] text-xs py-8 text-center rounded-xl border border-dashed border-[#525252]">
            Sem ordens de serviço com custo. Registre OS em Manutenções para ver o CapEx.
          </div>
        ) : rows.map((r) => {
          const isSel = selected?.asset.id === r.asset.id
          return (
            <button
              key={r.asset.id}
              onClick={() => setSelectedId(r.asset.id)}
              className={`w-full text-left rounded-xl border p-3 transition-colors ${isSel ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#333333] hover:border-[#f97316]/50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-sm truncate">{r.asset.name || r.asset.code}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.substituir ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                  {r.substituir ? 'Substituir' : 'Reparar'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                <MiniCol label="Custo anual" value={fmtBRL(r.repair12m)} tone="#ef4444" />
                <MiniCol label="Capex prop." value={fmtBRL(r.replacement)} tone="#38bdf8" />
                <MiniCol label="ROI" value={fmtBRL(r.roi)} tone={r.roi >= 0 ? '#22c55e' : '#ef4444'} />
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
            workOrders={workOrders}
            assetTypeById={assetTypeById}
            onSelectOrderAsset={(assetId) => setSelectedId(assetId)}
            onPatch={(patch) => void updateAsset(selected.asset.id, patch)}
          />
        )}
      </div>
    </div>
  )
}

function CapexDetail({ row, workOrders, assetTypeById, onSelectOrderAsset, onPatch }: {
  row: AssetCapex
  workOrders: MaintenanceWorkOrder[]
  assetTypeById: Map<string, string>
  onSelectOrderAsset: (assetId: string) => void
  onPatch: (patch: { replacementCostBRL?: number; modelo?: string; serial?: string }) => void
}) {
  const { asset } = row
  const amortReposicao = row.replacement / row.vidaUtil
  const substituir = row.substituir

  // Chamados similares (heurística) — OS de OUTROS ativos parecidas com as deste.
  const baseText = row.orders.map((w) => `${w.title} ${w.description}`).join(' ') + ' ' + asset.type
  const similares = useMemo(
    () => rankBySimilarity(
      baseText,
      workOrders.filter((w) => !w.assetIds?.includes(asset.id)),
      (w) => `${w.title} ${w.description} ${(w.assetIds ?? []).map((id) => assetTypeById.get(id) ?? '').join(' ')}`,
      { topN: 5 },
    ),
    [baseText, workOrders, asset.id, assetTypeById],
  )

  return (
    <>
      {/* Recomendação + cards */}
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-[#f97316]" />
          <h2 className="text-white font-semibold text-sm">Recomendação — {asset.name || asset.code}</h2>
          <span
            className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.maturo ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/30 bg-amber-500/10 text-amber-300'}`}
            title={row.maturo ? '12+ meses de OS custeadas: base sólida (automática).' : 'Menos de 12 meses de dados: projeção "de papel"; refina conforme o histórico cresce.'}>
            {row.maturo ? 'base automática' : `projeção · ${row.mesesComCusto}/12 meses`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RecCard label="Capex proposto (reposição)" value={fmtBRL(row.replacement)} tone="#38bdf8" />
          <RecCard label="Custo anual (reparo 12m)" value={fmtBRL(row.repair12m)} tone="#ef4444" />
          <RecCard label="ROI (economia Ano 1)" value={fmtBRL(row.roi)} tone={substituir ? '#22c55e' : '#ef4444'} />
        </div>
        <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${substituir ? 'bg-red-500/10 text-red-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
          {substituir ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Repeat size={16} className="mt-0.5 shrink-0" />}
          <div>
            <strong>{substituir ? 'Substituir o ativo' : 'Manter e reparar'}.</strong>{' '}
            {substituir
              ? `O reparo anual (${fmtBRL(row.repair12m)}) supera a reposição amortizada pela vida útil de ${row.vidaUtil} anos (${fmtBRL(amortReposicao)}/ano) — troca economiza ~${fmtBRL(row.roi)}/ano.`
              : `O reparo anual (${fmtBRL(row.repair12m)}) ainda é menor que a reposição amortizada (${fmtBRL(amortReposicao)}/ano) — reparar compensa.`}
            {row.vidaRestante != null && ` Vida útil restante: ~${row.vidaRestante} de ${row.vidaUtil} anos${row.idadeAnos != null ? ` (instalado há ${row.idadeAnos} anos)` : ''}.`}
            {substituir && ` Sugerimos provisionar ${fmtBRL(row.replacement)}${row.vidaRestante != null && row.vidaRestante <= 2 ? ' com prioridade (fim de vida útil)' : ''}.`}
          </div>
        </div>
      </div>

      {/* Metadados do ativo (persistidos) */}
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetaField key={asset.id + '-repl'} label="Custo de reposição (R$)" type="number" value={asset.replacementCostBRL ?? ''} placeholder={String(defaultReplacement(row.repair12m))}
          onSave={(v) => onPatch({ replacementCostBRL: v === '' ? undefined : Math.max(0, Number(v) || 0) })} help={`Padrão = 3× o reparo anual · amortização em ${row.vidaUtil} anos`} />
        <MetaReadonly label="Vida útil (NBR)" value={`${row.vidaUtil} anos${asset.vidaUtilAnosNBR ? '' : ' (padrão — cadastre na Tela de Ativos)'}`} />
        <MetaReadonly label="Idade / restante" value={row.idadeAnos != null ? `${row.idadeAnos} anos${row.vidaRestante != null ? ` · resta ~${row.vidaRestante}` : ''}` : 'sem data de instalação'} />
        <MetaReadonly label="Localização" value={asset.location || '—'} />
        <MetaField key={asset.id + '-modelo'} label="Modelo" value={asset.modelo ?? ''} onSave={(v) => onPatch({ modelo: v || undefined })} />
        <MetaField key={asset.id + '-serial'} label="Nº de série" value={asset.serial ?? ''} onSave={(v) => onPatch({ serial: v || undefined })} />
      </div>

      {/* Custo de reparo mensal */}
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wrench size={15} className="text-[#a3a3a3]" />
          <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Custo de reparo mensal</p>
        </div>
        <MonthlyBars data={row.monthly} />
      </div>

      {/* Chamados similares */}
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Copy size={14} className="text-[#a3a3a3]" />
          <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Chamados de manutenção similares</p>
        </div>
        {similares.length === 0 ? (
          <p className="text-[#6b6b6b] text-xs py-4 text-center">Nenhum chamado similar em outros ativos.</p>
        ) : (
          <div className="space-y-1.5">
            {similares.map(({ item: w, score }) => {
              const outroAsset = (w.assetIds ?? [])[0]
              return (
                <button key={w.id} onClick={() => outroAsset && onSelectOrderAsset(outroAsset)}
                  className="w-full text-left rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5 hover:border-[#f97316]/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white text-xs truncate">{w.title || w.code}</p>
                    <span className="text-[10px] text-[#f97316] font-mono shrink-0">{Math.round(score * 100)}%</span>
                  </div>
                  <p className="text-[10px] text-[#6b6b6b] truncate">{w.status} · {w.scheduledDate || '—'} · reparo {fmtBRL(orderCost(w))}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function MiniCol({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="text-center">
      <p className="text-[8px] uppercase tracking-wider text-[#6b6b6b]">{label}</p>
      <p className="text-[11px] font-mono font-semibold" style={{ color: tone }}>{value}</p>
    </div>
  )
}

// Recebe `key={asset.id + label}` do pai → remonta (e re-inicializa) ao trocar de ativo.
function MetaField({ label, value, onSave, type = 'text', placeholder, help }: { label: string; value: string | number; onSave: (v: string) => void; type?: string; placeholder?: string; help?: string }) {
  const [v, setV] = useState(String(value ?? ''))
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</label>
      <input type={type} value={v} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v)}
        className="w-full mt-1 bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#f97316]/60" />
      {help && <p className="text-[9px] text-[#6b6b6b] mt-0.5">{help}</p>}
    </div>
  )
}

function MetaReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</label>
      <p className="mt-1 text-xs text-[#d4d4d4] px-2.5 py-1.5">{value}</p>
    </div>
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
