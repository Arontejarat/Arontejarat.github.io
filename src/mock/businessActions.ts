import type { Attachment, OrgFile, Payslip, Permission } from '@/types/domain'
import type { DB } from './seed'
import { ApiError, type Actor } from './actions'
import { employeeInScope, projectInScope, scopeForUser, signatureStatus } from './selectors'
import { SUBROLES } from '@/config/permissions'
import { uid } from '@/lib/cn'
import { formatPeriod } from '@/lib/format'

export const DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
export const PAYSLIP_MIMES = ['application/pdf', 'image/jpeg', 'image/png']
function requireUser(db: DB, actor: Actor, permission: Permission) {
  const user = db.users.find((u) => u.id === actor.userId && u.role === actor.role && u.status === 'active')
  if (!user || !SUBROLES[user.subRole].permissions.includes(permission)) throw new ApiError('forbidden', 'دسترسی به این عملیات مجاز نیست.')
  return { user, scope: scopeForUser(user)! }
}
function checkFile(file: Attachment, accept: string[]) {
  if (!file?.storageKey || !accept.includes(file.mime) || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new ApiError('validation', 'فایل معتبر با حجم حداکثر ۱۰ مگابایت بارگذاری کنید.')
}
function checkPeriod(period: string) {
  if (!/^(13|14)[0-9]{2}-(0[1-9]|1[0-2])$/.test(period)) throw new ApiError('validation', 'دوره شمسی معتبر انتخاب کنید.')
}
function record(db: DB, actor: Actor, action: string, id: string, label: string, projectId?: string) {
  const p = db.projects.find((x) => x.id === projectId)
  db.audit.unshift({ id: uid('a'), at: new Date().toISOString(), actor: actor.name, actorRole: actor.role, action, entity: { type: 'file', id, label }, result: 'success', orgId: p?.orgId, companyId: p?.companyId ?? actor.companyId })
}
export function sendBusinessDocument(db: DB, actor: Actor, input: { kind: 'statement' | 'work_report'; projectId: string; period: string; title: string; description: string; attachment: Attachment }) {
  const { scope } = requireUser(db, actor, 'files.manage')
  if (!['statement', 'work_report'].includes(input.kind) || actor.role !== (input.kind === 'statement' ? 'company' : 'org')) throw new ApiError('forbidden', 'ارسال این نوع سند در اختیار طرف مقابل است.')
  const project = db.projects.find((p) => p.id === input.projectId)
  if (!project || !projectInScope(scope, project)) throw new ApiError('forbidden', 'پروژه خارج از محدوده دسترسی شماست.')
  if (!input.title.trim()) throw new ApiError('validation', 'عنوان سند را وارد کنید.')
  checkPeriod(input.period)
  checkFile(input.attachment, DOCUMENT_MIMES)
  const title = input.kind === 'statement' ? 'صورت‌وضعیت' : 'کارکرد'
  const file: OrgFile = { ...input, title: input.title.trim(), id: uid('f'), owner: actor.role as 'company' | 'org', ownerId: actor.role === 'org' ? project.orgId : project.companyId, docType: title, date: new Date().toISOString(), access: 'shared', reviewStatus: 'pending', fileName: input.attachment.name, size: input.attachment.size, uploadedBy: actor.name }
  db.orgFiles.unshift(file)
  const recipient = actor.role === 'org' ? 'company' : 'org'
  db.notifications.unshift({ id: uid('n'), at: file.date, read: false, audience: { role: recipient, id: recipient === 'org' ? project.orgId : project.companyId }, category: 'document', title: title + ' جدید دریافت شد', body: project.name + ' — ' + input.period, link: '/' + recipient + '/' + (input.kind === 'statement' ? 'statements' : 'work-reports') })
  record(db, actor, 'ارسال ' + title, file.id, file.title, project.id)
  return file
}
export function reviewBusinessDocument(db: DB, actor: Actor, id: string, decision: 'approved' | 'rejected', note: string) {
  const { scope } = requireUser(db, actor, 'documents.review')
  const f = db.orgFiles.find((x) => x.id === id && x.kind)
  const project = db.projects.find((p) => p.id === f?.projectId)
  if (!f || !project || f.owner === actor.role || !projectInScope(scope, project)) throw new ApiError('forbidden', 'دسترسی به بررسی این سند مجاز نیست.')
  if (f.reviewStatus !== 'pending') throw new ApiError('conflict', 'این سند قبلاً بررسی شده است.')
  if (!['approved', 'rejected'].includes(decision)) throw new ApiError('validation', 'نتیجه بررسی معتبر نیست.')
  if (decision === 'rejected' && !note.trim()) throw new ApiError('validation', 'علت رد سند را بنویسید.')
  Object.assign(f, { reviewStatus: decision, reviewNote: note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: actor.name })
  db.notifications.unshift({ id: uid('n'), at: f.reviewedAt!, read: false, audience: { role: f.owner, id: f.ownerId }, category: 'document', title: f.docType + (decision === 'approved' ? ' تأیید شد' : ' رد شد'), body: f.title, link: '/' + f.owner + '/' + (f.kind === 'statement' ? 'statements' : 'work-reports') })
  record(db, actor, 'بررسی ' + f.docType, f.id, f.title, project.id)
  return f
}
export function shareWorkerContract(db: DB, actor: Actor, id: string) {
  const { scope } = requireUser(db, actor, 'contracts.manage')
  const c = db.contracts.find((x) => x.id === id)
  const project = db.projects.find((p) => p.id === c?.projectId)
  if (actor.role !== 'company' || !c || c.kind !== 'worker' || c.companyId !== scope.companyId || !project || !projectInScope(scope, project)) throw new ApiError('forbidden', 'دسترسی به ارسال این قرارداد مجاز نیست.')
  if (c.stage !== 'completed' || !c.parties.some((p) => p.role === 'worker' && p.signedAt) || !c.parties.some((p) => p.role === 'company' && p.signedAt) || signatureStatus(c) !== 'complete') throw new ApiError('conflict', 'ارسال به سازمان پس از تکمیل امضای نیرو و شرکت ممکن است.')
  if (c.sharedWithOrg?.versionHash === c.versionHash) throw new ApiError('duplicate', 'این نسخه قبلاً برای سازمان ارسال شده است.')
  const at = new Date().toISOString()
  c.sharedWithOrg = { at, by: actor.name, versionHash: c.versionHash }
  c.history.push({ id: uid('ch'), at, actor: actor.name, text: 'نسخه امضاشده برای سازمان ارسال شد.' })
  db.notifications.unshift({ id: uid('n'), at, read: false, audience: { role: 'org', id: c.orgId }, category: 'contract', title: 'قرارداد امضاشده نیرو دریافت شد', body: c.title, link: '/org/contracts/' + c.id })
  record(db, actor, 'ارسال قرارداد امضاشده به سازمان', c.id, c.number, c.projectId)
  return c
}
export function uploadPayslip(db: DB, actor: Actor, input: { employeeId: string; period: string; file: Attachment; correctionNote?: string; expectedVersion?: number }) {
  const { scope } = requireUser(db, actor, 'payslips.manage')
  const emp = db.employees.find((e) => e.id === input.employeeId)
  if (actor.role !== 'company' || !emp || !employeeInScope(scope, emp)) throw new ApiError('forbidden', 'بارگذاری فیش این نیرو مجاز نیست.')
  checkPeriod(input.period)
  checkFile(input.file, PAYSLIP_MIMES)
  const [year, month] = input.period.split('-').map(Number)
  const existing = db.payslips.find((p) => p.employeeId === emp.id && p.year === year && p.month === month)
  if ((existing?.version ?? 0) !== (input.expectedVersion ?? 0)) throw new ApiError('conflict', 'فیش این دوره تغییر کرده است؛ صفحه را به‌روز کنید.')
  if (existing && !input.correctionNote?.trim()) throw new ApiError('validation', 'دلیل جایگزینی فیش را بنویسید.')
  const at = new Date().toISOString()
  const p: Payslip = { id: existing?.id ?? uid('pay'), employeeId: emp.id, year, month, source: 'file', file: input.file, uploadedBy: actor.name, status: existing ? 'corrected' : 'final', version: (existing?.version ?? 0) + 1, earnings: [], deductions: [], workDays: 0, overtimeHours: 0, issuedAt: existing?.issuedAt ?? at, correctedAt: existing ? at : undefined, correctionNote: input.correctionNote?.trim(), payment: existing?.payment ?? null }
  if (existing) {
    const { previous, ...snapshot } = structuredClone(existing)
    p.previous = [...(previous ?? []), snapshot]
    db.payslips[db.payslips.indexOf(existing)] = p
  } else db.payslips.unshift(p)
  db.notifications.unshift({ id: uid('n'), at, read: false, audience: { role: 'employee', id: emp.id }, category: 'payslip', title: existing ? 'فیش حقوقی اصلاح شد' : 'فیش حقوقی جدید', body: formatPeriod(year, month), link: '/me/documents/payslips/' + p.id })
  record(db, actor, 'بارگذاری فیش حقوقی', p.id, emp.personnelNo + ' — ' + input.period, emp.projectId ?? undefined)
  return p
}
