import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { ArrowRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber, initials, toFaDigits } from '@/lib/format'
import type { Tone } from '@/config/status'
import { toneClasses } from './feedback'
import { Button } from './Button'

export function Card({ children, className, as: As = 'section', padded = true, ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; padded?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn('min-w-0 rounded-xl border border-ink-200/80 bg-white shadow-xs', padded && 'p-4 sm:p-5', className)} {...rest}>
      {children}
    </As>
  )
}

export function CardHeader({ title, description, action, icon: Icon, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? <Icon size={18} className="mt-1 shrink-0 text-ink-500" aria-hidden /> : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-5 text-ink-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسیر صفحه" className="no-scrollbar overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap text-xs text-ink-500">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <ChevronLeft size={14} className="text-ink-300" aria-hidden /> : null}
            {c.to && i < items.length - 1 ? (
              <Link to={c.to} className="rounded px-0.5 hover:text-brand-700 hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'font-medium text-ink-700' : ''}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  back,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: Crumb[]
  back?: { to: string; label: string }
  meta?: ReactNode
}) {
  return (
    <header className="mb-5 sm:mb-6">
      {breadcrumbs ? (
        <div className="mb-2 hidden sm:block">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      ) : null}
      {back ? (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 rounded text-sm text-ink-600 hover:text-brand-700 sm:hidden">
          {/* RTL: "back" points right */}
          <ArrowRight size={16} aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-600">{description}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */

export interface TabItem {
  id: string
  label: ReactNode
  count?: number
  icon?: LucideIcon
}

/** Accessible tablist with arrow-key navigation (RTL aware). */
export function Tabs({ tabs, value, onChange, className, variant = 'underline' }: { tabs: TabItem[]; value: string; onChange: (id: string) => void; className?: string; variant?: 'underline' | 'pills' }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()
  const onKey = (e: KeyboardEvent, i: number) => {
    // RTL: ArrowLeft moves forward
    let next = -1
    if (e.key === 'ArrowLeft') next = (i + 1) % tabs.length
    if (e.key === 'ArrowRight') next = (i - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next >= 0) {
      e.preventDefault()
      refs.current[next]?.focus()
      onChange(tabs[next].id)
    }
  }
  return (
    <div role="tablist" className={cn('no-scrollbar flex overflow-x-auto', variant === 'underline' ? 'gap-1 border-b border-ink-200 max-sm:[mask-image:linear-gradient(to_right,transparent,#000_32px)]' : 'gap-1.5 rounded-lg bg-ink-100 p-1', className)}>
      {tabs.map((t, i) => {
        const active = t.id === value
        const Icon = t.icon
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            id={`${baseId}-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-3 py-2.5', active ? 'border-brand-700 text-brand-800' : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900')
                : cn('rounded-md px-3 py-1.5', active ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600 hover:text-ink-900'),
            )}
          >
            {Icon ? <Icon size={16} aria-hidden /> : null}
            {t.label}
            {t.count !== undefined ? (
              <span className={cn('rounded-full px-1.5 text-2xs leading-5 tabular', active ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600')}>{formatNumber(t.count)}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Route-backed tabs (each tab is a link) */
export function NavTabs({ tabs, className }: { tabs: { to: string; label: string; end?: boolean; count?: number; icon?: LucideIcon }[]; className?: string }) {
  return (
    <nav className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-200 max-sm:[mask-image:linear-gradient(to_right,transparent,#000_32px)]', className)} aria-label="زیربخش‌ها">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'border-brand-700 text-brand-800' : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900',
            )
          }
        >
          {t.icon ? <t.icon size={16} aria-hidden /> : null}
          {t.label}
          {t.count ? <span className="rounded-full bg-red-600 px-1.5 text-2xs leading-5 text-white tabular">{formatNumber(t.count)}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ */

export function DescriptionList({ items, columns = 2, className }: { items: { label: ReactNode; value: ReactNode; full?: boolean; hint?: ReactNode }[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0', it.full && 'sm:col-span-full')}>
          <dt className="text-xs text-ink-500">{it.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-ink-900">{it.value ?? '—'}</dd>
          {it.hint ? <dd className="mt-0.5 text-xs text-ink-500">{it.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  to,
  hint,
  emphasis,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: Tone
  to?: string
  hint?: ReactNode
  emphasis?: boolean
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', toneClasses[tone].soft, toneClasses[tone].text)}>
          <Icon size={18} aria-hidden />
        </span>
        <span className="text-2xl font-extrabold leading-8 tabular text-ink-900">{typeof value === 'number' ? formatNumber(value) : value}</span>
      </div>
      <div className="mt-2.5 flex items-start gap-1.5 text-[13px] font-medium leading-5 text-ink-600">
        {emphasis ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-100" aria-hidden /> : null}
        <span className="min-w-0">{label}</span>
        {emphasis ? <span className="sr-only">(نیازمند اقدام)</span> : null}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-ink-500">{hint}</div> : null}
    </>
  )
  const cls = cn(
    'group block min-w-0 rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-xs transition-[border-color,box-shadow] sm:p-4',
    to && 'hover:border-brand-200 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-500',
  )
  return to ? (
    <Link to={to} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  )
}

export function Avatar({ name, color = '#244378', size = 40, className }: { name: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/* ------------------------------------------------------------------ */

export function FilterBar({ search, children, activeCount = 0, onClear, actions }: { search?: ReactNode; children?: ReactNode; activeCount?: number; onClear?: () => void; actions?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {search ? <div className="min-w-0 flex-1 sm:basis-64">{search}</div> : null}
        {children ? (
          <Button variant="outline" icon={SlidersHorizontal} onClick={() => setOpen((o) => !o)} aria-expanded={open} className="shrink-0 md:hidden">
            فیلترها
            {activeCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1 text-2xs font-bold text-white">{toFaDigits(activeCount)}</span> : null}
          </Button>
        ) : null}
        {actions}
      </div>
      {children ? (
        <div className={cn('flex-wrap items-end gap-2.5', open ? 'flex' : 'hidden md:flex')}>
          {children}
          {activeCount > 0 && onClear ? (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-10">
              حذف فیلترها
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function Pagination({ page, pageCount, onChange, total, pageSize }: { page: number; pageCount: number; onChange: (p: number) => void; total?: number; pageSize?: number }) {
  if (pageCount <= 1) return total !== undefined ? <p className="mt-3 text-xs text-ink-500">{formatNumber(total)} مورد</p> : null
  const pages: (number | '…')[] = []
  for (let p = 1; p <= pageCount; p += 1) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }
  const from = pageSize ? (page - 1) * pageSize + 1 : 0
  const to = pageSize && total !== undefined ? Math.min(page * pageSize, total) : 0
  return (
    <nav aria-label="صفحه‌بندی" className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      {total !== undefined && pageSize ? (
        <p className="text-xs text-ink-500">
          نمایش {formatNumber(from)} تا {formatNumber(to)} از {formatNumber(total)} مورد
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        {/* RTL: previous = right-pointing chevron */}
        <button className="grid size-9 place-items-center rounded-md text-ink-600 hover:bg-ink-100 disabled:opacity-40" onClick={() => onChange(1)} disabled={page === 1} aria-label="صفحه اول">
          <ChevronsRight size={16} />
        </button>
        <button className="grid size-9 place-items-center rounded-md text-ink-600 hover:bg-ink-100 disabled:opacity-40" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="صفحه قبل">
          <ChevronRight size={16} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={i} className="px-1 text-ink-400">
              …
            </span>
          ) : (
            <button
              key={i}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn('h-9 min-w-9 rounded-md px-2 text-sm tabular', p === page ? 'bg-brand-800 font-semibold text-white' : 'text-ink-700 hover:bg-ink-100')}
            >
              {formatNumber(p)}
            </button>
          ),
        )}
        <button className="grid size-9 place-items-center rounded-md text-ink-600 hover:bg-ink-100 disabled:opacity-40" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="صفحه بعد">
          <ChevronLeft size={16} />
        </button>
        <button className="grid size-9 place-items-center rounded-md text-ink-600 hover:bg-ink-100 disabled:opacity-40" onClick={() => onChange(pageCount)} disabled={page === pageCount} aria-label="صفحه آخر">
          <ChevronsLeft size={16} />
        </button>
      </div>
    </nav>
  )
}

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safe = Math.min(page, pageCount)
  return {
    page: safe,
    pageCount,
    setPage,
    pageItems: items.slice((safe - 1) * pageSize, safe * pageSize),
    total: items.length,
    pageSize,
  }
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold text-ink-800">{children}</h2>
      {action}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-ink-100', className)} />
}

/** Wraps LTR technical values (IDs, phone numbers, IBAN) inside RTL text */
export function Ltr({ children, className, mono }: { children: ReactNode; className?: string; mono?: boolean }) {
  return (
    <bdi dir="ltr" className={cn('ltr tabular', mono && 'font-mono text-[0.92em]', className)}>
      {children}
    </bdi>
  )
}
