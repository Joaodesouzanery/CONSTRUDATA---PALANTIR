/**
 * RateioConsumoPanel — "Rateio de Consumo" (adaptação do submeter-billback): kanban
 * Processando · Ação necessária · Aprovado + detalhe de cálculo (leituras/área/proporção
 * → valor por unidade) com reconciliação vs a fatura total. Aprovar pode gerar cobranças
 * (títulos a receber) no Financeiro, de forma idempotente e reversível.
 */
import { useState } from 'react'
import { Plus, Trash2, X, Droplets, Zap, CheckCircle2, RotateCcw, FileText, Pencil, AlertTriangle } from 'lucide-react'
import { useRateioConsumoStore, rateioValores } from '@/store/rateioConsumoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { RateioConsumo, RateioItem, RateioStatus, RateioTipo, RateioBase } from '@/types'

const uid = () => crypto.randomUUID()
function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const COLS: { status: RateioStatus; label: string; color: string }[] = [
  { status: 'processando', label: 'Processando',     color: '#a78bfa' },
  { status: 'revisar',     label: 'Ação necessária', color: '#f59e0b' },
  { status: 'aprovado',    label: 'Aprovado',        color: '#22c55e' },
]
const BASE_LABEL: Record<RateioBase, string> = { leitura: 'Leitura/consumo', area: 'Área (m²)', proporcao: 'Proporção (%)' }

