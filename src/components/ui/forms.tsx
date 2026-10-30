import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Check, ChevronDown, CircleAlert, Eye, EyeOff, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber, rialToTomanWords, toEnDigits, toFaDigits } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Field wrapper: label, required marker, helper text, error            */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label?: ReactNode
  required?: boolean
  optionalLabel?: boolean
  helper?: ReactNode
  error?: string
  id?: string
  className?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  labelAction?: ReactNode
}

export function Field({ label, required, optionalLabel, helper, error, id, className, children, labelAction }: FieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const helpId = `${fieldId}-help`
  const errId = `${fieldId}-err`
  const describedBy = [helper ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label id={`${fieldId}-label`} htmlFor={fieldId} className="text-sm font-medium text-ink-800">
            {label}
            {required ? (
              <span className="ms-1 text-red-600" aria-hidden>
                *
              </span>
            ) : optionalLabel ? (
              <span className="ms-1.5 text-xs font-normal text-ink-500">(اختیاری)</span>
            ) : null}
            {required ? <span className="sr-only"> (الزامی)</span> : null}
          </label>
          {labelAction}
        </div>
      ) : null}
      {children({ id: fieldId, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-700">
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : helper ? (
        <p id={helpId} className="text-xs leading-5 text-ink-500">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

export const controlBase =
  'w-full rounded-md border bg-white text-sm text-ink-900 placeholder:text-ink-400 transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-3 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500'

export const controlState = (invalid?: boolean) =>
  invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
    : 'border-ink-200 hover:border-ink-300 focus:border-brand-500 focus:ring-brand-100'

/* ------------------------------------------------------------------ */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  invalid?: boolean
  /** Left-to-right values (numbers, IBAN, email…) */
  ltr?: boolean
  prefix?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, ltr, prefix, suffix, className, ...rest }, ref) {
  const ro = rest.readOnly ? 'bg-ink-50 text-ink-600' : ''
  if (prefix || suffix) {
    return (
      <div className={cn('relative flex items-center', className)}>
        {/* Affixes use physical sides so icon and reserved padding always match,
            even when the input itself is LTR (phone, password, IBAN) inside the RTL page */}
        {prefix ? <span className="pointer-events-none absolute right-3 flex text-ink-400">{prefix}</span> : null}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          dir={ltr ? 'ltr' : undefined}
          className={cn(controlBase, controlState(invalid), 'h-10', ro, prefix ? 'pr-10' : 'pr-3', suffix ? 'pl-12' : 'pl-3', ltr && 'text-left')}
          {...rest}
        />
        {suffix ? <span className="absolute left-2 flex items-center text-ink-500">{suffix}</span> : null}
      </div>
    )
  }
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      dir={ltr ? 'ltr' : undefined}
      className={cn(controlBase, controlState(invalid), 'h-10 px-3', ro, ltr && 'text-left', className)}
      {...rest}
    />
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false)
  return (
    <Input
      ref={ref}
      type={show ? 'text' : 'password'}
      ltr
      autoComplete="current-password"
      suffix={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="grid size-8 place-items-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          aria-label={show ? 'مخفی کردن رمز' : 'نمایش رمز'}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
      {...props}
    />
  )
})

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (v: string) => void
}

export function SearchInput({ value, onChange, placeholder = 'جست‌وجو…', className, ...rest }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? placeholder}
        className={cn(controlBase, controlState(false), 'h-10 ps-10 pe-9 [&::-webkit-search-cancel-button]:hidden')}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="پاک کردن جست‌وجو"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  )
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; showCount?: boolean }>(
  function Textarea({ invalid, className, showCount, maxLength, value, ...rest }, ref) {
    const len = typeof value === 'string' ? value.length : 0
    return (
      <div className="relative">
        <textarea
          ref={ref}
          aria-invalid={invalid || undefined}
          maxLength={maxLength}
          value={value}
          className={cn(controlBase, controlState(invalid), 'min-h-24 resize-y px-3 py-2.5 leading-7', className)}
          {...rest}
        />
        {showCount && maxLength ? (
          <span className="pointer-events-none absolute bottom-2 end-3 text-2xs text-ink-400 tabular">
            {toFaDigits(len)}/{toFaDigits(maxLength)}
          </span>
        ) : null}
      </div>
    )
  },
)

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, options, placeholder, className, ...rest }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, controlState(invalid), 'h-10 appearance-none ps-3 pe-9', !rest.value && placeholder && 'text-ink-400')}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} className="text-ink-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
    </div>
  )
})

