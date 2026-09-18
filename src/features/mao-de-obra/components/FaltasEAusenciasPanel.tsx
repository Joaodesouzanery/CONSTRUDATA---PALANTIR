/**
 * Faltas e Ausências — o que tirou gente da obra, num lugar só.
 *
 * ─── A FUSÃO, E POR QUE ELA É BARATA ──────────────────────────────────────────
 * Eram duas abas que liam a MESMA coleção (`absences`) com papéis opostos:
 * `AusenciasCalendarioPanel` é 100% leitura (calendário, linha do tempo, lista, CSV) e
 * `FaltasSubsPanel` é quem escreve (registrar, corrigir, resolver, designar substituto). Nenhum
 * conflito de escrita — só duas metades da mesma pergunta em lugares diferentes.
 *
 * As Ocorrências entraram junto porque o `EscalamentoPanel` saiu e era o único lugar que as
 * cadastrava (ver `OcorrenciasSection`). Acidente, atraso e falha de equipamento são da mesma
 * família: o que atrapalhou o dia.
 *
 * ⚠️ O aviso que NÃO pode se perder na fusão: **falta em dia sem turno não desconta nada.**
 * `registerAbsence` chama `marcarTurnoAusente`, e sem turno na escala não há o que marcar — a falta
 * fica registrada para histórico e avaliação, mas a folha não muda. Quem não lê isso acha que
 * ajustou o pagamento e não ajustou.
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FaltasSubsPanel } from './FaltasSubsPanel'
import { AusenciasCalendarioPanel } from './AusenciasCalendarioPanel'
import { OcorrenciasSection } from './OcorrenciasSection'

type Visao = 'gestao' | 'calendario' | 'ocorrencias'

const VISOES: Array<{ id: Visao; rotulo: string; ajuda: string }> = [
  { id: 'gestao',      rotulo: 'Faltas e substituições', ajuda: 'Registrar, resolver e designar substituto' },
  { id: 'calendario',  rotulo: 'Calendário',             ajuda: 'Mês, linha do tempo e lista — inclui férias' },
  { id: 'ocorrencias', rotulo: 'Ocorrências',            ajuda: 'Clima, atraso, falha, acidente' },
]

export function FaltasEAusenciasPanel() {
  const [visao, setVisao] = useState<Visao>('gestao')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {VISOES.map((v) => (
          <button
            key={v.id} type="button" onClick={() => setVisao(v.id)} title={v.ajuda}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              visao === v.id ? 'bg-[#f97316] text-white' : 'border border-[#525252] text-[#adadad] hover:text-[#f5f5f5]',
            )}
          >
            {v.rotulo}
          </button>
        ))}
      </div>

      {visao === 'gestao' && <FaltasSubsPanel />}
      {visao === 'calendario' && <AusenciasCalendarioPanel />}
      {visao === 'ocorrencias' && <OcorrenciasSection />}
    </div>
  )
}
