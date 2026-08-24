/**
 * GlobalSyncIndicator — na sidebar, abaixo do seletor de organização.
 *
 * A regra desta tela é: **o usuário não deveria precisar cuidar disto.** A fila de sincronização
 * não morre mais por contagem de tentativas (ver `storeSync.ts`), então uma pendência é um estado
 * passageiro, não um problema — e não merece contagem em vermelho nem botão de socorro.
 *
 * Três estados, nesta ordem de prioridade:
 *  - **Precisa de você**: só falha BLOQUEANTE (permissão) que já insistiu por mais de uma hora.
 *    Diz o motivo em português e oferece tentar de novo. NÃO pede aprovação de ninguém.
 *  - **Enviando**: há algo na fila. Sem número, sem alarme — vai subir.
 *  - **Tudo salvo**.
 *
 * Aqui existiu um botão "Pedir aprovação" (removido em 24/08/2026). Ele montava o pedido com o
 * nome da tabela no PLURAL (`delete_worker_absences`) enquanto o servidor só conhece o SINGULAR
 * (`delete_worker_absence`): o pedido era criado, alguém aprovava e NADA acontecia. Somado a isso,
 * a tela que lista aprovações não tem link em menu nenhum e o servidor proíbe aprovar o próprio
 * pedido — numa empresa de conta única, ninguém podia aprovar. Era um buraco negro, e o cliente
 * foi direto ao ponto: "se eu decidi apagar algo, eu quero apagar e pronto".
 *
 * O painel completo continua acessível pelo clique: ele é o histórico do que ainda não subiu,
 * com a opção de reenviar na hora e de baixar uma cópia.
 */
import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Cloud, RefreshCw, X, CheckCircle2, ShieldAlert } from 'lucide-react'
import {
  useAppModeStore, getPendingSummary, getSyncDiagnostics, retryAllTenantStores, discardErroredOps,
  baixarOpsPendentes, listarOpsPendentes, pendenciasQuePedemAtencao,
  type OpPendenteResumo, type PendenciaBloqueada,
} from '@/store/appModeStore'
import { fmtDataBR } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'

type Diag = { key: string; label: string; pending: number; error: boolean; syncError: string | null }

/** O painel falava a língua do Postgres. Estes traduzem para a língua de quem usa. */
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

/**
 * Traduz o erro do servidor para uma frase que diz o que fazer.
 *
 * Um "new row violates row-level security policy" não ajuda ninguém; "o seu papel não autoriza"
 * ajuda. A mensagem original continua disponível no detalhe, para quando o suporte precisar.
 */
function motivoAmigavel(p: PendenciaBloqueada): string {
  const m = (p.motivo ?? '').toLowerCase()
  const alvo = rotuloTabela(p.tabela)
  if (m.includes('row-level security') || m.includes('42501') || m.includes('não autoriza') || m.includes('permission denied')) {
    return `O seu papel não autoriza ${p.tipo === 'delete' ? 'excluir' : 'gravar'} em ${alvo}.`
  }
  if (m.includes('não foi aceita pelo servidor')) {
    return `O servidor recusou a exclusão em ${alvo} — o registro continua lá. Normalmente é permissão.`
  }
  if (m.includes('violates foreign key')) {
    return `Este registro de ${alvo} depende de outro que ainda não subiu.`
  }
  return `O servidor recusou esta alteração em ${alvo}.`
}

/** Erro de schema faltando (PGRST205 tabela / PGRST204 coluna) → dica de rodar as migrações. */
function isSchemaError(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('schema cache') || m.includes('could not find the table') || (m.includes('could not find') && m.includes('column'))
}

