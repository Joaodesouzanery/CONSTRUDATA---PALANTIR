/**
 * BoletosPanel — aba "Boletos" do Financeiro. Um boleto = N títulos-parcela agrupados por
 * `boletoId` (vide financeiroTitulosStore.addBoleto). Cadastra vencimento, datas das parcelas,
 * código do boleto (linha digitável), alertas e FOTOS; a "baixa" por parcela reusa baixarTitulo
 * → lança no Fluxo/DRE. Fotos no bucket `boletos` (só o caminho fica no payload). Escopo por org
 * (e obra opcional). Molde: PagamentosPanel.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Check, RotateCcw, X, AlertTriangle, CalendarClock, FileText, Barcode, Paperclip, Image as ImageIcon } from 'lucide-react'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { fmtBRL, ENTRADA_CAT_LABELS, SAIDA_CAT_LABELS } from '../lib/financeiroCalc'
import { uploadBoletoFile, signedBoletoUrl, removeBoletoFile } from '../utils/boletoStorage'
import type { FinanceiroTitulo, TituloTipo, EntradaCategoria, SaidaCategoria, TituloAnexo } from '@/types'

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60'
const labelCls = 'block text-[10px] text-[#6b6b6b] uppercase mb-1'
const DEFAULT_ALERTA = 7

function today() { return new Date().toISOString().slice(0, 10) }
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10)
}
function diasAte(venc: string, hoje: string): number {
  return Math.round((new Date(venc + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86_400_000)
}

/** Grupo de parcelas de um boleto (o "head" traz os campos compartilhados). */
interface BoletoGroup { boletoId: string; parcelas: FinanceiroTitulo[]; head: FinanceiroTitulo }

