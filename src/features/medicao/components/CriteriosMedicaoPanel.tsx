/**
 * CriteriosMedicaoPanel — Step 2: Critérios de Medição (reference viewer).
 *
 * Read-only lookup of Sabesp measurement criteria by service code or description.
 */
import { useState } from 'react'
import { Search, BookOpen } from 'lucide-react'
import { searchCriterios, CRITERIOS_MEDICAO } from '../data/criterios'

const GRUPO_COLORS: Record<string, string> = {
  '01': 'text-amber-400 bg-amber-400/10 border-amber-500/30',
  '02': 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  '03': 'text-cyan-400 bg-cyan-400/10 border-cyan-500/30',
}

export function CriteriosMedicaoPanel() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const results = searchCriterios(query)
  const selectedCrit = CRITERIOS_MEDICAO.find((c) => c.nPreco === selected)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — search + list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[#525252] bg-[#1f1f1f]">
        <div className="p-3 border-b border-[#525252]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código ou descrição…"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-8 pr-3 py-2 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div className="text-[10px] text-[#6b6b6b] mt-1.5">{results.length} critérios</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.nPreco}
              type="button"
              onClick={() => setSelected(c.nPreco)}
              className={`w-full text-left px-3 py-2.5 border-b border-[#2c2c2c] transition-colors ${
                selected === c.nPreco
                  ? 'bg-[#f97316]/10 border-l-2 border-l-[#f97316]'
                  : 'hover:bg-[#2c2c2c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${GRUPO_COLORS[c.grupo] ?? 'text-[#a3a3a3]'}`}>
                  {c.grupo}
                </span>
                <span className="font-mono text-xs text-[#f97316] font-bold">{c.nPreco}</span>
                <span className="text-[10px] text-[#a3a3a3]">{c.unidade}</span>
              </div>
              <div className="text-xs text-[#f5f5f5] leading-tight line-clamp-2">{c.descricao}</div>
            </button>
          ))}
          {results.length === 0 && (
            <div className="p-6 text-center text-xs text-[#6b6b6b] italic">
              Nenhum critério encontrado para "{query}"
            </div>
          )}
        </div>
      </div>

      {/* Right — detail view */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedCrit ? (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
                <BookOpen size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${GRUPO_COLORS[selectedCrit.grupo] ?? ''}`}>
                    Grupo {selectedCrit.grupo} — {selectedCrit.grupoNome}
                  </span>
                  <span className="text-xs text-[#a3a3a3] font-mono">{selectedCrit.nPreco}</span>
                  <span className="text-xs text-[#6b6b6b]">· {selectedCrit.unidade}</span>
                </div>
                <h2 className="text-white font-bold text-lg leading-snug">{selectedCrit.descricao}</h2>
              </div>
            </div>

            <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden divide-y divide-[#525252]">
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase text-[#f97316] tracking-widest mb-2">Compreende</div>
                <p className="text-[#e5e5e5] text-sm leading-relaxed">{selectedCrit.compreende}</p>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase text-[#f97316] tracking-widest mb-2">Medição</div>
                <p className="text-[#e5e5e5] text-sm leading-relaxed">{selectedCrit.medicao}</p>
              </div>
              {selectedCrit.notas && (
                <div className="p-4 bg-amber-900/10">
                  <div className="text-[10px] font-semibold uppercase text-amber-400 tracking-widest mb-2">Notas</div>
                  <p className="text-amber-200/80 text-sm leading-relaxed">{selectedCrit.notas}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen size={40} className="text-[#525252] mb-4" />
            <p className="text-[#6b6b6b] text-sm">Selecione um código de serviço à esquerda para ver os critérios de medição.</p>
            <p className="text-[#6b6b6b] text-xs mt-1">
              {CRITERIOS_MEDICAO.length} critérios disponíveis · Contrato 11481051
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
