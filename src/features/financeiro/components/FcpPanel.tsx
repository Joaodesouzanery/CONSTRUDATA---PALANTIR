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
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  AlertTriangle, CheckCircle2, FileSpreadsheet, Lock, TrendingUp, Upload, Wallet, X,
} from 'lucide-react'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { useFcpStore, type PlanoFcp, type StatusDoPlano } from '@/store/fcpStore'
import { useAuth } from '@/lib/auth'
import { useActiveObraStore } from '@/store/activeObraStore'
import { Autoria } from '@/components/shared/Autoria'
import { fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { fmtDataBR } from '@/lib/utils'
import {
  capitalNecessario, custoMensalDaCidade, custoMensalGlobal, custosPorRegime, fluxoEconomico,
  fluxoMensal, fluxoSemanal, sensibilidade, ticketDaCidade, totalDaFolha,
  viabilidadeDaCidade, viabilidadeGlobal,
} from '../utils/fcp/motor'
import { lerPlanilhaFcp, type Divergencia, type PrecoDoContrato } from '../utils/fcp/importarFcp'
import { ROTULO_CENARIO, type Cenario, type PremissasFcp } from '../utils/fcp/tipos'
import type { Matriz } from '../utils/controleDeCaixaPlanilha'

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
  const { planos, addPlano, updatePlano, lancarProducao } = useFcpStore((s) => ({
    planos: s.planos, addPlano: s.addPlano, updatePlano: s.updatePlano, lancarProducao: s.lancarProducao,
  }))
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

      <ResumoDoPlano premissas={P} realizado={realizado} />

      <SubTabHost
        key={plano!.id}
        tabs={[
          { key: 'premissas',   label: 'Premissas',   render: () => <SubPremissas premissas={P} travado={travado} /> },
          { key: 'custos',      label: 'Custos',      render: () => <SubCustos premissas={P} /> },
          { key: 'semanal',     label: 'FCP Semanal', render: () => (
            <SubSemanal
              premissas={P} realizado={realizado} travado={travado}
              onLancar={(cidade, semana, valor) => lancarProducao(plano!.id, cidade, semana, valor)}
            />
          ) },
          { key: 'mensal',      label: 'FCP Mensal',  render: () => <SubMensal premissas={P} realizado={realizado} /> },
          { key: 'economico',   label: 'Econômico',   render: () => <SubEconomico premissas={P} realizado={realizado} /> },
          { key: 'viabilidade', label: 'Viabilidade', render: () => <SubViabilidade premissas={P} /> },
          { key: 'precos',      label: 'Preços do Contrato', render: () => <SubPrecos precos={plano!.precos ?? {}} /> },
        ]}
      />

      <Autoria tabela="fcp_planos" registroId={plano!.id} className="px-1" />

      {importando && (
        <ImportarFcpModal
          obraId={activeObraId ?? undefined}
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

function SubPremissas({ premissas: P, travado }: { premissas: PremissasFcp; travado: boolean }) {
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
    </div>
  )
}

const ROTULO_BLOCO: Record<string, string> = {
  folha: 'Folha das equipes', engenheiro: 'Engenheiro', estrutura: 'Estrutura e locações',
  indiretos: 'Custos indiretos', mobilizacao: 'Mobilização',
}

// ─── 2. Custos ────────────────────────────────────────────────────────────────

function SubCustos({ premissas: P }: { premissas: PremissasFcp }) {
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

            <div className="overflow-x-auto rounded-xl border border-[#525252]">
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
            </div>

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
              <tr key={m.mes.mes} className="hover:bg-white/[0.02]">
                <td className={`${TD} text-[#f5f5f5] whitespace-nowrap`}>{fmtDataBR(m.mes.mes).slice(3)}</td>
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

      <div className="rounded-xl border border-[#f97316]/30 bg-[#f97316]/10 p-4">
        <p className="text-xs font-semibold text-[#f5f5f5] mb-1">Capital necessário</p>
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
        <p className="text-xs font-semibold text-[#a3a3a3]">Sensibilidade — a mesma conta nos quatro cenários</p>
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

function SubPrecos({ precos }: { precos: Record<string, PrecoDoContrato[]> }) {
  const [busca, setBusca] = useState('')
  const [soConferir, setSoConferir] = useState(false)
  const cidades = Object.keys(precos)

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
        const lista = precos[cidade].filter((p) => {
          if (soConferir && !p.precisaConferir) return false
          if (!busca) return true
          const alvo = `${p.item ?? ''} ${p.descricao} ${p.numeroPreco ?? ''}`.toLowerCase()
          return alvo.includes(busca.toLowerCase())
        })
        const aConferir = precos[cidade].filter((p) => p.precisaConferir).length

        return (
          <div key={cidade} className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-[#a3a3a3]">
              {cidade} — {precos[cidade].length} itens
              {lista.length !== precos[cidade].length && ` (${lista.length} no filtro)`}
            </p>
            {aConferir > 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                <AlertTriangle size={12} className="inline mr-1" />
                <strong>{aConferir}</strong> itens foram transcritos de foto com dígito cortado e
                precisam ser conferidos contra o contrato antes de virar preço de medição.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-[#525252] max-h-[520px]">
              <table className={TABELA}>
                <thead className="sticky top-0"><tr className={THEAD}>
                  {precos[cidade].some((p) => p.item) && <th className={TH}>Item</th>}
                  <th className={TH}>Descrição</th><th className={TH}>N. preço</th>
                  <th className={TH}>Un</th><th className="px-3 py-2 text-right">R$ unit.</th>
                  <th className={TH}>Obs</th>
                </tr></thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {lista.map((p, i) => (
                    <tr key={`${p.numeroPreco ?? p.descricao}-${i}`} className={p.precisaConferir ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'}>
                      {precos[cidade].some((x) => x.item) && <td className={TD}>{p.item ?? '—'}</td>}
                      <td className={`${TD} text-[#f5f5f5]`}>{p.descricao}</td>
                      <td className={TD}>{p.numeroPreco ?? '—'}</td>
                      <td className={TD}>{p.unidade ?? '—'}</td>
                      <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(p.valorUnitario)}</td>
                      <td className={`${TD} text-[10px] ${p.precisaConferir ? 'text-amber-300' : 'text-[#6b6b6b]'}`}>
                        {p.observacao ?? '—'}
                      </td>
                    </tr>
                  ))}
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
  obraId, onGravar, onClose,
}: {
  obraId?: string
  onGravar: (plano: PlanoFcp) => void
  onClose: () => void
}) {
  const [lido, setLido] = useState<{
    nome: string
    premissas: PremissasFcp
    realizado: PlanoFcp['realizado']
    precos: Record<string, PrecoDoContrato[]>
    divergencias: Divergencia[]
    problemas: Array<{ aba: string; motivo: string }>
  } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEscolher(file: File) {
    setErro(null)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const abas: Record<string, Matriz> = {}
      for (const nome of wb.SheetNames) {
        abas[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null }) as Matriz
      }
      const r = lerPlanilhaFcp(abas)
      if (!r.premissas) { setErro(r.problemas[0]?.motivo ?? 'Não consegui ler esta planilha.'); return }
      setLido({
        nome: file.name.replace(/\.xlsx?$/i, ''),
        premissas: r.premissas, realizado: r.realizado, precos: r.precos,
        divergencias: r.divergencias, problemas: r.problemas,
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
              <label className={`${BTN_P} inline-flex cursor-pointer items-center gap-1.5`}>
                <Upload size={13} /> Escolher arquivo
                <input type="file" accept=".xlsx,.xls" className="hidden"
                       onChange={(e) => { const f = e.target.files?.[0]; if (f) void aoEscolher(f) }} />
              </label>
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
                {lido.divergencias.length === 0 ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                    <CheckCircle2 size={12} className="inline mr-1" />
                    Tudo bate. As contas da planilha e as do sistema chegam no mesmo número.
                  </p>
                ) : (
                  <>
                    {/* ⚠️ Divergência não é erro — é pergunta. Pode ser fórmula quebrada, célula
                        digitada por cima, ou premissa que mudou e não propagou. */}
                    <p className="text-[10px] text-[#6b6b6b] mb-1.5">
                      Divergência não quer dizer erro: pode ser fórmula quebrada, célula digitada
                      por cima, ou premissa que mudou e não propagou. O sistema mostra os dois
                      números; quem decide é você.
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-[#525252]">
                      <table className={TABELA}>
                        <thead><tr className={THEAD}>
                          <th className={TH}>Aba</th><th className={TH}>O quê</th>
                          <th className="px-3 py-2 text-right">Sistema</th>
                          <th className="px-3 py-2 text-right">Planilha</th>
                          <th className="px-3 py-2 text-right">Diferença</th>
                        </tr></thead>
                        <tbody className="divide-y divide-[#1f2937]">
                          {lido.divergencias.map((d, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              <td className={TD}>{d.aba}</td>
                              <td className={`${TD} text-[#f5f5f5]`}>{d.oQue}</td>
                              <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(d.calculado)}</td>
                              <td className={NUM}>{fmtBRL(d.naPlanilha)}</td>
                              <td className={`${NUM} ${Math.abs(d.proporcao) > 0.05 ? 'text-amber-300 font-semibold' : ''}`}>
                                {fmtBRL(d.diferenca)} ({pct(d.proporcao)})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
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
              onClick={() => {
                onGravar({
                  id: crypto.randomUUID(),
                  nome: lido.nome,
                  obraId,
                  status: 'rascunho',
                  premissas: lido.premissas,
                  realizado: lido.realizado,
                  precos: lido.precos,
                  criadoEm: new Date().toISOString(),
                })
                onClose()
              }}
              className={`${BTN_P} ml-auto`}
            >
              Criar plano
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Peças ────────────────────────────────────────────────────────────────────

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
