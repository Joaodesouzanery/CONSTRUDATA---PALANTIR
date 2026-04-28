import { Link } from 'react-router-dom'
import { BookOpen, ExternalLink, ReceiptText } from 'lucide-react'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useThemeStore } from '@/store/themeStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useRdoStore } from '@/store/rdoStore'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useEvmStore } from '@/store/evmStore'
import type { BudgetLineType, Project } from '@/types'

const LINE_META: Record<BudgetLineType, { label: string; color: string }> = {
  labor: { label: 'Mao de Obra', color: '#3b82f6' },
  equipment: { label: 'Equipamentos', color: '#f97316' },
  materials: { label: 'Materiais', color: '#22c55e' },
  subcontract: { label: 'Subcontratos', color: '#a855f7' },
  overhead: { label: 'Overhead', color: '#eab308' },
  other: { label: 'Outros', color: '#6b6b6b' },
}

const PHASE_STATUS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Nao iniciada', color: '#6b6b6b' },
  in_progress: { label: 'Em andamento', color: '#3b82f6' },
  completed: { label: 'Concluida', color: '#22c55e' },
  delayed: { label: 'Atrasada', color: '#ef4444' },
}

type LedgerType = 'actual' | 'committed' | 'earned' | 'baseline'

interface CostLedgerEntry {
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
}

function IndexGauge({ value, label }: { value: number; label: string }) {
  const isDark = useThemeStore((s) => s.theme === 'dark')
  const color = value >= 0.9 ? '#22c55e' : value >= 0.7 ? '#eab308' : '#ef4444'
  const track = isDark ? '#525252' : '#e5e8ed'
  const textC = isDark ? '#f5f5f5' : '#1a1d23'
  const clamped = Math.min(1.5, Math.max(0, value))
  const r = 28
  const cx = 36
  const cy = 36
  const circ = 2 * Math.PI * r
  const filled = Math.min(clamped, 1) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth="7" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={textC} fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
          {value.toFixed(2)}
        </text>
      </svg>
      <span className="text-[#6b6b6b] text-[11px] font-medium">{label}</span>
      <span className="text-xs font-bold" style={{ color }}>
        {value >= 0.9 ? 'Bom' : value >= 0.7 ? 'Atencao' : 'Critico'}
      </span>
    </div>
  )
}

