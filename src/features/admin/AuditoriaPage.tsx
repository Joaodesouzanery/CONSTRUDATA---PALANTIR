/**
 * AuditoriaPage — visualizador do audit_log da organização.
 * Tabela imutável (sem edit/delete) — read-only.
 */
import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AuditRow {
  id:           number
  actor_id:     string | null
  action:       string
  table_name:   string
  record_id:    string | null
  created_at:   string
  after:        unknown
}

export function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from('audit_log')
        .select('id, actor_id, action, table_name, record_id, created_at, after')
        .order('created_at', { ascending: false })
        .limit(200)
      if (e) setError(e.message)
      else setRows((data ?? []) as AuditRow[])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <History size={20} />
        <h1 className="text-2xl font-bold">Auditoria</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Histórico imutável de todas as ações sensíveis na sua organização (últimas 200).
      </p>

      {error && <div className="mb-4 p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700">{error}</div>}
      {loading ? (
        <p className="text-gray-500">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">Nenhum registro ainda.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 border-b">
            <tr>
              <th className="text-left p-2">Quando</th>
              <th className="text-left p-2">Ação</th>
              <th className="text-left p-2">Tabela</th>
              <th className="text-left p-2">Registro</th>
              <th className="text-left p-2">Ator</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-mono text-xs">
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </td>
                <td className="p-2"><code className="text-xs">{r.action}</code></td>
                <td className="p-2"><code className="text-xs">{r.table_name}</code></td>
                <td className="p-2 font-mono text-xs text-gray-500">
                  {r.record_id ? r.record_id.slice(0, 12) : '—'}
                </td>
                <td className="p-2 font-mono text-xs text-gray-500">
                  {r.actor_id ? r.actor_id.slice(0, 8) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
