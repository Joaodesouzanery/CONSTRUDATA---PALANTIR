/**
 * A tela de bater ponto.
 *
 * ─── COMO ELA É DIFERENTE DO RESTO DO APP ─────────────────────────────────────
 * É a única tela feita para quem NÃO usa o sistema: o funcionário abre, bate, fecha. Por isso mora
 * numa rota própria (`/app/ponto`), fora do menu, no modelo do `/chamado/:slug` — um botão grande,
 * nada mais. O gestor vê o espelho e os relatórios dentro de Mão de Obra.
 *
 * ⚠️ E ela diz a verdade sobre o que não sabe: sem PWA, o app só abre offline se já estiver
 * carregado. Isso está escrito na tela, não escondido — quem depende do ponto para receber precisa
 * saber quando ele não vai funcionar.
 */
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Clock, MapPin, AlertTriangle, Check, WifiOff, LogIn, LogOut, Coffee, Power, CloudOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { usePontoStore, ROLES_PONTO_REGISTRAR } from '@/store/pontoStore'
import { usePermissaoEscrita } from '@/lib/roles'
import { avaliarCerca, distanciaLegivel, TEXTO_DO_MOTIVO } from '@/lib/geo'
import { cn, hojeLocalISO } from '@/lib/utils'
import { useLocalizacao } from './useLocalizacao'
import { jornadaAberta, proximaBatida, ROTULO_DA_BATIDA } from './batida'
import type { TipoDeBatida } from '@/types'

const RAIO_PADRAO_M = 5000

