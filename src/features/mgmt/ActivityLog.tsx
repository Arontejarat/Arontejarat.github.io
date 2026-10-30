import { useMemo, useState } from 'react'
import { Activity, Download, Lock, SearchX } from 'lucide-react'
import { Badge, Button, Callout, DataTable, DatePicker, EmptyState, FilterBar, PageHeader, PageState, SearchInput, Select, useToast, type Column } from '@/components/ui'
import { useDB } from '@/mock/store'
import { ROLE_LABEL } from '@/config/permissions'
import { displayId, formatDate } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import type { AuditEntry } from '@/types/domain'
import { downloadCsv } from './Workforce'

const ENTITY_LABEL: Record<string, string> = {
  request: 'درخواست',
  document: 'مدرک',
  contract: 'قرارداد',
  employee: 'نیرو',
  project: 'پروژه',
  import: 'ورود گروهی',
  user: 'کاربر',
  session: 'نشست',
  file: 'سند',
  requestType: 'نوع درخواست',
  alertRule: 'قانون هشدار',
  settings: 'تنظیمات',
  account: 'حساب',
  org: 'سازمان',
  company: 'شرکت',
}

/** Immutable audit trail viewer — scope filter decides which entries the viewer may see */
export function ActivityLogPage({ filter, base, title = 'تاریخچه فعالیت‌ها' }: { filter: (a: AuditEntry) => boolean; base: string; title?: string }) {
  return (
    <>
      <PageHeader title={title} description="عملیات حساس همراه با زمان، کاربر انجام‌دهنده، نوع عملیات و نتیجه ثبت می‌شوند." breadcrumbs={[{ label: 'داشبورد', to: base }, { label: title }]} />
      <PageState>{({ empty }) => <Log filter={filter} empty={empty} />}</PageState>
    </>
  )
}

function Log({ filter, empty }: { filter: (a: AuditEntry) => boolean; empty: boolean }) {
  const db = useDB()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [entity, setEntity] = useState('')
  const [result, setResult] = useState('')
  const [role, setRole] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const all = empty ? [] : db.audit.filter(filter)
  const rows = useMemo(
    () =>
      all
        .filter((a) => (!q || a.actor.includes(q) || a.action.includes(q) || a.entity.label.includes(q)) && (!entity || a.entity.type === entity) && (!result || a.result === result) && (!role || a.actorRole === role) && (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [all, q, entity, result, role, from, to],
  )
  const columns: Column<AuditEntry>[] = [
    { id: 'at', header: 'زمان', cell: (a) => <span className="whitespace-nowrap text-xs">{formatDate(a.at, 'datetime')}</span>, sortValue: (a) => a.at },
    { id: 'actor', header: 'کاربر', cell: (a) => <span className="text-[13px]">{a.actor}<span className="block text-2xs text-ink-500">{a.actorRole === 'system' ? 'سامانه' : ROLE_LABEL[a.actorRole]}</span></span> },
    { id: 'action', header: 'عملیات', cell: (a) => <span className="font-medium">{a.action}</span> },
    { id: 'entity', header: 'موضوع', cell: (a) => <span className="text-xs">{ENTITY_LABEL[a.entity.type] ?? a.entity.type}: {displayId(a.entity.label)}</span> },
    { id: 'detail', header: 'جزئیات', label: 'جزئیات', hideable: true, cell: (a) => <span className="line-clamp-1 max-w-56 text-xs text-ink-600">{a.detail ?? '—'}</span> },
    { id: 'result', header: 'نتیجه', cell: (a) => <Badge size="sm" tone={a.result === 'success' ? 'success' : 'danger'}>{a.result === 'success' ? 'موفق' : 'ناموفق'}</Badge> },
  ]
  if (all.length === 0) return <EmptyState icon={Activity} title="فعالیتی ثبت نشده است" />
  return (
    <>
      <Callout tone="neutral" icon={Lock} className="mb-4">
        این سوابق در برابر تغییر و حذف غیرمجاز محافظت می‌شوند و قابل ویرایش نیستند.
      </Callout>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="کاربر، عملیات یا موضوع" />}
        activeCount={[entity, result, role, from, to].filter(Boolean).length}
        onClear={() => {
          setEntity('')
          setResult('')
          setRole('')
          setFrom('')
          setTo('')
        }}
        actions={
          <Button
            variant="outline"
            icon={Download}
            onClick={() => {
              downloadCsv(`audit-${toISODate(new Date())}.csv`, ['زمان', 'کاربر', 'نقش', 'عملیات', 'موضوع', 'جزئیات', 'نتیجه'], rows.map((a) => [formatDate(a.at, 'datetime'), a.actor, a.actorRole, a.action, a.entity.label, a.detail ?? '', a.result === 'success' ? 'موفق' : 'ناموفق']))
              toast.success('خروجی سوابق آماده شد')
            }}
          >
            خروجی
          </Button>
        }
      >
        <Select aria-label="موضوع" className="w-full sm:w-40" value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="همه موضوع‌ها" options={[...new Set(all.map((a) => a.entity.type))].map((t) => ({ value: t, label: ENTITY_LABEL[t] ?? t }))} />
        <Select aria-label="نقش" className="w-full sm:w-44" value={role} onChange={(e) => setRole(e.target.value)} placeholder="همه نقش‌ها" options={[...new Set(all.map((a) => a.actorRole))].map((r) => ({ value: r, label: r === 'system' ? 'سامانه' : ROLE_LABEL[r] }))} />
        <Select aria-label="نتیجه" className="w-full sm:w-32" value={result} onChange={(e) => setResult(e.target.value)} placeholder="همه نتایج" options={[{ value: 'success', label: 'موفق' }, { value: 'failure', label: 'ناموفق' }]} />
        <div className="w-full sm:w-44">
          <DatePicker value={from} onChange={setFrom} placeholder="از تاریخ" />
        </div>
        <div className="w-full sm:w-44">
          <DatePicker value={to} onChange={setTo} placeholder="تا تاریخ" min={from || undefined} />
        </div>
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(a) => a.id}
        pageSize={15}
        columnChooser
        caption="سوابق ممیزی"
        mobileCard={(a) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{a.action}</p>
              <Badge size="sm" tone={a.result === 'success' ? 'success' : 'danger'}>{a.result === 'success' ? 'موفق' : 'ناموفق'}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-ink-600">{displayId(a.entity.label)}</p>
            <p className="mt-1 text-2xs text-ink-500">
              {a.actor}، {formatDate(a.at, 'datetime')}
            </p>
          </div>
        )}
        empty={<EmptyState compact icon={SearchX} title="سابقه‌ای با این فیلترها پیدا نشد" />}
      />
    </>
  )
}
