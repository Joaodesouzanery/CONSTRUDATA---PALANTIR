/**
 * custoLedger.ts — o razão de custos de um projeto, montado a partir de todos os módulos.
 *
 * ─── POR QUE SAIU DO COMPONENTE ───────────────────────────────────────────────────────────────
 * Eram ~290 linhas de conta dentro de um `.tsx` de 700, e por isso não davam para testar: a dupla
 * contagem que este arquivo conserta só aparece quando se somam DOIS projetos, e na tela de uma
 * obra só o número parece certo. Aqui é função pura — recebe o projeto, lê os stores, devolve as
 * linhas — e a conta pode ser conferida num teste de mesa.
 */
import type { BudgetLineType, Project } from '@/types'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useRdoStore } from '@/store/rdoStore'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useEvmStore } from '@/store/evmStore'
import { custoDaEquipeDoRdo, custoDoEquipamentoNoRdo } from './tarifaDoRdo'

export const LINE_META: Record<BudgetLineType, { label: string; color: string }> = {
  labor: { label: 'Mao de Obra', color: '#3b82f6' },
  equipment: { label: 'Equipamentos', color: '#f97316' },
  materials: { label: 'Materiais', color: '#22c55e' },
  subcontract: { label: 'Subcontratos', color: '#a855f7' },
  overhead: { label: 'Overhead', color: '#eab308' },
  other: { label: 'Outros', color: '#6b6b6b' },
}

export type LedgerType = 'actual' | 'committed' | 'earned' | 'baseline'

export interface CostLedgerEntry {
  id: string
  date: string
  module: string
  projectRef: string
  nucleo: string
  type: LedgerType
  category: BudgetLineType
  description: string
  amountBRL: number
  basis: string
  /**
   * ⚠️ `true` quando o valor NÃO é medição — veio de tarifa de referência, não de nota, contrato
   * ou cadastro. A tela e o PDF marcam essas linhas; somá-las com as medidas sem dizer nada foi o
   * defeito que este campo existe para impedir.
   */
  estimado?: boolean
}

const toCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Neutraliza os caracteres que teriam significado dentro de uma expressão regular. */
function escaparRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * O registro pertence a este projeto?
 *
 * Era `text.includes(normalize(value))`: `"OBRA-1"` casava com `"OBRA-10"`, `"OBRA-11"` e assim
 * por diante — o custo da obra 10 entrava na conta da obra 1. Agora a comparação é exata; para
 * continuar aceitando referências escritas à mão ("Obra 1 - bloco B"), a única folga é a
 * pontuação/caixa que `normalize` já tira, mais um casamento de palavra inteira.
 */
export function matchesProject(project: Project, ref?: string | null, includeUnscoped = true) {
  if (!ref) return includeUnscoped
  const text = normalize(ref)
  const chaves = [project.id, project.code, project.name].filter(Boolean).map((v) => normalize(v as string))
  if (chaves.some((k) => k && text === k)) return true
  // Fronteira de caractere, não `includes` nem "palavra inteira": partir o texto em palavras
  // quebraria o hífen do próprio código ("obra-1" viraria "obra" + "1"), e um nome de obra tem
  // vários espaços ("Morro do Tetéu"). Aqui a chave só casa quando o que vem antes e depois dela
  // NÃO é letra nem número — então "obra-1" casa em "obra-1 - bloco b" e não casa em "obra-10".
  return chaves.some((k) => k && new RegExp(`(^|[^a-z0-9])${escaparRegex(k)}([^a-z0-9]|$)`, 'i').test(text))
}

/**
 * A obra por trás de um projeto, quando existe.
 *
 * Projetos criados a partir de uma obra recebem o id `site:<uuid>` (ver `siteProjects.ts`), que é
 * o único elo confiável entre o projeto e o `siteId` que os outros módulos gravam.
 */
function obraDoProjeto(project: Project): string | null {
  return project.id.startsWith('site:') ? project.id.slice('site:'.length) : null
}

