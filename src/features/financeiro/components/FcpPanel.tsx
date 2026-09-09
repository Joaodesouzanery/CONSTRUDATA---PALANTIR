/**
 * Fluxo de Caixa Projetado — as sete sub-abas.
 *
 * ⚠️ **Nada calculado é gravado.** O store guarda premissas e produção realizada; semanal, mensal,
 * econômico, viabilidade e capital são derivados na hora pelo motor. Guardar número calculado é
 * convite para ele envelhecer e discordar da própria conta.
 *
 * A distinção que a tela precisa manter viva, e que a planilha do cliente ensina:
 *  - **ECONÔMICO** é competência — o contrato dá lucro?
 *  - **FCP (semanal e mensal)** é caixa — eu tenho dinheiro no dia 20?
 * Uma obra pode ter margem excelente e quebrar de caixa. Misturar os dois é o erro.
 */
import { Fragment, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as XLSX from 'xlsx'
import { validateFileBeforeParse } from '@/lib/importEngine'
import {
  AlertTriangle, ArrowLeftRight, CheckCircle2, FileSpreadsheet, Lock, TrendingUp, Upload, Wallet, X, ClipboardList,
} from 'lucide-react'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { useRdoStore } from '@/store/rdoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { vinculosDeObra, divergenciasDoPlano, type DivergenciaDaSemana } from '@/features/rdo/utils/wcrParaFcp'
import { useFcpStore, type PlanoFcp, type StatusDoPlano } from '@/store/fcpStore'
import { useLpsStore } from '@/store/lpsStore'
import { useAuth } from '@/lib/auth'
import { useActiveObraStore } from '@/store/activeObraStore'
import { Autoria } from '@/components/shared/Autoria'
import { fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { fmtDataBR } from '@/lib/utils'
import { fatorDeProvisao13Ferias, ENCARGOS_SOBRE_PROVISAO_PADRAO,
  capitalNecessario, custoMensalDaCidade, custoMensalGlobal, custosPorRegime, fluxoEconomico,
  fluxoMensal, fluxoSemanal, sensibilidade, ticketDaCidade, totalDaFolha,
  viabilidadeDaCidade, viabilidadeGlobal, semanasDoFluxo, producaoPrevistaSemanal,
  VERSAO_DO_MOTOR,
} from '../utils/fcp/motor'
import { lerPlanilhaFcp, type Divergencia, type PrecoDoContrato } from '../utils/fcp/importarFcp'
import type { ConferenciaDaGrade } from '../utils/fcp/conferirGrade'
import { ConferenciaFcp } from './ConferenciaFcp'
import { registrarImportacao } from '../utils/importacoes'
import { chavesDosPrecos, estaConfirmado, type PrecosConfirmados } from '../utils/fcp/precosConfirmados'
import { OQueE } from '@/components/shared/OQueE'
import type { Explicacao } from '@/components/shared/explicacao'

/**
 * O jargão do FCP, em português de obra.
 *
 * Estes três números são os que vão para a reunião de diretoria, e são os que mais confundem: quem
 * nunca montou um fluxo de caixa lê "necessidade máxima" como "quanto a obra custa", que é outra
 * coisa completamente.
 */
const EXPLICA_FCP: Record<'capital' | 'sensibilidade' | 'defasagem' | 'provisao', Explicacao> = {
  capital: {
    oQueE: 'Quanto dinheiro precisa estar no bolso da empresa no pior dia da obra — aquele em que '
      + 'a folha vence e a medição ainda não caiu. Não é o custo da obra: é o buraco temporário '
      + 'entre pagar e receber, que some quando o cliente paga.',
    deOndeVem: 'Do pior saldo acumulado ANTES do recebimento do mês, mais a contingência das '
      + 'premissas. O mês do pior ponto vem escrito ao lado.',
  },
  sensibilidade: {
    oQueE: 'A mesma obra, calculada em quatro ritmos de produção. Serve para responder "e se a '
      + 'equipe render menos do que o combinado?" antes de assinar, não depois.',
    deOndeVem: 'Das quatro margens declaradas nas premissas. O cenário adotado é o que alimenta '
      + 'todas as outras abas.',
  },
  defasagem: {
    oQueE: 'Quantos dias levam entre a medição fechar e o dinheiro entrar. É esse intervalo que '
      + 'cria a necessidade de capital: a obra gasta todo mês e recebe com atraso.',
    deOndeVem: 'Da premissa "Defasagem de recebimento". Vale a pena conferir contra o que o '
      + 'contrato diz e contra o que o cliente vem pagando de fato.',
  },
  provisao: {
    oQueE: 'Reserva, todo mês, o pedaço do 13º e das férias que aquele mês de trabalho já gerou. '
      + 'Sem a provisão, dez meses parecem melhores e dois piores do que são — e a margem que a '
      + 'diretoria aprova é a dos dez.',
    deOndeVem: 'Da folha das equipes do mês: 1/12 de 13º + 1/12 de férias com o terço, mais os '
      + 'encargos por cima. Só existe no Econômico (competência); o caixa paga quando paga.',
    oQueFalta: 'A planilha do cliente não provisiona. Ligada, a conferência mês a mês vai apontar a '
      + 'diferença com a causa "provisão" — é esperado. O % de encargos é do contador.',
  },
}
import {
  conferirPlano, idDoPlano, planoParaGravar, type ConferenciaDoPlano,
  premissasComoTexto,
} from '../utils/fcp/reimportarPlano'
import { ROTULO_CENARIO, type Cenario, type PremissasFcp } from '../utils/fcp/tipos'
import {
  atividadesDoPlano, mudancasVindasDoLps, realizadoDoLps,
  type MudancaVindaDoLps,
} from '../utils/fcp/fcpParaLps'
import type { Matriz } from '../utils/controleDeCaixaPlanilha'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'

const BTN_P = 'px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40'
const BTN_S = 'inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors disabled:opacity-40'
const TABELA = 'w-full text-xs min-w-max'
const THEAD = 'bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]'
const TH = 'px-3 py-2 text-left'
const TD = 'px-3 py-2'
const NUM = 'px-3 py-2 text-right tabular-nums'

const COR_STATUS: Record<StatusDoPlano, string> = {
  rascunho: 'bg-[#3d3d3d] text-[#a3a3a3] border-[#525252]',
  enviado:  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  aprovado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}
const ROTULO_STATUS: Record<StatusDoPlano, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado para aprovação', aprovado: 'Aprovado',
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const un = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function FcpPanel() {
  // ⚠️ `useShallow` é OBRIGATÓRIO aqui. Um seletor que devolve objeto literal cria um objeto novo
  // a cada chamada; no zustand 5 + React 19 isso é re-render infinito, e o módulo Financeiro
  // INTEIRO cai — o `ModuleErrorBoundary` (App.tsx) envolve a rota, não a aba. Foi assim que esta
  // tela derrubou o Controle de Caixa junto, que não tinha defeito nenhum.
  const { planos, addPlano, updatePlano, lancarProducao } = useFcpStore(
    useShallow((s) => ({
      planos: s.planos, addPlano: s.addPlano, updatePlano: s.updatePlano, lancarProducao: s.lancarProducao,
    })),
  )
  const profile = useAuth((s) => s.profile)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  const plano = planos.find((p) => p.id === selecionado) ?? planos[0] ?? null
  const travado = plano?.status === 'aprovado'

  if (planos.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <Cabecalho onImportar={() => setImportando(true)} />
        <div className="text-center py-20 rounded-xl border border-dashed border-[#525252]">
          <FileSpreadsheet size={36} className="mx-auto text-[#525252] mb-3" />
          <p className="text-sm text-[#a3a3a3]">Nenhum plano de fluxo projetado ainda.</p>
          <p className="text-[11px] text-[#6b6b6b] mt-1 max-w-lg mx-auto">
            Importe a planilha de fluxo de caixa projetado. O sistema lê as premissas, os custos e
            os preços, <strong>recalcula</strong> o resto e mostra onde a planilha discorda dele.
          </p>
        </div>
        {importando && (
          <ImportarFcpModal
            obraId={activeObraId ?? undefined}
            planos={planos}
            orgId={profile?.organization_id}
            onGravar={(p) => { addPlano(p); setSelecionado(p.id) }}
            onClose={() => setImportando(false)}
          />
        )}
      </div>
    )
  }

  const P = plano!.premissas
  const realizado = plano!.realizado

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <Cabecalho onImportar={() => setImportando(true)}>
        {planos.length > 1 && (
          <select
            value={plano!.id}
            onChange={(e) => setSelecionado(e.target.value)}
            className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
          >
            {planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )}
        <span className={`rounded border px-2 py-1 text-[10px] font-semibold whitespace-nowrap ${COR_STATUS[plano!.status]}`}>
          {ROTULO_STATUS[plano!.status]}
        </span>
      </Cabecalho>

      <FluxoDeAprovacao
        plano={plano!}
        quem={profile?.full_name ?? profile?.email ?? 'alguém'}
        papel={profile?.role}
        onMudar={(patch) => updatePlano(plano!.id, patch)}
      />

      <PonteComOLps plano={plano!} />
      <PonteComOsRdos plano={plano!} />

      <ResumoDoPlano premissas={P} realizado={realizado} />

      {/* ⚠️ O motor mudou depois deste plano ter sido aprovado. A tela tem de dizer — a diretoria
          aprovou um número e está vendo outro, sem ter feito nada. O mesmo princípio que faz
          `planoParaGravar` devolver o plano a rascunho quando uma premissa muda. */}
      {plano!.status === 'aprovado' && (plano!.versaoDoMotor ?? 1) < VERSAO_DO_MOTOR && (
        <div className="mx-1 rounded-xl border border-[#eab308]/40 bg-[#eab308]/[0.08] p-3">
          <p className="text-[11px] font-semibold text-[#fbbf24]">
            O cálculo mudou depois que este plano foi aprovado
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#d4d4d4]">
            A projeção passou a incluir o <b>último recebimento do contrato</b> — a medição do mês
            final, que é paga já depois de a obra acabar e antes ficava de fora. Os números desta
            tela estão certos, mas <b>não são mais os que foram aprovados</b>. Reimporte a planilha
            ou reabra e aprove de novo para o registro voltar a bater com a tela.
          </p>
        </div>
      )}

      <SubTabHost
        key={plano!.id}
        tabs={[
          { key: 'premissas',   label: 'Premissas',   render: () => <SubPremissas premissas={P} travado={travado} onAlterar={(patch) => updatePlano(plano!.id, { premissas: { ...P, ...patch } })} /> },
          // ⚠️ Nome e salário individual só para a diretoria — o mesmo gate que protege a Auditoria e a
          // aprovação do plano. Os demais veem o quadro por EQUIPE, com contagem e total. É gate de
          // tela: a RLS de `fcp_planos` continua entregando o payload a quem chamar a API. Decisão do
          // controlador em 08/09/2026 (SECURITY.md).
          { key: 'custos',      label: 'Custos',      render: () => (
            <SubCustos premissas={P} podeVerNominal={profile?.role === 'owner' || profile?.role === 'diretor'} />
          ) },
          { key: 'semanal',     label: 'FCP Semanal', render: () => (
            <SubSemanal
              premissas={P} realizado={realizado} travado={travado}
              onLancar={(cidade, semana, valor) => lancarProducao(plano!.id, cidade, semana, valor)}
            />
          ) },
          { key: 'mensal',      label: 'FCP Mensal',  render: () => <SubMensal premissas={P} realizado={realizado} /> },
          { key: 'economico',   label: 'Econômico',   render: () => <SubEconomico premissas={P} realizado={realizado} /> },
          { key: 'viabilidade', label: 'Viabilidade', render: () => <SubViabilidade premissas={P} /> },
          { key: 'precos',      label: 'Preços do Contrato', render: () => (
            <SubPrecos
              precos={plano!.precos ?? {}}
              confirmados={plano!.precosConfirmados ?? {}}
              // Gate de tela, como o de aprovar: só diretoria confirma. A policy de `fcp_planos` não
              // olha papel — está dito no SECURITY.md.
              podeConfirmar={profile?.role === 'owner' || profile?.role === 'diretor'}
              onConfirmar={(chave, valor, desfazer) => {
                const atual = { ...(plano!.precosConfirmados ?? {}) }
                if (desfazer) delete atual[chave]
                else atual[chave] = { confirmadoEm: new Date().toISOString(), confirmadoPor: profile?.full_name ?? profile?.email ?? 'diretoria', valorConfirmado: valor }
                updatePlano(plano!.id, { precosConfirmados: atual })
              }}
            />
          ) },
        ]}
      />

      <Autoria tabela="fcp_planos" registroId={plano!.id} className="px-1" />

      {importando && (
        <ImportarFcpModal
          obraId={activeObraId ?? undefined}
          planos={planos}
          orgId={profile?.organization_id}
          onGravar={(p) => { addPlano(p); setSelecionado(p.id) }}
          onClose={() => setImportando(false)}
        />
      )}
    </div>
  )
}

function Cabecalho({ onImportar, children }: { onImportar: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15 shrink-0">
        <TrendingUp size={18} className="text-[#f97316]" />
      </div>
      <div className="min-w-0">
        <p className="text-[#f5f5f5] text-sm font-semibold leading-none">Fluxo de Caixa Projetado</p>
        <p className="text-[#6b6b6b] text-[11px] mt-1">
          O <strong>projetado</strong>. O Fluxo de Caixa ao lado mostra o realizado.
        </p>
      </div>
      {children}
      <button type="button" onClick={onImportar} className={`${BTN_P} inline-flex items-center gap-1.5 ml-auto`}>
        <Upload size={13} /> Importar planilha
      </button>
    </div>
  )
}

// ─── Aprovação ────────────────────────────────────────────────────────────────

function FluxoDeAprovacao({
  plano, quem, papel, onMudar,
}: {
  plano: PlanoFcp
  quem: string
  papel?: string
  onMudar: (patch: Partial<PlanoFcp>) => void
}) {
  // Só diretoria aprova. Enviar para aprovação, qualquer um pode.
  const podeAprovar = papel === 'owner' || papel === 'diretor'
  const agora = () => new Date().toISOString()

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
      {plano.status === 'rascunho' && (
        <>
          <span className="text-[11px] text-[#6b6b6b]">
            Rascunho — pode editar à vontade. Enviar para aprovação congela a discussão num número.
          </span>
          <button
            type="button"
            onClick={() => onMudar({ status: 'enviado', enviadoPor: quem, enviadoEm: agora() })}
            className={`${BTN_S} ml-auto`}
          >
            Enviar para aprovação
          </button>
        </>
      )}
      {plano.status === 'enviado' && (
        <>
          <span className="text-[11px] text-[#a3a3a3]">
            Enviado por <strong>{plano.enviadoPor}</strong>
            {plano.enviadoEm ? ` em ${fmtDataBR(plano.enviadoEm.slice(0, 10))}` : ''}.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMudar({ status: 'rascunho', enviadoPor: undefined, enviadoEm: undefined })}
              className={BTN_S}
            >
              Devolver para rascunho
            </button>
            <button
              type="button" disabled={!podeAprovar}
              title={podeAprovar ? undefined : 'Só diretoria aprova'}
              onClick={() => onMudar({ status: 'aprovado', aprovadoPor: quem, aprovadoEm: agora() })}
              className={BTN_P}
            >
              Aprovar
            </button>
          </div>
        </>
      )}
      {plano.status === 'aprovado' && (
        <>
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <span className="text-[11px] text-[#a3a3a3]">
            Aprovado por <strong>{plano.aprovadoPor}</strong>
            {plano.aprovadoEm ? ` em ${fmtDataBR(plano.aprovadoEm.slice(0, 10))}` : ''}.
            {' '}As premissas ficam travadas; a produção realizada continua sendo lançada.
          </span>
          <button
            type="button" disabled={!podeAprovar}
            title={podeAprovar ? undefined : 'Só diretoria reabre um plano aprovado'}
            // Reabrir fica registrado no audit_log com quem e quando — é a pergunta que aparece
            // quando o número da reunião não é mais o número da tela.
            onClick={() => onMudar({ status: 'rascunho', aprovadoPor: undefined, aprovadoEm: undefined })}
            className={`${BTN_S} ml-auto`}
          >
            <Lock size={12} /> Reabrir
          </button>
        </>
      )}
    </div>
  )
}

