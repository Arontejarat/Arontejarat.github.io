import type { Attachment, Employee, EmployeeRequest, FieldDef, RequestTypeDef } from '@/types/domain'
import { isoToJalali, jalaliToISO, parseISODate, toJalali, toISODate } from '@/lib/jalali'
import { formatDate, formatNumber, formatPeriod, formatRial, toFaDigits } from '@/lib/format'
import { isValidNationalId, isValidSheba } from '@/lib/validation'
import { MARITAL_LABEL, SHIFT_LABEL } from '@/config/requestTypes'

export type FormValues = Record<string, unknown>
export type FormErrors = Record<string, string>

/** Fixed-date official holidays (Jalali month/day). Lunar holidays come from the backend work calendar. */
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 12],
  [1, 13],
  [3, 14],
  [3, 15],
  [11, 22],
  [12, 29],
]

export function isHoliday(iso: string) {
  const d = parseISODate(iso)
  if (d.getDay() === 5) return true // Friday
  const j = isoToJalali(iso)
  return FIXED_HOLIDAYS.some(([m, day]) => m === j.jm && day === j.jd)
}

export function workingDaysBetween(start: string, end: string) {
  if (!start || !end || end < start) return 0
  let n = 0
  const d = parseISODate(start)
  const last = parseISODate(end)
  while (d <= last) {
    if (!isHoliday(toISODate(d))) n += 1
    d.setDate(d.getDate() + 1)
  }
  return n
}

export function hoursBetween(a: string, b: string) {
  if (!a || !b) return 0
  const [h1, m1] = a.split(':').map(Number)
  const [h2, m2] = b.split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60)
}

export function visibleFields(type: RequestTypeDef, values: FormValues) {
  return type.fields.filter((f) => !f.showIf || f.showIf.in.includes(String(values[f.showIf.field] ?? '')))
}

export function prefillValue(f: FieldDef, emp: Employee) {
  if (f.prefill === 'maritalStatus') return MARITAL_LABEL[emp.maritalStatus]
  if (f.prefill === 'workplace') return emp.workplace
  if (f.prefill === 'shift') return SHIFT_LABEL[emp.shift] ?? emp.shift
  return ''
}

export function computeValues(type: RequestTypeDef, values: FormValues): FormValues {
  const out = { ...values }
  type.fields.forEach((f) => {
    if (f.computed === 'leaveDays') out[f.name] = workingDaysBetween(String(values.startDate ?? ''), String(values.endDate ?? ''))
    if (f.computed === 'leaveHours') out[f.name] = hoursBetween(String(values.startTime ?? ''), String(values.endTime ?? ''))
  })
  return out
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0)

export interface ValidationContext {
  employee: Employee
  otherRequests: EmployeeRequest[]
  editingId?: string
}