function addEntry(entries: CostLedgerEntry[], entry: CostLedgerEntry) {
  if (!Number.isFinite(entry.amountBRL)) return
  entries.push(entry)
}

/**
 * O razão de custos de um projeto.
 *
 * ─── A DUPLA CONTAGEM ─────────────────────────────────────────────────────────────────────────
 * Três fontes eram percorridas SEM filtro de projeto — consumo de estoque, lançamentos financeiros
 * do RDO e ordens de manutenção. Como o chamador faz `scopeProjects.flatMap(buildLedger)`, com oito
 * obras no escopo o mesmo custo entrava OITO vezes. O total de "Todos os projetos" não era a soma
 * das obras: era a soma das obras vezes o número de obras.
 *
 * Agora: quando o projeto tem obra (`site:<uuid>`), essas fontes são filtradas por `siteId`; quando
 * não tem — projeto sem obra vinculada, ou fonte que não guarda obra —, elas entram UMA vez só, no
 * projeto marcado com `incluirGlobais`. O número deixa de crescer com a quantidade de obras.
 */
// Exportada para o teste de mesa: a dupla contagem só aparece quando se soma DOIS projetos, e
// isso não dá para conferir olhando a tela.
export function buildLedger(
  project: Project,
  options: { includeUnscoped?: boolean; includeEvm?: boolean; incluirGlobais?: boolean } = {},
): CostLedgerEntry[] {
  const entries: CostLedgerEntry[] = []
  const includeUnscoped = options.includeUnscoped ?? true
  const includeEvm = options.includeEvm ?? true
  const siteId = obraDoProjeto(project)
  // Sem obra para filtrar, a fonte só entra no projeto eleito — senão multiplica.
  const incluirGlobais = options.incluirGlobais ?? true
  const todayIso = new Date().toISOString().slice(0, 10)
  const mao = useMaoDeObraStore.getState()
  const equipamentos = useGestaoEquipamentosStore.getState()
  const suprimentos = useSuprimentosStore.getState()
  const rdo = useRdoStore.getState()
  const medicao = useMedicaoStore.getState()
  const evm = useEvmStore.getState()
  const workersById = new Map(mao.workers.map((worker) => [worker.id, worker]))
  const estoqueById = new Map(suprimentos.estoqueItens.map((item) => [item.id, item]))
  const poById = new Map(suprimentos.purchaseOrders.map((po) => [po.id, po]))

  for (const line of project.budgetLines) {
    addEntry(entries, {
      id: `budget-${line.id}`,
      date: project.startDate,
      module: 'Projetos/Nucleos',
      projectRef: project.code,
      nucleo: project.name,
      type: 'baseline',
      category: line.type,
      description: `Orcamento base - ${LINE_META[line.type]?.label ?? line.type}`,
      amountBRL: line.budgeted,
      basis: 'Orçamento planejado do projeto/nucleo',
    })
  }

  for (const timecard of mao.timecards) {
    if (!matchesProject(project, timecard.projectRef, includeUnscoped)) continue
    const worker = workersById.get(timecard.workerId)
    const amount = timecard.hoursWorked * (worker?.hourlyRate ?? 0)
    if (amount <= 0) continue
    addEntry(entries, {
      id: `timecard-${timecard.id}`,
      date: timecard.date,
      module: 'Mao de Obra',
      projectRef: timecard.projectRef,
      nucleo: timecard.phaseRef || worker?.workFront || project.name,
      type: 'actual',
      category: 'labor',
      description: `${worker?.name ?? 'Trabalhador'} - ${timecard.activityDescription}`,
      amountBRL: amount,
      basis: `${timecard.hoursWorked}h x ${toCurrency(worker?.hourlyRate ?? 0)}/h`,
    })
  }

  for (const po of suprimentos.purchaseOrders) {
    if (!matchesProject(project, po.projectRef, includeUnscoped)) continue
    const amount = po.items.reduce((sum, item) => sum + item.totalPrice, 0)
    addEntry(entries, {
      id: `po-${po.id}`,
      date: po.issuedDate,
      module: 'Suprimentos',
      projectRef: po.projectRef ?? project.code,
      nucleo: po.projectRef ?? project.name,
      type: po.status === 'closed' ? 'actual' : 'committed',
      category: 'materials',
      description: `OC ${po.code} - ${po.supplier}`,
      amountBRL: amount,
      basis: 'Soma dos itens da ordem de compra',
    })
  }

  for (const invoice of suprimentos.invoices) {
    const po = poById.get(invoice.poId)
    if (!matchesProject(project, po?.projectRef, includeUnscoped)) continue
    addEntry(entries, {
      id: `nf-${invoice.id}`,
      date: invoice.issueDate,
      module: 'Financeiro/EVM',
      projectRef: po?.projectRef ?? project.code,
      nucleo: po?.projectRef ?? project.name,
      type: invoice.status === 'approved' || invoice.status === 'pre_approved' ? 'actual' : 'committed',
      category: 'materials',
      description: `NF ${invoice.number} - ${invoice.supplier}`,
      amountBRL: invoice.totalAmount,
      basis: 'Valor total da nota fiscal vinculada ao three-way match',
    })
  }

  for (const receipt of suprimentos.receipts) {
    const po = poById.get(receipt.poId)
    if (!matchesProject(project, po?.projectRef, includeUnscoped)) continue
    addEntry(entries, {
      id: `receipt-${receipt.id}`,
      date: receipt.receivedDate,
      module: 'Almoxarifado',
      projectRef: po?.projectRef ?? project.code,
      nucleo: po?.projectRef ?? project.name,
      type: 'earned',
      category: 'materials',
      description: `Recebimento ${receipt.code}`,
      amountBRL: 0,
      basis: 'Evento fisico de recebimento; custo reconhecido pela OC/NF',
    })
  }

  for (const mov of suprimentos.movimentacoes) {
    if (mov.tipo !== 'saida') continue
    const obraDaMov = mov.siteId ?? estoqueById.get(mov.itemId)?.siteId ?? null
    if (siteId ? obraDaMov !== siteId : (obraDaMov ? true : !incluirGlobais)) continue
    const item = estoqueById.get(mov.itemId)
    // O custo congelado na movimentação vence: o custo atual do item reescreve o histórico
    // sempre que alguém muda o preço de um produto.
    const amount = mov.quantidade * (mov.custoUnitario ?? item?.custoUnitario ?? 0)
    if (amount <= 0) continue
    addEntry(entries, {
      id: `estoque-${mov.id}`,
      date: mov.dataMovimento,
      module: 'Almoxarifado',
      projectRef: project.code,
      nucleo: item?.lpsActivityId ?? project.name,
      type: 'actual',
      category: 'materials',
      description: `Consumo de estoque - ${item?.descricao ?? mov.itemId}`,
      amountBRL: amount,
      basis: `${mov.quantidade} ${item?.unidade ?? ''} x custo medio`,
    })
  }

  for (const entry of rdo.financialEntries) {
    // `RdoFinancialEntry` não guarda obra. Entra uma vez, no projeto eleito.
    if (!incluirGlobais) break
    addEntry(entries, {
      id: `rdo-fin-${entry.id}`,
      date: entry.date,
      module: 'RDO',
      projectRef: project.code,
      nucleo: project.name,
      type: 'actual',
      category: entry.type === 'revenue' ? 'other' : 'subcontract',
      description: entry.description,
      amountBRL: entry.type === 'revenue' ? -entry.valueBRL : entry.valueBRL,
      basis: `Lancamento financeiro RDO - ${entry.category}`,
    })
  }

  for (const report of rdo.rdos) {
    const reportProject = (report as { projectId?: string | null }).projectId
    if (!matchesProject(project, reportProject ?? report.local, includeUnscoped)) continue
    // ⚠️ Aqui havia R$ 65/48/34/58 por função e R$ 180/h de equipamento, chumbados no código —
    // números que não eram o `hourlyRate` de ninguém, não eram configuráveis, não apareciam em
    // tela, e iam para o PDF da reunião misturados com valor de nota fiscal. Agora `tarifaDoRdo`
    // usa o cadastro quando ele existe e MARCA o que sobrou como referência.
    const equipe = custoDaEquipeDoRdo(report.manpower, mao.workers)
    if (equipe.valorBRL > 0) {
      addEntry(entries, {
        id: `rdo-labor-${report.id}`,
        date: report.date,
        module: 'RDO',
        projectRef: reportProject ?? project.code,
        nucleo: report.local ?? project.name,
        type: 'actual',
        category: 'labor',
        description: `Equipe RDO ${report.number}`,
        amountBRL: equipe.valorBRL,
        basis: equipe.base,
        estimado: equipe.estimado,
      })
    }
    for (const equip of report.equipment) {
      const custo = custoDoEquipamentoNoRdo(equip.quantity, equip.hours)
      if (custo.valorBRL <= 0) continue
      addEntry(entries, {
        id: `rdo-eq-${report.id}-${equip.id}`,
        date: report.date,
        module: 'RDO',
        projectRef: reportProject ?? project.code,
        nucleo: report.local ?? project.name,
        type: 'actual',
        category: 'equipment',
        description: `${equip.name} no RDO ${report.number}`,
        amountBRL: custo.valorBRL,
        basis: custo.base,
        estimado: custo.estimado,
      })
    }
  }

  for (const order of equipamentos.orders) {
    // `MaintenanceOrder` não guarda obra. Idem.
    if (!incluirGlobais) break
    const amount = order.actualCost ?? order.estimatedCost
    if (amount <= 0) continue
    addEntry(entries, {
      id: `eq-order-${order.id}`,
      date: order.completedDate ?? order.scheduledDate,
      module: 'Equipamentos',
      projectRef: project.code,
      nucleo: project.name,
      type: order.status === 'completed' ? 'actual' : 'committed',
      category: 'equipment',
      description: `${order.description} - ${order.equipmentId}`,
      amountBRL: amount,
      basis: order.actualCost ? 'Custo real da OS de manutencao' : 'Custo estimado da OS de manutencao',
    })
  }

  const medicaoKpis = medicao.getGlobalKpis()
  if (medicaoKpis.kmExec > 0) {
    addEntry(entries, {
      id: 'medicao-progress',
      date: todayIso,
      module: 'Medicao',
      projectRef: project.code,
      nucleo: project.name,
      type: 'earned',
      category: 'other',
      description: `Avanco fisico medido: ${medicaoKpis.kmExec.toLocaleString('pt-BR')} km executados`,
      amountBRL: 0,
      basis: 'Evento de avanco fisico; alimenta EV/SPI sem duplicar custo',
    })
  }

  if (includeEvm && evm.evmMetrics.AC > 0) {
    addEntry(entries, {
      id: 'evm-ac',
      date: todayIso,
      module: 'Financeiro/EVM',
      projectRef: project.code,
      nucleo: project.name,
      type: 'actual',
      category: 'other',
      description: 'AC consolidado pelo EVM',
      amountBRL: evm.evmMetrics.AC,
      basis: 'Custo real consolidado do modulo Financeiro/EVM',
    })
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}


/**
 * Quanto do razão é estimativa, e não medição.
 *
 * ⚠️ A tela precisa disso para não apresentar um total como se fosse tudo medido. A regra do
 * produto, que o Economia já segue: **estimado pode aparecer, desde que apareça como estimado.**
 */
export function quantoEhEstimado(entries: CostLedgerEntry[]): { valorBRL: number; linhas: number; fracao: number } {
  const soDeCusto = entries.filter((e) => e.type === 'actual')
  const total = soDeCusto.reduce((s, e) => s + e.amountBRL, 0)
  const estimadas = soDeCusto.filter((e) => e.estimado)
  const valorBRL = estimadas.reduce((s, e) => s + e.amountBRL, 0)
  return { valorBRL, linhas: estimadas.length, fracao: total > 0 ? valorBRL / total : 0 }
}
