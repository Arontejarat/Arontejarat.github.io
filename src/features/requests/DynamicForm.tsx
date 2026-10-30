import { Link } from 'react-router'
import { Landmark, Lock, ShieldCheck } from 'lucide-react'
import type { Attachment, Employee, FieldDef, Payslip, RequestTypeDef } from '@/types/domain'
import {
  AmountInput,
  Checkbox,
  DatePicker,
  Field,
  FileUploader,
  Input,
  MonthPicker,
  RadioGroup,
  ReadonlyValue,
  Select,
  Switch,
  Textarea,
  TimeInput,
  Badge,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber, formatPeriod, formatRial, maskSheba, toEnDigits } from '@/lib/format'
import { bankFromSheba, normalizeSheba } from '@/lib/validation'
import { toJalali, periodKey } from '@/lib/jalali'
import { computeValues, displayValue, isHoliday, prefillValue, visibleFields, type FormErrors, type FormValues } from './logic'

export interface DynamicFormProps {
  type: RequestTypeDef
  values: FormValues
  onChange: (v: FormValues) => void
  errors: FormErrors
  employee: Employee
  payslips: Payslip[]
  confidential?: boolean
  onConfidentialChange?: (v: boolean) => void
  disabled?: boolean
}

export function DynamicForm({ type, values, onChange, errors, employee, payslips, confidential, onConfidentialChange, disabled }: DynamicFormProps) {
  const computed = computeValues(type, values)
  const set = (name: string, v: unknown) => {
    const next: FormValues = { ...values, [name]: v }
    // Bank name is derived from the IBAN when possible
    if (name === 'sheba') {
      const bank = bankFromSheba(String(v))
      if (bank) next.bank = bank
    }
    onChange(next)
  }
  const fields = visibleFields(type, computed)
  const currentPeriod = periodKey(toJalali(new Date()).jy, toJalali(new Date()).jm)

  return (
    <fieldset disabled={disabled} className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
      <legend className="sr-only">اطلاعات {type.title}</legend>
      {fields.map((f) => (
        <div key={f.name} className={cn(f.fullWidth || ['textarea', 'files', 'checkbox', 'account', 'radio'].includes(f.kind) ? 'sm:col-span-2' : '')}>
          {renderField(f)}
        </div>
      ))}
      {type.confidentialAllowed && onConfidentialChange ? (
        <div className="rounded-lg border border-ink-200 bg-ink-25 p-3.5 sm:col-span-2">
          <Switch
            checked={Boolean(confidential)}
            onChange={onConfidentialChange}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Lock size={14} aria-hidden /> درخواست محرمانه
              </span>
            }
            description="فقط مسئولان مجاز رسیدگی، محتوای این درخواست را می‌بینند و نام شما در گزارش‌های عمومی درج نمی‌شود."
          />
        </div>
      ) : null}
    </fieldset>
  )

  function renderField(f: FieldDef) {
    const v = computed[f.name]
    const err = errors[f.name]
    const helper = f.sensitive ? (
      <span className="inline-flex items-start gap-1">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent-600" aria-hidden />
        {f.helper ?? 'اطلاعات حساس — فقط برای مسئولان مجاز قابل مشاهده است.'}
      </span>
    ) : (
      f.helper
    )

    if (f.kind === 'checkbox') {
      return (
        <div>
          <Checkbox checked={Boolean(v)} onChange={(c) => set(f.name, c)} label={f.label} invalid={Boolean(err)} aria-describedby={err ? `${f.name}-err` : undefined} />
          {err ? (
            <p id={`${f.name}-err`} role="alert" className="ms-7 mt-1 text-xs font-medium text-red-700">
              {err}
            </p>
          ) : null}
        </div>
      )
    }

    return (
      <Field label={f.label} required={f.required && f.kind !== 'readonly'} optionalLabel={!f.required && f.kind !== 'readonly'} helper={helper} error={err} id={`f-${f.name}`}>
        {({ id, describedBy, invalid }) => {
          switch (f.kind) {
            case 'text':
              return <Input id={id} aria-describedby={describedBy} invalid={invalid} value={String(v ?? '')} placeholder={f.placeholder} maxLength={f.maxLength} onChange={(e) => set(f.name, e.target.value)} />
            case 'textarea':
              return <Textarea id={id} aria-describedby={describedBy} invalid={invalid} value={String(v ?? '')} placeholder={f.placeholder} maxLength={f.maxLength} showCount onChange={(e) => set(f.name, e.target.value)} />
            case 'number':
              return (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  inputMode="numeric"
                  ltr
                  className="max-w-40"
                  value={v === undefined || v === '' ? '' : formatNumber(Number(v))}
                  onChange={(e) => {
                    const d = toEnDigits(e.target.value).replace(/\D/g, '')
                    set(f.name, d === '' ? '' : Number(d))
                  }}
                />
              )
            case 'amount':
              return <AmountInput id={id} describedBy={describedBy} invalid={invalid} value={(v as number | '') ?? ''} onChange={(n) => set(f.name, n)} />
            case 'select':
              return <Select id={id} aria-describedby={describedBy} invalid={invalid} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value)} options={f.options ?? []} placeholder="انتخاب کنید" />
            case 'radio':
              return <RadioGroup name={f.name} value={String(v ?? '')} onChange={(x) => set(f.name, x)} options={f.options ?? []} invalid={invalid} layout={(f.options?.length ?? 0) <= 3 ? 'cards' : 'stack'} labelledBy={`${id}-label`} describedBy={describedBy} />
            case 'date':
              return <DatePicker id={id} describedBy={describedBy} invalid={invalid} value={String(v ?? '')} onChange={(x) => set(f.name, x)} isHoliday={isHoliday} />
            case 'month':
              return <MonthPicker id={id} describedBy={describedBy} invalid={invalid} value={String(v ?? '')} onChange={(x) => set(f.name, x)} max={currentPeriod} />
            case 'time':
              return <TimeInput id={id} describedBy={describedBy} invalid={invalid} value={String(v ?? '')} onChange={(x) => set(f.name, x)} />
            case 'readonly':
              return <ReadonlyValue id={id}>{f.prefill ? prefillValue(f, employee) : v ? displayValue(f, v) : <span className="text-ink-400">پس از تکمیل فیلدهای بالا محاسبه می‌شود</span>}</ReadonlyValue>
            case 'sheba':
              return (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  ltr
                  className="font-mono tracking-wide"
                  placeholder="IR000000000000000000000000"
                  value={String(v ?? '')}
                  maxLength={32}
                  onChange={(e) => set(f.name, normalizeSheba(e.target.value).slice(0, 26))}
                  prefix={<Landmark size={16} />}
                />
              )
            case 'nationalId':
              return <Input id={id} aria-describedby={describedBy} invalid={invalid} ltr inputMode="numeric" maxLength={10} className="max-w-48 tabular" value={String(v ?? '')} onChange={(e) => set(f.name, toEnDigits(e.target.value).replace(/\D/g, ''))} />
            case 'account': {
              const accounts = employee.bankAccounts
              return accounts.length === 0 ? (
                <p className="text-sm text-ink-600">
                  حساب تأییدشده‌ای ثبت نشده است.{' '}
                  <Link to="/me/requests/new?type=bank_change" className="font-semibold text-brand-700 hover:underline">
                    ثبت اطلاعات بانکی
                  </Link>
                </p>
              ) : (
                <RadioGroup
                  name={f.name}
                  value={String(v ?? '')}
                  onChange={(x) => set(f.name, x)}
                  invalid={invalid}
                  layout="cards"
                  labelledBy={`${id}-label`}
                  describedBy={describedBy}
                  options={accounts.map((a) => ({
                    value: a.id,
                    disabled: !a.verified,
                    label: (
                      <span className="flex flex-wrap items-center gap-2">
                        {a.bank}
                        {a.activeForPayroll ? <Badge tone="success" size="sm">حساب حقوق</Badge> : null}
                        {!a.verified ? <Badge tone="warning" size="sm">در انتظار تأیید</Badge> : null}
                      </span>
                    ),
                    description: (
                      <bdi dir="ltr" className="font-mono">
                        {maskSheba(a.sheba)}
                      </bdi>
                    ),
                  }))}
                />
              )
            }
            case 'payslipLink': {
              const month = String(values.month ?? '')
              const ps = payslips.find((p) => periodKey(p.year, p.month) === month)
              return (
                <ReadonlyValue id={id}>
                  {!month ? (
                    <span className="text-ink-400">ابتدا ماه را انتخاب کنید</span>
                  ) : ps ? (
                    <span>
                      فیش {formatPeriod(ps.year, ps.month)} — خالص {formatRial(ps.earnings.reduce((a, b) => a + b.amount, 0) - ps.deductions.reduce((a, b) => a + b.amount, 0))}
                    </span>
                  ) : (
                    <span className="text-ink-500">برای این ماه فیشی صادر نشده است</span>
                  )}
                </ReadonlyValue>
              )
            }
            case 'files':
              return (
                <FileUploader
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  value={(v as Attachment[]) ?? []}
                  onChange={(list) => set(f.name, list)}
                  accept={f.accept}
                  maxFiles={f.maxFiles}
                  maxSizeMb={5}
                />
              )
            default:
              return null
          }
        }}
      </Field>
    )
  }
}
