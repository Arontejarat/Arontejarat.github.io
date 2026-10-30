/**
 * Mock mutations. Each function mutates a draft copy of the DB and models the
 * server-side behaviour the PRD requires (audit trail, notifications, automatic
 * tasks, conflict detection). In production these become API calls; the UI
 * calls them only through useActions() so the swap is localised.
 */
import { uid } from '@/lib/cn'
import { formatRial, toFaDigits } from '@/lib/format'
import { docType } from '@/config/documentTypes'
import { REQUEST_STATUS } from '@/config/status'
import { toJalali } from '@/lib/jalali'
import type {
  AlertRule,
  AppNotification,
  AppUser,
  Attachment,
  AuditEntry,
  Contract,
  DocVersion,
  Employee,
  EmployeeRequest,
  OrgFile,
  Party,
  Project,
  RequestTypeDef,
  RoleKey,
  Task,
  TaskLink,
} from '@/types/domain'
import type { DB, SupportTicket } from './seed'
import { activeParty, employeeById, fullName, requestType, signatureStatus } from './selectors'

export class ApiError extends Error {
  code: 'network' | 'conflict' | 'duplicate' | 'forbidden' | 'validation' | 'expired' | 'not_found'
  constructor(code: ApiError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export interface Actor {
  name: string
  role: RoleKey
  userId?: string
  employeeId?: string
  orgId?: string
  companyId?: string
}

const now = () => new Date().toISOString()

function audit(db: DB, actor: Actor, e: Omit<AuditEntry, 'id' | 'at' | 'actor' | 'actorRole'>) {
  db.audit.unshift({ id: uid('a'), at: now(), actor: actor.name, actorRole: actor.role, ...e })
}

function notify(db: DB, n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
  db.notifications.unshift({ id: uid('n'), at: now(), read: false, ...n })
}

/** Creates an automatic/system task unless an open one already exists for the same record and rule. */
function ensureTask(db: DB, t: Omit<Task, 'id' | 'createdAt' | 'comments' | 'history' | 'createdBy' | 'status'>) {
  const dup = db.tasks.find((x) => x.status !== 'done' && x.ruleId === t.ruleId && x.link?.id === t.link?.id)
  if (dup) return dup
  const task: Task = {
    ...t,
    id: uid('t'),
    status: 'todo',
    createdBy: 'سامانه',
    createdAt: now(),
    comments: [],
    history: [{ id: uid('th'), at: now(), actor: 'سامانه', text: 'وظیفه بر اساس رویداد سامانه ایجاد شد.' }],
  }
  db.tasks.unshift(task)
  return task
}

/** Closes open tasks linked to a record once their cause is resolved. */
function autoCloseTasks(db: DB, linkId: string, ruleIds: string[], reason: string) {
  db.tasks.forEach((t) => {
    if (t.status !== 'done' && t.link?.id === linkId && t.ruleId && ruleIds.includes(t.ruleId)) {
      t.status = 'done'
      t.closedAutomatically = true
      t.history.push({ id: uid('th'), at: now(), actor: 'سامانه', text: `بسته شد: ${reason}` })
    }
  })
}

function nextTracking(db: DB) {
  const jy = toJalali(new Date()).jy
  const max = db.requests.reduce((m, r) => Math.max(m, Number(r.trackingNo.slice(4)) || 0), 1200)
  return `${jy}${String(max + 1).padStart(5, '0')}`
}

/* =================================================================== */
/* Employee: requests                                                   */
/* =================================================================== */

export interface RequestInput {
  typeId: string
  values: Record<string, unknown>
  attachments: Attachment[]
  confidential?: boolean
}

export function saveDraft(db: DB, actor: Actor, input: RequestInput, draftId?: string): EmployeeRequest {
  const existing = draftId ? db.requests.find((r) => r.id === draftId && r.status === 'draft') : undefined
  if (existing) {
    Object.assign(existing, { typeId: input.typeId, values: input.values, attachments: input.attachments, confidential: input.confidential, updatedAt: now() })
    return existing
  }
  const type = requestType(db, input.typeId)!
  const r: EmployeeRequest = {
    id: uid('r'),
    trackingNo: '—',
    typeId: input.typeId,
    employeeId: actor.employeeId!,
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
    values: input.values,
    attachments: input.attachments,
    steps: type.workflow.map((w) => ({ party: w.party, label: w.label, status: 'waiting' })),
    currentStep: 0,
    history: [{ id: uid('h'), at: now(), actor: actor.name, actorRole: 'employee', kind: 'created', note: 'ذخیره به‌عنوان پیش‌نویس' }],
    messages: [],
    internalNotes: [],
    confidential: input.confidential,
  }
  db.requests.unshift(r)
  return r
}

export function submitRequest(db: DB, actor: Actor, input: RequestInput, draftId?: string): EmployeeRequest {
  const type = requestType(db, input.typeId)
  if (!type || !type.enabled) throw new ApiError('validation', 'این نوع درخواست در حال حاضر فعال نیست.')
  const emp = employeeById(db, actor.employeeId)!
  if (type.rules?.singleOpen) {
    const dup = db.requests.find((r) => r.employeeId === emp.id && r.typeId === type.id && ['submitted', 'in_review', 'needs_correction'].includes(r.status) && r.id !== draftId)
    if (dup) throw new ApiError('duplicate', `درخواست مشابهی از قبل ثبت شده است (شماره پیگیری ${toFaDigits(dup.trackingNo)}).`)
  }
  let r = draftId ? db.requests.find((x) => x.id === draftId && x.status === 'draft') : undefined
  if (!r) r = saveDraft(db, actor, input)
  Object.assign(r, { values: input.values, attachments: input.attachments, confidential: input.confidential })
  r.trackingNo = nextTracking(db)
  r.status = 'submitted'
  r.submittedAt = now()
  r.updatedAt = now()
  r.steps = type.workflow.map((w, i) => ({ party: w.party, label: w.label, status: i === 0 ? 'active' : 'waiting' }))
  r.currentStep = 0
  r.dueAt = new Date(Date.now() + type.slaDays * 86_400_000).toISOString()
  r.assignee = type.workflow[0].label
  r.history.push(
    { id: uid('h'), at: now(), actor: actor.name, actorRole: 'employee', kind: 'submitted' },
    { id: uid('h'), at: now(), actor: 'سامانه', actorRole: 'system', kind: 'assigned', note: `ارجاع خودکار به ${type.workflow[0].label}` },
  )
  audit(db, actor, { action: 'ثبت درخواست', entity: { type: 'request', id: r.id, label: r.trackingNo }, result: 'success', employeeId: emp.id, orgId: emp.orgId, companyId: emp.companyId })
  notify(db, {
    audience: { role: 'employee', id: emp.id },
    category: 'request',
    title: 'درخواست ثبت شد',
    body: `درخواست «${type.title}» با شماره پیگیری ${toFaDigits(r.trackingNo)} ثبت شد.`,
    link: `/me/requests/${r.id}`,
  })
  const party = type.workflow[0].party
  notify(db, {
    audience: { role: party, id: party === 'org' ? emp.orgId : emp.companyId },
    category: 'request',
    title: 'درخواست جدید ثبت شد',
    // Sensitive details are deliberately not included in the notification body
    body: `${type.title} — ${fullName(emp)}`,
    link: `/${party === 'org' ? 'org' : 'company'}/requests/${r.id}`,
  })
  // Move moved draft to top
  db.requests = [r, ...db.requests.filter((x) => x.id !== r!.id)]
  return r
}

export function resubmitRequest(db: DB, actor: Actor, id: string, values: Record<string, unknown>, attachments: Attachment[], reply: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r || r.employeeId !== actor.employeeId) throw new ApiError('forbidden', 'دسترسی به این درخواست مجاز نیست.')
  if (r.status !== 'needs_correction') throw new ApiError('conflict', 'وضعیت درخواست تغییر کرده و دیگر قابل اصلاح نیست.')
  r.values = values
  r.attachments = attachments
  r.status = 'in_review'
  r.steps[r.currentStep].status = 'active'
  r.updatedAt = now()
  if (reply.trim()) r.messages.push({ id: uid('m'), at: now(), author: actor.name, authorRole: 'employee', text: reply.trim() })
  r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: 'employee', kind: 'resubmitted', note: reply.trim() || 'اطلاعات اصلاح و دوباره ارسال شد.' })
  const emp = employeeById(db, r.employeeId)!
  const party = r.steps[r.currentStep].party
  notify(db, {
    audience: { role: party, id: party === 'org' ? emp.orgId : emp.companyId },
    category: 'request',
    title: 'درخواست اصلاح‌شده دریافت شد',
    body: `${requestType(db, r.typeId)?.title} — ${fullName(emp)}`,
    link: `/${party === 'org' ? 'org' : 'company'}/requests/${r.id}`,
  })
  audit(db, actor, { action: 'ارسال مجدد درخواست', entity: { type: 'request', id: r.id, label: r.trackingNo }, result: 'success', employeeId: emp.id })
  return r
}

