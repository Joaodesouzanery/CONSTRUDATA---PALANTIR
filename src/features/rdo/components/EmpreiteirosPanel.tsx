import { useEffect, useMemo, useState } from 'react'
import { Building2, Edit3, Link2, Plus, Save, Trash2, Users } from 'lucide-react'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { getCriadouroLabel } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import { useContractorStore, normalizeForemanName, type Contractor, type ContractorStatus } from '@/store/contractorStore'

interface ContractorFormState {
  name: string
  legal_name: string
  cnpj: string
  status: ContractorStatus
  notes: string
}

const emptyContractor: ContractorFormState = {
  name: '',
  legal_name: '',
  cnpj: '',
  status: 'active' as const,
  notes: '',
}

export function EmpreiteirosPanel() {
  const {
    contractors,
    foremen,
    rdoLinks,
    syncError,
    load,
    addContractor,
    updateContractor,
    removeContractor,
    addForeman,
    updateForeman,
    removeForeman,
    linkRdo,
    resolveRdoContractor,
  } = useContractorStore()
  const [form, setForm] = useState(emptyContractor)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [foremanForm, setForemanForm] = useState({ name: '', phone: '', notes: '' })
  const [editingForemanId, setEditingForemanId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const activeContractors = contractors.filter((item) => !item.deleted_at)
  const selected = activeContractors.find((item) => item.id === selectedId) ?? activeContractors[0] ?? null
  const selectedForemen = foremen.filter((item) => !item.deleted_at && item.contractor_id === selected?.id)

  const unresolvedRdos = useMemo(() => {
    return readLocalRdoSabesp()
      .filter((rdo) => rdo.encarregado && !resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado }))
      .slice(0, 20)
  }, [rdoLinks, foremen, contractors, resolveRdoContractor])

  function startEdit(contractor: Contractor) {
    setEditingId(contractor.id)
    setSelectedId(contractor.id)
    setForm({
      name: contractor.name,
      legal_name: contractor.legal_name ?? '',
      cnpj: contractor.cnpj ?? '',
      status: contractor.status,
      notes: contractor.notes ?? '',
    })
  }

  async function saveContractor() {
    if (!form.name.trim()) return
    if (editingId) {
      await updateContractor(editingId, form)
    } else {
      const id = await addContractor(form)
      setSelectedId(id)
    }
    setEditingId(null)
    setForm(emptyContractor)
  }

  function startForemanEdit(foremanId: string) {
    const foreman = foremen.find((item) => item.id === foremanId)
    if (!foreman) return
    setEditingForemanId(foreman.id)
    setForemanForm({ name: foreman.name, phone: foreman.phone ?? '', notes: foreman.notes ?? '' })
  }

  async function saveForeman() {
    if (!selected || !foremanForm.name.trim()) return
    if (editingForemanId) {
      await updateForeman(editingForemanId, foremanForm)
    } else {
      await addForeman({ contractor_id: selected.id, ...foremanForm })
    }
    setEditingForemanId(null)
    setForemanForm({ name: '', phone: '', notes: '' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Empreiteiros</h2>
          <p className="text-sm text-[#a3a3a3]">
            Cadastre empreiteiras e vincule encarregados para o RDO sair com tag automatica no historico e na medicao.
          </p>
        </div>
        {syncError && (
          <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Cache local ativo: {syncError}
          </span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Building2 size={18} className="text-[#f97316]" />
            <h3 className="font-semibold">Cadastro de empreiteira</h3>
          </div>
          <div className="space-y-3">
            <input
              value={form.name}
              onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
              placeholder="Nome da empreiteira"
              className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
            />
            <input
              value={form.legal_name}
              onChange={(event) => setForm((value) => ({ ...value, legal_name: event.target.value }))}
              placeholder="Razao social"
              className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.cnpj}
                onChange={(event) => setForm((value) => ({ ...value, cnpj: event.target.value }))}
                placeholder="CNPJ"
                className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
              />
              <select
                value={form.status}
                onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as 'active' | 'inactive' }))}
                className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
              >
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
              </select>
            </div>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
              placeholder="Observacoes"
              rows={3}
              className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveContractor}
                className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c]"
              >
                {editingId ? <Save size={14} /> : <Plus size={14} />}
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setForm(emptyContractor) }}
                  className="rounded-lg border border-[#525252] px-4 py-2 text-sm text-[#a3a3a3] hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Users size={18} className="text-[#f97316]" />
            <h3 className="font-semibold">Empreiteiras cadastradas</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeContractors.map((contractor) => (
              <button
                type="button"
                key={contractor.id}
                onClick={() => setSelectedId(contractor.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selected?.id === contractor.id
                    ? 'border-[#f97316] bg-[#f97316]/10'
                    : 'border-[#525252] bg-[#1f1f1f] hover:border-[#6b6b6b]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{contractor.name}</p>
                    <p className="text-xs text-[#a3a3a3]">{contractor.cnpj || 'Sem CNPJ'}</p>
                  </div>
                  <span className="rounded-full bg-[#484848] px-2 py-0.5 text-[10px] uppercase text-[#a3a3a3]">
                    {contractor.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => { event.stopPropagation(); startEdit(contractor) }}
                    className="inline-flex items-center gap-1 rounded border border-[#525252] px-2 py-1 text-xs text-[#a3a3a3] hover:text-white"
                  >
                    <Edit3 size={12} /> Editar
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => { event.stopPropagation(); void removeContractor(contractor.id) }}
                    className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={12} /> Excluir
                  </span>
                </div>
              </button>
            ))}
            {activeContractors.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#525252] p-6 text-sm text-[#a3a3a3]">
                Nenhuma empreiteira cadastrada ainda.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <h3 className="mb-1 font-semibold text-white">Encarregados vinculados</h3>
          <p className="mb-4 text-xs text-[#a3a3a3]">
            O nome lido no RDO e comparado normalizado. Ex.: "Joao Carlos" e "Joao  Carlos" viram o mesmo vinculo.
          </p>
          {selected ? (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-[1fr,150px,auto]">
                <input
                  value={foremanForm.name}
                  onChange={(event) => setForemanForm((value) => ({ ...value, name: event.target.value }))}
                  placeholder={`Encarregado da ${selected.name}`}
                  className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
                />
                <input
                  value={foremanForm.phone}
                  onChange={(event) => setForemanForm((value) => ({ ...value, phone: event.target.value }))}
                  placeholder="Telefone"
                  className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
                />
                <button
                  type="button"
                  onClick={saveForeman}
                  className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c]"
                >
                  {editingForemanId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
              <textarea
                value={foremanForm.notes}
                onChange={(event) => setForemanForm((value) => ({ ...value, notes: event.target.value }))}
                placeholder="Observacoes do encarregado"
                rows={2}
                className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
              />
              <div className="space-y-2">
                {selectedForemen.map((foreman) => (
                  <div key={foreman.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{foreman.name}</p>
                      <p className="text-xs text-[#6b6b6b]">{normalizeForemanName(foreman.name)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startForemanEdit(foreman.id)} className="text-[#a3a3a3] hover:text-white">
                        <Edit3 size={15} />
                      </button>
                      <button type="button" onClick={() => void removeForeman(foreman.id)} className="text-red-300 hover:text-red-200">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {selectedForemen.length === 0 && <p className="text-sm text-[#6b6b6b]">Nenhum encarregado vinculado a esta empreiteira.</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#a3a3a3]">Cadastre uma empreiteira para vincular encarregados.</p>
          )}
        </section>

        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Link2 size={18} className="text-[#f97316]" />
            <h3 className="font-semibold">RDOs sem empreiteira identificada</h3>
          </div>
          <div className="space-y-2">
            {unresolvedRdos.map((rdo) => (
              <div key={rdo.id} className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{rdo.report_date} - {rdo.encarregado}</p>
                    <p className="text-xs text-[#a3a3a3]">
                      {getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)} - {rdo.rua_beco || 'Sem rua/beco'}
                    </p>
                  </div>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return
                      void linkRdo({
                        rdo_id: rdo.id,
                        rdo_type: 'sabesp',
                        contractor_id: event.target.value,
                        foreman_name: rdo.encarregado ?? '',
                        source: 'manual',
                      })
                    }}
                    className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
                  >
                    <option value="">Vincular empreiteira...</option>
                    {activeContractors.map((contractor) => (
                      <option key={contractor.id} value={contractor.id}>{contractor.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {unresolvedRdos.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#525252] p-6 text-sm text-[#a3a3a3]">
                Todos os RDOs Sabesp locais com encarregado ja possuem empreiteira identificada.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
