/**
 * Quanto uma equipe produz por dia, serviço a serviço.
 *
 * ─── POR QUE ISTO NÃO EXISTIA ─────────────────────────────────────────────────
 * Os três ingredientes já estavam persistidos, e **no mesmo objeto RDO**:
 *
 *   rdo.compizzo.producao[].contractServiceId + quantidade   ← o que foi feito, e de qual serviço
 *   rdo.manpower.employeeNames.length                        ← quantas pessoas estavam lá
 *   rdo.date                                                 ← quando
 *
 * E nenhuma linha de código os juntava. O que existia era a RUP (HH ÷ m²), que é agregada e
 * depende de `horasTrabalhadas` — um campo digitado à mão. Aqui a conta sai da **contagem de
 * gente**, que é o que o encarregado sabe de cabeça: *"quanto uma equipe de 6 faz de piso epóxi
 * por dia?"*.
 *
 * ─── A UNIDADE IMPORTA ────────────────────────────────────────────────────────
 * Cada serviço tem a sua (m², metro linear, unidade), e **não se somam**. Por isso o resultado é
 * por serviço, cada um com a unidade dele — nunca um número só.
 */
import type { RDO, ObraContratoServico } from '@/types'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { classificarUnidade, ROTULO_UNIDADE, ehVerba } from '@/lib/unidadesMedida'

export interface DiaDeProducao {
  data: string
  /** Quanto foi executado deste serviço no dia. */
  quantidade: number
  /** Quantas pessoas estavam na obra naquele dia (o RDO inteiro, não só este serviço). */
  pessoas: number
  /** `quantidade ÷ pessoas`. `null` quando o RDO não registrou ninguém. */
  porPessoa: number | null
}

export interface ProdutividadeDoServico {
  servicoId: string
  descricao: string
  /** 'm²', 'm', 'un'… — o rótulo que vai na tela ao lado do número. */
  unidade: string
  /** Dias com produção deste serviço, do mais antigo ao mais recente. */
  dias: DiaDeProducao[]
  /** Σ das quantidades. */
  total: number
  /** Quantos dias tiveram produção deste serviço. */
  diasComProducao: number
  /**
   * A média que interessa: **total ÷ Σ(pessoas de cada dia)**.
   *
   * Não é a média das médias diárias — essa daria peso igual a um dia de 2 pessoas e a um de 20.
   * `null` quando nenhum dia registrou gente.
   */
  mediaPorPessoaDia: number | null
  /** Melhor e pior dia, para a conversa de "o que aconteceu naquele dia". */
  melhorDia: DiaDeProducao | null
  piorDia: DiaDeProducao | null
}

/** Só RDO finalizado entra: rascunho é intenção, não produção. */
function ehFinalizado(rdo: RDO): boolean {
  return rdo.template === 'compizzo' && !!rdo.compizzo && rdo.status !== 'rascunho'
}

/**
 * Produtividade por serviço do contrato, a partir dos RDOs finalizados de uma obra.
 *
 * Serviço de valor fechado (verba) fica de fora: ele não tem metragem, então "por pessoa por dia"
 * não significa nada nele.
 */
export function produtividadePorServico(
  rdos: RDO[],
  siteId: string | null | undefined,
  servicos: ObraContratoServico[],
): ProdutividadeDoServico[] {
  if (!siteId || servicos.length === 0) return []

  const porId = new Map(servicos.filter((s) => !ehVerba(s.unidade)).map((s) => [s.id, s]))
  if (porId.size === 0) return []

  // servicoId → data → { quantidade, pessoas }
  const acc = new Map<string, Map<string, { quantidade: number; pessoas: number }>>()

  for (const rdo of rdos) {
    if ((rdo.siteId ?? null) !== siteId || !ehFinalizado(rdo)) continue
    // `manpower` mora na RAIZ do RDO, não dentro de `compizzo` — o Compizzo reaproveita o
    // mesmo bloco de efetivo do RDO padrão.
    const pessoas = rdo.manpower?.employeeNames?.length ?? 0
    const data = rdo.date

    for (const linha of rdo.compizzo?.producao ?? []) {
      if (!linha.contractServiceId || !porId.has(linha.contractServiceId)) continue
      const q = parseLocaleNumber(linha.quantidade) || 0
      if (q <= 0) continue

      const porData = acc.get(linha.contractServiceId) ?? new Map()
      const atual = porData.get(data) ?? { quantidade: 0, pessoas: 0 }
      // Duas linhas do mesmo serviço no mesmo RDO somam a quantidade, mas as pessoas são as
      // MESMAS pessoas — contar de novo dividiria o dia por gente que não existe.
      porData.set(data, { quantidade: atual.quantidade + q, pessoas: Math.max(atual.pessoas, pessoas) })
      acc.set(linha.contractServiceId, porData)
    }
  }

  const out: ProdutividadeDoServico[] = []
  for (const [servicoId, porData] of acc) {
    const svc = porId.get(servicoId)!
    const dias: DiaDeProducao[] = [...porData.entries()]
      .map(([data, v]) => ({
        data,
        quantidade: v.quantidade,
        pessoas: v.pessoas,
        porPessoa: v.pessoas > 0 ? v.quantidade / v.pessoas : null,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))

    const total = dias.reduce((s, d) => s + d.quantidade, 0)
    // Só os dias COM gente entram na média — senão um RDO sem equipe registrada puxaria o
    // resultado para baixo fingindo produtividade infinita.
    const comGente = dias.filter((d) => d.pessoas > 0)
    const somaPessoas = comGente.reduce((s, d) => s + d.pessoas, 0)
    const somaQtd = comGente.reduce((s, d) => s + d.quantidade, 0)
    const ordenadosPorRitmo = [...comGente].sort((a, b) => (b.porPessoa ?? 0) - (a.porPessoa ?? 0))

    const tipo = classificarUnidade(svc.unidade)
    out.push({
      servicoId,
      descricao: svc.descricao || 'Serviço sem descrição',
      unidade: tipo === 'outra' ? (svc.unidade || 'un') : ROTULO_UNIDADE[tipo],
      dias,
      total,
      diasComProducao: dias.length,
      mediaPorPessoaDia: somaPessoas > 0 ? somaQtd / somaPessoas : null,
      melhorDia: ordenadosPorRitmo[0] ?? null,
      piorDia: ordenadosPorRitmo.length > 1 ? ordenadosPorRitmo[ordenadosPorRitmo.length - 1] : null,
    })
  }

  // Mais produção primeiro — é o serviço que domina a obra.
  return out.sort((a, b) => b.total - a.total)
}

/**
 * Quantos dias faltam para terminar o serviço, no ritmo atual e com a equipe de hoje.
 *
 * `null` quando não dá para dizer: sem ritmo medido, sem saldo, ou sem equipe. Devolver um número
 * chutado aqui seria pior do que não responder — vira data prometida ao cliente.
 */
export function diasParaConcluir(
  p: ProdutividadeDoServico,
  saldoQuantidade: number,
  pessoasPrevistas: number,
): number | null {
  if (p.mediaPorPessoaDia == null || p.mediaPorPessoaDia <= 0) return null
  if (saldoQuantidade <= 0 || pessoasPrevistas <= 0) return null
  return Math.ceil(saldoQuantidade / (p.mediaPorPessoaDia * pessoasPrevistas))
}
