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
import { Clock, MapPin, AlertTriangle, Check, WifiOff, LogIn, LogOut, Coffee, Power, CloudOff, CalendarDays, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePontoStore, ROLES_PONTO_REGISTRAR } from '@/store/pontoStore'
import { usePermissaoEscrita } from '@/lib/roles'
import { avaliarCerca, distanciaLegivel, TEXTO_DO_MOTIVO } from '@/lib/geo'
import { cn, hojeLocalISO } from '@/lib/utils'
import { useLocalizacao } from './useLocalizacao'
import { jornadaAberta, proximaBatida, ROTULO_DA_BATIDA, SEQUENCIA_DA_JORNADA } from './batida'
import { jornadasDoPeriodo, TEXTO_DA_PENDENCIA } from './jornada'
import {
  podeSolicitar, TEXTO_SEM_PEDIR, TEXTO_DA_ACAO, TEXTO_DA_SITUACAO, MOTIVO_MINIMO,
  type AcaoDaSolicitacao, type SolicitacaoDePonto,
} from './solicitacao'
import { saldoDoPeriodo, creditosAVencer, TEXTO_SEM_PREVISTO, MESES_DE_COMPENSACAO_PADRAO } from '@/features/mao-de-obra/utils/bancoDeHoras'
import type { TipoDeBatida } from '@/types'

const RAIO_PADRAO_M = 5000

