import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/auth'

export const GLOBAL_ADMIN_EMAIL = 'joaoneryflu@gmail.com'

export function isGlobalAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === GLOBAL_ADMIN_EMAIL
}

export function isGlobalAdminUser(profile?: Profile | null, user?: User | null) {
  return isGlobalAdminEmail(profile?.email) || isGlobalAdminEmail(user?.email)
}
