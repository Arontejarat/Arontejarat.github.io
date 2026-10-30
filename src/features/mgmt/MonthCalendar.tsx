import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { toneClasses } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { formatPeriod, toFaDigits } from '@/lib/format'
import { fromJalali, isoToJalali, jalaliMonthLength, jalaliToISO, persianWeekday, shiftJalaliMonth, toJalali, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/lib/jalali'
import type { Tone } from '@/config/status'

export interface CalendarEvent {
  id: string
  date: string // yyyy-mm-dd or ISO
  title: string
  tone: Tone
  to?: string
  onClick?: () => void
}

/** Jalali month grid with events; on mobile collapses to an agenda list. */
export function MonthCalendar({ events }: { events: CalendarEvent[] }) {
  const today = toJalali(new Date())
  const [view, setView] = useState({ jy: today.jy, jm: today.jm })
  const len = jalaliMonthLength(view.jy, view.jm)
  const first = persianWeekday(fromJalali(view.jy, view.jm, 1))
  const byDay = new Map<number, CalendarEvent[]>()
  events.forEach((e) => {
    const j = isoToJalali(e.date.slice(0, 10))
    if (j.jy === view.jy && j.jm === view.jm) byDay.set(j.jd, [...(byDay.get(j.jd) ?? []), e])
  })
  const chip = (e: CalendarEvent) => {
    const cls = cn('block truncate rounded px-1.5 py-0.5 text-2xs font-medium', toneClasses[e.tone].badge)
    return e.to ? (
      <Link key={e.id} to={e.to} className={cn(cls, 'hover:underline')} title={e.title}>
        {e.title}
      </Link>
    ) : (
      <button key={e.id} type="button" onClick={e.onClick} className={cn(cls, 'w-full text-start hover:underline')} title={e.title}>
        {e.title}
      </button>
    )
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button type="button" className="grid size-9 place-items-center rounded-md hover:bg-ink-100" onClick={() => setView(shiftJalaliMonth(view.jy, view.jm, -1))} aria-label="ماه قبل">
            <ChevronRight size={18} />
          </button>
          <h2 className="min-w-32 text-center text-base font-bold">{formatPeriod(view.jy, view.jm)}</h2>
          <button type="button" className="grid size-9 place-items-center rounded-md hover:bg-ink-100" onClick={() => setView(shiftJalaliMonth(view.jy, view.jm, 1))} aria-label="ماه بعد">
            <ChevronLeft size={18} />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setView({ jy: today.jy, jm: today.jm })}>
          امروز
        </Button>
      </div>
      {/* Desktop grid */}
      <div className="hidden overflow-hidden rounded-xl border border-ink-200 bg-white md:block">
        <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50">
          {WEEKDAYS_LONG.map((w, i) => (
            <div key={w} className={cn('px-2 py-2 text-center text-xs font-semibold', i === 6 ? 'text-red-600' : 'text-ink-600')}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: first }).map((_, i) => (
            <div key={`b${i}`} className="min-h-28 border-b border-e border-ink-100 bg-ink-25" />
          ))}
          {Array.from({ length: len }).map((_, i) => {
            const d = i + 1
            const isToday = view.jy === today.jy && view.jm === today.jm && d === today.jd
            const evs = byDay.get(d) ?? []
            return (
              <div key={d} className="min-h-28 border-b border-e border-ink-100 p-1.5">
                <div className={cn('mb-1 grid size-6 place-items-center rounded-full text-xs tabular', isToday ? 'bg-brand-800 font-bold text-white' : (first + i) % 7 === 6 ? 'text-red-600' : 'text-ink-600')}>{toFaDigits(d)}</div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map(chip)}
                  {evs.length > 3 ? <span className="block px-1 text-2xs text-ink-500">+{toFaDigits(evs.length - 3)} مورد دیگر</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {/* Mobile agenda */}
      <ul className="space-y-2 md:hidden">
        {[...byDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([d, evs]) => (
            <li key={d} className="rounded-xl border border-ink-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold text-ink-700">
                {WEEKDAYS_SHORT[(first + d - 1) % 7]} {toFaDigits(d)} {formatPeriod(view.jy, view.jm).split(' ')[0]}
                {jalaliToISO(view.jy, view.jm, d) === jalaliToISO(today.jy, today.jm, today.jd) ? ' — امروز' : ''}
              </p>
              <div className="space-y-1">{evs.map(chip)}</div>
            </li>
          ))}
        {byDay.size === 0 ? <li className="py-8 text-center text-sm text-ink-500">در این ماه موردی ثبت نشده است.</li> : null}
      </ul>
    </div>
  )
}
