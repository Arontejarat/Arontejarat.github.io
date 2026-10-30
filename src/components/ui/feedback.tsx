import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, Lock, RefreshCw, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { StatusMeta, Tone } from '@/config/status'
import { Button } from './Button'
import { formatNumber } from '@/lib/format'

export const toneClasses: Record<Tone, { badge: string; dot: string; soft: string; text: string; bar: string }> = {
  neutral: { badge: 'bg-ink-100 text-ink-700 ring-ink-200', dot: 'bg-ink-400', soft: 'bg-ink-50', text: 'text-ink-700', bar: 'bg-ink-400' },
  muted: { badge: 'bg-ink-50 text-ink-600 ring-ink-200', dot: 'bg-ink-300', soft: 'bg-ink-50', text: 'text-ink-500', bar: 'bg-ink-300' },
  info: { badge: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500', soft: 'bg-sky-50', text: 'text-sky-700', bar: 'bg-sky-500' },
  brand: { badge: 'bg-brand-50 text-brand-800 ring-brand-200', dot: 'bg-brand-500', soft: 'bg-brand-50', text: 'text-brand-700', bar: 'bg-brand-600' },
  warning: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  success: { badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  danger: { badge: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', soft: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
  accent: { badge: 'bg-accent-50 text-accent-800 ring-accent-200', dot: 'bg-accent-500', soft: 'bg-accent-50', text: 'text-accent-700', bar: 'bg-accent-500' },
}

export function Badge({ tone = 'neutral', children, className, icon: Icon, size = 'md' }: { tone?: Tone; children: ReactNode; className?: string; icon?: LucideIcon; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0 text-2xs leading-5' : 'px-2.5 py-0.5 text-xs leading-5',
        toneClasses[tone].badge,
        className,
      )}
    >
      {Icon ? <Icon size={size === 'sm' ? 12 : 13} aria-hidden /> : null}
      {children}
    </span>
  )
}

/**
 * Status indicator — always text + icon/dot, never colour alone.
 * `pill` is for the primary status of a record; `dot` is a quieter form for
 * secondary statuses in dense tables so a row never shows a wall of pills.
 */
export function StatusBadge({ meta, size = 'md', className, showHint, variant = 'pill' }: { meta: StatusMeta; size?: 'sm' | 'md'; className?: string; showHint?: boolean; variant?: 'pill' | 'dot' }) {
  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-700', className)} title={showHint ? meta.hint : undefined}>
        <span className={cn('size-2 shrink-0 rounded-full', toneClasses[meta.tone].dot)} aria-hidden />
        {meta.label}
      </span>
    )
  }
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
      <span title={showHint ? meta.hint : undefined}>{meta.label}</span>
    </Badge>
  )
}

export function CountBadge({ count, tone = 'danger' }: { count: number; tone?: 'danger' | 'brand' | 'neutral' }) {
  if (!count) return null
  return (
    <span
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-2xs font-bold leading-none tabular',
        tone === 'danger' ? 'bg-red-600 text-white' : tone === 'brand' ? 'bg-brand-700 text-white' : 'bg-ink-200 text-ink-700',
      )}
    >
      {count > 99 ? '۹۹+' : formatNumber(count)}
    </span>
  )
}

/* ------------------------------------------------------------------ */

const calloutTone = {
  info: { cls: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info, iconCls: 'text-sky-600' },
  success: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck, iconCls: 'text-emerald-600' },
  warning: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert, iconCls: 'text-amber-600' },
  danger: { cls: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert, iconCls: 'text-red-600' },
  neutral: { cls: 'border-ink-200 bg-ink-50 text-ink-800', icon: Info, iconCls: 'text-ink-500' },
}

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: keyof typeof calloutTone
  title?: ReactNode
  children?: ReactNode
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}) {
  const t = calloutTone[tone]
  const Icon = icon ?? t.icon
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex flex-col gap-3 rounded-lg border p-3.5 sm:flex-row sm:items-start', t.cls, className)}>
      <div className="flex flex-1 items-start gap-3">
        <Icon size={20} className={cn('mt-0.5 shrink-0', t.iconCls)} aria-hidden />
        <div className="min-w-0 flex-1 text-sm leading-6">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 gap-2 ps-8 sm:ps-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink-200/70', className)} aria-hidden />
}

export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'dashboard' | 'detail' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">در حال بارگذاری…</span>
      {variant === 'dashboard' ? (
        <>
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </>
      ) : variant === 'detail' ? (
        <>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-28" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </>
      )}
    </div>
  )
}

export function Spinner({ size = 20, className, label = 'در حال بارگذاری' }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-brand-600" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" fill="none" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 -m-3 rounded-full bg-brand-50" aria-hidden />
        <div className="relative grid size-14 place-items-center rounded-2xl border border-ink-200 bg-white text-brand-600 shadow-xs">
          <Icon size={26} aria-hidden />
        </div>
      </div>
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-6 text-ink-600">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title = 'ارتباط با سرور برقرار نشد', description = 'اطلاعات این صفحه بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.', onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={WifiOff}
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="outline" icon={RefreshCw} onClick={onRetry}>
            تلاش دوباره
          </Button>
        ) : null
      }
    />
  )
}

export function PermissionState({ title = 'دسترسی به این بخش مجاز نیست', description = 'نقش کاربری شما اجازه مشاهده این اطلاعات را ندارد. در صورت نیاز با مدیر مجموعه خود تماس بگیرید.', action }: { title?: string; description?: string; action?: ReactNode }) {
  return <EmptyState icon={Lock} title={title} description={description} action={action} />
}

/* ------------------------------------------------------------------ */

export function ProgressBar({ value, tone = 'brand', label, showValue, size = 'md', className }: { value: number; tone?: Tone; label?: string; showValue?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={className}>
      {label || showValue ? (
        <div className="mb-1 flex items-center justify-between text-xs text-ink-600">
          <span>{label}</span>
          {showValue ? <span className="font-semibold tabular text-ink-800">{formatNumber(Math.round(v))}٪</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('w-full overflow-hidden rounded-full bg-ink-100', size === 'sm' ? 'h-1.5' : 'h-2')}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', toneClasses[tone].bar)} style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

export function ProgressRing({ value, size = 56, stroke = 6, tone = 'brand', children }: { value: number; size?: number; stroke?: number; tone?: Tone; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  const color = { brand: '#2d5394', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', accent: '#1a9f91', info: '#0ea5e9', neutral: '#98a2b3', muted: '#c5ccd8' }[tone]
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${formatNumber(Math.round(v))} درصد`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eceff4" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-bold tabular text-ink-800">{children ?? `${formatNumber(Math.round(v))}٪`}</div>
    </div>
  )
}

/** Deadline indicator: plain text while there is time, a pill only when urgent or overdue. */
export function DeadlineBadge({ d, children }: { d: { tone: 'danger' | 'warning' | 'neutral' }; children: ReactNode }) {
  if (d.tone === 'neutral') return <span className="whitespace-nowrap text-xs text-ink-600">{children}</span>
  return (
    <Badge size="sm" tone={d.tone}>
      {children}
    </Badge>
  )
}