// ─── A ponte com o Last Planner ───────────────────────────────────────────────

/**
 * O plano vira compromisso semanal no LPS; o executado do LPS volta como produção realizada.
 *
 * ⚠️ As duas direções mostram o que vai mudar ANTES de gravar — mesma regra do resto do módulo.
 * Puxar do LPS mexe na medição projetada, que mexe no capital necessário: é dinheiro, não é
 * sincronização de calendário.
 */
/**
 * O que os RDOs WCR dizem sobre a produção — e o botão que decide se aquilo vira plano.
 *
 * ⚠️ **Nada aqui é automático.** A conta roda sozinha; a gravação só acontece no clique. O capital
 * recomendado deste plano é o número que decide quanto dinheiro a obra precisa — se ele mudasse a
 * cada RDO salvo no campo, mudaria entre uma reunião e outra sem ninguém saber por quê.
 *
 * ⚠️ **Só conta o que é UN.** Metro de rede (PRA/PRE) volta à parte: a medição multiplica a
 * produção pelo ticket POR LIGAÇÃO, e jogar metro nessa conta inflaria o faturamento projetado.
 */
function PonteComOsRdos({ plano }: { plano: PlanoFcp }) {
  const rdos = useRdoStore((s) => s.rdos)
  const sites = useTorreStore((s) => s.sites)
  const lancarProducao = useFcpStore((s) => s.lancarProducao)
  const [conferindo, setConferindo] = useState<DivergenciaDaSemana[] | null>(null)

  const vinculos = useMemo(() => vinculosDeObra(sites), [sites])
  const semanas = useMemo(() => semanasDoFluxo(plano.premissas, 12), [plano.premissas])

  const divergencias = useMemo(() => {
    const previsto = (cidadeId: string) => {
      const c = plano.premissas.cidades.find((x) => x.id === cidadeId)
      return c ? producaoPrevistaSemanal(plano.premissas, c) : 0
    }
    return divergenciasDoPlano(plano, rdos, vinculos, semanas, (cidadeId) => previsto(cidadeId))
  }, [plano, rdos, vinculos, semanas])

  // Só vale mostrar o que MUDA alguma coisa.
  const pendentes = useMemo(
    () => divergencias.filter((d) => Math.abs(d.diferenca) > 0.005),
    [divergencias],
  )

  const nomeDaCidade = (id: string) => plano.premissas.cidades.find((c) => c.id === id)?.nome ?? id
  const emReais = (d: DivergenciaDaSemana) => {
    const c = plano.premissas.cidades.find((x) => x.id === d.cidadeId)
    return c ? d.diferenca * ticketDaCidade(c) : 0
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
        <ClipboardList size={14} className="text-[#f97316] shrink-0" />
        <span className="text-[11px] text-[#6b6b6b]">
          RDO WCR:{' '}
          {vinculos.length === 0
            ? <>nenhuma obra diz a que cidade deste plano pertence — preencha em <strong className="text-[#a3a3a3]">Contrato → RDO WCR</strong></>
            : divergencias.length === 0
              ? <>nenhum RDO finalizado nas 12 semanas do plano</>
              : <>
                  <strong className="text-[#a3a3a3]">{divergencias.length} semana(s)</strong> com apontamento
                  {pendentes.length > 0 && <> · <strong className="text-amber-300">{pendentes.length} diferente(s) do plano</strong></>}
                </>}
        </span>
        <div className="ml-auto">
          <button
            type="button" disabled={pendentes.length === 0}
            onClick={() => setConferindo(pendentes)}
            className={pendentes.length > 0 ? BTN_P : BTN_S}
          >
            Conferir com os RDOs
          </button>
        </div>
      </div>

      {conferindo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-[#525252] bg-[#2c2c2c]">
            <div className="flex items-center gap-2 border-b border-[#525252] px-5 py-3">
              <h3 className="text-sm font-semibold text-[#f5f5f5]">O que os RDOs dizem</h3>
              <button type="button" onClick={() => setConferindo(null)} className="ml-auto text-[#6b6b6b] hover:text-white"><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-5 py-4">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#525252] text-left text-[#6b6b6b]">
                    <th className="py-1.5 pr-3 font-medium">Semana</th>
                    <th className="py-1.5 pr-3 font-medium">Cidade</th>
                    <th className="py-1.5 pr-3 text-right font-medium">No plano</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Nos RDOs</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Impacto</th>
                    <th className="py-1.5 font-medium">Fora da conta</th>
                  </tr>
                </thead>
                <tbody>
                  {conferindo.map((d) => (
                    <tr key={`${d.cidadeId}-${d.semana}`} className="hover:bg-white/[0.02]">
                      <td className={`${TD} text-[#f5f5f5]`}>S{d.semana}</td>
                      <td className={TD}>{nomeDaCidade(d.cidadeId)}</td>
                      <td className={NUM}>{d.noPlano !== undefined ? un(d.noPlano) : '—'}</td>
                      <td className={`${NUM} text-[#f5f5f5] font-semibold`}>{un(d.dosRdos)}</td>
                      <td className={`${NUM} ${emReais(d) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{fmtBRL(emReais(d))}</td>
                      <td className="py-1.5 text-[10px] text-[#6b6b6b]">
                        {/* ⚠️ Metro de rede e sigla sem medida aparecem, mas NÃO entram no número
                            adotado — somá-los ao ticket por ligação inflaria a medição. */}
                        {d.metros > 0 && <>{un(d.metros)} m de rede</>}
                        {d.metros > 0 && d.semMedida > 0 && ' · '}
                        {d.semMedida > 0 && <>{d.semMedida} sem medida</>}
                        {d.metros === 0 && d.semMedida === 0 && '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-[#6b6b6b]">
                {conferindo.reduce((s, d) => s + d.rdos, 0)} RDO(s) finalizado(s) entraram nesta conta.
                Rascunho não conta.
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-[#525252] px-5 py-4">
              <button type="button" onClick={() => setConferindo(null)} className={BTN_S}>Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  for (const d of conferindo) lancarProducao(plano.id, d.cidadeId, d.semana, d.dosRdos)
                  setConferindo(null)
                }}
                className={`${BTN_P} ml-auto`}
              >
                Adotar {conferindo.length} semana(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PonteComOLps({ plano }: { plano: PlanoFcp }) {
  const { atividades, addActivity } = useLpsStore(
    useShallow((s) => ({ atividades: s.activities, addActivity: s.addActivity })),
  )
  const lancarProducao = useFcpStore((s) => s.lancarProducao)
  const [conferindo, setConferindo] = useState<MudancaVindaDoLps[] | null>(null)

  const jaGeradas = useMemo(
    () => atividades.filter((a) => a.sourceFcpId?.startsWith(`${plano.id}:`)).length,
    [atividades, plano.id],
  )
  const doLps = useMemo(() => realizadoDoLps(atividades, plano.id), [atividades, plano.id])
  const pendentes = useMemo(
    () => mudancasVindasDoLps(plano.premissas, plano.realizado, doLps),
    [plano.premissas, plano.realizado, doLps],
  )

  function gerar() {
    const novas = atividadesDoPlano(plano.premissas, plano.id, 12)
    // Não recria o que já existe — gerar duas vezes duplicaria a meta na reunião.
    const existentes = new Set(atividades.map((a) => a.sourceFcpId).filter(Boolean))
    let criadas = 0
    for (const a of novas) {
      if (existentes.has(a.sourceFcpId)) continue
      addActivity({ ...a, obraId: plano.obraId ?? null })
      criadas++
    }
    if (criadas === 0) alert('As atividades deste plano já estão no Last Planner.')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#3d3d3d] p-3">
        <ArrowLeftRight size={14} className="text-[#f97316] shrink-0" />
        <span className="text-[11px] text-[#6b6b6b]">
          Last Planner:{' '}
          {jaGeradas > 0
            ? <>o plano já virou <strong className="text-[#a3a3a3]">{jaGeradas} atividade(s)</strong> semanais</>
            : <>a meta semanal do plano pode virar compromisso na reunião de planejamento</>}
          {pendentes.length > 0 && (
            <> · <strong className="text-amber-300">{pendentes.length} lançamento(s)</strong> aguardando</>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={gerar} className={BTN_S}>
            {jaGeradas > 0 ? 'Gerar as que faltam' : 'Gerar atividades no LPS'}
          </button>
          <button
            type="button" disabled={pendentes.length === 0}
            onClick={() => setConferindo(pendentes)}
            className={pendentes.length > 0 ? BTN_P : BTN_S}
          >
            Puxar realizado do LPS {pendentes.length > 0 ? `(${pendentes.length})` : ''}
          </button>
        </div>
      </div>

      {conferindo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl border border-[#525252] bg-[#2d2d2d] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
              <div>
                <p className="text-sm font-semibold text-white">Puxar realizado do Last Planner</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">
                  Isto muda a medição projetada — e portanto o capital necessário.
                </p>
              </div>
              <button type="button" onClick={() => setConferindo(null)} className="text-[#6b6b6b] hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="overflow-x-auto rounded-xl border border-[#525252]">
                <table className={TABELA}>
                  <thead><tr className={THEAD}>
                    <th className={TH}>Semana</th><th className={TH}>Cidade</th>
                    <th className="px-3 py-2 text-right">Previsto</th>
                    <th className="px-3 py-2 text-right">Hoje no FCP</th>
                    <th className="px-3 py-2 text-right">No LPS</th>
                    <th className="px-3 py-2 text-right">Impacto na medição</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#1f2937]">
                    {conferindo.map((m) => (
                      <tr key={`${m.cidadeId}-${m.semana}`} className="hover:bg-white/[0.02]">
                        <td className={`${TD} text-[#f5f5f5]`}>S{m.semana}</td>
                        <td className={TD}>{m.cidadeNome}</td>
                        <td className={NUM}>{un(m.previsto)}</td>
                        <td className={NUM}>{m.noFcp !== undefined ? un(m.noFcp) : '—'}</td>
                        <td className={`${NUM} text-[#f5f5f5] font-semibold`}>{un(m.noLps)}</td>
                        <td className={`${NUM} ${m.impactoEmReais < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                          {fmtBRL(m.impactoEmReais)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-[#6b6b6b]">
                Impacto total na medição:{' '}
                <strong className={conferindo.reduce((s, m) => s + m.impactoEmReais, 0) < 0 ? 'text-red-300' : 'text-emerald-300'}>
                  {fmtBRL(conferindo.reduce((s, m) => s + m.impactoEmReais, 0))}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2 px-5 py-4 border-t border-[#525252]">
              <button type="button" onClick={() => setConferindo(null)} className={BTN_S}>Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  for (const m of conferindo) lancarProducao(plano.id, m.cidadeId, m.semana, m.noLps)
                  setConferindo(null)
                }}
                className={`${BTN_P} ml-auto`}
              >
                Adotar {conferindo.length} lançamento(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Resumo ───────────────────────────────────────────────────────────────────

function ResumoDoPlano({ premissas, realizado }: { premissas: PremissasFcp; realizado: PlanoFcp['realizado'] }) {
  const { capital, resultado, piorMes } = useMemo(() => {
    const meses = fluxoMensal(premissas, realizado)
    const cap = capitalNecessario(premissas, meses)
    const eco = fluxoEconomico(premissas, realizado)
    return {
      capital: cap,
      resultado: eco.length > 0 ? eco[eco.length - 1].resultadoAcumulado : 0,
      piorMes: cap.mesDoPiorPonto,
    }
  }, [premissas, realizado])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Indicador
        rotulo="Capital recomendado" valor={fmtBRL(capital.capitalRecomendado)}
        nota={`necessidade ${fmtBRL(capital.necessidadeMaxima)} + ${pct(premissas.contingencia)} de contingência`}
        icone={<Wallet size={14} className="text-[#f97316]" />}
      />
      <Indicador
        rotulo="Pior ponto do caixa" valor={piorMes ? fmtDataBR(piorMes) : '—'}
        nota="quando a folha vence e a medição ainda não caiu"
      />
      <Indicador
        rotulo="Resultado no horizonte" valor={fmtBRL(resultado)}
        nota="competência — é margem, não caixa"
        variacao={resultado >= 0 ? 'boa' : 'ruim'}
      />
      <Indicador
        rotulo="Cenário adotado" valor={ROTULO_CENARIO[premissas.cenario]}
        nota={`margem de ${pct(premissas.margens[premissas.cenario])}`}
      />
    </div>
  )
}

// ─── 1. Premissas ─────────────────────────────────────────────────────────────

function SubPremissas({ premissas: P, travado, onAlterar }: {
  premissas: PremissasFcp
  travado: boolean
  onAlterar: (patch: Partial<PremissasFcp>) => void
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {travado && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
          Plano aprovado — as premissas estão travadas. Reabra para editar.
        </p>
      )}
      <Bloco titulo="Calendário e contrato">
        <Item rotulo="Início da obra" valor={fmtDataBR(P.inicioObra)} />
        <Item rotulo="Fim da operação" valor={fmtDataBR(P.fimOperacao)} />
        <Item rotulo="Dias por mês (rateio)" valor={String(P.diasPorMes)} />
        <Item rotulo="Defasagem de recebimento" valor={`${P.defasagemDias} dias`}
              nota="a medição fecha no último dia do mês e é paga tantos dias depois" />
        <Item rotulo="Imposto da nota" valor={pct(P.imposto)} />
      </Bloco>

      <Bloco titulo="Cenário de produção">
        <Item rotulo="Adotado" valor={ROTULO_CENARIO[P.cenario]} destaque />
        {(Object.keys(P.margens) as Cenario[]).map((c) => (
          <Item key={c} rotulo={`Margem ${ROTULO_CENARIO[c]}`} valor={pct(P.margens[c])}
                nota={c === 'MINIMA' ? 'empate: receita líquida = custo' : undefined} />
        ))}
      </Bloco>

      <Bloco titulo="Preços médios por serviço (ticket)">
        {P.cidades.map((c) => (
          <Item key={c.id} rotulo={c.nome} valor={fmtBRL(ticketDaCidade(c))}
                nota={c.mix ? `${c.mix.rotuloA} ${fmtBRL(c.mix.ticketA)} · ${c.mix.rotuloB} ${fmtBRL(c.mix.ticketB)} · ${pct(c.mix.fracaoB)} de ${c.mix.rotuloB.toLowerCase()}` : undefined} />
        ))}
      </Bloco>

      <Bloco titulo="Capital e risco">
        <Item rotulo="Contingência" valor={pct(P.contingencia)} nota="atraso de medição, chuva, quebra, retrabalho" />
        <Item rotulo="Fator de custos do 1º mês" valor={pct(P.fatorPrimeiroMes)} nota="a obra começa no meio do mês" />
      </Bloco>

      <Bloco titulo="Quem paga o quê">
        {/* ⚠️ É configuração da obra, não código. Obra sem consórcio marca tudo como a empresa e o
            desconto zera — e aí o caixa é outro completamente. */}
        {(Object.keys(P.regime) as Array<keyof typeof P.regime>).map((b) => (
          <Item key={b} rotulo={ROTULO_BLOCO[b]}
                valor={P.regime[b] === 'CONSORCIO' ? 'Consórcio' : 'Empresa'} />
        ))}
        <Item rotulo="O consórcio desconta da medição?"
              valor={P.consorcioDescontaDaMedicao ? 'Sim' : 'Não'}
              nota={P.consorcioDescontaDaMedicao ? 'o que ele banca é abatido do que a empresa recebe' : 'ele banca e não cobra — entra muito mais caixa'} />
        <Item rotulo="Base do imposto"
              valor={P.baseDoImposto === 'CHEIA' ? 'Medição cheia' : 'Líquida do desconto'}
              nota="⚠️ premissa crítica — confirme com o contador" destaque />
      </Bloco>

      {/* A única premissa que NÃO vem da planilha — por isso é a única editável aqui. Nasce
          desligada para a conferência continuar batendo ao centavo. */}
      <Bloco titulo="Provisões (só no Econômico)">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Provisionar 13º e férias</p>
            <OQueE titulo="Provisão de 13º e férias" explicacao={EXPLICA_FCP.provisao} />
          </div>
          <label className="mt-1 flex items-center gap-2 text-sm text-[#f5f5f5]">
            <input type="checkbox" className="h-4 w-4 accent-[#f97316]" disabled={travado}
                   checked={P.provisionar13Ferias ?? false}
                   onChange={(e) => onAlterar({ provisionar13Ferias: e.target.checked })} />
            {P.provisionar13Ferias ? 'Sim' : 'Não'}
          </label>
          <p className="text-[10px] text-[#6b6b6b] mt-0.5">
            {P.provisionar13Ferias
              ? `${(fatorDeProvisao13Ferias(P.encargosSobreProvisao) * 100).toFixed(1)}% da folha por mês`
              : 'a planilha do cliente não provisiona — igual a ela'}
          </p>
        </div>
        {P.provisionar13Ferias && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Encargos sobre a provisão (%)</p>
            <input type="number" step="0.1" min={0} disabled={travado}
                   className="mt-1 w-24 rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-right text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
                   defaultValue={((P.encargosSobreProvisao ?? ENCARGOS_SOBRE_PROVISAO_PADRAO) * 100).toFixed(1)}
                   onBlur={(e) => { const v = Number(String(e.target.value).replace(',', '.')); if (Number.isFinite(v) && v >= 0) onAlterar({ encargosSobreProvisao: v / 100 }) }} />
            <p className="text-[10px] text-[#6b6b6b] mt-0.5">FGTS + patronal + RAT + terceiros — confira com o contador</p>
          </div>
        )}
      </Bloco>
    </div>
  )
}

const ROTULO_BLOCO: Record<string, string> = {
  folha: 'Folha das equipes', engenheiro: 'Engenheiro', estrutura: 'Estrutura e locações',
  indiretos: 'Custos indiretos', mobilizacao: 'Mobilização',
}

// ─── 2. Custos ────────────────────────────────────────────────────────────────

/**
 * O quadro por equipe, para quem NÃO pode ver nome e salário.
 *
 * Contagem e total por `equipe` — é o suficiente para conferir se o custo mensal fecha, que é a
 * pergunta que um engenheiro ou visualizador faz nesta aba. Quem precisa do nominal é a diretoria.
 */
function quadroPorEquipe(quadro: PremissasFcp['cidades'][number]['custos']['quadro']) {
  const m = new Map<string, { pessoas: number; total: number }>()
  for (const p of quadro) {
    const k = p.equipe ?? 'Sem equipe'
    const v = m.get(k) ?? { pessoas: 0, total: 0 }
    v.pessoas++
    v.total += p.salario + p.encargos + p.beneficios
    m.set(k, v)
  }
  return [...m.entries()].sort((a, b) => b[1].total - a[1].total)
}

function SubCustos({ premissas: P, podeVerNominal }: { premissas: PremissasFcp; podeVerNominal: boolean }) {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {P.cidades.map((c) => (
          <Indicador key={c.id} rotulo={`Custo mensal — ${c.nome}`} valor={fmtBRL(custoMensalDaCidade(c))} />
        ))}
        <Indicador rotulo="Custo mensal GLOBAL" valor={fmtBRL(custoMensalGlobal(P))} />
      </div>

      {P.cidades.map((c) => {
        const regime = custosPorRegime(P, c)
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#a3a3a3]">{c.nome}</p>
            <p className="text-[11px] text-[#6b6b6b]">
              Consórcio banca {fmtBRL(regime.consorcio)} · a empresa paga {fmtBRL(regime.empresa)} do próprio caixa
              {P.consorcioDescontaDaMedicao && ' · e o que o consórcio banca é descontado da medição'}
            </p>

            {!podeVerNominal && (
              <div className="overflow-x-auto rounded-xl border border-[#525252]">
                <table className={TABELA}>
                  <thead><tr className={THEAD}>
                    <th className={TH}>Equipe</th><th className="px-3 py-2 text-right">Pessoas</th>
                    <th className="px-3 py-2 text-right">Total/mês</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#1f2937]">
                    {quadroPorEquipe(c.custos.quadro).map(([equipe, v]) => (
                      <tr key={equipe} className="hover:bg-white/[0.02]">
                        <td className={`${TD} text-[#f5f5f5]`}>{equipe}</td>
                        <td className={NUM}>{v.pessoas}</td>
                        <td className={`${NUM} text-[#f5f5f5] font-semibold`}>{fmtBRL(v.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#1f1f1f]">
                      <td className={`${TD} font-semibold text-[#a3a3a3]`} colSpan={2}>
                        TOTAL — {c.custos.quadro.length} pessoa(s) · só diretoria vê o quadro nominal
                      </td>
                      <td className={`${NUM} text-[#f5f5f5] font-bold`}>{fmtBRL(totalDaFolha(c.custos))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {podeVerNominal && <div className="overflow-x-auto rounded-xl border border-[#525252]">
              <table className={TABELA}>
                <thead><tr className={THEAD}>
                  <th className={TH}>Equipe</th><th className={TH}>Nome</th><th className={TH}>Cargo</th>
                  <th className="px-3 py-2 text-right">Salário</th><th className="px-3 py-2 text-right">Encargos</th>
                  <th className="px-3 py-2 text-right">Benefícios</th><th className="px-3 py-2 text-right">Total/mês</th>
                </tr></thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {c.custos.quadro.map((p, i) => (
                    <tr key={`${p.nome}-${i}`} className="hover:bg-white/[0.02]">
                      <td className={TD}>{p.equipe ?? '—'}</td>
                      <td className={`${TD} text-[#f5f5f5]`}>{p.nome}</td>
                      <td className={TD}>{p.cargo || '—'}</td>
                      <td className={NUM}>{fmtBRL(p.salario)}</td>
                      <td className={NUM}>{fmtBRL(p.encargos)}</td>
                      <td className={NUM}>{fmtBRL(p.beneficios)}</td>
                      <td className={`${NUM} text-[#f5f5f5] font-semibold`}>{fmtBRL(p.salario + p.encargos + p.beneficios)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#1f1f1f]">
                    <td className={`${TD} font-semibold text-[#a3a3a3]`} colSpan={6}>
                      TOTAL — {c.custos.quadro.length} pessoa(s)
                    </td>
                    <td className={`${NUM} text-[#f5f5f5] font-bold`}>{fmtBRL(totalDaFolha(c.custos))}</td>
                  </tr>
                </tbody>
              </table>
            </div>}

            <div className="overflow-x-auto rounded-xl border border-[#525252]">
              <table className={TABELA}>
                <thead><tr className={THEAD}>
                  <th className={TH}>Item</th><th className={TH}>Bloco</th>
                  <th className="px-3 py-2 text-right">Qnt</th><th className="px-3 py-2 text-right">Valor unit.</th>
                  <th className="px-3 py-2 text-right">Total/mês</th><th className={TH}>Quem paga</th>
                </tr></thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {c.custos.gerais.map((g, i) => (
                    <tr key={`${g.item}-${i}`} className="hover:bg-white/[0.02]">
                      <td className={`${TD} text-[#f5f5f5]`}>{g.item}</td>
                      <td className={TD}>{ROTULO_BLOCO[g.bloco] ?? g.bloco}</td>
                      <td className={NUM}>{g.quantidade}</td>
                      <td className={NUM}>{fmtBRL(g.valorUnitario)}</td>
                      <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(g.quantidade * g.valorUnitario)}</td>
                      <td className={TD}>{P.regime[g.bloco] === 'CONSORCIO' ? 'Consórcio' : 'Empresa'}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#1f1f1f]">
                    <td className={`${TD} font-semibold text-[#a3a3a3]`} colSpan={4}>TOTAL MENSAL — {c.nome}</td>
                    <td className={`${NUM} text-[#f5f5f5] font-bold`}>{fmtBRL(custoMensalDaCidade(c))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 3. FCP Semanal ───────────────────────────────────────────────────────────

function SubSemanal({
  premissas: P, realizado, travado, onLancar,
}: {
  premissas: PremissasFcp
  realizado: PlanoFcp['realizado']
  travado: boolean
  onLancar: (cidadeId: string, semana: number, valor: number | undefined) => void
}) {
  const semanas = useMemo(() => fluxoSemanal(P, realizado, 12), [P, realizado])

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <p className="text-[11px] text-[#6b6b6b]">
        Toda semana, lance a <strong className="text-[#a3a3a3]">produção realizada</strong>. Medição,
        recebimento, mensal e econômico atualizam sozinhos; semana sem lançamento usa o previsto.
        {travado && ' O plano está aprovado, mas o lançamento continua liberado — é o realizado.'}
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className={TABELA}>
          <thead><tr className={THEAD}>
            <th className={TH}>Semana</th><th className={TH}>Período</th>
            {P.cidades.map((c) => <th key={c.id} className="px-3 py-2 text-right">{c.nome} — realizado</th>)}
            <th className="px-3 py-2 text-right">Recebimento</th>
            <th className="px-3 py-2 text-right">Despesas</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2 text-right">Acumulado</th>
            <th className="px-3 py-2 text-right">% do plano</th>
          </tr></thead>
          <tbody className="divide-y divide-[#1f2937]">
            {semanas.map((s) => (
              <tr key={s.semana.numero} className="hover:bg-white/[0.02]">
                <td className={`${TD} text-[#f5f5f5] font-semibold`}>S{s.semana.numero}</td>
                <td className={`${TD} whitespace-nowrap`}>{fmtDataBR(s.semana.inicio)} a {fmtDataBR(s.semana.fim)}</td>
                {P.cidades.map((c) => {
                  const l = s.porCidade.find((x) => x.cidadeId === c.id)!
                  return (
                    <td key={c.id} className="px-3 py-1.5 text-right">
                      <input
                        type="number" step="0.01"
                        value={realizado[c.id]?.[s.semana.numero] ?? ''}
                        placeholder={un(l.producaoPrevista)}
                        onChange={(e) => {
                          const v = e.target.value.trim()
                          onLancar(c.id, s.semana.numero, v === '' ? undefined : Number(v))
                        }}
                        className="w-24 bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-right text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60 tabular-nums placeholder:text-[#525252]"
                      />
                    </td>
                  )
                })}
                <td className={`${NUM} ${s.recebimento > 0 ? 'text-emerald-300' : 'text-[#6b6b6b]'}`}>
                  {s.recebimento > 0 ? fmtBRL(s.recebimento) : '—'}
                </td>
                <td className={NUM}>{s.totalDespesas > 0 ? fmtBRL(s.totalDespesas) : '—'}</td>
                <td className={`${NUM} ${s.saldoPeriodo < 0 ? 'text-red-300' : 'text-[#f5f5f5]'}`}>{fmtBRL(s.saldoPeriodo)}</td>
                <td className={`${NUM} font-semibold ${s.saldoAcumulado < 0 ? 'text-red-300' : 'text-[#f5f5f5]'}`}>{fmtBRL(s.saldoAcumulado)}</td>
                <td className={NUM}>{s.aderencia !== undefined ? pct(s.aderencia) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#6b6b6b]">
        O “% do plano” é em reais, não em unidades — serviços de tickets diferentes não somam.
      </p>
    </div>
  )
}

// ─── 4. FCP Mensal ────────────────────────────────────────────────────────────

function SubMensal({ premissas: P, realizado }: { premissas: PremissasFcp; realizado: PlanoFcp['realizado'] }) {
  const meses = useMemo(() => fluxoMensal(P, realizado), [P, realizado])
  const cap = useMemo(() => capitalNecessario(P, meses), [P, meses])
  const sens = useMemo(() => sensibilidade(P), [P])

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className={TABELA}>
          <thead><tr className={THEAD}>
            <th className={TH}>Mês</th><th className="px-3 py-2 text-right">Dias</th>
            <th className="px-3 py-2 text-right">Medição</th>
            <th className="px-3 py-2 text-right">Recebimento</th>
            <th className="px-3 py-2 text-right">(–) Desconto</th>
            <th className="px-3 py-2 text-right">(–) Imposto</th>
            <th className="px-3 py-2 text-right">Entra</th>
            <th className="px-3 py-2 text-right">(–) Sai</th>
            <th className="px-3 py-2 text-right">Acum. antes</th>
            <th className="px-3 py-2 text-right">Acum. depois</th>
          </tr></thead>
          <tbody className="divide-y divide-[#1f2937]">
            {meses.map((m) => (
              <tr key={m.mes.mes} className={`hover:bg-white/[0.02] ${m.mes.diasDeObra === 0 ? 'bg-[#f97316]/[0.06]' : ''}`}>
                <td className={`${TD} text-[#f5f5f5] whitespace-nowrap`}>
                  {fmtDataBR(m.mes.mes).slice(3)}
                  {/* Sem esta legenda, uma linha com 0 dia e medição zerada ao lado de um
                      recebimento de seis dígitos parece defeito — e é o contrário: é o último
                      dinheiro do contrato, que antes não aparecia em lugar nenhum. */}
                  {m.mes.diasDeObra === 0 && (
                    <span className="ml-1.5 text-[10px] text-[#f97316]">obra encerrada · só recebimento</span>
                  )}
                </td>
                <td className={NUM}>{m.mes.diasDeObra}</td>
                <td className={NUM}>{fmtBRL(m.medicaoBruta)}</td>
                <td className={`${NUM} ${m.recebimento > 0 ? 'text-emerald-300' : 'text-[#6b6b6b]'}`}>{m.recebimento > 0 ? fmtBRL(m.recebimento) : '—'}</td>
                <td className={NUM}>{m.descontoConsorcio > 0 ? fmtBRL(m.descontoConsorcio) : '—'}</td>
                <td className={NUM}>{m.imposto > 0 ? fmtBRL(m.imposto) : '—'}</td>
                <td className={`${NUM} ${m.entraNoCaixa < 0 ? 'text-red-300' : ''}`}>{fmtBRL(m.entraNoCaixa)}</td>
                <td className={NUM}>{m.saiDoCaixa > 0 ? fmtBRL(m.saiDoCaixa) : '—'}</td>
                <td className={`${NUM} ${m.acumuladoAntesDoRecebimento < 0 ? 'text-red-300 font-semibold' : ''}`}>{fmtBRL(m.acumuladoAntesDoRecebimento)}</td>
                <td className={`${NUM} font-semibold ${m.acumuladoDepois < 0 ? 'text-red-300' : 'text-[#f5f5f5]'}`}>{fmtBRL(m.acumuladoDepois)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meses.some((m) => m.mes.diasDeObra === 0) && (
        <p className="text-[11px] leading-5 text-[#a3a3a3]">
          <b className="text-[#d4d4d4]">Por que há um mês depois do fim da obra.</b>{' '}
          A medição do último mês é paga {P.defasagemDias} dias depois de fechar, o que cai no mês
          seguinte. Esse mês não tem produção — só a entrada do dinheiro. Sem ele, o último
          recebimento do contrato ficaria de fora da projeção, e o caixa acumulado não fecharia com
          o resultado econômico.
        </p>
      )}

      <div className="rounded-xl border border-[#f97316]/30 bg-[#f97316]/10 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <p className="text-xs font-semibold text-[#f5f5f5]">Capital necessário</p>
          <OQueE titulo="Capital necessário" explicacao={EXPLICA_FCP.capital} />
        </div>
        {/* ⚠️ É o pior ponto ANTES do recebimento, não o pior saldo do mês: é o dinheiro que precisa
            estar no bolso no dia em que a folha vence e a medição ainda não caiu. */}
        <p className="text-[11px] text-[#a3a3a3]">
          Necessidade máxima <strong className="text-[#f5f5f5]">{fmtBRL(cap.necessidadeMaxima)}</strong>
          {' '}+ contingência de {pct(P.contingencia)} ({fmtBRL(cap.contingencia)}) ={' '}
          <strong className="text-[#f97316]">{fmtBRL(cap.capitalRecomendado)}</strong>
          {cap.mesDoPiorPonto && ` · o pior ponto é em ${fmtDataBR(cap.mesDoPiorPonto).slice(3)}`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-[#a3a3a3]">Sensibilidade — a mesma conta nos quatro cenários</p>
          <OQueE titulo="Sensibilidade" explicacao={EXPLICA_FCP.sensibilidade} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className={TABELA}>
            <thead><tr className={THEAD}>
              <th className={TH}>Cenário</th><th className="px-3 py-2 text-right">Margem</th>
              <th className="px-3 py-2 text-right">Necessidade máxima</th>
              <th className="px-3 py-2 text-right">Capital recomendado</th>
              <th className="px-3 py-2 text-right">Resultado no horizonte</th>
              <th className={TH} />
            </tr></thead>
            <tbody className="divide-y divide-[#1f2937]">
              {sens.map((s) => (
                <tr key={s.cenario} className={s.adotado ? 'bg-[#f97316]/10' : 'hover:bg-white/[0.02]'}>
                  <td className={`${TD} text-[#f5f5f5] font-semibold`}>{ROTULO_CENARIO[s.cenario]}</td>
                  <td className={NUM}>{pct(s.margem)}</td>
                  <td className={NUM}>{fmtBRL(s.capital.necessidadeMaxima)}</td>
                  <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(s.capital.capitalRecomendado)}</td>
                  <td className={`${NUM} ${s.resultadoFinal < 0 ? 'text-red-300 font-semibold' : 'text-emerald-300'}`}>{fmtBRL(s.resultadoFinal)}</td>
                  <td className={`${TD} text-[10px] text-[#f97316]`}>{s.adotado ? '◀ adotado' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── 5. Econômico ─────────────────────────────────────────────────────────────

function SubEconomico({ premissas: P, realizado }: { premissas: PremissasFcp; realizado: PlanoFcp['realizado'] }) {
  const linhas = useMemo(() => fluxoEconomico(P, realizado), [P, realizado])
  const final = linhas.length > 0 ? linhas[linhas.length - 1] : null

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* A distinção que a planilha do cliente ensina, e que a tela precisa manter viva. */}
      <p className="text-[11px] text-[#6b6b6b]">
        Aqui é <strong className="text-[#a3a3a3]">competência</strong>: a margem real do contrato,
        mês a mês, independente de quando o dinheiro entra. O FCP ao lado é caixa. Uma obra pode ter
        margem excelente e quebrar de caixa — por isso os dois vivem separados.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className={TABELA}>
          <thead><tr className={THEAD}>
            <th className={TH}>Mês</th><th className="px-3 py-2 text-right">Dias</th>
            <th className="px-3 py-2 text-right">Medição bruta</th>
            <th className="px-3 py-2 text-right">(–) Imposto</th>
            <th className="px-3 py-2 text-right">(=) Líquida</th>
            <th className="px-3 py-2 text-right">(–) Folha</th>
            <th className="px-3 py-2 text-right">(–) Engenheiro</th>
            <th className="px-3 py-2 text-right">(–) Estrutura</th>
            <th className="px-3 py-2 text-right">(–) Indiretos</th>
            <th className="px-3 py-2 text-right">(–) Mobilização</th>
            {P.provisionar13Ferias && <th className="px-3 py-2 text-right">(–) 13º/férias</th>}
            <th className="px-3 py-2 text-right">Resultado</th>
            <th className="px-3 py-2 text-right">Acumulado</th>
            <th className="px-3 py-2 text-right">Margem</th>
          </tr></thead>
          <tbody className="divide-y divide-[#1f2937]">
            {linhas.map((l) => (
              <tr key={l.mes.mes} className="hover:bg-white/[0.02]">
                <td className={`${TD} text-[#f5f5f5] whitespace-nowrap`}>{fmtDataBR(l.mes.mes).slice(3)}</td>
                <td className={NUM}>{l.mes.diasDeObra}</td>
                <td className={NUM}>{fmtBRL(l.medicaoBruta)}</td>
                <td className={NUM}>{fmtBRL(l.imposto)}</td>
                <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(l.medicaoLiquida)}</td>
                <td className={NUM}>{fmtBRL(l.folha)}</td>
                <td className={NUM}>{fmtBRL(l.engenheiro)}</td>
                <td className={NUM}>{fmtBRL(l.estrutura)}</td>
                <td className={NUM}>{fmtBRL(l.indiretos)}</td>
                <td className={NUM}>{l.mobilizacao > 0 ? fmtBRL(l.mobilizacao) : '—'}</td>
                {P.provisionar13Ferias && <td className={NUM}>{fmtBRL(l.provisao13Ferias)}</td>}
                <td className={`${NUM} font-semibold ${l.resultado < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{fmtBRL(l.resultado)}</td>
                <td className={`${NUM} ${l.resultadoAcumulado < 0 ? 'text-red-300' : 'text-[#f5f5f5]'}`}>{fmtBRL(l.resultadoAcumulado)}</td>
                <td className={NUM}>{pct(l.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linhas.length > 0 && linhas[0].resultado < 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle size={12} className="inline mr-1" />
          O 1º mês fecha negativo, e isso é esperado quando o consórcio desconta: o desconto supera a
          medição parcial. Não é prejuízo do contrato — é saldo devido, e compensa em seguida.
        </p>
      )}

      {final && (
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <p className="text-xs font-semibold text-[#f5f5f5]">Resultado no horizonte</p>
          <p className="text-[11px] text-[#a3a3a3] mt-1">
            <strong className={final.resultadoAcumulado < 0 ? 'text-red-300' : 'text-emerald-300'}>
              {fmtBRL(final.resultadoAcumulado)}
            </strong>
            {' '}sobre {fmtBRL(linhas.reduce((s, l) => s + l.medicaoBruta, 0))} de medição bruta.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 6. Viabilidade ───────────────────────────────────────────────────────────

function SubViabilidade({ premissas: P }: { premissas: PremissasFcp }) {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <p className="text-[11px] text-[#6b6b6b]">
        Quantos serviços por dia cada cidade precisa entregar para o cenário fechar.
        {' '}⚠️ O cenário <strong className="text-[#a3a3a3]">Mínima</strong> é o EMPATE — e ele já
        cobre o imposto de {pct(P.imposto)}. Uma conta sem o imposto daria um número bem menor, e a
        obra empataria só no papel.
      </p>

      {P.cidades.map((c) => (
        <div key={c.id} className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-[#a3a3a3]">
            {c.nome} — custo mensal {fmtBRL(custoMensalDaCidade(c))} · ticket {fmtBRL(ticketDaCidade(c))}
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#525252]">
            <table className={TABELA}>
              <thead><tr className={THEAD}>
                <th className={TH}>Cenário</th><th className="px-3 py-2 text-right">Margem</th>
                <th className="px-3 py-2 text-right">Receita líquida</th>
                <th className="px-3 py-2 text-right">Medição bruta</th>
                <th className="px-3 py-2 text-right">Serviços/mês</th>
                <th className="px-3 py-2 text-right">Serviços/semana</th>
                <th className="px-3 py-2 text-right">Serviços/dia</th>
                {c.mix && <th className="px-3 py-2 text-right">{c.mix.rotuloA}/dia</th>}
                {c.mix && <th className="px-3 py-2 text-right">{c.mix.rotuloB}/dia</th>}
                <th className={TH} />
              </tr></thead>
              <tbody className="divide-y divide-[#1f2937]">
                {viabilidadeDaCidade(P, c).map((l) => (
                  <tr key={l.cenario} className={l.adotado ? 'bg-[#f97316]/10' : 'hover:bg-white/[0.02]'}>
                    <td className={`${TD} text-[#f5f5f5] font-semibold`}>{ROTULO_CENARIO[l.cenario]}</td>
                    <td className={NUM}>{pct(l.margem)}</td>
                    <td className={NUM}>{fmtBRL(l.receitaLiquida)}</td>
                    <td className={NUM}>{fmtBRL(l.medicaoBruta)}</td>
                    <td className={NUM}>{un(l.servicosMes)}</td>
                    <td className={NUM}>{un(l.servicosSemana)}</td>
                    <td className={`${NUM} text-[#f5f5f5] font-semibold`}>{un(l.servicosDia)}</td>
                    {l.porServico?.map((s) => <td key={s.rotulo} className={NUM}>{un(s.porDia)}</td>)}
                    <td className={`${TD} text-[10px] text-[#f97316]`}>{l.adotado ? '◀ adotado' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-[#a3a3a3]">Global</p>
        {/* Não existe "serviço/dia global": somar serviços de tickets diferentes não diz nada. */}
        <p className="text-[10px] text-[#6b6b6b]">
          Sem serviços por dia aqui de propósito — somar serviços de cidades com tickets diferentes
          daria um número que não é nem um nem outro.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className={TABELA}>
            <thead><tr className={THEAD}>
              <th className={TH}>Cenário</th><th className="px-3 py-2 text-right">Margem</th>
              <th className="px-3 py-2 text-right">Receita líquida</th>
              <th className="px-3 py-2 text-right">Medição bruta</th><th className={TH} />
            </tr></thead>
            <tbody className="divide-y divide-[#1f2937]">
              {viabilidadeGlobal(P).map((l) => (
                <tr key={l.cenario} className={l.adotado ? 'bg-[#f97316]/10' : 'hover:bg-white/[0.02]'}>
                  <td className={`${TD} text-[#f5f5f5] font-semibold`}>{ROTULO_CENARIO[l.cenario]}</td>
                  <td className={NUM}>{pct(l.margem)}</td>
                  <td className={NUM}>{fmtBRL(l.receitaLiquida)}</td>
                  <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(l.medicaoBruta)}</td>
                  <td className={`${TD} text-[10px] text-[#f97316]`}>{l.adotado ? '◀ adotado' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── 7. Preços do contrato ────────────────────────────────────────────────────

function SubPrecos({ precos, confirmados, podeConfirmar, onConfirmar }: {
  precos: Record<string, PrecoDoContrato[]>
  confirmados: PrecosConfirmados
  podeConfirmar: boolean
  onConfirmar: (chave: string, valor: number, desfazer: boolean) => void
}) {
  const [busca, setBusca] = useState('')
  const [soConferir, setSoConferir] = useState(false)
  const cidades = Object.keys(precos)
  // As chaves são por posição na lista ORIGINAL — o filtro de busca não pode mudá-las.
  const chaves = useMemo(() => Object.fromEntries(cidades.map((c) => [c, chavesDosPrecos(c, precos[c])])), [precos, cidades])

  if (cidades.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[#6b6b6b]">
        A planilha importada não trouxe tabela de preços.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item ou descrição…"
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60 min-w-[240px]"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3]">
          <input type="checkbox" checked={soConferir} onChange={(e) => setSoConferir(e.target.checked)} className="accent-[#f97316]" />
          só os que precisam conferir
        </label>
      </div>

      {cidades.map((cidade) => {
        const lista = precos[cidade].map((p, i) => ({ p, chave: chaves[cidade][i] })).filter(({ p }) => {
          if (soConferir && !p.precisaConferir) return false
          if (!busca) return true
          const alvo = `${p.item ?? ''} ${p.descricao} ${p.numeroPreco ?? ''}`.toLowerCase()
          return alvo.includes(busca.toLowerCase())
        })
        const aConferir = precos[cidade].filter((p) => p.precisaConferir).length
        const confirmadosAqui = precos[cidade].filter((p, i) => p.precisaConferir && estaConfirmado(confirmados, chaves[cidade][i], p.valorUnitario)).length

        return (
          <div key={cidade} className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-[#a3a3a3]">
              {cidade} — {precos[cidade].length} itens
              {lista.length !== precos[cidade].length && ` (${lista.length} no filtro)`}
            </p>
            {aConferir > 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                <AlertTriangle size={12} className="inline mr-1" />
                <strong>{aConferir}</strong> {aConferir === 1 ? 'item foi transcrito' : 'itens foram transcritos'} de
                foto com dígito cortado · <strong>{confirmadosAqui}</strong> já confirmado(s).
                {' '}<b>O sistema não trava o uso deles</b> — confira contra o contrato e marque
                "Confirmei". A confirmação vale para o valor conferido: se a próxima planilha trouxer
                outro, ela caduca sozinha.
                {!podeConfirmar && ' Só a diretoria confirma.'}
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-[#525252] max-h-[520px]">
              <table className={TABELA}>
                <thead className="sticky top-0"><tr className={THEAD}>
                  {precos[cidade].some((p) => p.item) && <th className={TH}>Item</th>}
                  <th className={TH}>Descrição</th><th className={TH}>N. preço</th>
                  <th className={TH}>Un</th><th className="px-3 py-2 text-right">R$ unit.</th>
                  <th className={TH}>Obs</th>
                  {aConferir > 0 && <th className={TH}>Conferência</th>}
                </tr></thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {lista.map(({ p, chave }) => {
                    const confirmacao = estaConfirmado(confirmados, chave, p.valorUnitario)
                    const pendente = p.precisaConferir && !confirmacao
                    return (
                    // `bg-amber-500/5` sobre `#2c2c2c` é invisível — e eram 299 linhas para varrer.
                    // A borda à esquerda marca sem transformar a tabela em carnaval. Confirmado
                    // fica verde: a marca saiu porque alguém olhou, não porque a planilha mudou.
                    <tr
                      key={chave}
                      className={pendente
                        ? 'bg-amber-500/10 border-l-2 border-l-amber-400'
                        : confirmacao ? 'border-l-2 border-l-emerald-500/60 hover:bg-white/[0.02]' : 'hover:bg-white/[0.02]'}
                    >
                      {precos[cidade].some((x) => x.item) && <td className={TD}>{p.item ?? '—'}</td>}
                      <td className={`${TD} text-[#f5f5f5]`}>{p.descricao}</td>
                      <td className={TD}>{p.numeroPreco ?? '—'}</td>
                      <td className={TD}>{p.unidade ?? '—'}</td>
                      <td className={`${NUM} ${pendente ? 'text-amber-300' : 'text-[#f5f5f5]'}`}>
                        {pendente && <AlertTriangle size={10} className="inline mr-1 -mt-0.5" />}
                        {fmtBRL(p.valorUnitario)}
                      </td>
                      <td className={`${TD} text-[10px] ${pendente ? 'text-amber-300' : 'text-[#6b6b6b]'}`}>
                        {p.observacao ?? '—'}
                      </td>
                      {aConferir > 0 && (
                        <td className={`${TD} whitespace-nowrap`}>
                          {!p.precisaConferir ? null : confirmacao ? (
                            <span className="text-[10px] text-emerald-300">
                              <CheckCircle2 size={10} className="inline mr-1 -mt-0.5" />
                              {confirmacao.confirmadoPor} · {fmtDataBR(confirmacao.confirmadoEm.slice(0, 10))}
                              {podeConfirmar && (
                                <button type="button" onClick={() => onConfirmar(chave, p.valorUnitario, true)}
                                  className="ml-2 text-[#6b6b6b] hover:text-[#f5f5f5] hover:underline">desfazer</button>
                              )}
                            </span>
                          ) : (
                            <button
                              type="button" disabled={!podeConfirmar}
                              title={podeConfirmar ? 'Conferi este valor contra o contrato' : 'Só diretoria confirma'}
                              onClick={() => onConfirmar(chave, p.valorUnitario, false)}
                              className="rounded border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Confirmei
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Importação ───────────────────────────────────────────────────────────────

function ImportarFcpModal({
  obraId, planos, orgId, onGravar, onClose,
}: {
  obraId?: string
  planos: PlanoFcp[]
  orgId: string | null | undefined
  onGravar: (plano: PlanoFcp) => void
  onClose: () => void
}) {
  const perfilImporta = useAuth((s) => s.profile)
  const quemImporta = perfilImporta?.full_name ?? perfilImporta?.email ?? 'alguém'
  const [lido, setLido] = useState<{
    id: string
    nome: string
    premissas: PremissasFcp
    realizado: PlanoFcp['realizado']
    precos: Record<string, PrecoDoContrato[]>
    divergencias: Divergencia[]
    grade: ConferenciaDaGrade | null
    problemas: Array<{ aba: string; motivo: string }>
    plano: ConferenciaDoPlano
  } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEscolher(file: File) {
    setErro(null)
    // ⚠️ Mesmo limite do importador genérico, que este painel também nunca chamou.
    const ok = validateFileBeforeParse(file)
    if (!ok.ok) { setErro(ok.error); return }
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const abas: Record<string, Matriz> = {}
      for (const nome of wb.SheetNames) {
        abas[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null }) as Matriz
      }
      const r = lerPlanilhaFcp(abas)
      if (!r.premissas) { setErro(r.problemas[0]?.motivo ?? 'Não consegui ler esta planilha.'); return }
      // ⚠️ A identidade do plano vem de obra + nome do arquivo, não de um sorteio. É isto que faz
      // "jogar a planilha atualizada" ATUALIZAR o plano em vez de criar o segundo.
      const id = idDoPlano(orgId, obraId, file.name)
      const existente = planos.find((p) => p.id === id) ?? null
      setLido({
        id,
        nome: file.name.replace(/\.xlsx?$/i, ''),
        premissas: r.premissas, realizado: r.realizado, precos: r.precos,
        divergencias: r.divergencias, grade: r.grade, problemas: r.problemas,
        plano: conferirPlano({ premissas: r.premissas, nome: file.name }, existente),
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir este arquivo.')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-[#525252] bg-[#2d2d2d] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">Importar fluxo de caixa projetado</p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">
              O sistema lê as premissas, os custos e os preços — e <strong>recalcula</strong> o resto.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!lido ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileSpreadsheet size={40} className="text-[#525252]" />
              <AreaDeSoltar
                className="w-full max-w-md"
                aceita=".xlsx,.xls"
                ajuda="Aceita .xlsx e .xls"
                aoEscolher={(arquivos) => { const f = arquivos[0]; if (f) void aoEscolher(f) }}
              />
              <p className="text-[11px] text-[#6b6b6b] max-w-md text-center">
                Precisa ter a aba <strong>PREMISSAS</strong> e uma aba <strong>CUSTOS &lt;cidade&gt;</strong>
                {' '}por cidade. As abas calculadas não são importadas — são conferidas.
              </p>
              {erro && <p className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-[11px] text-red-300">{erro}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Indicador rotulo="Cidades" valor={String(lido.premissas.cidades.length)} />
                <Indicador rotulo="Custo mensal" valor={fmtBRL(custoMensalGlobal(lido.premissas))} />
                <Indicador rotulo="Cenário" valor={ROTULO_CENARIO[lido.premissas.cenario]} />
                <Indicador
                  rotulo="Capital recomendado"
                  valor={fmtBRL(capitalNecessario(lido.premissas, fluxoMensal(lido.premissas, lido.realizado)).capitalRecomendado)}
                />
              </div>

              {/* ⚠️ O QUE VEIO NA PLANILHA, em contagem.
                  A tela mostrava quatro números agregados para um arquivo de 11 abas — e o dono do
                  produto perguntou, com razão, se não estava faltando tudo. Não estava: o leitor
                  extrai o quadro nominal das duas cidades, os custos gerais e as tabelas de preço.
                  Só não dizia. Estes números não são detalhe: 511 preços podem mudar inteiros sem
                  gerar uma linha de "premissa alterada", porque premissa é agregada.

                  ⚠️ O quadro aparece em CONTAGEM, nunca com nome. Ver a seção de risco aceito do
                  SECURITY.md — o arquivo tem nome e salário individual de gente real. */}
              {(() => {
                const pessoas = lido.premissas.cidades.reduce((n, c) => n + c.custos.quadro.length, 0)
                const gerais = lido.premissas.cidades.reduce((n, c) => n + c.custos.gerais.length, 0)
                const todosPrecos = Object.values(lido.precos).flat()
                const aConferir = todosPrecos.filter((x) => x.precisaConferir).length
                return (
                  <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#f5f5f5]">O que veio na planilha</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Contagem rotulo="Pessoas na folha" valor={pessoas} detalhe={lido.premissas.cidades.map((c) => `${c.nome}: ${c.custos.quadro.length}`).join(' · ')} />
                      <Contagem rotulo="Custos gerais" valor={gerais} />
                      <Contagem rotulo="Preços do contrato" valor={todosPrecos.length} detalhe={Object.entries(lido.precos).map(([k, v]) => `${k}: ${v.length}`).join(' · ')} />
                      <Contagem
                        rotulo="Preços a conferir"
                        valor={aConferir}
                        alerta={aConferir > 0}
                        // ⚠️ Aqui dizia "ficam bloqueados para medição". Era falso: `plano.precos` é
                        // lido só pela aba de consulta — nenhum módulo de medição, orçamento ou
                        // faturamento o enxerga, e não há o que bloquear. Prometer um mecanismo que
                        // não existe é pior que não prometer nada: quem lê para de conferir.
                        detalhe={aConferir > 0 ? 'transcritos de foto — confira antes de usar' : 'nenhum'}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* ⚠️ PLANO NOVO: aqui não existe "antes", então a mesma tabela vira "o que eu li".
                  Antes deste bloco, a primeira importação mostrava quatro números e um botão —
                  para uma planilha de 11 abas. A pessoa tinha de confiar sem conferir. */}
              {lido.plano.ehNovo && (
                <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
                  <p className="mb-1 text-xs font-semibold text-[#f5f5f5]">O que eu li da planilha</p>
                  <p className="mb-2 text-[11px] text-[#6b6b6b]">
                    Confira antes de criar. Estes são os valores que vão virar o plano — o resto das
                    abas é <strong>calculado</strong> a partir deles, não importado.
                  </p>
                  <div className="max-h-64 overflow-x-auto rounded-lg border border-[#525252]">
                    <table className={TABELA}>
                      <thead className="sticky top-0"><tr className={THEAD}>
                        <th className={TH}>Premissa</th><th className={TH}>Valor lido</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[#1f2937]">
                        {premissasComoTexto(lido.premissas).map((m) => (
                          <tr key={m.rotulo} className="hover:bg-white/[0.02]">
                            <td className={`${TD} text-[#a3a3a3]`}>{m.rotulo}</td>
                            <td className={`${TD} text-[#f5f5f5]`}>{m.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ⚠️ O que a reimportação faz com o plano que já existe. É a pergunta que importa
                  quando alguém joga a planilha atualizada: vai criar outro, ou atualizar este? */}
              {!lido.plano.ehNovo && (
                <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
                  <p className="text-xs font-semibold text-[#f5f5f5] mb-1">
                    Este arquivo já tem um plano no sistema — ele será <strong>atualizado</strong>, não duplicado.
                  </p>

                  {lido.plano.travadoPorAprovacao ? (
                    <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                      <AlertTriangle size={12} className="inline mr-1" />
                      O plano está <strong>aprovado</strong>. Reabra antes de importar por cima — o
                      número que a diretoria aprovou não muda em silêncio.
                    </p>
                  ) : lido.plano.mudancas.length === 0 ? (
                    <p className="mt-1 text-[11px] text-emerald-300">
                      <CheckCircle2 size={12} className="inline mr-1" />
                      Nenhuma premissa mudou. Importar não altera nada.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-[#6b6b6b] mb-2">
                        {lido.plano.mudancas.length} premissa(s) mudaram.
                        {lido.plano.capitalAntes !== null && lido.plano.capitalAntes !== lido.plano.capitalDepois && (
                          <> O capital recomendado vai de <strong className="text-[#a3a3a3]">{fmtBRL(lido.plano.capitalAntes)}</strong>
                          {' '}para{' '}
                          <strong className={lido.plano.capitalDepois > lido.plano.capitalAntes ? 'text-red-300' : 'text-emerald-300'}>
                            {fmtBRL(lido.plano.capitalDepois)}
                          </strong>.</>
                        )}
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-[#525252] max-h-64">
                        <table className={TABELA}>
                          <thead className="sticky top-0"><tr className={THEAD}>
                            <th className={TH}>Premissa</th><th className={TH}>Antes</th><th className={TH}>Depois</th>
                          </tr></thead>
                          <tbody className="divide-y divide-[#1f2937]">
                            {lido.plano.mudancas.map((m) => (
                              <tr key={m.rotulo} className="hover:bg-white/[0.02]">
                                <td className={`${TD} text-[#a3a3a3]`}>{m.rotulo}</td>
                                <td className={`${TD} text-[#6b6b6b] line-through`}>{m.antes}</td>
                                <td className={`${TD} text-[#f5f5f5]`}>{m.depois}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {lido.plano.lancamentosPreservados > 0 && (
                    <p className="mt-2 text-[11px] text-[#6b6b6b]">
                      {/* A produção lançada é trabalho que a equipe registrou semana a semana e não
                          existe em lugar nenhum além do sistema. A planilha traz premissas. */}
                      <strong className="text-[#a3a3a3]">{lido.plano.lancamentosPreservados} lançamento(s)</strong>
                      {' '}de produção realizada serão <strong>preservados</strong> — a planilha traz
                      premissas, não apaga o que a equipe lançou.
                    </p>
                  )}
                </div>
              )}

              {lido.problemas.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  <p className="font-semibold mb-1"><AlertTriangle size={12} className="inline mr-1" />O que não consegui ler</p>
                  <ul className="pl-4 space-y-0.5">
                    {lido.problemas.map((p, i) => <li key={i}>{p.aba}: {p.motivo}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-[#a3a3a3] mb-1.5">
                  Conferência — o que o sistema calcula × o que está na planilha
                </p>
                {/* ⚠️ Antes aqui havia 3 números para uma planilha de 11 abas, e a causa era colada
                    igual nos três. Agora são 249 conferências, cada divergência com causa provada
                    ou declarada como inexplicada. A lista de valor único continua embaixo: ela
                    responde outra pergunta — "os totais em destaque da planilha batem?". */}
                {lido.grade
                  ? <ConferenciaFcp grade={lido.grade} />
                  : (
                    <p className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-[11px] text-[#a3a3a3]">
                      Sem premissas suficientes para conferir as contas.
                    </p>
                  )}

                {lido.divergencias.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-[#f97316] hover:underline">
                      Ver os totais em destaque da planilha ({lido.divergencias.length} não fecham)
                    </summary>
                    <div className="mt-2 overflow-x-auto rounded-xl border border-[#525252]">
                      <table className={TABELA}>
                        <thead><tr className={THEAD}>
                          <th className={TH}>Aba</th><th className={TH}>O quê</th>
                          <th className="px-3 py-2 text-right">Sistema</th>
                          <th className="px-3 py-2 text-right">Planilha</th>
                          <th className="px-3 py-2 text-right">Diferença</th>
                        </tr></thead>
                        <tbody className="divide-y divide-[#1f2937]">
                          {lido.divergencias.map((d, i) => (
                            <Fragment key={i}>
                              <tr className="hover:bg-white/[0.02]">
                                <td className={TD}>{d.aba}</td>
                                <td className={`${TD} text-[#f5f5f5]`}>{d.oQue}</td>
                                <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(d.calculado)}</td>
                                <td className={NUM}>{fmtBRL(d.naPlanilha)}</td>
                                <td className={`${NUM} ${Math.abs(d.proporcao) > 0.05 ? 'text-amber-300 font-semibold' : ''}`}>
                                  {fmtBRL(d.diferenca)} ({pct(d.proporcao)})
                                </td>
                              </tr>
                              {d.causaProvavel && (
                                <tr>
                                  <td colSpan={5} className="px-3 pb-2 text-[10px] leading-relaxed text-[#a3a3a3]">
                                    <strong className="text-[#6b6b6b]">Por quê:</strong> {d.causaProvavel}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        {lido && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-[#525252] shrink-0">
            <button type="button" onClick={() => setLido(null)} className={BTN_S}>Escolher outro arquivo</button>
            <button
              type="button"
              disabled={lido.plano.travadoPorAprovacao}
              title={lido.plano.travadoPorAprovacao ? 'Reabra o plano aprovado antes de importar por cima' : undefined}
              onClick={() => {
                onGravar(planoParaGravar(
                  { nome: lido.nome, premissas: lido.premissas, precos: lido.precos, realizadoDaPlanilha: lido.realizado },
                  lido.plano.existente,
                  lido.id,
                  obraId,
                ))
                void registrarImportacao('fcp', { por: quemImporta, arquivo: lido.nome })
                onClose()
              }}
              className={`${BTN_P} ml-auto`}
            >
              {lido.plano.ehNovo ? 'Criar plano' : 'Atualizar o plano'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Peças ────────────────────────────────────────────────────────────────────

function Contagem({ rotulo, valor, detalhe, alerta = false }: {
  rotulo: string; valor: number; detalhe?: string; alerta?: boolean
}) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2">
      <p className="text-[10px] text-[#6b6b6b]">{rotulo}</p>
      <p className={`text-base font-semibold ${alerta && valor > 0 ? 'text-amber-300' : 'text-[#f5f5f5]'}`}>
        {valor.toLocaleString('pt-BR')}
      </p>
      {detalhe && <p className="mt-0.5 text-[10px] leading-tight text-[#6b6b6b]">{detalhe}</p>}
    </div>
  )
}

function Indicador({ rotulo, valor, nota, icone, variacao }: {
  rotulo: string; valor: string; nota?: string; icone?: React.ReactNode; variacao?: 'boa' | 'ruim'
}) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#6b6b6b]">{icone}{rotulo}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${variacao === 'ruim' ? 'text-red-300' : variacao === 'boa' ? 'text-emerald-300' : 'text-[#f5f5f5]'}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-[10px] text-[#6b6b6b]">{nota}</p>}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <p className="text-xs font-semibold text-[#a3a3a3] mb-3">{titulo}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  )
}

function Item({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={destaque ? 'rounded-lg border border-[#f97316]/30 bg-[#f97316]/10 p-2 -m-2' : ''}>
      <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">{rotulo}</p>
      <p className="text-sm text-[#f5f5f5] tabular-nums">{valor}</p>
      {nota && <p className="text-[10px] text-[#6b6b6b] mt-0.5">{nota}</p>}
    </div>
  )
}
