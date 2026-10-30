import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, FileSignature, FolderOpen, Receipt, SearchX, Search as SearchIcon } from 'lucide-react'
import { Card, EmptyState, NavTabs, PageHeader, PageState, SearchInput, StatusBadge } from '@/components/ui'
import { useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { contractsNeedingEmployeeSignature, documentsNeedingAction, documentStatus, employeeContractStatus } from '@/mock/selectors'
import { DOC_STATUS, EMPLOYEE_CONTRACT_STATUS, PAYSLIP_STATUS } from '@/config/status'
import { docType, DOC_TYPES } from '@/config/documentTypes'
import { formatNumber, formatPeriod, formatDate } from '@/lib/format'
import { JALALI_MONTHS } from '@/lib/jalali'

export function DocumentsTabs() {
  const db = useDB()
  const emp = useCurrentEmployee()
  return (
    <NavTabs
      className="mb-5"
      tabs={[
        { to: '/me/documents', label: 'همه', end: true },
        { to: '/me/documents/contracts', label: 'قراردادها', count: contractsNeedingEmployeeSignature(db, emp.id).length },
        { to: '/me/documents/payslips', label: 'فیش‌ها' },
        { to: '/me/documents/personnel', label: 'مدارک', count: documentsNeedingAction(db, emp.id).length },
      ]}
    />
  )
}

export function DocumentsHubPage() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const contracts = db.contracts.filter((c) => c.employeeId === emp.id && c.stage !== 'superseded')
  const toSign = contractsNeedingEmployeeSignature(db, emp.id)
  const payslips = db.payslips.filter((p) => p.employeeId === emp.id).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
  const docs = db.documents.filter((d) => d.employeeId === emp.id)
  const docsAction = documentsNeedingAction(db, emp.id)
  return (
    <>
      <PageHeader title="اسناد من" description="قراردادهای ماهانه، فیش‌های حقوقی و مدارک پرسنلی شما در یک‌جا." breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'اسناد من' }]} />
      <DocumentsTabs />
      <PageState variant="dashboard">
        {() => (
          <div className="space-y-5">
            <Link to="/me/documents/search" className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-500 shadow-xs hover:border-ink-300">
              <SearchIcon size={18} aria-hidden /> جست‌وجو در قراردادها، فیش‌ها و مدارک…
            </Link>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  to: '/me/documents/contracts',
                  icon: FileSignature,
                  title: 'قراردادهای ماهانه',
                  count: contracts.length,
                  alert: toSign.length ? `${formatNumber(toSign.length)} قرارداد آماده امضا` : null,
                  sub: 'مشاهده، امضا و دریافت نسخه نهایی',
                },
                {
                  to: '/me/documents/payslips',
                  icon: Receipt,
                  title: 'فیش‌های حقوقی',
                  count: payslips.length,
                  alert: null,
                  sub: payslips[0] ? `آخرین فیش: ${formatPeriod(payslips[0].year, payslips[0].month)}` : 'هنوز فیشی صادر نشده',
                },
                {
                  to: '/me/documents/personnel',
                  icon: FolderOpen,
                  title: 'مدارک پرسنلی',
                  count: docs.length,
                  alert: docsAction.length ? `${formatNumber(docsAction.length)} مدرک نیازمند اقدام` : null,
                  sub: 'ارسال، پیش‌نمایش و پیگیری بررسی مدارک',
                },
              ].map((x) => (
                <Link key={x.to} to={x.to} className="group rounded-xl border border-ink-200/80 bg-white p-5 shadow-xs transition hover:border-ink-300 hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <x.icon size={22} aria-hidden />
                    </span>
                    <ChevronLeft size={18} className="text-ink-300 group-hover:text-ink-500" aria-hidden />
                  </div>
                  <h2 className="mt-4 text-base font-bold">{x.title}</h2>
                  <p className="mt-0.5 text-xs text-ink-500">{x.sub}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-ink-600">{formatNumber(x.count)} سند</span>
                    {x.alert ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 ring-1 ring-amber-200">{x.alert}</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </PageState>
    </>
  )
}

/** Cross-document search (PRD part 1 §12 — جست‌وجوی اسناد) */
export function DocumentSearchPage() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const query = q.trim()
    if (query.length < 2) return []
    const out: { key: string; to: string; kind: string; title: string; sub: string; badge: React.ReactNode }[] = []
    db.contracts
      .filter((c) => c.employeeId === emp.id && c.stage !== 'superseded')
      .forEach((c) => {
        const title = `قرارداد ${formatPeriod(c.periodYear!, c.periodMonth!)}`
        if ([title, c.number, c.jobTitle, JALALI_MONTHS[(c.periodMonth ?? 1) - 1]].join(' ').includes(query))
          out.push({ key: c.id, to: `/me/documents/contracts/${c.id}`, kind: 'قرارداد', title, sub: c.number, badge: <StatusBadge size="sm" meta={EMPLOYEE_CONTRACT_STATUS[employeeContractStatus(c)]} /> })
      })
    db.payslips
      .filter((p) => p.employeeId === emp.id)
      .forEach((p) => {
        const title = `فیش حقوقی ${formatPeriod(p.year, p.month)}`
        if ([title, 'فیش', 'حقوق'].join(' ').includes(query)) out.push({ key: p.id, to: `/me/documents/payslips/${p.id}`, kind: 'فیش حقوقی', title, sub: `صدور ${formatDate(p.issuedAt)}`, badge: <StatusBadge size="sm" meta={PAYSLIP_STATUS[p.status]} /> })
      })
    db.documents
      .filter((d) => d.employeeId === emp.id)
      .forEach((d) => {
        const t = docType(d.typeId)
        if (t && [t.title, 'مدرک'].join(' ').includes(query)) out.push({ key: d.id, to: `/me/documents/personnel/${d.id}`, kind: 'مدرک', title: t.title, sub: d.versions[d.versions.length - 1].fileName, badge: <StatusBadge size="sm" meta={DOC_STATUS[documentStatus(d)]} /> })
      })
    DOC_TYPES.filter((t) => t.title.includes(query) && !db.documents.some((d) => d.employeeId === emp.id && d.typeId === t.id)).forEach((t) =>
      out.push({ key: t.id, to: `/me/documents/personnel/upload?type=${t.id}`, kind: 'مدرک', title: t.title, sub: 'ارسال نشده', badge: <StatusBadge size="sm" meta={DOC_STATUS.not_submitted} /> }),
    )
    return out
  }, [q, db, emp.id])
  return (
    <>
      <PageHeader title="جست‌وجوی اسناد" breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'جست‌وجو' }]} back={{ to: '/me/documents', label: 'اسناد من' }} />
      <Card>
        <SearchInput value={q} onChange={setQ} placeholder="مثلاً: مهر، فیش، کارت ملی، CT-1405…" autoFocus />
        <div className="mt-4">
          {q.trim().length < 2 ? (
            <p className="py-8 text-center text-sm text-ink-500">حداقل دو حرف وارد کنید.</p>
          ) : results.length === 0 ? (
            <EmptyState compact icon={SearchX} title="سندی پیدا نشد" description="عبارت دیگری را امتحان کنید؛ مثلاً نام ماه یا نوع مدرک." />
          ) : (
            <ul className="divide-y divide-ink-100" aria-live="polite">
              {results.map((r) => (
                <li key={r.key}>
                  <Link to={r.to} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-ink-25">
                    <span className="w-20 shrink-0 text-2xs font-semibold text-ink-500">{r.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="block truncate text-xs text-ink-500" dir="auto">
                        {r.sub}
                      </span>
                    </span>
                    {r.badge}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  )
}
