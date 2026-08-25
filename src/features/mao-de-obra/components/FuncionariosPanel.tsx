import { useState, useMemo } from 'react'
import { Plus, Download, Search, ChevronDown, ChevronUp, X, AlertTriangle, UserMinus, UserCheck } from 'lucide-react'
import { usePermissaoEscrita, ROLES_MAO_DE_OBRA_WRITE } from '@/lib/roles'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useShallow } from 'zustand/react/shallow'
import type { Worker, ContractType, ScheduleType } from '@/types'
import { AcoesDaLinha } from './AcoesDaLinha'
import { DesligarOuExcluirDialog } from './DesligarOuExcluirDialog'
import { funcionarioEstaAtivo, contarHistoricoDoFuncionario, decidirExclusao } from '@/lib/funcionarioAtivo'
import type { HistoricoDoFuncionario, DecisaoDeExclusao } from '@/lib/funcionarioAtivo'
import { EquipesSection } from './EquipesSection'

type ObraOption = { id: string; code: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

// O `#6b6b6b` do "Inativo" dava 2,04:1 sobre a linha (#3d3d3d) e 1,72:1 sobre o hover (#484848) —
// era o selo mais importante da tela e o único ilegível. `#c9c9c9` dá 6,56 e 5,52. Cinza porque
// desligado não é erro nem alerta; só não está mais na ativa.
const STATUS_COLOR: Record<string, string> = {
  active:    '#22c55e',
  inactive:  '#c9c9c9',
  suspended: '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', suspended: 'Suspenso',
}
const CONTRACT_LABEL: Record<ContractType, string> = {
  clt: 'CLT', pj: 'PJ', freelancer: 'Freelancer', apprentice: 'Aprendiz',
}
const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  standard: 'Padrão (5x2)', '6x1': '6x1', '5x2': '5x2', '12x36': '12x36', daily: 'Diarista', custom: 'Customizado',
}

// ─── Worker Form Modal ────────────────────────────────────────────────────────

interface WorkerFormProps {
  initial?: Worker
  crews: { id: string; name: string }[]
  projects: ObraOption[]
  onSave: (data: Omit<Worker, 'id'>) => void
  onClose: () => void
}