export function cancelRequest(db: DB, actor: Actor, id: string, reason: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r || r.employeeId !== actor.employeeId) throw new ApiError('forbidden', 'دسترسی به این درخواست مجاز نیست.')
  if (!['submitted', 'needs_correction', 'in_review'].includes(r.status)) throw new ApiError('conflict', 'این درخواست در وضعیت فعلی قابل لغو نیست.')
  if (r.status === 'in_review' && r.steps.some((s) => s.status === 'approved')) throw new ApiError('conflict', 'بخشی از درخواست تأیید شده و لغو آن فقط از طریق مرجع رسیدگی ممکن است.')
  r.status = 'cancelled'
  r.finalizedAt = now()
  r.updatedAt = now()
  r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: 'employee', kind: 'cancelled', note: reason || 'لغو توسط درخواست‌دهنده' })
  autoCloseTasks(db, r.id, ['request_overdue'], 'درخواست لغو شد')
  audit(db, actor, { action: 'لغو درخواست', entity: { type: 'request', id: r.id, label: r.trackingNo }, result: 'success', employeeId: r.employeeId })
  return r
}

export function deleteDraft(db: DB, actor: Actor, id: string) {
  db.requests = db.requests.filter((r) => !(r.id === id && r.status === 'draft' && r.employeeId === actor.employeeId))
}

export function addRequestMessage(db: DB, actor: Actor, id: string, text: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r) throw new ApiError('not_found', 'درخواست یافت نشد.')
  r.messages.push({ id: uid('m'), at: now(), author: actor.name, authorRole: actor.role, text })
  r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'message', note: text })
  r.updatedAt = now()
  if (actor.role !== 'employee') {
    notify(db, { audience: { role: 'employee', id: r.employeeId }, category: 'request', title: 'پاسخ جدید به درخواست شما', body: `درخواست ${toFaDigits(r.trackingNo)}`, link: `/me/requests/${r.id}` })
  }
}

/* =================================================================== */
/* Management: request decisions                                       */
/* =================================================================== */