/* ------------------------------------------------------------------ */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  indeterminate?: boolean
  invalid?: boolean
}

export function Checkbox({ label, description, checked, onChange, indeterminate, invalid, className, id, ...rest }: CheckboxProps) {
  const autoId = useId()
  const cid = id ?? autoId
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          ref={ref}
          id={cid}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={invalid || undefined}
          className={cn(
            'peer size-5 cursor-pointer appearance-none rounded-[5px] border bg-white transition-colors checked:border-brand-700 checked:bg-brand-700 indeterminate:border-brand-700 indeterminate:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-red-500' : 'border-ink-300 hover:border-ink-400',
          )}
          {...rest}
        />
        <Check size={14} strokeWidth={3} className="pointer-events-none absolute hidden text-white peer-checked:block" aria-hidden />
        {indeterminate ? <span className="pointer-events-none absolute h-0.5 w-2.5 rounded bg-white" aria-hidden /> : null}
      </span>
      {label ? (
        <label htmlFor={cid} className="cursor-pointer text-sm leading-6 text-ink-800">
          {label}
          {description ? <span className="block text-xs text-ink-500">{description}</span> : null}
        </label>
      ) : null}
    </div>
  )
}

export interface RadioGroupProps {
  name: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean }[]
  invalid?: boolean
  layout?: 'stack' | 'inline' | 'cards'
  labelledBy?: string
  describedBy?: string
}

