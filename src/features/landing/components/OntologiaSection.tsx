import { Database, Layers, Zap } from 'lucide-react'

export function OntologiaSection() {
  return (
    <section id="plataforma" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: visual */}
          <div className="relative">
            <div className="rounded-2xl p-8 border border-gray-100 bg-gradient-to-br from-[#0a1628] to-[#112645]">
              {/* Semantic layer visualization */}
              <div className="space-y-3">
                {[
                  { icon: '🏗️', label: 'RDO — Canteiro de Obras', color: '#2abfdc', width: '100%' },
                  { icon: '📊', label: 'BIM — Modelo 3D/4D/5D', color: '#38bdf8', width: '85%' },
                  { icon: '💰', label: 'ERP — Orçamento e Custos', color: '#a78bfa', width: '75%' },
                  { icon: '📅', label: 'Cronograma — Planejamento', color: '#22c55e', width: '90%' },
                  { icon: '🚚', label: 'Suprimentos — Three-Way Match', color: '#f97316', width: '70%' },
                ].map((layer) => (
                  <div key={layer.label} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-lg">{layer.icon}</span>
                    <div className="flex-1">
                      <div className="text-white/80 text-xs mb-1">{layer.label}</div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: layer.width, background: layer.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-[#2abfdc]/10 border border-[#2abfdc]/20">
                <div className="text-[#2abfdc] text-xs font-semibold">↕ Camada Semântica Unificada — Atlântico</div>
                <div className="text-white/50 text-xs mt-1">Todos os módulos conectados em tempo real</div>
              </div>
            </div>
          </div>

          {/* Right: copy */}
          <div className="space-y-6">
            <div>
              <p className="text-[#2abfdc] text-sm font-semibold tracking-wide uppercase mb-3">A Plataforma</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                A Ontologia da Construção: Um Gêmeo Digital para Cada Projeto.
              </h2>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed">
              A Atlântico não apenas coleta dados; ela os integra em uma camada semântica unificada que espelha a realidade do seu projeto. Da pré-construção ao encerramento, cada elemento — atividade, recurso, material — é um objeto inteligente, conectado e contextualizado.
            </p>

            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <p className="text-gray-700 leading-relaxed">
                <strong className="text-[#0a1628]">Conectamos o que acontece no canteiro de obras</strong> aos sistemas de suporte (ERP, BIM, Cronogramas) em um ambiente low-code acessível a todos os usuários, independentemente do seu background técnico. Isso significa que o status de um pilar no RDO impacta diretamente o cronograma e o orçamento no seu ERP.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Database, label: 'Dados Integrados', desc: 'Todos os módulos em uma única fonte de verdade' },
                { icon: Layers, label: 'Camada Semântica', desc: 'Cada dado contextualizado e conectado' },
                { icon: Zap, label: 'Tempo Real', desc: 'Decisões baseadas em dados ao vivo' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex flex-col items-center text-center p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-[#0a1628] flex items-center justify-center mb-3">
                    <Icon size={18} className="text-[#2abfdc]" />
                  </div>
                  <div className="text-gray-900 font-semibold text-sm mb-1">{label}</div>
                  <div className="text-gray-500 text-xs">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
