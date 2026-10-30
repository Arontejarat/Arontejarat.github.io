import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SUBROLES } from '@/config/permissions'
import type { Permission, RoleKey, SubRole } from '@/types/domain'
import { useActionsFor, useDB, useStore } from '@/mock/store'
import { fullName, scopeForUser, type Scope } from '@/mock/selectors'
import type { Actor } from '@/mock/actions'

const SESSION_KEY = 'niroo-demo-session'

/** Demo-only credential. Real authentication is a backend responsibility. */
export const DEMO_PASSWORD = 'Demo@1234'
export const DEMO_OTP = '12345'

export interface AuthSession {
  role: RoleKey
  subRole: SubRole
  userId?: string
  employeeId?: string
  name: string
  startedAt: string
}

interface AuthValue {
  session: AuthSession | null
  login: (s: AuthSession) => void
  logout: () => void
  expired: boolean
  clearExpired: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export const HOME_BY_ROLE: Record<RoleKey, string> = {
  employee: '/me',
  org: '/org',
  company: '/company',
  admin: '/admin',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { db } = useStore()
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    } catch {
      return null
    }
  })
  const [expired, setExpired] = useState(false)
  const lastActive = useRef(Date.now())

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])

  // Inactivity timeout (session policy is configurable by the administrator)
  const timeoutMin = db.settings.sessionTimeoutMin
  useEffect(() => {
    if (!session) return
    lastActive.current = Date.now()
    const bump = () => (lastActive.current = Date.now())
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const iv = setInterval(() => {
      if (Date.now() - lastActive.current > timeoutMin * 60_000) {
        setSession(null)
        setExpired(true)
      }
    }, 15_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(iv)
    }
  }, [session, timeoutMin])

  const login = useCallback((s: AuthSession) => {
    setExpired(false)
    setSession(s)
  }, [])
  const logout = useCallback(() => setSession(null), [])
  const clearExpired = useCallback(() => setExpired(false), [])

  const value = useMemo(() => ({ session, login, logout, expired, clearExpired }), [session, login, logout, expired, clearExpired])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

export function useSession() {
  return useAuth().session
}

export function useActor(): Actor | null {
  const session = useSession()
  const db = useDB()
  return useMemo(() => {
    if (!session) return null
    if (session.role === 'employee') {
      const e = db.employees.find((x) => x.id === session.employeeId)
      return { name: session.name, role: 'employee', employeeId: session.employeeId, orgId: e?.orgId, companyId: e?.companyId }
    }
    const u = db.users.find((x) => x.id === session.userId)
    return { name: session.name, role: session.role, userId: session.userId, orgId: u?.orgId, companyId: u?.companyId }
  }, [session, db.employees, db.users])
}

export function useActions() {
  return useActionsFor(useActor())
}

export function usePermissions() {
  const session = useSession()
  return useMemo(() => {
    const perms = new Set<Permission>(session ? SUBROLES[session.subRole].permissions : [])
    return { has: (p: Permission) => perms.has(p), all: perms }
  }, [session])
}

export function useCan(p: Permission) {
  return usePermissions().has(p)
}

/** Data scope of the signed-in management user (organisation / company / projects). */
export function useScope(): Scope {
  const session = useSession()
  const db = useDB()
  return useMemo(() => {
    const u = db.users.find((x) => x.id === session?.userId)
    return scopeForUser(u) ?? { role: session?.role ?? 'employee' }
  }, [session, db.users])
}

export function useCurrentEmployee() {
  const session = useSession()
  const db = useDB()
  const emp = db.employees.find((e) => e.id === session?.employeeId)
  if (!emp) throw new Error('No employee in session')
  return emp
}

/** All demo accounts that can sign in (one per sub-role). */
export function demoAccounts(db: ReturnType<typeof useDB>) {
  const emp = db.employees.find((e) => e.id === 'e1')!
  const accounts: { session: Omit<AuthSession, 'startedAt'>; mobile: string; org: string }[] = [
    {
      session: { role: 'employee', subRole: 'employee', employeeId: emp.id, name: fullName(emp) },
      mobile: emp.mobile,
      org: db.companies.find((c) => c.id === emp.companyId)?.name ?? '',
    },
  ]
  const order: SubRole[] = ['org_admin', 'org_hr', 'org_requests', 'cmp_admin', 'cmp_pm', 'cmp_hr', 'cmp_contracts', 'cmp_exec', 'sys_admin']
  order.forEach((sr) => {
    const u = db.users.find((x) => x.subRole === sr && x.status === 'active' && (x.orgId === 'o1' || x.companyId === 'c1' || x.role === 'admin'))
    if (u)
      accounts.push({
        session: { role: u.role, subRole: u.subRole, userId: u.id, name: u.name },
        mobile: u.mobile,
        org: u.orgId ? db.organizations.find((o) => o.id === u.orgId)!.name : u.companyId ? db.companies.find((c) => c.id === u.companyId)!.name : 'سامانه',
      })
  })
  return accounts
}
