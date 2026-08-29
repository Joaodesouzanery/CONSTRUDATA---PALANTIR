/**
 * Os quatro indicadores da tela de abertura — e a regra que eles existem para impor.
 *
 * ─── O QUE VEIO ANTES ─────────────────────────────────────────────────────────
 * O topo do Gestão 360 mostrava EAC, Δ Orçamento, CPI, SPI. Três problemas de uma vez: o dono do
 * produto não sabia o que aqueles nomes significavam, os números não tinham origem — e o pior, o
 * **CPI mostrava 1,00 em verde por construção**. A conta é `spent > 0 ? … : 1`, e `spent` é sempre
 * zero porque `ConstructionBudgetLine` não tem campo de realizado. Não era dado faltando: era um
 * campo que não existe no modelo, exibido como se estivesse tudo sob controle.
 *
 * ─── A REGRA ──────────────────────────────────────────────────────────────────
 * **Dado ausente é CINZA com "—", nunca verde, e o cartão diz o que falta.** Um indicador que não
 * sabe precisa parecer que não sabe. É o oposto exato do 1,00 verde, e é o motivo de este arquivo
 * existir.
 *
 * Tudo aqui é puro: recebe dado por parâmetro, não lê store, não chama `new Date()`. Quem monta a
 * data é o chamador, com `hojeLocalISO()` — `toISOString()` faria uma nota que vence hoje aparecer
 * vencida a partir das 21h no Brasil.
 */
import type { ConstructionSite, RDO, PlanHoliday, WorkWeekMode } from '@/types'
import type { Rotina, RotinaExecucao } from '@/store/rotinasStore'
import { valoresDoContrato, resumoFaturamento, pctServicoFaturado } from '@/features/torre-de-controle/utils/obraMedicao'
import { lacunaDeRdo, ehDiaCobravel } from '@/features/rdo/utils/statusRdoDia'
import { atrasoDaRotina } from '@/features/minha-rotina/utils/atrasoRotina'
import { cicloDe } from '@/features/minha-rotina/utils/cicloRotina'

const r2 = (n: number) => Math.round(n * 100) / 100

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · DINHEIRO DO CONTRATO
// ═══════════════════════════════════════════════════════════════════════════════

export interface DinheiroDoContrato {
  /**
   * Σ das notas emitidas e ainda não recebidas.
   *
   * ⚠️ **As vencidas ESTÃO dentro deste número**, não ao lado dele. Somar os dois dobraria o
   * dinheiro — por isso o texto do cartão diz "R$ X já venceram", com verbo, e nunca "+ R$ X".
   */
  aReceberBRL: number
  aReceberNotas: number
  /** Subconjunto do a receber: previsão de recebimento anterior a hoje. */
  vencidoBRL: number
  vencidoNotas: number
  /** A nota vencida há mais tempo — é a que o cartão cita, porque é a que se cobra primeiro. */
  maisAntiga: { obra: string; brl: number; venceuEm: string } | null
  obrasComContrato: number
  /** Obras sem valor de contrato: ficam FORA do total, e o cartão diz quais são. */
  obrasSemContrato: string[]
  /**
   * Notas a receber SEM data de previsão de recebimento.
   *
   * ⚠️ Sem previsão, a nota nunca entra em `vencidas` — e o cartão diria "nada vencido", em verde,
   * sobre notas paradas há seis meses. O campo é opcional no extrato, então isto acontece.
   */
  aReceberSemPrevisao: number
}

