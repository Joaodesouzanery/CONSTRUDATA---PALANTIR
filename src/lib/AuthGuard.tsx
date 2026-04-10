/**
 * AuthGuard.tsx — Protege rotas /app/* exigindo sessão autenticada.
 *
 * Uso:
 *   <Route element={<AuthGuard />}>
 *     <Route path="/app/*" element={<AppShell />} />
 *   </Route>
 *
 * Para exigir um role específico:
 *   <AuthGuard roles={['owner','diretor']}>
 *     <ExportarDadosPage />
 *   </AuthGuard>
 */
import { useEffect, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from './auth'
import { subscribeOrgRealtime, unsubscribeOrgRealtime } from './realtime'
import type { UserRole } from '@/types/database'

interface AuthGuardProps {
  children?: ReactNode
  roles?:    UserRole[]
  fallback?: string
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { session, profile, initialized, init } = useAuth()

  useEffect(() => {
    if (!initialized) void init()
  }, [initialized, init])

  // Sprint Ontologia Unificada — inscreve Realtime quando profile carrega
  useEffect(() => {
    if (profile?.organization_id) {
      subscribeOrgRealtime(profile.organization_id)
    }
    return () => {
      // Não desinscrever em re-render do mesmo profile — só na desmontagem real
    }
  }, [profile?.organization_id])

  // Desinscreve no logout (session vira null)
  useEffect(() => {
    if (!session && initialized) {
      unsubscribeOrgRealtime()
    }
  }, [session, initialized])

  // ── Login desabilitado temporariamente — acesso livre ──
  // TODO: reativar quando o fluxo de criação de usuário no Supabase estiver OK
  //
  // if (!initialized || loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-[#0b1a30]">
  //       <div className="w-8 h-8 border-2 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
  //     </div>
  //   )
  // }
  // if (!session) {
  //   return <Navigate to={fallback} state={{ from: location }} replace />
  // }
  // if (!profile) {
  //   return <Navigate to="/signup/organizacao" state={{ from: location }} replace />
  // }
  // if (roles && roles.length > 0 && !roles.includes(profile.role)) {
  //   return <Navigate to="/app/minha-rotina" replace />
  // }

  return children ? <>{children}</> : <Outlet />
}
