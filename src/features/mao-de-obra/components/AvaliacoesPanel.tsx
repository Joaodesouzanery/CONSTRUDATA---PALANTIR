import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useProjetosStore } from '@/store/projetosStore'
import {
  CRITERIA_KEYS,
  CRITERIA_LABELS,
  RATING_LABELS,
  RATING_COLORS,
  countAbsencesInPeriod,
  computeFinalScore,
  computePenalty,
  classify,
} from '@/features/mao-de-obra/utils/assessmentEngine'
import type { AssessmentCriteria, AssessmentRating, WorkerAssessment } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_CRITERIA: AssessmentCriteria = {
  qualidade: 7, retrabalho: 7, organizacao: 7, produtividade: 7,
  comprometimento: 7, orientacoes: 7, confiabilidade: 7, lideranca: 7,
}

function RatingBadge({ rating }: { rating: AssessmentRating }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RATING_COLORS[rating]}`}>
      {RATING_LABELS[rating]}
    </span>
  )
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}
function monthStartISO() {
  return todayISO().slice(0, 8) + '01' // yyyy-MM-01
}

// ─── AssessmentDialog ─────────────────────────────────────────────────────────

interface AssessmentDialogProps {
  initial?: WorkerAssessment
  onClose: () => void
}

function AssessmentDialog({ initial, onClose }: AssessmentDialogProps) {
  const { workers, absences, addAssessment, updateAssessment } = useMaoDeObraStore(
    useShallow((s) => ({
      workers: s.workers,
      absences: s.absences,
      addAssessment: s.addAssessment,
      updateAssessment: s.updateAssessment,
    })),
  )
  const projectList = useProjetosStore((s) => s.projects)

  const [workerId, setWorkerId]   = useState(initial?.workerId ?? '')
  const [siteId, setSiteId]       = useState(initial?.siteId ?? '')
  const [periodStart, setStart]   = useState(initial?.periodStart ?? monthStartISO())
  const [periodEnd, setEnd]       = useState(initial?.periodEnd ?? todayISO())
  const [lateCount, setLate]      = useState(initial?.lateCount ?? 0)
  const [criteria, setCriteria]   = useState<AssessmentCriteria>(initial?.criteria ?? EMPTY_CRITERIA)
  const [notes, setNotes]         = useState(initial?.notes ?? '')
  const [error, setError]         = useState('')

  const activeWorkers = workers.filter((w) => w.status === 'active' || w.id === initial?.workerId)

  const absInfo = useMemo(
    () => (workerId ? countAbsencesInPeriod(absences, workerId, periodStart, periodEnd) : { unjustified: 0, justified: 0, total: 0 }),
    [absences, workerId, periodStart, periodEnd],
  )
  const penalty = useMemo(
    () => computePenalty(absInfo.unjustified, absInfo.justified, lateCount),
    [absInfo, lateCount],
  )
  const notaFinal = useMemo(
    () => computeFinalScore(criteria, absInfo.unjustified, absInfo.justified, lateCount),
    [criteria, absInfo, lateCount],
  )
  const classificacao = classify(notaFinal)

  function setCrit(key: keyof AssessmentCriteria, value: number) {
    setCriteria((prev) => ({ ...prev, [key]: Math.max(0, Math.min(10, value)) }))
  }

  function handleSave() {
    if (!workerId) { setError('Selecione o colaborador'); return }
    if (periodEnd < periodStart) { setError('O fim do período deve ser após o início'); return }
    setError('')
    const data = {
      workerId,
      siteId: siteId || undefined,
      periodStart,
      periodEnd,
      absencesCount: absInfo.total,
      lateCount,
      criteria,
      notaFinal,
      classificacao,
      notes: notes.trim() || undefined,
    }
    if (initial) updateAssessment(initial.id, data)
    else addAssessment(data)
    onClose()
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
  const labelCls = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-6 mb-8">
        <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-5">
          {initial ? 'Editar Avaliação' : 'Nova Avaliação de Funcionário'}
        </h2>

        <div className="space-y-4">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Funcionário</label>
              <select
                className={inputCls}
                value={workerId}
                onChange={(e) => {
                  const wid = e.target.value
                  setWorkerId(wid)
                  const w = workers.find((x) => x.id === wid)
                  if (w?.siteId) setSiteId(w.siteId)
                }}
              >
                <option value="">Selecione...</option>
                {activeWorkers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} — {w.role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Obra</label>
              <select className={inputCls} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">— Sem obra —</option>
                {projectList.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Período — início</label>
              <input type="date" className={inputCls} value={periodStart} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Período — fim</label>
              <input type="date" className={inputCls} value={periodEnd} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {/* Faltas (auto) + Atrasos (manual) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <span className={labelCls}>Faltas no período (automático)</span>
              <div className="text-sm text-[var(--color-text-primary)] font-semibold">
                {absInfo.total} {absInfo.total === 1 ? 'falta' : 'faltas'}
                <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                  ({absInfo.unjustified} injustificada{absInfo.unjustified !== 1 ? 's' : ''} · {absInfo.justified} justificada{absInfo.justified !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Atrasos no período (manual)</label>
              <input
                type="number" min="0" step="1" className={inputCls}
                value={lateCount}
                onChange={(e) => setLate(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Não há registro automático de atrasos — informe manualmente.
              </p>
            </div>
          </div>

          {/* Critérios 0–10 */}
          <div>
            <span className={labelCls}>Critérios (0 a 10)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              {CRITERIA_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <label className="flex-1 text-sm text-[var(--color-text-secondary)]">{CRITERIA_LABELS[k]}</label>
                  <input
                    type="number" min="0" max="10" step="0.5"
                    className="w-20 px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    value={criteria[k]}
                    onChange={(e) => setCrit(k, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={labelCls}>Observações / Orientações (opcional)</label>
            <textarea
              className={`${inputCls} resize-none`} rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Orientações ao colaborador, contexto da avaliação..."
            />
          </div>

          {/* Resultado */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Nota Final {penalty > 0 && <span className="text-[#ef4444]">(penalização −{penalty.toFixed(2)})</span>}
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{notaFinal.toFixed(1)}</div>
            </div>
            <RatingBadge rating={classificacao} />
          </div>

          {error && <p className="text-xs text-[#ef4444]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
              {initial ? 'Salvar Alterações' : 'Salvar Avaliação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AvaliacoesPanel ──────────────────────────────────────────────────────────

export function AvaliacoesPanel() {
  const { assessments, workers, removeAssessment } = useMaoDeObraStore(
    useShallow((s) => ({
      assessments: s.assessments,
      workers: s.workers,
      removeAssessment: s.removeAssessment,
    })),
  )
  const projects = useProjetosStore((s) => s.projects)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkerAssessment | null>(null)

  const sorted = useMemo(
    () => [...assessments].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [assessments],
  )

  const avgNota = useMemo(() => {
    if (assessments.length === 0) return 0
    return assessments.reduce((s, a) => s + (a.notaFinal ?? 0), 0) / assessments.length
  }, [assessments])
  const atencaoCount = assessments.filter((a) => a.classificacao === 'atencao').length

  const workerName = (id: string) => workers.find((w) => w.id === id)?.name ?? id
  const obraName = (id?: string) => (id ? projects.find((p) => p.id === id)?.name ?? '—' : '—')
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

  function openNew() { setEditing(null); setDialogOpen(true) }
  function openEdit(a: WorkerAssessment) { setEditing(a); setDialogOpen(true) }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Avaliações', value: assessments.length, color: 'text-[var(--color-text-primary)]' },
          { label: 'Nota média', value: avgNota ? avgNota.toFixed(1) : '—', color: 'text-[var(--color-accent)]' },
          { label: 'Em atenção', value: atencaoCount, color: 'text-[#ef4444]' },
        ].map((stat) => (
          <div key={stat.label}
            className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Faltas são puxadas automaticamente do registro de Faltas; atrasos são informados manualmente.
        </p>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shrink-0">
          <span className="text-lg leading-none">+</span> Nova Avaliação
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                {['Funcionário', 'Obra', 'Período', 'Faltas', 'Atrasos', 'Nota Final', 'Classificação', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    Nenhuma avaliação registrada
                  </td>
                </tr>
              ) : sorted.map((a) => (
                <tr key={a.id} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{workerName(a.workerId)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{obraName(a.siteId)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{fmtDate(a.periodStart)} – {fmtDate(a.periodEnd)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-center">{a.absencesCount}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-center">{a.lateCount}</td>
                  <td className="px-4 py-3 font-bold text-[var(--color-text-primary)] text-center">{a.notaFinal.toFixed(1)}</td>
                  <td className="px-4 py-3"><RatingBadge rating={a.classificacao} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(a)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                        Editar
                      </button>
                      <button onClick={() => removeAssessment(a.id)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors">
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialogOpen && <AssessmentDialog initial={editing ?? undefined} onClose={() => { setDialogOpen(false); setEditing(null) }} />}
    </div>
  )
}
