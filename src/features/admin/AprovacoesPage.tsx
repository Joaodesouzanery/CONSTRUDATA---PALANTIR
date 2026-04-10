/**
 * AprovacoesPage — fila de aprovações pendentes da organização.
 *
 * Lista pending_actions com status='pending'. Quem pode aprovar/rejeitar é
 * filtrado pela RPC (apenas roles configurados na approval_matrix).
 */
import { useEffect, useState } from 'react'
import { Check, X, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { ActionStatus, UserRole } from '@/types/database'

interface PendingAction {
  id:               string
  action_type:      string
  target_table:     string
  target_id:        string | null
  required_role:    UserRole
  status:           ActionStatus
  requested_by:     string
  rejected_reason:  string | null
  expires_at:       string
  created_at:       string
}

const ACTION_LABELS: Record<string, string> = {
  delete_fvs:           'Excluir FVS',
  update_fvs_closed:    'Editar FVS fechada',
  delete_rdo:           'Excluir RDO',
  update_rdo_closed:    'Editar RDO fechado',
  delete_po:            'Excluir Pedido de Compra',
  update_po_approved:   'Editar Pedido de Compra fechado',
  delete_invoice:       'Excluir Nota Fiscal',
  delete_plan_scenario: 'Excluir Cenário',
  delete_plan_trecho:   'Excluir Trecho',
  approve_budget:       'Aprovar orçamento',
  delete_project:       'Excluir projeto',
  delete_organization:  'Excluir organização',
}

export function AprovacoesPage() {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId,  setBusyId]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const profile = useAuth((s) => s.profile)

  async function load() {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('pending_actions')
      .select('id, action_type, target_table, target_id, required_role, status, requested_by, rejected_reason, expires_at, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (e) setError(e.message)
    else setActions((data ?? []) as PendingAction[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function approve(id: string) {
    setBusyId(id); setError(null)
    const { error: e } = await supabase.rpc('approve_pending_action', { p_action_id: id })
    if (e) setError(e.message)
    else await load()
    setBusyId(null)
  }

  async function reject(id: string) {
    const reason = window.prompt('Motivo da rejeição:')
    if (!reason) return
    setBusyId(id); setError(null)
    const { error: e } = await supabase.rpc('reject_pending_action', { p_action_id: id, p_reason: reason })
    if (e) setError(e.message)
    else await load()
    setBusyId(null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Aprovações pendentes</h1>
      <p className="text-sm text-gray-500 mb-6">
        Ações críticas que aguardam aprovação. Você só consegue aprovar ações cujo cargo
        requerido seja igual ou inferior ao seu (<strong>{profile?.role}</strong>).
      </p>

      {error && (
        <div className="mb-4 p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700">
          <AlertCircle size={14} className="inline mr-2" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Carregando…</p>
      ) : actions.length === 0 ? (
        <div className="p-8 text-center text-gray-500 border border-dashed rounded">
          Nenhuma ação pendente. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <div key={a.id} className="p-4 border rounded flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {ACTION_LABELS[a.action_type] ?? a.action_type}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    requer: {a.required_role}
                  </span>
                </div>
                <div className="text-sm">
                  Alvo: <code>{a.target_table}</code>
                  {a.target_id && <span className="text-gray-500"> #{a.target_id.slice(0, 8)}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Solicitado em {new Date(a.created_at).toLocaleString('pt-BR')} · expira{' '}
                  {new Date(a.expires_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => approve(a.id)}
                  disabled={busyId === a.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded disabled:opacity-50"
                >
                  <Check size={14} /> Aprovar
                </button>
                <button
                  onClick={() => reject(a.id)}
                  disabled={busyId === a.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded disabled:opacity-50"
                >
                  <X size={14} /> Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
