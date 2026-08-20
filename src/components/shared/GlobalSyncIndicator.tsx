/**
 * GlobalSyncIndicator — na sidebar, abaixo do seletor de organização.
 * - Modo demo/homologação: avisa que nada é salvo no servidor.
 * - Produção: mostra "Tudo salvo" ou "N não salvo(s)"; ao clicar, abre um painel
 *   com o módulo culpado + a mensagem de erro real + "Tentar novamente" / descartar.
 */
import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Cloud, CloudOff, RefreshCw, X, CheckCircle2 } from 'lucide-react'
import { useAppModeStore, getPendingSummary, getSyncDiagnostics, retryAllTenantStores, discardErroredOps, baixarOpsPendentes, listarOpsPendentes, type OpPendenteResumo } from '@/store/appModeStore'
import { fmtDataBR } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'

type Diag = { key: string; label: string; pending: number; error: boolean; syncError: string | null }

/** Erro de schema faltando (PGRST205 tabela / PGRST204 coluna) → dica de rodar as migrações. */
function isSchemaError(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('schema cache') || m.includes('could not find the table') || (m.includes('could not find') && m.includes('column'))
}


/** O painel falava a língua do Postgres. Estes dois traduzem para a língua de quem usa. */
const ROTULOS_TABELA: Record<string, string> = {
  worker_absences: 'faltas', workers: 'funcionários', shifts: 'escala', timecards: 'apontamentos',
  worker_assessments: 'avaliações', work_posts: 'postos de trabalho', labor_occurrences: 'ocorrências',
  labor_crews: 'equipes', rdo: 'RDO', obra_dias_sem_producao: 'dias sem produção',
  construction_sites: 'obras', financeiro_titulos: 'títulos', predial_laudos: 'laudos',
  suprimentos_estoque_itens: 'itens de estoque', suprimentos_estoque_movimentacoes: 'movimentações de estoque',
  rotinas: 'rotinas', rotina_execucoes: 'rotinas concluídas',
}
const rotuloTabela = (t: string) => ROTULOS_TABELA[t] ?? t
const rotuloAcao = (tipo: string) =>
  tipo === 'insert' ? 'Criação' : tipo === 'delete' ? 'Exclusão' : 'Alteração'

