/**
 * Vínculo conta de login ↔ cadastro de funcionário.
 *
 * ─── POR QUE ESTA TELA EXISTE ─────────────────────────────────────────────────
 * Até o ponto eletrônico, o único casamento entre uma pessoa e um registro do sistema era o NOME
 * (`matchWorkerByName`, igualdade exata depois de normalizar). Para apontamento de produção isso
 * passa. Para registro de jornada, não: dois homônimos no canteiro — comum na construção —
 * produziriam cartão de ponto de um atribuído ao outro, e cartão de ponto é prova em juízo.
 *
 * Aqui o gestor amarra, um por um, a conta de login (`auth.users.id`) ao cadastro
 * (`Worker.authUserId`). É esse id que a batida carrega no payload.
 *
 * ─── DE ONDE VÊM AS CONTAS ────────────────────────────────────────────────────
 * ⚠️ De `memberships`, não de `profiles`. Quem manda no papel é a membership da organização —
 * `profiles.role` é a sombra da empresa ATIVA daquela pessoa, e alguém que trabalhe em duas
 * empresas apareceria aqui com o papel da outra. O `profiles` entra só para dar nome e e-mail
 * (a policy `memberships_select_own_org` libera a leitura para qualquer membro; a
 * `profiles_select_own_org` idem).
 *
 * ⚠️ E não há caminho no app para CRIAR essas contas: desde a migração 0049 o gatilho
 * `handle_new_user` é no-op de propósito, e as RPCs de convite foram revogadas. Criar o login do
 * funcionário e dar-lhe o papel `colaborador` é SQL — a receita pronta está em
 * `docs/PONTO_CRIAR_COLABORADORES.sql`. Esta tela só amarra o que já existe, e diz isso na cara
 * quando não encontra conta nenhuma.
 */
