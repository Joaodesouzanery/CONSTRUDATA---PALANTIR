import { useAuth } from './auth'

export type RuntimeEnvironment = 'production' | 'homologation' | 'demo'

export function isPublicPreviewMode(): boolean {
  return false
}

export function getActiveOrganizationEnvironment(): RuntimeEnvironment {
  if (typeof window === 'undefined') return 'production'

  try {
    const { profile, memberships } = useAuth.getState()
    const activeMembership = memberships.find((item) => item.organization_id === profile?.organization_id)
    const environment = activeMembership?.organization?.environment
    if (environment === 'homologation' || environment === 'demo') return environment

    const label = `${activeMembership?.organization?.name ?? ''} ${activeMembership?.organization?.slug ?? ''}`.toLowerCase()
    if (label.includes('homolog') || label.includes('homologacao')) return 'homologation'
    if (label.includes('demo')) return 'demo'
  } catch {
    return 'production'
  }

  return 'production'
}

export function isDemoModeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('cdata-demo') === 'true' || getActiveOrganizationEnvironment() === 'demo'
}

export function isNonProductionDataMode(): boolean {
  return isDemoModeEnabled()
}
