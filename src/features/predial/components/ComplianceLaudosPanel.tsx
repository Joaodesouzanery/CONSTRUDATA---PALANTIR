/**
 * ComplianceLaudosPanel — Tela "Compliance de Laudos" do Predial. Uma linha por obrigação
 * legal recorrente do prédio (AVCB, SPDA, caixa d'água, dedetização, gás, pressurização,
 * elevadores, extintores) com semáforo de vencimento. Determinístico; alerta por e-mail
 * 60/30/7 é fase 2. Documento anexo reusa o bucket `predial-ativos`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Paperclip, Pencil, Plus, RefreshCcw, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useLaudosStore, type Laudo } from '@/store/laudosStore'
import { LAUDO_TIPOS, LAUDO_PERIODICIDADE_PADRAO, laudoStatus, laudoDiasRestantes, addMonthsISO, type LaudoStatusCor } from '../utils/laudos'
import { removePredialAtivoFile, signedPredialAtivoUrl, uploadPredialAtivoFile } from '@/features/manutencoes/utils/predialAtivoStorage'

const inputClass = 'w-full rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#737373] focus:border-[#f97316]/70'
const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]'
const COR_CLS: Record<LaudoStatusCor, { dot: string; text: string }> = {
  verde:    { dot: 'bg-[#22c55e]', text: 'text-[#4ade80]' },
  amarelo:  { dot: 'bg-[#eab308]', text: 'text-[#fbbf24]' },
  vermelho: { dot: 'bg-[#ef4444]', text: 'text-[#f87171]' },
  cinza:    { dot: 'bg-[#525252]', text: 'text-[#737373]' },
}
const fmtBR = (iso?: string) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—')
type StatusFiltro = 'todos' | 'vencidos' | 'vencendo' | 'emdia' | 'sem'

export function ComplianceLaudosPanel() {
  const profileOrgId = useAuth((s) => s.profile?.organization_id ?? null)
  const laudos = useLaudosStore((s) => s.laudos)
  const pull = useLaudosStore((s) => s.pull)
  const ensureTenantScope = useLaudosStore((s) => s.ensureTenantScope)
  const deleteLaudo = useLaudosStore((s) => s.deleteLaudo)
  const addLaudo = useLaudosStore((s) => s.addLaudo)
  const syncStatus = useLaudosStore((s) => s.syncStatus)
  const syncError = useLaudosStore((s) => s.syncError)
  const activeOrgId = useLaudosStore((s) => s.activeOrgId)
  const sites = useTorreStore((s) => s.sites)
  const pullTorre = useTorreStore((s) => s.pull)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  const [query, setQuery] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [modal, setModal] = useState<{ item?: Laudo } | null>(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    if (!profileOrgId) return
    ensureTenantScope(profileOrgId)
    void pullTorre()
    void pull()
  }, [ensureTenantScope, profileOrgId, pull, pullTorre])

  const tenantReady = !!profileOrgId && activeOrgId === profileOrgId
  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.name ?? 'Obra' : 'Corporativo/Geral')

  const stats = useMemo(() => {
    let vencidos = 0, vencendo = 0, emDia = 0, sem = 0
    for (const l of laudos) {
      const d = laudoDiasRestantes(l.validade)
      if (d == null) sem++
      else if (d < 0) vencidos++
      else if (d <= 60) vencendo++
      else emDia++
    }
    return { total: laudos.length, vencidos, vencendo, emDia, sem }
  }, [laudos])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => laudos.filter((l) => {
    const d = laudoDiasRestantes(l.validade)
    if (statusFiltro === 'vencidos' && !(d != null && d < 0)) return false
    if (statusFiltro === 'vencendo' && !(d != null && d >= 0 && d <= 60)) return false
    if (statusFiltro === 'emdia' && !(d != null && d > 60)) return false
    if (statusFiltro === 'sem' && d != null) return false
    if (!q) return true
    const nome = l.constructionSiteId ? (sites.find((s) => s.id === l.constructionSiteId)?.name ?? '') : 'corporativo geral'
    return [l.tipo, l.titulo, l.responsavel, nome].filter(Boolean).join(' ').toLowerCase().includes(q)
  }).sort((a, b) => (a.validade ?? '9999').localeCompare(b.validade ?? '9999')),
  [laudos, q, statusFiltro, sites])

  async function seedPadrao() {
    if (seeding) return
    setSeeding(true)
    const obraId = activeObraId ?? null
    const existentes = new Set(laudos.filter((l) => l.constructionSiteId === obraId).map((l) => l.tipo))
    const faltantes = LAUDO_TIPOS.filter((t) => t !== 'Outro' && !existentes.has(t))
    for (const tipo of faltantes) {
      await addLaudo({ tipo, constructionSiteId: obraId, periodicidadeMeses: LAUDO_PERIODICIDADE_PADRAO[tipo] })
    }
    setSeeding(false)
  }

  function confirmDelete(l: Laudo) {
    if (window.confirm(`Excluir o laudo "${l.titulo || l.tipo}"? Remove o registro da organização ativa.`)) void deleteLaudo(l.id)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#303030] p-5 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compliance de Laudos</h1>
          <p className="mt-1 text-sm text-[#a3a3a3]">Obrigações legais do prédio com semáforo de vencimento. Alerta por e-mail 60/30/7 entra na fase 2.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void pull()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm font-semibold hover:bg-[#464646]">
            <RefreshCcw size={15} className={syncStatus === 'syncing' ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button type="button" onClick={() => void seedPadrao()} disabled={seeding} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm font-semibold hover:bg-[#464646] disabled:opacity-60">
            <ShieldCheck size={15} /> {seeding ? 'Adicionando...' : 'Obrigações padrão'}
          </button>
          <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
            <Plus size={15} /> Novo laudo
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Laudos" value={stats.total} icon={FileText} tone="text-[#38bdf8]" onClick={() => setStatusFiltro('todos')} active={statusFiltro === 'todos'} />
        <Kpi label="Vencidos" value={stats.vencidos} icon={AlertTriangle} tone="text-[#f87171]" onClick={() => setStatusFiltro('vencidos')} active={statusFiltro === 'vencidos'} />
        <Kpi label="Vencendo (≤60d)" value={stats.vencendo} icon={AlertTriangle} tone="text-[#fbbf24]" onClick={() => setStatusFiltro('vencendo')} active={statusFiltro === 'vencendo'} />
        <Kpi label="Em dia" value={stats.emDia} icon={CheckCircle2} tone="text-[#4ade80]" onClick={() => setStatusFiltro('emdia')} active={statusFiltro === 'emdia'} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por obrigação, obra ou responsável..." className={cn(inputClass, 'max-w-xs')} />
        {statusFiltro !== 'todos' && (
          <button type="button" onClick={() => setStatusFiltro('todos')} className="rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-xs font-semibold text-[#a3a3a3] hover:bg-[#464646]">Limpar filtro</button>
        )}
        {stats.sem > 0 && <span className="text-xs text-[#737373]">{stats.sem} sem validade</span>}
      </div>

      {syncError && <div className="mb-3 rounded-lg border border-[#dc2626]/30 bg-[#dc2626]/10 px-3 py-2 text-sm text-[#fecaca]">{syncError}</div>}

      {!tenantReady ? (
        <div className="grid flex-1 place-items-center rounded-lg border border-[#525252] bg-[#333333] text-sm text-[#a3a3a3]">Preparando dados da empresa ativa...</div>
      ) : filtered.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-[#525252] bg-[#333333] p-8 text-center">
          <div>
            <p className="text-sm text-[#a3a3a3]">Nenhum laudo {statusFiltro !== 'todos' ? 'neste filtro' : 'cadastrado'}.</p>
            <button type="button" onClick={() => void seedPadrao()} className="mt-3 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white">Adicionar obrigações padrão</button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#525252] bg-[#333333]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 border-b border-[#525252] bg-[#333333] text-left text-[#a3a3a3]">
              <tr>{['Obrigação', 'Obra', 'Última execução', 'Validade', 'Situação', 'Responsável', 'Documento', 'Ações'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/60">
              {filtered.map((l) => {
                const st = laudoStatus(l.validade)
                const cor = COR_CLS[st.cor]
                return (
                  <tr key={l.id} className="hover:bg-[#3c3c3c]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#f5f5f5]">{l.tipo}</div>
                      {l.titulo && <div className="text-xs text-[#a3a3a3]">{l.titulo}</div>}
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">{siteName(l.constructionSiteId)}</td>
                    <td className="px-4 py-3 text-[#d4d4d4]">{fmtBR(l.ultimaExecucao)}</td>
                    <td className="px-4 py-3 text-[#d4d4d4]">{fmtBR(l.validade)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 font-semibold', cor.text)}>
                        <span className={cn('h-2.5 w-2.5 rounded-full', cor.dot)} /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">{l.responsavel || '—'}</td>
                    <td className="px-4 py-3">{l.documentoPath ? <DocLink path={l.documentoPath} /> : <span className="text-[#737373]">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setModal({ item: l })} className="rounded p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white"><Pencil size={15} /></button>
                        <button type="button" onClick={() => confirmDelete(l)} className="rounded p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <LaudoModal item={modal.item} sites={sites} defaultSiteId={activeObraId} onClose={() => setModal(null)} />}
    </div>
  )
}

function Kpi({ label, value, icon: Icon, tone, onClick, active }: { label: string; value: number; icon: typeof FileText; tone: string; onClick: () => void; active: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-lg border bg-[#3a3a3a] p-4 text-left transition-colors', active ? 'border-[#f97316]/60' : 'border-[#525252] hover:border-[#f97316]/30')}>
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#a3a3a3]">{label}</span><Icon size={18} className={tone} /></div>
      <p className="text-3xl font-bold tabular-nums text-[#f5f5f5]">{value}</p>
    </button>
  )
}

function DocLink({ path }: { path: string }) {
  async function open() {
    const u = await signedPredialAtivoUrl(path)
    if (u) window.open(u, '_blank', 'noopener')
  }
  return <button type="button" onClick={() => void open()} className="inline-flex items-center gap-1 text-[#60a5fa] hover:text-[#93c5fd]"><FileText size={14} /> abrir</button>
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function LaudoModal({ item, sites, defaultSiteId, onClose }: { item?: Laudo; sites: { id: string; name: string; code?: string }[]; defaultSiteId: string | null; onClose: () => void }) {
  const addLaudo = useLaudosStore((s) => s.addLaudo)
  const updateLaudo = useLaudosStore((s) => s.updateLaudo)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tipo: item?.tipo ?? LAUDO_TIPOS[0],
    titulo: item?.titulo ?? '',
    constructionSiteId: item?.constructionSiteId ?? defaultSiteId ?? '',
    ultimaExecucao: item?.ultimaExecucao ?? '',
    periodicidadeMeses: item?.periodicidadeMeses != null ? String(item.periodicidadeMeses) : '',
    validade: item?.validade ?? '',
    responsavel: item?.responsavel ?? '',
    observacoes: item?.observacoes ?? '',
  })
  const [documentoPath, setDocumentoPath] = useState<string | undefined>(item?.documentoPath)
  const [docNome, setDocNome] = useState<string | undefined>(item?.documentoPath ? 'documento' : undefined)
  const [busy, setBusy] = useState(false)
  const trashRef = useRef<string[]>([])

  function sugerirValidade() {
    const meses = Number(form.periodicidadeMeses)
    if (form.ultimaExecucao && Number.isFinite(meses) && meses > 0) {
      setForm((s) => ({ ...s, validade: addMonthsISO(form.ultimaExecucao, meses) }))
    }
  }

  async function onDoc(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const path = await uploadPredialAtivoFile(file)
      if (documentoPath) trashRef.current.push(documentoPath)
      setDocumentoPath(path)
      setDocNome(file.name)
    } catch {
      window.alert('Falha ao enviar o documento.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.tipo.trim()) return
    setSaving(true)
    const meses = Number(form.periodicidadeMeses)
    const payload: Partial<Laudo> = {
      tipo: form.tipo,
      titulo: form.titulo.trim() || undefined,
      constructionSiteId: form.constructionSiteId || null,
      ultimaExecucao: form.ultimaExecucao || undefined,
      validade: form.validade || undefined,
      periodicidadeMeses: form.periodicidadeMeses.trim() && Number.isFinite(meses) ? meses : undefined,
      responsavel: form.responsavel.trim() || undefined,
      documentoPath: documentoPath || undefined,
      observacoes: form.observacoes.trim() || undefined,
    }
    const ok = item ? await updateLaudo(item.id, payload) : (await addLaudo(payload)) !== null
    if (!ok) {
      // Falhou: mantém o modal aberto e NÃO apaga os arquivos em trash (ainda referenciados).
      setSaving(false)
      window.alert('Não foi possível salvar o laudo. Verifique a conexão e tente novamente.')
      return
    }
    // Só agora remove do bucket os arquivos trocados/removidos (best-effort).
    trashRef.current.forEach((p) => void removePredialAtivoFile(p))
    trashRef.current = []
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#f5f5f5]">{item ? 'Editar laudo' : 'Novo laudo'}</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-[#a3a3a3] hover:bg-[#3f3f3f] hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5"><span className={labelClass}>Obrigação</span>
              <select value={form.tipo} onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value, periodicidadeMeses: s.periodicidadeMeses || String(LAUDO_PERIODICIDADE_PADRAO[e.target.value] ?? '') }))} className={inputClass}>
                {LAUDO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="space-y-1.5"><span className={labelClass}>Título (opcional)</span><input value={form.titulo} onChange={(e) => setForm((s) => ({ ...s, titulo: e.target.value }))} className={inputClass} placeholder="ex.: AVCB Bloco A" /></label>
            <label className="space-y-1.5 md:col-span-2"><span className={labelClass}>Obra / Prédio</span>
              <select value={form.constructionSiteId} onChange={(e) => setForm((s) => ({ ...s, constructionSiteId: e.target.value }))} className={inputClass}>
                <option value="">Corporativo/Geral</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ''}{s.name}</option>)}
              </select>
            </label>
            <label className="space-y-1.5"><span className={labelClass}>Última execução</span><input type="date" value={form.ultimaExecucao} onChange={(e) => setForm((s) => ({ ...s, ultimaExecucao: e.target.value }))} className={inputClass} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Periodicidade (meses)</span><input type="number" min={0} value={form.periodicidadeMeses} onChange={(e) => setForm((s) => ({ ...s, periodicidadeMeses: e.target.value }))} className={inputClass} placeholder="12" /></label>
            <label className="space-y-1.5"><span className={labelClass}>Validade</span>
              <div className="flex gap-1.5">
                <input type="date" value={form.validade} onChange={(e) => setForm((s) => ({ ...s, validade: e.target.value }))} className={inputClass} />
                <button type="button" onClick={sugerirValidade} title="Sugerir a partir da última execução + periodicidade" className="shrink-0 rounded-lg border border-[#525252] bg-[#3a3a3a] px-2.5 text-xs font-semibold text-[#a3a3a3] hover:bg-[#464646]">Sugerir</button>
              </div>
            </label>
            <label className="space-y-1.5"><span className={labelClass}>Responsável</span><input value={form.responsavel} onChange={(e) => setForm((s) => ({ ...s, responsavel: e.target.value }))} className={inputClass} placeholder="Empresa/pessoa" /></label>
          </div>
          <label className="mt-3 block space-y-1.5"><span className={labelClass}>Observações</span><textarea value={form.observacoes} onChange={(e) => setForm((s) => ({ ...s, observacoes: e.target.value }))} className={cn(inputClass, 'min-h-20')} /></label>

          <div className="mt-3 space-y-1.5">
            <span className={labelClass}>Documento (laudo/certificado)</span>
            <div className="flex items-center gap-2">
              {documentoPath && <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#333] px-2.5 py-1.5 text-sm text-[#e5e5e5]"><FileText size={14} className="text-[#a3a3a3]" />{docNome ?? 'documento'} {documentoPath && <button type="button" onClick={() => { if (documentoPath) trashRef.current.push(documentoPath); setDocumentoPath(undefined); setDocNome(undefined) }} className="text-[#a3a3a3] hover:text-[#f87171]"><X size={13} /></button>}</span>}
              {documentoPath && <DocLink path={documentoPath} />}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-1.5 text-xs font-semibold text-[#e5e5e5] hover:bg-[#464646]">
                {documentoPath ? <Upload size={14} /> : <Paperclip size={14} />} {busy ? 'Enviando...' : documentoPath ? 'Trocar' : 'Anexar documento'}
                <input type="file" className="hidden" onChange={onDoc} disabled={busy} />
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-[#525252] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#3f3f3f]">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-70">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
