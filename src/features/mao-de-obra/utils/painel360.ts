/**
 * Os indicadores do Dashboard de Mão de Obra — a visão 360 que ele não tinha.
 *
 * ─── O QUE ESTAVA FALTANDO, MEDIDO ────────────────────────────────────────────
 * Das onze abas do módulo, **sete** tinham algum eco no Dashboard. Os buracos:
 *
 *  · **Ponto Eletrônico: nada.** Nem espelho, nem banco de horas, nem pendência, nem batida fora
 *    da cerca. A aba mais nova e a mais invisível.
 *  · **Horas Extras: representada por engano.** O cartão "HE esta semana" somava
 *    `shifts.type === 'overtime'`; a aba trabalha com a coleção `horasExtras`, que o Dashboard
 *    nunca leu. HE lançada, HE paga e o valor em reais não apareciam em lugar nenhum.
 *  · **RH Financeiro:** o teto de custo mensal não tinha um pixel.
 *
 * E três números **errados**:
 *  · "Certificações OK" marcava **100% fixo, sempre** — `getCertExpiringSoon(workers, 0)` com corte
 *    no próprio instante devolve lista vazia, por construção;
 *  · a barra "Planejado" do gráfico de HH era `maxActual * 1.15 // mock`;
 *  · o "% presença" era `(total − faltas da semana) / total`, misturando pessoas com pessoas-dia.
 *
 * ─── A REGRA QUE ESTE ARQUIVO IMPÕE ───────────────────────────────────────────
 * ⚠️ **Indicador sem base devolve `'—'` e `tom: 'sem-dado'`, NUNCA 0 ou 100%.** É a regra que o
 * `EvmHeader` documenta: `0` comunica "péssimo" e `100%` comunica "está tudo certo" — os dois são
 * afirmações, e o sistema não pode afirmar o que não sabe. E todo `'—'` traz `oQueFalta`, senão o
 * cartão cinza só ensina a pessoa a ignorá-lo.
 *
 * Puro: sem React, sem store, sem `new Date()` implícito. É o que torna o painel testável — hoje
 * não existe nenhum teste de componente para o Dashboard.
 */
import type { Explicacao } from '@/components/shared/explicacao'
import type {
  CLTSettings, Shift, TimecardEntry, Worker, WorkerAbsence, WorkerAssessment,
  HoraExtra, WorkPost,
} from '@/types'
import type { Jornada } from '@/features/ponto/jornada'
import type { SolicitacaoDePonto } from '@/features/ponto/solicitacao'
import { frequenciaNoPeriodo, naFolhaNoIntervalo } from './frequencia'
import { postosDescobertos } from './coberturaDePostos'
import { saldoDoPeriodo, creditosAVencer, MESES_DE_COMPENSACAO_PADRAO } from './bancoDeHoras'
import type { WorkWeekMode } from '@/types'

/** Mesma escala do `PainelIndicadores`: `sem-dado` é cinza e nunca verde. */
export type TomDoIndicador = 'ok' | 'atencao' | 'grave' | 'sem-dado'

export interface IndicadorDeMaoDeObra {
  id: string
  titulo: string
  /** Já formatado. `'—'` quando não há base — e aí `explicacao.oQueFalta` é obrigatório. */
  valor: string
  /** A linha de apoio: o denominador, a comparação, o detalhe. */
  detalhe?: string
  tom: TomDoIndicador
  explicacao: Explicacao
  /** A aba de Mão de Obra que responde por este número, para o cartão levar até lá. */
  destino?: string
}

// ─── Certificações ────────────────────────────────────────────────────────────

export interface CertificacaoVencida {
  workerId: string
  nome: string
  tipo: string
  venceuEm: string
  diasVencida: number
}

/**
 * As certificações que JÁ venceram.
 *
 * ⚠️ Esta função existe porque `getCertExpiringSoon` **só olha para frente**
 * (`expiry >= now && expiry <= cutoff`): chamada com `days = 0`, como o Dashboard fazia, o corte é
 * o próprio instante e a lista volta **sempre vazia**. O cartão "Certificações OK" marcava 100%
 * fixo desde sempre — a pior leitura possível, porque afirma que está tudo em dia.
 */
