/**
 * Small, purposeful charts. Rules followed (see dataviz guidance):
 * - single-series magnitude → one hue, no legend; the card title names it
 * - status distributions use reserved status tones, always with label + count
 * - thin marks, 4px rounded data ends, 2px gaps between segments
 * - every mark has a hover/focus tooltip; values stay in ink colours
 */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import type { Tone } from '@/config/status'
import { toneClasses } from './feedback'

export interface BarDatum {
  label: string
  value: number
  to?: string
  hint?: string
}

/** Horizontal bar list — ranked magnitudes with direct labels */
export function BarList({ data, max, unit = '', emptyText = 'داده‌ای برای نمایش وجود ندارد.' }: { data: BarDatum[]; max?: number; unit?: string; emptyText?: string }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <p className="py-6 text-center text-sm text-ink-500">{emptyText}</p>
  return (
    <ul className="space-y-2.5">
      {data.map((d) => {
        const row = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate text-ink-700">{d.label}</span>
              <span className="shrink-0 font-semibold tabular text-ink-900">
                {formatNumber(d.value)}
                {unit ? <span className="ms-0.5 text-2xs font-normal text-ink-500">{unit}</span> : null}
              </span>
            </div>
            <div className="h-2 rounded-full bg-ink-100" title={d.hint ?? `${d.label}: ${formatNumber(d.value)}`}>
              <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${(d.value / m) * 100}%` }} />
            </div>
          </>
        )
        return (
          <li key={d.label}>
            {d.to ? (
              <Link to={d.to} className="-m-1 block rounded-md p-1 hover:bg-ink-50">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        )
      })}
    </ul>
  )
}

export interface Segment {
  label: string
  value: number
  tone: Tone
  to?: string
}

/** 100% stacked bar for a status distribution, with a legend of counts */
export function StackedBar({ segments, total, height = 10 }: { segments: Segment[]; total?: number; height?: number }) {
  const sum = total ?? segments.reduce((a, b) => a + b.value, 0)
  const [hover, setHover] = useState<number | null>(null)
  const visible = segments.filter((s) => s.value > 0)
  return (
    <div>
      <div className="relative">
        <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-ink-100" style={{ height }} role="img" aria-label={segments.map((s) => `${s.label}: ${formatNumber(s.value)}`).join('، ')}>
          {visible.map((s, i) => (
            <div
              key={s.label}
              className={cn('h-full transition-opacity first:rounded-s-full last:rounded-e-full', toneClasses[s.tone].bar, hover !== null && hover !== i && 'opacity-40')}
              style={{ width: `${(s.value / Math.max(1, sum)) * 100}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
        {hover !== null && visible[hover] ? (
          <div className="pointer-events-none absolute -top-9 start-0 rounded-md bg-ink-900 px-2 py-1 text-xs text-white shadow-md">
            {visible[hover].label}: {formatNumber(visible[hover].value)} ({formatNumber(Math.round((visible[hover].value / Math.max(1, sum)) * 100))}٪)
          </div>
        ) : null}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {segments.map((s, i) => {
          const inner = (
            <>
              <span className={cn('size-2.5 shrink-0 rounded-sm', toneClasses[s.tone].bar)} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink-600">{s.label}</span>
              <span className="font-semibold tabular text-ink-900">{formatNumber(s.value)}</span>
            </>
          )
          return (
            <li key={s.label} onMouseEnter={() => setHover(visible.indexOf(s))} onMouseLeave={() => setHover(null)} className="text-xs">
              {s.to ? (
                <Link to={s.to} className="-mx-1 flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-ink-50">
                  {inner}
                </Link>
              ) : (
                <span className={cn('flex items-center gap-1.5 py-0.5', hover === i && 'font-medium')}>{inner}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Required vs allocated (bullet bar): track = target, fill = actual */
export function BulletBar({ label, actual, target, extra, to }: { label: ReactNode; actual: number; target: number; extra?: ReactNode; to?: string }) {
  const pct = target ? Math.min(100, (actual / target) * 100) : 0
  const short = actual < target
  const content = (
    <>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate font-medium text-ink-800">{label}</span>
        <span className="shrink-0 tabular text-ink-600">
          <span className="font-bold text-ink-900">{formatNumber(actual)}</span> از {formatNumber(target)} نفر
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-ink-100" title={`تخصیص‌یافته ${formatNumber(actual)} از نیاز ${formatNumber(target)}`}>
        <div className={cn('h-full rounded-full', short ? 'bg-amber-500' : 'bg-accent-600')} style={{ width: `${pct}%` }} />
      </div>
      {extra ? <div className="mt-1 text-xs text-ink-500">{extra}</div> : null}
    </>
  )
  return to ? (
    <Link to={to} className="-m-1.5 block rounded-lg p-1.5 hover:bg-ink-50">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  )
}

/** Single-series column chart (e.g. monthly net pay). One hue; hover tooltip. */
export function ColumnChart({ data, height = 140, format = formatNumber, highlightLast }: { data: { label: string; value: number; sub?: string }[]; height?: number; format?: (n: number) => string; highlightLast?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div>
      <div className="relative flex items-end gap-1.5 border-b border-ink-200" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join('، ')}>
        {data.map((d, i) => (
          <button
            key={d.label + i}
            type="button"
            className="group relative flex h-full flex-1 items-end focus:outline-none"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.label}: ${format(d.value)}`}
          >
            <span
              className={cn(
                'block w-full rounded-t-[4px] transition-colors',
                hover === i ? 'bg-brand-700' : highlightLast && i === data.length - 1 ? 'bg-brand-600' : 'bg-brand-300',
              )}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
            {hover === i ? (
              <span className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-1 w-max translate-x-1/2 rounded-md bg-ink-900 px-2 py-1 text-xs text-white shadow-md">
                <span className="block font-semibold">{format(d.value)}</span>
                <span className="block text-ink-300">{d.sub ?? d.label}</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span key={d.label + i} className={cn('flex-1 whitespace-nowrap text-center text-2xs text-ink-500', data.length > 6 && i % 2 === (data.length - 1) % 2 ? '' : data.length > 6 ? 'max-sm:invisible' : '')}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
