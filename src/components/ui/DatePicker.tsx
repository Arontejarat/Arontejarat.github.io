import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate, formatPeriod, toFaDigits } from '@/lib/format'
import {
  fromJalali,
  isoToJalali,
  JALALI_MONTHS,
  jalaliMonthLength,
  jalaliToISO,
  persianWeekday,
  shiftJalaliMonth,
  toJalali,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
} from '@/lib/jalali'
import { controlBase, controlState } from './forms'
import { Popover } from './overlay'

export interface DatePickerProps {
  value: string
  onChange: (iso: string) => void
  id?: string
  invalid?: boolean
  describedBy?: string
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  clearable?: boolean
  /** Highlight weekends/holidays */
  isHoliday?: (iso: string) => boolean
}

export function DatePicker({ value, onChange, id, invalid, describedBy, placeholder = 'انتخاب تاریخ', min, max, disabled, clearable = true, isHoliday }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="relative">
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(controlBase, controlState(invalid), 'flex h-10 items-center gap-2 px-3 text-start', !value && 'text-ink-400')}
      >
        <CalendarDays size={18} className="shrink-0 text-ink-400" aria-hidden />
        <span className="flex-1 truncate">{value ? formatDate(value, 'long') : placeholder}</span>
      </button>
      {clearable && value && !disabled ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="پاک کردن تاریخ"
        >
          <X size={15} />
        </button>
      ) : null}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} label="انتخاب تاریخ" className="w-[304px] p-3">
        <Calendar
          value={value}
          min={min}
          max={max}
          isHoliday={isHoliday}
          onSelect={(iso) => {
            onChange(iso)
            setOpen(false)
            anchorRef.current?.focus()
          }}
        />
      </Popover>
    </div>
  )
}

