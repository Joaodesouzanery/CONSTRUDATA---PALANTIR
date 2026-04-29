import { ArrowRight, Boxes, ClipboardList, FileCheck2, GitBranch, Map, PackageCheck, ShieldAlert, Truck } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { cn } from '@/lib/utils'
import type { SuprimentosTab } from './SuprimentosHeader'

interface Props {
  onNavigate: (tab: SuprimentosTab) => void
}

const fluxo: Array<{ titulo: string; descricao: string; tab: SuprimentosTab; icon: typeof GitBranch; tone: string }> = [
  { titulo: '1. Inteligência de Demanda', descricao: 'Demandas vindas de planilhas, planejamento, LPS/lookahead, quantitativos, RDO e estoque.', tab: 'inteligencia', icon: GitBranch, tone: 'text-[#38bdf8]' },
  { titulo: '2. Lista de Compras / BOM', descricao: 'Pacotes de compra por material, obra, frente, semana e fornecedor preferencial.', tab: 'bom', icon: ClipboardList, tone: 'text-[#a78bfa]' },
  { titulo: '3. Requisições', descricao: 'Solicitações com prioridade, aprovador, prazo necessário e origem da demanda.', tab: 'requisicoes', icon: FileCheck2, tone: 'text-[#fbbf24]' },
  { titulo: '4. Conciliação e Exceções', descricao: 'Pedido, recebimento, nota, contrato e divergências em uma conferência operacional.', tab: 'conciliacao', icon: ShieldAlert, tone: 'text-[#f87171]' },
  { titulo: '5. Contratos e Fornecedores', descricao: 'Contrato 360, fornecedor 360, preço, lead time, OTIF, risco e histórico de atendimento.', tab: 'contratos', icon: Truck, tone: 'text-[#4ade80]' },
  { titulo: '6. Estoque e Almoxarifado', descricao: 'Saldo, reserva, trânsito, ruptura, consumo e movimentações por frente.', tab: 'estoque', icon: Boxes, tone: 'text-[#38bdf8]' },
  { titulo: '7. Semáforo de Prontidão', descricao: 'Cada frente/atividade LPS pronta, em risco ou bloqueada por material.', tab: 'semaforo', icon: PackageCheck, tone: 'text-[#4ade80]' },
  { titulo: '8. Cadeia de Suprimentos', descricao: 'Mapa, alertas, planejamento autônomo e decisões logísticas da rede.', tab: 'cadeia_rede', icon: Map, tone: 'text-[#f97316]' },
]

function Kpi({ label, value, tone = 'text-[#f5f5f5]' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#3d3d3d] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export function FluxoGestorSuprimentosPanel({ onNavigate }: Props) {
  const purchaseOrders = useSuprimentosStore((state) => state.purchaseOrders)
  const exceptions = useSuprimentosStore((state) => state.exceptions)
  const estoqueItens = useSuprimentosStore((state) => state.estoqueItens)
  const reservas = useSuprimentosStore((state) => state.reservas)
  const supplyChainAlerts = useSuprimentosStore((state) => state.supplyChainAlerts)

  const ruptureCount = estoqueItens.filter((item) => item.qtdDisponivel <= item.estoqueMinimo).length
  const openExceptions = exceptions.filter((exception) => exception.status === 'open' || exception.status === 'escalated').length
  const openAlerts = supplyChainAlerts.filter((alert) => alert.status === 'aberto' || alert.status === 'em_analise').length

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[#525252] bg-[#3d3d3d] p-4">
        <h2 className="text-base font-bold text-[#f5f5f5]">Fluxo completo de Suprimentos</h2>
        <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#a3a3a3]">
          Uma visão para o gestor acompanhar a jornada da demanda até a decisão: planejar, comprar, conferir, armazenar, liberar a frente e responder aos riscos da cadeia.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Ordens de compra" value={purchaseOrders.length} />
        <Kpi label="Exceções abertas" value={openExceptions} tone={openExceptions ? 'text-[#f87171]' : 'text-[#4ade80]'} />
        <Kpi label="Itens em ruptura/baixo estoque" value={ruptureCount} tone={ruptureCount ? 'text-[#fbbf24]' : 'text-[#4ade80]'} />
        <Kpi label="Reservas LPS" value={reservas.length} />
        <Kpi label="Alertas da cadeia" value={openAlerts} tone={openAlerts ? 'text-[#f87171]' : 'text-[#4ade80]'} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fluxo.map((step, index) => {
          const Icon = step.icon
          return (
            <button
              key={step.titulo}
              onClick={() => onNavigate(step.tab)}
              className="group rounded-lg border border-[#525252] bg-[#333333] p-4 text-left transition-colors hover:border-[#f97316]/50 hover:bg-[#3d3d3d]"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon size={18} className={cn('mt-0.5', step.tone)} />
                {index < fluxo.length - 1 && <ArrowRight size={14} className="text-[#6b6b6b] transition-colors group-hover:text-[#f97316]" />}
              </div>
              <p className="mt-3 text-sm font-bold text-[#f5f5f5]">{step.titulo}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#b8b8b8]">{step.descricao}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