import { useMemo, useState } from 'react'
import { IdCard, Link2, Link2Off, AlertTriangle, RefreshCw, Search, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { roleLabel } from '@/lib/roles'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { ROLES_PONTO_REGISTRAR } from '@/store/pontoStore'
import { funcionarioEstaAtivo } from '@/lib/funcionarioAtivo'
import type { Worker } from '@/types'
import type { UserRole } from '@/types/database'

interface Conta {
  userId: string
  papel: UserRole | string
  ativa: boolean
  nome: string
  email: string
}

interface Props {
  workers: Worker[]
  updateWorker: (id: string, updates: Partial<Omit<Worker, 'id'>>) => void
  podeEscrever: boolean
}

/** Lê as contas da organização ativa. Devolve `null` enquanto não souber (carregando ou erro). */
async function carregarContas(orgId: string): Promise<Conta[]> {
  const [mem, prof] = await Promise.all([
    supabase.from('memberships').select('user_id, role, status').eq('organization_id', orgId).is('deleted_at', null),
    supabase.from('profiles').select('id, full_name, email').eq('organization_id', orgId),
  ])
  if (mem.error) throw mem.error
  const nomes = new Map<string, { nome: string; email: string }>()
  for (const p of prof.data ?? []) {
    nomes.set(p.id as string, {
      nome: ((p.full_name as string) ?? '').trim(),
      email: ((p.email as string) ?? '').trim(),
    })
  }
  return (mem.data ?? []).map((m) => {
    const userId = m.user_id as string
    const info = nomes.get(userId)
    return {
      userId,
      papel: (m.role as string) ?? '',
      ativa: (m.status as string) === 'active',
      // Sem perfil o nome não existe: a conta foi criada só com membership. Mostrar o começo do id
      // é feio, mas é honesto — e é o suficiente para o gestor reconhecer a linha que ele acabou
      // de criar no SQL.
      nome: info?.nome || info?.email || `conta ${userId.slice(0, 8)}…`,
      email: info?.email || '',
    }
  })
}

export function VinculoContasSection({ workers, updateWorker, podeEscrever }: Props) {
  const orgId = useAuth((s) => s.profile?.organization_id)
  const [open, setOpen] = useState(false)
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [soSemVinculo, setSoSemVinculo] = useState(false)

  const demo = isNonProductionDataMode()

  // A leitura acontece no CLIQUE, não num efeito: quem dispara é a pessoa abrindo a seção, e é
  // esse o gatilho de verdade. Num efeito, o `setCarregando` síncrono cascatearia renderização —
  // e a regra do eslint que reclama disso está certa: não há sistema externo a sincronizar aqui,
  // há uma consulta a fazer quando alguém pede.
  async function carregar() {
    if (!orgId || demo) return
    setCarregando(true); setErro(null)
    try {
      setContas(await carregarContas(orgId))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler as contas.')
    } finally {
      setCarregando(false)
    }
  }

  function alternar() {
    const abrindo = !open
    setOpen(abrindo)
    if (abrindo && contas === null && !carregando) void carregar()
  }

  function recarregar() {
    setContas(null)
    void carregar()
  }

  const porUserId = useMemo(() => new Map((contas ?? []).map((c) => [c.userId, c])), [contas])

  /** Quem já está usando cada conta. Mais de um = defeito, e a tela precisa mostrá-lo. */
  const donosDaConta = useMemo(() => {
    const m = new Map<string, Worker[]>()
    for (const w of workers) {
      if (!w.authUserId) continue
      const arr = m.get(w.authUserId) ?? []
      arr.push(w)
      m.set(w.authUserId, arr)
    }
    return m
  }, [workers])

  const ordenados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return [...workers]
      .filter((w) => {
        if (soSemVinculo && w.authUserId) return false
        if (!termo) return true
        return w.name.toLowerCase().includes(termo)
          || (w.registrationNumber ?? '').toLowerCase().includes(termo)
          || (w.authUserId ? (porUserId.get(w.authUserId)?.email ?? '').toLowerCase().includes(termo) : false)
      })
      // Sem vínculo primeiro: é o que falta fazer.
      .sort((a, b) => Number(!!a.authUserId) - Number(!!b.authUserId) || a.name.localeCompare(b.name, 'pt-BR'))
  }, [workers, busca, soSemVinculo, porUserId])

  const vinculados = useMemo(() => workers.filter((w) => w.authUserId).length, [workers])
  const ativosSemVinculo = useMemo(
    () => workers.filter((w) => !w.authUserId && funcionarioEstaAtivo(w)).length,
    [workers],
  )
  const contasSemFuncionario = useMemo(
    () => (contas ?? []).filter((c) => c.ativa && !donosDaConta.has(c.userId)),
    [contas, donosDaConta],
  )

  function vincular(worker: Worker, userId: string) {
    if (!podeEscrever) return
    if (!userId) { updateWorker(worker.id, { authUserId: undefined }); return }
    const jaUsam = (donosDaConta.get(userId) ?? []).filter((w) => w.id !== worker.id)
    // Barra aqui e não só no <select>: a lista pode estar desatualizada em relação a outra aba.
    if (jaUsam.length > 0) return
    updateWorker(worker.id, { authUserId: userId })
  }

  const selectClass = 'w-full bg-[#333333] border border-[#525252] rounded-lg px-2 py-1.5 text-[#f5f5f5] text-[11px] focus:outline-none focus:border-[#f97316] disabled:opacity-50'

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d]">
      <button
        type="button"
        onClick={alternar}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
          <IdCard size={14} className="text-[#ffa055]" />
          Contas do Ponto Eletrônico
          <span className="text-[11px] font-normal text-[#adadad]">
            — qual login pertence a qual funcionário
          </span>
          {ativosSemVinculo > 0 ? (
            <span className="rounded bg-[#eab308]/15 px-2 py-0.5 text-[11px] font-bold text-[#fbbf24]">
              {ativosSemVinculo} sem vínculo
            </span>
          ) : vinculados > 0 ? (
            <span className="rounded bg-[#22c55e]/15 px-2 py-0.5 text-[11px] font-bold text-[#4ade80]">
              {vinculados} vinculado{vinculados !== 1 ? 's' : ''}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-[#adadad]">{open ? 'Recolher' : 'Expandir'}</span>
      </button>

      {open && (
        <div className="border-t border-[#525252] p-4">
          {/* A razão de ser, antes da tabela. Quem vai clicar precisa saber o peso do clique. */}
          <p className="mb-3 rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-2 text-[11px] leading-5 text-[#93c5fd]">
            <b>O funcionário só bate ponto depois deste vínculo.</b> É por ele que o sistema sabe de
            quem é a batida — não pelo nome, que se repete no canteiro, nem por quem sincronizou o
            aparelho. Amarrar a conta errada aqui produz cartão de ponto de uma pessoa no nome de
            outra; confira o e-mail, não só o nome.
          </p>

          {demo ? (
            <p className="rounded-lg border border-[#525252] bg-[#333] px-3 py-2 text-[11px] text-[#adadad]">
              Em Modo Demonstração não há contas de verdade para vincular.
            </p>
          ) : (
            <>
              {/* Estado da leitura das contas. */}
              {carregando && (
                <p className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#333] px-3 py-2 text-[11px] text-[#adadad]">
                  <RefreshCw size={12} className="animate-spin" /> Lendo as contas da empresa…
                </p>
              )}
              {erro && (
                <div className="flex items-start gap-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[11px] leading-5 text-[#fca5a5]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Não deu para ler as contas: {erro}. Sem rede, esta lista não carrega — o vínculo
                    já feito continua valendo.
                    <button type="button" onClick={recarregar} className="ml-2 underline hover:text-[#f5f5f5]">
                      tentar de novo
                    </button>
                  </span>
                </div>
              )}
              {contas !== null && contas.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Nenhuma conta encontrada nesta empresa. As contas dos funcionários precisam ser
                    criadas no Supabase (painel do Auth) e receber o papel <b>Colaborador (ponto)</b>
                    — a receita pronta, idempotente, está em <code>docs/PONTO_CRIAR_COLABORADORES.sql</code>.
                  </span>
                </div>
              )}

              {contas !== null && contas.length > 0 && (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[200px] flex-1">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#adadad]" />
                      <input
                        className="w-full rounded-lg border border-[#525252] bg-[#333333] py-1.5 pl-7 pr-3 text-[11px] text-[#f5f5f5] focus:border-[#f97316] focus:outline-none"
                        placeholder="Buscar por nome, matrícula ou e-mail…"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoSemVinculo((v) => !v)}
                      className={`rounded-lg border px-3 py-1.5 text-[11px] transition-colors ${
                        soSemVinculo
                          ? 'border-[#f97316] bg-[#f97316]/20 text-[#ffa055]'
                          : 'border-[#525252] text-[#adadad] hover:text-[#f5f5f5]'
                      }`}
                    >
                      Só quem falta
                    </button>
                    <button
                      type="button"
                      onClick={recarregar}
                      className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-[11px] text-[#adadad] hover:text-[#f5f5f5]"
                    >
                      <RefreshCw size={11} /> Recarregar contas
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[#525252]">
                    <table className="w-full min-w-[620px] text-[11px]">
                      <thead>
                        <tr className="border-b border-[#525252] bg-[#333]">
                          <th className="px-3 py-2 text-left font-medium text-[#adadad]">Funcionário</th>
                          <th className="px-3 py-2 text-left font-medium text-[#adadad]">Conta de login</th>
                          <th className="px-3 py-2 text-left font-medium text-[#adadad]">Papel</th>
                          <th className="px-3 py-2 text-left font-medium text-[#adadad]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenados.map((w) => {
                          const conta = w.authUserId ? porUserId.get(w.authUserId) : undefined
                          const perdida = !!w.authUserId && !conta
                          const duplicada = !!w.authUserId && (donosDaConta.get(w.authUserId)?.length ?? 0) > 1
                          const papelNaoBate = !!conta && !ROLES_PONTO_REGISTRAR.includes(conta.papel as UserRole)
                          const ativo = funcionarioEstaAtivo(w)
                          return (
                            <tr key={w.id} className={`border-b border-[#525252]/60 last:border-0${ativo ? '' : ' opacity-60'}`}>
                              <td className="px-3 py-2">
                                <span className="font-medium text-[#f5f5f5]">{w.name}</span>
                                {w.registrationNumber && (
                                  <span className="ml-1.5 font-mono text-[10px] text-[#adadad]">{w.registrationNumber}</span>
                                )}
                                {!ativo && <span className="ml-1.5 text-[10px] text-[#a3a3a3]">(desligado)</span>}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  className={selectClass}
                                  disabled={!podeEscrever}
                                  value={w.authUserId ?? ''}
                                  onChange={(e) => vincular(w, e.target.value)}
                                  aria-label={`Conta de ${w.name}`}
                                >
                                  <option value="">— sem vínculo —</option>
                                  {/* ⚠️ Conta já usada por OUTRO funcionário não é oferecida: duas
                                      pessoas na mesma conta significaria uma batendo o ponto da
                                      outra sem que nada no registro o denunciasse. */}
                                  {contas
                                    .filter((c) => {
                                      if (c.userId === w.authUserId) return true
                                      return !donosDaConta.has(c.userId)
                                    })
                                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                                    .map((c) => (
                                      <option key={c.userId} value={c.userId}>
                                        {c.nome}{c.email ? ` · ${c.email}` : ''}{c.ativa ? '' : ' (bloqueada)'}
                                      </option>
                                    ))}
                                  {/* A conta que o cadastro aponta mas que não existe mais aqui
                                      precisa continuar visível, senão o <select> silenciosamente
                                      mostraria "sem vínculo" para um cadastro que TEM um. */}
                                  {perdida && (
                                    <option value={w.authUserId}>conta {w.authUserId?.slice(0, 8)}… (fora desta empresa)</option>
                                  )}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-[#c9c9c9]">
                                {conta ? roleLabel(conta.papel) : perdida ? '—' : ''}
                                {/* O selo diz que ESTA linha tem problema; o texto do problema fica
                                    na lista abaixo, onde cabe a frase inteira. */}
                                {(perdida || duplicada || papelNaoBate || (conta && !conta.ativa)) && (
                                  <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    perdida || duplicada
                                      ? 'bg-[#ef4444]/15 text-[#fca5a5]'
                                      : 'bg-[#eab308]/15 text-[#fbbf24]'
                                  }`}>
                                    {duplicada ? 'duplicada' : perdida ? 'não existe' : papelNaoBate ? 'não bate ponto' : 'bloqueada'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {w.authUserId ? (
                                  <button
                                    type="button"
                                    disabled={!podeEscrever}
                                    onClick={() => updateWorker(w.id, { authUserId: undefined })}
                                    title={`Desfazer o vínculo de ${w.name}`}
                                    className="flex items-center gap-1 text-[11px] text-[#adadad] hover:text-[#fca5a5] disabled:opacity-40"
                                  >
                                    <Link2Off size={11} /> desvincular
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] text-[#6b6b6b]">
                                    <Link2 size={11} /> escolha ao lado
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {ordenados.length === 0 && (
                          <tr><td colSpan={4} className="px-3 py-6 text-center text-[#adadad]">Nenhum funcionário nesse filtro.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Os problemas, juntos e abaixo — não espremidos dentro da linha da tabela. */}
                  <Problemas workers={workers} porUserId={porUserId} donosDaConta={donosDaConta} />

                  {contasSemFuncionario.length > 0 && (
                    <p className="mt-3 rounded-lg border border-[#525252] bg-[#333] px-3 py-2 text-[11px] leading-5 text-[#adadad]">
                      <b className="text-[#c9c9c9]">{contasSemFuncionario.length} conta(s) sem funcionário:</b>{' '}
                      {contasSemFuncionario.map((c) => c.email || c.nome).join(', ')}. Se alguma delas
                      for de um trabalhador, vincule-a acima — sem vínculo ela não bate ponto.
                    </p>
                  )}

                  {vinculados > 0 && ativosSemVinculo === 0 && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#4ade80]">
                      <CheckCircle2 size={12} /> Todos os funcionários ativos têm conta vinculada.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Os três defeitos que impedem a batida, listados com nome e conserto. Ficam fora da tabela porque
 * cada um precisa de uma frase, e frase dentro de célula vira reticências.
 */
function Problemas({ workers, porUserId, donosDaConta }: {
  workers: Worker[]
  porUserId: Map<string, Conta>
  donosDaConta: Map<string, Worker[]>
}) {
  const perdidos = workers.filter((w) => w.authUserId && !porUserId.has(w.authUserId))
  const duplicados = [...donosDaConta.entries()].filter(([, ws]) => ws.length > 1)
  const papelErrado = workers.filter((w) => {
    const c = w.authUserId ? porUserId.get(w.authUserId) : undefined
    return !!c && !ROLES_PONTO_REGISTRAR.includes(c.papel as UserRole)
  })
  const bloqueados = workers.filter((w) => {
    const c = w.authUserId ? porUserId.get(w.authUserId) : undefined
    return !!c && !c.ativa
  })

  if (!perdidos.length && !duplicados.length && !papelErrado.length && !bloqueados.length) return null

  return (
    <div className="mt-3 flex flex-col gap-2">
      {duplicados.length > 0 && (
        <Aviso cor="vermelho">
          <b>Mesma conta em mais de um cadastro:</b>{' '}
          {duplicados.map(([, ws]) => ws.map((w) => w.name).join(' + ')).join('; ')}. Enquanto isso
          durar, uma dessas pessoas bate o ponto que vai aparecer no espelho da outra. Desvincule
          todas menos uma.
        </Aviso>
      )}
      {perdidos.length > 0 && (
        <Aviso cor="vermelho">
          <b>Conta que não existe mais nesta empresa:</b> {perdidos.map((w) => w.name).join(', ')}.
          A pessoa vai abrir a tela do ponto e receber "sua conta não está ligada a um cadastro".
          Refaça o vínculo com a conta atual.
        </Aviso>
      )}
      {papelErrado.length > 0 && (
        <Aviso cor="amarelo">
          <b>Conta sem permissão de bater ponto:</b> {papelErrado.map((w) => w.name).join(', ')}. O
          papel precisa ser um dos que registram ponto (o normal para funcionário é{' '}
          <b>Colaborador (ponto)</b>) — a troca é SQL, ver{' '}
          <code>docs/PONTO_CRIAR_COLABORADORES.sql</code>.
        </Aviso>
      )}
      {bloqueados.length > 0 && (
        <Aviso cor="amarelo">
          <b>Conta bloqueada:</b> {bloqueados.map((w) => w.name).join(', ')}. O login não entra, e
          sem entrar não há batida.
        </Aviso>
      )}
    </div>
  )
}

function Aviso({ cor, children }: { cor: 'vermelho' | 'amarelo'; children: React.ReactNode }) {
  const c = cor === 'vermelho'
    ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#fca5a5]'
    : 'border-[#eab308]/40 bg-[#eab308]/10 text-[#fbbf24]'
  return (
    <p className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-5 ${c}`}>
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