// Só o ícone mora aqui. A sequência e os rótulos vêm de `batida.ts`, que é o que o store usa —
// duas listas seriam duas verdades sobre qual é a próxima batida.
const ICONE: Record<TipoDeBatida, typeof LogIn> = {
  entrada: LogIn, inicio_intervalo: Coffee, fim_intervalo: Coffee, saida: LogOut,
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function PontoPage() {
  const user = useAuth((s) => s.user)
  const workers = useMaoDeObraStore(useShallow((s) => s.workers))
  const sites = useTorreStore(useShallow((s) => s.sites))
  const cltSettings = useMaoDeObraStore((s) => s.cltSettings)
  const { registros, registrar, pendingSync, syncError, ensureTenantScope, flush, pull } = usePontoStore(
    useShallow((s) => ({
      registros: s.registros, registrar: s.registrar, pendingSync: s.pendingSync,
      syncError: s.syncError,
      ensureTenantScope: s.ensureTenantScope, flush: s.flush, pull: s.pull,
    })),
  )
  const orgId = useAuth((s) => s.profile?.organization_id)
  const signOut = useAuth((s) => s.signOut)
  const geo = useLocalizacao()
  const [justificativa, setJustificativa] = useState('')
  const [enviando, setEnviando] = useState(false)

  // ⚠️ O relógio ANDA. Era `new Date()` avaliado no render, sem tique nenhum: a tela abria com a
  // hora certa e congelava ali. Num relógio de ponto isso é o pior defeito possível — a pessoa
  // confere o horário antes de tocar o botão, e confere um número velho.
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!orgId) return
    ensureTenantScope(orgId)
    void (async () => { await flush(); await pull() })()
  }, [orgId, ensureTenantScope, flush, pull])

  // Lê a posição ao abrir — o funcionário não deveria precisar apertar nada para isso.
  useEffect(() => { void geo.ler() }, [geo.ler]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ⚠️ Pelo VÍNCULO, nunca por nome. Ver o docblock de `Worker.authUserId`. */
  const eu = useMemo(() => workers.find((w) => w.authUserId && w.authUserId === user?.id), [workers, user])
  const obra = useMemo(() => sites.find((s) => s.id === eu?.siteId) ?? null, [sites, eu])
  const raioM = obra?.raioPontoM ?? cltSettings.raioPontoPadraoM ?? RAIO_PADRAO_M

  const cerca = useMemo(
    () => avaliarCerca(
      geo.leitura,
      obra?.lat != null && obra?.lng != null ? { lat: obra.lat, lng: obra.lng } : null,
      raioM,
    ),
    [geo.leitura, obra, raioM],
  )
  // Quando a leitura falhou, o motivo do erro é mais específico que o da cerca.
  const motivo = geo.motivo ?? cerca.motivo

  // ⚠️ A JORNADA aberta, não o dia civil. Quem entra às 22h e sai às 6h tinha a lista zerada à
  // meia-noite: o próximo toque voltava a ser "Entrada" e a saída era gravada como entrada de um
  // dia novo. Numa empresa que atende rede de saneamento 24 horas isso é o plantão, não a exceção.
  // Só recalcula por minuto (e não a cada tique do relógio) para não refazer a conta 60× por minuto.
  const minuto = agora.toISOString().slice(0, 16)
  const doDia = useMemo(
    () => jornadaAberta(registros.filter((r) => r.workerId === eu?.id), new Date().toISOString()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registros, eu, minuto],
  )
  const proxima = proximaBatida(doDia)
  const IconeDoBotao = ICONE[proxima]

  // ⚠️ Só BLOQUEIA quando o sistema SABE que está fora. Não saber onde a pessoa está é diferente
  // de saber que está longe — recusar aí criaria buraco no registro sem provar nada.
  const foraDaCerca = cerca.dentro === false
  // ⚠️ Obra sem coordenada cadastrada NÃO é falta do funcionário — é cadastro que o gestor não
  // fez. Exigir dele uma justificativa de cinco letras a cada batida, todo dia, transforma o
  // campo em ritual: em uma semana todo mundo digita "aaaaa" e a justificativa deixa de significar
  // qualquer coisa, inclusive nos casos em que ela importa. Registra, marca e avisa o gestor.
  const semCercaCadastrada = cerca.motivo === 'obra-sem-coordenada'
  const precisaJustificar = cerca.dentro === null && !semCercaCadastrada
  // ⚠️ A versão REATIVA. `podeRegistrarPonto()` é um retrato: as memberships chegam do servidor
  // depois do primeiro render, e com o retrato a tela ficaria presa no estado de antes delas.
  const permissao = usePermissaoEscrita(ROLES_PONTO_REGISTRAR)
  // Só barra quando o papel é conhecido E insuficiente — mesma regra do store: não saber é
  // diferente de saber que não pode.
  const papelBarra = !permissao.pode && permissao.motivo === 'papel_insuficiente'
  const podeBater = !!eu && !papelBarra && !geo.lendo && !foraDaCerca
    && (!precisaJustificar || justificativa.trim().length >= 5)

  async function bater() {
    if (!eu || !podeBater) return
    setEnviando(true)
    try {
      // Relê a posição no instante da batida: a do carregamento da tela pode ter minutos.
      const atual = await geo.ler()
      const c = avaliarCerca(
        atual.leitura,
        obra?.lat != null && obra?.lng != null ? { lat: obra.lat, lng: obra.lng } : null,
        raioM,
      )
      if (c.dentro === false) {
        toast.error(`Você está a ${distanciaLegivel(c.distanciaM ?? 0)} da obra. Aproxime-se para bater o ponto.`)
        return
      }
      // ⚠️ A cerca pode ter CAÍDO entre o render e o toque — o GPS some ao entrar numa galeria, a
      // precisão piora. Aí a tela nunca chegou a pedir justificativa, `podeBater` foi calculado
      // com o estado antigo, e a batida seria gravada sem a justificativa que o próprio tipo
      // declara obrigatória. Pede agora, em vez de gravar torto.
      const exigeAgora = c.dentro === null && c.motivo !== 'obra-sem-coordenada'
      if (exigeAgora && justificativa.trim().length < 5) {
        toast.error('A localização se perdeu agora. Escreva onde você está para registrar a batida.')
        return
      }
      const id = registrar({
        workerId: eu.id,
        siteId: obra?.id ?? null,
        tipo: proxima,
        lat: atual.leitura?.lat,
        lng: atual.leitura?.lng,
        precisaoM: atual.leitura?.precisaoM,
        distanciaM: c.distanciaM ?? undefined,
        dentroDaCerca: c.dentro ?? undefined,
        motivoSemCerca: atual.motivo ?? c.motivo,
        justificativa: justificativa.trim() || undefined,
      })
      if (!id) return
      setJustificativa('')
      toast.success(`${ROTULO_DA_BATIDA[proxima]} registrada às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Sair — com um aviso quando ainda há batida na fila.
   *
   * ⚠️ O `signOut` do projeto já faz `flushAllTenantStores()` antes de encerrar a sessão, então em
   * condições normais a fila sobe sozinha. O buraco é o canteiro sem sinal: ali o flush é no-op, a
   * batida fica guardada, e a PRÓXIMA pessoa que entrar no mesmo aparelho vai tentar enviá-la com a
   * conta dela — o servidor recusa, porque `ponto_insert` exige que a batida seja de quem está
   * logado. Não dá para consertar isso depois; dá para avisar antes, que é quando a pessoa ainda
   * pode esperar o sinal voltar.
   */
  async function sair() {
    if (pendingSync.length > 0) {
      const ok = window.confirm(
        `Você tem ${pendingSync.length} batida(s) que ainda não subiram para o servidor.\n\n`
        + 'Saindo agora, elas só conseguem subir quando VOCÊ entrar de novo neste aparelho — se '
        + 'outra pessoa entrar antes, o envio é recusado.\n\nProcure um lugar com sinal e espere o '
        + 'aviso sumir. Sair mesmo assim?',
      )
      if (!ok) return
    }
    await signOut()
  }

  // ── Quem não está vinculado não bate ─────────────────────────────────────────
  if (!eu) {
    return (
      <Moldura>
        <div className="rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-4 text-center">
          <AlertTriangle className="mx-auto mb-2 text-[#fbbf24]" size={22} />
          <p className="text-sm font-semibold text-[#fbbf24]">Sua conta ainda não está ligada a um cadastro de funcionário.</p>
          <p className="mt-1 text-xs leading-5 text-[#d1a54a]">
            Sem essa ligação o sistema não sabe de quem é a batida — e um cartão de ponto não pode
            ser atribuído por semelhança de nome. Peça ao responsável para fazer o vínculo em
            Mão de Obra › Funcionários.
          </p>
        </div>
        {/* ⚠️ Sair TAMBÉM aqui. Quem cai nesta tela é justamente quem entrou com a conta errada no
            celular do canteiro — sem este botão, o aparelho fica preso numa conta que não bate
            ponto e ninguém mais consegue registrar nada nele. */}
        <button
          type="button"
          onClick={() => { void signOut() }}
          className="mx-auto flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#a3a3a3] hover:border-[#ef4444]/50 hover:text-[#fca5a5]"
        >
          <Power size={13} /> Sair desta conta
        </button>
      </Moldura>
    )
  }

  return (
    <Moldura>
      {/* ⚠️ O botão de sair mora AQUI porque esta é a única tela que o colaborador alcança: o
          logout do sistema fica na barra lateral, e ele nunca vê barra lateral. Sem isto, o celular
          compartilhado do canteiro — o cenário que a própria migração cita — fica preso na conta da
          primeira pessoa que entrou, e todo mundo depois bateria o ponto no nome dela. */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-[#d4d4d4]">{eu.name}</span>
        <button
          type="button"
          onClick={() => { void sair() }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#525252] px-2.5 py-1.5 text-[11px] text-[#a3a3a3] hover:border-[#ef4444]/50 hover:text-[#fca5a5]"
        >
          <Power size={12} /> Sair
        </button>
      </div>

      <div className="text-center">
        <p className="text-4xl font-bold tabular-nums text-[#f5f5f5]">
          {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="text-xs text-[#a3a3a3]">
          {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      </div>

      {/* Onde a pessoa está, e o que isso permite. */}
      <div className={cn(
        'rounded-xl border p-3 text-xs leading-5',
        foraDaCerca ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#fca5a5]'
          : precisaJustificar ? 'border-[#eab308]/40 bg-[#eab308]/10 text-[#fbbf24]'
          // ⚠️ Obra sem coordenada não é verde. Verde aqui significa "conferi que você está na
          // obra", e o sistema não conferiu nada — não há cerca para conferir contra. Pintar de
          // verde seria a tela afirmando o que ela não sabe.
          : semCercaCadastrada ? 'border-[#525252] bg-[#333] text-[#a3a3a3]'
          : 'border-[#22c55e]/40 bg-[#22c55e]/10 text-[#86efac]',
      )}>
        <p className="flex items-center gap-1.5 font-semibold">
          <MapPin size={13} />
          {geo.lendo ? 'Localizando…'
            : foraDaCerca ? `Você está a ${distanciaLegivel(cerca.distanciaM ?? 0)} de ${obra?.name ?? 'obra'}`
            : precisaJustificar ? (motivo ? TEXTO_DO_MOTIVO[motivo] : 'Localização indisponível')
            : semCercaCadastrada ? 'Sem cerca cadastrada para esta obra'
            : `Na obra${obra ? ` — ${obra.name}` : ''}`}
        </p>
        {foraDaCerca && (
          <p className="mt-0.5">O ponto só pode ser registrado a até {distanciaLegivel(raioM)} da obra.</p>
        )}
        {semCercaCadastrada && (
          <p className="mt-0.5">
            Pode bater normalmente — a batida fica marcada para conferência. Avise o responsável
            para cadastrar a localização {obra ? `de ${obra.name}` : 'da sua obra'}.
          </p>
        )}
        {precisaJustificar && (
          <>
            <p className="mt-0.5">
              A batida será registrada assim mesmo e <b>marcada para conferência</b> — explique onde você está.
            </p>
            <input
              value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: atendimento na Rua X, em Guarujá"
              aria-label="Justificativa"
              className="mt-2 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
            />
          </>
        )}
      </div>

      {/* O botão. */}
      <button
        type="button" onClick={() => void bater()} disabled={!podeBater || enviando}
        className={cn(
          'flex w-full flex-col items-center gap-1 rounded-2xl py-8 text-white transition-colors',
          podeBater && !enviando ? 'bg-[#f97316] hover:bg-[#ea580c]' : 'cursor-not-allowed bg-[#3d3d3d] text-[#6b6b6b]',
        )}
      >
        <IconeDoBotao size={30} />
        <span className="text-lg font-bold">{ROTULO_DA_BATIDA[proxima]}</span>
        <span className="text-xs opacity-80">{enviando ? 'registrando…' : 'toque para registrar'}</span>
      </button>

      {papelBarra && (
        <p className="text-center text-[11px] leading-5 text-[#fca5a5]">
          {/* A explicação REAL do `podeEscrever`, que diz qual é o papel e o que fazer — não a
              frase genérica que estava aqui e não ajudava ninguém a resolver nada. */}
          {permissao.explicacao ?? 'O seu perfil não tem permissão para registrar ponto.'}
        </p>
      )}

      {/* O que já foi batido hoje. */}
      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
        {/* ⚠️ "Hoje" seria mentira no turno da noite: às 2h da manhã a lista mostra a jornada que
            começou ontem às 22h, e é isso que o título precisa dizer. */}
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#f5f5f5]">
          <Clock size={13} />
          {doDia.length === 0 || doDia[0].data === hojeLocalISO()
            ? 'Hoje'
            : `Jornada de ${doDia[0].data.slice(8, 10)}/${doDia[0].data.slice(5, 7)}`}
        </p>
        {doDia.length === 0 ? (
          <p className="text-xs text-[#a3a3a3]">Nenhuma batida ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {doDia.map((r) => {
              const rotulo = ROTULO_DA_BATIDA[r.tipo] ?? r.tipo
              return (
                <li key={r.id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#d4d4d4]">
                    <Check size={12} className="text-[#4ade80]" />
                    {rotulo}
                  </span>
                  <span className="flex items-center gap-2">
                    {r.dentroDaCerca === false || r.motivoSemCerca ? (
                      <span className="text-[10px] text-[#fbbf24]" title={r.justificativa}>a conferir</span>
                    ) : null}
                    {r.nsr ? <span className="text-[10px] text-[#6b6b6b]">NSR {r.nsr}</span> : null}
                    <span className="font-semibold tabular-nums text-[#f5f5f5]">{hora(r.momentoDispositivo)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ⚠️ O erro BLOQUEANTE precisa aparecer. Sem isto, uma batida recusada pelo servidor (papel
          errado, vínculo desfeito, conta trocada no aparelho) ficava contada como "aguardando
          envio" — a pessoa lia "sobe sozinha quando a rede voltar" para algo que nunca vai subir. */}
      {syncError && (
        <div className="flex items-start gap-2 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5 text-[11px] leading-5 text-[#fca5a5]">
          <CloudOff size={13} className="mt-0.5 shrink-0" />
          <span>
            <b>O servidor recusou o envio.</b> {syncError} A batida está guardada aqui no aparelho —
            mostre esta tela ao responsável antes de encerrar o expediente.
          </span>
        </div>
      )}

      {pendingSync.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#fbbf24]">
          <WifiOff size={12} />
          {pendingSync.length} batida(s) aguardando envio — sobem sozinhas quando a rede voltar.
        </p>
      )}

      {/* ⚠️ O limite do offline, dito. Sem PWA o app não abre sem rede. */}
      <p className="text-center text-[10px] leading-4 text-[#6b6b6b]">
        Deixe esta tela aberta se for trabalhar sem sinal: a batida é guardada no aparelho e enviada
        depois. Fechando o aplicativo sem internet, não será possível registrar.
      </p>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      {children}
    </div>
  )
}
