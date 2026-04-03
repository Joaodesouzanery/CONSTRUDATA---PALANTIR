/**
 * EquipesSalvasPanel — manage saved teams (Equipes Salvas) for the RDO module.
 */
import { useState } from 'react'
import { Plus, Trash2, Save, Users, Edit2, UserPlus, Wrench } from 'lucide-react'
import { useRdoTeamsStore } from '@/store/rdoTeamsStore'
import type { RdoSavedTeam } from '@/types'

const inputCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors'

interface TeamFormState {
  name: string
  nucleo: string
  encarregado: string
  membros: { role: string; name: string }[]
  equipamentos: { name: string; quantity: number }[]
}

const emptyForm: TeamFormState = {
  name: '',
  nucleo: '',
  encarregado: '',
  membros: [],
  equipamentos: [],
}

export function EquipesSalvasPanel() {
  const { teams, addTeam, updateTeam, removeTeam } = useRdoTeamsStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TeamFormState>({ ...emptyForm })
  const [showForm, setShowForm] = useState(false)

  function startNew() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowForm(true)
  }

  function startEdit(team: RdoSavedTeam) {
    setEditingId(team.id)
    setForm({
      name: team.name,
      nucleo: team.nucleo || '',
      encarregado: team.encarregado,
      membros: [...team.membros],
      equipamentos: [...team.equipamentos],
    })
    setShowForm(true)
  }

  function handleSave() {
    if (!form.name.trim() || !form.encarregado.trim()) return
    const data = {
      name: form.name.trim(),
      nucleo: form.nucleo.trim() || undefined,
      encarregado: form.encarregado.trim(),
      membros: form.membros.filter((m) => m.name.trim()),
      equipamentos: form.equipamentos.filter((e) => e.name.trim()),
    }
    if (editingId) {
      updateTeam(editingId, data)
    } else {
      addTeam(data)
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir esta equipe?')) return
    removeTeam(id)
    if (editingId === id) {
      setShowForm(false)
      setEditingId(null)
    }
  }

  function addMembro() {
    setForm((f) => ({ ...f, membros: [...f.membros, { role: '', name: '' }] }))
  }
  function updateMembro(i: number, field: 'role' | 'name', value: string) {
    setForm((f) => ({
      ...f,
      membros: f.membros.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    }))
  }
  function removeMembro(i: number) {
    setForm((f) => ({ ...f, membros: f.membros.filter((_, idx) => idx !== i) }))
  }

  function addEquipamento() {
    setForm((f) => ({ ...f, equipamentos: [...f.equipamentos, { name: '', quantity: 1 }] }))
  }
  function updateEquipamento(i: number, field: 'name' | 'quantity', value: string | number) {
    setForm((f) => ({
      ...f,
      equipamentos: f.equipamentos.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)),
    }))
  }
  function removeEquipamento(i: number) {
    setForm((f) => ({ ...f, equipamentos: f.equipamentos.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Equipes Salvas</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">Configure equipes reutilizáveis por Núcleo / Projeto</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
        >
          <Plus size={15} /> Nova Equipe
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team list */}
        <div className="space-y-3">
          {teams.length === 0 && !showForm && (
            <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-8 text-center">
              <Users size={32} className="mx-auto text-[#6b6b6b] mb-3" />
              <p className="text-[#a3a3a3] text-sm">Nenhuma equipe salva.</p>
              <p className="text-[#6b6b6b] text-xs mt-1">Crie equipes para reutilizar no RDO.</p>
            </div>
          )}
          {teams.map((team) => (
            <div
              key={team.id}
              className={`bg-[#3d3d3d] rounded-xl border p-4 transition-colors ${
                editingId === team.id ? 'border-[#f97316]/50' : 'border-[#525252]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm truncate">{team.name}</h3>
                  {team.nucleo && <p className="text-[#a3a3a3] text-xs">Núcleo: {team.nucleo}</p>}
                  <p className="text-[#a3a3a3] text-xs mt-1">Encarregado: {team.encarregado}</p>
                  <div className="flex gap-3 mt-2 text-[#6b6b6b] text-xs">
                    <span>{team.membros.length} membro{team.membros.length !== 1 ? 's' : ''}</span>
                    <span>{team.equipamentos.length} equipamento{team.equipamentos.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(team)} className="p-1.5 text-[#a3a3a3] hover:text-[#f97316] transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(team.id)} className="p-1.5 text-[#a3a3a3] hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5 space-y-4">
            <h3 className="text-white font-medium text-sm">
              {editingId ? 'Editar Equipe' : 'Nova Equipe'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Nome da Equipe *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Equipe Norte"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Núcleo / Projeto</label>
                <input
                  type="text"
                  value={form.nucleo}
                  onChange={(e) => setForm((f) => ({ ...f, nucleo: e.target.value }))}
                  placeholder="Ex: Núcleo Norte"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Encarregado *</label>
              <input
                type="text"
                value={form.encarregado}
                onChange={(e) => setForm((f) => ({ ...f, encarregado: e.target.value }))}
                placeholder="Nome do encarregado"
                className={inputCls}
              />
            </div>

            {/* Membros */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#a3a3a3] text-xs font-medium">Membros da Equipe</label>
                <button onClick={addMembro} className="flex items-center gap-1 text-[#f97316] hover:text-[#ea580c] text-xs">
                  <UserPlus size={12} /> Adicionar
                </button>
              </div>
              {form.membros.length === 0 && (
                <p className="text-[#6b6b6b] text-xs italic">Nenhum membro adicionado.</p>
              )}
              <div className="space-y-2">
                {form.membros.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={m.role}
                      onChange={(e) => updateMembro(i, 'role', e.target.value)}
                      placeholder="Função"
                      className={`${inputCls} w-36`}
                    />
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMembro(i, 'name', e.target.value)}
                      placeholder="Nome"
                      className={`${inputCls} flex-1`}
                    />
                    <button onClick={() => removeMembro(i)} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipamentos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#a3a3a3] text-xs font-medium">Equipamentos</label>
                <button onClick={addEquipamento} className="flex items-center gap-1 text-[#f97316] hover:text-[#ea580c] text-xs">
                  <Wrench size={12} /> Adicionar
                </button>
              </div>
              {form.equipamentos.length === 0 && (
                <p className="text-[#6b6b6b] text-xs italic">Nenhum equipamento adicionado.</p>
              )}
              <div className="space-y-2">
                {form.equipamentos.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={e.name}
                      onChange={(ev) => updateEquipamento(i, 'name', ev.target.value)}
                      placeholder="Nome do equipamento"
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      type="number"
                      value={e.quantity}
                      onChange={(ev) => updateEquipamento(i, 'quantity', Number(ev.target.value))}
                      min={0}
                      className={`${inputCls} w-20`}
                      title="Quantidade"
                    />
                    <button onClick={() => removeEquipamento(i)} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#525252]">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.encarregado.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={14} /> {editingId ? 'Atualizar' : 'Salvar'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }) }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#a3a3a3] hover:text-white bg-[#484848] hover:bg-[#525252] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