// Só o ícone mora aqui. A sequência e os rótulos vêm de `batida.ts`, que é o que o store usa —
// duas listas seriam duas verdades sobre qual é a próxima batida.
const ICONE: Record<TipoDeBatida, typeof LogIn> = {
  entrada: LogIn, inicio_intervalo: Coffee, fim_intervalo: Coffee, saida: LogOut,
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function PontoPage() {
  // ⚠️ `cltSettings` é o ÚNICO uso de outro store aqui, e para o `colaborador` ele não chega:
  // `clt_settings` está dentro da cerca restritiva de `20260918160000` e volta vazia. Na prática o
  // raio cai no padrão de 5 km. O conserto é uma RPC que devolve só os quatro parâmetros do ponto —
  // até lá, isto está escrito em vez de escondido.
  const cltSettings = useMaoDeObraStore((s) => s.cltSettings)
  const {
    registros, registrar, pendingSync, syncError, ensureTenantScope, flush, pull,
    meuCadastro, minhaObra, parametros, feriados, solicitacoes, solicitar,
    motivoSemCadastro, puxarMeuContexto,
  } = usePontoStore(
    useShallow((s) => ({
      registros: s.registros, registrar: s.registrar, pendingSync: s.pendingSync,
      syncError: s.syncError,
      ensureTenantScope: s.ensureTenantScope, flush: s.flush, pull: s.pull,
      meuCadastro: s.meuCadastro, minhaObra: s.minhaObra,
      parametros: s.parametros, feriados: s.feriados,
      solicitacoes: s.solicitacoes, solicitar: s.solicitar,
      motivoSemCadastro: s.motivoSemCadastro, puxarMeuContexto: s.puxarMeuContexto,
    })),
  )
  const orgId = useAuth((s) => s.profile?.organization_id)
  // ⚠️ A policy `ponto_sol_insert` exige `auth_user_id = auth.uid()`: o pedido tem de sair com a
  // conta LOGADA, nunca com um id guardado no cadastro. É a mesma regra da batida.
  const authUserId = useAuth((s) => s.user?.id)
  const signOut = useAuth((s) => s.signOut)
  const geo = useLocalizacao()
  /** A aba aberta. "Bater" é o padrão: quem abre esta tela abre para bater. */
  const [aba, setAba] = useState<'bater' | 'mes' | 'banco'>('bater')
  const [mes, setMes] = useState(() => hojeLocalISO().slice(0, 7))
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
    // ⚠️ O contexto é pedido ANTES do flush. `flush` e `pull` saem cedo quando não há rede, e sem
    // esta chamada própria um aparelho offline nunca sairia de 'carregando' — mostrando um spinner
    // eterno para quem tem o cadastro guardado no próprio aparelho e poderia bater o ponto.
    void (async () => { await puxarMeuContexto(); await flush(); await pull() })()
  }, [orgId, ensureTenantScope, flush, pull, puxarMeuContexto])

  // Lê a posição ao abrir — o funcionário não deveria precisar apertar nada para isso.
  useEffect(() => { void geo.ler() }, [geo.ler]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ⚠️ Pelo VÍNCULO, nunca por nome. Ver o docblock de `Worker.authUserId`.
   *
   * ⚠️ E vem do `pontoStore`, não de `useMaoDeObraStore.workers`. Aquele store NÃO é sincronizado
   * para o papel `colaborador` (`appModeStore.defsDoPapel`), então `workers` chegava vazio no
   * celular do canteiro e esta tela acusava "sua conta não está ligada a um cadastro" com o
   * vínculo perfeitamente feito no banco. Para gerente e diretor funcionava — foi por isso que
   * passou sem ninguém ver. O `pontoStore` busca as duas coisas por conta própria.
   */
  const eu = meuCadastro
  const obra = minhaObra
  // ⚠️ A ordem: a obra manda, depois o padrão que a RPC trouxe, depois o do `maoDeObraStore` (que
  // só existe para gerente — o colaborador não sincroniza aquele store), e só então a constante.
  const raioM = obra?.raioM ?? parametros.raioPontoPadraoM ?? cltSettings.raioPontoPadraoM ?? RAIO_PADRAO_M

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
    () => jornadaAberta(registros.filter((r) => r.workerId === eu?.workerId), new Date().toISOString()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registros, eu, minuto],
  )
  // ─── O meu mês e o meu banco de horas ──────────────────────────────────────
  //
  // ⚠️ MESMO motor do espelho do gestor (`jornadasDoPeriodo`, `saldoDoPeriodo`). Uma segunda conta
  // aqui faria o funcionário e o gestor lerem números diferentes para a mesma jornada — e aí quem
  // está certo vira discussão, que é exatamente o que um registro de ponto existe para evitar.
  const limites = useMemo(() => {
    const [ano, m] = mes.split('-').map(Number)
    return { de: `${mes}-01`, ate: `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}` }
  }, [mes])

  const minhasJornadas = useMemo(
    () => (eu ? jornadasDoPeriodo(registros.filter((r) => r.workerId === eu.workerId), limites.de, limites.ate) : []),
    [registros, eu, limites],
  )

  const settingsDoBanco = useMemo(() => ({
    // A RPC primeiro; o store de mão de obra só existe para quem é gestor.
    maxWeeklyHours: parametros.maxWeeklyHours ?? cltSettings.maxWeeklyHours,
    toleranciaPontoMin: parametros.toleranciaPontoMin ?? cltSettings.toleranciaPontoMin,
  }), [parametros, cltSettings])

  const feriadosSet = useMemo(() => new Set(feriados), [feriados])

  const saldo = useMemo(
    () => (eu
      ? saldoDoPeriodo(
          { id: eu.workerId, scheduleType: eu.scheduleType, admissionDate: eu.admissionDate },
          minhasJornadas, limites.de, limites.ate, settingsDoBanco, feriadosSet,
        )
      : null),
    [eu, minhasJornadas, limites, settingsDoBanco, feriadosSet],
  )

  /**
   * Os créditos perto de vencer — art. 59 §5º.
   *
   * ⚠️ Esta função existia, testada, e **nenhuma tela a chamava**: o aviso de que o crédito vence
   * não existia em lugar nenhum do sistema. Passado o prazo a hora não compensada não evapora,
   * vira hora extra a pagar — mas só se alguém souber a tempo.
   */
  const aVencer = useMemo(() => {
    if (!eu) return []
    const porMes = new Map<string, number>()
    for (let i = 0; i < 12; i++) {
      const d = new Date(`${mes}-01T00:00:00`)
      d.setMonth(d.getMonth() - i)
      const comp = d.toISOString().slice(0, 7)
      const [ano, m] = comp.split('-').map(Number)
      const ate = `${comp}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`
      const js = jornadasDoPeriodo(registros.filter((r) => r.workerId === eu.workerId), `${comp}-01`, ate)
      if (js.length === 0) continue
      const sp = saldoDoPeriodo(
        { id: eu.workerId, scheduleType: eu.scheduleType, admissionDate: eu.admissionDate },
        js, `${comp}-01`, ate, settingsDoBanco, feriadosSet,
      )
      porMes.set(comp, sp.saldoMin)
    }
    return creditosAVencer(
      [...porMes].map(([competencia, saldoMin]) => ({ competencia, saldoMin })),
      hojeLocalISO(),
      parametros.bancoHorasMeses ?? cltSettings.bancoHorasMeses ?? MESES_DE_COMPENSACAO_PADRAO,
    )
  }, [eu, registros, mes, settingsDoBanco, feriadosSet, parametros, cltSettings])

  /** Os pedidos de correção desta pessoa, do mais recente para o mais antigo. */
  const meusPedidos = useMemo(
    () => (eu ? solicitacoes.filter((x) => x.workerId === eu.workerId) : [])
      .slice().sort((a, b) => b.data.localeCompare(a.data)),
    [solicitacoes, eu],
  )

  const proxima = proximaBatida(doDia)
  const IconeDoBotao = ICONE[proxima]

  // ⚠️ O LEMBRETE que dá para cumprir sem PWA. Sem service worker não existe notificação com o
  // aplicativo fechado — isso foi decidido e está escrito no rodapé desta tela. O que existe é
  // avisar quem ABRE o aplicativo que ficou uma jornada sem saída para trás: é o erro mais comum,
  // o que mais dá trabalho para corrigir depois, e o que some do banco de horas se ninguém mexer.
  const abertasAnteriores = useMemo(() => {
    if (!eu) return []
    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
    return jornadasDoPeriodo(
      registros.filter((r) => r.workerId === eu.workerId),
      trintaDiasAtras.toISOString().slice(0, 10),
      hojeLocalISO(),
    ).filter((j) => j.pendencias.includes('sem-saida') && j.data < (doDia[0]?.data ?? hojeLocalISO()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, eu, minuto])

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
        workerId: eu.workerId,
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
  //
  // ⚠️ E o MOTIVO importa. Antes, qualquer ausência de cadastro virava "o gestor não fez o
  // vínculo" — inclusive "ainda estou carregando" e "estou sem rede". A pessoa ligava para o
  // escritório, e lá estava tudo certo. Acusar alguém de um erro que não cometeu é um defeito,
  // não um detalhe de texto.
  if (!eu) {
    return (
      <Moldura>
        <div className={cn(
          'rounded-xl border p-4 text-center',
          motivoSemCadastro === 'sem-vinculo'
            ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10'
            : 'border-[#525252] bg-[#333]',
        )}>
          {motivoSemCadastro === 'carregando' ? (
            <>
              <Clock className="mx-auto mb-2 animate-pulse text-[#a3a3a3]" size={22} />
              <p className="text-sm font-semibold text-[#d4d4d4]">Carregando o seu cadastro…</p>
            </>
          ) : motivoSemCadastro === 'sem-rede' ? (
            <>
              <WifiOff className="mx-auto mb-2 text-[#a3a3a3]" size={22} />
              <p className="text-sm font-semibold text-[#d4d4d4]">Sem internet, e o seu cadastro ainda não está neste aparelho.</p>
              <p className="mt-1 text-xs leading-5 text-[#a3a3a3]">
                Conecte-se uma vez para o aparelho guardar o seu vínculo. Depois disso, dá para
                bater o ponto mesmo sem sinal.
              </p>
            </>
          ) : motivoSemCadastro === 'erro' ? (
            <>
              <CloudOff className="mx-auto mb-2 text-[#fca5a5]" size={22} />
              <p className="text-sm font-semibold text-[#fca5a5]">Não consegui consultar o seu cadastro agora.</p>
              <p className="mt-1 text-xs leading-5 text-[#d1a54a]">
                Tente de novo em instantes. Se continuar, mostre esta tela ao responsável.
              </p>
              <button type="button" onClick={() => { void puxarMeuContexto() }}
                      className="mx-auto mt-3 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#d4d4d4] hover:bg-[#3d3d3d]">
                Tentar de novo
              </button>
            </>
          ) : (
            <>
              <AlertTriangle className="mx-auto mb-2 text-[#fbbf24]" size={22} />
              <p className="text-sm font-semibold text-[#fbbf24]">Sua conta ainda não está ligada a um cadastro de funcionário.</p>
              <p className="mt-1 text-xs leading-5 text-[#d1a54a]">
                Sem essa ligação o sistema não sabe de quem é a batida — e um cartão de ponto não
                pode ser atribuído por semelhança de nome. Peça ao responsável para fazer o vínculo
                em Mão de Obra › Funcionários.
              </p>
            </>
          )}
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
        <span className="truncate text-xs font-semibold text-[#d4d4d4]">{eu.nome}</span>
        <button
          type="button"
          onClick={() => { void sair() }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#525252] px-2.5 py-1.5 text-[11px] text-[#a3a3a3] hover:border-[#ef4444]/50 hover:text-[#fca5a5]"
        >
          <Power size={12} /> Sair
        </button>
      </div>

      {/* ⚠️ As abas ficam no ALTO mas o conteúdo de "Bater" continua inteiro e primeiro: quem abre
          esta tela abre para bater, e um passo a mais entre o polegar e o botão é um passo a mais
          num aparelho no bolso do uniforme. */}
      <div className="flex gap-1 rounded-xl border border-[#525252] bg-[#2c2c2c] p-1">
        {([
          ['bater', 'Bater', Clock],
          ['mes', 'Meu mês', CalendarDays],
          ['banco', 'Banco de horas', Scale],
        ] as const).map(([id, rotulo, Icone]) => (
          <button
            key={id} type="button" onClick={() => setAba(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors',
              aba === id ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-[#f5f5f5]',
            )}
          >
            <Icone size={13} /> {rotulo}
          </button>
        ))}
      </div>

      {aba === 'mes' ? (
        <MeuMes
          mes={mes} setMes={setMes} jornadas={minhasJornadas}
          semJanela={registros.length === 0}
          meus={meusPedidos}
          onPedir={(d) => solicitar({ ...d, workerId: eu.workerId, authUserId: authUserId ?? '' })}
        />
      ) : aba === 'banco' ? (
        <MeuBanco mes={mes} setMes={setMes} saldo={saldo} aVencer={aVencer}
                  mesesDeCompensacao={parametros.bancoHorasMeses ?? cltSettings.bancoHorasMeses ?? MESES_DE_COMPENSACAO_PADRAO} />
      ) : (
        <>

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
            : foraDaCerca ? `Você está a ${distanciaLegivel(cerca.distanciaM ?? 0)} de ${obra?.nome ?? 'obra'}`
            : precisaJustificar ? (motivo ? TEXTO_DO_MOTIVO[motivo] : 'Localização indisponível')
            : semCercaCadastrada ? 'Sem cerca cadastrada para esta obra'
            : `Na obra${obra ? ` — ${obra.nome}` : ''}`}
        </p>
        {foraDaCerca && (
          <p className="mt-0.5">O ponto só pode ser registrado a até {distanciaLegivel(raioM)} da obra.</p>
        )}
        {semCercaCadastrada && (
          <p className="mt-0.5">
            Pode bater normalmente — a batida fica marcada para conferência. Avise o responsável
            para cadastrar a localização {obra ? `de ${obra.nome}` : 'da sua obra'}.
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

      {abertasAnteriores.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2.5 text-[11px] leading-5 text-[#fbbf24]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            <b>Faltou registrar a saída {abertasAnteriores.length > 1 ? 'em dias anteriores' : `no dia ${abertasAnteriores[0].data.slice(8, 10)}/${abertasAnteriores[0].data.slice(5, 7)}`}.</b>{' '}
            Avise o responsável para corrigir — dia sem saída não entra no seu banco de horas.
          </span>
        </div>
      )}

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

        </>
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

// ─── Meu mês ──────────────────────────────────────────────────────────────────

/**
 * O histórico do próprio funcionário — "os horários que clicaram", nas palavras do cliente.
 *
 * ⚠️ É o MESMO motor do espelho do gestor (`jornadasDoPeriodo`). Uma segunda conta aqui faria os
 * dois lerem números diferentes para a mesma jornada, e aí "quem está certo" vira discussão — que
 * é exatamente o que um registro de ponto existe para evitar.
 */
function MeuMes({ mes, setMes, jornadas, semJanela, meus, onPedir }: {
  mes: string
  setMes: (v: string) => void
  jornadas: ReturnType<typeof jornadasDoPeriodo>
  semJanela: boolean
  meus: readonly SolicitacaoDePonto[]
  onPedir: (d: { data: string; acao: AcaoDaSolicitacao; tipo: TipoDeBatida; horaPedida: string; motivo: string }) => void
}) {
  const totalMin = jornadas.reduce((s, j) => s + j.minutosTrabalhados, 0)

  return (
    <div className="flex flex-col gap-3">
      <input
        type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês"
        className="w-full rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
      />

      {jornadas.length === 0 ? (
        <p className="rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-6 text-center text-xs leading-5 text-[#a3a3a3]">
          {semJanela
            /* ⚠️ O aparelho guarda 100 dias. Um mês mais antigo que isso não existe aqui, e
               mostrar "nenhuma batida" seria afirmar que a pessoa não trabalhou. */
            ? 'Este aparelho ainda não tem batidas guardadas. Conecte-se para baixar o seu histórico.'
            : 'Nenhuma batida registrada neste mês.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[#525252] bg-[#2c2c2c]">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#525252] text-left text-[#a3a3a3]">
                  <th className="px-2 py-1.5 font-medium">Dia</th>
                  <th className="px-2 py-1.5 font-medium">Entrada</th>
                  <th className="px-2 py-1.5 font-medium">Saída</th>
                  <th className="px-2 py-1.5 text-right font-medium">Interv.</th>
                  <th className="px-2 py-1.5 text-right font-medium">Trab.</th>
                </tr>
              </thead>
              <tbody>
                {jornadas.map((j) => (
                  <tr key={j.id} className="border-b border-[#3f3f3f] align-top">
                    <td className="px-2 py-1.5 tabular-nums text-[#e5e5e5]">
                      {j.data.slice(8, 10)}/{j.data.slice(5, 7)}
                      {/* Cada batida da jornada, com o horário exato do toque. */}
                      <span className="block text-[9px] text-[#6b6b6b]">
                        {j.batidas.map((b) => hora(b.momentoDispositivo)).join(' · ')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-[#d4d4d4]">{j.entrada ? hora(j.entrada.momentoDispositivo) : '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums text-[#d4d4d4]">{j.saida ? hora(j.saida.momentoDispositivo) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-[#a3a3a3]">{j.intervaloMin || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-[#f5f5f5]">
                      {Math.floor(j.minutosTrabalhados / 60)}h{String(j.minutosTrabalhados % 60).padStart(2, '0')}
                      {j.pendencias.length > 0 && (
                        <span className="block text-[9px] font-normal text-[#fbbf24]">
                          {j.pendencias.map((p) => TEXTO_DA_PENDENCIA[p]).join(' · ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[11px] text-[#a3a3a3]">
            {jornadas.length} jornada(s) · <b className="text-[#f5f5f5]">
              {Math.floor(totalMin / 60)}h{String(totalMin % 60).padStart(2, '0')}
            </b> no mês
          </p>
        </>
      )}
      <PedirCorrecao meus={meus} onPedir={onPedir} />

      <p className="text-center text-[10px] leading-4 text-[#6b6b6b]">
        Só o responsável corrige um registro de ponto, e a marcação original nunca é apagada — a
        correção entra como um registro novo, ao lado dela.
      </p>
    </div>
  )
}

// ─── Banco de horas ───────────────────────────────────────────────────────────

/**
 * O saldo do mês e o crédito que está para vencer.
 *
 * ⚠️ **Isto é o que as SUAS BATIDAS mostram, não a folha.** Hora extra que a empresa paga é fechada
 * no cálculo da folha, com adicional e regra de acordo coletivo; aqui é a diferença entre o
 * trabalhado e o previsto pelo regime contratual. Dizer isso na tela evita a conversa mais cara que
 * um banco de horas produz.
 */
function MeuBanco({ mes, setMes, saldo, aVencer, mesesDeCompensacao }: {
  mes: string
  setMes: (v: string) => void
  saldo: ReturnType<typeof saldoDoPeriodo> | null
  aVencer: ReturnType<typeof creditosAVencer>
  mesesDeCompensacao: number
}) {
  const sinal = (min: number) => `${min >= 0 ? '+' : '−'}${Math.floor(Math.abs(min) / 60)}h${String(Math.abs(min) % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3">
      <input
        type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês"
        className="w-full rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
      />

      {/* ⚠️ Diarista não tem banco, e dizer o motivo é melhor que mostrar zero. */}
      {!saldo || saldo.semBanco ? (
        <p className="rounded-xl border border-[#525252] bg-[#2c2c2c] px-3 py-6 text-center text-xs leading-5 text-[#a3a3a3]">
          {saldo?.semBanco ? TEXTO_SEM_PREVISTO[saldo.semBanco] : 'Sem dados para este mês.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Cartao rotulo="Previsto" valor={`${Math.floor(saldo.previstoMin / 60)}h`} />
            <Cartao rotulo="Trabalhado" valor={`${Math.floor(saldo.trabalhadoMin / 60)}h`} />
            <Cartao
              rotulo="Saldo" valor={sinal(saldo.saldoMin)}
              tom={saldo.saldoMin >= 0 ? '#4ade80' : '#fca5a5'}
            />
          </div>

          {saldo.diasIndefinidos > 0 && (
            /* ⚠️ Dia com previsto desconhecido fica FORA da conta, e o número precisa dizer isso —
               senão o saldo parece completo e não é. */
            <p className="rounded-xl border border-[#525252] bg-[#333] px-3 py-2 text-[11px] leading-5 text-[#a3a3a3]">
              {saldo.diasIndefinidos} dia(s) ficaram de fora da conta porque o sistema não sabe qual
              era a jornada prevista.
            </p>
          )}

          {aVencer.length > 0 && (
            <div className="rounded-xl border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2.5 text-[11px] leading-5 text-[#fbbf24]">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={13} /> Crédito perto de vencer
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {aVencer.map((c) => (
                  <li key={c.competencia} className="flex justify-between tabular-nums">
                    <span>{c.competencia.slice(5, 7)}/{c.competencia.slice(0, 4)}</span>
                    <span>{sinal(c.minutos)} · até {c.venceEm.slice(8, 10)}/{c.venceEm.slice(5, 7)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[10px] leading-4">
                Pelo art. 59 §5º da CLT o crédito deve ser compensado em {mesesDeCompensacao} meses.
                Passado o prazo ele <b>não some</b> — vira hora extra a pagar.
              </p>
            </div>
          )}
        </>
      )}

      <p className="text-center text-[10px] leading-4 text-[#6b6b6b]">
        Este é o saldo que as <b>suas batidas</b> mostram: trabalhado menos o previsto da sua
        jornada. O que a empresa paga de hora extra é fechado na folha, com as regras do acordo.
      </p>
    </div>
  )
}

function Cartao({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] px-2 py-2 text-center">
      <p className="text-[10px] text-[#a3a3a3]">{rotulo}</p>
      <p className="text-base font-bold tabular-nums" style={{ color: tom ?? '#f5f5f5' }}>{valor}</p>
    </div>
  )
}

// ─── Pedir correção ───────────────────────────────────────────────────────────

/**
 * O funcionário pede; o gestor decide.
 *
 * ⚠️ **Isto NÃO altera o ponto.** O pedido vai para uma tabela própria e só vira marcação quando o
 * responsável aprova — e, mesmo então, como um ajuste NOVO: a batida original nunca é apagada nem
 * reescrita (`trg_ponto_congelar`). A tela diz isso, porque quem pede precisa saber que não está
 * "corrigindo o seu ponto" sozinho.
 */
function PedirCorrecao({ meus, onPedir }: {
  meus: readonly SolicitacaoDePonto[]
  onPedir: (d: {
    data: string; acao: AcaoDaSolicitacao; tipo: TipoDeBatida; horaPedida: string; motivo: string
  }) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [data, setData] = useState(() => hojeLocalISO())
  const [acao, setAcao] = useState<AcaoDaSolicitacao>('incluir')
  const [tipo, setTipo] = useState<TipoDeBatida>('saida')
  const [horaPedida, setHora] = useState('')
  const [motivo, setMotivo] = useState('')

  const impedimento = podeSolicitar({ data, tipo, motivo }, meus, hojeLocalISO())
  const pronto = !!horaPedida && impedimento === null

  function enviar() {
    if (!pronto) return
    onPedir({ data, acao, tipo, horaPedida, motivo: motivo.trim() })
    setAberto(false); setHora(''); setMotivo('')
    toast.success('Pedido enviado. O responsável vai analisar.')
  }

  return (
    <div className="flex flex-col gap-2">
      {meus.length > 0 && (
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
          <p className="mb-1.5 text-xs font-semibold text-[#f5f5f5]">Meus pedidos</p>
          <ul className="flex flex-col gap-1.5">
            {meus.slice(0, 5).map((p) => (
              <li key={p.id} className="text-[11px] leading-4">
                <span className="text-[#d4d4d4]">
                  {p.data.slice(8, 10)}/{p.data.slice(5, 7)} · {ROTULO_DA_BATIDA[p.tipo]} às {p.horaPedida}
                </span>
                <span className={cn(
                  'ml-1.5 font-semibold',
                  p.situacao === 'aprovada' ? 'text-[#4ade80]'
                    : p.situacao === 'recusada' ? 'text-[#fca5a5]' : 'text-[#fbbf24]',
                )}>
                  {TEXTO_DA_SITUACAO[p.situacao]}
                </span>
                {p.resposta && <span className="block text-[10px] text-[#a3a3a3]">“{p.resposta}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!aberto ? (
        <button
          type="button" onClick={() => setAberto(true)}
          className="rounded-xl border border-[#525252] px-3 py-2.5 text-xs text-[#d4d4d4] hover:border-[#f97316]/50"
        >
          Pedir correção de uma marcação
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-[#f97316]/40 bg-[#f97316]/[0.06] p-3">
          <p className="text-[11px] leading-4 text-[#a3a3a3]">
            ⚠️ Isto <b>não altera</b> o seu ponto: envia um pedido ao responsável. Se ele aprovar, a
            correção entra como um registro novo — a marcação original nunca é apagada.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-[#a3a3a3]">
              Dia
              <input type="date" value={data} max={hojeLocalISO()} onChange={(e) => setData(e.target.value)}
                     className="mt-0.5 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5]" />
            </label>
            <label className="text-[10px] text-[#a3a3a3]">
              Horário
              <input type="time" value={horaPedida} onChange={(e) => setHora(e.target.value)}
                     className="mt-0.5 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5]" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-[#a3a3a3]">
              O que houve
              <select value={acao} onChange={(e) => setAcao(e.target.value as AcaoDaSolicitacao)}
                      className="mt-0.5 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5]">
                {(Object.keys(TEXTO_DA_ACAO) as AcaoDaSolicitacao[]).map((a) => (
                  <option key={a} value={a}>{TEXTO_DA_ACAO[a]}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] text-[#a3a3a3]">
              Qual marcação
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeBatida)}
                      className="mt-0.5 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5]">
                {SEQUENCIA_DA_JORNADA.map((b) => <option key={b.tipo} value={b.tipo}>{b.rotulo}</option>)}
              </select>
            </label>
          </div>

          <label className="text-[10px] text-[#a3a3a3]">
            Motivo (o responsável vai ler)
            <textarea
              value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
              placeholder="Ex.: esqueci de bater a saída, terminei o serviço na Rua X às 17h10"
              className="mt-0.5 w-full resize-none rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5]"
            />
          </label>

          {/* ⚠️ O impedimento aparece ANTES do envio, com o motivo — não como um erro depois do
              toque. Num celular, um botão que não responde é indistinguível de um app travado. */}
          {impedimento && motivo.length > 0 && (
            <p className="text-[10px] leading-4 text-[#fbbf24]">{TEXTO_SEM_PEDIR[impedimento]}</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setAberto(false)}
                    className="flex-1 rounded-lg border border-[#525252] px-3 py-2 text-xs text-[#a3a3a3]">
              Cancelar
            </button>
            <button
              type="button" onClick={enviar} disabled={!pronto}
              className="flex-1 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#6b6b6b]"
            >
              Enviar pedido
            </button>
          </div>
          <p className="text-[10px] text-[#6b6b6b]">
            Mínimo de {MOTIVO_MINIMO} letras no motivo. Dá para pedir correção do mês atual e do
            anterior.
          </p>
        </div>
      )}
    </div>
  )
}
