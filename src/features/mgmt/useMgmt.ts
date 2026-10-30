import { useMemo } from 'react'
import { useActor, useScope, useSession, usePermissions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, orgById, userById } from '@/mock/selectors'

/** Context for the shared organisation / company implementation */
export function useMgmt() {
  const session = useSession()
  const db = useDB()
  const scope = useScope()
  const actor = useActor()
  const perms = usePermissions()
  const role = session?.role === 'org' ? 'org' : 'company'
  const user = userById(db, session?.userId)
  return useMemo(() => {
    const base = role === 'org' ? '/org' : '/company'
    const entityName = role === 'org' ? orgById(db, user?.orgId)?.name : companyById(db, user?.companyId)?.name
    const scopeLabel =
      user?.projectScope && user.projectScope !== 'all'
        ? `${entityName} — ${user.projectScope.map((p) => db.projects.find((x) => x.id === p)?.code).join('، ')}`
        : entityName
    return {
      role: role as 'org' | 'company',
      base,
      scope,
      actor,
      user,
      entityId: (role === 'org' ? user?.orgId : user?.companyId) ?? '',
      entityName: entityName ?? '',
      scopeLabel: scopeLabel ?? '',
      can: perms.has,
      isCompany: role === 'company',
    }
  }, [role, db, user, scope, actor, perms])
}
