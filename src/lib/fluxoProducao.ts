import type {
  ItemEstoque,
  MovimentacaoEstoque,
  ClassificacaoABCXYZ,
  ClasseABC,
  ClasseXYZ,
  KanbanCard,
  SlottingSugestao,
  AlertaFEFO,
} from '@/types'

// ── ABC-XYZ Classification ───────────────────────────────────────────────────

export function calcularABCXYZ(
  itens: ItemEstoque[],
  movimentacoes: MovimentacaoEstoque[],
): ClassificacaoABCXYZ[] {
  if (itens.length === 0) return []

  // Group saida movements by itemId and by month (YYYY-MM)
  const saidasPorItem = new Map<string, Map<string, number>>()
  for (const mov of movimentacoes) {
    if (mov.tipo !== 'saida') continue
    const month = mov.dataMovimento.slice(0, 7)
    if (!saidasPorItem.has(mov.itemId)) saidasPorItem.set(mov.itemId, new Map())
    const itemMap = saidasPorItem.get(mov.itemId)!
    itemMap.set(month, (itemMap.get(month) ?? 0) + mov.quantidade)
  }

  // Calculate stats per item
  const itemStats: {
    item: ItemEstoque
    valorConsumo: number
    cv: number
    meanMonthly: number
  }[] = []

  for (const item of itens) {
    const monthlyMap = saidasPorItem.get(item.id)
    const monthlyValues = monthlyMap ? Array.from(monthlyMap.values()) : []

    // Ensure at least 1 month for calculation
    const numMonths = Math.max(monthlyValues.length, 1)
    const totalConsumo = monthlyValues.reduce((s, v) => s + v, 0)
    const meanMonthly = totalConsumo / numMonths

    // Standard deviation
    const variance =
      monthlyValues.length > 1
        ? monthlyValues.reduce((s, v) => s + (v - meanMonthly) ** 2, 0) / monthlyValues.length
        : 0
    const stdDev = Math.sqrt(variance)
    const cv = meanMonthly > 0 ? stdDev / meanMonthly : 0

    const custoUnit = item.custoUnitario ?? 0
    const valorConsumo = custoUnit * meanMonthly

    itemStats.push({ item, valorConsumo, cv, meanMonthly })
  }

  // Sort by valorConsumo descending for ABC
  const sorted = [...itemStats].sort((a, b) => b.valorConsumo - a.valorConsumo)
  const totalValor = sorted.reduce((s, x) => s + x.valorConsumo, 0)

  // ABC by cumulative value
  let cumulative = 0
  const abcMap = new Map<string, ClasseABC>()
  for (const stat of sorted) {
    cumulative += stat.valorConsumo
    const pct = totalValor > 0 ? cumulative / totalValor : 1
    if (pct <= 0.8) {
      abcMap.set(stat.item.id, 'A')
    } else if (pct <= 0.95) {
      abcMap.set(stat.item.id, 'B')
    } else {
      abcMap.set(stat.item.id, 'C')
    }
  }

  // Ensure at least some items in each class if there are enough items
  // (Pareto rule: top ~20% = A, next ~30% = B, bottom ~50% = C)
  // Already handled by cumulative value approach

  const results: ClassificacaoABCXYZ[] = []

  for (const stat of sorted) {
    const classeABC = abcMap.get(stat.item.id) ?? 'C'

    // XYZ by coefficient of variation
    let classeXYZ: ClasseXYZ
    if (stat.cv < 0.5) classeXYZ = 'X'
    else if (stat.cv < 1.0) classeXYZ = 'Y'
    else classeXYZ = 'Z'

    // Position suggestion based on ABC-XYZ matrix
    let posicaoSugerida: 'frente' | 'meio' | 'fundo'
    const combo = `${classeABC}${classeXYZ}`
    if (combo === 'AX' || combo === 'AY' || combo === 'BX') {
      posicaoSugerida = 'frente'
    } else if (combo === 'AZ' || combo === 'BY' || combo === 'CX') {
      posicaoSugerida = 'meio'
    } else {
      posicaoSugerida = 'fundo'
    }

    results.push({
      itemId: stat.item.id,
      classeABC,
      classeXYZ,
      valorConsumo: Math.round(stat.valorConsumo * 100) / 100,
      coeficienteVariacao: Math.round(stat.cv * 1000) / 1000,
      posicaoSugerida,
    })
  }

  return results
}

// ── Kanban Replenishment ─────────────────────────────────────────────────────

