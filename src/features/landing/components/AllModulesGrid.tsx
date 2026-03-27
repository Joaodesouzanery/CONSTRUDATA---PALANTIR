import {
  BarChart3, Calendar, Truck, Building2, Monitor, Map, HardHat,
  Package, Users, ListChecks, ClipboardList, FileText, Calculator,
  Box, Car, Layers3
} from 'lucide-react'

const ALL_MODULES = [
  { icon: BarChart3, name: 'Relatório 360', desc: 'Dashboard executivo 360° de portfólio com curva-S, alertas RAG e KPIs em tempo real.', color: '#2abfdc' },
  { icon: Calendar, name: 'Agenda / Cronograma', desc: 'Calendário de marcos e prazos com detecção automática de conflitos e exportação iCal.', color: '#38bdf8' },
  { icon: Truck, name: 'Equipamentos', desc: 'Catálogo, alocação por projeto e manutenção preventiva com alertas automáticos.', color: '#f97316' },
  { icon: Building2, name: 'Projetos', desc: 'Gestão completa do ciclo de vida com registro de projeto, fases, BIM e controle de demandas.', color: '#a78bfa' },
  { icon: Monitor, name: 'Torre de Controle', desc: 'Visão "war room" multiportfólio com CPI, SPI, ações em aberto e drill-down de projetos.', color: '#ef4444' },
  { icon: Map, name: 'Mapa Interativo', desc: 'Editor GIS de redes de infraestrutura com importação UTM, perfil 3D e análise de custo por trecho.', color: '#22c55e' },
  { icon: HardHat, name: 'Pré-Construção', desc: 'Due diligence, sondagens geotécnicas, licenças ambientais e viabilidade de projeto.', color: '#eab308' },
  { icon: Package, name: 'Suprimentos', desc: 'PO, GRN e NF com Three-Way Match automatizado e scorecard de fornecedores por IA.', color: '#2abfdc' },
  { icon: Users, name: 'Mão de Obra', desc: 'Registro CLT/temporário, alocação diária, alertas de NR e geração de holerite PDF.', color: '#38bdf8' },
  { icon: ListChecks, name: 'Planejamento', desc: 'CPM/Gantt, curva-S, simulação de atrasos e análise ABC por custo de trecho.', color: '#a78bfa' },
  { icon: ClipboardList, name: 'LPS / Lean', desc: 'Last Planner System com look-ahead 6 semanas, PPC semanal e registro de restrições.', color: '#22c55e' },
  { icon: FileText, name: 'RDO', desc: 'Relatório Diário de Obra digital com RDO, financeiro, integração e exportação PDF.', color: '#f97316' },
  { icon: Calculator, name: 'Quantitativos', desc: 'BOQ com base SINAPI/SEINFRA, BDI, resumo de custos e exportação Excel/CSV.', color: '#eab308' },
  { icon: Box, name: 'BIM 3D/4D/5D', desc: 'Visualizador BIM standalone com simulação temporal, heatmap de custos e controle de camadas.', color: '#2abfdc' },
  { icon: Car, name: 'Frota', desc: 'Frota própria e alugada: log de viagens, consumo de combustível e manutenção preventiva.', color: '#38bdf8' },
  { icon: Layers3, name: 'Gestão 360', desc: 'JobCosting EVM, Ordens de Mudança, Centro de Comando e Simulação de Atrasos what-if.', color: '#a78bfa' },
]

export function AllModulesGrid() {
  return (
    <section className="py-24 bg-[#0a1628]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[#2abfdc] text-sm font-semibold tracking-wide uppercase mb-3">Visão Completa</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Todos os Módulos da Plataforma Atlântico
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            16 módulos integrados para cobrir todo o ciclo de vida de projetos de construção e saneamento.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ALL_MODULES.map(({ icon: Icon, name, desc, color }) => (
            <div
              key={name}
              className="bg-white/5 rounded-xl border border-white/10 p-5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${color}22`, border: `1px solid ${color}44` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <h3 className="text-white font-semibold mb-1.5 text-sm">{name}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
