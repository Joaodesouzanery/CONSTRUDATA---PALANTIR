/**
 * DireitosTitularPage — LGPD (art. 18): atende pedidos de titulares por pessoa. Busca o "rastro"
 * de um titular (por e-mail ou nome exato) nas fontes com dado pessoal (membros, chamados
 * públicos, OS, laudos, títulos), permite EXPORTAR (acesso/portabilidade) e ANONIMIZAR
 * (eliminação, irreversível). Só o OWNER da org (forçado também nas RPCs). Ambas as ações são
 * auditadas (audit_log). Correspondência EXATA: informe o e-mail ou o nome COMPLETO do titular.
 */
import { useState } from 'react'
import { Download, Eraser, Search, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Footprint = {
  termo: string
  profiles: unknown[]
  chamados_publicos: unknown[]
  ordens_servico: unknown[]
  laudos: unknown[]
  titulos: unknown[]
}
const FONTES: { key: keyof Footprint; label: string }[] = [
  { key: 'profiles', label: 'Membros (perfis)' },
  { key: 'chamados_publicos', label: 'Chamados públicos' },
  { key: 'ordens_servico', label: 'Ordens de serviço' },
  { key: 'laudos', label: 'Laudos' },
  { key: 'titulos', label: 'Títulos / boletos' },
]

export function DireitosTitularPage() {
  const profile = useAuth((s) => s.profile)
  const isOwner = profile?.role === 'owner'

  const [termo, setTermo] = useState('')
  const [footprint, setFootprint] = useState<Footprint | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState<'export' | 'anon' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = footprint ? FONTES.reduce((s, f) => s + (Array.isArray(footprint[f.key]) ? (footprint[f.key] as unknown[]).length : 0), 0) : 0

  async function exportar() {
    if (!profile || !termo.trim()) return
    setError(null); setResult(null); setFootprint(null); setLoading('export')
    try {
      const { data, error: e } = await supabase.rpc('export_dados_titular', { p_org_id: profile.organization_id, p_termo: termo.trim() })
      if (e) throw e
      setFootprint(data as Footprint)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar/exportar')
    } finally {
      setLoading(null)
    }
  }

  function baixar() {
    if (!footprint) return
    const blob = new Blob([JSON.stringify(footprint, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `titular-${termo.trim().replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function anonimizar() {
    if (!profile || !termo.trim()) return
    if (!window.confirm(`Anonimizar os dados do titular "${termo.trim()}"?\n\nAção IRREVERSÍVEL: mascara nome/contato do titular nos chamados públicos e nas ordens de serviço, e desativa o cadastro de membro. Registros sob retenção legal (laudos, títulos fiscais) são preservados — constam apenas no export. A ação fica registrada na auditoria.`)) return
    setError(null); setResult(null); setLoading('anon')
    try {
      const { data, error: e } = await supabase.rpc('anonimizar_dados_titular', { p_org_id: profile.organization_id, p_termo: termo.trim() })
      if (e) throw e
      setResult(JSON.stringify(data))
      setFootprint(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao anonimizar')
    } finally {
      setLoading(null)
    }
  }

  if (!isOwner) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded text-amber-800 flex gap-3">
          <ShieldAlert size={20} />
          <div>
            <p className="font-semibold mb-1">Acesso restrito</p>
            <p className="text-sm">Apenas o <strong>owner</strong> da organização pode atender direitos de titular. Seu cargo atual é <strong>{profile?.role}</strong>.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Direitos do titular (LGPD)</h1>
      <p className="text-sm text-gray-500 mb-6">
        Atende pedidos de acesso/portabilidade (export) e de eliminação (anonimização) de um titular,
        nas fontes com dado pessoal: membros, chamados públicos, OS, laudos e títulos. Informe o
        <strong> e-mail</strong> ou o <strong>nome completo</strong> exato do titular.
      </p>

      <div className="p-6 border rounded space-y-4">
        <div className="flex gap-2">
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="e-mail ou nome completo do titular"
            className="flex-1 border rounded px-3 py-2 text-sm outline-none focus:border-orange-500"
            onKeyDown={(e) => { if (e.key === 'Enter') void exportar() }}
          />
          <button onClick={() => void exportar()} disabled={loading !== null || !termo.trim()} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded disabled:opacity-50">
            <Search size={15} /> {loading === 'export' ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {error && <div className="p-3 text-sm rounded bg-red-50 border border-red-200 text-red-700">{error}</div>}

        {result && (
          <div className="p-3 text-sm rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
            Anonimização concluída e registrada na auditoria. Ocorrências afetadas: <code className="text-xs">{result}</code>
          </div>
        )}

        {footprint && (
          <div className="space-y-3">
            <div className="rounded border bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Rastro encontrado — {total} ocorrência(s)</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {FONTES.map((f) => {
                  const n = Array.isArray(footprint[f.key]) ? (footprint[f.key] as unknown[]).length : 0
                  return <li key={f.key} className="flex justify-between"><span>{f.label}</span><span className="tabular-nums font-semibold">{n}</span></li>
                })}
              </ul>
            </div>

            {total === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma ocorrência para este termo (verifique se o e-mail/nome está exato).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={baixar} className="flex items-center gap-2 px-4 py-2 border rounded text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <Download size={15} /> Baixar export (JSON)
                </button>
                <button onClick={() => void anonimizar()} disabled={loading !== null} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded disabled:opacity-50">
                  <Eraser size={15} /> {loading === 'anon' ? 'Anonimizando…' : 'Anonimizar (irreversível)'}
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 border-t pt-3">
          A anonimização mascara nome/contato e desativa o membro; alguns dados podem ser mantidos por
          obrigação legal (ex.: registros fiscais/laudos) conforme a política de retenção. Todas as ações
          ficam na auditoria (audit_log).
        </p>
      </div>
    </div>
  )
}
