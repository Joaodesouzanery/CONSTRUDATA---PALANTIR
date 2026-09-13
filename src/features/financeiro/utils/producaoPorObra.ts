/**
 * Produzido por obra — o outro lado de "qual obra dá lucro" na Visão Geral do Financeiro.
 *
 * "Faturado − custo" já existe ali (soma de `FinanceiroEntry` entrada/saída, respeitando o filtro
 * de período da tela). "Produzido" é uma pergunta diferente: quanto do contrato já foi MEDIDO,
 * esteja a nota emitida ou não — é o trabalho feito e ainda não cobrado. Reaproveita o mesmo motor
 * da aba Contrato → Medições (`obraMedicao.ts`): nenhuma fórmula nova, só outra leitura do mesmo
 * cálculo.
 *
 * ⚠️ É um total ACUMULADO (desde o início do contrato), não recortado pelo período da tela — a
 * quantidade medida por override manual (`qtdMedidaOverride`) não tem data nenhuma para filtrar, e
 * fingir que tem misturaria obra a obra dois recortes de tempo diferentes sem avisar. Por isso a
 * tela mostra "Produzido" separado, com o próprio rótulo dizendo que é o total do contrato.
 */
import type { ConstructionSite, RDO } from '@/types'
import { medidoAutoPorServico, totaisContrato } from '@/features/torre-de-controle/utils/obraMedicao'

export interface ProducaoDaObra {
  /** `null` = obra sem contrato ou sem serviço cadastrado — não dá para calcular, não é zero. */
  produzido: number | null
}

export function producaoDaObra(site: ConstructionSite | undefined, rdos: RDO[]): ProducaoDaObra {
  const services = site?.contrato?.services ?? []
  if (!site || services.length === 0) return { produzido: null }
  const medidoAuto = medidoAutoPorServico(rdos, site.id)
  // `medidoBruto`, não `medidoLiquido`: o desconto de NF de materiais é campo @deprecated do
  // contrato, e uma leitura nova não deveria herdar esse abatimento cego.
  return { produzido: totaisContrato(services, medidoAuto).medidoBruto }
}