export function GlobalSyncIndicator({ expanded }: { expanded: boolean }) {
  useAppModeStore((s) => s.isDemoMode)
  const orgId = useAuth((s) => s.profile?.organization_id)

  const [summary, setSummary] = useState<{ pending: number; error: boolean; syncing: boolean }>({ pending: 0, error: false, syncing: false })
  const [open, setOpen] = useState(false)
  const demo = isDemoModeEnabled()

  useEffect(() => {
    if (demo) return
    let alive = true
    const tick = () => { void getPendingSummary().then((s) => { if (alive) setSummary(s) }) }
    tick()
    const t = window.setInterval(tick, 4000)
    return () => { alive = false; window.clearInterval(t) }
  }, [demo, orgId])

  // ── Demo/homologação ──
  if (demo) {
    if (!expanded) return (
      <div className="flex justify-center py-1" title="Modo demo/homologação — alterações NÃO são salvas no servidor.">
        <span className="size-2 rounded-full bg-[#eab308]" />
      </div>
    )
    return (
      <div className="mx-2 my-1 flex items-start gap-2 rounded-lg border border-[#eab308]/30 bg-[#eab308]/10 px-2.5 py-1.5 text-[10px] leading-snug text-[#eab308]">
        <FlaskConical size={13} className="mt-0.5 shrink-0" />
        <span>Modo demo/homologação — alterações <b>não</b> são salvas no servidor.</span>
      </div>
    )
  }

  // ── Produção ──
  const { pending, error, syncing } = summary
  const dirty = pending > 0 || error
  const tone = error ? '#eab308' : dirty ? '#eab308' : syncing ? '#60a5fa' : '#4ade80'
  const Icon = error ? CloudOff : dirty ? CloudOff : syncing ? RefreshCw : Cloud
  const label = error
    ? `${pending} salvo(s) no aparelho · reenviar`
    : dirty ? `${pending} salvo(s) no aparelho` : syncing ? 'Enviando para a nuvem…' : 'Tudo salvo na nuvem'
  const title = dirty
    ? 'Salvo no aparelho — ainda não subiu para a nuvem. Clique para ver detalhes e reenviar. Não atualize a página.'
    : label

  return (
    <>
      {!expanded ? (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full justify-center py-1" title={title}>
          <span className="size-2 rounded-full" style={{ backgroundColor: tone }} />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] leading-snug hover:brightness-125"
          style={{ borderColor: `${tone}55`, background: `${tone}18`, color: tone }} title={title}>
          <Icon size={13} className={`shrink-0 ${syncing && !dirty ? 'animate-spin' : ''}`} />
          <span className="truncate">{label}</span>
        </button>
      )}
      {open && <SyncPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function SyncPanel({ onClose }: { onClose: () => void }) {
  const [diags, setDiags] = useState<Diag[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const [ops, setOps] = useState<Record<string, OpPendenteResumo[]>>({})

  const refresh = useCallback(async () => { setDiags(await getSyncDiagnostics()) }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function handleRetry() {
    setBusy(true)
    try { await retryAllTenantStores(); await new Promise((r) => setTimeout(r, 400)); await refresh() }
    finally { setBusy(false) }
  }

  async function handleResyncObras() {
    setBusy(true)
    try {
      const { useTorreStore } = await import('@/store/torreDeControleStore')
      useTorreStore.getState().resyncSites?.()
      await new Promise((r) => setTimeout(r, 600)); await refresh()
    } finally { setBusy(false) }
  }

  async function handleBaixar(d: Diag) {
    setBusy(true)
    try {
      const n = await baixarOpsPendentes(d.key)
      if (n === 0) window.alert('Nada pendente para baixar.')
    } finally { setBusy(false) }
  }

  async function handleDiscard(d: Diag) {
    // O texto mudou porque o comportamento anterior era pior do que o aviso dizia: zerava a fila
    // INTEIRA, os registros continuavam na tela, e o próximo `pull` — que roda a cada abertura do
    // módulo — os apagava. Era perda silenciosa, sem nenhum sinal.
    if (!window.confirm(
      `Descartar ${d.pending} alteração(ões) não salva(s) de "${d.label}"?\n\n`
      + 'ESTES DADOS SERÃO PERDIDOS. Eles ainda não estão no servidor, e ao descartar eles somem '
      + 'da tela também, na próxima vez que você abrir o módulo.\n\n'
      + 'Se ainda não baixou uma cópia, cancele e clique em "Baixar cópia" primeiro.',
    )) return
    setBusy(true)
    try { await discardErroredOps(d.key); await refresh() } finally { setBusy(false) }
  }

  async function verDetalhe(d: Diag) {
    setDetalhe((atual) => (atual === d.key ? null : d.key))
    if (!ops[d.key]) {
      const lista = await listarOpsPendentes(d.key)
      setOps((o) => ({ ...o, [d.key]: lista }))
    }
  }

  const totalPending = diags?.reduce((s, d) => s + d.pending, 0) ?? 0
  const hasError = diags?.some((d) => d.error) ?? false

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl border border-[#525252] bg-[#2f2f2f] shadow-2xl text-[#e5e5e5] flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
              <RefreshCw size={15} className={`text-[#f97316] ${busy ? 'animate-spin' : ''}`} /> Sincronização com a nuvem
            </h3>
            <p className="text-xs text-[#9a9a9a] mt-0.5">O que ainda não foi salvo no servidor e como recuperar.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 overflow-y-auto">
          {diags === null ? (
            <p className="text-sm text-[#9a9a9a] py-6 text-center">Verificando…</p>
          ) : diags.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 text-sm text-[#4ade80]">
              <CheckCircle2 size={16} /> Tudo salvo na nuvem. Nada pendente.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {diags.map((d) => (
                <li key={d.key} className={`rounded-lg border px-3 py-2.5 ${d.error ? 'border-[#f87171]/40 bg-[#f87171]/10' : 'border-[#eab308]/30 bg-[#eab308]/10'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#f5f5f5]">{d.label}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${d.error ? 'bg-[#f87171]/20 text-[#f87171]' : 'bg-[#eab308]/20 text-[#eab308]'}`}>
                      {d.pending} não salvo(s){d.error ? ' · erro' : ''}
                    </span>
                  </div>
                  {d.error && d.syncError && (
                    <p className="mt-1.5 text-[11px] text-[#fca5a5] break-words">{d.syncError}</p>
                  )}
                  {d.error && d.syncError && isSchemaError(d.syncError) && (
                    <p className="mt-1 text-[11px] text-[#fbbf24] break-words">
                      Falta uma tabela/coluna no banco. Rode o <b>APPLY_PENDENTE.sql</b> no Supabase (SQL Editor) e clique em "Tentar novamente".
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.key === 'torre' && (
                      <button onClick={handleResyncObras} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#484848] hover:bg-[#525252] disabled:opacity-50">Ressincronizar obras</button>
                    )}
                    <button onClick={() => verDetalhe(d)} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#484848] hover:bg-[#525252] disabled:opacity-50">
                      {detalhe === d.key ? 'Ocultar' : 'Ver o que está preso'}
                    </button>
                    {/* Baixar vem ANTES de descartar, e não por acaso: é a única cópia desses dados. */}
                    <button onClick={() => handleBaixar(d)} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#484848] hover:bg-[#525252] disabled:opacity-50">Baixar cópia</button>
                    <button onClick={() => handleDiscard(d)} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold text-[#f87171] hover:bg-[#f87171]/15 disabled:opacity-50">Descartar</button>
                  </div>

                  {detalhe === d.key && (
                    <div className="mt-2 rounded border border-[#525252] bg-[#2c2c2c]/60 p-2">
                      {!ops[d.key] ? (
                        <p className="text-[11px] text-[#9a9a9a]">Carregando…</p>
                      ) : ops[d.key].length === 0 ? (
                        <p className="text-[11px] text-[#9a9a9a]">Nada pendente.</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {ops[d.key].map((op) => (
                            <li key={op.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-[#d4d4d4]">
                              <span className="font-semibold">{rotuloAcao(op.tipo)}</span>
                              <span className="text-[#9a9a9a]">em {rotuloTabela(op.tabela)}</span>
                              <span className="text-[#6b6b6b]">· {op.criadaEm ? fmtDataBR(op.criadaEm.slice(0, 10)) : 'sem data'}</span>
                              {op.tentativas > 0 && (
                                <span className="text-[#fbbf24]">· {op.tentativas} tentativa(s)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {diags && diags.length > 0 && (
            <p className="mt-3 text-[10px] text-[#7a7a7a]">
              Dica: se você acabou de aplicar uma mudança no banco de dados, aguarde alguns segundos e clique em "Tentar novamente" — o servidor leva um instante para reconhecer as colunas novas.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#525252]">
          <span className="text-[11px] text-[#9a9a9a]">{totalPending > 0 ? `${totalPending} pendência(s)${hasError ? ' com erro' : ''}` : 'Sem pendências'}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#a3a3a3] hover:bg-[#3d3d3d]">Fechar</button>
            <button onClick={handleRetry} disabled={busy || totalPending === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50">
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Tentar novamente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
