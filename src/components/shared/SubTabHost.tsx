/**
 * SubTabHost — barra de sub-abas reutilizável. Renderiza um seletor de pills
 * acima do conteúdo da aba ativa. Usado no módulo Financeiro (EVM) para agrupar
 * painéis relacionados (Resultados, Distribuição, Medição, Visão Geral) sem
 * poluir a barra de abas principal.
 *
 * Cada painel filho traz seu próprio padding; por isso o host só adiciona o
 * respeito horizontal (px-6 pt-4) ao redor da barra de pills.
 */
import { useState, type ReactNode } from 'react'

export type SubTab = { key: string; label: string; render: () => ReactNode }

/**
 * Opcionalmente CONTROLADO.
 *
 * ⚠️ Sem isso, para abrir uma sub-aba de fora só restava `key={...}` + prop inicial — e aí clicar
 * duas vezes na mesma linha da Carteira não navegava, porque o estado não mudava e o remount não
 * acontecia. Com `ativa`/`onTrocar` quem tem o estado é o pai, e o gesto funciona sempre.
 *
 * Sem as duas props, o host continua guardando a aba sozinho — que é o uso da maioria.
 */
export function SubTabHost({ tabs, ativa, onTrocar }: {
  tabs: SubTab[]
  ativa?: string
  onTrocar?: (key: string) => void
}) {
  const [interna, setInterna] = useState(tabs[0]?.key)
  const active = ativa ?? interna
  const setActive = (k: string) => { if (onTrocar) onTrocar(k); else setInterna(k) }
  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 shrink-0">
        <div className="inline-flex self-start flex-wrap gap-1 rounded-lg border border-[#525252] bg-[#1f1f1f] p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                active === t.key
                  ? 'bg-[#f97316] text-white'
                  : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">{current?.render()}</div>
    </div>
  )
}