function BudgetBar({ type, budgeted, spent, projected }: { type: BudgetLineType; budgeted: number; spent: number; projected: number }) {
  const meta = LINE_META[type] ?? LINE_META.other
  const max = Math.max(budgeted, projected, spent, 1)
  const budgetedW = (budgeted / max) * 100
  const spentW = (spent / max) * 100
  const projectedW = (projected / max) * 100
  const isOver = projected > budgeted

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-[#6b6b6b] text-xs shrink-0 text-right truncate">{meta.label}</span>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-10 text-[#6b6b6b] text-[10px] shrink-0">Orc.</div>
          <div className="flex-1 h-3 bg-[#2c2c2c] rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${budgetedW}%`, backgroundColor: meta.color, opacity: 0.4 }} />
          </div>
          <span className="w-16 text-[#6b6b6b] text-[10px] font-mono text-right">R${(budgeted / 1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 text-[#6b6b6b] text-[10px] shrink-0">Real.</div>
          <div className="flex-1 h-3 bg-[#2c2c2c] rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${spentW}%`, backgroundColor: meta.color }} />
          </div>
          <span className="w-16 text-[#f5f5f5] text-[10px] font-mono text-right font-semibold">R${(spent / 1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 text-[#6b6b6b] text-[10px] shrink-0">EAC</div>
          <div className="flex-1 h-3 bg-[#2c2c2c] rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${projectedW}%`, backgroundColor: isOver ? '#ef4444' : '#22c55e', opacity: 0.7 }} />
          </div>
          <span className="w-16 text-[10px] font-mono text-right font-semibold" style={{ color: isOver ? '#ef4444' : '#22c55e' }}>
            R${(projected / 1000).toFixed(0)}k
          </span>
        </div>
      </div>
    </div>
  )
}

function toCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function matchesProject(project: Project, ref?: string | null, includeUnscoped = true) {
  if (!ref) return includeUnscoped
  const text = normalize(ref)
  return [project.id, project.code, project.name].some((value) => value && text.includes(normalize(value)))
}

function addEntry(entries: CostLedgerEntry[], entry: CostLedgerEntry) {
  if (!Number.isFinite(entry.amountBRL)) return
  entries.push(entry)
}

function buildLedger(project: Project, options: { includeUnscoped?: boolean; includeEvm?: boolean } = {}): CostLedgerEntry[] {
  const entries: CostLedgerEntry[] = []
  const includeUnscoped = options.includeUnscoped ?? true
  const includeEvm = options.includeEvm ?? true
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
      basis: 'BAC do projeto/nucleo',
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
    const item = estoqueById.get(mov.itemId)
    const amount = mov.quantidade * (item?.custoUnitario ?? 0)
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
    const manpowerAmount =
      report.manpower.foremanCount * 8 * 65 +
      report.manpower.officialCount * 8 * 48 +
      report.manpower.helperCount * 8 * 34 +
      report.manpower.operatorCount * 8 * 58
    if (manpowerAmount > 0) {
      addEntry(entries, {
        id: `rdo-labor-${report.id}`,
        date: report.date,
        module: 'RDO',
        projectRef: reportProject ?? project.code,
        nucleo: report.local ?? project.name,
        type: 'actual',
        category: 'labor',
        description: `Equipe RDO ${report.number}`,
        amountBRL: manpowerAmount,
        basis: 'Equipe diaria x 8h x tarifa padrao por funcao',
      })
    }
    for (const equip of report.equipment) {
      const amount = equip.quantity * equip.hours * 180
      if (amount <= 0) continue
      addEntry(entries, {
        id: `rdo-eq-${report.id}-${equip.id}`,
        date: report.date,
        module: 'RDO',
        projectRef: reportProject ?? project.code,
        nucleo: report.local ?? project.name,
        type: 'actual',
        category: 'equipment',
        description: `${equip.name} no RDO ${report.number}`,
        amountBRL: amount,
        basis: `${equip.quantity} un x ${equip.hours}h x tarifa referencia`,
      })
    }
  }

  for (const order of equipamentos.orders) {
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

function aggregateBudgetLines(projects: Project[]) {
  const byType = new Map<BudgetLineType, Project['budgetLines'][number]>()
  for (const project of projects) {
    for (const line of project.budgetLines) {
      const current = byType.get(line.type)
      if (!current) {
        byType.set(line.type, { ...line, id: `agg-${line.type}`, description: LINE_META[line.type]?.label ?? line.description })
      } else {
        byType.set(line.type, {
          ...current,
          budgeted: current.budgeted + line.budgeted,
          spent:    current.spent + line.spent,
          projected: current.projected + line.projected,
        })
      }
    }
  }
  return Array.from(byType.values())
}

export function JobCostingPanel() {
  const selectedProjectId = useGestao360Store((s) => s.selectedProjectId)
  const projects = useProjetosStore((s) => s.projects)
  useMaoDeObraStore()
  useGestaoEquipamentosStore()
  useSuprimentosStore()
  useRdoStore()
  useMedicaoStore()
  useEvmStore()

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null
  const scopeProjects = selectedProject ? [selectedProject] : projects
  const scopeLabel = selectedProject ? selectedProject.name : 'Todos os projetos/nucleos'
  const ledger = scopeProjects.flatMap((project, index) => buildLedger(project, {
    includeUnscoped: selectedProject ? true : index === 0,
    includeEvm:      selectedProject ? true : index === 0,
  })).sort((a, b) => b.date.localeCompare(a.date))

  if (scopeProjects.length === 0) {
    return (
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-8 text-center">
        <p className="text-[#6b6b6b] text-sm">Selecione um projeto para ver o custo em tempo real.</p>
      </div>
    )
  }

  const lines = aggregateBudgetLines(scopeProjects)
  const budgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const actualCost = ledger.filter((e) => e.type === 'actual').reduce((sum, item) => sum + item.amountBRL, 0)
  const committedCost = ledger.filter((e) => e.type === 'committed').reduce((sum, item) => sum + item.amountBRL, 0)
  const earnedEvents = ledger.filter((e) => e.type === 'earned').length
  const spent = actualCost > 0 ? actualCost : lines.reduce((s, l) => s + l.spent, 0)
  const remainingBudget = Math.max(0, budgeted - spent)
  const eac = Math.max(lines.reduce((s, l) => s + l.projected, 0), spent + committedCost + remainingBudget * 0.35)
  const variance = eac - budgeted
  const variancePct = budgeted > 0 ? (variance / budgeted) * 100 : 0

  const actualByCategory = ledger
    .filter((entry) => entry.type === 'actual')
    .reduce<Record<BudgetLineType, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + entry.amountBRL
      return acc
    }, { labor: 0, equipment: 0, materials: 0, subcontract: 0, overhead: 0, other: 0 })
  const committedByCategory = ledger
    .filter((entry) => entry.type === 'committed')
    .reduce<Record<BudgetLineType, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + entry.amountBRL
      return acc
    }, { labor: 0, equipment: 0, materials: 0, subcontract: 0, overhead: 0, other: 0 })
  const liveLines = lines.map((line) => {
    const lineSpent = actualByCategory[line.type] > 0 ? actualByCategory[line.type] : line.spent
    const lineProjected = Math.max(line.projected, lineSpent + committedByCategory[line.type])
    return { ...line, spent: lineSpent, projected: lineProjected }
  })

  const execPhases = scopeProjects.flatMap((project) => project.executionPhases)
  const avgProgress = execPhases.length ? execPhases.reduce((s, p) => s + p.progress, 0) / execPhases.length : 0
  const today = new Date()
  const start = new Date(Math.min(...scopeProjects.map((project) => new Date(project.startDate + 'T00:00:00').getTime())))
  const end = new Date(Math.max(...scopeProjects.map((project) => new Date(project.endDate + 'T00:00:00').getTime())))
  const totalMs = Math.max(1, end.getTime() - start.getTime())
  const elapsedMs = Math.min(totalMs, Math.max(0, today.getTime() - start.getTime()))
  const plannedPct = (elapsedMs / totalMs) * 100
  const spi = plannedPct > 0 ? avgProgress / plannedPct : 1
  const cpi = spent > 0 ? (budgeted * (avgProgress / 100)) / spent : 1
  const allPhases = scopeProjects.flatMap((project) => [
    ...project.planningPhases.map((phase) => ({ ...phase, name: `${project.code} - ${phase.name}` })),
    ...project.executionPhases.map((phase) => ({ ...phase, name: `${project.code} - ${phase.name}` })),
  ])
  const modulesInLedger = Array.from(new Set(ledger.map((entry) => entry.module)))

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Orcado (BAC)', value: `R$${(budgeted / 1_000_000).toFixed(2)}M`, color: '#6b6b6b' },
          { label: 'Realizado (AC)', value: `R$${(spent / 1_000_000).toFixed(2)}M`, color: '#3b82f6' },
          { label: 'Comprometido', value: `R$${(committedCost / 1_000_000).toFixed(2)}M`, color: '#f97316' },
          {
            label: 'EAC / Variacao',
            value: `${(eac / 1_000_000).toFixed(2)}M (${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%)`,
            color: Math.abs(variancePct) <= 5 ? '#22c55e' : Math.abs(variancePct) <= 15 ? '#eab308' : '#ef4444',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-3">
            <p className="text-[#6b6b6b] text-xs">{kpi.label}</p>
            <p className="text-xl font-bold leading-tight mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#f97316]" />
            <p className="text-[#f5f5f5] text-sm font-semibold">Livro razao de custo</p>
          </div>
          <p className="mt-1 text-[#a3a3a3] text-xs">
            {scopeLabel} atualizado por evento: apontamento, recebimento, NF, consumo, medicao, RDO e avanco fisico.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {modulesInLedger.map((module) => (
              <span key={module} className="rounded-full border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[10px] text-[#a3a3a3]">
                {module}
              </span>
            ))}
            {modulesInLedger.length === 0 && (
              <span className="rounded-full border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[10px] text-[#6b6b6b]">
                Sem eventos ainda
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ReceiptText size={16} className="text-[#22c55e]" />
            <p className="text-[#f5f5f5] text-sm font-semibold">Eventos de custo</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-[#2c2c2c] p-2">
              <p className="text-[10px] text-[#6b6b6b]">Reais</p>
              <p className="text-sm font-bold text-[#f5f5f5]">{ledger.filter((e) => e.type === 'actual').length}</p>
            </div>
            <div className="rounded-lg bg-[#2c2c2c] p-2">
              <p className="text-[10px] text-[#6b6b6b]">Comprom.</p>
              <p className="text-sm font-bold text-[#f5f5f5]">{ledger.filter((e) => e.type === 'committed').length}</p>
            </div>
            <div className="rounded-lg bg-[#2c2c2c] p-2">
              <p className="text-[10px] text-[#6b6b6b]">Fisicos</p>
              <p className="text-sm font-bold text-[#f5f5f5]">{earnedEvents}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
          <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Custo por Categoria</p>
          <div className="flex flex-col gap-3">
            {liveLines.map((l) => (
              <BudgetBar key={l.id} type={l.type} budgeted={l.budgeted} spent={l.spent} projected={l.projected} />
            ))}
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-[#525252]">
            {[
              { label: 'Orcado', color: '#6b6b6b', opacity: 0.4 },
              { label: 'Realizado', color: '#f97316', opacity: 1 },
              { label: 'EAC', color: '#22c55e', opacity: 0.7 },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded" style={{ backgroundColor: l.color, opacity: l.opacity }} />
                <span className="text-[#6b6b6b] text-[10px]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col">
          <p className="text-[#f5f5f5] text-sm font-semibold mb-4">Indices de Desempenho</p>
          <div className="flex gap-4 justify-center flex-1 items-center">
            <IndexGauge value={cpi} label="CPI (Custo)" />
            <IndexGauge value={spi} label="SPI (Prazo)" />
          </div>
          <p className="text-[#6b6b6b] text-[10px] text-center mt-3">
            CPI usa EV/AC com AC vindo do livro razao; SPI usa avanco fisico planejado x real.
          </p>
        </div>
      </div>

      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#525252] px-4 py-3">
          <p className="text-[#f5f5f5] text-sm font-semibold">Eventos do Livro Razao</p>
          <span className="text-[10px] text-[#6b6b6b]">{ledger.length} lancamento(s)</span>
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead className="sticky top-0 bg-[#484848]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Data</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Modulo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Projeto/Nucleo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#a3a3a3]">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 80).map((entry) => (
                <tr key={entry.id} className="border-t border-[#525252] hover:bg-[#484848]/40">
                  <td className="px-3 py-2 text-xs text-[#a3a3a3]">{formatDate(entry.date)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-[#f5f5f5]">{entry.module}</td>
                  <td className="px-3 py-2 text-xs text-[#a3a3a3]">{entry.nucleo}</td>
                  <td className="px-3 py-2">
                    <p className="text-xs text-[#f5f5f5]">{entry.description}</p>
                    <p className="text-[10px] text-[#6b6b6b]">{entry.basis}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-[#525252] bg-[#2c2c2c] px-2 py-0.5 text-[10px] text-[#a3a3a3]">
                      {entry.type === 'actual' ? 'real' : entry.type === 'committed' ? 'comprometido' : entry.type === 'earned' ? 'fisico' : 'orcamento'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#f5f5f5]">{entry.amountBRL ? toCurrency(entry.amountBRL) : '-'}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#6b6b6b]">
                    Sem eventos de custo para este projeto/nucleo ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#f5f5f5] text-sm font-semibold">Progresso das Fases</p>
          <Link to="/app/torre-de-controle?aba=projetos" className="flex items-center gap-1 text-[#f97316] text-xs font-medium hover:underline">
            <ExternalLink size={11} /> Ver em Projetos
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {allPhases.map((phase) => {
            const meta = PHASE_STATUS[phase.status] ?? PHASE_STATUS.not_started
            const endD = new Date(phase.endDate + 'T00:00:00')
            const isLate = phase.status !== 'completed' && endD < today
            const daysLeft = Math.round((endD.getTime() - today.getTime()) / 86_400_000)

            return (
              <div key={phase.id} className="flex items-center gap-3">
                <span className="w-32 text-[#f5f5f5] text-xs truncate shrink-0">{phase.name}</span>
                <div className="flex-1 h-2 bg-[#2c2c2c] rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-500" style={{ width: `${phase.progress}%`, backgroundColor: meta.color }} />
                </div>
                <span className="w-8 text-[#6b6b6b] text-[10px] text-right">{phase.progress}%</span>
                <span className="w-20 px-2 py-0.5 rounded text-[10px] font-bold text-center shrink-0" style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>
                  {meta.label}
                </span>
                <span className="w-20 text-[10px] text-right shrink-0" style={{ color: isLate ? '#ef4444' : '#6b6b6b' }}>
                  {phase.status === 'completed'
                    ? endD.toLocaleDateString('pt-BR')
                    : isLate
                      ? `${Math.abs(daysLeft)}d atraso`
                      : daysLeft >= 0
                        ? `${daysLeft}d restam`
                        : '-'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
