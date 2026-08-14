/**
 * PagamentosPanel — Contas a pagar / a receber ("Pagamentos e Cobranças").
 * Lista com filtros (tipo, status, obra, vencimento, busca), stat cards com
 * alertas de vencimento, parcelas, e "Baixar" (gera lançamento no Financeiro
 * via financeiroTitulosStore.baixarTitulo → alimenta Fluxo/DRE).
 */
import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Check, RotateCcw, X, AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock } from 'lucide-react'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useAuth } from '@/lib/auth'
import { canWriteTitulos } from '@/lib/roles'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { fmtBRL, ENTRADA_CAT_LABELS, SAIDA_CAT_LABELS } from '../lib/financeiroCalc'
import { digitosDe, formatarCodigo } from '../utils/boletoCodigo'
import type { FinanceiroTitulo, TituloTipo, TituloStatus, EntradaCategoria, SaidaCategoria } from '@/types'
import { useEnvioUnico } from '@/hooks/useEnvioUnico'

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60'
const labelCls = 'block text-[10px] text-[#6b6b6b] uppercase mb-1'

function today() { return new Date().toISOString().slice(0, 10) }
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

/** Status derivado para exibição — "vencido" = pendente com vencimento no passado. */
type DisplayStatus = TituloStatus | 'vencido'
function displayStatus(t: FinanceiroTitulo, hoje: string): DisplayStatus {
  if (t.status === 'pendente' && t.vencimento < hoje) return 'vencido'
  return t.status
}
const STATUS_META: Record<DisplayStatus, { label: string; color: string }> = {
  pendente:  { label: 'Pendente',  color: 'text-amber-400 bg-amber-400/10' },
  vencido:   { label: 'Vencido',   color: 'text-red-400 bg-red-400/10' },
  pago:      { label: 'Pago',      color: 'text-emerald-400 bg-emerald-400/10' },
  cancelado: { label: 'Cancelado', color: 'text-[#6b6b6b] bg-white/5' },
}

