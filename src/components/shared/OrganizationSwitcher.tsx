import { useState } from 'react'
import { Building2, ChevronDown, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface OrganizationSwitcherProps {
  expanded?: boolean
}

export function OrganizationSwitcher({ expanded = true }: OrganizationSwitcherProps) {
  const profile = useAuth((state) => state.profile)
  const memberships = useAuth((state) => state.memberships)
  const switchOrganization = useAuth((state) => state.switchOrganization)
  const refreshProfile = useAuth((state) => state.refreshProfile)
  const [switching, setSwitching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const active = memberships.find((item) => item.organization_id === profile?.organization_id)
  const activeName = active?.organization?.name ?? 'Empresa ativa'
  const activeEnvironment = active?.organization?.environment ?? 'production'
  const options = memberships.length > 0
    ? memberships
    : [{
        id: `profile-${profile?.organization_id ?? 'active'}`,
        organization_id: profile?.organization_id ?? '',
        role: profile?.role ?? 'visualizador',
        status: 'active' as const,
        organization: {
          id: profile?.organization_id ?? '',
          name: activeName,
          slug: profile?.organization_id ?? '',
          environment: 'production' as const,
        },
      }]

  async function handleChange(nextOrgId: string) {
    if (!nextOrgId || nextOrgId === profile?.organization_id) return
    setSwitching(true)
    try {
      await switchOrganization(nextOrgId)
      window.location.reload()
    } finally {
      setSwitching(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshProfile()
    } finally {
      setRefreshing(false)
    }
  }

  function environmentLabel(environment?: string) {
    if (environment === 'homologation') return 'Teste'
    if (environment === 'demo') return 'Demo'
    return 'Oficial'
  }

  function environmentBadgeClass(environment?: string) {
    if (environment === 'homologation') return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    if (environment === 'demo') return 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  }

  if (!profile) return null

  if (!expanded) {
    return (
      <div
        title={activeName}
        className="mx-2 mb-2 flex h-10 items-center justify-center rounded-lg border border-[#525252] bg-[#262626] text-[#f97316]"
      >
        <Building2 size={17} />
      </div>
    )
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border border-[#525252] bg-[#262626] p-2">
      <div className="mb-1 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
        <Building2 size={12} className="text-[#f97316]" />
        Empresa ativa
        <span className={cn('ml-auto rounded border px-1.5 py-0.5 text-[9px] tracking-normal', environmentBadgeClass(activeEnvironment))}>
          {environmentLabel(activeEnvironment)}
        </span>
      </div>

      {options.length > 1 ? (
        <div className="relative">
          <select
            value={profile.organization_id}
            disabled={switching}
            onChange={(event) => void handleChange(event.target.value)}
            className={cn(
              'h-9 w-full appearance-none rounded-md border border-[#3f3f46] bg-[#1f1f1f] px-3 pr-8 text-left text-xs font-semibold text-[#f5f5f5]',
              'outline-none transition focus:border-[#f97316]/70 disabled:cursor-wait disabled:opacity-70',
            )}
          >
            {options.map((membership) => (
              <option key={membership.id} value={membership.organization_id}>
                {membership.organization?.name ?? membership.organization_id} - {environmentLabel(membership.organization?.environment)} - {membership.role}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="truncate rounded-md border border-[#3f3f46] bg-[#1f1f1f] px-3 py-2 text-xs font-semibold text-[#f5f5f5]">
            {activeName} - {environmentLabel(activeEnvironment)}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] leading-4 text-[#a3a3a3]">
              {memberships.length <= 1 ? 'Seu login retornou apenas 1 empresa ativa.' : 'Atualize para buscar vínculos.'}
            </span>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#3f3f46] text-[#d4d4d4] hover:border-[#f97316] hover:text-white disabled:cursor-wait disabled:opacity-60"
              title="Recarregar empresas"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
