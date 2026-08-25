/**
 * Equipes — times por obra, reutilizáveis nos RDOs.
 *
 * Morava dentro da aba Escala, e não tinha relação nenhuma com turno nem com posto: estava lá
 * porque "configure times por obra e selecione-os direto nos RDOs". Com a fusão de Escala e
 * Postos, ficar ali significaria uma tela de ~1.200 linhas com quatro assuntos. Veio para
 * Funcionários, onde o vínculo do funcionário com a equipe (`Worker.crewId`) já mora.
 */
import { useState } from 'react'
import { LayoutGrid, Plus, X } from 'lucide-react'
import { AcoesDaLinha } from './AcoesDaLinha'

interface EquipesSectionProps {
  crews: import('@/types').LaborCrew[]
  workers: import('@/types').Worker[]
  addCrew: (crew: Omit<import('@/types').LaborCrew, 'id'>) => void
  updateCrew: (id: string, updates: Partial<Omit<import('@/types').LaborCrew, 'id'>>) => void
  removeCrew: (id: string) => void
}

export function EquipesSection({ crews, workers, addCrew, updateCrew, removeCrew }: EquipesSectionProps) {
  const [open, setOpen] = useState(crews.length > 0)
  const [editing, setEditing] = useState<import('@/types').LaborCrew | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
          <LayoutGrid size={14} className="text-[#ffa055]" />
          Equipes ({crews.length})
          <span className="text-[11px] font-normal text-[#adadad]">— configure times por obra e selecione-os direto nos RDOs</span>
        </span>
        <span className="text-[#adadad] text-xs">{open ? 'Recolher' : 'Expandir'}</span>
      </button>

      {open && (
        <div className="border-t border-[#525252] p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {crews.map((crew) => (
              <div key={crew.id} className="group rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#f5f5f5]">{crew.name}</p>
                    <p className="text-[11px] text-[#adadad]">{crew.projectRef || 'Sem obra vinculada'}{crew.specialty ? ` · ${crew.specialty}` : ''}</p>
                  </div>
                  {/* Estes dois eram `opacity-0` até o hover — em tablet no canteiro NÃO existe
                      hover, então editar e excluir equipe eram inalcançáveis. E usavam engrenagem
                      e "X" no lugar de lápis e lixeira, quebrando o vocabulário do módulo. */}
                  <AcoesDaLinha
                    descricao={`a equipe ${crew.name}`}
                    onEditar={() => setEditing(crew)}
                    onExcluir={() => removeCrew(crew.id)}
                    consequencia="Os funcionários continuam cadastrados; só o agrupamento é desfeito."
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#c9c9c9]">
                  {crew.foreman ? `Encarregado: ${crew.foreman} · ` : ''}{crew.workerIds.length} membro{crew.workerIds.length !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex min-h-[72px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#525252] text-xs font-semibold text-[#c9c9c9] transition-colors hover:border-[#f97316] hover:text-[#ffa055]"
            >
              <Plus size={13} /> Nova equipe
            </button>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <EquipeDialog
          initial={editing}
          workers={workers}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(values) => {
            if (editing) updateCrew(editing.id, values)
            else addCrew(values)
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function EquipeDialog({
  initial, workers, onClose, onSave,
}: {
  initial: import('@/types').LaborCrew | null
  workers: import('@/types').Worker[]
  onClose: () => void
  onSave: (values: Omit<import('@/types').LaborCrew, 'id'>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [projectRef, setProjectRef] = useState(initial?.projectRef ?? '')
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '')
  const [foreman, setForeman] = useState(initial?.foreman ?? '')
  const [memberIds, setMemberIds] = useState<string[]>(initial?.workerIds ?? [])

  const input = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]'
  const label = 'block text-[11px] text-[#c9c9c9] uppercase mb-1'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-[#525252] bg-[#333333] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{initial ? 'Editar Equipe' : 'Nova Equipe'}</h3>
          <button type="button" onClick={onClose} className="text-[#adadad] hover:text-white" aria-label="Fechar"><X size={16} /></button>
        </div>
        <div>
          <label className={label}>Nome da equipe *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Ex.: Equipe Demarcação A" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Obra</label>
            <input value={projectRef} onChange={(e) => setProjectRef(e.target.value)} className={input} placeholder="Ex.: Obra Geely - 509 Norte" />
          </div>
          <div>
            <label className={label}>Especialidade</label>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={input} placeholder="Ex.: Pintura de piso" />
          </div>
        </div>
        <div>
          <label className={label}>Encarregado</label>
          <input value={foreman} onChange={(e) => setForeman(e.target.value)} className={input} placeholder="Nome do encarregado" list="equipe-foreman" />
          <datalist id="equipe-foreman">
            {workers.map((w) => <option key={w.id} value={w.name} />)}
          </datalist>
        </div>
        <div>
          <label className={label}>Funcionários ({memberIds.length} selecionado{memberIds.length !== 1 ? 's' : ''})</label>
          {workers.length === 0 ? (
            <p className="text-xs text-[#adadad]">Cadastre funcionários na aba Funcionários para montar equipes.</p>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[#525252] bg-[#2c2c2c] p-2">
              {workers.map((w) => (
                <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-[#c9c9c9] transition-colors hover:bg-[#3d3d3d] hover:text-[#f5f5f5]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#f97316]"
                    checked={memberIds.includes(w.id)}
                    onChange={() => setMemberIds((ids) => ids.includes(w.id) ? ids.filter((x) => x !== w.id) : [...ids, w.id])}
                  />
                  <span>{w.name}</span>
                  {w.role && <span className="text-[11px] text-[#adadad]">· {w.role}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#484848] px-4 py-2 text-sm font-medium text-[#f5f5f5] hover:bg-[#525252]">Cancelar</button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), projectRef: projectRef.trim(), specialty: specialty.trim(), foreman: foreman.trim(), workerIds: memberIds })}
            className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c] disabled:opacity-50"
          >
            {initial ? 'Salvar' : 'Criar equipe'}
          </button>
        </div>
      </div>
    </div>
  )
}