export function RadioGroup({ name, value, onChange, options, invalid, layout = 'stack', labelledBy, describedBy }: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(layout === 'inline' && 'flex flex-wrap gap-x-5 gap-y-2', layout === 'stack' && 'flex flex-col gap-2', layout === 'cards' && 'grid gap-2 sm:grid-cols-2')}
    >
      {options.map((o) => {
        const id = `${name}-${o.value}`
        const checked = value === o.value
        return (
          <label
            key={o.value}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 text-sm',
              layout === 'cards' && 'rounded-lg border p-3 transition-colors',
              layout === 'cards' && (checked ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : invalid ? 'border-red-300' : 'border-ink-200 hover:border-ink-300'),
              o.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-1 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-ink-300 bg-white transition-all checked:border-[5px] checked:border-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            />
            <span className="leading-6 text-ink-800">
              {o.label}
              {o.description ? <span className="block text-xs text-ink-500">{o.description}</span> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
}

export function Switch({ checked, onChange, label, description, disabled, id }: SwitchProps) {
  const autoId = useId()
  const sid = id ?? autoId
  return (
    <div className="flex items-start justify-between gap-4">
      {label ? (
        <label htmlFor={sid} className="cursor-pointer text-sm text-ink-800">
          <span className="font-medium">{label}</span>
          {description ? <span className="mt-0.5 block text-xs leading-5 text-ink-500">{description}</span> : null}
        </label>
      ) : null}
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-brand-700' : 'bg-ink-300',
        )}
      >
        {/* RTL: "on" moves the knob toward the end (left) */}
        <span className={cn('inline-block size-5 rounded-full bg-white shadow-sm transition-transform', checked ? '-translate-x-[22px]' : '-translate-x-0.5')} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Specialised inputs                                                   */
/* ------------------------------------------------------------------ */

export interface AmountInputProps {
  value: number | ''
  onChange: (v: number | '') => void
  invalid?: boolean
  id?: string
  describedBy?: string
  placeholder?: string
  unit?: string
}

/** Rial amount with thousand separators and a Toman hint. */
export function AmountInput({ value, onChange, invalid, id, describedBy, placeholder = '۰', unit = 'ریال' }: AmountInputProps) {
  const display = value === '' ? '' : formatNumber(value)
  return (
    <div>
      <Input
        id={id}
        aria-describedby={describedBy}
        invalid={invalid}
        inputMode="numeric"
        ltr
        className="tabular"
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = toEnDigits(e.target.value).replace(/[^\d]/g, '')
          onChange(digits === '' ? '' : Math.min(Number(digits), 99_999_999_999))
        }}
        suffix={<span className="ps-2 text-xs text-ink-500">{unit}</span>}
      />
      {value ? <p className="mt-1 text-xs text-ink-500">{rialToTomanWords(value)}</p> : null}
    </div>
  )
}

export function TimeInput({ value, onChange, invalid, id, describedBy }: { value: string; onChange: (v: string) => void; invalid?: boolean; id?: string; describedBy?: string }) {
  const [h, m] = value ? value.split(':') : ['', '']
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']
  return (
    <div className="flex items-center gap-2" dir="ltr" role="group" aria-describedby={describedBy}>
      <Select
        id={id}
        aria-label="ساعت"
        invalid={invalid}
        value={h}
        placeholder="ساعت"
        onChange={(e) => onChange(`${e.target.value}:${m || '00'}`)}
        options={hours.map((x) => ({ value: x, label: toFaDigits(x) }))}
        className="flex-1"
      />
      <span className="text-ink-400">:</span>
      <Select
        aria-label="دقیقه"
        invalid={invalid}
        value={m}
        placeholder="دقیقه"
        onChange={(e) => onChange(`${h || '08'}:${e.target.value}`)}
        options={minutes.map((x) => ({ value: x, label: toFaDigits(x) }))}
        className="flex-1"
      />
    </div>
  )
}

/** One-time code input: individual boxes, paste support, LTR. */
export function OtpInput({ length = 5, value, onChange, invalid, disabled, autoFocus }: { length?: number; value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = value.split('')
  const set = (i: number, ch: string) => {
    const next = chars.slice()
    next[i] = ch
    onChange(next.join('').slice(0, length))
  }
  return (
    <div className="flex justify-center gap-2" dir="ltr" role="group" aria-label="کد تأیید">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={chars[i] ? toFaDigits(chars[i]) : ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`رقم ${toFaDigits(i + 1)}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const d = toEnDigits(e.target.value).replace(/\D/g, '').slice(-1)
            set(i, d)
            if (d && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !chars[i] && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            e.preventDefault()
            const d = toEnDigits(e.clipboardData.getData('text')).replace(/\D/g, '').slice(0, length)
            onChange(d)
            refs.current[Math.min(d.length, length - 1)]?.focus()
          }}
          className={cn(
            'size-12 rounded-lg border bg-white text-center text-xl font-semibold text-ink-900 tabular transition-colors focus:outline-none focus:ring-3 disabled:bg-ink-50 sm:size-14',
            invalid ? 'border-red-400 focus:ring-red-100' : 'border-ink-200 focus:border-brand-500 focus:ring-brand-100',
          )}
        />
      ))}
    </div>
  )
}

/** Read-only value styled like a disabled input (for prefilled/computed fields) */
export function ReadonlyValue({ children, id, hint }: { children: ReactNode; id?: string; hint?: string }) {
  return (
    <div id={id} className="flex min-h-10 items-center gap-2 rounded-md border border-dashed border-ink-200 bg-ink-50 px-3 text-sm text-ink-700" title={hint}>
      {children || <span className="text-ink-400">—</span>}
    </div>
  )
}