function WorkerFormModal({ initial, crews, projects, onSave, onClose }: WorkerFormProps) {
  const [form, setForm] = useState<Partial<Omit<Worker, 'id'>>>({
    name:               initial?.name ?? '',
    role:               initial?.role ?? '',
    cpfMasked:          initial?.cpfMasked ?? '***.***.**-**',
    crewId:             initial?.crewId ?? '',
    status:             initial?.status ?? 'active',
    hourlyRate:         initial?.hourlyRate ?? 0,
    certifications:     initial?.certifications ?? [],
    biometricToken:     initial?.biometricToken ?? '',
    registrationNumber: initial?.registrationNumber ?? '',
    department:         initial?.department ?? '',
    email:              initial?.email ?? '',
    phone:              initial?.phone ?? '',
    admissionDate:      initial?.admissionDate ?? '',
    contractType:       initial?.contractType ?? 'clt',
    scheduleType:       initial?.scheduleType ?? 'standard',
    workFront:          initial?.workFront ?? '',
    grossSalary:        initial?.grossSalary ?? 0,
    siteId:             initial?.siteId ?? '',
    locationNote:       initial?.locationNote ?? '',
  })
  const [error, setError] = useState('')

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) { setError('Nome é obrigatório'); return }
    if (!form.role?.trim()) { setError('Função é obrigatória'); return }
    // crewId is optional — can be assigned later
    setError('')
    onSave(form as Omit<Worker, 'id'>)
  }

  const fieldClass = 'w-full bg-[#333333] border border-[#1f3c5e] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316]'
  const labelClass = 'block text-[#adadad] text-xs mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#333333] border border-[#525252] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#525252]">
          <h2 className="text-[#f5f5f5] text-base font-semibold">{initial ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
          <button onClick={onClose} className="text-[#adadad] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Col 1 */}
          <div className="col-span-2">
            <label className={labelClass}>Nome completo *</label>
            <input className={fieldClass} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Função / Cargo *</label>
            <input className={fieldClass} value={form.role ?? ''} onChange={(e) => set('role', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Matrícula</label>
            <input className={fieldClass} value={form.registrationNumber ?? ''} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="MAT-0001" />
          </div>
          <div>
            <label className={labelClass}>Departamento / Setor</label>
            <input className={fieldClass} value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Frente de Trabalho</label>
            <input className={fieldClass} value={form.workFront ?? ''} onChange={(e) => set('workFront', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Local / Obra (da Torre de Controle)</label>
            <select className={fieldClass} value={form.siteId ?? ''} onChange={(e) => set('siteId', e.target.value)}>
              <option value="">— Selecione a obra —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Local (texto livre)</label>
            <input className={fieldClass} value={form.locationNote ?? ''} onChange={(e) => set('locationNote', e.target.value)} placeholder="Se não for uma obra cadastrada, escreva o local aqui" />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input type="email" className={fieldClass} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input className={fieldClass} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 9 9999-9999" />
          </div>
          <div>
            <label className={labelClass}>Data de Admissão</label>
            <input type="date" className={fieldClass} value={form.admissionDate ?? ''} onChange={(e) => set('admissionDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tipo de Contrato</label>
            <select className={fieldClass} value={form.contractType ?? 'clt'} onChange={(e) => set('contractType', e.target.value as ContractType)}>
              {Object.entries(CONTRACT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Regime de Trabalho</label>
            <select className={fieldClass} value={form.scheduleType ?? 'standard'} onChange={(e) => set('scheduleType', e.target.value as ScheduleType)}>
              {Object.entries(SCHEDULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Equipe</label>
            <select className={fieldClass} value={form.crewId ?? ''} onChange={(e) => set('crewId', e.target.value)}>
              <option value="">— Sem equipe (definir depois) —</option>
              {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={fieldClass} value={form.status ?? 'active'} onChange={(e) => set('status', e.target.value as Worker['status'])}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="suspended">Suspenso</option>
            </select>
          </div>
          {/* Data e motivo só existem quando alguém saiu. Aparecem aqui para poder corrigir o que
              foi preenchido no diálogo de desligamento — não é onde se desliga alguém. */}
          {form.status === 'inactive' && (
            <>
              <div>
                <label className={labelClass}>Data do desligamento</label>
                <input type="date" className={fieldClass} value={form.desligamentoData ?? ''}
                       onChange={(e) => set('desligamentoData', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Motivo do desligamento</label>
                <input className={fieldClass} value={form.desligamentoMotivo ?? ''}
                       onChange={(e) => set('desligamentoMotivo', e.target.value)}
                       placeholder="Pedido de demissão, fim de obra…" />
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>Taxa Horária (R$)</label>
            <input type="number" step="0.01" min="0" className={fieldClass} value={form.hourlyRate ?? 0} onChange={(e) => set('hourlyRate', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>Salário Bruto (R$)</label>
            <input type="number" step="0.01" min="0" className={fieldClass} value={form.grossSalary ?? 0} onChange={(e) => set('grossSalary', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>CPF (mascarado)</label>
            <input className={fieldClass} value={form.cpfMasked ?? ''} onChange={(e) => set('cpfMasked', e.target.value)} placeholder="***.***.***-XX" />
          </div>

          {error && <p className="col-span-2 text-[#fca5a5] text-xs">{error}</p>}

          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#525252] text-[#adadad] text-sm hover:text-[#f5f5f5] hover:border-[#1f3c5e]">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-sm font-semibold hover:bg-[#ea6c10]">
              {initial ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Expanded row detail ───────────────────────────────────────────────────────

function ExpandedRow({ worker, crews }: { worker: Worker; crews: { id: string; name: string }[] }) {
  const crewName = crews.find((c) => c.id === worker.crewId)?.name ?? '—'
  const sites = useTorreStore((s) => s.sites)
  const obraName = worker.siteId ? (sites.find((s) => s.id === worker.siteId)?.name ?? '—') : '—'
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 bg-[#333333] border-t border-[#525252] text-xs">
      <div>
        <p className="text-[#adadad] mb-0.5">E-mail</p>
        <p className="text-[#f5f5f5]">{worker.email ?? '—'}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Telefone</p>
        <p className="text-[#f5f5f5]">{worker.phone ?? '—'}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Equipe</p>
        <p className="text-[#f5f5f5]">{crewName}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Frente de Trabalho</p>
        <p className="text-[#f5f5f5]">{worker.workFront ?? '—'}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Admissão</p>
        <p className="text-[#f5f5f5]">
          {worker.admissionDate ? new Date(worker.admissionDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
        </p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Contrato</p>
        <p className="text-[#f5f5f5]">{worker.contractType ? CONTRACT_LABEL[worker.contractType] : '—'}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Regime</p>
        <p className="text-[#f5f5f5]">{worker.scheduleType ? SCHEDULE_LABEL[worker.scheduleType] : '—'}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Taxa Horária</p>
        <p className="text-[#f5f5f5]">R${worker.hourlyRate.toFixed(2)}/h</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Salário Bruto</p>
        <p className="text-[#f5f5f5]">{typeof worker.grossSalary === 'number' && worker.grossSalary > 0 ? `R$${worker.grossSalary.toFixed(2)}` : '—'}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Obra</p>
        <p className="text-[#f5f5f5]">{obraName}</p>
      </div>
      <div>
        <p className="text-[#adadad] mb-0.5">Local</p>
        <p className="text-[#f5f5f5]">{worker.locationNote || '—'}</p>
      </div>
      {worker.certifications.length > 0 && (
        <div className="col-span-2 md:col-span-4">
          <p className="text-[#adadad] mb-1">Certificações</p>
          <div className="flex flex-wrap gap-1.5">
            {worker.certifications.map((cert) => {
              const c = cert.status === 'valid' ? '#22c55e' : cert.status === 'expiring' ? '#f59e0b' : '#ef4444'
              return (
                <span key={cert.id} className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor: `${c}18`, color: c }}>
                  {cert.type} · {cert.status === 'valid' ? 'Válida' : cert.status === 'expiring' ? 'Vencendo' : 'Expirada'}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Worker table row ─────────────────────────────────────────────────────────

function WorkerRow({ worker: w, crews, expandedId, onToggle, onEdit, onDelete, onDesligar, onReativar }: {
  worker: Worker
  crews: { id: string; name: string }[]
  expandedId: string | null
  onToggle: (id: string | null) => void
  onEdit: (w: Worker) => void
  onDelete: (w: Worker) => void
  onDesligar: (w: Worker) => void
  onReativar: (w: Worker) => void
}) {
  const isExpanded = expandedId === w.id
  const sc = STATUS_COLOR[w.status]
  const crewName = crews.find((c) => c.id === w.crewId)?.name
  // Desligado NÃO some da lista (escolha do cliente: "sempre visível, apagado e com selo"). Some
  // da folha, do custo e da escala — mas continua no holerite antigo e no histórico da obra.
  const ativo = funcionarioEstaAtivo(w)
  return (
    <>
      <tr
        className={`border-b border-[#525252] hover:bg-[#484848] cursor-pointer${ativo ? '' : ' opacity-60'}`}
        onClick={() => onToggle(isExpanded ? null : w.id)}
      >
        <td className="px-3 py-2.5 text-[#adadad] font-mono">{w.registrationNumber ?? '—'}</td>
        <td className="px-3 py-2.5 text-[#f5f5f5] font-medium max-w-[160px] truncate">{w.name}</td>
        <td className="px-3 py-2.5 text-[#c9c9c9] max-w-[140px] truncate">{w.role}</td>
        <td className="px-3 py-2.5">
          {crewName
            ? <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f97316]/15 text-[#ffa055]">{crewName}</span>
            : <span className="text-[#adadad] italic text-[11px]">Sem equipe</span>}
        </td>
        <td className="px-3 py-2.5 text-[#adadad] hidden md:table-cell">{w.department ?? '—'}</td>
        <td className="px-3 py-2.5 text-[#f5f5f5] font-mono hidden md:table-cell">R${w.hourlyRate.toFixed(2)}</td>
        <td className="px-3 py-2.5">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: `${sc}18`, color: sc }}>
            {STATUS_LABEL[w.status]}
          </span>
          {!ativo && w.desligamentoData && (
            <span className="ml-1.5 whitespace-nowrap text-[10px] text-[#a3a3a3]"
                  title={w.desligamentoMotivo ? `Motivo: ${w.desligamentoMotivo}` : undefined}>
              desde {w.desligamentoData.slice(8, 10)}/{w.desligamentoData.slice(5, 7)}/{w.desligamentoData.slice(0, 4)}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div onClick={(e) => e.stopPropagation()}>
              <AcoesDaLinha
                descricao={`o funcionário ${w.name}`}
                onEditar={() => onEdit(w)}
                onExcluir={() => onDelete(w)}
                acaoExtra={ativo
                  ? { icone: UserMinus, titulo: `Desligar ${w.name}`, onClick: () => onDesligar(w) }
                  : { icone: UserCheck, titulo: `Reativar ${w.name}`, onClick: () => onReativar(w) }}
                // A confirmação é o diálogo de três saídas, não o aviso do navegador: aqui as
                // opções são desligar, excluir mesmo assim e cancelar.
                confirmar={false}
              />
            </div>
            {isExpanded ? <ChevronUp size={12} className="text-[#adadad]" /> : <ChevronDown size={12} className="text-[#adadad]" />}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <ExpandedRow worker={w} crews={crews} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function FuncionariosPanel() {
  const {
    workers, crews, shifts, timecards, absences, assessments,
    addWorker, updateWorker, removeWorker, inativarWorker, reativarWorker, restaurarWorker,
    addCrew, updateCrew, removeCrew,
  } = useMaoDeObraStore(
    useShallow((s) => ({
      workers: s.workers, crews: s.crews,
      // Para contar o que se perde ao excluir. São as quatro coleções que apontam para `workerId`
      // e não têm chave estrangeira — o rastro que ficaria órfão.
      shifts: s.shifts, timecards: s.timecards, absences: s.absences, assessments: s.assessments,
      addWorker: s.addWorker, updateWorker: s.updateWorker, removeWorker: s.removeWorker,
      inativarWorker: s.inativarWorker, reativarWorker: s.reativarWorker,
      restaurarWorker: s.restaurarWorker,
      addCrew: s.addCrew, updateCrew: s.updateCrew, removeCrew: s.removeCrew,
    }))
  )
  const sites = useTorreStore((s) => s.sites)

  const [search,      setSearch]      = useState('')
  const [filterRole,  setFilterRole]  = useState('')
  const [filterDept,  setFilterDept]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCrew,  setFilterCrew]  = useState('')
  const [groupByCrew, setGroupByCrew] = useState(false)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [avisoPermissao, setAvisoPermissao] = useState<string | null>(null)
  /**
   * O último excluído, guardado para o desfazer.
   *
   * Guardar o registro inteiro (e não só o id) é o que faz o desfazer funcionar sem depender de
   * uma leitura do servidor — e é o que faz ele funcionar em Demonstração.
   */
  const [ultimoExcluido, setUltimoExcluido] = useState<Worker | null>(null)
  const [falhaAoDesfazer, setFalhaAoDesfazer] = useState(false)
  /** Quem está no diálogo de desligar/excluir, com a conta do rastro já feita. */
  const [emDecisao, setEmDecisao] = useState<
    { worker: Worker; historico: HistoricoDoFuncionario; decisao: DecisaoDeExclusao } | null
  >(null)
  const permissao = usePermissaoEscrita(ROLES_MAO_DE_OBRA_WRITE)

  const roles = useMemo(() => [...new Set(workers.map((w) => w.role))].sort(), [workers])
  const depts = useMemo(() => [...new Set(workers.map((w) => w.department).filter(Boolean))].sort() as string[], [workers])

  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const filtered = useMemo(() => workers.filter((w) => {
    // Funcionário sem obra = geral (aparece em todas). Só esconde quem é de OUTRA obra.
    if (activeObraId && w.siteId && w.siteId !== activeObraId) return false
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.registrationNumber?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterRole   && w.role !== filterRole)       return false
    if (filterDept   && w.department !== filterDept) return false
    if (filterStatus && w.status !== filterStatus)   return false
    if (filterCrew === '__none__' && w.crewId)       return false
    if (filterCrew && filterCrew !== '__none__' && w.crewId !== filterCrew) return false
    return true
  }), [workers, search, filterRole, filterDept, filterStatus, filterCrew, activeObraId])

  const groupedByCrew = useMemo(() => {
    if (!groupByCrew) return null
    const groups: { crew: { id: string; name: string } | null; workers: Worker[] }[] = []
    const crewMap = new Map<string, Worker[]>()
    const noCrewWorkers: Worker[] = []
    for (const w of filtered) {
      if (!w.crewId) { noCrewWorkers.push(w); continue }
      const arr = crewMap.get(w.crewId) ?? []
      arr.push(w)
      crewMap.set(w.crewId, arr)
    }
    for (const c of crews) {
      const ws = crewMap.get(c.id)
      if (ws && ws.length > 0) groups.push({ crew: c, workers: ws })
    }
    if (noCrewWorkers.length > 0) groups.push({ crew: null, workers: noCrewWorkers })
    return groups
  }, [groupByCrew, filtered, crews])

  function handleSave(data: Omit<Worker, 'id'>) {
    // O gate da loja devolve sem fazer nada quando o papel não autoriza. Fechar o formulário aqui
    // significava perder tudo o que a pessoa digitou, sem uma linha de aviso — ela só descobria
    // que não salvou quando o funcionário não aparecia na lista.
    if (!permissao.pode) {
      setAvisoPermissao(permissao.explicacao ?? 'Seu acesso não permite salvar funcionários.')
      return
    }
    if (editingWorker) {
      updateWorker(editingWorker.id, data)
    } else {
      addWorker(data)
    }
    setShowForm(false)
    setEditingWorker(null)
  }

  function handleEdit(worker: Worker) {
    setEditingWorker(worker)
    setShowForm(true)
  }

  /**
   * Abre a decisão em vez de perguntar sim/não.
   *
   * Antes eram dois avisos seguidos e contraditórios — "os apontamentos continuam no histórico" e
   * "esta ação não pode ser desfeita" — e nenhum dos dois dizia que dava para só desligar. O
   * diálogo conta o rastro real desta pessoa antes de oferecer qualquer coisa.
   */
  function handleDelete(worker: Worker) {
    if (!permissao.pode) {
      setAvisoPermissao(permissao.explicacao ?? 'Seu acesso não permite excluir funcionários.')
      return
    }
    const historico = contarHistoricoDoFuncionario(worker.id, { shifts, timecards, absences, assessments })
    setEmDecisao({ worker, historico, decisao: decidirExclusao(historico) })
  }

  /** O botão de desligar direto na linha cai no MESMO diálogo — a conta do rastro também informa
   *  quem só quer desligar, e ali ele preenche data e motivo. */
  function handleDesligar(worker: Worker) {
    if (!permissao.pode) {
      setAvisoPermissao(permissao.explicacao ?? 'Seu acesso não permite alterar funcionários.')
      return
    }
    const historico = contarHistoricoDoFuncionario(worker.id, { shifts, timecards, absences, assessments })
    setEmDecisao({ worker, historico, decisao: decidirExclusao(historico) })
  }

  function handleReativar(worker: Worker) {
    if (!permissao.pode) {
      setAvisoPermissao(permissao.explicacao ?? 'Seu acesso não permite alterar funcionários.')
      return
    }
    reativarWorker(worker.id)
  }

  function exportCSV() {
    const header = ['Matrícula', 'Nome', 'Função', 'Departamento', 'Contrato', 'Admissão', 'Taxa/h', 'Status']
    const rows = filtered.map((w) => [
      w.registrationNumber ?? '',
      w.name,
      w.role,
      w.department ?? '',
      w.contractType ? CONTRACT_LABEL[w.contractType] : '',
      w.admissionDate ?? '',
      w.hourlyRate.toFixed(2),
      STATUS_LABEL[w.status],
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'funcionarios.csv' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const selectClass = 'bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-[#f5f5f5] text-xs focus:outline-none focus:border-[#f97316]'

  return (
    <div className="flex flex-col gap-4">
      {/* Equipes — vieram da aba Escala (25/08/2026). Elas não têm relação com turno nem com
          posto; o que elas agrupam é FUNCIONÁRIO, e o vínculo (`Worker.crewId`) já mora aqui. */}
      <EquipesSection
        crews={crews}
        workers={workers}
        addCrew={addCrew}
        updateCrew={updateCrew}
        removeCrew={removeCrew}
      />

      {/* O desfazer. Antes desta faixa, excluir pela interface era irreversível: a função de
          restauração existia no servidor e nada no app a chamava. */}
      {ultimoExcluido && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2.5 text-[12px] text-[#d4d4d4]">
          <UserMinus size={14} className="shrink-0 text-[#a3a3a3]" />
          <span><b className="text-[#f5f5f5]">{ultimoExcluido.name}</b> foi excluído.</span>
          <button
            type="button"
            onClick={async () => {
              const ok = await restaurarWorker(ultimoExcluido)
              if (ok) setUltimoExcluido(null)
              else setFalhaAoDesfazer(true)
            }}
            className="rounded-lg border border-[#f97316]/50 px-2.5 py-1 text-[11px] font-semibold text-[#ffa055] hover:bg-[#f97316]/10"
          >
            Desfazer
          </button>
          <button type="button" onClick={() => { setUltimoExcluido(null); setFalhaAoDesfazer(false) }}
                  className="ml-auto text-[#a3a3a3] hover:text-[#f5f5f5]" aria-label="Dispensar">
            <X size={14} />
          </button>
          {falhaAoDesfazer && (
            <p className="w-full text-[11px] text-[#fca5a5]">
              Não deu para desfazer agora — sem conexão ou sem permissão. O cadastro segue excluído
              no servidor; tente de novo com a rede de volta.
            </p>
          )}
        </div>
      )}

      {(!permissao.pode || avisoPermissao) && (
        <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.08] px-3 py-2.5 text-[11px] text-[#fbbf24]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>Este acesso não cadastra funcionários.</strong>{' '}
            {avisoPermissao ?? permissao.explicacao}{' '}
            O aviso aparece de propósito: aceitar o cadastro e perdê-lo depois é pior.
          </span>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#adadad]" />
          <input
            className="w-full bg-[#333333] border border-[#525252] rounded-lg pl-8 pr-3 py-1.5 text-[#f5f5f5] text-xs focus:outline-none focus:border-[#f97316]"
            placeholder="Buscar por nome ou matrícula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={selectClass} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Todas as funções</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={selectClass} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Todos os setores</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="suspended">Suspenso</option>
        </select>
        <select className={selectClass} value={filterCrew} onChange={(e) => setFilterCrew(e.target.value)}>
          <option value="">Todas as equipes</option>
          <option value="__none__">Sem equipe</option>
          {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setGroupByCrew(!groupByCrew)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            groupByCrew
              ? 'bg-[#f97316]/20 border-[#f97316] text-[#ffa055]'
              : 'border-[#525252] text-[#adadad] hover:text-[#f5f5f5]'
          }`}
        >
          Agrupar por Equipe
        </button>
        <span className="text-[#adadad] text-xs ml-auto">{filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}</span>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#adadad] text-xs hover:text-[#f5f5f5] hover:border-[#1f3c5e]">
          <Download size={12} /> CSV
        </button>
        <button onClick={() => { setEditingWorker(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea6c10]">
          <Plus size={13} /> Novo Funcionário
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#525252]">
                {['Matrícula', 'Nome', 'Função', 'Equipe', 'Departamento', 'Taxa/h', 'Status', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[#adadad] font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedByCrew ? (
                groupedByCrew.map((group) => (
                  <>{/* Crew group header */}
                    <tr key={`grp-${group.crew?.id ?? 'none'}`} className="bg-[#0d1f3c]">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${group.crew ? 'bg-[#f97316]' : 'bg-[#6b6b6b]'}`} />
                          <span className="text-[#f5f5f5] text-xs font-semibold">
                            {group.crew?.name ?? 'Sem equipe definida'}
                          </span>
                          <span className="text-[#adadad] text-[11px]">({group.workers.length})</span>
                        </div>
                      </td>
                    </tr>
                    {group.workers.map((w) => (
                      <WorkerRow key={w.id} worker={w} crews={crews} expandedId={expandedId} onToggle={setExpandedId} onEdit={handleEdit} onDelete={handleDelete} onDesligar={handleDesligar} onReativar={handleReativar} />
                    ))}
                  </>
                ))
              ) : (
                filtered.map((w) => (
                  <WorkerRow key={w.id} worker={w} crews={crews} expandedId={expandedId} onToggle={setExpandedId} onEdit={handleEdit} onDelete={handleDelete} onDesligar={handleDesligar} onReativar={handleReativar} />
                ))
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#adadad]">Nenhum colaborador encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {emDecisao && (
        <DesligarOuExcluirDialog
          nome={emDecisao.worker.name}
          historico={emDecisao.historico}
          decisao={emDecisao.decisao}
          onDesligar={({ data, motivo }) => {
            inativarWorker(emDecisao.worker.id, { data, motivo })
            setEmDecisao(null)
          }}
          onExcluir={() => {
            removeWorker(emDecisao.worker.id)
            if (expandedId === emDecisao.worker.id) setExpandedId(null)
            setUltimoExcluido(emDecisao.worker)
            setFalhaAoDesfazer(false)
            setEmDecisao(null)
          }}
          onCancelar={() => setEmDecisao(null)}
        />
      )}

      {showForm && (
        <WorkerFormModal
          initial={editingWorker ?? undefined}
          crews={crews}
          projects={sites}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingWorker(null) }}
        />
      )}
    </div>
  )
}
