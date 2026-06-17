import { ProcessEvent } from './buildEventLog'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export interface Anomalia {
  id: string
  tipo: 'semana_sem_rdo' | 'gap_medicao' | 'material_sem_uso'
  severidade: 'critical' | 'warning' | 'info'
  titulo: string
  descricao: string
  obraId?: string
  obraName?: string
}

export function detectAnomalias(
  events: ProcessEvent[],
  sites: { id: string; name: string }[]
): Anomalia[] {
  const anomalias: Anomalia[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // semana_sem_rdo: site had RDOs but none in last 7 days
  for (const site of sites) {
    const siteRdos = events.filter((e) => e.tipo === 'rdo' && e.obraId === site.id)
    if (siteRdos.length === 0) continue
    const recentRdo = siteRdos.find((e) => new Date(e.timestamp) >= sevenDaysAgo)
    if (!recentRdo) {
      anomalias.push({
        id: `semana_sem_rdo-${site.id}`,
        tipo: 'semana_sem_rdo',
        severidade: 'critical',
        titulo: 'Obra sem RDO há mais de 7 dias',
        descricao: `A obra ${site.name} não possui RDO registrado nos últimos 7 dias.`,
        obraId: site.id,
        obraName: site.name,
      })
    }
  }

  // gap_medicao: financial entries, last one >30 days ago
  const medicaoEntries = events.filter(
    (e) =>
      e.tipo === 'entrada_financeira' ||
      (e.tipo === 'saida_financeira' && e.descricao.toLowerCase().includes('medicao'))
  )
  if (medicaoEntries.length > 1) {
    const sorted = [...medicaoEntries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const last = sorted[0]
    if (new Date(last.timestamp) < thirtyDaysAgo) {
      anomalias.push({
        id: 'gap_medicao-global',
        tipo: 'gap_medicao',
        severidade: 'warning',
        titulo: 'Gap em medições financeiras',
        descricao: `Última medição financeira registrada em ${last.timestamp}. Mais de 30 dias sem nova medição.`,
      })
    }
  }

  // material_sem_uso: supply entry with no corresponding saida in last 30 days
  const { movimentacoes = [], estoqueItens = [] } = useSuprimentosStore.getState()
  const itemMap = new Map(estoqueItens.map((i) => [i.id, i.descricao]))

  const entradaItemIds = new Set(
    movimentacoes
      .filter((m) => m.tipo === 'entrada' && m.dataMovimento && new Date(m.dataMovimento) >= thirtyDaysAgo)
      .map((m) => m.itemId)
  )
  const saidaItemIds = new Set(
    movimentacoes
      .filter((m) => m.tipo === 'saida' && m.dataMovimento && new Date(m.dataMovimento) >= thirtyDaysAgo)
      .map((m) => m.itemId)
  )

  for (const itemId of entradaItemIds) {
    if (!saidaItemIds.has(itemId)) {
      const itemName = itemMap.get(itemId) ?? itemId
      anomalias.push({
        id: `material_sem_uso-${itemId}`,
        tipo: 'material_sem_uso',
        severidade: 'info',
        titulo: 'Material sem saída registrada',
        descricao: `O item "${itemName}" teve entrada nos últimos 30 dias mas não possui saída registrada no mesmo período.`,
      })
    }
  }

  return anomalias
}
