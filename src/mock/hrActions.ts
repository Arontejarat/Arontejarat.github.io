import type { Attachment, Child, CompanyDocumentTemplate, CompanyHRPolicy, Employee, InsuranceRecord, Permission, RecordHistory, ReviewStatus } from '@/types/domain'
import type { DB } from './seed'
import { ApiError, createWorkerContract, type Actor } from './actions'
import { employeeInScope, scopeForUser } from './selectors'
import { SUBROLES } from '@/config/permissions'
import { uid } from '@/lib/cn'
import { toEnDigits } from '@/lib/format'
import { isValidNationalId } from '@/lib/validation'
import { jalaliMonthLength, toISODate, toJalali } from '@/lib/jalali'
import { evaluateFamilyRules, policyFor, validISO } from './hrRules'

export function requirePermission(db: DB, actor: Actor, permission: Permission) {
  const user = db.users.find((u) => u.id === actor.userId && u.status === 'active' && u.role === actor.role)
  const role = actor.role === 'employee' ? 'employee' : user?.subRole
  if (!role || !SUBROLES[role].permissions.includes(permission)) throw new ApiError('forbidden', 'مجوز این عملیات را ندارید.')
  return user
}
export function authorizedEmployee(db: DB, actor: Actor, employeeId: string, permission: Permission): Employee {
  const user = requirePermission(db, actor, permission)
  const e = db.employees.find((e) => e.id === employeeId)
  if (!e || (actor.role === 'employee' ? e.id !== actor.employeeId : !user || user.role !== 'company' || !employeeInScope(scopeForUser(user)!, e))) throw new ApiError('forbidden', 'این پرونده در محدوده دسترسی شما نیست.')
  return e
}
function history(actor: Actor, action: string, note?: string, before?: unknown, after?: unknown): RecordHistory {
  return { id: uid('h'), at: new Date().toISOString(), by: actor.name, action, note, before: before === undefined ? undefined : JSON.stringify(before), after: after === undefined ? undefined : JSON.stringify(after) }
}
function audit(db: DB, actor: Actor, e: Employee, action: string, id: string) {
  db.audit.unshift({ id: uid('a'), at: new Date().toISOString(), actor: actor.name, actorRole: actor.role, companyId: e.companyId, employeeId: e.id, orgId: e.orgId, action, entity: { type: 'employee', id, label: e.personnelNo }, result: 'success' })
}
function checkFiles(files: Attachment[], required = false) {
  if (!Array.isArray(files) || (required && !files.length) || files.length > 5 || files.some((f) => !f.storageKey || !['application/pdf', 'image/jpeg', 'image/png'].includes(f.mime) || f.size <= 0 || f.size > 10 * 1024 * 1024)) throw new ApiError('validation', 'فایل PDF یا تصویر معتبر، حداکثر ۱۰ مگابایت برای هر فایل، بارگذاری کنید.')
}
function queueReview(db: DB, actor: Actor, e: Employee, id: string, title: string, route: string, rule: string) {
  const hr = db.users.find((u) => u.companyId === e.companyId && u.subRole === 'cmp_hr' && u.status === 'active') ?? db.users.find((u) => u.companyId === e.companyId && u.subRole === 'cmp_admin' && u.status === 'active')
  db.notifications.unshift({ id: uid('n'), audience: { role: 'company', id: e.companyId }, category: 'document', title, body: e.firstName + ' ' + e.lastName, at: new Date().toISOString(), read: false, link: route + '?employee=' + e.id })
  if (!db.tasks.some((t) => t.ruleId === rule && t.link?.id === id && t.status !== 'done')) db.tasks.unshift({ id: uid('t'), title, scope: 'company', scopeId: e.companyId, projectId: e.projectId ?? undefined, assigneeId: hr?.id ?? '', createdBy: actor.name, kind: 'automatic', ruleId: rule, link: { type: rule === 'family_review' ? 'family' : rule === 'insurance_review' ? 'insurance' : 'employee', id, employeeId: e.id, label: e.personnelNo }, priority: 'medium', status: 'todo', dueAt: new Date(Date.now() + 3 * 86400000).toISOString(), createdAt: new Date().toISOString(), comments: [], history: [] })
}
function closeReview(db: DB, id: string, actor: Actor) {
  db.tasks.filter((t) => t.link?.id === id && ['family_review', 'insurance_review'].includes(t.ruleId ?? '') && t.status !== 'done').forEach((t) => { t.status = 'done'; t.history.push({ id: uid('h'), at: new Date().toISOString(), actor: actor.name, text: 'نتیجه بررسی ثبت شد.' }) })
}
export interface ChildInput { firstName: string; lastName: string; nationalId?: string; birthDate: string; relation: 'son' | 'daughter'; documents: Attachment[] }
export function saveChild(db: DB, actor: Actor, employeeId: string, input: ChildInput, childId?: string, expectedVersion = 0) {
  const e = authorizedEmployee(db, actor, employeeId, 'family.manage')
  const old = e.children.find((c) => c.id === childId)
  if (childId && !old) throw new ApiError('not_found', 'اطلاعات فرزند پیدا نشد.')
  if ((old?.version ?? 0) !== expectedVersion) throw new ApiError('conflict', 'اطلاعات فرزند تغییر کرده است؛ دوباره بارگذاری کنید.')
  if (actor.role === 'employee' && old?.status === 'approved') throw new ApiError('forbidden', 'اصلاح اطلاعات تأییدشده فقط توسط منابع انسانی مجاز است.')
  const nationalId = toEnDigits(input.nationalId?.trim() ?? '')
  if (!input.firstName.trim() || !input.lastName.trim() || !['son', 'daughter'].includes(input.relation) || !validISO(input.birthDate) || input.birthDate > toISODate(new Date())) throw new ApiError('validation', 'نام، نسبت و تاریخ تولد معتبر وارد کنید.')
  if ((policyFor(db, e.companyId).childNationalIdRequired || nationalId) && !isValidNationalId(nationalId)) throw new ApiError('validation', 'کد ملی معتبر فرزند الزامی است.')
  if (e.children.some((c) => c.id !== childId && ((nationalId && c.nationalId === nationalId) || (c.fullName === input.firstName.trim() + ' ' + input.lastName.trim() && c.birthDate === input.birthDate)))) throw new ApiError('duplicate', 'این فرزند قبلاً ثبت شده است.')
  checkFiles(input.documents, true)
  const at = new Date().toISOString()
  const { history: priorHistory, ...before } = old ?? {} as Child
  const child: Child = { ...input, nationalId, firstName: input.firstName.trim(), lastName: input.lastName.trim(), fullName: input.firstName.trim() + ' ' + input.lastName.trim(), id: old?.id ?? uid('child'), registeredAt: old?.registeredAt ?? at, status: 'pending', version: (old?.version ?? 0) + 1, history: [...(priorHistory ?? []), history(actor, old ? 'اصلاح اطلاعات و ارسال برای بررسی' : 'ثبت فرزند', undefined, old ? before : undefined, input)] }
  if (old) e.children[e.children.indexOf(old)] = child
  else e.children.push(child)
  queueReview(db, actor, e, child.id, 'بررسی اطلاعات فرزند ' + child.fullName, '/company/family', 'family_review')
  audit(db, actor, e, 'ثبت اطلاعات فرزند', child.id)
  evaluateFamilyRules(db)
  return child
}
export function reviewChild(db: DB, actor: Actor, employeeId: string, childId: string, decision: ReviewStatus, note: string, expectedVersion: number) {
  const e = authorizedEmployee(db, actor, employeeId, 'family.review')
  const c = e.children.find((x) => x.id === childId)
  if (!c || c.status !== 'pending' || c.version !== expectedVersion) throw new ApiError('conflict', 'اطلاعات تغییر کرده یا قبلاً بررسی شده است.')
  checkDecision(decision, note)
  c.status = decision; c.reviewNote = note.trim(); c.version = (c.version ?? 0) + 1
  ;(c.history ??= []).push(history(actor, 'بررسی: ' + decision, note))
  closeReview(db, c.id, actor)
  notifyEmployee(db, e.id, 'نتیجه بررسی اطلاعات فرزند', note || 'اطلاعات فرزند تأیید شد.', '/me/family')
  audit(db, actor, e, 'بررسی اطلاعات فرزند', c.id)
  return c
}
function checkDecision(decision: ReviewStatus, note: string) {
  if (!['approved', 'rejected', 'needs_correction'].includes(decision) || (decision !== 'approved' && !note.trim())) throw new ApiError('validation', 'نتیجه معتبر و علت رد یا اصلاح را وارد کنید.')
}
function notifyEmployee(db: DB, employeeId: string, title: string, body: string, link: string) {
  db.notifications.unshift({ id: uid('n'), audience: { role: 'employee', id: employeeId }, category: 'document', title, body, link, at: new Date().toISOString(), read: false })
}
export interface InsuranceInput { year: number; month: number; days: number; employer: string; registrationNumber: string; documents: Attachment[] }
export function saveInsurance(db: DB, actor: Actor, employeeId: string, input: InsuranceInput, id?: string, expectedVersion = 0) {
  const e = authorizedEmployee(db, actor, employeeId, 'insurance.edit')
  const old = db.insuranceRecords.find((r) => r.id === id && r.employeeId === e.id)
  if (id && !old) throw new ApiError('not_found', 'سابقه بیمه پیدا نشد.')
  if (old && actor.role !== 'employee' && old.companyId !== e.companyId) throw new ApiError('forbidden', 'این سابقه متعلق به شرکت دیگری است.')
  if ((old?.version ?? 0) !== expectedVersion) throw new ApiError('conflict', 'سابقه بیمه تغییر کرده است.')
  if (actor.role === 'employee' && old?.status === 'approved') throw new ApiError('forbidden', 'اصلاح سابقه تأییدشده فقط توسط منابع انسانی مجاز است.')
  if (!Number.isInteger(input.year) || input.year < 1300 || input.year > toJalali(new Date()).jy || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) throw new ApiError('validation', 'دوره بیمه معتبر نیست.')
  const today = toJalali(new Date())
  if (input.year * 12 + input.month > today.jy * 12 + today.jm) throw new ApiError('validation', 'دوره بیمه نباید در آینده باشد.')
  const cap = Math.min(jalaliMonthLength(input.year, input.month), policyFor(db, e.companyId).insuranceMonthlyCap ?? 31)
  if (!Number.isInteger(input.days) || input.days < 0 || input.days > cap) throw new ApiError('validation', 'تعداد روز بیمه باید بین صفر و ' + cap + ' باشد.')
  if (!input.employer.trim()) throw new ApiError('validation', 'نام کارفرما را وارد کنید.')
  if (db.insuranceRecords.some((r) => r.id !== id && r.employeeId === employeeId && r.year === input.year && r.month === input.month && r.employer.trim() === input.employer.trim())) throw new ApiError('duplicate', 'برای این کارفرما و دوره سابقه موجود است؛ همان رکورد را اصلاح کنید.')
  checkFiles(input.documents)
  const { history: priorHistory, ...before } = old ?? {} as InsuranceRecord
  const at = new Date().toISOString()
  const r: InsuranceRecord = { ...input, registrationNumber: toEnDigits(input.registrationNumber.trim()), id: old?.id ?? uid('ins'), employeeId, companyId: e.companyId, submittedAt: old?.submittedAt ?? at, updatedAt: at, status: 'pending', version: (old?.version ?? 0) + 1, history: [...(priorHistory ?? []), history(actor, old ? 'اصلاح و ارسال مجدد سابقه' : 'ثبت دستی سابقه بیمه', undefined, old ? before : undefined, input)] }
  if (old) db.insuranceRecords[db.insuranceRecords.indexOf(old)] = r
  else db.insuranceRecords.unshift(r)
  queueReview(db, actor, e, r.id, 'بررسی سابقه بیمه', '/company/insurance', 'insurance_review')
  audit(db, actor, e, 'ثبت سابقه بیمه', r.id)
  return r
}
export function reviewInsurance(db: DB, actor: Actor, id: string, decision: ReviewStatus, note: string, expectedVersion: number) {
  const r = db.insuranceRecords.find((x) => x.id === id)
  if (!r) throw new ApiError('not_found', 'سابقه پیدا نشد.')
  const e = authorizedEmployee(db, actor, r.employeeId, 'insurance.verify')
  if (r.companyId !== e.companyId) throw new ApiError('forbidden', 'این سابقه متعلق به شرکت دیگری است.')
  if (r.status !== 'pending' || r.version !== expectedVersion) throw new ApiError('conflict', 'سابقه تغییر کرده یا بررسی شده است.')
  checkDecision(decision, note)
  r.history.push(history(actor, 'بررسی: ' + decision, note, { status: r.status }, { status: decision }))
  r.status = decision; r.reviewNote = note.trim(); r.version++; r.updatedAt = new Date().toISOString()
  closeReview(db, r.id, actor)
  notifyEmployee(db, e.id, 'نتیجه بررسی سابقه بیمه', note || 'سابقه بیمه توسط شرکت تأیید شد؛ این تأیید استعلام رسمی نیست.', '/me/insurance')
  audit(db, actor, e, 'بررسی سابقه بیمه', r.id)
  return r
}
export function exportInsurance(db: DB, actor: Actor) {
  const user = requirePermission(db, actor, 'insurance.view')
  if (!user || user.role !== 'company') throw new ApiError('forbidden', 'خروجی گروهی فقط برای شرکت مجاز است.')
  return db.insuranceRecords.filter((r) => r.companyId === user.companyId && db.employees.some((e) => e.id === r.employeeId && employeeInScope(scopeForUser(user)!, e))).map((r) => structuredClone(r))
}
export function saveHRPolicy(db: DB, actor: Actor, input: CompanyHRPolicy) {
  const u = requirePermission(db, actor, 'templates.manage')
  if (!u || u.role !== 'company' || u.companyId !== input.companyId) throw new ApiError('forbidden', 'تنظیمات شرکت دیگر مجاز نیست.')
  if (!Number.isInteger(input.childAgeThreshold) || input.childAgeThreshold < 1 || input.childAgeThreshold > 100 || (input.insuranceMonthlyCap !== undefined && (!Number.isInteger(input.insuranceMonthlyCap) || input.insuranceMonthlyCap < 1 || input.insuranceMonthlyCap > 31))) throw new ApiError('validation', 'آستانه سن ۱ تا ۱۰۰ و سقف روز بیمه ۱ تا ۳۱ است.')
  const i = db.hrPolicies.findIndex((p) => p.companyId === u.companyId)
  if (i < 0) db.hrPolicies.push(input); else db.hrPolicies[i] = input
  db.audit.unshift({ id: uid('a'), at: new Date().toISOString(), actor: actor.name, actorRole: actor.role, companyId: u.companyId, action: 'تغییر قواعد پرسنلی شرکت', entity: { type: 'policy', id: u.companyId!, label: 'قواعد سن و بیمه' }, result: 'success' })
  evaluateFamilyRules(db)
  return input
}
export function saveDocumentTemplate(db: DB, actor: Actor, input: CompanyDocumentTemplate, expectedVersion = 0) {
  const u = requirePermission(db, actor, 'templates.manage')
  if (!u || u.role !== 'company' || u.companyId !== input.companyId) throw new ApiError('forbidden', 'قالب شرکت دیگر قابل تغییر نیست.')
  const old = db.documentTemplates.find((t) => t.id === input.id)
  if (old && old.companyId !== u.companyId) throw new ApiError('forbidden', 'دسترسی به این قالب مجاز نیست.')
  if ((old?.version ?? 0) !== expectedVersion) throw new ApiError('conflict', 'نسخه قالب تغییر کرده است.')
  if (![input.name, input.companyName, input.contractTitle, input.payslipTitle].every((s) => typeof s === 'string' && s.trim())) throw new ApiError('validation', 'نام قالب، شرکت و عنوان اسناد الزامی است.')
  if (input.logo && (!input.logo.previewUrl?.startsWith('data:image/') || input.logo.previewUrl.length > 1500000 || !['image/jpeg', 'image/png'].includes(input.logo.mime))) throw new ApiError('validation', 'نشان شرکت باید تصویر معتبر باشد.')
  const t = { ...structuredClone(input), id: old?.id ?? uid('format'), version: (old?.version ?? 0) + 1 }
  if (old) db.documentTemplates[db.documentTemplates.indexOf(old)] = t; else db.documentTemplates.push(t)
  db.audit.unshift({ id: uid('a'), at: new Date().toISOString(), actor: actor.name, actorRole: actor.role, companyId: u.companyId, action: 'ذخیره قالب سند', entity: { type: 'template', id: t.id, label: t.name }, result: 'success' })
  return t
}
export function payslipFile(db: DB, actor: Actor, id: string, version?: number) {
  const p = db.payslips.find((p) => p.id === id)
  if (!p) throw new ApiError('not_found', 'فیش پیدا نشد.')
  authorizedEmployee(db, actor, p.employeeId, 'payslips.download')
  const shown = version === undefined || version === p.version ? p : p.previous?.find((v) => v.version === version)
  if (!shown?.file?.storageKey) throw new ApiError('not_found', 'فایل اصلی موجود نیست؛ از خروجی PDF سامانه استفاده کنید.')
  return structuredClone(shown.file)
}
export function requestContractPreparation(db: DB, actor: Actor) {
  if (actor.role !== 'employee' || !actor.employeeId) throw new ApiError('forbidden', 'فقط نیروی کار می‌تواند درخواست دهد.')
  const e = db.employees.find((x) => x.id === actor.employeeId)
  if (!e) throw new ApiError('not_found', 'نیرو پیدا نشد.')
  const existing = db.tasks.find((t) => t.ruleId === 'contract_preparation' && t.link?.id === e.id && t.status !== 'done')
  if (existing) return existing
  queueReview(db, actor, e, e.id, 'تهیه / تمدید قرارداد ' + e.firstName + ' ' + e.lastName, '/company/workforce/' + e.id, 'contract_preparation')
  return db.tasks.find((t) => t.ruleId === 'contract_preparation' && t.link?.id === e.id)!
}
export function scopedCreateWorkerContract(db: DB, actor: Actor, employeeId: string, year: number, month: number, start: string, end: string, templateId?: string) {
  const e = authorizedEmployee(db, actor, employeeId, 'contracts.manage')
  if (!validISO(start) || !validISO(end) || end <= start || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new ApiError('validation', 'بازه قرارداد معتبر نیست.')
  if (db.contracts.some((c) => c.kind === 'worker' && c.employeeId === e.id && !['cancelled', 'superseded'].includes(c.stage) && c.startDate <= end && c.endDate >= start)) throw new ApiError('conflict', 'بازه با قرارداد موجود تداخل دارد.')
  const template = templateId ? db.documentTemplates.find((t) => t.id === templateId && t.companyId === e.companyId) : db.documentTemplates.find((t) => t.companyId === e.companyId)
  if (!template) throw new ApiError('forbidden', 'قالب شرکت معتبر نیست.')
  const c = createWorkerContract(db, actor, employeeId, year, month, start, end)
  c.employeeSnapshot = { firstName: e.firstName, lastName: e.lastName, nationalId: e.nationalId, personnelNo: e.personnelNo, shift: e.shift }
  c.documentFormat = structuredClone(template)
  c.createdAt = new Date().toISOString(); c.createdBy = actor.name
  db.tasks.filter((t) => t.ruleId === 'contract_preparation' && t.link?.id === e.id && t.status !== 'done').forEach((t) => { t.status = 'done'; t.closedAutomatically = true })
  return c
}