export function certificacoesVencidas(workers: readonly Worker[], hoje: string): CertificacaoVencida[] {
  const out: CertificacaoVencida[] = []
  const ref = Date.parse(`${hoje}T00:00:00`)
  for (const w of workers) {
    for (const c of w.certifications ?? []) {
      const venc = Date.parse(`${c.expiryDate}T00:00:00`)
      if (!Number.isFinite(venc) || venc >= ref) continue
      out.push({
        workerId: w.id, nome: w.name, tipo: c.type, venceuEm: c.expiryDate,
        diasVencida: Math.round((ref - venc) / 86_400_000),
      })
    }
  }
  return out.sort((a, b) => b.diasVencida - a.diasVencida)
}

// ─── A montagem ───────────────────────────────────────────────────────────────

export interface EntradaDoPainel {
  workers: Worker[]
  absences: WorkerAbsence[]
  shifts: Shift[]
  timecards: TimecardEntry[]
  assessments: WorkerAssessment[]
  horasExtras: HoraExtra[]
  workPosts: WorkPost[]
  jornadas: Jornada[]
  /**
   * As jornadas dos últimos doze meses — só para o crédito a vencer.
   *
   * ⚠️ Separado de `jornadas` de propósito: o vencimento do banco de horas é uma conta FIFO sobre
   * competências mensais (art. 59 §5º), e calculá-la com o recorte da tela daria sempre zero em
   * qualquer período menor que o prazo. É o tipo de indicador que, calculado errado, tranquiliza.
   */
  jornadasDoAno: Jornada[]
  solicitacoes: SolicitacaoDePonto[]
  cltSettings: CLTSettings
  feriados: Set<string>
  jornadaSemanal: WorkWeekMode
  de: string
  ate: string
  hoje: string
}

const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')}%`)
const horas = (min: number) => `${min < 0 ? '−' : ''}${Math.floor(Math.abs(min) / 60)}h${String(Math.abs(min) % 60).padStart(2, '0')}`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Todos os indicadores do painel, na ordem em que a tela os mostra.
 *
 * ⚠️ A ordem é da DECISÃO para a análise: primeiro o que precisa de alguém hoje (pedidos, jornadas
 * sem saída, crédito vencendo, certificação vencida), depois a leitura do período.
 */
