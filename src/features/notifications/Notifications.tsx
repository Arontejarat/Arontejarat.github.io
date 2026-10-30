import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Bell, BellOff, CheckCheck, ChevronLeft, ClipboardList, FileSignature, FileSpreadsheet, FileText, FolderKanban, Inbox, Megaphone, Receipt, ShieldAlert, Siren, MapPin, type LucideIcon } from 'lucide-react'
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, PageState, Select, Tabs } from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import type { AppNotification, NotificationCategory, RoleKey } from '@/types/domain'
import { cn } from '@/lib/cn'
import { formatDate, formatRelative } from '@/lib/format'

export const NOTIF_CATEGORY: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  request: { label: 'درخواست‌ها', icon: Inbox },
  contract: { label: 'قراردادها', icon: FileSignature },
  payslip: { label: 'فیش حقوقی', icon: Receipt },
  document: { label: 'مدارک', icon: FileText },
  task: { label: 'وظایف', icon: ClipboardList },
  project: { label: 'پروژه‌ها', icon: FolderKanban },
  import: { label: 'ورود گروهی', icon: FileSpreadsheet },
  admin: { label: 'پیام اداری', icon: Megaphone },
  security: { label: 'امنیت حساب', icon: ShieldAlert },
  job: { label: 'شغل و محل خدمت', icon: MapPin },
}

export function useAudienceNotifications(audience: { role: RoleKey; id: string }) {
  const db = useDB()
  return db.notifications.filter((n) => n.audience.role === audience.role && n.audience.id === audience.id).sort((a, b) => b.at.localeCompare(a.at))
}

export function NotificationsPage({ audience, basePath, breadcrumbs }: { audience: { role: RoleKey; id: string }; basePath: string; breadcrumbs: { label: string; to?: string }[] }) {
  return (
    <>
      <PageHeader title={audience.role === 'employee' ? 'اعلان‌ها' : 'اعلان‌ها و رویدادها'} description="پیام‌های اداری، یادآوری‌ها و تغییر وضعیت موارد مرتبط با شما." breadcrumbs={breadcrumbs} />
      <PageState>{({ empty }) => <List audience={audience} basePath={basePath} empty={empty} />}</PageState>
    </>
  )
}

function List({ audience, basePath, empty }: { audience: { role: RoleKey; id: string }; basePath: string; empty: boolean }) {
  const all = useAudienceNotifications(audience)
  const items = empty ? [] : all
  const actions = useActions()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') ?? 'all'
  const [category, setCategory] = useState('')
  const urgentOnly = filter === 'urgent'
  const rows = useMemo(() => items.filter((n) => (filter === 'unread' ? !n.read : urgentOnly ? n.urgent : true) && (!category || n.category === category)), [items, filter, category, urgentOnly])
  const unread = items.filter((n) => !n.read)
  const categories = [...new Set(items.map((n) => n.category))]

  if (items.length === 0) return <EmptyState icon={BellOff} title="اعلانی ندارید" description="تغییر وضعیت درخواست‌ها، قراردادهای آماده امضا و پیام‌های اداری در اینجا نمایش داده می‌شود." />

  const open = (n: AppNotification) => {
    if (!n.read) actions.markNotifications([n.id])
    navigate(n.link ?? `${basePath}/${n.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          variant="pills"
          value={filter}
          onChange={(v) => {
            const p = new URLSearchParams(params)
            p.set('filter', v)
            setParams(p, { replace: true })
          }}
          tabs={[
            { id: 'all', label: 'همه', count: items.length },
            { id: 'unread', label: 'خوانده‌نشده', count: unread.length },
            ...(audience.role !== 'employee' ? [{ id: 'urgent', label: 'هشدارهای فوری', icon: Siren }] : []),
          ]}
        />
        <div className="flex gap-2">
          <Select aria-label="نوع اعلان" className="w-full sm:w-44" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="همه انواع" options={categories.map((c) => ({ value: c, label: NOTIF_CATEGORY[c].label }))} />
          <Button variant="outline" icon={CheckCheck} disabled={unread.length === 0} onClick={() => actions.markNotifications(unread.map((n) => n.id))} className="shrink-0">
            <span className="hidden sm:inline">همه خوانده شد</span>
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState compact icon={Bell} title={filter === 'unread' ? 'همه اعلان‌ها را خوانده‌اید' : 'اعلانی با این فیلتر وجود ندارد'} />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {rows.map((n) => {
              const C = NOTIF_CATEGORY[n.category]
              return (
                <li key={n.id} className={cn('relative', !n.read && 'bg-brand-50/40')}>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-lg', n.urgent ? 'bg-red-50 text-red-600' : 'bg-ink-100 text-ink-600')}>
                      <C.icon size={18} aria-hidden />
                      {!n.read ? <span className="absolute -top-0.5 -start-0.5 size-2.5 rounded-full bg-brand-600 ring-2 ring-white" aria-hidden /> : null}
                    </span>
                    <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-start after:absolute after:inset-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-sm', n.read ? 'font-medium text-ink-800' : 'font-bold text-ink-900')}>{n.title}</span>
                        {n.urgent ? <Badge size="sm" tone="danger">فوری</Badge> : null}
                        {!n.read ? <span className="sr-only">(خوانده‌نشده)</span> : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] leading-6 text-ink-600">{n.body}</span>
                      <span className="mt-1 block text-2xs text-ink-500">
                        {C.label}، <time dateTime={n.at} title={formatDate(n.at, 'datetime')}>{formatRelative(n.at)}</time>
                      </span>
                    </button>
                    <div className="relative z-[1] flex shrink-0 items-center gap-1">
                      {!n.read ? (
                        <button type="button" onClick={() => actions.markNotifications([n.id])} className="rounded-md px-2 py-1 text-2xs font-medium text-brand-700 hover:bg-brand-50 max-sm:hidden">
                          خوانده شد
                        </button>
                      ) : null}
                      <Link to={`${basePath}/${n.id}`} className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-ink-100 max-sm:hidden" aria-label="جزئیات اعلان">
                        <ChevronLeft size={16} />
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

export function NotificationDetailPage({ audience, basePath }: { audience: { role: RoleKey; id: string }; basePath: string }) {
  const { id } = useParams()
  const db = useDB()
  const actions = useActions()
  const n = db.notifications.find((x) => x.id === id)
  const mine = n && n.audience.role === audience.role && n.audience.id === audience.id
  useEffect(() => {
    if (n && mine && !n.read) actions.markNotifications([n.id])
  }, [n, mine, actions])
  if (!n) return <Navigate to={basePath} replace />
  if (!mine) return <Navigate to="/forbidden" replace />
  const C = NOTIF_CATEGORY[n.category]
  return (
    <>
      <PageHeader title="جزئیات اعلان" breadcrumbs={[{ label: 'اعلان‌ها', to: basePath }, { label: n.title }]} back={{ to: basePath, label: 'اعلان‌ها' }} />
      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <C.icon size={20} aria-hidden />
          </span>
          <div>
            <p className="text-xs text-ink-500">
              {C.label}، {formatDate(n.at, 'datetime')}
            </p>
            <h2 className="mt-0.5 text-lg font-bold">{n.title}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-ink-700">{n.body}</p>
        {n.link ? (
          <ButtonLink to={n.link} className="mt-5" iconEnd={ChevronLeft}>
            مشاهده مورد مرتبط
          </ButtonLink>
        ) : null}
      </Card>
    </>
  )
}