export function decideRequest(db: DB, actor: Actor, id: string, decision: 'approve' | 'reject' | 'return', note: string, expectedUpdatedAt: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r) throw new ApiError('not_found', 'درخواست یافت نشد.')
  // Optimistic concurrency: prevents two reviewers recording conflicting decisions
  if (r.updatedAt !== expectedUpdatedAt) throw new ApiError('conflict', 'این درخواست هم‌زمان توسط کاربر دیگری تغییر کرده است. صفحه را به‌روز کنید و دوباره بررسی کنید.')
  const party = activeParty(r)
  if (party !== actor.role) throw new ApiError('forbidden', 'تصمیم‌گیری درباره این مرحله در اختیار شما نیست.')
  const step = r.steps[r.currentStep]
  const type = requestType(db, r.typeId)!
  const emp = employeeById(db, r.employeeId)!
  step.decidedAt = now()
  step.decidedBy = actor.name
  if (decision === 'approve') {
    step.status = 'approved'
    if (r.currentStep < r.steps.length - 1) {
      r.currentStep += 1
      r.steps[r.currentStep].status = 'active'
      r.status = 'in_review'
      r.assignee = r.steps[r.currentStep].label
      r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'step_approved', note: note || `تأیید مرحله «${step.label}» و ارجاع به ${r.steps[r.currentStep].label}` })
      const next = r.steps[r.currentStep].party
      notify(db, { audience: { role: next, id: next === 'org' ? emp.orgId : emp.companyId }, category: 'request', title: 'درخواست برای تصمیم شما ارجاع شد', body: `${type.title} — ${fullName(emp)}`, link: `/${next === 'org' ? 'org' : 'company'}/requests/${r.id}` })
    } else {
      r.status = 'approved'
      r.assignee = type.executionLabel ? `ثبت اجرا: ${type.executionLabel}` : undefined
      r.finalizedAt = type.executionLabel ? undefined : now()
      r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'approved', note: note || 'درخواست تأیید شد.' })
      notify(db, {
        audience: { role: 'employee', id: emp.id },
        category: 'request',
        title: 'درخواست شما تأیید شد',
        body: type.executionLabel ? `«${type.title}» تأیید شد. ${type.executionLabel} پس از ثبت، اطلاع‌رسانی می‌شود.` : `«${type.title}» تأیید شد.`,
        link: `/me/requests/${r.id}`,
      })
    }
  } else if (decision === 'reject') {
    if (!note.trim()) throw new ApiError('validation', 'ثبت دلیل رد الزامی است.')
    step.status = 'rejected'
    r.status = 'rejected'
    r.rejectionReason = note
    r.finalizedAt = now()
    r.assignee = undefined
    r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'rejected', note })
    r.messages.push({ id: uid('m'), at: now(), author: actor.name, authorRole: actor.role, text: note })
    notify(db, { audience: { role: 'employee', id: emp.id }, category: 'request', title: 'درخواست شما رد شد', body: `«${type.title}» رد شد. دلیل را در جزئیات درخواست ببینید.`, link: `/me/requests/${r.id}` })
  } else {
    if (!note.trim()) throw new ApiError('validation', 'توضیح موارد نیازمند اصلاح الزامی است.')
    step.status = 'returned'
    r.status = 'needs_correction'
    r.correctionNote = note
    r.assignee = fullName(emp)
    r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'returned', note })
    r.messages.push({ id: uid('m'), at: now(), author: actor.name, authorRole: actor.role, text: note })
    notify(db, { audience: { role: 'employee', id: emp.id }, category: 'request', title: 'درخواست شما نیازمند اصلاح است', body: `«${type.title}» برای اصلاح برگشت داده شد.`, link: `/me/requests/${r.id}` })
  }
  r.updatedAt = now()
  if (r.status !== 'in_review') autoCloseTasks(db, r.id, ['request_overdue'], 'درباره درخواست تصمیم‌گیری شد')
  const label = decision === 'approve' ? 'تأیید درخواست' : decision === 'reject' ? 'رد درخواست' : 'برگشت درخواست برای اصلاح'
  audit(db, actor, { action: label, entity: { type: 'request', id: r.id, label: r.trackingNo }, result: 'success', employeeId: emp.id, orgId: emp.orgId, companyId: emp.companyId, detail: note || undefined })
  return r
}

export function executeRequest(db: DB, actor: Actor, id: string, note: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r) throw new ApiError('not_found', 'درخواست یافت نشد.')
  if (r.status !== 'approved') throw new ApiError('conflict', 'فقط درخواست تأییدشده قابل ثبت اجراست.')
  const type = requestType(db, r.typeId)!
  r.status = 'executed'
  r.execution = { at: now(), by: actor.name, note }
  r.finalizedAt = now()
  r.updatedAt = now()
  r.assignee = undefined
  r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'executed', note })
  const emp = employeeById(db, r.employeeId)!
  // Executed changes are applied to the personnel record where applicable
  if (type.id === 'bank_change' && typeof r.values.sheba === 'string') {
    emp.bankAccounts.forEach((b) => (b.activeForPayroll = false))
    emp.bankAccounts.push({ id: uid('ba'), bank: String(r.values.bank ?? ''), sheba: r.values.sheba, holder: String(r.values.holder ?? ''), verified: true, activeForPayroll: true })
    emp.changeLog.unshift({ id: uid('cl'), at: now(), by: actor.name, field: 'حساب حقوق', before: 'حساب قبلی', after: String(r.values.bank ?? ''), source: 'request' })
  }
  if (type.id === 'marital_change' && typeof r.values.newStatus === 'string') {
    emp.changeLog.unshift({ id: uid('cl'), at: now(), by: actor.name, field: 'وضعیت تأهل', before: emp.maritalStatus, after: r.values.newStatus, source: 'request' })
    emp.maritalStatus = r.values.newStatus as Employee['maritalStatus']
  }
  notify(db, { audience: { role: 'employee', id: emp.id }, category: 'request', title: `${type.executionLabel ?? 'اقدام نهایی'} انجام شد`, body: note || `درخواست «${type.title}» اجرا شد.`, link: `/me/requests/${r.id}` })
  audit(db, actor, { action: 'ثبت اجرای درخواست', entity: { type: 'request', id: r.id, label: r.trackingNo }, result: 'success', employeeId: emp.id, companyId: emp.companyId, detail: note })
  return r
}

export function referRequest(db: DB, actor: Actor, id: string, assignee: string, note: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r) throw new ApiError('not_found', 'درخواست یافت نشد.')
  r.assignee = assignee
  if (r.status === 'submitted') r.status = 'in_review'
  r.updatedAt = now()
  r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'referred', note: `ارجاع به ${assignee}${note ? ` — ${note}` : ''}` })
  r.internalNotes.push({ id: uid('in'), at: now(), author: actor.name, authorRole: actor.role, text: `ارجاع به ${assignee}${note ? `: ${note}` : ''}` })
  audit(db, actor, { action: 'ارجاع درخواست', entity: { type: 'request', id: r.id, label: r.trackingNo }, result: 'success', detail: assignee })
}

export function startReview(db: DB, actor: Actor, id: string) {
  const r = db.requests.find((x) => x.id === id)
  if (r && r.status === 'submitted' && activeParty(r) === actor.role) {
    r.status = 'in_review'
    r.updatedAt = now()
    r.history.push({ id: uid('h'), at: now(), actor: actor.name, actorRole: actor.role, kind: 'assigned', note: 'بررسی آغاز شد.' })
  }
}

export function addInternalNote(db: DB, actor: Actor, id: string, text: string) {
  const r = db.requests.find((x) => x.id === id)
  if (!r) return
  r.internalNotes.push({ id: uid('in'), at: now(), author: actor.name, authorRole: actor.role, text })
}

/* =================================================================== */
/* Contracts                                                            */
/* =================================================================== */

export function markContractViewed(db: DB, _actor: Actor, id: string) {
  const c = db.contracts.find((x) => x.id === id)
  if (c && !c.viewedAt) {
    c.viewedAt = now()
    c.history.push({ id: uid('ch'), at: now(), actor: fullName(employeeById(db, c.employeeId)!), text: 'قرارداد توسط نیروی کار مشاهده شد.' })
  }
}

