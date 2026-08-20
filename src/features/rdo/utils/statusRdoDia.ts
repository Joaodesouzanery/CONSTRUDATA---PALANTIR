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
 * Reusa a MESMA regra de dia útil do `scheduleEngine.buildWorkDays` — domingo nunca, sábado
 * conforme a jornada da organização, feriado cadastrado nunca. Duplicar essa regra criaria duas
 * definições de dia útil no mesmo produto, que divergiriam na primeira mudança.
 *
 * Ressalva conhecida: o feriado é cadastrado por ORGANIZAÇÃO, não por obra. Um feriado municipal
 * de uma cidade vale para todas as obras. Está isolado aqui para o override por obra caber depois
 * sem tocar em mais nada.
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

  // Meio-dia local: `new Date('yyyy-MM-dd')` é interpretado como UTC e devolveria o dia anterior
  // no Brasil, trocando o dia da semana na virada.
  const diaDaSemana = new Date(`${dataISO}T12:00:00`).getDay()
  if (diaDaSemana === 0) return { cobra: false, razao: 'domingo' }
  if (diaDaSemana === 6 && jornada === 'mon_fri') return { cobra: false, razao: 'sábado fora da jornada' }
  if (feriados.has(dataISO)) return { cobra: false, razao: 'feriado' }
  return { cobra: true }
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
