import { docType, DOC_TYPES } from '@/config/documentTypes'
import { OPEN_REQUEST_STATUSES, type EmployeeContractStatus, type WorkerContractSummary, type WorkerDocSummary } from '@/config/status'
import { daysUntil, toFaDigits } from '@/lib/format'
import type {
  AppUser,
  Contract,
  DocStatus,
  Employee,
  EmployeeRequest,
  Party,
  PersonnelDocument,
  Project,
  ProjectStatus,
  RoleKey,
  SignatureStatus,
  ValidityStatus,
} from '@/types/domain'
import type { DB } from './seed'

export const fullName = (e: Pick<Employee, 'firstName' | 'lastName'>) => `${e.firstName} ${e.lastName}`

export function employeeById(db: DB, id: string | undefined) {
  return db.employees.find((e) => e.id === id)
}
export function projectById(db: DB, id: string | null | undefined) {
  return id ? db.projects.find((p) => p.id === id) : undefined
}
export function orgById(db: DB, id: string | undefined) {
  return db.organizations.find((o) => o.id === id)
}
export function companyById(db: DB, id: string | undefined) {
  return db.companies.find((c) => c.id === id)
}
export function userById(db: DB, id: string | undefined) {
  return db.users.find((u) => u.id === id)
}
export function requestType(db: DB, id: string) {
  return db.requestTypes.find((t) => t.id === id)
}

/* ---------------- Contracts ---------------- */

export function signatureStatus(c: Contract): SignatureStatus {
  const required = c.parties.filter((p) => p.required)
  const signed = required.filter((p) => p.signedAt)
  if (signed.length === required.length && required.length > 0) return 'complete'
  if (signed.length > 0) return 'partial'
  if (['awaiting_worker', 'awaiting_other', 'partially_signed'].includes(c.stage)) return 'awaiting'
  return 'unsigned'
}

export function validityStatus(c: Contract, nearEndDays = 30): ValidityStatus {
  if (c.terminated || c.stage === 'cancelled' || c.stage === 'superseded') return 'terminated'
  const toStart = daysUntil(c.startDate)
  const toEnd = daysUntil(c.endDate)
  if (toEnd < 0) return 'expired'
  if (toStart > 0) return 'not_started'
  // Monthly worker contracts are short — use a proportionally smaller window
  const window = c.kind === 'worker' ? 5 : nearEndDays
  if (toEnd <= window) return 'near_end'
  return 'active'
}

/** Status shown to the employee (PRD part 1 §7.4) */
export function employeeContractStatus(c: Contract): EmployeeContractStatus {
  if (c.stage === 'cancelled' || c.stage === 'superseded') return 'cancelled'
  if (['draft', 'company_review', 'org_review', 'ready_to_send'].includes(c.stage)) return 'preparing'
  if (c.stage === 'completed') return daysUntil(c.endDate) < 0 ? 'expired' : 'completed'
  if (c.employeeSignature) return 'signed_by_me'
  if (daysUntil(c.endDate) < 0) return 'expired'
  return c.viewedAt ? 'viewed' : 'ready'
}

export function contractsNeedingEmployeeSignature(db: DB, employeeId: string) {
  return db.contracts.filter((c) => c.employeeId === employeeId && c.stage === 'awaiting_worker' && !c.employeeSignature)
}

/* ---------------- Documents ---------------- */

export function currentVersion(d: PersonnelDocument) {
  return d.versions[d.versions.length - 1]
}

export function documentStatus(d: PersonnelDocument | undefined): DocStatus {
  if (!d || d.versions.length === 0) return 'not_submitted'
  const v = currentVersion(d)
  if (v.status === 'approved' && d.expiresAt && daysUntil(d.expiresAt) < 0) return 'expired'
  return v.status
}

export function employeeDocuments(db: DB, employeeId: string) {
  return db.documents.filter((d) => d.employeeId === employeeId)
}

/** Each document type with the employee's latest document (if any) */
export function employeeDocumentChecklist(db: DB, employee: Employee) {
  const docs = employeeDocuments(db, employee.id)
  return DOC_TYPES.filter((t) => t.required || docs.some((d) => d.typeId === t.id) || (t.id === 'marriage_cert' && employee.maritalStatus === 'married')).map((t) => {
    const doc = docs.find((d) => d.typeId === t.id)
    return { type: t, doc, status: documentStatus(doc) }
  })
}

export function workerDocSummary(db: DB, employee: Employee): WorkerDocSummary {
  const list = employeeDocumentChecklist(db, employee).filter((x) => x.type.required)
  if (list.some((x) => ['not_submitted', 'rejected', 'needs_fix', 'expired'].includes(x.status))) return 'incomplete'
  if (list.some((x) => x.status === 'pending')) return 'pending'
  return 'complete'
}

export function documentsNeedingAction(db: DB, employeeId: string) {
  const emp = employeeById(db, employeeId)
  if (!emp) return []
  return employeeDocumentChecklist(db, emp).filter((x) => ['not_submitted', 'rejected', 'needs_fix', 'expired'].includes(x.status) && (x.type.required || x.doc))
}

/* ---------------- Workforce ---------------- */

export function workerCurrentContract(db: DB, employeeId: string) {
  const list = db.contracts
    .filter((c) => c.employeeId === employeeId && c.kind === 'worker' && c.stage !== 'superseded' && c.stage !== 'cancelled')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  return list[0]
}

