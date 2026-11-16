import type { DB } from './seed'
import type { Contract, ContractBatch } from '@/types/domain'
import { ApiError, type Actor } from './actions'
import { authorizedEmployee, requirePermission } from './hrActions'
import { fullName, projectInScope, scopeForUser } from './selectors'
import { validISO } from './hrRules'
import { uid } from '@/lib/cn'
import { parseISODate, toJalali } from '@/lib/jalali'

export interface BatchContractInput {
  batchId: string
  employeeIds: string[]
  contractType: string
  startDate: string
  endDate: string
  templateId: string
  templateVersion: number
  description: string
  salary: number
  workingConditions: string
  projectId?: string
}
function validateConfig(db: DB, actor: Actor, input: BatchContractInput) {
  const user = requirePermission(db, actor, 'contracts.bulk')
  if (!user || user.role !== 'company') throw new ApiError('forbidden', 'صدور گروهی فقط برای شرکت مجاز است.')
  if (!input.batchId || !input.employeeIds.length || input.employeeIds.length > 1000 || !input.contractType.trim() || !validISO(input.startDate) || !validISO(input.endDate) || input.endDate <= input.startDate || !Number.isFinite(input.salary) || input.salary < 0 || !input.workingConditions.trim()) throw new ApiError('validation', 'نوع، بازه تاریخ، حقوق و شرایط کار را کامل و معتبر وارد کنید.')
  const template = db.documentTemplates.find((t) => t.id === input.templateId && t.companyId === user.companyId)
  if (!template) throw new ApiError('forbidden', 'قالب در محدوده شرکت شما نیست.')
  if (template.version !== input.templateVersion) throw new ApiError('conflict', 'قالب تغییر کرده است؛ پیش‌نمایش را تازه کنید.')
  const project = input.projectId ? db.projects.find((p) => p.id === input.projectId) : undefined
  if (input.projectId && (!project || !projectInScope(scopeForUser(user)!, project) || project.status === 'closed')) throw new ApiError('forbidden', 'پروژه مجاز و باز انتخاب کنید.')
  return { user, template, project }
}
function rowError(db: DB, actor: Actor, employeeId: string, input: BatchContractInput) {
  const e = authorizedEmployee(db, actor, employeeId, 'contracts.bulk')
  if (e.employmentStatus === 'terminated') throw new ApiError('validation', 'همکاری این نیرو خاتمه یافته است.')
  if (db.contracts.some((c) => c.kind === 'worker' && c.employeeId === e.id && !['cancelled', 'superseded'].includes(c.stage) && !c.terminated && c.startDate <= input.endDate && c.endDate >= input.startDate)) throw new ApiError('duplicate', 'با قرارداد موجود همپوشانی دارد.')
  return e
}
export function previewContractBatch(db: DB, actor: Actor, input: BatchContractInput) {
  validateConfig(db, actor, input)
  return [...new Set(input.employeeIds)].map((employeeId) => {
    let name = 'خارج از محدوده دسترسی'
    try {
      name = fullName(authorizedEmployee(db, actor, employeeId, 'contracts.bulk'))
      rowError(db, actor, employeeId, input)
      return { employeeId, name, error: undefined as string | undefined }
    } catch (error) { return { employeeId, name, error: error instanceof Error ? error.message : 'اطلاعات معتبر نیست.' } }
  })
}
export function createContractBatch(db: DB, actor: Actor, input: BatchContractInput): ContractBatch {
  const { user, template, project } = validateConfig(db, actor, input)
  const { employeeIds, batchId, ...config } = input
  const fingerprint = JSON.stringify(config)
  let batch = db.contractBatches.find((b) => b.id === batchId)
  if (batch && (batch.companyId !== user.companyId || batch.fingerprint !== fingerprint)) throw new ApiError('conflict', 'شناسه عملیات با تنظیمات دیگری استفاده شده است.')
  if (batch && employeeIds.some((id) => !batch!.results.some((r) => r.employeeId === id))) throw new ApiError('conflict', 'افزودن نیرو به عملیات ثبت‌شده مجاز نیست؛ عملیات جدید بسازید.')
  if (!batch) {
    batch = { id: batchId, companyId: user.companyId!, createdBy: actor.name, createdAt: new Date().toISOString(), fingerprint, results: [] }
    db.contractBatches.push(batch)
  }
  for (const employeeId of new Set(employeeIds)) {
    const prior = batch.results.find((r) => r.employeeId === employeeId)
    if (prior?.contractId) continue // an idempotent replay must not regenerate successful rows
    try {
      const e = rowError(db, actor, employeeId, input)
      const period = toJalali(parseISODate(input.startDate))
      const at = new Date().toISOString()
      const id = uid('ct')
      const c: Contract = { id, number: 'CT-' + id, kind: 'worker', title: input.contractType + ' — ' + fullName(e), employeeId, companyId: e.companyId, orgId: project?.orgId ?? e.orgId, projectId: project?.id ?? e.projectId ?? '', periodYear: period.jy, periodMonth: period.jm, jobTitle: e.jobTitle, workplace: project?.name ?? e.workplace, startDate: input.startDate, endDate: input.endDate, stage: 'draft', parties: [{ role: 'worker', name: fullName(e), required: true }, { role: 'company', name: template.companyName, required: true }], version: 1, versionHash: uid('version'), employeeSnapshot: { firstName: e.firstName, lastName: e.lastName, nationalId: e.nationalId, personnelNo: e.personnelNo, shift: e.shift }, documentFormat: structuredClone(template), contractType: input.contractType, description: input.description, salary: [{ label: 'حقوق و مزایای توافق‌شده', amount: input.salary }], workHours: input.workingConditions, createdAt: at, createdBy: actor.name, batchId, history: [{ id: uid('h'), at, actor: actor.name, text: 'پیش‌نویس مستقل با صدور گروهی ایجاد شد.' }] }
      db.contracts.unshift(c)
      db.tasks.filter((t) => t.ruleId === 'contract_preparation' && t.link?.id === e.id && t.status !== 'done').forEach((t) => { t.status = 'done'; t.closedAutomatically = true })
      db.audit.unshift({ id: uid('a'), at, actor: actor.name, actorRole: actor.role, companyId: e.companyId, employeeId, action: 'صدور گروهی قرارداد', entity: { type: 'contract', id, label: c.number }, result: 'success', detail: batchId })
      const result = { employeeId, contractId: id }
      if (prior) Object.assign(prior, { ...result, error: undefined }); else batch.results.push(result)
    } catch (error) {
      const result = { employeeId, error: error instanceof Error ? error.message : 'صدور قرارداد انجام نشد.' }
      if (prior) Object.assign(prior, result); else batch.results.push(result)
    }
  }
  return batch
}
