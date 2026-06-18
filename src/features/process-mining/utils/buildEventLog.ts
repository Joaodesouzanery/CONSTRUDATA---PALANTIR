import { useRdoStore } from '@/store/rdoStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useTorreStore } from '@/store/torreDeControleStore'

export type ProcessEvent = {
  id: string
  timestamp: string
  tipo: 'rdo' | 'timecard' | 'entrada_financeira' | 'saida_financeira' | 'movimentacao_estoque'
  obraId?: string
  obraName?: string
  actor?: string
  descricao: string
  valor?: number
}

export function buildEventLog(): ProcessEvent[] {
  const events: ProcessEvent[] = []

  const rdos = useRdoStore.getState().rdos ?? []
  const { timecards = [], workers = [] } = useMaoDeObraStore.getState()
  const entries = useFinanceiroStore.getState().entries ?? []
  const { movimentacoes = [], estoqueItens = [] } = useSuprimentosStore.getState()
  const sites = useTorreStore.getState().sites ?? []

  const siteMap = new Map(sites.map((s) => [s.id, s.name]))
  const itemMap = new Map(estoqueItens.map((i) => [i.id, i.descricao]))

  rdos.forEach((rdo, i) => {
    events.push({
      id: `rdo-${i}`,
      timestamp: rdo.date ?? '',
      tipo: 'rdo',
      // RDO type has no obraId; use local field if present
      obraId: (rdo as unknown as { obraId?: string }).obraId,
      obraName: (rdo as unknown as { obraId?: string }).obraId
        ? siteMap.get((rdo as unknown as { obraId?: string }).obraId!)
        : undefined,
      descricao: `RDO registrado${rdo.title ? ` (${rdo.title})` : ''}`,
    })
  })

  timecards.forEach((tc, i) => {
    const worker = workers.find((w) => w.id === tc.workerId)
    events.push({
      id: `tc-${tc.id ?? i}`,
      timestamp: tc.date ?? '',
      tipo: 'timecard',
      actor: worker?.name,
      descricao: `Timecard registrado${worker ? ` por ${worker.name}` : ''}`,
    })
  })

  entries.forEach((entry, i) => {
    events.push({
      id: `fin-${entry.id ?? i}`,
      // FinanceiroEntry uses `data` field (not `date`)
      timestamp: entry.data ?? '',
      tipo: entry.tipo === 'entrada' ? 'entrada_financeira' : 'saida_financeira',
      obraId: entry.obraId,
      obraName: entry.obraId ? siteMap.get(entry.obraId) : undefined,
      descricao: `${entry.tipo === 'entrada' ? 'Entrada' : 'Saída'} financeira${entry.categoria ? ` - ${entry.categoria}` : ''}`,
      valor: entry.valor,
    })
  })

  movimentacoes.forEach((mov, i) => {
    const itemName = itemMap.get(mov.itemId) ?? mov.itemId ?? 'item'
    events.push({
      id: `mov-${mov.id ?? i}`,
      // MovimentacaoEstoque uses `dataMovimento` (not `data`)
      timestamp: mov.dataMovimento ?? '',
      tipo: 'movimentacao_estoque',
      descricao: `${mov.tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${itemName} (qtd: ${mov.quantidade ?? 0})`,
    })
  })

  return events.filter((e) => e.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
