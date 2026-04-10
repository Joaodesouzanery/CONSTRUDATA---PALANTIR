/**
 * ExportarDadosPage — exporta TODOS os dados da organização em JSON.
 *
 * Apenas owner pode acessar (forçado também na RPC).
 * Uso típico: rescisão de contrato, portabilidade LGPD, backup manual.
 */
import { useState } from 'react'
import { Download, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function ExportarDadosPage() {
  const profile = useAuth((s) => s.profile)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const isOwner = profile?.role === 'owner'

  async function handleExport() {
    if (!profile) return
    setError(null); setLoading(true)
    try {
      const { data, error: e } = await supabase.rpc('export_organization_data', {
        p_org_id: profile.organization_id,
      })
      if (e) throw e

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `construdata-export-${profile.organization_id}-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar')
    } finally {
      setLoading(false)
    }
  }

  if (!isOwner) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded text-amber-800 flex gap-3">
          <ShieldAlert size={20} />
          <div>
            <p className="font-semibold mb-1">Acesso restrito</p>
            <p className="text-sm">
              Apenas o <strong>owner</strong> da organização pode exportar dados. Seu cargo
              atual é <strong>{profile?.role}</strong>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Exportar dados da organização</h1>
      <p className="text-sm text-gray-500 mb-6">
        Baixa um arquivo JSON com TODOS os dados da sua organização: usuários, projetos,
        FVS, audit log etc. Usado para portabilidade (LGPD), backup ou rescisão de contrato.
      </p>

      <div className="p-6 border rounded space-y-4">
        <div className="text-sm text-gray-700">
          <p>O arquivo conterá:</p>
          <ul className="list-disc pl-5 mt-2 text-gray-600 text-xs space-y-1">
            <li>Dados da organização (configurações, plano, settings)</li>
            <li>Todos os profiles (membros)</li>
            <li>Convites pendentes</li>
            <li>FVS (Qualidade)</li>
            <li>Pending actions (histórico de aprovações)</li>
            <li>Audit log completo</li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Próximos sprints adicionarão: RDO, Planejamento, Suprimentos, Mão-de-obra etc.
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white text-sm font-semibold rounded disabled:opacity-50"
        >
          <Download size={16} />
          {loading ? 'Gerando export…' : 'Baixar export JSON'}
        </button>
      </div>
    </div>
  )
}
