/**
 * Registro de Ocorrências — o que atrapalhou a jornada no dia.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 * Isto morava dentro do `EscalamentoPanel`, que foi removido. E a remoção não era limpa: o
 * Escalamento era o **único lugar do sistema que cadastrava ocorrência**, enquanto o card de custo
 * do Dashboard (`FaixaDeCusto.tsx`) LÊ esse dado. Apagar a aba sem mais nada deixaria o card
 * permanentemente em zero — um número que não é falso, é órfão.
 *
 * A casa nova é Faltas e Ausências, que é a mesma família: acidente, atraso de material e falha de
 * equipamento são "o que deu errado no dia", do mesmo jeito que uma falta.
 *
 * ⚠️ O motor de realocação (`suggestions`), que também só vivia no Escalamento, morreu junto — e
 * sem consequência: ele nem estava no `partialize`, ou seja, já era descartado a cada F5.
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePermissaoEscrita, ROLES_MAO_DE_OBRA_WRITE } from '@/lib/roles'
import { OcorrenciaDialog } from './dialogs/OcorrenciaDialog'
import type { LaborOccurrence, LaborCrew, OccurrenceType } from '@/types'

const OCC_META: Record<OccurrenceType, { label: string; color: string }> = {
  weather:           { label: 'Clima',             color: '#3b82f6' },
  material_delay:    { label: 'Atraso Material',   color: '#f59e0b' },
  equipment_failure: { label: 'Falha Equipamento', color: '#ef4444' },
  holiday:           { label: 'Feriado',           color: '#8b5cf6' },
  accident:          { label: 'Acidente',          color: '#ef4444' },
  other:             { label: 'Outro',             color: '#6b7280' },
}

function OccTypeBadge({ type }: { type: OccurrenceType }) {
  const meta = OCC_META[type]
  return (
    <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
      {meta.label}
    </span>
  )
}

function OccurrenceRow({ occ, crews, podeEditar, onEditar, onExcluir }: {
  occ: LaborOccurrence
  crews: LaborCrew[]
  podeEditar: boolean
  onEditar: () => void
  onExcluir: () => void
}) {
  const crewNames = occ.affectedCrewIds.map((id) => crews.find((c) => c.id === id)?.name ?? id).join(', ')
  return (
    <tr className="border-b border-[#3d3d3d] last:border-0">
      <td className="shrink-0 py-2 text-xs text-[#adadad]">
        {new Date(occ.date + 'T00:00:00').toLocaleDateString('pt-BR')}
      </td>
      <td className="py-2"><OccTypeBadge type={occ.type} /></td>
      <td className="max-w-[240px] truncate py-2 text-xs text-[#f5f5f5]">{occ.description}</td>
      <td className="py-2 text-right text-xs font-semibold text-[#f5f5f5]">{occ.impactHours}h</td>
      <td className="hidden py-2 text-xs text-[#adadad] md:table-cell">{crewNames}</td>
      {podeEditar && (
        <td className="whitespace-nowrap py-2 text-right">
          <button onClick={onEditar} title="Corrigir esta ocorrência"
            className="rounded p-1 text-[#adadad] transition-colors hover:bg-[#484848] hover:text-[#f5f5f5]">
            <Pencil size={12} />
          </button>
          <button onClick={onExcluir} title="Excluir esta ocorrência"
            className="ml-1 rounded p-1 text-[#adadad] transition-colors hover:bg-[#dc2626]/20 hover:text-[#fca5a5]">
            <Trash2 size={12} />
          </button>
        </td>
      )}
    </tr>
  )
}

export function OcorrenciasSection() {
  const { occurrences, crews, removeOccurrence } = useMaoDeObraStore(useShallow((s) => ({
    occurrences: s.occurrences, crews: s.crews, removeOccurrence: s.removeOccurrence,
  })))
  // A RLS de `labor_occurrences` aceita os mesmos papéis de `work_posts`. Sem o gate, quem não
  // pode gravar veria o botão, clicaria, e a op voltaria 42501 — fila travada.
  const podeEscrever = usePermissaoEscrita(ROLES_MAO_DE_OBRA_WRITE).pode
  const [novaAberta, setNovaAberta] = useState(false)
  const [editando, setEditando] = useState<LaborOccurrence | null>(null)

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#f5f5f5]">Registro de Ocorrências ({occurrences.length})</p>
          <p className="text-[11px] text-[#adadad]">Clima, atraso, falha de equipamento, acidente — o que custou hora de obra.</p>
        </div>
        {podeEscrever && (
          <button
            type="button" onClick={() => setNovaAberta(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#ea6c0a]"
          >
            <Plus size={13} /> Registrar
          </button>
        )}
      </div>

      {occurrences.length === 0 ? (
        <p className="text-sm text-[#adadad]">Nenhuma ocorrência registrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#525252]">
                <th className="pb-2 text-left font-medium text-[#adadad]">Data</th>
                <th className="pb-2 text-left font-medium text-[#adadad]">Tipo</th>
                <th className="pb-2 text-left font-medium text-[#adadad]">Descrição</th>
                <th className="pb-2 text-right font-medium text-[#adadad]">Impacto</th>
                <th className="hidden pb-2 text-left font-medium text-[#adadad] md:table-cell">Equipes</th>
                {podeEscrever && <th className="pb-2 text-right font-medium text-[#adadad]">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {[...occurrences].sort((a, b) => b.date.localeCompare(a.date)).map((occ) => (
                <OccurrenceRow
                  key={occ.id} occ={occ} crews={crews} podeEditar={podeEscrever}
                  onEditar={() => setEditando(occ)}
                  onExcluir={() => {
                    if (window.confirm(`Excluir a ocorrência de ${new Date(occ.date + 'T00:00:00').toLocaleDateString('pt-BR')} (${occ.description.slice(0, 40)})?`)) {
                      removeOccurrence(occ.id)
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novaAberta && <OcorrenciaDialog onClose={() => setNovaAberta(false)} />}
      {editando && <OcorrenciaDialog ocorrencia={editando} onClose={() => setEditando(null)} />}
    </div>
  )
}
