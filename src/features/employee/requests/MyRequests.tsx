import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, Inbox, Plus, SearchX } from 'lucide-react'
import { ButtonLink, DataTable, DatePicker, EmptyState, FilterBar, NavTabs, PageHeader, PageState, SearchInput, Select, StatusBadge, Badge, type Column } from '@/components/ui'
import { useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { requestType } from '@/mock/selectors'
import { REQUEST_STATUS } from '@/config/status'
import { REQUEST_CATEGORIES } from '@/config/requestTypes'
import { formatDate, formatDeadline, toEnDigits, toFaDigits } from '@/lib/format'
import { iconFor } from '@/config/icons'
import type { EmployeeRequest, RequestStatus } from '@/types/domain'
import { requestSummary } from '@/features/requests/RequestViews'

export function RequestCenterTabs() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const fix = db.requests.filter((r) => r.employeeId === emp.id && r.status === 'needs_correction').length
  return (
    <NavTabs
      className="mb-5"
      tabs={[
        { to: '/me/requests', label: 'درخواست‌های من', end: true, count: fix },
        { to: '/me/requests/new', label: 'ثبت درخواست جدید', icon: Plus },
      ]}
    />
  )
}

export function MyRequestsPage() {
  return (
    <>
      <PageHeader
        title="مرکز درخواست‌ها"
        description="همه درخواست‌های پرسنلی خود را از اینجا ثبت و پیگیری کنید."
        breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'مرکز درخواست‌ها' }]}
        actions={
          <ButtonLink to="/me/requests/new" icon={Plus} className="max-sm:hidden">
            ثبت درخواست جدید
          </ButtonLink>
        }
      />
      <RequestCenterTabs />
      <PageState>{({ empty }) => <RequestList forceEmpty={empty} />}</PageState>
    </>
  )
}