export function montarIndicadoresDeMaoDeObra(e: EntradaDoPainel): IndicadorDeMaoDeObra[] {
  const doPeriodo = naFolhaNoIntervalo(e.workers, e.de, e.ate)
  const comPonto = e.workers.filter((w) => w.authUserId)

  // ── Ponto: o bloco que não existia ─────────────────────────────────────────
  const pedidos = e.solicitacoes.filter((s) => s.situacao === 'pendente')
  const semSaida = e.jornadas.filter((j) => j.pendencias.includes('sem-saida'))
  const aConferir = e.jornadas.filter((j) => j.pendencias.includes('batida-a-conferir'))

  const saldos = comPonto.map((w) => saldoDoPeriodo(
    w, e.jornadas.filter((j) => j.workerId === w.id), e.de, e.ate, e.cltSettings, e.feriados,
  ))
  const comBanco = saldos.filter((s) => !s.semBanco)
  const saldoTotal = comBanco.reduce((s, x) => s + x.saldoMin, 0)

  // O crédito a vencer, por pessoa, sobre as competências mensais do último ano.
  const mesesDoAno = [...new Set(e.jornadasDoAno.map((j) => j.data.slice(0, 7)))].sort()
  const vencendo = comPonto.flatMap((w) => {
    const dele = e.jornadasDoAno.filter((j) => j.workerId === w.id)
    if (dele.length === 0) return []
    const porMes = mesesDoAno.map((comp) => {
      const [ano, m] = comp.split('-').map(Number)
      const ate = `${comp}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`
      const sp = saldoDoPeriodo(w, dele, `${comp}-01`, ate, e.cltSettings, e.feriados)
      return { competencia: comp, saldoMin: sp.saldoMin }
    })
    return creditosAVencer(porMes, e.hoje, e.cltSettings.bancoHorasMeses ?? MESES_DE_COMPENSACAO_PADRAO)
      .map((c) => ({ ...c, workerId: w.id }))
  })
  const minutosAVencer = vencendo.reduce((s, c) => s + c.minutos, 0)

  // ── Frequência: a conta boa, no lugar da caseira ───────────────────────────
  const freq = frequenciaNoPeriodo({
    workers: e.workers, absences: e.absences, shifts: e.shifts, timecards: e.timecards,
    de: e.de, ate: e.ate, feriados: e.feriados, jornada: e.jornadaSemanal,
  })

  // ── Horas extras: a coleção de verdade ─────────────────────────────────────
  const heDoPeriodo = e.horasExtras.filter((h) => h.data >= e.de && h.data <= e.ate)
  const hePagas = heDoPeriodo.filter((h) => h.pago)
  const valorAPagar = heDoPeriodo.filter((h) => !h.pago).reduce((s, h) => s + (h.valor ?? 0), 0)

  // ── Segurança ──────────────────────────────────────────────────────────────
  const vencidas = certificacoesVencidas(e.workers, e.hoje)
  const temCertificacao = e.workers.some((w) => (w.certifications ?? []).length > 0)

  // ── Postos ─────────────────────────────────────────────────────────────────
  // ⚠️ Devolve um NÚMERO, não uma lista — foi o que o Dashboard antigo já consumia.
  const descobertos = postosDescobertos(e.workPosts, e.hoje, e.shifts, e.workers)

  // ── Avaliações ─────────────────────────────────────────────────────────────
  const notas = e.assessments
    .filter((a) => a.periodStart >= e.de && a.periodStart <= e.ate && Number.isFinite(a.notaFinal))
    .map((a) => a.notaFinal)
  const media = notas.length > 0 ? notas.reduce((s, n) => s + n, 0) / notas.length : null

  return [
    {
      id: 'pedidos-de-ponto',
      titulo: 'Pedidos de correção de ponto',
      valor: String(pedidos.length),
      detalhe: pedidos.length > 0 ? 'alguém está esperando resposta' : 'nenhum em aberto',
      tom: pedidos.length > 0 ? 'atencao' : 'ok',
      destino: 'ponto',
      explicacao: {
        oQueE: 'Correções de marcação que o funcionário pediu pelo aplicativo e ainda não foram decididas.',
        deOndeVem: 'Do botão "Pedir correção" na tela de bater ponto. A decisão é em Ponto Eletrônico › Conferência.',
      },
    },
    {
      id: 'jornadas-sem-saida',
      titulo: 'Jornadas sem saída',
      valor: String(semSaida.length),
      detalhe: 'não entram na folha nem no banco de horas',
      tom: semSaida.length > 0 ? 'grave' : 'ok',
      destino: 'ponto',
      explicacao: {
        oQueE: 'Dias em que alguém bateu a entrada e foi embora sem bater a saída.',
        deOndeVem: 'Das batidas do ponto. Quanto mais tempo passa, menos alguém lembra a hora certa.',
      },
    },
    {
      id: 'batidas-a-conferir',
      titulo: 'Batidas a conferir',
      valor: comPonto.length === 0 ? '—' : String(aConferir.length),
      detalhe: comPonto.length === 0 ? undefined : 'fora da cerca ou sem localização',
      tom: comPonto.length === 0 ? 'sem-dado' : aConferir.length > 0 ? 'atencao' : 'ok',
      destino: 'ponto',
      explicacao: {
        oQueE: 'Batidas que o sistema registrou mas não conseguiu confirmar dentro da obra — GPS negado, sem sinal, impreciso, ou de fato longe.',
        deOndeVem: 'Da cerca virtual, comparando a posição do celular com a coordenada da obra.',
        oQueFalta: comPonto.length === 0
          ? 'Nenhum funcionário tem conta ligada ao cadastro. O vínculo é feito em Funcionários › Contas do Ponto Eletrônico.'
          : undefined,
      },
    },
    {
      id: 'banco-de-horas',
      titulo: 'Banco de horas do período',
      valor: comBanco.length === 0 ? '—' : horas(saldoTotal),
      detalhe: comBanco.length === 0 ? undefined : `${comBanco.length} pessoa(s) com banco`,
      tom: comBanco.length === 0 ? 'sem-dado' : saldoTotal < 0 ? 'atencao' : 'ok',
      destino: 'ponto',
      explicacao: {
        oQueE: 'A soma do trabalhado menos o previsto pelo regime contratual de cada pessoa, no período.',
        deOndeVem: 'Das batidas do ponto, com a jornada contratual de cada funcionário e os feriados.',
        oQueFalta: comBanco.length === 0
          ? 'Ninguém com jornada que gere banco: diarista não acumula, e regime em branco não tem previsto.'
          : undefined,
      },
    },
    {
      id: 'credito-a-vencer',
      titulo: 'Crédito de banco a vencer',
      valor: comPonto.length === 0 ? '—' : String(vencendo.length),
      detalhe: vencendo.length > 0
        ? `${horas(minutosAVencer)} no total · art. 59 §5º, vencido vira hora extra a pagar`
        : 'art. 59 §5º — vencido vira hora extra a pagar',
      tom: comPonto.length === 0 ? 'sem-dado' : vencendo.length > 0 ? 'atencao' : 'ok',
      destino: 'ponto',
      explicacao: {
        oQueE: 'Horas positivas acumuladas cujo prazo de compensação está acabando.',
        deOndeVem: 'Do banco de horas dos últimos 12 meses, com o prazo configurado em Ponto Eletrônico › Ajustes.',
        oQueFalta: comPonto.length === 0
          ? 'Nenhum funcionário bate ponto eletrônico ainda — sem batida não há banco de horas.'
          : undefined,
      },
    },
    {
      id: 'frequencia',
      titulo: 'Frequência no período',
      valor: pct(freq.frequenciaPct),
      detalhe: freq.frequenciaPct == null ? undefined : `${freq.presencas} de ${freq.possiveis} possíveis · ${freq.diasUteis} dias úteis`,
      tom: freq.frequenciaPct == null ? 'sem-dado'
        : freq.frequenciaPct >= 95 ? 'ok' : freq.frequenciaPct >= 90 ? 'atencao' : 'grave',
      destino: 'faltas',
      explicacao: {
        oQueE: 'Quantas presenças houve, de todas as que seriam possíveis: efetivo vezes dias úteis.',
        deOndeVem: 'Presença é turno confirmado OU apontamento com horas — porque quem opera por RDO não lança turno.',
        oQueFalta: freq.frequenciaPct == null ? 'Não houve dia útil no período escolhido.' : undefined,
      },
    },
    {
      id: 'absenteismo',
      titulo: 'Absenteísmo',
      valor: pct(freq.absenteismoPct),
      tom: freq.absenteismoPct == null ? 'sem-dado'
        : freq.absenteismoPct <= 5 ? 'ok' : freq.absenteismoPct <= 10 ? 'atencao' : 'grave',
      destino: 'faltas',
      explicacao: {
        oQueE: 'O complemento da frequência: a fatia das presenças possíveis que não aconteceu.',
        deOndeVem: 'A mesma conta da frequência, e o mesmo motor que o Gestão 360 usa.',
        oQueFalta: freq.absenteismoPct == null ? 'Não houve dia útil no período escolhido.' : undefined,
      },
    },
    {
      id: 'efetivo',
      titulo: 'Efetivo na folha',
      // ⚠️ Sem NENHUM funcionário cadastrado o módulo ainda não foi montado: "—". Com cadastro e
      // zero no período, o zero é um FATO e merece atenção, não um traço.
      valor: e.workers.length === 0 ? '—' : String(doPeriodo.length),
      detalhe: e.workers.length === 0 ? undefined : `${comPonto.length} com ponto eletrônico`,
      tom: e.workers.length === 0 ? 'sem-dado' : doPeriodo.length > 0 ? 'ok' : 'atencao',
      destino: 'funcionarios',
      explicacao: {
        oQueE: 'Quem está na folha no período — não quem tem cadastro. Desligado antes do início não conta; desligado no meio conta, porque trabalhou.',
        deOndeVem: 'Do cadastro de funcionários, com a data de admissão e a de desligamento.',
        oQueFalta: e.workers.length === 0 ? 'Nenhum funcionário cadastrado ainda. Cadastre em Funcionários.' : undefined,
      },
    },
    {
      id: 'horas-extras',
      titulo: 'Horas extras a pagar',
      valor: heDoPeriodo.length === 0 ? '—' : brl(valorAPagar),
      detalhe: heDoPeriodo.length === 0 ? undefined : `${heDoPeriodo.length} lançamento(s) · ${hePagas.length} já pago(s)`,
      tom: heDoPeriodo.length === 0 ? 'sem-dado' : valorAPagar > 0 ? 'atencao' : 'ok',
      destino: 'horas-extras',
      explicacao: {
        oQueE: 'O valor das horas extras lançadas no período e ainda não marcadas como pagas.',
        // ⚠️ Esta é a correção do cartão antigo: ele somava `shifts.type === 'overtime'`, que é
        // outra coisa — turno de escala marcado como extra, não hora extra lançada e valorada.
        deOndeVem: 'Da aba Horas Extras, que é onde a HE é lançada com o fator e o valor. Não é a escala.',
        oQueFalta: heDoPeriodo.length === 0 ? 'Nenhuma hora extra lançada no período, na aba Horas Extras.' : undefined,
      },
    },
    {
      id: 'postos-descobertos',
      titulo: 'Postos descobertos hoje',
      valor: e.workPosts.length === 0 ? '—' : String(descobertos),
      tom: e.workPosts.length === 0 ? 'sem-dado' : descobertos > 0 ? 'grave' : 'ok',
      destino: 'escala',
      explicacao: {
        oQueE: 'Postos de trabalho que hoje não têm ninguém escalado com o cargo exigido.',
        deOndeVem: 'Do cruzamento entre os postos cadastrados e os turnos do dia.',
        oQueFalta: e.workPosts.length === 0 ? 'Nenhum posto cadastrado. Cadastre em Escala e Postos.' : undefined,
      },
    },
    {
      id: 'certificacoes',
      titulo: 'Certificações vencidas',
      // ⚠️ Sem NENHUMA certificação cadastrada o certo é "não sei", não "tudo em dia" — era esse o
      // 100% fixo que o cartão antigo mostrava para sempre.
      valor: !temCertificacao ? '—' : String(vencidas.length),
      detalhe: !temCertificacao ? undefined : vencidas.length > 0 ? `a mais antiga há ${vencidas[0].diasVencida} dia(s)` : 'nenhuma vencida',
      tom: !temCertificacao ? 'sem-dado' : vencidas.length > 0 ? 'grave' : 'ok',
      destino: 'seguranca',
      explicacao: {
        oQueE: 'NR-35, NR-10, NR-33 e afins com a validade já expirada — quem está nessa lista não pode executar o serviço.',
        deOndeVem: 'Do cadastro de cada funcionário, aba Segurança.',
        oQueFalta: !temCertificacao
          ? 'Nenhuma certificação cadastrada. Sem isso o sistema não tem como dizer que está tudo em dia — e afirmar que está seria pior que não dizer nada.'
          : undefined,
      },
    },
    {
      id: 'avaliacoes',
      titulo: 'Nota média das avaliações',
      valor: media == null ? '—' : media.toFixed(1).replace('.', ','),
      detalhe: media == null ? undefined : `${notas.length} avaliação(ões) no período`,
      tom: media == null ? 'sem-dado' : media >= 7 ? 'ok' : media >= 5 ? 'atencao' : 'grave',
      destino: 'produtividade',
      explicacao: {
        oQueE: 'A média das notas finais das avaliações do período, já com a penalidade por falta aplicada.',
        deOndeVem: 'Da aba Produtividade e Avaliações, ciclo quinzenal.',
        oQueFalta: media == null ? 'Nenhuma avaliação com nota no período. Avalie em Produtividade e Avaliações.' : undefined,
      },
    },
  ]
}
