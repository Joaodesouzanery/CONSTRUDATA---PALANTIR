/**
 * statusRdoDia.ts — o RDO daquela obra, naquele dia, foi feito?
 *
 * Função PURA, separada do componente de propósito: dá para testar as regras de dia útil,
 * feriado e precedência sem renderizar nada, e o mesmo cálculo serve para a Sidebar depois.
 *
 * ─── AS DUAS DECISÕES QUE MAIS IMPORTAM ───────────────────────────────────────────────────────
 *
 * 1. **Rascunho É pendência.** Um RDO em rascunho não alimenta absolutamente nada: não emite
 *    `rdo.finalized`, não lança no Financeiro, não baixa estoque, não avança o Planejamento. Do
 *    ponto de vista de tudo que consome RDO, o dia está tão aberto quanto se o RDO não existisse.
 *    Mas é pendência de outro tipo — o trabalho já foi digitado —, então a ação é "Finalizar", não
 *    "Criar", e a cor é âmbar, não vermelha.
 *
 * 2. **Obra parada não cobra RDO.** Obra `paused`, `completed`, `planning` ou arquivada sai da
 *    cobrança. Cobrar RDO diário de obra que não está executando fabrica exatamente o alarme falso
 *    que este painel existe para eliminar — e alerta que se aprende a ignorar não vale nada.
 */
import type { ConstructionSite, PlanHoliday, RDO, WorkWeekMode } from '@/types'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import { ehDiaUtil, diaAnterior, diasEntre } from '@/lib/diasUteis'

export type StatusRdoDia =
  | 'ok'            // RDO finalizado no dia
  | 'rascunho'      // existe, mas não finalizado — não alimenta nada
  | 'sem_producao'  // justificado
  | 'nao_cobravel'  // domingo, sábado fora da jornada, feriado, obra parada/arquivada
  | 'pendente'      // devia ter RDO e não tem

export interface LinhaStatusObra {
  site: ConstructionSite
  status: StatusRdoDia
  /** Preenchido em 'ok' e 'rascunho'. */
  rdoId?: string
  numero?: number
  /** Preenchido em 'sem_producao'. */
  motivo?: string
  /** Preenchido em 'nao_cobravel' — por que não cobra. */
  razaoNaoCobravel?: string
}

/** `isRdoFinalized` do rdoStore: ausência de status significa finalizado (RDOs antigos). */
const finalizado = (rdo: RDO): boolean => rdo.status !== 'rascunho'

/**
 * O dia é cobrável para esta obra?
 *
 * Duas metades: o ESTADO da obra (arquivada, parada, ainda não começou) e o CALENDÁRIO (domingo,
 * sábado conforme a jornada, feriado). A metade do calendário mora em `@/lib/diasUteis` porque as
 * Rotinas precisam exatamente dela — uma rotina diária não pode aparecer atrasada na segunda-feira
 * por causa do fim de semana. Duas cópias dessa regra divergiriam na primeira mudança.
 *
 * Ressalva conhecida: o feriado é cadastrado por ORGANIZAÇÃO, não por obra. Um feriado municipal
 * de uma cidade vale para todas as obras. Está isolado em `diasUteis` para o override por obra
 * caber depois sem tocar em mais nada.
 */
export function ehDiaCobravel(
  site: ConstructionSite,
  dataISO: string,
  feriados: Set<string>,
  jornada: WorkWeekMode,
): { cobra: boolean; razao?: string } {
  if (!obraEstaAtiva(site)) return { cobra: false, razao: 'obra arquivada' }
  if (site.status === 'completed') return { cobra: false, razao: 'obra concluída' }
  if (site.status === 'paused') return { cobra: false, razao: 'obra pausada' }
  if (site.status === 'planning') return { cobra: false, razao: 'obra em planejamento' }

  // Antes do primeiro dia da obra não há o que cobrar.
  //
  // Faltava esta linha, e ela só passou a doer agora: enquanto o painel olhava um dia só, cobrar um
  // dia anterior ao início era invisível. Contando a LACUNA para trás, uma obra cadastrada semana
  // passada apareceria com noventa dias de RDO em falta — exatamente o alarme falso que este
  // cálculo existe para não produzir.
  if (site.startDate && dataISO < site.startDate) {
    return { cobra: false, razao: 'antes do início da obra' }
  }

  const { util, razao } = ehDiaUtil(dataISO, feriados, jornada)
  return util ? { cobra: true } : { cobra: false, razao }
}

