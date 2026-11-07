import type { OrgFile } from '@/types/domain'
import type { DB } from './seed'
import { projectInScope, type Scope } from './selectors'

export function businessFiles(db: DB, scope: Scope, kind: NonNullable<OrgFile['kind']>) {
  return db.orgFiles.filter((f) => f.kind === kind && f.access === 'shared' && f.projectId && db.projects.some((p) => p.id === f.projectId && projectInScope(scope, p)))
}