export function dinheiroDoContrato(sites: ConstructionSite[], hojeISO: string): DinheiroDoContrato {
  let aReceberBRL = 0, aReceberNotas = 0, vencidoBRL = 0, vencidoNotas = 0, obrasComContrato = 0
  let aReceberSemPrevisao = 0
  const obrasSemContrato: string[] = []
  let maisAntiga: DinheiroDoContrato['maisAntiga'] = null

  for (const site of sites) {
    if (valoresDoContrato(site.contrato).total <= 0) { obrasSemContrato.push(site.name); continue }
    obrasComContrato += 1
    const r = resumoFaturamento(site.contrato, hojeISO)
    aReceberBRL += r.aReceber
    aReceberNotas += r.aReceberNotas
    aReceberSemPrevisao += (site.contrato?.faturamentos ?? [])
      .filter((n) => n.situacao !== 'recebido' && !n.previsaoRecebimento).length
    for (const nota of r.vencidas) {
      const v = Number(nota.valor) || 0
      vencidoBRL += v
      vencidoNotas += 1
      const venceuEm = nota.previsaoRecebimento ?? ''
      // Data ISO compara como texto na ordem certa; a mais antiga é a menor string.
      if (!maisAntiga || venceuEm < maisAntiga.venceuEm) {
        maisAntiga = { obra: site.name, brl: v, venceuEm }
      }
    }
  }

  return {
    aReceberBRL: r2(aReceberBRL), aReceberNotas,
    vencidoBRL: r2(vencidoBRL), vencidoNotas,
    maisAntiga, obrasComContrato, obrasSemContrato, aReceberSemPrevisao,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · OBRA REPORTANDO
// ═══════════════════════════════════════════════════════════════════════════════

export interface ObraSemRdo {
  siteId: string
  nome: string
  /** Dias COBRÁVEIS seguidos em aberto — domingo, feriado e obra pausada já descontados. */
  diasUteisEmAberto: number
  /** O dia em aberto mais antigo da sequência. */
  desde: string
  truncado: boolean
}

export interface ObrasReportando {
  semRdo: ObraSemRdo[]
  /** Obras que o dia de hoje COBRA. É o denominador honesto — nem toda obra é cobrável todo dia. */
  cobraveisHoje: number
  piorLacunaDiasUteis: number
  /**
   * A Torre ainda não sincronizou neste aparelho.
   *
   * Sem esta guarda, o primeiro login num celular novo acusa todas as obras sem RDO — a lista de
   * obras chegou vazia, não porque ninguém reportou. É a mesma proteção que `PendenciasDoDia` e
   * `AlertasRdoHoje` já fazem; este é o terceiro lugar que precisava dela.
   */
  incerto: boolean
}

export function obrasReportando(entrada: {
  sites: ConstructionSite[]
  rdos: RDO[]
  semProducao: Map<string, string>
  feriados: PlanHoliday[]
  jornada: WorkWeekMode
  hoje: string
  torreSincronizada: boolean
}): ObrasReportando {
  const { sites, rdos, semProducao, feriados, jornada, hoje, torreSincronizada } = entrada
  if (!torreSincronizada) {
    return { semRdo: [], cobraveisHoje: 0, piorLacunaDiasUteis: 0, incerto: true }
  }

  const semRdo: ObraSemRdo[] = []
  const feriadoSet = new Set(feriados.map((f) => f.date))
  let cobraveisHoje = 0

  for (const site of sites) {
    // O denominador vem de `ehDiaCobravel`, e NÃO de `lacunaDeRdo`: a lacuna devolve `null` tanto
    // para a obra que o dia não cobra quanto para a que está em dia. Usar `null` como "não
    // cobrável" faria a obra que reportou hoje sumir do denominador, e o cartão diria "0 de 0"
    // justamente quando está tudo certo.
    if (!ehDiaCobravel(site, hoje, feriadoSet, jornada).cobra) continue
    cobraveisHoje += 1

    const lacuna = lacunaDeRdo({ site, rdos, semProducao, hoje, feriados, jornada })
    if (!lacuna || lacuna.diasEmAberto <= 0) continue
    semRdo.push({
      siteId: site.id,
      nome: site.name,
      diasUteisEmAberto: lacuna.diasEmAberto,
      desde: lacuna.maisAntigo,
      truncado: lacuna.truncado,
    })
  }

  semRdo.sort((a, b) => b.diasUteisEmAberto - a.diasUteisEmAberto)
  return {
    semRdo,
    cobraveisHoje,
    piorLacunaDiasUteis: semRdo[0]?.diasUteisEmAberto ?? 0,
    incerto: false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EXECUTADO DO CONTRATO
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecucaoDaObra {
  siteId: string
  nome: string
  contratoServicoBRL: number
  faturadoServicoBRL: number
  /** `null` quando a obra não tem valor de serviço cadastrado. */
  pctFaturado: number | null
}

export interface ExecucaoContratada {
  obras: ExecucaoDaObra[]
  /**
   * Σ faturado ÷ Σ contratado das obras COM contrato.
   *
   * **Não é a média dos percentuais.** Uma obra de R$ 1 milhão a 10% e uma de R$ 10 mil a 100%
   * dão ~10,9% de carteira, não 55% — a média daria o mesmo peso a contratos de tamanhos
   * incomparáveis.
   */
  pctCarteira: number | null
  semContrato: string[]
}

export function execucaoContratada(sites: ConstructionSite[], hojeISO: string): ExecucaoContratada {
  const obras: ExecucaoDaObra[] = []
  const semContrato: string[] = []
  let somaContratado = 0, somaFaturado = 0

  for (const site of sites) {
    const { servico } = valoresDoContrato(site.contrato)
    if (servico <= 0) { semContrato.push(site.name); continue }
    const { faturadoServico } = resumoFaturamento(site.contrato, hojeISO)
    somaContratado += servico
    somaFaturado += faturadoServico
    obras.push({
      siteId: site.id,
      nome: site.name,
      contratoServicoBRL: r2(servico),
      faturadoServicoBRL: r2(faturadoServico),
      pctFaturado: pctServicoFaturado(site.contrato, hojeISO),
    })
  }

  obras.sort((a, b) => (b.pctFaturado ?? 0) - (a.pctFaturado ?? 0))
  return {
    obras,
    pctCarteira: somaContratado > 0 ? Math.min(100, (somaFaturado / somaContratado) * 100) : null,
    semContrato,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · ROTINAS EM DIA
// ═══════════════════════════════════════════════════════════════════════════════

export interface RotinasEmDia {
  ativas: number
  /** Feitas no ciclo CORRENTE de cada rotina — que não é o mesmo ciclo para todas. */
  feitasNoCiclo: number
  /** Com ciclo já FECHADO em aberto. O ciclo de hoje nunca conta: ainda dá tempo. */
  atrasadas: number
  pior: { titulo: string; responsavel?: string; diasDeAtraso: number } | null
}

export function rotinasEmDia(entrada: {
  rotinas: Rotina[]
  execucoes: RotinaExecucao[]
  feriados: Set<string>
  jornada: WorkWeekMode
  hoje: string
}): RotinasEmDia {
  const { rotinas, execucoes, feriados, jornada, hoje } = entrada
  // Só execução com `feita: true`. Desmarcar grava uma linha com `feita: false`, e contar linhas
  // daria 100% a quem desmarcou tudo.
  const feitas = new Set(execucoes.filter((e) => e.feita).map((e) => `${e.rotinaId}|${e.periodo}`))
  const ctx = { feitas, feriados, jornada, hoje }

  const ativas = rotinas.filter((r) => r.ativa)
  let feitasNoCiclo = 0, atrasadas = 0
  let pior: RotinasEmDia['pior'] = null

  for (const r of ativas) {
    if (feitas.has(`${r.id}|${cicloDe(r.frequencia, hoje)}`)) feitasNoCiclo += 1
    const atraso = atrasoDaRotina(r, ctx)
    if (!atraso) continue
    atrasadas += 1
    if (!pior || atraso.diasDeAtraso > pior.diasDeAtraso) {
      pior = { titulo: r.titulo, responsavel: r.responsavel, diasDeAtraso: atraso.diasDeAtraso }
    }
  }

  return { ativas: ativas.length, feitasNoCiclo, atrasadas, pior }
}


// ═══════════════════════════════════════════════════════════════════════════════
// APRESENTAÇÃO — o cartão, e a explicação que vai junto
// ═══════════════════════════════════════════════════════════════════════════════

/** `sem-dado` é CINZA. Nunca verde — é o defeito que este arquivo existe para consertar. */
export type TomIndicador = 'ok' | 'atencao' | 'grave' | 'sem-dado'

export interface Indicador {
  id: 'dinheiro' | 'reportando' | 'executado' | 'rotinas'
  titulo: string
  /** O número grande. `'—'` quando falta dado. */
  valor: string
  detalhe: string
  tom: TomIndicador
  explicacao: {
    oQueE: string
    deOndeVem: string
    /** Obrigatório sempre que `tom === 'sem-dado'`: o cartão precisa dizer o que preencher. */
    oQueFalta?: string
  }
  /** Para onde o clique leva. */
  destino: string
}

const brlCompacto = (n: number) =>
  n >= 1_000_000 ? `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  : n >= 1_000   ? `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  : `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** `2026-08-01` → `01/08`. Sem `Date`: split de string não desloca dia por fuso. */
const diaMes = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso)

/**
 * Monta os quatro cartões. Puro: recebe os resumos já calculados.
 *
 * Os textos são longos de propósito. O dono do produto disse, sobre CPI e EAC, "não sei o que é" —
 * e um indicador que precisa de glossário é um indicador que ninguém usa. Cada cartão carrega a
 * própria explicação: o que é, de onde vem, e o que falta quando falta.
 */
export function montarIndicadores(entrada: {
  dinheiro: DinheiroDoContrato
  reportando: ObrasReportando
  executado: ExecucaoContratada
  rotinas: RotinasEmDia
}): Indicador[] {
  const { dinheiro, reportando, executado, rotinas } = entrada

  const faltamContratos = (nomes: string[]) =>
    nomes.length === 0 ? undefined
      : `${nomes.slice(0, 3).join(', ')}${nomes.length > 3 ? ` e mais ${nomes.length - 3}` : ''} `
        + `${nomes.length === 1 ? 'ainda não tem' : 'ainda não têm'} valor de contrato cadastrado. `
        + `${nomes.length === 1 ? 'Ela está fora' : 'Elas estão fora'} desta conta — cadastre em `
        + `Torre de Controle → a obra → Contrato → Resumo.`

  // ── 1 ──────────────────────────────────────────────────────────────────────
  const semNenhumContrato = dinheiro.obrasComContrato === 0
  const cartaoDinheiro: Indicador = {
    id: 'dinheiro',
    titulo: 'A receber',
    valor: semNenhumContrato ? '—' : brlCompacto(dinheiro.aReceberBRL),
    detalhe: semNenhumContrato
      ? 'nenhuma obra com contrato cadastrado'
      : dinheiro.vencidoNotas > 0
        ? `${plural(dinheiro.aReceberNotas, 'nota', 'notas')} · ${brlCompacto(dinheiro.vencidoBRL)} já `
          + `${dinheiro.vencidoNotas === 1 ? 'venceu' : 'venceram'}`
            + (dinheiro.maisAntiga ? ` — ${dinheiro.maisAntiga.obra}, desde ${diaMes(dinheiro.maisAntiga.venceuEm)}` : '')
        : dinheiro.aReceberSemPrevisao > 0
          ? `em ${plural(dinheiro.aReceberNotas, 'nota', 'notas')} · `
            + `${dinheiro.aReceberSemPrevisao} sem data de previsão`
          : `em ${plural(dinheiro.aReceberNotas, 'nota', 'notas')} · nada vencido`,
    // Verde só quando dá para AFIRMAR que nada venceu. Com notas sem data de previsão, não dá:
    // elas nunca entram em `vencidas`, e um cartão verde dizendo "nada vencido" sobre uma nota
    // parada há seis meses é a mentira mais cara desta tela.
    tom: semNenhumContrato ? 'sem-dado'
      : dinheiro.vencidoNotas > 0 ? 'grave'
      : dinheiro.aReceberSemPrevisao > 0 ? 'atencao'
      : 'ok',
    explicacao: {
      oQueE: 'O dinheiro das notas que você já emitiu e ainda não recebeu. "Já venceu" é a parte '
        + 'dele cuja data prevista de recebimento passou — está contada DENTRO do a receber, não '
        + 'somada a ele.',
      deOndeVem: 'Do extrato de faturamento de cada obra: Torre de Controle → a obra → Contrato → '
        + 'Medições. Cada nota lançada ali entra aqui. Nada é estimado.',
      oQueFalta: semNenhumContrato
        ? 'Nenhuma obra tem valor de contrato cadastrado. Sem isso não há o que receber para somar.'
        : dinheiro.aReceberSemPrevisao > 0
          ? `${dinheiro.aReceberSemPrevisao} nota(s) a receber estão sem data de previsão de `
            + 'recebimento. Sem essa data, elas nunca aparecem como vencidas — por isso este cartão '
            + 'não está verde. Preencha em Contrato → Medições.'
          : faltamContratos(dinheiro.obrasSemContrato),
    },
    destino: '/app/torre-de-controle',
  }

  // ── 2 ──────────────────────────────────────────────────────────────────────
  const emDia = reportando.cobraveisHoje - reportando.semRdo.length
  const pior = reportando.semRdo[0]
  const cartaoReportando: Indicador = {
    id: 'reportando',
    titulo: 'Obras reportando hoje',
    valor: reportando.incerto || reportando.cobraveisHoje === 0
      ? '—'
      : `${emDia} de ${reportando.cobraveisHoje}`,
    detalhe: reportando.incerto
      ? 'ainda sincronizando as obras'
      : reportando.cobraveisHoje === 0
        ? 'hoje não é dia de RDO em nenhuma obra'
        : pior
          // `truncado` significa que a varredura bateu o teto de 90 dias: o número é um PISO,
          // não a lacuna real. Dizer "64 dias" quando podem ser 200 é precisão falsa.
          ? `${pior.nome} está há ${pior.truncado ? 'mais de ' : ''}`
            + `${plural(pior.diasUteisEmAberto, 'dia útil', 'dias úteis')} sem RDO — desde ${diaMes(pior.desde)}`
          : 'todas em dia',
    tom: reportando.incerto || reportando.cobraveisHoje === 0 ? 'sem-dado'
      : reportando.piorLacunaDiasUteis >= 3 ? 'grave'
      : reportando.semRdo.length > 0 ? 'atencao' : 'ok',
    explicacao: {
      oQueE: 'Quantas obras deviam ter RDO hoje e têm. O contador de dias é de DIAS ÚTEIS seguidos '
        + 'em aberto e para no primeiro dia resolvido — não é um número que só cresce.',
      deOndeVem: 'Dos RDOs finalizados de cada obra. Rascunho não conta: ele não alimenta medição, '
        + 'financeiro nem estoque. Domingo, sábado fora da jornada, feriado do Planejamento, obra '
        + 'pausada ou concluída e dia anterior ao início da obra não são cobrados.',
      oQueFalta: reportando.incerto
        ? 'As obras ainda estão sincronizando neste aparelho. Até terminar, este número estaria '
          + 'incompleto — por isso ele não aparece, em vez de aparecer errado.'
        : reportando.cobraveisHoje === 0
          ? 'Nenhuma obra cobra RDO hoje. Pode ser feriado, fim de semana fora da jornada, ou não '
            + 'haver obra ativa cadastrada.'
          : undefined,
    },
    destino: '/app/rdo',
  }

  // ── 3 ──────────────────────────────────────────────────────────────────────
  const cartaoExecutado: Indicador = {
    id: 'executado',
    titulo: 'Executado do contrato',
    valor: executado.pctCarteira === null
      ? '—'
      : `${executado.pctCarteira.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`,
    detalhe: executado.pctCarteira === null
      ? 'nenhuma obra com valor de serviço cadastrado'
      : `${brlCompacto(executado.obras.reduce((s, o) => s + o.faturadoServicoBRL, 0))} faturados de `
        + `${brlCompacto(executado.obras.reduce((s, o) => s + o.contratoServicoBRL, 0))} de serviço · `
        + plural(executado.obras.length, 'obra', 'obras'),
    tom: executado.pctCarteira === null ? 'sem-dado' : 'ok',
    explicacao: {
      oQueE: 'Quanto do SERVIÇO contratado já virou nota fiscal. O material é faturado à parte e '
        + 'não entra: na SUPERA ele é quase do tamanho do serviço, e somá-lo empurraria esta barra '
        + 'para perto de 100% sem nada ter sido executado.',
      deOndeVem: 'Notas de serviço do extrato, divididas pelo valor de serviço do contrato. Obra a '
        + 'obra, na lista abaixo. É o FATURADO — o que o RDO já mediu e ainda não virou nota '
        + 'aparece em Contrato → Medições.',
      oQueFalta: executado.pctCarteira === null
        ? 'Nenhuma obra tem valor de serviço cadastrado no contrato.'
        : faltamContratos(executado.semContrato),
    },
    destino: '/app/torre-de-controle',
  }

  // ── 4 ──────────────────────────────────────────────────────────────────────
  const cartaoRotinas: Indicador = {
    id: 'rotinas',
    titulo: 'Rotinas em dia',
    valor: rotinas.ativas === 0 ? '—' : `${rotinas.feitasNoCiclo} de ${rotinas.ativas}`,
    detalhe: rotinas.ativas === 0
      ? 'nenhuma rotina cadastrada'
      : rotinas.pior
        ? `${plural(rotinas.atrasadas, 'atrasada', 'atrasadas')} · a pior: "${rotinas.pior.titulo}" `
          + `há ${plural(rotinas.pior.diasDeAtraso, 'dia', 'dias')}`
        : 'nenhuma atrasada',
    tom: rotinas.ativas === 0 ? 'sem-dado'
      : rotinas.atrasadas > 2 ? 'grave'
      : rotinas.atrasadas > 0 ? 'atencao' : 'ok',
    explicacao: {
      oQueE: 'Quantas rotinas ativas da empresa já foram marcadas como feitas no ciclo que está '
        + 'correndo agora: o dia de hoje para a diária, a semana para a semanal, o mês para a mensal.',
      deOndeVem: 'Da aba Rotinas da Empresa, nesta mesma tela. Alguém precisa marcar — o sistema '
        + 'não marca sozinho. "Atrasada" conta ciclo já FECHADO sem execução; o ciclo de hoje nunca '
        + 'conta como atraso, ainda dá tempo de fazer.',
      oQueFalta: rotinas.ativas === 0
        ? 'Nenhuma rotina cadastrada. Use "Carregar o modelo" aqui embaixo para começar com as 18 '
          + 'rotinas da operação.'
        : undefined,
    },
    destino: '/app/minha-rotina',
  }

  return [cartaoDinheiro, cartaoReportando, cartaoExecutado, cartaoRotinas]
}
