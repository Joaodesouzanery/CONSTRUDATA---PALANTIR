import {
  BarChart3, Calendar, Truck, Building2, Monitor, Map, HardHat,
  Package, Users, ListChecks, ClipboardList, FileText, Calculator,
  Box, Car, Layers3
} from 'lucide-react'

const MODULOS = [
  { icon: BarChart3, label: 'Relatório 360', desc: 'Dashboard executivo 360° de todos os projetos ativos em tempo real.', href: '#funcionalidades' },
  { icon: Calendar, label: 'Agenda / Cronograma', desc: 'Calendário de marcos e prazos com detecção automática de conflitos.', href: '#funcionalidades' },
  { icon: Truck, label: 'Equipamentos', desc: 'Catálogo, alocação e manutenção preventiva de equipamentos.', href: '#funcionalidades' },
  { icon: Building2, label: 'Projetos (BIM)', desc: 'Ciclo de vida completo com BIM 3D/4D/5D integrado.', href: '#bim' },
  { icon: Monitor, label: 'Torre de Controle', desc: 'Visão "war room" para gestão de portfólio de múltiplos projetos.', href: '#torre' },
  { icon: Map, label: 'Mapa Interativo', desc: 'Editor GIS de redes de esgoto, água e drenagem com análise 3D/4D/5D.', href: '#mapa' },
  { icon: HardHat, label: 'Pré-Construção', desc: 'Due diligence, dados geotécnicos e viabilidade de projeto.', href: '#funcionalidades' },
  { icon: Package, label: 'Suprimentos', desc: 'Three-Way Match automatizado: PO × GRN × NF com detecção de discrepâncias.', href: '#suprimentos' },
  { icon: Users, label: 'Mão de Obra', desc: 'Registro, alocação diária e folha de pagamento de colaboradores.', href: '#mao-de-obra' },
  { icon: ListChecks, label: 'Planejamento', desc: 'Gantt, curva-S, CPM e simulação de atrasos com análise ABC.', href: '#funcionalidades' },
  { icon: ClipboardList, label: 'LPS / Lean', desc: 'Last Planner System com look-ahead de 6 semanas e PPC semanal.', href: '#funcionalidades' },
  { icon: FileText, label: 'RDO', desc: 'Relatório Diário de Obra digital com integração à IA preditiva.', href: '#rdo' },
  { icon: Calculator, label: 'Quantitativos', desc: 'BOQ com base SINAPI/SEINFRA e estimativa automatizada de custos.', href: '#funcionalidades' },
  { icon: Box, label: 'BIM 3D/4D/5D', desc: 'Visualizador BIM standalone com simulação temporal e heatmap de custos.', href: '#bim' },
  { icon: Car, label: 'Frota', desc: 'Gestão de frota própria e alugada com controle de combustível e manutenção.', href: '#funcionalidades' },
  { icon: Layers3, label: 'Gestão 360', desc: 'JobCosting, Ordens de Mudança, Centro de Comando e Simulação de Atrasos.', href: '#funcionalidades' },
]

export function ModulosOverviewSection() {
  return (
    <section id="modulos" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[#2abfdc] text-sm font-semibold tracking-wide uppercase mb-3">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Módulos e Funcionalidades: Do Registro à Decisão Acionável
          </h2>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto">
            Cada módulo da Atlântico é uma peça fundamental para a inteligência operacional. Descrições concisas, focadas nos benefícios e apoiadas por visuais que demonstrem a funcionalidade.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULOS.map(({ icon: Icon, label, desc, href }) => (
            <a
              key={label}
              href={href}
              className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-[#2abfdc]/30 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-[#0a1628] flex items-center justify-center mb-3 group-hover:bg-[#112645] transition-colors">
                <Icon size={18} className="text-[#2abfdc]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5 text-sm">{label}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
