/**
 * AuthGuard.tsx - protects /app/* routes with Supabase Auth.
 */
import { useEffect, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { papelDaOrgAtiva } from './roles'
import { subscribeOrgRealtime, unsubscribeOrgRealtime } from './realtime'
import type { UserRole } from '@/types/database'

interface AuthGuardProps {
  children?: ReactNode
  roles?: UserRole[]
  fallback?: string
  /**
   * Para onde mandar quem tem papel fora de `roles`.
   *
   * ⚠️ Era fixo em `/app/minha-rotina`, e isso bastava enquanto `roles` nunca era usado. Com o
   * `colaborador` — que só alcança `/app/ponto` — o destino fixo vira LAÇO: o guard o manda para
   * `minha-rotina`, que ele também não pode ver, e que o manda de volta.
   */
  redirecionarPara?: string
}

export function AuthGuard({ children, roles, fallback = '/login', redirecionarPara = '/app/minha-rotina' }: AuthGuardProps) {
  const location = useLocation()
  const { session, profile, initialized, loading, init } = useAuth()
  const memberships = useAuth((s) => s.memberships)
  const isGlobalAdmin = useAuth((s) => s.isGlobalAdmin)

  useEffect(() => {
    if (!initialized) void init()
  }, [initialized, init])

  useEffect(() => {
    if (profile?.organization_id) {
      subscribeOrgRealtime(profile.organization_id)
    }
  }, [profile?.organization_id])

  useEffect(() => {
    if (!session && initialized) {
      unsubscribeOrgRealtime()
    }
  }, [session, initialized])

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1a30]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f97316]" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to={fallback} state={{ from: location }} replace />
  }

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // ⚠️ O papel vem da MEMBERSHIP da empresa ativa, não de `profile.role`.
  //
  // Os dois divergem de verdade: `profiles.role` é a sombra do papel na empresa ativa daquela
  // pessoa, e quem trabalha em duas empresas carrega o papel da outra até trocar. A receita que
  // cria os colaboradores do ponto nem toca no perfil de quem já tem um. Lendo o campo errado,
  // este guard deixaria passar um `colaborador` cujo perfil antigo diz `diretor` — e barraria um
  // gerente de verdade.
  //
  // `profile.role` continua como último recurso dentro de `papelDaOrgAtiva`, para o caso de a
  // lista de memberships vir vazia; e o admin de plataforma passa por cima de tudo, como no resto
  // do projeto.
  const papel = papelDaOrgAtiva({ profile, memberships })
  if (roles && roles.length > 0 && !isGlobalAdmin && (!papel || !roles.includes(papel))) {
    return <Navigate to={redirecionarPara} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