function Calendar({ value, onSelect, min, max, isHoliday }: { value: string; onSelect: (iso: string) => void; min?: string; max?: string; isHoliday?: (iso: string) => boolean }) {
  const today = toJalali(new Date())
  const initial = value ? isoToJalali(value) : today
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm })
  const [focusDay, setFocusDay] = useState(value ? initial.jd : view.jy === today.jy && view.jm === today.jm ? today.jd : 1)
  const gridRef = useRef<HTMLDivElement>(null)
  // Move DOM focus into the grid only on open and on keyboard navigation
  const focusPending = useRef(true)
  const len = jalaliMonthLength(view.jy, view.jm)
  const firstWeekday = persianWeekday(fromJalali(view.jy, view.jm, 1))
  const selected = value ? isoToJalali(value) : null

  useEffect(() => {
    if (!focusPending.current) return
    focusPending.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus()
  }, [focusDay, view])

  const outOfRange = (iso: string) => (min && iso < min) || (max && iso > max)

  const move = (deltaDays: number) => {
    let d = focusDay + deltaDays
    let v = view
    if (d < 1) {
      v = shiftJalaliMonth(view.jy, view.jm, -1)
      d = jalaliMonthLength(v.jy, v.jm) + d
    } else if (d > len) {
      d = d - len
      v = shiftJalaliMonth(view.jy, view.jm, 1)
    }
    focusPending.current = true
    setView(v)
    setFocusDay(d)
  }

  const years = useMemo(() => Array.from({ length: 81 }, (_, i) => today.jy - 70 + i), [today.jy])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-1">
        <button type="button" className="grid size-8 place-items-center rounded-md text-ink-600 hover:bg-ink-100" onClick={() => setView(shiftJalaliMonth(view.jy, view.jm, -1))} aria-label="ماه قبل">
          <ChevronRight size={18} />
        </button>
        <div className="flex items-center gap-1">
          <select
            aria-label="ماه"
            value={view.jm}
            onChange={(e) => setView({ ...view, jm: Number(e.target.value) })}
            className="rounded-md border-0 bg-transparent px-1 py-1 text-sm font-semibold text-ink-900 hover:bg-ink-100 focus:ring-2 focus:ring-brand-200"
          >
            {JALALI_MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="سال"
            value={view.jy}
            onChange={(e) => setView({ ...view, jy: Number(e.target.value) })}
            className="rounded-md border-0 bg-transparent px-1 py-1 text-sm font-semibold text-ink-900 hover:bg-ink-100 focus:ring-2 focus:ring-brand-200"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {toFaDigits(y)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="grid size-8 place-items-center rounded-md text-ink-600 hover:bg-ink-100" onClick={() => setView(shiftJalaliMonth(view.jy, view.jm, 1))} aria-label="ماه بعد">
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center" role="row">
        {WEEKDAYS_SHORT.map((w, i) => (
          <abbr key={w} title={WEEKDAYS_LONG[i]} className={cn('py-1 text-2xs font-semibold no-underline', i === 6 ? 'text-red-500' : 'text-ink-500')}>
            {w}
          </abbr>
        ))}
      </div>
      <div
        ref={gridRef}
        role="grid"
        aria-label={formatPeriod(view.jy, view.jm)}
        className="grid grid-cols-7 gap-0.5"
        onKeyDown={(e) => {
          const map: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 }
          if (map[e.key] !== undefined) {
            e.preventDefault()
            move(map[e.key])
          }
        }}
      >
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: len }).map((_, i) => {
          const d = i + 1
          const iso = jalaliToISO(view.jy, view.jm, d)
          const isSel = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === d
          const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d
          const wd = (firstWeekday + i) % 7
          const holiday = wd === 6 || isHoliday?.(iso)
          const disabled = Boolean(outOfRange(iso))
          return (
            <button
              key={d}
              type="button"
              data-day={d}
              role="gridcell"
              tabIndex={d === focusDay ? 0 : -1}
              aria-selected={Boolean(isSel)}
              aria-current={isToday ? 'date' : undefined}
              aria-label={formatDate(iso, 'long')}
              disabled={disabled}
              onClick={() => onSelect(iso)}
              className={cn(
                'relative h-9 rounded-md text-sm tabular transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:text-ink-300',
                isSel ? 'bg-brand-800 font-semibold text-white' : holiday ? 'text-red-600 hover:bg-red-50' : 'text-ink-800 hover:bg-ink-100',
                isToday && !isSel && 'ring-1 ring-inset ring-brand-400',
              )}
            >
              {toFaDigits(d)}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-ink-100 pt-2">
        <button
          type="button"
          className="rounded px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          onClick={() => {
            const iso = jalaliToISO(today.jy, today.jm, today.jd)
            if (!outOfRange(iso)) onSelect(iso)
            else setView({ jy: today.jy, jm: today.jm })
          }}
        >
          امروز
        </button>
        <span className="text-2xs text-ink-400">تقویم هجری شمسی</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export interface MonthPickerProps {
  value: string // "1405-08"
  onChange: (v: string) => void
  id?: string
  invalid?: boolean
  describedBy?: string
  placeholder?: string
  /** Latest selectable period (inclusive) */
  max?: string
}

export function MonthPicker({ value, onChange, id, invalid, describedBy, placeholder = 'انتخاب ماه و سال', max }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const today = toJalali(new Date())
  const [vy, vm] = value ? value.split('-').map(Number) : [today.jy, today.jm]
  const [year, setYear] = useState(vy)
  return (
    <>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => {
          setYear(vy)
          setOpen((o) => !o)
        }}
        className={cn(controlBase, controlState(invalid), 'flex h-10 items-center gap-2 px-3 text-start', !value && 'text-ink-400')}
      >
        <CalendarDays size={18} className="shrink-0 text-ink-400" aria-hidden />
        <span className="flex-1">{value ? formatPeriod(vy, vm) : placeholder}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} label="انتخاب ماه" className="w-[280px] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setYear((y) => y - 1)} className="grid size-8 place-items-center rounded-md hover:bg-ink-100" aria-label="سال قبل">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-bold tabular">{toFaDigits(year)}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} className="grid size-8 place-items-center rounded-md hover:bg-ink-100" aria-label="سال بعد">
            <ChevronLeft size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {JALALI_MONTHS.map((m, i) => {
            const key = `${year}-${String(i + 1).padStart(2, '0')}`
            const disabled = Boolean(max && key > max)
            const sel = key === value
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                  anchorRef.current?.focus()
                }}
                className={cn('h-9 rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:text-ink-300', sel ? 'bg-brand-800 font-semibold text-white' : 'text-ink-800 hover:bg-ink-100')}
              >
                {m}
              </button>
            )
          })}
        </div>
      </Popover>
    </>
  )
}
