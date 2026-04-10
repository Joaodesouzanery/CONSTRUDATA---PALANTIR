/**
 * MatrizAprovacaoPage — owner edita a matriz de quem aprova o quê.
 *
 * Persiste em organizations.settings.approval_matrix (jsonb).
 * Cada action_type → role mínimo necessário para aprovar.
 */
import { useEffect, useState } from 'react'
import { Save, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { UserRole } from '@/types/database'

const ACTION_TYPES = [
  // Sprint 1 — Qualidade
  { key: 'delete_fvs',           label: 'Excluir FVS' },
  { key: 'update_fvs_closed',    label: 'Editar FVS já fechada' },
  // Sprint 2 — RDO
  { key: 'delete_rdo',           label: 'Excluir RDO' },
  { key: 'update_rdo_closed',    label: 'Editar RDO já fechado' },
  // Sprint 2 — Suprimentos
  { key: 'delete_po',            label: 'Excluir Pedido de Compra' },
  { key: 'update_po_approved',   label: 'Editar Pedido de Compra fechado' },
  { key: 'delete_invoice',       label: 'Excluir Nota Fiscal' },
  // Sprint 2 — Planejamento
  { key: 'delete_plan_scenario', label: 'Excluir Cenário (Planejamento)' },
  { key: 'delete_plan_trecho',   label: 'Excluir Trecho (Planejamento)' },
  // Globais
  { key: 'approve_budget',       label: 'Aprovar orçamento' },
  { key: 'delete_project',       label: 'Excluir projeto' },
  { key: 'delete_organization',  label: 'Excluir organização' },
] as const

const ROLES: UserRole[] = ['gerente', 'diretor', 'owner']

export function MatrizAprovacaoPage() {
  const profile = useAuth((s) => s.profile)
  const [matrix, setMatrix] = useState<Record<string, UserRole>>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const isOwner = profile?.role === 'owner'

  useEffect(() => {
    if (!profile) return
    (async () => {
      const { data, error: e } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .maybeSingle()
      if (e) setError(e.message)
      else if (data) {
        const settings = data.settings as { approval_matrix?: Record<string, UserRole> } | null
        setMatrix(settings?.approval_matrix ?? {})
      }
      setLoading(false)
    })()
  }, [profile])

  async function save() {
    if (!profile) return
    setSaving(true); setError(null)
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', profile.organization_id)
      .maybeSingle()

    const newSettings = {
      ...((org?.settings as object) ?? {}),
      approval_matrix: matrix,
    }

    const { error: e } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', profile.organization_id)

    if (e) setError(e.message)
    else setSavedAt(new Date().toLocaleTimeString('pt-BR'))
    setSaving(false)
  }

  if (!isOwner) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded text-amber-800 flex gap-3">
          <ShieldAlert size={20} />
          <div>
            <p className="font-semibold mb-1">Acesso restrito</p>
            <p className="text-sm">Apenas o owner pode editar a matriz de aprovação.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Matriz de aprovação</h1>
      <p className="text-sm text-gray-500 mb-6">
        Defina qual cargo precisa aprovar cada tipo de ação crítica. O próprio
        solicitante nunca pode aprovar — sempre requer alguém diferente com o cargo
        adequado.
      </p>

      {loading ? (
        <p className="text-gray-500">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {ACTION_TYPES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-gray-400 font-mono">{key}</p>
              </div>
              <select
                value={matrix[key] ?? 'diretor'}
                onChange={(e) => setMatrix({ ...matrix, [key]: e.target.value as UserRole })}
                className="text-sm border rounded px-3 py-1.5"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          ))}

          {error && <div className="p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700">{error}</div>}
          {savedAt && <p className="text-xs text-emerald-600">Salvo às {savedAt}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white text-sm font-semibold rounded disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Salvando…' : 'Salvar matriz'}
          </button>
        </div>
      )}
    </div>
  )
}
