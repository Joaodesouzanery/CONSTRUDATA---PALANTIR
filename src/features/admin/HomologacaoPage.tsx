import { Link } from 'react-router-dom'
import { Building2, CheckCircle2, FlaskConical, RefreshCw, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const envLabels = {
  production: 'Produção',
  homologation: 'Homologação',
  demo: 'Demo',
} as const

function environmentTone(environment?: string) {
  if (environment === 'homologation') return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
  if (environment === 'demo') return 'border-sky-500/40 bg-sky-500/10 text-sky-200'
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
}

export function HomologacaoPage() {
  const profile = useAuth((state) => state.profile)
  const memberships = useAuth((state) => state.memberships)
  const refreshProfile = useAuth((state) => state.refreshProfile)
  const switchOrganization = useAuth((state) => state.switchOrganization)

  const active = memberships.find((item) => item.organization_id === profile?.organization_id)
  const homologationOrgs = memberships.filter((item) => item.organization?.environment === 'homologation')
  const activeEnvironment = active?.organization?.environment ?? 'production'
  const isHomologation = activeEnvironment === 'homologation'
  const canUse = useAuth((state) => state.isGlobalAdmin)

  async function handleSwitch(organizationId: string) {
    await switchOrganization(organizationId)
    window.location.reload()
  }

  if (!canUse) {
    return (
      <div className="min-h-full bg-gray-950 p-6 text-[#f5f5f5]">
        <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-lg border border-[#525252] bg-[#2c2c2c] p-5">
          <ShieldAlert className="mt-1 text-[#f97316]" size={20} />
          <div>
            <h1 className="text-lg font-semibold">Homologação</h1>
            <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">
              Este módulo é exclusivo das contas que administram a plataforma.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-950 p-6 text-[#f5f5f5]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3d3d3d] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f97316] text-white">
              <FlaskConical size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Homologação</h1>
              <p className="text-xs text-[#a3a3a3]">Ambiente ativo, empresas de teste e atalhos de QA.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-xs font-semibold text-[#f5f5f5] hover:border-[#f97316]/60"
          >
            <RefreshCw size={14} />
            Atualizar vínculos
          </button>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Empresa ativa</p>
            <p className="mt-2 text-sm font-semibold">{active?.organization?.name ?? 'Empresa ativa'}</p>
            <p className="mt-1 text-xs text-[#a3a3a3]">{profile?.role ?? '-'}</p>
          </div>
          <div className={cn('rounded-lg border p-4', environmentTone(activeEnvironment))}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">Ambiente</p>
            <p className="mt-2 text-sm font-semibold">{envLabels[activeEnvironment] ?? activeEnvironment}</p>
            <p className="mt-1 text-xs opacity-80">{isHomologation ? 'Dados de teste isolados.' : 'Você está fora da homologação.'}</p>
          </div>
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Vinculos ativos</p>
            <p className="mt-2 text-sm font-semibold">{memberships.length}</p>
            <p className="mt-1 text-xs text-[#a3a3a3]">{homologationOrgs.length} em homologação</p>
          </div>
        </section>

        {!isHomologation && homologationOrgs.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-3">
                <p className="font-semibold">A empresa ativa não é de homologação.</p>
                <div className="flex flex-wrap gap-2">
                  {homologationOrgs.map((membership) => (
                    <button
                      key={membership.id}
                      type="button"
                      onClick={() => void handleSwitch(membership.organization_id)}
                      className="rounded-lg border border-amber-400/40 bg-[#1f1f1f] px-3 py-2 text-xs font-semibold text-amber-100 hover:border-amber-300"
                    >
                      Usar {membership.organization?.name ?? membership.organization_id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {homologationOrgs.length === 0 && (
          <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 text-sm text-[#d4d4d4]">
            Nenhuma empresa de homologação apareceu nos seus vínculos ativos. Confira se o usuário tem membership ativa na organização de homologação.
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2">
          <Link to="/app/rdo-sabesp" className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 hover:border-[#f97316]/60">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 size={16} className="text-[#f97316]" />
              RDO Sabesp
            </div>
            <p className="mt-2 text-xs text-[#a3a3a3]">Criar, revisar e finalizar RDOs para gerar fontes de medição.</p>
          </Link>
          <Link to="/app/medicao" className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 hover:border-[#f97316]/60">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 size={16} className="text-[#f97316]" />
              Medição
            </div>
            <p className="mt-2 text-xs text-[#a3a3a3]">Conferir fontes, memoria, qualidade e fechamento.</p>
          </Link>
        </section>
      </div>
    </div>
  )
}
