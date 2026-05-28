/**
 * AuthGuard.tsx - protects /app/* routes with Supabase Auth.
 */
import { useEffect, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { subscribeOrgRealtime, unsubscribeOrgRealtime } from './realtime'
import type { UserRole } from '@/types/database'

interface AuthGuardProps {
  children?: ReactNode
  roles?: UserRole[]
  fallback?: string
}

export function AuthGuard({ children, roles, fallback = '/login' }: AuthGuardProps) {
  const location = useLocation()
  const { session, profile, initialized, loading, init } = useAuth()

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

  if (roles && roles.length > 0 && !roles.includes(profile.role)) {
    return <Navigate to="/app/minha-rotina" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