export function signContractByEmployee(db: DB, actor: Actor, id: string, shownVersionHash: string) {
  const c = db.contracts.find((x) => x.id === id)
  if (!c || c.employeeId !== actor.employeeId) throw new ApiError('forbidden', 'دسترسی به این قرارداد مجاز نیست.')
  if (c.stage !== 'awaiting_worker') throw new ApiError('conflict', 'این قرارداد در وضعیت قابل امضا نیست.')
  // The version shown for signature must be exactly the one being signed
  if (c.versionHash !== shownVersionHash) throw new ApiError('conflict', 'نسخه قرارداد تغییر کرده است. لطفاً نسخه جدید را مطالعه کنید.')
  const emp = employeeById(db, c.employeeId)!
  const receiptNo = `SG-${c.number.slice(3)}-${Math.floor(Math.random() * 900 + 100)}`
  c.employeeSignature = { signedAt: now(), receiptNo, method: 'sms_otp', mobile: emp.mobile, versionHash: c.versionHash }
  const worker = c.parties.find((p) => p.role === 'worker')
  if (worker) worker.signedAt = now()
  c.stage = c.parties.every((p) => !p.required || p.signedAt) ? 'completed' : 'awaiting_other'
  c.history.push({ id: uid('ch'), at: now(), actor: actor.name, text: `امضای نیروی کار با کد پیامکی ثبت شد (رسید ${receiptNo}).` })
  audit(db, actor, { action: 'امضای قرارداد', entity: { type: 'contract', id: c.id, label: c.number }, result: 'success', employeeId: emp.id, companyId: c.companyId, detail: `نسخه ${c.versionHash.slice(0, 8)}` })
  autoCloseTasks(db, c.id, ['contract_sent', 'sign_deadline'], 'امضای نیروی کار ثبت شد')
  notify(db, { audience: { role: 'company', id: c.companyId }, category: 'contract', title: 'امضای نیروی کار ثبت شد', body: `${c.title} — امضای شرکت باقی مانده است.`, link: `/company/contracts/${c.id}` })
  return c
}

export function sendContractForSignature(db: DB, actor: Actor, id: string, deadline: string) {
  const c = db.contracts.find((x) => x.id === id)
  if (!c) throw new ApiError('not_found', 'قرارداد یافت نشد.')
  if (c.stage !== 'ready_to_send') throw new ApiError('conflict', 'فقط قرارداد آماده ارسال قابل ارسال است.')
  c.signDeadline = deadline
  if (c.kind === 'worker') {
    c.stage = 'awaiting_worker'
    notify(db, { audience: { role: 'employee', id: c.employeeId! }, category: 'contract', title: 'قرارداد جدید آماده امضاست', body: 'قرارداد ماهانه شما برای مشاهده و امضا ارسال شد.', link: `/me/documents/contracts/${c.id}` })
    ensureTask(db, {
      title: `پیگیری تکمیل امضای ${c.title.replace('قرارداد ماهانه ', '')}`,
      kind: 'system',
      ruleId: 'contract_sent',
      link: { type: 'contract', id: c.id, label: c.number },
      projectId: c.projectId,
      scope: 'company',
      scopeId: c.companyId,
      assigneeId: actor.userId ?? 'u-c4',
      priority: 'medium',
      dueAt: deadline,
    })
  } else {
    c.stage = 'awaiting_other'
    notify(db, { audience: { role: 'org', id: c.orgId }, category: 'contract', title: 'قرارداد برای امضا ارسال شد', body: c.title, link: `/org/contracts/${c.id}` })
  }
  c.history.push({ id: uid('ch'), at: now(), actor: actor.name, text: 'قرارداد برای امضا ارسال شد.' })
  audit(db, actor, { action: 'ارسال قرارداد برای امضا', entity: { type: 'contract', id: c.id, label: c.number }, result: 'success', companyId: c.companyId, orgId: c.orgId })
}

export function remindContract(db: DB, actor: Actor, id: string) {
  const c = db.contracts.find((x) => x.id === id)
  if (!c) return
  const pending = c.parties.filter((p) => p.required && !p.signedAt)
  pending.forEach((p) => {
    if (p.role === 'worker' && c.employeeId)
      notify(db, { audience: { role: 'employee', id: c.employeeId }, category: 'contract', title: 'یادآوری امضای قرارداد', body: 'قرارداد شما هنوز امضا نشده است.', link: `/me/documents/contracts/${c.id}`, urgent: true })
    if (p.role === 'org') notify(db, { audience: { role: 'org', id: c.orgId }, category: 'contract', title: 'یادآوری امضای قرارداد', body: c.title, link: `/org/contracts/${c.id}`, urgent: true })
  })
  c.history.push({ id: uid('ch'), at: now(), actor: actor.name, text: `یادآوری برای ${pending.map((p) => p.name).join('، ')} ارسال شد.` })
}

export function advanceContractStage(db: DB, actor: Actor, id: string, action: 'company_approve' | 'org_approve' | 'org_return' | 'submit_review', note = '') {
  const c = db.contracts.find((x) => x.id === id)
  if (!c) throw new ApiError('not_found', 'قرارداد یافت نشد.')
  if (action === 'submit_review' && c.stage === 'draft') c.stage = 'company_review'
  else if (action === 'company_approve' && c.stage === 'company_review') c.stage = c.kind === 'project' ? 'org_review' : 'ready_to_send'
  else if (action === 'org_approve' && c.stage === 'org_review') {
    c.stage = 'ready_to_send'
    notify(db, { audience: { role: 'company', id: c.companyId }, category: 'contract', title: 'قرارداد توسط سازمان تأیید شد', body: c.title, link: `/company/contracts/${c.id}` })
  } else if (action === 'org_return' && c.stage === 'org_review') {
    c.stage = 'draft'
    notify(db, { audience: { role: 'company', id: c.companyId }, category: 'contract', title: 'قرارداد برای اصلاح برگشت داده شد', body: note, link: `/company/contracts/${c.id}`, urgent: true })
  } else throw new ApiError('conflict', 'وضعیت قرارداد تغییر کرده است. صفحه را به‌روز کنید.')
  const text = { submit_review: 'ارسال برای بررسی شرکت', company_approve: 'تأیید بررسی شرکت', org_approve: 'تأیید سازمان', org_return: 'برگشت برای اصلاح توسط سازمان' }[action]
  c.history.push({ id: uid('ch'), at: now(), actor: actor.name, text: note ? `${text}: ${note}` : text })
  audit(db, actor, { action: text, entity: { type: 'contract', id: c.id, label: c.number }, result: 'success', companyId: c.companyId, orgId: c.orgId, detail: note || undefined })
}

