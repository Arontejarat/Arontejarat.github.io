import type { DB } from './seed'
import type { CompanyHRPolicy, Employee } from '@/types/domain'
import { employeeDocumentChecklist, signatureStatus } from './selectors'
import { fromJalali, jalaliMonthLength, parseISODate, toISODate, toJalali } from '@/lib/jalali'
import { formatDate, toFaDigits } from '@/lib/format'
import { uid } from '@/lib/cn'

export function policyFor(db: DB, companyId: string): CompanyHRPolicy {
  return db.hrPolicies.find((p) => p.companyId === companyId) ?? { companyId, childAgeThreshold: 18, childNationalIdRequired: false }
}
export function validISO(value: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && Number.isFinite(parseISODate(value).getTime()) && toISODate(parseISODate(value)) === value
}
/** Solar-year birthday; Esfand 30 falls on Esfand 29 in a non-leap anniversary year. */
export function ageThresholdDate(birthDate: string, threshold: number): string {
  const b = toJalali(parseISODate(birthDate))
  const year = b.jy + threshold
  return toISODate(fromJalali(year, b.jm, Math.min(b.jd, jalaliMonthLength(year, b.jm))))
}
export function essentialPersonnel(db: DB, emp: Employee, today = toISODate(new Date())) {
  const contracts = db.contracts.filter((c) => c.employeeId === emp.id && c.kind === 'worker' && !c.terminated && !['cancelled', 'superseded'].includes(c.stage))
  const active = contracts.find((c) => c.stage === 'completed' && signatureStatus(c) === 'complete' && c.startDate <= today && c.endDate >= today)
  const pending = contracts.find((c) => c.stage === 'awaiting_worker' && c.endDate >= today && !c.employeeSignature)
  const preparing = contracts.find((c) => c.endDate >= today && c.stage !== 'completed')
  const future = contracts.find((c) => c.stage === 'completed' && c.startDate > today)
  const expired = [...contracts].filter((c) => c.endDate < today).sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
  const state = active ? 'active' : pending ? 'pending_signature' : preparing ? 'preparing' : future ? 'future' : expired ? 'expired' : 'missing'
  return { state, contract: active ?? pending ?? preparing ?? future ?? expired, documents: employeeDocumentChecklist(db, emp).filter((x) => x.type.required && x.status !== 'approved') }
}
export interface FamilyRule {
  id: string
  applies: (birthDate: string, threshold: number, today: string) => boolean
}
export const FAMILY_RULES: FamilyRule[] = [{ id: 'child_age', applies: (birth, threshold, today) => validISO(birth) && ageThresholdDate(birth, threshold) <= today }]
/** Called on startup, while the app is open, and after mutations. No offline scheduler is claimed. */
export function evaluateFamilyRules(db: DB, today = toISODate(new Date())) {
  let changed = false
  for (const e of db.employees) for (const c of e.children) {
    const threshold = policyFor(db, e.companyId).childAgeThreshold
    for (const rule of FAMILY_RULES) {
      const key = [rule.id, e.companyId, e.id, c.id, c.birthDate, threshold].join(':')
      if (!rule.applies(c.birthDate, threshold, today) || db.ruleEvents.includes(key)) continue
      db.ruleEvents.push(key)
      const at = new Date().toISOString()
      const body = c.fullName + '، تولد ' + formatDate(c.birthDate) + '، به آستانه ' + toFaDigits(threshold) + ' سال رسیده است. بررسی منابع انسانی لازم است؛ مزایا و پوشش بیمه خودکار تغییر نمی‌کند.'
      for (const audience of [{ role: 'employee' as const, id: e.id }, { role: 'company' as const, id: e.companyId }]) db.notifications.unshift({ id: uid('n'), audience, category: 'document', title: 'هشدار سن فرزند', body, at, read: false, link: audience.role === 'employee' ? '/me/family' : '/company/family?employee=' + e.id })
      db.audit.unshift({ id: uid('a'), at, actor: 'سامانه', actorRole: 'system', companyId: e.companyId, employeeId: e.id, action: 'هشدار آستانه سن فرزند', entity: { type: 'child', id: c.id, label: c.fullName }, result: 'success', detail: key })
      changed = true
    }
  }
  return changed
}
