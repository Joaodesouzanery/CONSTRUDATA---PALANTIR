/**
 * Os dados do quadro de Gestão à Vista, montados num lugar só.
 *
 * A tela e o papel A4 leem daqui. Se cada um montasse o seu, o quadro impresso e a tela
 * divergiriam na primeira mudança — e o quadro fica na parede por semanas, discordando em silêncio
 * do que o sistema mostra.
 *
 * Puro: entra dado, sai dado. Nada de store, nada de `new Date()`.
 */
import type { Worker, WorkerAbsence, Shift, TimecardEntry, RDO, ConstructionSite, WorkWeekMode } from '@/types'
import {
  efetivoPorCargo, situacaoNoDia, frequenciaNoPeriodo, serieMensal, ultimosMeses, ultimoDiaDoMes,
  type EfetivoPorCargo, type SituacaoContada, type FrequenciaDoPeriodo, type PontoMensal,
} from '@/features/mao-de-obra/utils/frequencia'
import { medidoPorServicoPorMes, valoresDoContrato } from '@/features/torre-de-controle/utils/obraMedicao'

export interface LinhaAvancoServico {
  servicoId: string
  descricao: string
  unidade: string
  /** Quantidade contratada. Zero quando o serviço é verba. */
  contratado: number
  /** Quanto já saiu, somando todos os meses. */
  medido: number
  /** `medido / contratado` em 0–100. `null` sem quantidade contratada. */
  pct: number | null
  /** Quanto saiu em cada mês da janela, na mesma ordem de `meses`. */
  porMes: number[]
}

export interface DadosGestaoAVista {
  obraNome: string
  /** `yyyy-MM`, do mais antigo ao mais recente. */
  meses: string[]
  mesAtual: string

  efetivo: { linhas: EfetivoPorCargo[]; total: EfetivoPorCargo }
  situacaoHoje: { total: number; contagem: SituacaoContada[] }
  frequenciaDoMes: FrequenciaDoPeriodo
  serie: PontoMensal[]

  avanco: LinhaAvancoServico[]
  /** A obra não tem contrato com composição — o bloco de avanço não tem o que mostrar. */
  semComposicao: boolean

  /** Nenhuma das três fontes tem dado: a tela não deve fingir quadro. */
  vazio: boolean
}

export function montarGestaoAVista(entrada: {
  site: ConstructionSite | null
  workers: Worker[]
  absences: WorkerAbsence[]
  shifts: Shift[]
  /** Presença também vem daqui: a ponte do RDO grava apontamento, não turno. */
  timecards: TimecardEntry[]
  rdos: RDO[]
  feriados: Set<string>
  jornada: WorkWeekMode
  hoje: string
  /** Quantos meses a série mostra. O quadro da parede usa 11; 12 fecha o ano. */
  janelaMeses?: number
}): DadosGestaoAVista {
  const { site, workers, absences, shifts, timecards, rdos, feriados, jornada, hoje, janelaMeses = 12 } = entrada
  const mesAtual = hoje.slice(0, 7)
  const meses = ultimosMeses(mesAtual, janelaMeses)

  const efetivo = efetivoPorCargo(workers)
  const situacaoHoje = situacaoNoDia({ workers, absences, shifts, timecards, data: hoje })
  const frequenciaDoMes = frequenciaNoPeriodo({
    workers, absences, shifts, timecards,
    de: `${mesAtual}-01`, ate: ultimoDiaDoMes(mesAtual),
    feriados, jornada,
  })
  const serie = serieMensal({ workers, absences, shifts, timecards, meses, feriados, jornada })

  // ── Avanço por serviço ──────────────────────────────────────────────────────
  const servicos = site?.contrato?.services ?? []
  const porServico = medidoPorServicoPorMes(rdos, site?.id)
  const avanco: LinhaAvancoServico[] = servicos.map((svc) => {
    const mapaMes = porServico.get(svc.id) ?? new Map<string, number>()
    const porMes = meses.map((m) => mapaMes.get(m) ?? 0)
    // O total soma TODOS os meses gravados, não só os da janela: o percentual é contra o contrato
    // inteiro, e cortar o histórico faria uma obra antiga parecer no começo.
    const medido = [...mapaMes.values()].reduce((s, v) => s + v, 0)
    const contratado = Number(svc.qtdContrato) || 0
    return {
      servicoId: svc.id,
      descricao: svc.descricao ?? '(sem descrição)',
      unidade: svc.unidade ?? '',
      contratado,
      medido,
      pct: contratado > 0 ? Math.min(100, (medido / contratado) * 100) : null,
      porMes,
    }
  })

  const temContrato = valoresDoContrato(site?.contrato).total > 0
  return {
    obraNome: site?.name ?? 'Todas as obras',
    meses,
    mesAtual,
    efetivo,
    situacaoHoje,
    frequenciaDoMes,
    serie,
    avanco,
    semComposicao: servicos.length === 0,
    vazio: efetivo.total.total === 0 && servicos.length === 0 && !temContrato,
  }
}