export function RateioConsumoPanel() {
  const { rateios, removeRateio, desfazerCobrancas } = useRateioConsumoStore()
  const [editing, setEditing] = useState<RateioConsumo | 'new' | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byStatus = (st: RateioStatus) => rateios.filter((r) => r.status === st)
  const detail = rateios.find((r) => r.id === detailId) ?? null

  // Editar um rateio com cobranças geradas primeiro DESFAZ as cobranças (volta p/ revisar)
  // — evita cobranças órfãs/defasadas; o usuário re-aprova depois de editar.
  const startEdit = (r: RateioConsumo) => {
    if (r.cobrancaTituloIds?.length) {
      if (!confirm('Este rateio já tem cobranças no Financeiro. Editar vai DESFAZER as cobranças (você re-aprova depois). Continuar?')) return
      desfazerCobrancas(r.id)
    }
    setEditing(r)
  }

  return (
    <div className="p-6 space-y-4 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">Rateio de Consumo</h2>
          <p className="text-[10px] text-[#6b6b6b]">Rateio de faturas de água/energia entre unidades/obras · {rateios.length} rateios</p>
        </div>
        <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors">
          <Plus size={14} /> Novo rateio
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLS.map((col) => {
          const items = byStatus(col.status)
          return (
            <div key={col.status} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                <p className="text-xs font-semibold text-[#f5f5f5] uppercase tracking-wider">{col.label}</p>
                <span className="text-[10px] text-[#6b6b6b] ml-auto">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-[#6b6b6b] text-xs py-6 text-center">Vazio.</p>
                ) : items.map((r) => (
                  <RateioCard key={r.id} r={r} onOpen={() => setDetailId(r.id)} onEdit={() => startEdit(r)} onDelete={() => setDeletingId(r.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {editing && <RateioModal initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {detail && <RateioDetail r={detail} onClose={() => setDetailId(null)} onEdit={() => { startEdit(detail); setDetailId(null) }} />}
      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir rateio"
        message="O rateio (e as cobranças geradas, se houver) será removido. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => { if (deletingId) removeRateio(deletingId); setDeletingId(null) }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}

function reconc(r: RateioConsumo) {
  const vals = rateioValores(r)                                   // Σ == fatura (maior resto)
  const somaRateada = Object.values(vals).reduce((s, v) => s + v, 0)
  const totalBase = r.itens.reduce((s, it) => s + (Number(it.base) || 0), 0)
  const diff = Math.round((r.valorTotalFatura - somaRateada) * 100) / 100
  return { vals, somaRateada, diff, fecha: totalBase > 0 && r.valorTotalFatura > 0 }
}

function RateioCard({ r, onOpen, onEdit, onDelete }: { r: RateioConsumo; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const { fecha } = reconc(r)
  return (
    <div className="group rounded-lg border border-[#525252] bg-[#333333] p-3 hover:border-[#f97316]/50 transition-colors">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-2">
          {r.tipo === 'agua' ? <Droplets size={13} className="text-cyan-400" /> : <Zap size={13} className="text-amber-400" />}
          <span className="text-white text-xs font-medium truncate">{r.descricao || (r.tipo === 'agua' ? 'Água' : 'Energia')}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-[#6b6b6b]">{r.periodo} · {r.itens.length} unid.</span>
          <span className="text-xs font-bold text-[#f97316] font-mono">{fmtBRL(r.valorTotalFatura)}</span>
        </div>
        {!fecha && <p className="text-[9px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={9} /> rateio não fecha com a fatura</p>}
        {(r.cobrancaTituloIds?.length ?? 0) > 0 && <p className="text-[9px] text-emerald-400 mt-1">{r.cobrancaTituloIds!.length} cobranças no Financeiro</p>}
      </button>
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={onEdit} className="p-1 rounded text-[#a3a3a3] hover:bg-white/10 hover:text-[#f97316]" title="Editar"><Pencil size={12} /></button>
        <button onClick={onDelete} className="p-1 rounded text-red-400 hover:bg-red-500/20" title="Excluir"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

function RateioDetail({ r, onClose, onEdit }: { r: RateioConsumo; onClose: () => void; onEdit: () => void }) {
  const { setStatus, gerarCobrancas, desfazerCobrancas } = useRateioConsumoStore()
  const { vals, somaRateada, diff, fecha } = reconc(r)
  const temCobrancas = (r.cobrancaTituloIds?.length ?? 0) > 0

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-xl bg-[#2c2c2c] border border-[#525252] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2">
            {r.tipo === 'agua' ? <Droplets size={16} className="text-cyan-400" /> : <Zap size={16} className="text-amber-400" />}
            <h2 className="text-sm font-semibold text-white">{r.descricao || (r.tipo === 'agua' ? 'Água' : 'Energia')} · {r.periodo}</h2>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="text-[#a3a3a3]">Fatura total: <strong className="text-[#f97316] font-mono">{fmtBRL(r.valorTotalFatura)}</strong></span>
            {r.fornecedor && <span className="text-[#a3a3a3]">Fornecedor: <strong className="text-white">{r.fornecedor}</strong></span>}
            <span className="text-[#a3a3a3]">Base: <strong className="text-white">{BASE_LABEL[r.base]}</strong></span>
          </div>

          <div className="overflow-auto rounded-lg border border-[#525252]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-2 text-left">Unidade</th>
                  <th className="px-3 py-2 text-right">{BASE_LABEL[r.base]}</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Valor rateado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937]">
                {r.itens.map((it) => {
                  const totalBase = r.itens.reduce((s, x) => s + (Number(x.base) || 0), 0)
                  const pct = totalBase > 0 ? (it.base / totalBase) * 100 : 0
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-white">{it.unidade}</td>
                      <td className="px-3 py-2 text-right text-[#a3a3a3] tabular-nums">{it.base.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-right text-[#a3a3a3] tabular-nums">{pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-bold tabular-nums">{fmtBRL(vals[it.id] ?? 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#1f1f1f]">
                  <td colSpan={3} className="px-3 py-2 text-right text-[#a3a3a3] text-[11px]">Soma rateada</td>
                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${fecha ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(somaRateada)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${fecha ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
            {fecha ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {fecha ? 'O rateio fecha exatamente com a fatura.' : `Diferença de ${fmtBRL(Math.abs(diff))} entre o rateado e a fatura — revise as bases.`}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#525252] shrink-0 flex-wrap">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]"><Pencil size={13} /> Editar</button>
          <div className="flex items-center gap-2 flex-wrap">
            {r.status === 'processando' && (
              <button onClick={() => setStatus(r.id, 'revisar')} className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-500">Enviar p/ revisão</button>
            )}
            {r.status === 'revisar' && (
              <>
                <button onClick={() => setStatus(r.id, 'aprovado')} className="px-3 py-2 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">Aprovar sem cobrança</button>
                <button onClick={() => gerarCobrancas(r.id)} disabled={!fecha} title={fecha ? '' : 'O rateio precisa fechar com a fatura'}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white ${fecha ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#484848] opacity-50 cursor-not-allowed'}`}>
                  <FileText size={13} /> Aprovar e gerar cobranças
                </button>
              </>
            )}
            {r.status === 'aprovado' && (
              temCobrancas
                ? <button onClick={() => desfazerCobrancas(r.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]"><RotateCcw size={13} /> Desfazer cobranças</button>
                : <button onClick={() => setStatus(r.id, 'revisar')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]"><RotateCcw size={13} /> Reabrir</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60'
const labelCls = 'block text-[10px] text-[#6b6b6b] uppercase mb-1'

function RateioModal({ initial, onClose }: { initial?: RateioConsumo; onClose: () => void }) {
  const { addRateio, updateRateio } = useRateioConsumoStore()
  const sites = useTorreStore((s) => s.sites)
  const [periodo, setPeriodo] = useState(initial?.periodo ?? new Date().toISOString().slice(0, 7))
  const [tipo, setTipo] = useState<RateioTipo>(initial?.tipo ?? 'agua')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor ?? '')
  const [valorTotal, setValorTotal] = useState(initial ? String(initial.valorTotalFatura) : '')
  const [base, setBase] = useState<RateioBase>(initial?.base ?? 'leitura')
  const [itens, setItens] = useState<RateioItem[]>(initial?.itens ?? [{ id: uid(), unidade: '', base: 0 }])

  const setItem = (id: string, patch: Partial<RateioItem>) => setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const addItem = () => setItens((prev) => [...prev, { id: uid(), unidade: '', base: 0 }])
  const delItem = (id: string) => setItens((prev) => prev.filter((it) => it.id !== id))

  const valorNum = parseFloat(valorTotal.replace(/\./g, '').replace(',', '.')) || 0
  const totalBase = itens.reduce((s, it) => s + (Number(it.base) || 0), 0)

  function save() {
    const validItens = itens.filter((it) => it.unidade.trim() && (Number(it.base) || 0) > 0)
    if (validItens.length === 0 || valorNum <= 0) return
    const payload = { periodo, tipo, descricao: descricao || undefined, fornecedor: fornecedor || undefined, valorTotalFatura: valorNum, base, itens: validItens }
    if (initial) updateRateio(initial.id, payload)
    else addRateio(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-xl bg-[#2c2c2c] border border-[#525252] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <h2 className="text-sm font-semibold text-white">{initial ? 'Editar rateio' : 'Novo rateio'}</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-3 overflow-auto">
          <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden">
            {(['agua', 'energia'] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tipo === t ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}>
                {t === 'agua' ? 'Água' : 'Energia'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Período</label><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Fatura total (R$) *</label><input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Fornecedor</label><input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="SABESP, Enel…" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Base do rateio</label>
              <select value={base} onChange={(e) => setBase(e.target.value as RateioBase)} className={inputCls}>
                {(Object.keys(BASE_LABEL) as RateioBase[]).map((b) => <option key={b} value={b}>{BASE_LABEL[b]}</option>)}
              </select>
            </div>
          </div>
          <div><label className={labelCls}>Descrição</label><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Água — condomínio" className={inputCls} /></div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Unidades / consumidores</label>
              <button onClick={addItem} className="text-[10px] text-[#f97316] hover:text-[#fb923c] flex items-center gap-1"><Plus size={11} /> unidade</button>
            </div>
            <div className="space-y-1.5">
              {itens.map((it) => (
                <div key={it.id} className="flex items-center gap-1.5">
                  <input value={it.unidade} onChange={(e) => setItem(it.id, { unidade: e.target.value })} placeholder="Unidade" className="flex-1 bg-[#333333] border border-[#525252] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#f97316]/60" />
                  <select value={it.obraId ?? ''} onChange={(e) => setItem(it.id, { obraId: e.target.value || undefined })} className="w-28 bg-[#333333] border border-[#525252] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#f97316]/60">
                    <option value="">— Obra —</option>
                    {sites.map((o) => <option key={o.id} value={o.id}>{o.code || o.name}</option>)}
                  </select>
                  <input type="number" min={0} step="any" value={it.base || ''} onChange={(e) => setItem(it.id, { base: Math.max(0, Number(e.target.value) || 0) })} placeholder={base === 'proporcao' ? '%' : base === 'area' ? 'm²' : 'leitura'} className="w-20 bg-[#333333] border border-[#525252] rounded px-2 py-1.5 text-[11px] text-white text-right outline-none focus:border-[#f97316]/60" />
                  <button onClick={() => delItem(it.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#6b6b6b]">
              <span>Total base: {totalBase.toLocaleString('pt-BR')}{base === 'proporcao' ? '%' : ''}</span>
              {base === 'proporcao' && Math.abs(totalBase - 100) > 0.01 && <span className="text-amber-400">proporções deveriam somar 100%</span>}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#525252] shrink-0">
          <button onClick={save} className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors">
            {initial ? 'Salvar alterações' : 'Criar rateio'}
          </button>
        </div>
      </div>
    </div>
  )
}
