import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { HOME_BY_ROLE, useAuth, useCan } from '@/auth/auth'
import type { Permission, RoleKey } from '@/types/domain'
import { PermissionState } from '@/components/ui'

/**
 * Client-side route guard. This only shapes navigation; the backend must
 * independently authorise every request.
 */
export function RequireRole({ role, children }: { role: RoleKey; children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (session.role !== role) return <Navigate to="/forbidden" replace />
  return <>{children}</>
}

export function RequirePerm({ perm, children }: { perm: Permission; children: ReactNode }) {
  const ok = useCan(perm)
  if (!ok) return <PermissionState />
  return <>{children}</>
}

export function RootRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? HOME_BY_ROLE[session.role] : '/login'} replace />
}

/** Sends the user to the session-expired page when the inactivity timer fires. */
export function SessionWatcher() {
  const { expired } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (expired) navigate('/session-expired', { replace: true })
  }, [expired, navigate])
  return null
}