export function PagamentosPanel() {
  const { titulos, removeTitulo, baixarTitulo, desfazerBaixa } = useFinanceiroTitulosStore()
  const sites = useTorreStore((s) => s.sites)
  const hoje = today()
  // Gate espelha a RLS de financeiro_titulos (papéis fora da lista → op presa no pendingSync).
  const podeEscrever = canWriteTitulos(useAuth((s) => s.profile?.role))

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<FinanceiroTitulo | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [baixaId, setBaixaId] = useState<string | null>(null)

  const [fTipo, setFTipo] = useState<'' | TituloTipo>('')
  const [fStatus, setFStatus] = useState<'' | DisplayStatus>('')
  const [fObra, setFObra] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [busca, setBusca] = useState('')

  const siteName = useMemo(() => {
    const m = new Map(sites.map((s) => [s.id, s.code ? `${s.code} — ${s.name}` : s.name]))
    return (id?: string) => (id ? (m.get(id) ?? '—') : '—')
  }, [sites])

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    // Parcelas de boleto guardam a linha digitável (só dígitos) em numeroDoc: comparar também
    // por dígitos acha o título mesmo quando se cola o código com pontos e espaços.
    const qDigitos = digitosDe(q)
    return titulos
      .filter((t) => {
        if (fTipo && t.tipo !== fTipo) return false
        if (fStatus && displayStatus(t, hoje) !== fStatus) return false
        if (fObra && (t.obraId ?? '') !== fObra) return false
        if (fFrom && t.vencimento < fFrom) return false
        if (fTo && t.vencimento > fTo) return false
        if (q) {
          const texto = `${t.descricao} ${t.parceiro} ${t.numeroDoc ?? ''}`.toLowerCase()
          const achouCodigo = qDigitos.length >= 6 && digitosDe(t.numeroDoc).includes(qDigitos)
          if (!texto.includes(q) && !achouCodigo) return false
        }
        return true
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [titulos, fTipo, fStatus, fObra, fFrom, fTo, busca, hoje])

  // Stat cards (sobre TODOS os títulos pendentes, não o filtro)
  const pend = titulos.filter((t) => t.status === 'pendente')
  const aPagar = pend.filter((t) => t.tipo === 'pagar').reduce((s, t) => s + t.valor, 0)
  const aReceber = pend.filter((t) => t.tipo === 'receber').reduce((s, t) => s + t.valor, 0)
  const vencidos = pend.filter((t) => t.vencimento < hoje)
  const vencidosVal = vencidos.reduce((s, t) => s + t.valor, 0)
  const em7 = new Date(new Date(hoje + 'T00:00:00').getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  const aVencer = pend.filter((t) => t.vencimento >= hoje && t.vencimento <= em7)
  const aVencerVal = aVencer.reduce((s, t) => s + t.valor, 0)

  return (
    <div className="p-6 space-y-5 overflow-auto">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ArrowUpCircle size={18} className="text-red-400" />} label="A pagar (pendente)" value={fmtBRL(aPagar)} tone="text-red-400" />
        <StatCard icon={<ArrowDownCircle size={18} className="text-emerald-400" />} label="A receber (pendente)" value={fmtBRL(aReceber)} tone="text-emerald-400" />
        <StatCard icon={<AlertTriangle size={18} className="text-red-400" />} label={`Vencidos (${vencidos.length})`} value={fmtBRL(vencidosVal)} tone="text-red-400" />
        <StatCard icon={<CalendarClock size={18} className="text-amber-400" />} label={`A vencer 7 dias (${aVencer.length})`} value={fmtBRL(aVencerVal)} tone="text-amber-400" />
      </div>

      {/* Toolbar de filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#333333] p-3">
        <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden">
          {([['', 'Todos'], ['pagar', 'A pagar'], ['receber', 'A receber']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFTipo(k)} className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${fTipo === k ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}>{label}</button>
          ))}
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as '' | DisplayStatus)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="vencido">Vencido</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={fObra} onChange={(e) => setFObra(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60">
          <option value="">Todas as obras</option>
          {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" aria-label="Vencimento de" />
          <span className="text-[#6b6b6b] text-xs">até</span>
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" aria-label="Vencimento até" />
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar parceiro/descrição…" className="flex-1 min-w-[160px] bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" />
        {podeEscrever && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors">
            <Plus size={14} /> Novo Título
          </button>
        )}
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          {titulos.length === 0 ? 'Nenhum título cadastrado. Adicione contas a pagar ou a receber.' : 'Nenhum título no filtro selecionado.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Parceiro</th>
                <th className="px-3 py-2 text-left">Obra</th>
                <th className="px-3 py-2 text-left">Vencimento</th>
                <th className="px-3 py-2 text-center">Parc.</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {filtered.map((t) => {
                const ds = displayStatus(t, hoje)
                const meta = STATUS_META[ds]
                const isPago = t.status === 'pago'
                return (
                  <tr key={t.id} className="hover:bg-white/[0.02] group">
                    <td className="px-3 py-2">
                      {t.tipo === 'pagar'
                        ? <span className="inline-flex items-center gap-1 text-red-400"><ArrowUpCircle size={13} /> Pagar</span>
                        : <span className="inline-flex items-center gap-1 text-emerald-400"><ArrowDownCircle size={13} /> Receber</span>}
                    </td>
                    <td className="px-3 py-2 text-white">
                      {t.descricao}
                      {/* Linha digitável de boleto tem 47/48 dígitos: formata e trunca para não
                          estourar a coluna (formatarCodigo devolve intacto o que não for código). */}
                      {t.numeroDoc && (
                        <span className="ml-1.5 inline-block max-w-[16rem] truncate align-bottom text-[10px] text-[#6b6b6b]" title={formatarCodigo(t.numeroDoc)}>
                          {formatarCodigo(t.numeroDoc)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[#d4d4d4]">{t.parceiro || '—'}</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{siteName(t.obraId)}</td>
                    <td className={`px-3 py-2 tabular-nums ${ds === 'vencido' ? 'text-red-400 font-semibold' : 'text-[#a3a3a3]'}`}>{t.vencimento}</td>
                    <td className="px-3 py-2 text-center text-[#a3a3a3]">{t.parcelaDe && t.parcelaDe > 1 ? `${t.parcelaNum}/${t.parcelaDe}` : '—'}</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${t.tipo === 'receber' ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(t.valor)}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>{meta.label}</span></td>
                    <td className="px-3 py-2">
                      {podeEscrever && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {isPago ? (
                            <button onClick={() => desfazerBaixa(t.id)} title="Desfazer baixa" className="p-1 rounded text-[#a3a3a3] hover:bg-white/10 hover:text-amber-400"><RotateCcw size={13} /></button>
                          ) : (
                            <button onClick={() => setBaixaId(t.id)} title="Dar baixa (registrar pagamento)" className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"><Check size={14} /></button>
                          )}
                          <button onClick={() => setEditing(t)} title="Editar" className="p-1 rounded text-[#a3a3a3] hover:bg-white/10 hover:text-[#f97316]"><Pencil size={12} /></button>
                          <button onClick={() => setDeletingId(t.id)} title="Excluir" className="p-1 rounded text-red-400 hover:bg-red-500/20"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <TituloModal onClose={() => setShowAdd(false)} />}
      {editing && <TituloModal initial={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={baixaId !== null}
        title="Dar baixa no título"
        message="Isto marca o título como pago e gera o lançamento correspondente no Financeiro (entra no Fluxo e na DRE). Você pode desfazer depois."
        confirmLabel="Confirmar baixa"
        onConfirm={() => { if (baixaId) baixarTitulo(baixaId); setBaixaId(null) }}
        onCancel={() => setBaixaId(null)}
      />
      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir título"
        message="O título será removido. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => { if (deletingId) removeTitulo(deletingId); setDeletingId(null) }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <p className={`text-lg font-bold tabular-nums ${tone || 'text-white'}`}>{value}</p>
    </div>
  )
}

// ─── Modal de criação/edição ──────────────────────────────────────────────────
function TituloModal({ initial, onClose }: { initial?: FinanceiroTitulo; onClose: () => void }) {
  const { addTitulo, addTitulos, updateTitulo } = useFinanceiroTitulosStore()
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  const [tipo, setTipo] = useState<TituloTipo>(initial?.tipo ?? 'pagar')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [parceiro, setParceiro] = useState(initial?.parceiro ?? '')
  const [valor, setValor] = useState(initial ? String(initial.valor) : '')
  const [vencimento, setVencimento] = useState(initial?.vencimento ?? today())
  const [emissao, setEmissao] = useState(initial?.emissao ?? '')
  const [obraId, setObraId] = useState(initial?.obraId ?? activeObraId ?? '')
  const [numeroDoc, setNumeroDoc] = useState(initial?.numeroDoc ?? '')
  const [categoria, setCategoria] = useState<string>(initial?.categoria ?? '')
  const [parcelas, setParcelas] = useState('1')

  const cats = tipo === 'pagar'
    ? (Object.entries(SAIDA_CAT_LABELS) as [SaidaCategoria, string][])
    : (Object.entries(ENTRADA_CAT_LABELS) as [EntradaCategoria, string][])

  const travarEnvio = useEnvioUnico()
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valorNum = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
    if (!descricao || valorNum <= 0) return
    if (!travarEnvio()) return
    const cat = (categoria || undefined) as EntradaCategoria | SaidaCategoria | undefined
    const base = {
      tipo, descricao, parceiro, obraId: obraId || undefined,
      numeroDoc: numeroDoc || undefined, categoria: cat,
      emissao: emissao || undefined,
    }

    if (initial) {
      updateTitulo(initial.id, { ...base, valor: valorNum, vencimento })
      onClose()
      return
    }

    const n = Math.max(1, Math.min(60, parseInt(parcelas, 10) || 1))
    if (n === 1) {
      addTitulo({ ...base, valor: valorNum, vencimento })
    } else {
      const cada = Math.round((valorNum / n) * 100) / 100
      // Última parcela absorve o arredondamento p/ somar exatamente o valor.
      const ultima = Math.round((valorNum - cada * (n - 1)) * 100) / 100
      const list = Array.from({ length: n }, (_, i) => ({
        ...base,
        descricao: `${descricao} (${i + 1}/${n})`,
        valor: i === n - 1 ? ultima : cada,
        vencimento: addMonths(vencimento, i),
        parcelaNum: i + 1,
        parcelaDe: n,
      }))
      addTitulos(list)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl p-5 space-y-4 bg-[#2c2c2c] border border-[#525252] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{initial ? 'Editar Título' : 'Novo Título'}</h2>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
        </div>

        <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden">
          {([['pagar', 'A pagar'], ['receber', 'A receber']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setTipo(k); setCategoria('') }} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tipo === k ? (k === 'pagar' ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white') : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}>{label}</button>
          ))}
        </div>

        <div>
          <label className={labelCls}>Descrição *</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required placeholder="Ex: Tubos PEAD — parcela" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}</label>
            <input value={parceiro} onChange={(e) => setParceiro(e.target.value)} placeholder="Nome" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nº documento</label>
            <input value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="NF, boleto…" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Valor (R$) *</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} required placeholder="0,00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vencimento *</label>
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Emissão</label>
            <input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Categoria (lançamento na baixa)</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
              <option value="">Automática</option>
              {cats.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Obra</label>
            <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={inputCls}>
              <option value="">— Sem obra —</option>
              {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
            </select>
          </div>
          {!initial && (
            <div>
              <label className={labelCls}>Parcelas</label>
              <input type="number" min={1} max={60} value={parcelas} onChange={(e) => setParcelas(e.target.value)} className={inputCls} />
              {Number(parcelas) > 1 && <p className="text-[10px] text-[#6b6b6b] mt-1">Gera {parcelas} títulos mensais.</p>}
            </div>
          )}
        </div>

        <button type="submit" className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors">
          {initial ? 'Salvar Alterações' : 'Adicionar Título'}
        </button>
      </form>
    </div>
  )
}