function RequestList({ forceEmpty }: { forceEmpty: boolean }) {
  const db = useDB()
  const emp = useCurrentEmployee()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const statusParam = params.get('status') ?? ''
  const setStatus = (s: string) => {
    const p = new URLSearchParams(params)
    if (s) p.set('status', s)
    else p.delete('status')
    setParams(p, { replace: true })
  }

  const all = forceEmpty ? [] : db.requests.filter((r) => r.employeeId === emp.id)
  const rows = useMemo(() => {
    const query = toEnDigits(q.trim())
    return all
      .filter((r) => {
        if (statusParam === 'open' && !['submitted', 'in_review', 'needs_correction'].includes(r.status)) return false
        if (statusParam && statusParam !== 'open' && r.status !== statusParam) return false
        if (type) {
          const t = requestType(db, r.typeId)
          if (type.startsWith('cat:') ? t?.category !== type.slice(4) : r.typeId !== type) return false
        }
        const d = (r.submittedAt ?? r.createdAt).slice(0, 10)
        if (from && d < from) return false
        if (to && d > to) return false
        if (query) {
          const t = requestType(db, r.typeId)
          if (!r.trackingNo.includes(query) && !t?.title.includes(q.trim())) return false
        }
        return true
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [all, statusParam, type, from, to, q, db])

  if (all.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="هنوز درخواستی ثبت نکرده‌اید"
        description="مساعده، مرخصی، تغییر اطلاعات، گواهی اشتغال و سایر درخواست‌ها را از یک فرم واحد ثبت کنید و وضعیت آن‌ها را همین‌جا پیگیری کنید."
        action={
          <ButtonLink to="/me/requests/new" icon={Plus}>
            ثبت اولین درخواست
          </ButtonLink>
        }
      />
    )
  }

  const activeCount = [statusParam, type, from, to].filter(Boolean).length
  const typeOptions = [
    ...REQUEST_CATEGORIES.map((c) => ({ value: `cat:${c.id}`, label: `همه موارد ${c.title}` })),
    ...db.requestTypes.map((t) => ({ value: t.id, label: t.title })),
  ]

  const columns: Column<EmployeeRequest>[] = [
    {
      id: 'type',
      header: 'نوع درخواست',
      cell: (r) => {
        const t = requestType(db, r.typeId)!
        const Icon = iconFor(t.icon)
        return (
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
              <Icon size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-ink-900">{t.title}</p>
              <p className="max-w-72 truncate text-xs text-ink-500">{requestSummary(r)}</p>
            </div>
          </div>
        )
      },
      sortValue: (r) => requestType(db, r.typeId)?.title ?? '',
    },
    { id: 'no', header: 'شماره پیگیری', cell: (r) => (r.status === 'draft' ? <span className="text-ink-400">—</span> : <bdi dir="ltr" className="tabular text-ink-700">{toFaDigits(r.trackingNo)}</bdi>) },
    { id: 'date', header: 'تاریخ ثبت', cell: (r) => formatDate(r.submittedAt ?? r.createdAt), sortValue: (r) => r.submittedAt ?? r.createdAt },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge meta={REQUEST_STATUS[r.status]} />
          {r.status === 'needs_correction' ? <span className="text-2xs font-medium text-amber-700">اقدام شما لازم است</span> : null}
        </div>
      ),
      sortValue: (r) => r.status,
    },
    { id: 'go', header: <span className="sr-only">جزئیات</span>, cell: () => <ChevronLeft size={16} className="text-ink-300" aria-hidden />, className: 'w-8' },
  ]

  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="جست‌وجو با شماره پیگیری یا نوع درخواست" />}
        activeCount={activeCount}
        onClear={() => {
          setStatus('')
          setType('')
          setFrom('')
          setTo('')
        }}
      >
        <div className="w-full sm:w-48">
          <Select aria-label="وضعیت" value={statusParam} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={[{ value: 'open', label: 'باز (در جریان)' }, ...(Object.keys(REQUEST_STATUS) as RequestStatus[]).map((s) => ({ value: s, label: REQUEST_STATUS[s].label }))]} />
        </div>
        <div className="w-full sm:w-56">
          <Select aria-label="نوع درخواست" value={type} onChange={(e) => setType(e.target.value)} placeholder="همه انواع" options={typeOptions} />
        </div>
        <div className="w-full sm:w-48">
          <DatePicker value={from} onChange={setFrom} placeholder="از تاریخ" max={to || undefined} />
        </div>
        <div className="w-full sm:w-48">
          <DatePicker value={to} onChange={setTo} placeholder="تا تاریخ" min={from || undefined} />
        </div>
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.id}
        rowHref={(r) => (r.status === 'draft' ? `/me/requests/new?draft=${r.id}` : `/me/requests/${r.id}`)}
        caption="فهرست درخواست‌های من"
        mobileCard={(r) => {
          const t = requestType(db, r.typeId)!
          const Icon = iconFor(t.icon)
          const due = r.status === 'needs_correction' ? null : r.dueAt && ['submitted', 'in_review'].includes(r.status) ? formatDeadline(r.dueAt) : null
          return (
            <Link to={r.status === 'draft' ? `/me/requests/new?draft=${r.id}` : `/me/requests/${r.id}`} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
                <Icon size={17} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">{t.title}</span>
                  <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-600">{requestSummary(r)}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-500">
                  {r.status !== 'draft' ? <bdi dir="ltr">#{toFaDigits(r.trackingNo)}</bdi> : <span>پیش‌نویس</span>}
                  <span>{formatDate(r.submittedAt ?? r.createdAt)}</span>
                  {due ? <Badge size="sm" tone="muted">زمان هدف: {due.text}</Badge> : null}
                </span>
                {r.status === 'needs_correction' ? <span className="mt-2 block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">اقدام شما لازم است: اطلاعات را اصلاح و دوباره ارسال کنید.</span> : null}
              </span>
            </Link>
          )
        }}
        empty={<EmptyState icon={SearchX} title="درخواستی با این مشخصات پیدا نشد" description="فیلترها یا عبارت جست‌وجو را تغییر دهید." compact />}
      />
    </>
  )
}