export function workerContractSummary(db: DB, employee: Employee): WorkerContractSummary {
  const c = workerCurrentContract(db, employee.id)
  if (!c) return 'none'
  if (['draft', 'company_review', 'org_review', 'ready_to_send'].includes(c.stage)) return 'draft'
  if (c.stage !== 'completed') return 'awaiting'
  // For the employment relationship, use the overall contract term on the employee record
  const toEnd = daysUntil(employee.contractEnd)
  if (toEnd < 0) return 'expired'
  if (toEnd <= 30) return 'near_end'
  return 'active'
}

/* ---------------- Projects ---------------- */

/**
 * Project status must reflect real events: a project whose main contract is not
 * fully signed cannot be shown as "running" just because work items exist.
 */
export function effectiveProjectStatus(db: DB, p: Project): { status: ProjectStatus; reason?: string } {
  if (p.status === 'closed' || p.status === 'paused' || p.status === 'planning') return { status: p.status }
  const main = db.contracts.find((c) => c.id === p.mainContractId)
  if (!main || signatureStatus(main) !== 'complete') {
    return { status: 'awaiting_contract', reason: 'قرارداد اصلی پروژه هنوز امضا و تکمیل نشده است.' }
  }
  const { required, allocated } = projectStaffing(db, p)
  const overdue = db.tasks.filter((t) => t.projectId === p.id && t.status !== 'done' && daysUntil(t.dueAt) < 0).length
  if (allocated < required * 0.85) return { status: 'needs_followup', reason: `کمبود نیرو: ${toFaDigits(required - allocated)} نفر` }
  if (overdue >= 2) return { status: 'needs_followup', reason: `${toFaDigits(overdue)} وظیفه معوق` }
  return { status: 'running' }
}

export function projectStaffing(db: DB, p: Project) {
  const required = p.demand.reduce((a, b) => a + b.required, 0)
  const workers = db.employees.filter((e) => e.projectId === p.id && e.employmentStatus !== 'terminated')
  const deployed = workers.filter((e) => e.employmentStatus === 'active').length
  return { required, allocated: workers.length, deployed, workers }
}

export function projectTasks(db: DB, projectId: string) {
  return db.tasks.filter((t) => t.projectId === projectId)
}

export function taskProgress(tasks: { status: string }[]) {
  if (tasks.length === 0) return 0
  return (tasks.filter((t) => t.status === 'done').length / tasks.length) * 100
}

/* ---------------- Requests ---------------- */

export function isOpenRequest(r: EmployeeRequest) {
  return OPEN_REQUEST_STATUSES.includes(r.status)
}

/** Party currently responsible for a request, if any */
export function activeParty(r: EmployeeRequest): Party | undefined {
  if (!['submitted', 'in_review'].includes(r.status)) return undefined
  return r.steps[r.currentStep]?.party
}

/* ---------------- Scopes ---------------- */

export interface Scope {
  role: RoleKey
  orgId?: string
  companyId?: string
  projectIds?: string[] | 'all'
}

export function scopeForUser(user: AppUser | undefined): Scope | undefined {
  if (!user) return undefined
  return { role: user.role, orgId: user.orgId, companyId: user.companyId, projectIds: user.projectScope }
}

export function employeeInScope(scope: Scope, e: Employee) {
  if (scope.role === 'admin') return true
  if (scope.role === 'org' && e.orgId !== scope.orgId) return false
  if (scope.role === 'company' && e.companyId !== scope.companyId) return false
  if (scope.projectIds && scope.projectIds !== 'all') {
    // Former workers without a project stay visible to unrestricted users only
    if (!e.projectId || !scope.projectIds.includes(e.projectId)) return false
  }
  return true
}

export function projectInScope(scope: Scope, p: Project) {
  if (scope.role === 'admin') return true
  if (scope.role === 'org' && p.orgId !== scope.orgId) return false
  if (scope.role === 'company' && p.companyId !== scope.companyId) return false
  if (scope.projectIds && scope.projectIds !== 'all' && !scope.projectIds.includes(p.id)) return false
  return true
}

export function scopedEmployees(db: DB, scope: Scope) {
  return db.employees.filter((e) => employeeInScope(scope, e))
}

export function scopedRequests(db: DB, scope: Scope) {
  const ids = new Set(scopedEmployees(db, scope).map((e) => e.id))
  return db.requests.filter((r) => {
    if (r.status === 'draft') return false // drafts are private to the employee
    if (!ids.has(r.employeeId)) return false
    // A party only sees requests whose workflow involves it
    if (scope.role === 'org' || scope.role === 'company') {
      return r.steps.some((s) => s.party === scope.role)
    }
    return true
  })
}

export function scopedContracts(db: DB, scope: Scope) {
  return db.contracts.filter((c) => {
    if (scope.role === 'org' && c.orgId !== scope.orgId) return false
    if (scope.role === 'company' && c.companyId !== scope.companyId) return false
    // Organisation sees worker contracts read-only and project contracts it is party to
    if (scope.projectIds && scope.projectIds !== 'all' && !scope.projectIds.includes(c.projectId)) return false
    return true
  })
}

export function scopedDocuments(db: DB, scope: Scope) {
  const ids = new Set(scopedEmployees(db, scope).map((e) => e.id))
  return db.documents.filter((d) => ids.has(d.employeeId))
}

export function canReviewDocType(role: RoleKey, typeId: string) {
  const t = docType(typeId)
  if (!t) return false
  return t.reviewParty === role
}