export function calcularKanban(
  itens: ItemEstoque[],
  movimentacoes: MovimentacaoEstoque[],
  leadTimeRecords: { fornecedor: string; leadTimeDias: number }[],
): KanbanCard[] {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)

  // Build a map of avg lead time per fornecedor
  const ltMap = new Map<string, number>()
  for (const lt of leadTimeRecords) {
    const existing = ltMap.get(lt.fornecedor)
    if (existing !== undefined) {
      ltMap.set(lt.fornecedor, (existing + lt.leadTimeDias) / 2)
    } else {
      ltMap.set(lt.fornecedor, lt.leadTimeDias)
    }
  }

  const cards: KanbanCard[] = []

  for (const item of itens) {
    // Total saida last 30 days
    const saidasRecentes = movimentacoes.filter(
      (m) => m.itemId === item.id && m.tipo === 'saida' && m.dataMovimento >= thirtyDaysAgo,
    )
    const totalSaida = saidasRecentes.reduce((s, m) => s + m.quantidade, 0)
    const consumoMedioDia = totalSaida / 30

    const fornecedor = item.fornecedorPrincipal ?? 'N/A'
    const leadTimeDias = ltMap.get(fornecedor) ?? 7

    const pontoPedido = consumoMedioDia * leadTimeDias * 1.2
    const diasEstoque = consumoMedioDia > 0 ? item.qtdDisponivel / consumoMedioDia : Infinity

    let status: KanbanCard['status']
    if (item.qtdDisponivel <= 0) {
      status = 'critico'
    } else if (item.qtdDisponivel <= pontoPedido) {
      status = 'atencao'
    } else if (item.estoqueMinimo > 0 && item.qtdDisponivel <= item.estoqueMinimo * 1.5) {
      status = 'atencao'
    } else {
      status = 'normal'
    }

    cards.push({
      id: `kb-${item.id}`,
      itemId: item.id,
      descricao: item.descricao,
      qtdAtual: item.qtdDisponivel,
      estoqueMinimo: item.estoqueMinimo,
      pontoPedido: Math.round(pontoPedido * 100) / 100,
      consumoMedioDia: Math.round(consumoMedioDia * 100) / 100,
      diasEstoque: diasEstoque === Infinity ? 999 : Math.round(diasEstoque),
      fornecedor,
      leadTimeDias,
      status,
      geradoEm: now.toISOString(),
    })
  }

  // Sort by severity then diasEstoque
  const statusOrder: Record<KanbanCard['status'], number> = {
    critico: 0,
    atencao: 1,
    pedido_gerado: 2,
    normal: 3,
  }

  cards.sort((a, b) => {
    const sd = statusOrder[a.status] - statusOrder[b.status]
    if (sd !== 0) return sd
    return a.diasEstoque - b.diasEstoque
  })

  return cards
}

// ── Dynamic Slotting ─────────────────────────────────────────────────────────

export function calcularSlotting(
  itens: ItemEstoque[],
  reservas: { itemId: string; semana: number; lpsActivityId?: string }[],
  semanaAtual: number,
): SlottingSugestao[] {
  const results: SlottingSugestao[] = []

  for (const item of itens) {
    // Find earliest reservation >= semanaAtual
    const reservasItem = reservas
      .filter((r) => r.itemId === item.id && r.semana >= semanaAtual)
      .sort((a, b) => a.semana - b.semana)

    const proximaReserva = reservasItem[0]
    const diasAteUso = proximaReserva
      ? (proximaReserva.semana - semanaAtual) * 7
      : 999

    let zonaSugerida: SlottingSugestao['zonaSugerida']
    let motivo: string

    if (diasAteUso <= 3) {
      zonaSugerida = 'zona_transbordo'
      motivo = `Uso em ${diasAteUso} dia(s) - encaminhar direto para frente de obra`
    } else if (diasAteUso <= 7) {
      zonaSugerida = 'prateleira_frente'
      motivo = `Uso em ${diasAteUso} dias - posicionar na frente para acesso rápido`
    } else if (diasAteUso <= 15) {
      zonaSugerida = 'prateleira_meio'
      motivo = `Uso em ${diasAteUso} dias - armazenamento intermediário`
    } else if (diasAteUso <= 30) {
      zonaSugerida = 'prateleira_fundo'
      motivo = `Uso em ${diasAteUso} dias - pode ficar no fundo`
    } else {
      zonaSugerida = 'area_remota'
      motivo = diasAteUso >= 999
        ? 'Sem reserva programada - área de armazenamento remoto'
        : `Uso em ${diasAteUso} dias - armazenamento de longo prazo`
    }

    // Assign current zone based on existing position (simulate random current zones)
    const zonaAtualOptions: SlottingSugestao['zonaSugerida'][] = [
      'zona_transbordo', 'prateleira_frente', 'prateleira_meio', 'prateleira_fundo', 'area_remota',
    ]
    // Use a deterministic hash from item id to pick a zone
    const hash = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const zonaAtual = zonaAtualOptions[hash % zonaAtualOptions.length]

    results.push({
      itemId: item.id,
      descricao: item.descricao,
      zonaAtual,
      zonaSugerida,
      diasAteUso,
      motivo,
    })
  }

  return results.sort((a, b) => a.diasAteUso - b.diasAteUso)
}

// ── FEFO Alerts ──────────────────────────────────────────────────────────────

export interface ItemComValidade {
  itemId: string
  descricao: string
  lote: string
  dataValidade: string
  qtdDisponivel: number
}

export function calcularFEFO(
  itensComValidade: ItemComValidade[],
  hoje: string = new Date().toISOString().slice(0, 10),
): AlertaFEFO[] {
  const hojeMs = new Date(hoje).getTime()

  const alerts: AlertaFEFO[] = itensComValidade.map((item) => {
    const validadeMs = new Date(item.dataValidade).getTime()
    const diasRestantes = Math.floor((validadeMs - hojeMs) / 86400000)

    let severidade: AlertaFEFO['severidade']
    if (diasRestantes <= 0) severidade = 'vencido'
    else if (diasRestantes <= 7) severidade = 'urgente'
    else if (diasRestantes <= 30) severidade = 'atencao'
    else severidade = 'ok'

    return {
      id: `fefo-${item.itemId}-${item.lote}`,
      itemId: item.itemId,
      descricao: item.descricao,
      lote: item.lote,
      dataValidade: item.dataValidade,
      diasRestantes,
      qtdDisponivel: item.qtdDisponivel,
      severidade,
    }
  })

  return alerts.sort((a, b) => a.diasRestantes - b.diasRestantes)
}