export function signContractAsParty(db: DB, actor: Actor, id: string, role: 'company' | 'org') {
  const c = db.contracts.find((x) => x.id === id)
  if (!c) throw new ApiError('not_found', 'قرارداد یافت نشد.')
  const party = c.parties.find((p) => p.role === role)
  if (!party || party.signedAt) throw new ApiError('conflict', 'امضای این طرف قبلاً ثبت شده است.')
  if (!['awaiting_other', 'partially_signed', 'awaiting_worker'].includes(c.stage)) throw new ApiError('conflict', 'قرارداد در وضعیت قابل امضا نیست.')
  party.signedAt = now()
  party.signedBy = actor.name
  const sig = signatureStatus(c)
  c.stage = sig === 'complete' ? 'completed' : c.parties.find((p) => p.role === 'worker' && !p.signedAt) ? 'awaiting_worker' : 'partially_signed'
  c.history.push({ id: uid('ch'), at: now(), actor: actor.name, text: `امضای ${role === 'org' ? 'سازمان' : 'شرکت'} ثبت شد.` })
  if (c.stage === 'completed') autoCloseTasks(db, c.id, ['contract_sent', 'sign_deadline'], 'امضاها تکمیل شد')
  if (c.stage === 'completed' && c.employeeId)
    notify(db, { audience: { role: 'employee', id: c.employeeId }, category: 'contract', title: 'امضای قرارداد تکمیل شد', body: 'همه طرف‌ها قرارداد را امضا کرده‌اند. نسخه نهایی قابل دریافت است.', link: `/me/documents/contracts/${c.id}` })
  audit(db, actor, { action: 'امضای قرارداد', entity: { type: 'contract', id: c.id, label: c.number }, result: 'success', companyId: c.companyId, orgId: c.orgId })
}

export function createWorkerContract(db: DB, actor: Actor, employeeId: string, year: number, month: number, start: string, end: string): Contract {
  const emp = employeeById(db, employeeId)!
  const dup = db.contracts.find((c) => c.employeeId === employeeId && c.periodYear === year && c.periodMonth === month && !['cancelled', 'superseded'].includes(c.stage))
  if (dup) throw new ApiError('duplicate', `برای این دوره قبلاً قرارداد ${dup.number} ایجاد شده است.`)
  const company = db.companies.find((c) => c.id === emp.companyId)!
  const number = `CT-${year}${String(month).padStart(2, '0')}-${emp.personnelNo.slice(3)}`
  const c: Contract = {
    id: uid('ct'),
    number,
    kind: 'worker',
    title: `قرارداد ماهانه ${fullName(emp)}`,
    employeeId,
    companyId: emp.companyId,
    orgId: emp.orgId,
    projectId: emp.projectId ?? '',
    periodYear: year,
    periodMonth: month,
    jobTitle: emp.jobTitle,
    workplace: emp.workplace,
    startDate: start,
    endDate: end,
    stage: 'draft',
    parties: [
      { role: 'worker', name: fullName(emp), required: true },
      { role: 'company', name: company.name, required: true },
    ],
    versionHash: Math.random().toString(16).slice(2, 18),
    version: 1,
    salary: [
      { label: 'حقوق پایه', amount: 152_000_000 },
      { label: 'حق مسکن', amount: 9_000_000 },
      { label: 'بن کارگری', amount: 22_000_000 },
    ],
    workHours: '۴۴ ساعت در هفته',
    history: [{ id: uid('ch'), at: now(), actor: actor.name, text: 'پیش‌نویس قرارداد ایجاد شد.' }],
  }
  db.contracts.unshift(c)
  audit(db, actor, { action: 'ایجاد نسخه جدید قرارداد', entity: { type: 'contract', id: c.id, label: c.number }, result: 'success', companyId: c.companyId, employeeId })
  return c
}

/* =================================================================== */
/* Documents                                                            */
/* =================================================================== */

export interface UploadInput {
  typeId: string
  fileName: string
  size: number
  mime: string
  previewUrl?: string
  expiresAt?: string
}

export function uploadPersonnelDocument(db: DB, actor: Actor, input: UploadInput, employeeId = actor.employeeId!) {
  const t = docType(input.typeId)
  if (!t) throw new ApiError('validation', 'نوع مدرک نامعتبر است.')
  if (!t.accept.includes(input.mime)) throw new ApiError('validation', 'فایل انتخاب‌شده معتبر نیست.')
  if (input.size > t.maxSizeMb * 1024 * 1024) throw new ApiError('validation', `حجم فایل بیش از ${toFaDigits(t.maxSizeMb)} مگابایت است.`)
  let doc = db.documents.find((d) => d.employeeId === employeeId && d.typeId === input.typeId)
  const receiptNo = `DR-${Math.floor(Date.now() / 1000) % 1_000_000}`
  const version: DocVersion = {
    version: doc ? doc.versions.length + 1 : 1,
    fileName: input.fileName,
    size: input.size,
    mime: input.mime,
    previewUrl: input.previewUrl,
    uploadedAt: now(),
    uploadedBy: actor.name,
    status: 'pending',
    receiptNo,
  }
  if (doc) {
    const cur = doc.versions[doc.versions.length - 1]
    if (cur.status === 'pending') throw new ApiError('conflict', 'نسخه قبلی هنوز در انتظار بررسی است و قابل جایگزینی نیست.')
    if (cur.status === 'approved' && !(doc.expiresAt && new Date(doc.expiresAt) < new Date(Date.now() + 30 * 86_400_000)))
      throw new ApiError('conflict', 'این مدرک تأیید شده است. برای تغییر آن از مرکز درخواست‌ها اقدام کنید.')
    // Previous versions and their rejection reasons are preserved
    doc.versions.push(version)
    if (input.expiresAt) doc.expiresAt = input.expiresAt
  } else {
    doc = { id: uid('d'), employeeId, typeId: input.typeId, versions: [version], expiresAt: input.expiresAt }
    db.documents.push(doc)
  }
  const emp = employeeById(db, employeeId)!
  audit(db, actor, { action: version.version > 1 ? 'بارگذاری نسخه جدید مدرک' : 'ارسال مدرک', entity: { type: 'document', id: doc.id, label: t.title }, result: 'success', employeeId, companyId: emp.companyId, orgId: emp.orgId })
  notify(db, { audience: { role: t.reviewParty, id: t.reviewParty === 'org' ? emp.orgId : emp.companyId }, category: 'document', title: 'مدرک جدید بارگذاری شد', body: `${t.title} — ${fullName(emp)}`, link: `/${t.reviewParty === 'org' ? 'org' : 'company'}/documents` })
  autoCloseTasks(db, doc.id, ['doc_rejected'], 'نسخه اصلاحی بارگذاری شد')
  return { doc, version }
}