export function BoletosPanel() {
  const { titulos, baixarTitulo, desfazerBaixa, removeBoleto } = useFinanceiroTitulosStore()
  const sites = useTorreStore((s) => s.sites)
  const hoje = today()

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<BoletoGroup | null>(null)
  const [deleting, setDeleting] = useState<BoletoGroup | null>(null)
  const [baixaId, setBaixaId] = useState<string | null>(null)
  const [fTipo, setFTipo] = useState<'' | TituloTipo>('')
  const [fObra, setFObra] = useState('')
  const [busca, setBusca] = useState('')

  const siteName = useMemo(() => {
    const m = new Map(sites.map((s) => [s.id, s.code ? `${s.code} — ${s.name}` : s.name]))
    return (id?: string) => (id ? (m.get(id) ?? '—') : '—')
  }, [sites])

  const boletos = useMemo<BoletoGroup[]>(() => {
    const map = new Map<string, FinanceiroTitulo[]>()
    for (const t of titulos) if (t.boletoId) { const arr = map.get(t.boletoId) ?? []; arr.push(t); map.set(t.boletoId, arr) }
    const q = busca.trim().toLowerCase()
    return [...map.entries()]
      .map(([boletoId, ps]) => {
        const parcelas = ps.slice().sort((a, b) => (a.parcelaNum ?? 0) - (b.parcelaNum ?? 0))
        return { boletoId, parcelas, head: parcelas[0] }
      })
      .filter((g) => {
        if (fTipo && g.head.tipo !== fTipo) return false
        if (fObra && (g.head.obraId ?? '') !== fObra) return false
        if (q && !(`${g.head.descricao} ${g.head.parceiro} ${g.head.codigoBoleto ?? ''}`.toLowerCase().includes(q))) return false
        return true
      })
      .sort((a, b) => a.parcelas[0].vencimento.localeCompare(b.parcelas[0].vencimento))
  }, [titulos, fTipo, fObra, busca])

  // Stat cards (sobre parcelas de boletos, não o filtro).
  const parcelasBoleto = titulos.filter((t) => t.boletoId)
  const pend = parcelasBoleto.filter((t) => t.status === 'pendente')
  const vencidas = pend.filter((t) => t.vencimento < hoje)
  const em7 = new Date(new Date(hoje + 'T00:00:00').getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  const aVencer = pend.filter((t) => t.vencimento >= hoje && t.vencimento <= em7)
  const totalPend = pend.reduce((s, t) => s + t.valor, 0)

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText size={18} className="text-[#38bdf8]" />} label="Boletos" value={String(new Set(parcelasBoleto.map((t) => t.boletoId)).size)} />
        <StatCard icon={<CalendarClock size={18} className="text-amber-400" />} label="Total pendente" value={fmtBRL(totalPend)} tone="text-amber-400" />
        <StatCard icon={<AlertTriangle size={18} className="text-red-400" />} label={`Parcelas vencidas (${vencidas.length})`} value={fmtBRL(vencidas.reduce((s, t) => s + t.valor, 0))} tone="text-red-400" />
        <StatCard icon={<CalendarClock size={18} className="text-amber-400" />} label={`A vencer 7 dias (${aVencer.length})`} value={fmtBRL(aVencer.reduce((s, t) => s + t.valor, 0))} tone="text-amber-400" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#333333] p-3">
        <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden">
          {([['', 'Todos'], ['pagar', 'A pagar'], ['receber', 'A receber']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFTipo(k)} className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${fTipo === k ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}>{label}</button>
          ))}
        </div>
        <select value={fObra} onChange={(e) => setFObra(e.target.value)} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60">
          <option value="">Todas as obras</option>
          {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar beneficiário/descrição/código…" className="flex-1 min-w-[160px] bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60" />
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"><Plus size={14} /> Novo boleto</button>
      </div>

      {boletos.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          {parcelasBoleto.length === 0 ? 'Nenhum boleto cadastrado. Clique em "Novo boleto" para adicionar vencimentos, parcelas, código e fotos.' : 'Nenhum boleto no filtro selecionado.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {boletos.map((g) => (
            <BoletoCard key={g.boletoId} g={g} hoje={hoje} siteName={siteName} onBaixa={setBaixaId} onDesfazer={desfazerBaixa} onEdit={() => setEditing(g)} onDelete={() => setDeleting(g)} />
          ))}
        </div>
      )}

      {showAdd && <BoletoModal onClose={() => setShowAdd(false)} />}
      {editing && <BoletoModal edit={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={baixaId !== null}
        title="Dar baixa na parcela"
        message="Marca a parcela como paga e gera o lançamento no Financeiro (entra no Fluxo e na DRE). Você pode desfazer depois."
        confirmLabel="Confirmar baixa"
        onConfirm={() => { if (baixaId) baixarTitulo(baixaId); setBaixaId(null) }}
        onCancel={() => setBaixaId(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir boleto"
        message="Remove o boleto e todas as suas parcelas. As baixas já lançadas no Financeiro também são estornadas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (deleting) {
            // Apaga as fotos do bucket (parcelas compartilham os mesmos paths → dedupe).
            const paths = new Set(deleting.parcelas.flatMap((p) => (p.anexos ?? []).map((a) => a.path)))
            paths.forEach((p) => void removeBoletoFile(p))
            removeBoleto(deleting.boletoId)
          }
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
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

// ─── Card de um boleto ────────────────────────────────────────────────────────
function BoletoCard({ g, hoje, siteName, onBaixa, onDesfazer, onEdit, onDelete }: {
  g: BoletoGroup; hoje: string; siteName: (id?: string) => string
  onBaixa: (id: string) => void; onDesfazer: (id: string) => void; onEdit: () => void; onDelete: () => void
}) {
  const { head, parcelas } = g
  const total = parcelas.reduce((s, p) => s + p.valor, 0)
  const pagas = parcelas.filter((p) => p.status === 'pago').length
  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4 group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', head.tipo === 'pagar' ? 'bg-red-400/10 text-red-400' : 'bg-emerald-400/10 text-emerald-400')}>{head.tipo === 'pagar' ? 'A pagar' : 'A receber'}</span>
            <p className="truncate text-sm font-semibold text-white">{head.descricao}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#a3a3a3]">{head.parceiro || '—'}{head.obraId ? ` · ${siteName(head.obraId)}` : ''}</p>
          {head.codigoBoleto && <p className="mt-1 flex items-center gap-1 truncate font-mono text-[10px] text-[#6b6b6b]"><Barcode size={11} /> {head.codigoBoleto}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-white">{fmtBRL(total)}</p>
            <p className="text-[10px] text-[#6b6b6b]">{pagas}/{parcelas.length} pagas</p>
          </div>
          <button onClick={onEdit} title="Editar dados do boleto" className="p-1 rounded text-[#a3a3a3] opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-[#f97316]"><Pencil size={13} /></button>
          <button onClick={onDelete} title="Excluir boleto" className="p-1 rounded text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20"><Trash2 size={13} /></button>
        </div>
      </div>

      {head.anexos && head.anexos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">{head.anexos.map((a) => <BoletoFoto key={a.path} anexo={a} />)}</div>
      )}

      <div className="mt-3 divide-y divide-[#1f2937] rounded-lg border border-[#525252] bg-[#2c2c2c]">
        {parcelas.map((p) => {
          const dias = diasAte(p.vencimento, hoje)
          const vencido = p.status === 'pendente' && dias < 0
          const aVencer = p.status === 'pendente' && dias >= 0 && dias <= (p.alertaDias ?? DEFAULT_ALERTA)
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b6b] tabular-nums">{p.parcelaNum}/{p.parcelaDe}</span>
                <span className={cn('tabular-nums', vencido ? 'font-semibold text-red-400' : aVencer ? 'text-amber-400' : 'text-[#d4d4d4]')}>
                  {p.vencimento}{p.status === 'pendente' && (vencido ? ` · venceu há ${-dias}d` : aVencer ? ` · vence em ${dias}d` : '')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-white">{fmtBRL(p.valor)}</span>
                {p.status === 'pago' ? (
                  <button onClick={() => onDesfazer(p.id)} title="Desfazer baixa" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-emerald-400 hover:bg-white/10"><Check size={12} /> pago <RotateCcw size={11} /></button>
                ) : (
                  <button onClick={() => onBaixa(p.id)} title="Dar baixa (registrar pagamento)" className="rounded p-1 text-emerald-400 hover:bg-emerald-500/20"><Check size={14} /></button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BoletoFoto({ anexo, onRemove }: { anexo: TituloAnexo; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let ok = true; void signedBoletoUrl(anexo.path).then((u) => { if (ok) setUrl(u) }); return () => { ok = false } }, [anexo.path])
  return (
    <div className="relative h-16 w-16 shrink-0">
      <a href={url ?? undefined} target="_blank" rel="noopener noreferrer" title={anexo.nome} className="block h-full w-full overflow-hidden rounded-lg border border-[#525252] bg-[#1f1f1f]">
        {url ? <img src={url} alt={anexo.nome} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[#6b6b6b]"><ImageIcon size={16} /></div>}
      </a>
      {onRemove && <button type="button" onClick={onRemove} className="absolute -right-1.5 -top-1.5 rounded-full border border-[#525252] bg-black/80 p-0.5 text-white hover:text-red-400"><X size={11} /></button>}
    </div>
  )
}

// ─── Modal de criação / edição (campos compartilhados) ────────────────────────
interface ParcelaRow { vencimento: string; valor: string; alertaDias: string }

function BoletoModal({ edit, onClose }: { edit?: BoletoGroup; onClose: () => void }) {
  const { addBoleto, updateBoleto } = useFinanceiroTitulosStore()
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const head = edit?.head

  const [tipo, setTipo] = useState<TituloTipo>(head?.tipo ?? 'pagar')
  const [descricao, setDescricao] = useState(head?.descricao ?? '')
  const [parceiro, setParceiro] = useState(head?.parceiro ?? '')
  const [codigoBoleto, setCodigoBoleto] = useState(head?.codigoBoleto ?? '')
  const [obraId, setObraId] = useState(head?.obraId ?? activeObraId ?? '')
  const [categoria, setCategoria] = useState<string>(head?.categoria ?? '')
  const [notas, setNotas] = useState(head?.notas ?? '')
  const [anexos, setAnexos] = useState<TituloAnexo[]>(head?.anexos ?? [])
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Só apaga do bucket APÓS salvar: remover uma foto e cancelar não pode deixar
  // referência quebrada no boleto persistido (espelha o modal de laudos).
  const trashRef = useRef<string[]>([])
  // Fotos enviadas nesta sessão do modal: se fechar SEM salvar, são apagadas (não ficam órfãs).
  const uploadedRef = useRef<string[]>([])
  // Parcelas só na CRIAÇÃO (na edição, alteram-se pelos botões do card).
  const [parcelas, setParcelas] = useState<ParcelaRow[]>(
    edit ? edit.parcelas.map((p) => ({ vencimento: p.vencimento, valor: String(p.valor), alertaDias: String(p.alertaDias ?? DEFAULT_ALERTA) }))
         : [{ vencimento: today(), valor: '', alertaDias: String(DEFAULT_ALERTA) }],
  )

  const cats = tipo === 'pagar'
    ? (Object.entries(SAIDA_CAT_LABELS) as [SaidaCategoria, string][])
    : (Object.entries(ENTRADA_CAT_LABELS) as [EntradaCategoria, string][])

  const parseValor = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
  const setRow = (i: number, patch: Partial<ParcelaRow>) => setParcelas((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  /** Gera N parcelas mensais a partir da 1ª, dividindo um valor total (conveniência). */
  function gerarParcelas() {
    const n = Math.max(1, Math.min(60, Number(prompt('Quantas parcelas?', '2')) || 0))
    if (n < 1) return
    const totalStr = prompt('Valor TOTAL do boleto (R$)? (deixe vazio para preencher manualmente)', '') ?? ''
    const total = parseValor(totalStr)
    const primeiro = parcelas[0]?.vencimento || today()
    const cada = total > 0 ? Math.round((total / n) * 100) / 100 : 0
    const ultima = total > 0 ? Math.round((total - cada * (n - 1)) * 100) / 100 : 0
    setParcelas(Array.from({ length: n }, (_, i) => ({
      vencimento: addMonths(primeiro, i),
      // pt-BR ("333,33") p/ fazer round-trip correto por parseValor (ponto seria removido → inflaria 100×).
      valor: total > 0 ? (i === n - 1 ? ultima : cada).toFixed(2).replace('.', ',') : '',
      alertaDias: String(DEFAULT_ALERTA),
    })))
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true); setErro(null)
    try {
      for (const f of files) { const path = await uploadBoletoFile(f); uploadedRef.current.push(path); setAnexos((a) => [...a, { path, nome: f.name }]) }
    } catch { setErro('Falha ao enviar a foto. Tente novamente.') } finally { setUploading(false) }
  }
  // Fechar sem salvar: apaga as fotos enviadas nesta sessão (não persistidas → seriam órfãs).
  function handleClose() { uploadedRef.current.forEach((p) => void removeBoletoFile(p)); uploadedRef.current = []; onClose() }
  // Remove da lista local + marca para exclusão no bucket (efetivada só ao salvar).
  function removeAnexo(path: string) { setAnexos((a) => a.filter((x) => x.path !== path)); trashRef.current.push(path) }
  const flushTrash = () => { trashRef.current.forEach((p) => void removeBoletoFile(p)); trashRef.current = [] }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) return setErro('Informe a descrição.')
    const cat = (categoria || undefined) as EntradaCategoria | SaidaCategoria | undefined

    if (edit) {
      // Edição: só os campos compartilhados (parcelas alteram-se pelo card).
      updateBoleto(edit.boletoId, { tipo, descricao: descricao.trim(), parceiro: parceiro.trim(), obraId: obraId || undefined, categoria: cat, codigoBoleto: codigoBoleto.trim() || undefined, anexos, notas: notas.trim() || undefined })
      flushTrash(); onClose(); return
    }

    const rows = parcelas
      .map((r) => ({ vencimento: r.vencimento, valor: parseValor(r.valor), alertaDias: Number(r.alertaDias) || undefined }))
      .filter((r) => r.vencimento && r.valor > 0)
    if (rows.length === 0) return setErro('Adicione ao menos uma parcela com vencimento e valor.')
    addBoleto({ tipo, descricao: descricao.trim(), parceiro: parceiro.trim(), obraId: obraId || undefined, categoria: cat, codigoBoleto: codigoBoleto.trim() || undefined, anexos, notas: notas.trim() || undefined, parcelas: rows })
    flushTrash(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl p-5 space-y-4 bg-[#2c2c2c] border border-[#525252] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{edit ? 'Editar boleto' : 'Novo boleto'}</h2>
          <button type="button" onClick={handleClose} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
        </div>

        <div className="inline-flex rounded-lg border border-[#525252] overflow-hidden">
          {([['pagar', 'A pagar'], ['receber', 'A receber']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setTipo(k); setCategoria('') }} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tipo === k ? (k === 'pagar' ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white') : 'text-[#a3a3a3] hover:text-white bg-[#2c2c2c]'}`}>{label}</button>
          ))}
        </div>

        <div>
          <label className={labelCls}>Descrição *</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Tintas Unitintas — pedido 027" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{tipo === 'pagar' ? 'Beneficiário' : 'Pagador'}</label>
            <input value={parceiro} onChange={(e) => setParceiro(e.target.value)} placeholder="Nome" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Código do boleto (linha digitável)</label>
            <input value={codigoBoleto} onChange={(e) => setCodigoBoleto(e.target.value)} placeholder="00000.00000 00000..." className={inputCls} />
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
          <div>
            <label className={labelCls}>Categoria (lançamento na baixa)</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
              <option value="">Automática</option>
              {cats.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>

        {/* Parcelas */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelCls + ' mb-0'}>Parcelas *</label>
            {!edit && (
              <div className="flex gap-2">
                <button type="button" onClick={gerarParcelas} className="text-[10px] text-[#a3a3a3] hover:text-[#f97316]">gerar mensais</button>
                <button type="button" onClick={() => setParcelas((r) => [...r, { vencimento: addMonths(r[r.length - 1]?.vencimento || today(), 1), valor: '', alertaDias: String(DEFAULT_ALERTA) }])} className="text-[10px] text-[#f97316] hover:underline">+ parcela</button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-[9px] uppercase text-[#6b6b6b]"><span>Vencimento</span><span>Valor (R$)</span><span>Alerta</span><span /></div>
            {parcelas.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                <input type="date" value={r.vencimento} disabled={!!edit} onChange={(e) => setRow(i, { vencimento: e.target.value })} className={cn(inputCls, edit && 'opacity-60')} />
                <input value={r.valor} disabled={!!edit} onChange={(e) => setRow(i, { valor: e.target.value })} placeholder="0,00" className={cn(inputCls, edit && 'opacity-60')} />
                <div className="flex items-center gap-1"><input type="number" min={0} value={r.alertaDias} disabled={!!edit} onChange={(e) => setRow(i, { alertaDias: e.target.value })} className={cn(inputCls, 'w-14', edit && 'opacity-60')} /><span className="text-[9px] text-[#6b6b6b]">d</span></div>
                {!edit && parcelas.length > 1
                  ? <button type="button" onClick={() => setParcelas((rows) => rows.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={12} /></button>
                  : <span className="w-6" />}
              </div>
            ))}
          </div>
          {edit && <p className="mt-1 text-[10px] text-[#6b6b6b]">Para alterar parcelas, use os botões de baixa no card (ou exclua e recrie o boleto).</p>}
        </div>

        {/* Fotos */}
        <div>
          <label className={labelCls}>Fotos do boleto</label>
          <div className="flex flex-wrap items-center gap-2">
            {anexos.map((a) => <BoletoFoto key={a.path} anexo={a} onRemove={() => removeAnexo(a.path)} />)}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-[11px] font-semibold text-[#e5e5e5] hover:bg-[#3f3f3f]">
              <Paperclip size={13} /> {uploading ? 'Enviando…' : 'Adicionar foto'}
              <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={onFiles} disabled={uploading} />
            </label>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notas</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
        </div>

        {erro && <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-[11px] text-red-300">{erro}</p>}

        <button type="submit" disabled={uploading} className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-60">
          {edit ? 'Salvar alterações' : 'Adicionar boleto'}
        </button>
      </form>
    </div>
  )
}