export interface EntradaStatus {
  sites: ConstructionSite[]
  rdos: RDO[]
  /** Dias já justificados: chave `${siteId}|${data}`. */
  semProducao: Map<string, string>
  dataISO: string
  feriados: PlanHoliday[]
  jornada: WorkWeekMode
}

export interface ResultadoStatus {
  linhas: LinhaStatusObra[]
  /** RDOs do dia sem obra vinculada — não contam para obra nenhuma. */
  rdosSemObra: RDO[]
  pendentes: number
  rascunhos: number
  semProducao: number
  ok: number
  /** Obras que o dia não cobra (domingo, feriado, obra parada). */
  naoCobraveis: number
}

/**
 * Varre os RDOs UMA vez montando um índice por obra, e só então percorre as obras.
 *
 * O caminho ingênuo — `sites.map(s => rdos.filter(...))` — é O(obras × RDOs) a cada render, e o
 * projeto já apanhou disso no `useAlertCounts`, onde a varredura sem memo travava a navegação.
 */
export function calcularStatusDoDia(entrada: EntradaStatus): ResultadoStatus {
  const { sites, rdos, semProducao, dataISO, feriados, jornada } = entrada
  const feriadoSet = new Set(feriados.map((f) => f.date))

  const doDia = new Map<string, { finalizado?: RDO; rascunho?: RDO }>()
  const rdosSemObra: RDO[] = []
  for (const rdo of rdos) {
    if (rdo.date !== dataISO) continue
    if (!rdo.siteId) { rdosSemObra.push(rdo); continue }
    const atual = doDia.get(rdo.siteId) ?? {}
    if (finalizado(rdo)) atual.finalizado = rdo
    else atual.rascunho = rdo
    doDia.set(rdo.siteId, atual)
  }

  const linhas: LinhaStatusObra[] = sites.map((site) => {
    const achado = doDia.get(site.id)
    // Precedência: um RDO finalizado vence tudo, inclusive uma justificativa de "sem produção"
    // registrada por engano — fazer o RDO é a correção natural de ter marcado errado.
    if (achado?.finalizado) {
      return { site, status: 'ok', rdoId: achado.finalizado.id, numero: achado.finalizado.number }
    }
    const justificativa = semProducao.get(`${site.id}|${dataISO}`)
    if (justificativa) return { site, status: 'sem_producao', motivo: justificativa }
    if (achado?.rascunho) {
      return { site, status: 'rascunho', rdoId: achado.rascunho.id, numero: achado.rascunho.number }
    }
    const { cobra, razao } = ehDiaCobravel(site, dataISO, feriadoSet, jornada)
    if (!cobra) return { site, status: 'nao_cobravel', razaoNaoCobravel: razao }
    return { site, status: 'pendente' }
  })

  const contar = (s: StatusRdoDia) => linhas.filter((l) => l.status === s).length
  return {
    linhas,
    rdosSemObra,
    pendentes: contar('pendente'),
    rascunhos: contar('rascunho'),
    semProducao: contar('sem_producao'),
    ok: contar('ok'),
    naoCobraveis: contar('nao_cobravel'),
  }
}

// ─── A LACUNA ─────────────────────────────────────────────────────────────────
//
// `calcularStatusDoDia` responde "e hoje?". Isso basta para o alerta piscar, mas não para cobrar:
// um encarregado que entra na obra precisa saber HÁ QUANTO TEMPO o RDO está em falta, e desde
// quando. "Sem RDO hoje" e "3 dias sem RDO, o mais antigo é 14/08" pedem ações diferentes.