export function GlobalSyncIndicator({ expanded }: { expanded: boolean }) {
  useAppModeStore((s) => s.isDemoMode)
  const orgId = useAuth((s) => s.profile?.organization_id)

  const [summary, setSummary] = useState<{ pending: number; error: boolean; syncing: boolean }>({ pending: 0, error: false, syncing: false })
  const [atencao, setAtencao] = useState<PendenciaBloqueada[]>([])
  const [open, setOpen] = useState(false)
  const demo = isDemoModeEnabled()

  useEffect(() => {
    if (demo) return
    let alive = true
    const tick = () => {
      void getPendingSummary().then((s) => { if (alive) setSummary(s) })
      void pendenciasQuePedemAtencao().then((p) => { if (alive) setAtencao(p) })
    }
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
  //
  // Note o que NÃO está aqui: contagem de pendências e estado de "erro". Uma op na fila vai subir
  // sozinha; mostrar "3 NÃO SALVO(S)" em amarelo transformava um processo normal em um susto, e
  // ainda oferecia dois botões — um que não fazia nada e outro que apagava o dado.
  const precisaAtencao = atencao.length > 0
  const enviando = summary.syncing || summary.pending > 0

  const tone = precisaAtencao ? '#eab308' : enviando ? '#60a5fa' : '#4ade80'
  const Icon = precisaAtencao ? ShieldAlert : enviando ? RefreshCw : Cloud
  const label = precisaAtencao
    ? 'O servidor recusou'
    : enviando ? 'Enviando para a nuvem…' : 'Tudo salvo na nuvem'
  const title = precisaAtencao
    ? `${atencao.length} alteração(ões) recusadas pelo servidor. Clique para ver o motivo.`
    : enviando
      ? 'Salvo no aparelho e a caminho da nuvem. Não precisa fazer nada — o envio se resolve sozinho.'
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
          <Icon size={13} className={`shrink-0 ${enviando && !precisaAtencao ? 'animate-spin' : ''}`} />
          <span className="truncate">{label}</span>
        </button>
      )}
      {open && <SyncPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function SyncPanel({ onClose }: { onClose: () => void }) {
  const [diags, setDiags] = useState<Diag[] | null>(null)
  const [atencao, setAtencao] = useState<PendenciaBloqueada[]>([])
  const [busy, setBusy] = useState(false)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const [ops, setOps] = useState<Record<string, OpPendenteResumo[]>>({})

  const refresh = useCallback(async () => {
    setDiags(await getSyncDiagnostics())
    setAtencao(await pendenciasQuePedemAtencao())
    setOps({})
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function handleRetry() {
    setBusy(true)
    // `retryAllTenantStores` agora zera a espera do backoff antes de drenar. Antes ele era um
    // apelido de flush e caía no mesmo filtro que já havia tirado as ops travadas da rodada —
    // por isso o botão parecia não fazer nada: ele de fato não fazia.
    try { await retryAllTenantStores(); await new Promise((r) => setTimeout(r, 600)); await refresh() }
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

  /** Descarte é item a item e sempre baixa uma cópia antes. Nunca "tudo o que deu erro". */
  async function handleDescartarOp(d: Diag, op: OpPendenteResumo) {
    if (!window.confirm(
      `Descartar esta alteração?\n\n${rotuloAcao(op.tipo)} em ${rotuloTabela(op.tabela)}.\n\n`
      + 'ESTE DADO SERÁ PERDIDO — ele ainda não está no servidor. Uma cópia em JSON será baixada '
      + 'automaticamente antes do descarte.',
    )) return
    setBusy(true)
    try { await discardErroredOps(d.key, [op.id]); await refresh() } finally { setBusy(false) }
  }

  async function verDetalhe(d: Diag) {
    setDetalhe((atual) => (atual === d.key ? null : d.key))
    if (!ops[d.key]) {
      const lista = await listarOpsPendentes(d.key)
      setOps((o) => ({ ...o, [d.key]: lista }))
    }
  }

  const totalPending = diags?.reduce((s, d) => s + d.pending, 0) ?? 0

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl border border-[#525252] bg-[#2f2f2f] shadow-2xl text-[#e5e5e5] flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
              <RefreshCw size={15} className={`text-[#f97316] ${busy ? 'animate-spin' : ''}`} /> Sincronização com a nuvem
            </h3>
            <p className="text-xs text-[#9a9a9a] mt-0.5">O envio se resolve sozinho. Isto aqui é só o histórico.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 overflow-y-auto">
          {/* O que de fato precisa de uma pessoa vem primeiro e separado do resto. Sem pedido de
              aprovação: só o motivo, em português, e o botão de tentar de novo lá embaixo. */}
          {atencao.length > 0 && (
            <div className="mb-3 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 p-3">
              <p className="flex items-center gap-2 text-xs font-bold text-[#eab308]">
                <ShieldAlert size={14} /> O servidor recusou
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {atencao.map((p) => (
                  <li key={p.opId} className="text-[11px] text-[#e5e5e5]">
                    <b>{p.modulo}</b> — {motivoAmigavel(p)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[#d4d4d4]">
                Nada foi perdido — está tudo salvo no seu aparelho. Clique em <b>Enviar agora</b> para
                tentar de novo. Se continuar, é permissão no banco: rode o
                {' '}<b>docs/CONFERIR_EXCLUSAO.sql</b> para saber qual é.
              </p>
            </div>
          )}

          {diags === null ? (
            <p className="text-sm text-[#9a9a9a] py-6 text-center">Verificando…</p>
          ) : diags.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 text-sm text-[#4ade80]">
              <CheckCircle2 size={16} /> Tudo salvo na nuvem. Nada pendente.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {diags.map((d) => (
                <li key={d.key} className="rounded-lg border border-[#525252] bg-[#3a3a3a]/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#f5f5f5]">{d.label}</span>
                    <span className="rounded bg-[#60a5fa]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[#93c5fd]">
                      {d.pending} a caminho
                    </span>
                  </div>
                  {d.error && d.syncError && isSchemaError(d.syncError) && (
                    <p className="mt-1.5 text-[11px] text-[#fbbf24] break-words">
                      Falta uma tabela ou coluna no banco — veja <b>docs/APLICAR_MIGRACOES.md</b>. Assim que a migração for aplicada, isto sobe sozinho.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.key === 'torre' && (
                      <button onClick={handleResyncObras} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#484848] hover:bg-[#525252] disabled:opacity-50">Ressincronizar obras</button>
                    )}
                    <button onClick={() => verDetalhe(d)} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#484848] hover:bg-[#525252] disabled:opacity-50">
                      {detalhe === d.key ? 'Ocultar' : 'Ver o que está na fila'}
                    </button>
                    <button onClick={() => handleBaixar(d)} disabled={busy} className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#484848] hover:bg-[#525252] disabled:opacity-50">Baixar cópia</button>
                  </div>

                  {detalhe === d.key && (
                    <div className="mt-2 rounded border border-[#525252] bg-[#2c2c2c]/60 p-2">
                      {!ops[d.key] ? (
                        <p className="text-[11px] text-[#9a9a9a]">Carregando…</p>
                      ) : ops[d.key].length === 0 ? (
                        <p className="text-[11px] text-[#9a9a9a]">Nada pendente.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {ops[d.key].map((op) => (
                            <li key={op.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-[#d4d4d4]">
                              <span className="font-semibold">{rotuloAcao(op.tipo)}</span>
                              <span className="text-[#9a9a9a]">em {rotuloTabela(op.tabela)}</span>
                              <span className="text-[#6b6b6b]">· {op.criadaEm ? fmtDataBR(op.criadaEm.slice(0, 10)) : 'sem data'}</span>
                              {op.classe === 'bloqueante' && <span className="text-[#fbbf24]">· recusado pelo servidor</span>}
                              {op.classe === 'aguardando-servidor' && <span className="text-[#93c5fd]">· aguardando migração</span>}
                              {op.classe === 'transitorio' && <span className="text-[#93c5fd]">· rede instável</span>}
                              <button onClick={() => handleDescartarOp(d, op)} disabled={busy}
                                className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-[#f87171] hover:bg-[#f87171]/15 disabled:opacity-50">
                                Descartar
                              </button>
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
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#525252]">
          <span className="text-[11px] text-[#9a9a9a]">{totalPending > 0 ? `${totalPending} a caminho` : 'Sem pendências'}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#a3a3a3] hover:bg-[#3d3d3d]">Fechar</button>
            <button onClick={handleRetry} disabled={busy || totalPending === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50">
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Enviar agora
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