export function reviewDocument(db: DB, actor: Actor, docId: string, decision: 'approve' | 'reject' | 'needs_fix', reasonCode?: string, reason?: string, fixDeadline?: string) {
  const d = db.documents.find((x) => x.id === docId)
  if (!d) throw new ApiError('not_found', 'مدرک یافت نشد.')
  const v = d.versions[d.versions.length - 1]
  if (v.status !== 'pending') throw new ApiError('conflict', 'این مدرک قبلاً بررسی شده است.')
  const t = docType(d.typeId)!
  if (t.reviewParty !== actor.role) throw new ApiError('forbidden', 'بررسی این نوع مدرک در اختیار طرف دیگر است.')
  if (decision !== 'approve' && !reason?.trim()) throw new ApiError('validation', 'ثبت علت الزامی است.')
  v.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_fix'
  v.reviewer = actor.name
  v.reviewedAt = now()
  v.reasonCode = reasonCode
  v.reason = reason
  v.fixDeadline = fixDeadline
  const emp = employeeById(db, d.employeeId)!
  notify(db, {
    audience: { role: 'employee', id: emp.id },
    category: 'document',
    title: decision === 'approve' ? `${t.title} تأیید شد` : `${t.title} نیازمند اصلاح است`,
    body: decision === 'approve' ? 'مدرک شما بررسی و تأیید شد.' : 'دلیل و مهلت اصلاح را در جزئیات مدرک ببینید.',
    link: `/me/documents/personnel/${d.id}`,
  })
  if (decision !== 'approve') {
    ensureTask(db, {
      title: `پیگیری بارگذاری نسخه اصلاحی مدرک ${fullName(emp)}`,
      kind: 'system',
      ruleId: 'doc_rejected',
      link: { type: 'document', id: d.id, label: t.title },
      projectId: emp.projectId ?? undefined,
      scope: 'company',
      scopeId: emp.companyId,
      assigneeId: 'u-c3',
      priority: 'medium',
      dueAt: fixDeadline ?? new Date(Date.now() + 5 * 86_400_000).toISOString(),
    })
  }
  audit(db, actor, {
    action: decision === 'approve' ? 'تأیید مدرک' : decision === 'reject' ? 'رد مدرک' : 'اعلام نقص مدرک',
    entity: { type: 'document', id: d.id, label: `${t.title} — ${fullName(emp)}` },
    result: 'success',
    employeeId: emp.id,
    orgId: emp.orgId,
    companyId: emp.companyId,
    detail: reason,
  })
}

/* =================================================================== */
/* Workforce                                                            */
/* =================================================================== */

export const EDITABLE_FIELDS: Record<string, string> = {
  jobTitle: 'سمت شغلی',
  projectId: 'پروژه',
  shift: 'شیفت',
  employmentStatus: 'وضعیت اشتغال',
  unit: 'واحد سازمانی',
}

export function updateEmployeeFields(db: DB, actor: Actor, ids: string[], changes: Partial<Pick<Employee, 'jobTitle' | 'projectId' | 'shift' | 'employmentStatus' | 'unit'>>, source: 'inline' | 'bulk' | 'import') {
  ids.forEach((id) => {
    const e = employeeById(db, id)
    if (!e) return
    ;(Object.keys(changes) as (keyof typeof changes)[]).forEach((k) => {
      const before = String(e[k] ?? '')
      const after = String(changes[k] ?? '')
      if (before === after) return
      if (k === 'projectId') {
        const open = e.assignments.find((a) => !a.to)
        if (open) open.to = new Date().toISOString().slice(0, 10)
        if (changes.projectId) e.assignments.push({ id: uid('as'), projectId: changes.projectId, from: new Date().toISOString().slice(0, 10) })
      }
      ;(e as unknown as Record<string, unknown>)[k] = changes[k] ?? null
      e.changeLog.unshift({ id: uid('cl'), at: now(), by: actor.name, field: EDITABLE_FIELDS[k] ?? k, before, after, source })
    })
    audit(db, actor, { action: source === 'bulk' ? 'ویرایش گروهی نیرو' : 'ویرایش اطلاعات نیرو', entity: { type: 'employee', id: e.id, label: fullName(e) }, result: 'success', employeeId: e.id, orgId: e.orgId, companyId: e.companyId, detail: Object.keys(changes).map((k) => EDITABLE_FIELDS[k]).join('، ') })
  })
}

/** Removing from a project keeps all records (contracts, payslips, documents, requests). */
export function removeFromProject(db: DB, actor: Actor, id: string, note: string) {
  const e = employeeById(db, id)
  if (!e || !e.projectId) return
  const project = db.projects.find((p) => p.id === e.projectId)
  const open = e.assignments.find((a) => !a.to)
  if (open) {
    open.to = new Date().toISOString().slice(0, 10)
    open.note = note
  }
  e.changeLog.unshift({ id: uid('cl'), at: now(), by: actor.name, field: 'پروژه', before: project?.name ?? '', after: 'خارج از پروژه', source: 'inline' })
  e.projectId = null
  audit(db, actor, { action: 'خروج نیرو از پروژه', entity: { type: 'employee', id: e.id, label: fullName(e) }, result: 'success', employeeId: e.id, companyId: e.companyId, orgId: e.orgId, detail: note })
  notify(db, { audience: { role: 'org', id: e.orgId }, category: 'project', title: 'فهرست نیروهای پروژه تغییر کرد', body: `${fullName(e)} از ${project?.name} خارج شد.`, link: `/org/projects/${project?.id}` })
}

export function requestTermination(db: DB, actor: Actor, id: string, note: string, lastDay: string) {
  const e = employeeById(db, id)
  if (!e) return
  // Termination is not applied directly; it creates a task for the responsible role to confirm.
  ensureTask(db, {
    title: `تأیید خاتمه همکاری ${fullName(e)}`,
    description: `آخرین روز کاری: ${lastDay}. ${note}`,
    kind: 'automatic',
    ruleId: 'termination_request',
    link: { type: 'employee', id: e.id, label: fullName(e) },
    projectId: e.projectId ?? undefined,
    scope: 'company',
    scopeId: e.companyId,
    assigneeId: 'u-c1',
    priority: 'high',
    dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  })
  audit(db, actor, { action: 'ارسال درخواست خاتمه همکاری', entity: { type: 'employee', id: e.id, label: fullName(e) }, result: 'success', employeeId: e.id, companyId: e.companyId, orgId: e.orgId, detail: note })
}