export function validate(type: RequestTypeDef, raw: FormValues, ctx: ValidationContext): FormErrors {
  const values = computeValues(type, raw)
  const errors: FormErrors = {}
  const fields = visibleFields(type, values)
  for (const f of fields) {
    const v = values[f.name]
    if (f.kind === 'readonly') continue
    if (f.required && isEmpty(v)) {
      errors[f.name] =
        f.kind === 'checkbox' ? 'برای ادامه، این مورد را تأیید کنید.' : f.kind === 'files' ? 'بارگذاری این مدرک الزامی است.' : ['select', 'radio', 'date', 'month', 'time', 'account'].includes(f.kind) ? `${f.label} را انتخاب کنید.` : `${f.label} را وارد کنید.`
      continue
    }
    if (isEmpty(v)) continue
    if (f.kind === 'amount' && typeof v === 'number') {
      const min = f.name === 'amount' ? type.rules?.minAmount : undefined
      const max = f.name === 'amount' ? type.rules?.maxAmount : undefined
      if (min && v < min) errors[f.name] = `حداقل مبلغ ${formatRial(min)} است.`
      else if (max && v > max) errors[f.name] = `حداکثر مبلغ ${formatRial(max)} است.`
    }
    if (f.kind === 'number' && typeof v === 'number') {
      if (f.min !== undefined && v < f.min) errors[f.name] = `حداقل مقدار ${toFaDigits(f.min)} است.`
      if (f.max !== undefined && v > f.max) errors[f.name] = `حداکثر مقدار ${toFaDigits(f.max)} است.`
    }
    if (f.kind === 'sheba' && !isValidSheba(String(v))) errors[f.name] = 'شماره شبا معتبر نیست. ۲۴ رقم پس از IR را بدون فاصله وارد کنید.'
    if (f.kind === 'nationalId' && !isValidNationalId(String(v))) errors[f.name] = 'کد ملی واردشده معتبر نیست.'
    if (f.kind === 'text' && f.maxLength && String(v).length > f.maxLength) errors[f.name] = `حداکثر ${toFaDigits(f.maxLength)} نویسه مجاز است.`
  }

  // Cross-field rules
  const start = String(values.startDate ?? '')
  const end = String(values.endDate ?? '')
  if (start && end && end < start) errors.endDate = 'تاریخ پایان نباید پیش از تاریخ شروع باشد.'
  if (type.fields.some((f) => f.computed === 'leaveDays') && start && end && end >= start && values.days === 0) errors.endDate = 'بازه انتخاب‌شده شامل هیچ روز کاری نیست.'
  if (type.id === 'leave_daily' && values.leaveKind === 'entitled' && typeof values.days === 'number' && values.days > ctx.employee.leaveBalanceDays)
    errors.endDate = `مدت مرخصی (${toFaDigits(values.days)} روز) بیش از مانده مرخصی شما (${toFaDigits(ctx.employee.leaveBalanceDays)} روز) است.`
  if (type.id === 'leave_hourly' || type.id === 'attendance_fix') {
    if (values.startTime && values.endTime && hoursBetween(String(values.startTime), String(values.endTime)) <= 0) errors.endTime = 'ساعت پایان باید بعد از ساعت شروع باشد.'
    if (type.id === 'leave_hourly' && typeof values.hours === 'number' && values.hours > 4) errors.endTime = 'مرخصی ساعتی حداکثر ۴ ساعت است؛ برای بیشتر از آن مرخصی روزانه ثبت کنید.'
  }
  // Overlap with existing leave (approved / in review)
  if (type.category === 'leave' && start && end && !errors.endDate) {
    const overlap = ctx.otherRequests.find(
      (r) =>
        r.id !== ctx.editingId &&
        ['leave_daily', 'leave_sick'].includes(r.typeId) &&
        ['submitted', 'in_review', 'approved', 'executed'].includes(r.status) &&
        String(r.values.startDate) <= end &&
        String(r.values.endDate) >= start,
    )
    if (overlap) errors.startDate = `این بازه با مرخصی ثبت‌شده دیگری (شماره ${toFaDigits(overlap.trackingNo)}) تداخل دارد.`
  }
  if (values.date && type.category === 'leave' && type.id === 'leave_hourly') {
    const d = String(values.date)
    const overlap = ctx.otherRequests.find(
      (r) => r.id !== ctx.editingId && ['leave_daily', 'leave_sick'].includes(r.typeId) && ['approved', 'executed', 'in_review', 'submitted'].includes(r.status) && String(r.values.startDate) <= d && String(r.values.endDate) >= d,
    )
    if (overlap) errors.date = 'در این تاریخ مرخصی روزانه ثبت شده است.'
  }
  return errors
}

/** "Advance from day 10" style availability rule */
export function availability(type: RequestTypeDef, dayOverride: number | null): { allowed: boolean; reason?: string; opensOn?: string } {
  const from = type.rules?.availableFromDay
  if (!from) return { allowed: true }
  const today = toJalali(new Date())
  const day = dayOverride ?? today.jd
  if (day >= from) return { allowed: true }
  const opens = jalaliToISO(today.jy, today.jm, from)
  return {
    allowed: false,
    reason: `«${type.title}» از روز ${toFaDigits(from)} هر ماه قابل ثبت است. امروز روز ${toFaDigits(day)} ماه است.`,
    opensOn: formatDate(opens, 'long'),
  }
}

export function collectAttachments(type: RequestTypeDef, values: FormValues): Attachment[] {
  return type.fields.filter((f) => f.kind === 'files').flatMap((f) => (Array.isArray(values[f.name]) ? (values[f.name] as Attachment[]) : []))
}

export function hasMeaningfulInput(values: FormValues) {
  return Object.values(values).some((v) => !isEmpty(v))
}

/** Human-readable value for a field (detail pages, review screens) */
export function displayValue(f: FieldDef, v: unknown, emp?: Employee): string {
  if (f.prefill && emp && (v === undefined || v === '')) return prefillValue(f, emp)
  if (v === undefined || v === null || v === '') return '—'
  switch (f.kind) {
    case 'amount':
      return formatRial(Number(v))
    case 'number':
      return formatNumber(Number(v))
    case 'date':
      return formatDate(String(v))
    case 'month': {
      const [y, m] = String(v).split('-').map(Number)
      return formatPeriod(y, m)
    }
    case 'time':
      return toFaDigits(String(v))
    case 'select':
    case 'radio':
      return f.options?.find((o) => o.value === v)?.label ?? String(v)
    case 'checkbox':
      return v ? 'تأیید شد' : 'تأیید نشد'
    case 'readonly':
      if (f.computed === 'leaveDays') return `${formatNumber(Number(v))} روز کاری`
      if (f.computed === 'leaveHours') return `${formatNumber(Number(v))} ساعت`
      return String(v)
    case 'account': {
      const acc = emp?.bankAccounts.find((b) => b.id === v)
      return acc ? `${acc.bank} — ${acc.sheba.slice(-6)}…` : String(v)
    }
    case 'files':
      return Array.isArray(v) ? `${toFaDigits(v.length)} فایل` : '—'
    default:
      return String(v)
  }
}