export interface LacunaRdo {
  /** Dias cobráveis sem RDO finalizado e sem justificativa, do mais recente para trás. */
  diasEmAberto: number
  /** Os dias em aberto, `yyyy-MM-dd`, do mais recente para o mais antigo. */
  dias: string[]
  /** O dia em aberto mais ANTIGO da sequência, `yyyy-MM-dd`. */
  maisAntigo: string
  /** Dias de calendário entre `maisAntigo` e hoje. Zero quando o mais antigo é hoje. */
  diasDesde: number
  /** A varredura bateu o teto — há mais lacuna do que a que está sendo mostrada. */
  truncado: boolean
}

export interface EntradaLacuna {
  site: ConstructionSite
  rdos: RDO[]
  /** Dias já justificados: chave `${siteId}|${data}`. */
  semProducao: Map<string, string>
  hoje: string
  feriados: PlanHoliday[]
  jornada: WorkWeekMode
  /** Teto de dias de CALENDÁRIO varridos para trás. */
  maxDias?: number
}

/**
 * Há quantos dias esta obra está sem RDO?
 *
 * ─── DUAS DECISÕES ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Conta a sequência que vem de hoje para trás, e para no primeiro dia resolvido.** Se ontem o
 *    RDO foi feito, a lacuna é só a de hoje — mesmo que a semana passada tenha buracos. Um
 *    contador que soma todo dia em falta desde sempre só cresce, e alerta que só cresce vira
 *    paisagem. O que precisa de ação é a sequência aberta agora.
 *
 * 2. **Só conta dia cobrável.** Domingo, sábado fora da jornada, feriado, obra parada e dia
 *    anterior ao início da obra não entram — é `ehDiaCobravel` que decide, o mesmo juiz do painel
 *    diário. Sem isso, toda segunda-feira acusaria dois dias de atraso.
 *
 * Devolve `null` quando não há lacuna nenhuma (o dia cobrável mais recente está resolvido).
 */
export function lacunaDeRdo(entrada: EntradaLacuna): LacunaRdo | null {
  const { site, rdos, semProducao, hoje, feriados, jornada, maxDias = 90 } = entrada
  const feriadoSet = new Set(feriados.map((f) => f.date))

  // Índice de uma passada só: os dias em que esta obra tem RDO finalizado. Rascunho NÃO conta —
  // ele não alimenta nada, então o dia segue em aberto (mesma regra do painel diário).
  const comRdoFinalizado = new Set<string>()
  for (const rdo of rdos) {
    if ((rdo.siteId ?? null) !== site.id) continue
    if (rdo.status === 'rascunho') continue
    comRdoFinalizado.add(rdo.date)
  }

  const emAberto: string[] = []
  let cursor = hoje
  let truncado = false

  for (let guarda = 0; ; guarda++) {
    if (guarda >= maxDias) { truncado = emAberto.length > 0; break }
    if (site.startDate && cursor < site.startDate) break

    if (ehDiaCobravel(site, cursor, feriadoSet, jornada).cobra) {
      const resolvido = comRdoFinalizado.has(cursor) || semProducao.has(`${site.id}|${cursor}`)
      if (resolvido) break        // a sequência aberta terminou aqui
      emAberto.push(cursor)
    }
    cursor = diaAnterior(cursor)
  }

  if (emAberto.length === 0) return null
  const maisAntigo = emAberto[emAberto.length - 1]
  return {
    diasEmAberto: emAberto.length,
    dias: emAberto,
    maisAntigo,
    diasDesde: diasEntre(maisAntigo, hoje),
    truncado,
  }
}

/** Ordem de exibição: o que precisa de ação primeiro; a obra ativa fixada no topo do seu grupo. */
const PESO: Record<StatusRdoDia, number> = {
  pendente: 0, rascunho: 1, sem_producao: 2, ok: 3, nao_cobravel: 4,
}

export function ordenarLinhas(linhas: LinhaStatusObra[], obraAtivaId: string | null): LinhaStatusObra[] {
  return [...linhas].sort((a, b) => {
    if (obraAtivaId) {
      if (a.site.id === obraAtivaId) return -1
      if (b.site.id === obraAtivaId) return 1
    }
    return PESO[a.status] - PESO[b.status] || a.site.name.localeCompare(b.site.name)
  })
}