export interface ImportRow {
  rowNo: number
  personnelNo: string
  firstName: string
  lastName: string
  nationalId: string
  mobile: string
  projectCode: string
  jobTitle: string
  startDate: string
}

export function applyImport(db: DB, actor: Actor, rows: (ImportRow & { action: 'add' | 'update' })[]) {
  let added = 0
  let updated = 0
  rows.forEach((row) => {
    const project = db.projects.find((p) => p.code === row.projectCode)!
    const existing = db.employees.find((e) => e.personnelNo === row.personnelNo)
    if (row.action === 'update' && existing) {
      updateEmployeeFields(db, actor, [existing.id], { jobTitle: row.jobTitle, projectId: project.id }, 'import')
      updated += 1
    } else if (row.action === 'add') {
      db.employees.push({
        id: uid('e'),
        personnelNo: row.personnelNo,
        firstName: row.firstName,
        lastName: row.lastName,
        nationalId: row.nationalId,
        mobile: row.mobile,
        birthDate: '1995-01-01',
        maritalStatus: 'single',
        address: '',
        postalCode: '',
        photoColor: '#3f6bb0',
        jobTitle: row.jobTitle,
        unit: '',
        companyId: project.companyId,
        orgId: project.orgId,
        projectId: project.id,
        workplace: db.organizations.find((o) => o.id === project.orgId)?.name ?? '',
        workplaceAddress: '',
        startDate: row.startDate,
        contractType: 'قرارداد کار موقت (ماهانه)',
        contractStart: row.startDate,
        contractEnd: row.startDate,
        shift: 'morning',
        employmentStatus: 'pending_start',
        children: [],
        bankAccounts: [],
        changeLog: [{ id: uid('cl'), at: now(), by: actor.name, field: 'ایجاد', before: '', after: 'ورود از Excel', source: 'import' }],
        leaveBalanceDays: 0,
        assignments: [{ id: uid('as'), projectId: project.id, from: row.startDate }],
      })
      added += 1
    }
  })
  audit(db, actor, { action: 'ورود گروهی Excel', entity: { type: 'import', id: uid('imp'), label: `${toFaDigits(added)} افزوده، ${toFaDigits(updated)} اصلاح` }, result: 'success', companyId: actor.companyId })
  autoCloseTasks(db, 'imp-12', ['excel_error'], 'فایل اصلاح‌شده با موفقیت ثبت شد')
  return { added, updated }
}

export function addEmployee(db: DB, actor: Actor, data: Omit<ImportRow, 'rowNo'>) {
  if (db.employees.some((e) => e.nationalId === data.nationalId)) throw new ApiError('duplicate', 'نیرویی با این کد ملی قبلاً ثبت شده است.')
  if (db.employees.some((e) => e.personnelNo === data.personnelNo)) throw new ApiError('duplicate', 'کد پرسنلی تکراری است.')
  applyImport(db, actor, [{ ...data, rowNo: 0, action: 'add' }])
}

/* =================================================================== */
/* Projects & tasks                                                     */
/* =================================================================== */

export function createProject(db: DB, actor: Actor, p: Omit<Project, 'id' | 'status' | 'teamIds'> & { teamIds?: string[] }) {
  if (db.projects.some((x) => x.code === p.code)) throw new ApiError('duplicate', 'کد پروژه تکراری است.')
  const project: Project = { ...p, id: uid('p'), status: 'planning', teamIds: p.teamIds ?? [] }
  db.projects.unshift(project)
  audit(db, actor, { action: 'ایجاد پروژه', entity: { type: 'project', id: project.id, label: project.code }, result: 'success', companyId: p.companyId, orgId: p.orgId })
  return project
}

export function updateProject(db: DB, actor: Actor, id: string, changes: Partial<Project>) {
  const p = db.projects.find((x) => x.id === id)
  if (!p) return
  Object.assign(p, changes)
  audit(db, actor, { action: 'ویرایش پروژه', entity: { type: 'project', id: p.id, label: p.code }, result: 'success', companyId: p.companyId, orgId: p.orgId })
}

export function createTask(db: DB, actor: Actor, t: Pick<Task, 'title' | 'assigneeId' | 'dueAt' | 'priority' | 'scope' | 'scopeId'> & Partial<Task>) {
  const task: Task = {
    kind: 'manual',
    status: 'todo',
    comments: [],
    ...t,
    id: uid('t'),
    createdBy: actor.name,
    createdAt: now(),
    history: [{ id: uid('th'), at: now(), actor: actor.name, text: 'وظیفه ایجاد شد.' }],
  }
  db.tasks.unshift(task)
  const assignee = db.users.find((u) => u.id === t.assigneeId)
  if (assignee) notify(db, { audience: { role: assignee.role, id: assignee.orgId ?? assignee.companyId ?? '' }, category: 'task', title: 'وظیفه جدید واگذار شد', body: `${task.title} — ${assignee.name}`, link: `/${assignee.role === 'org' ? 'org' : 'company'}/tasks?task=${task.id}` })
  return task
}

const TASK_FIELD_LABEL: Record<string, string> = { status: 'وضعیت', assigneeId: 'مسئول', priority: 'اولویت', dueAt: 'مهلت' }

export function updateTask(db: DB, actor: Actor, id: string, changes: Partial<Task>) {
  const t = db.tasks.find((x) => x.id === id)
  if (!t) return
  Object.keys(changes).forEach((k) => {
    if (TASK_FIELD_LABEL[k]) t.history.push({ id: uid('th'), at: now(), actor: actor.name, text: `تغییر ${TASK_FIELD_LABEL[k]}` })
  })
  Object.assign(t, changes)
}

export function addTaskComment(db: DB, actor: Actor, id: string, text: string) {
  const t = db.tasks.find((x) => x.id === id)
  if (t) t.comments.push({ id: uid('tc'), at: now(), author: actor.name, text })
}

export function linkLabel(link: TaskLink) {
  return link.label
}

/* =================================================================== */
/* Files, users, notifications, admin                                  */
/* =================================================================== */

