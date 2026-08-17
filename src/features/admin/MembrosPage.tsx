/**
 * MembrosPage — lista (somente leitura) os membros/e-mails cadastrados na
 * organização. Exclusiva da conta global (mesmo gate de Homologação/Adaptação
 * Rápida). Usa a RPC export_organization_data (owner-only no servidor).
 */
import { useEffect, useState } from 'react'
import { Users, ShieldAlert, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { roleLabel } from '@/lib/roles'

interface MemberRow {
  id?: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  job_title?: string | null
  status?: string | null
  activated_at?: string | null
}

export function MembrosPage() {
  const profile = useAuth((s) => s.profile)
  const canUse = useAuth((state) => state.isGlobalAdmin)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!profile) return
    setError(null); setLoading(true)
    try {
      const { data, error: e } = await supabase.rpc('export_organization_data', { p_org_id: profile.organization_id })
      if (e) throw e
      const obj = (data ?? {}) as Record<string, unknown>
      setMembers((obj.profiles as MemberRow[] | undefined) ?? [])
      setInvites((obj.invitations as MemberRow[] | undefined) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (canUse) void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.organization_id])

  if (!canUse) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded text-amber-800 flex gap-3">
          <ShieldAlert className="shrink-0" />
          <p className="text-sm">Este módulo é exclusivo das contas que administram a plataforma.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto text-[#e5e5e5]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users size={22} className="text-[#f97316]" /> Membros da organização</h1>
          <p className="text-sm text-[#9a9a9a] mt-1">Quem está cadastrado e com acesso a esta empresa. Para convidar/remover membros, use o painel do Supabase (ou fale com o suporte).</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm hover:bg-[#484848] disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {error && <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="rounded-xl border border-[#525252] bg-[#333] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-white bg-[#2b2c6b]">
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">E-mail</th>
                <th className="text-left px-3 py-2">Cargo</th>
                <th className="text-left px-3 py-2">Função</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#484848]">
              {members.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[#9a9a9a]">Nenhum membro encontrado.</td></tr>
              )}
              {members.map((m, i) => (
                <tr key={m.id ?? i} className="hover:bg-[#3d3d3d]">
                  <td className="px-3 py-2 font-semibold text-[#f5f5f5]">{m.full_name || '—'}</td>
                  <td className="px-3 py-2 text-[#c9c9c9]">{m.email || '—'}</td>
                  <td className="px-3 py-2 text-[#c9c9c9]">{roleLabel(m.role)}</td>
                  <td className="px-3 py-2 text-[#c9c9c9]">{m.job_title || '—'}</td>
                  <td className="px-3 py-2 text-[#c9c9c9]">{m.activated_at ? 'Ativo' : (m.status || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {invites.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-[#f5f5f5] mb-2">Convites pendentes</h2>
          <ul className="flex flex-col gap-1.5">
            {invites.map((inv, i) => (
              <li key={inv.id ?? i} className="rounded border border-[#484848] bg-[#2d2d2d] px-3 py-2 text-xs text-[#c9c9c9]">
                {inv.email} · {roleLabel(inv.role)} {inv.status ? `· ${inv.status}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