export function uploadOrgFile(db: DB, actor: Actor, f: Omit<OrgFile, 'id' | 'uploadedBy' | 'reviewStatus'>) {
  const file: OrgFile = { ...f, id: uid('f'), uploadedBy: actor.name, reviewStatus: f.access === 'internal' ? 'none' : 'pending' }
  db.orgFiles.unshift(file)
  audit(db, actor, { action: 'ارسال سند', entity: { type: 'file', id: file.id, label: file.title }, result: 'success', orgId: actor.orgId, companyId: actor.companyId })
  return file
}

export function reviewOrgFile(db: DB, actor: Actor, id: string, status: 'approved' | 'rejected') {
  const f = db.orgFiles.find((x) => x.id === id)
  if (f) f.reviewStatus = status
  audit(db, actor, { action: status === 'approved' ? 'تأیید سند' : 'رد سند', entity: { type: 'file', id, label: f?.title ?? '' }, result: 'success' })
}

export function upsertUser(db: DB, actor: Actor, user: Omit<AppUser, 'id'> & { id?: string }) {
  if (user.id) {
    const u = db.users.find((x) => x.id === user.id)
    if (u) Object.assign(u, user)
    audit(db, actor, { action: 'ویرایش دسترسی کاربر', entity: { type: 'user', id: user.id, label: user.name }, result: 'success', orgId: user.orgId, companyId: user.companyId })
    return u
  }
  if (db.users.some((u) => u.mobile === user.mobile)) throw new ApiError('duplicate', 'کاربری با این شماره موبایل وجود دارد.')
  const u: AppUser = { ...user, id: uid('u'), status: 'invited' }
  db.users.push(u)
  audit(db, actor, { action: 'دعوت کاربر جدید', entity: { type: 'user', id: u.id, label: u.name }, result: 'success', orgId: u.orgId, companyId: u.companyId })
  return u
}

export function markNotifications(db: DB, ids: string[], read = true) {
  db.notifications.forEach((n) => {
    if (ids.includes(n.id)) n.read = read
  })
}

export function updateRequestType(db: DB, actor: Actor, def: RequestTypeDef) {
  const i = db.requestTypes.findIndex((t) => t.id === def.id)
  if (i >= 0) db.requestTypes[i] = def
  else db.requestTypes.push(def)
  audit(db, actor, { action: 'تغییر تنظیمات نوع درخواست', entity: { type: 'requestType', id: def.id, label: def.title }, result: 'success' })
}

export function updateAlertRule(db: DB, actor: Actor, rule: AlertRule) {
  const i = db.alertRules.findIndex((r) => r.id === rule.id)
  if (i >= 0) db.alertRules[i] = rule
  audit(db, actor, { action: 'تغییر قانون هشدار', entity: { type: 'alertRule', id: rule.id, label: rule.event }, result: 'success' })
}

export function updateSettings(db: DB, actor: Actor, settings: Partial<DB['settings']>) {
  Object.assign(db.settings, settings)
  audit(db, actor, { action: 'تغییر تنظیمات سامانه', entity: { type: 'settings', id: 'system', label: 'تنظیمات عمومی' }, result: 'success' })
}

export function upsertOrganization(db: DB, actor: Actor, kind: 'org' | 'company', data: { id?: string; name: string; city: string; contactName: string; contactPhone: string; kind?: string; registrationNo?: string; status: 'active' | 'inactive' }) {
  if (kind === 'org') {
    if (data.id) Object.assign(db.organizations.find((o) => o.id === data.id)!, data)
    else db.organizations.push({ id: uid('o'), name: data.name, city: data.city, contactName: data.contactName, contactPhone: data.contactPhone, kind: data.kind ?? 'سازمان', status: data.status })
  } else {
    if (data.id) Object.assign(db.companies.find((o) => o.id === data.id)!, data)
    else db.companies.push({ id: uid('c'), name: data.name, city: data.city, contactName: data.contactName, contactPhone: data.contactPhone, registrationNo: data.registrationNo ?? '', status: data.status })
  }
  audit(db, actor, { action: data.id ? 'ویرایش ساختار سازمانی' : 'ایجاد ساختار سازمانی', entity: { type: kind, id: data.id ?? 'new', label: data.name }, result: 'success' })
}

/* =================================================================== */
/* Account                                                               */
/* =================================================================== */

export function changePassword(db: DB, actor: Actor, current: string, _next: string, revokeOthers: boolean) {
  if (current !== 'Demo@1234') throw new ApiError('validation', 'رمز فعلی صحیح نیست.')
  if (revokeOthers) db.sessions = db.sessions.filter((s) => s.current)
  audit(db, actor, { action: 'تغییر رمز عبور', entity: { type: 'account', id: actor.employeeId ?? actor.userId ?? '', label: actor.name }, result: 'success', employeeId: actor.employeeId })
  notify(db, { audience: { role: 'employee', id: actor.employeeId ?? '' }, category: 'security', title: 'رمز عبور تغییر کرد', body: 'رمز عبور حساب شما تغییر کرد. اگر این کار را انجام نداده‌اید با پشتیبانی تماس بگیرید.', link: '/me/profile/security' })
}

export function revokeSessions(db: DB, actor: Actor, ids: string[]) {
  db.sessions = db.sessions.filter((s) => s.current || !ids.includes(s.id))
  audit(db, actor, { action: 'خروج از سایر دستگاه‌ها', entity: { type: 'session', id: ids.join(','), label: `${toFaDigits(ids.length)} نشست` }, result: 'success', employeeId: actor.employeeId })
}

export function createTicket(db: DB, actor: Actor, subject: string, category: string, text: string) {
  const t: SupportTicket = {
    id: uid('tk'),
    number: `SUP-${2041 + db.tickets.length + 1}`,
    employeeId: actor.employeeId!,
    subject,
    category,
    status: 'open',
    createdAt: now(),
    messages: [{ id: uid('tm'), at: now(), author: actor.name, fromSupport: false, text }],
  }
  db.tickets.unshift(t)
  return t
}

export function replyTicket(db: DB, actor: Actor, id: string, text: string) {
  const t = db.tickets.find((x) => x.id === id)
  if (!t) return
  t.messages.push({ id: uid('tm'), at: now(), author: actor.name, fromSupport: false, text })
  t.status = 'open'
}

export function describeAmount(v: unknown) {
  return typeof v === 'number' ? formatRial(v) : String(v ?? '')
}

export function statusLabel(s: EmployeeRequest['status']) {
  return REQUEST_STATUS[s].label
}

export type { Party }
