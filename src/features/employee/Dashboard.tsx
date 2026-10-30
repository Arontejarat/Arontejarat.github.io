import { Link } from 'react-router'
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarClock,
  ChevronLeft,
  FilePen,
  FileSignature,
  FileText,
  FolderOpen,
  Hourglass,
  Inbox,
  MapPin,
  Plus,
  Receipt,
  RotateCcw,
  Wallet,
  Briefcase,
  CalendarDays,
} from 'lucide-react'
import { Avatar, ButtonLink, Card, CardHeader, EmptyState, PageState, StatCard, StatusBadge , DeadlineBadge } from '@/components/ui'
import { useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, contractsNeedingEmployeeSignature, documentsNeedingAction, orgById, requestType } from '@/mock/selectors'
import { DOC_STATUS, EMPLOYMENT_STATUS, PAYMENT_STATUS, REQUEST_STATUS } from '@/config/status'
import { formatDate, formatDeadline, formatNumber, formatPeriod, formatRelative, formatRial, daysUntil } from '@/lib/format'
import { toJalali } from '@/lib/jalali'
import { cn } from '@/lib/cn'
import { iconFor } from '@/config/icons'
import { requestSummary } from '@/features/requests/RequestViews'

export function EmployeeDashboard() {
  return <PageState variant="dashboard">{() => <DashboardBody />}</PageState>
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'روز بخیر'
  return 'عصر بخیر'
}

function DashboardBody() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const company = companyById(db, emp.companyId)
  const org = orgById(db, emp.orgId)
  const myRequests = db.requests.filter((r) => r.employeeId === emp.id)
  const toSign = contractsNeedingEmployeeSignature(db, emp.id)
  const inReview = myRequests.filter((r) => ['submitted', 'in_review'].includes(r.status))
  const needsFix = myRequests.filter((r) => r.status === 'needs_correction')
  const docsAction = documentsNeedingAction(db, emp.id)
  const expiring = db.documents.filter((d) => d.employeeId === emp.id && d.expiresAt && daysUntil(d.expiresAt) >= 0 && daysUntil(d.expiresAt) <= 30)
  const unread = db.notifications.filter((n) => n.audience.role === 'employee' && n.audience.id === emp.id && !n.read)
  const payslips = db.payslips.filter((p) => p.employeeId === emp.id).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
  const latest = payslips[0]
  const net = latest ? latest.earnings.reduce((a, b) => a + b.amount, 0) - latest.deductions.reduce((a, b) => a + b.amount, 0) : 0
  const recent = [...myRequests].filter((r) => r.status !== 'draft').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const drafts = myRequests.filter((r) => r.status === 'draft')
  const status = EMPLOYMENT_STATUS[emp.employmentStatus]

  const actions: { key: string; icon: typeof FileSignature; tone: 'warning' | 'danger' | 'brand'; title: string; body: string; to: string; cta: string; deadline?: string }[] = [
    ...toSign.map((c) => ({
      key: c.id,
      icon: FileSignature,
      tone: 'warning' as const,
      title: `قرارداد ${formatPeriod(c.periodYear!, c.periodMonth!)} آماده امضاست`,
      body: 'متن قرارداد را مطالعه کنید و با کد پیامکی تأیید کنید.',
      to: `/me/documents/contracts/${c.id}`,
      cta: 'مشاهده و امضا',
      deadline: c.signDeadline,
    })),
    ...needsFix.map((r) => ({
      key: r.id,
      icon: RotateCcw,
      tone: 'warning' as const,
      title: `${requestType(db, r.typeId)?.title} نیازمند اصلاح است`,
      body: r.correctionNote ?? '',
      to: `/me/requests/${r.id}`,
      cta: 'اصلاح درخواست',
    })),
    ...docsAction.map((d) => ({
      key: d.type.id,
      icon: FileText,
      tone: (d.status === 'not_submitted' ? 'brand' : 'danger') as 'brand' | 'danger',
      title: `${d.type.title}: ${DOC_STATUS[d.status].label}`,
      body: d.doc ? d.doc.versions[d.doc.versions.length - 1].reason ?? '' : 'این مدرک برای تکمیل پرونده لازم است.',
      to: d.doc ? `/me/documents/personnel/${d.doc.id}` : `/me/documents/personnel/upload?type=${d.type.id}`,
      cta: d.doc ? 'ارسال نسخه اصلاحی' : 'ارسال مدرک',
      deadline: d.doc?.versions[d.doc.versions.length - 1].fixDeadline,
    })),
    ...expiring.map((d) => ({
      key: `exp-${d.id}`,
      icon: CalendarClock,
      tone: 'brand' as const,
      title: 'اعتبار مدرک رو به پایان است',
      body: `اعتبار تا ${formatDate(d.expiresAt)} — نسخه جدید را پیش از انقضا ارسال کنید.`,
      to: `/me/documents/personnel/${d.id}`,
      cta: 'مشاهده مدرک',
      deadline: d.expiresAt,
    })),
  ]

  return (
    <div className="space-y-5">
      {/* Identity & assignment */}
      <Card className="p-0! sm:p-0!">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <div className="flex items-center gap-3">
            <Avatar name={`${emp.firstName} ${emp.lastName}`} color={emp.photoColor} size={48} />
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{greeting()}</p>
              <h1 className="text-lg font-extrabold sm:text-xl">سلام، {emp.firstName} عزیز</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadge meta={status} size="sm" />
                <span className="text-xs text-ink-600">{emp.jobTitle}</span>
              </div>
            </div>
          </div>
          <dl className="grid flex-1 gap-x-6 gap-y-1.5 border-t border-ink-100 pt-3 text-sm sm:grid-cols-3 sm:gap-y-2.5 sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0">
            {[
              { icon: Building2, label: 'سازمان محل خدمت', value: org?.name },
              { icon: Briefcase, label: 'شرکت تأمین نیرو', value: company?.name },
              { icon: MapPin, label: 'محل استقرار', value: emp.unit },
            ].map((x) => (
              <div key={x.label} className="flex items-center gap-2 sm:items-start">
                <x.icon size={16} className="shrink-0 text-ink-400 sm:mt-0.5" aria-hidden />
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:block">
                  <dt className="shrink-0 text-xs text-ink-500">{x.label}</dt>
                  <dd className="truncate font-medium text-ink-900">{x.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {/* Key counts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="قرارداد نیازمند امضا" value={toSign.length} icon={FileSignature} tone="warning" to="/me/documents/contracts?status=ready" emphasis={toSign.length > 0} />
        <StatCard label="درخواست در حال بررسی" value={inReview.length} icon={Hourglass} tone="brand" to="/me/requests?status=open" />
        <StatCard label="مدرک نیازمند اصلاح یا تکمیل" value={docsAction.length} icon={FileText} tone="danger" to="/me/documents/personnel" emphasis={docsAction.length > 0} />
        <StatCard label="اعلان خوانده‌نشده" value={unread.length} icon={Bell} tone="info" to="/me/notifications?filter=unread" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Action required */}
        <Card className="lg:col-span-2">
          <CardHeader title="اقدامات لازم" description="مواردی که منتظر اقدام شما هستند، به ترتیب اهمیت." />
          {actions.length === 0 ? (
            <EmptyState compact icon={Inbox} title="کاری در انتظار شما نیست" description="همه درخواست‌ها، قراردادها و مدارک شما به‌روز هستند." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {actions.slice(0, 6).map((a) => {
                const dl = a.deadline ? formatDeadline(a.deadline) : null
                return (
                  <li key={a.key}>
                    <Link to={a.to} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-ink-25">
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', a.tone === 'warning' ? 'bg-amber-50 text-amber-700' : a.tone === 'danger' ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700')}>
                        <a.icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900">{a.title}</span>
                          {dl ? (
                            <DeadlineBadge d={dl}>
                              مهلت: {dl.text}
                            </DeadlineBadge>
                          ) : null}
                        </span>
                        {a.body ? <span className="mt-0.5 line-clamp-2 block text-[13px] leading-6 text-ink-600">{a.body}</span> : null}
                      </span>
                      <span className="hidden shrink-0 items-center gap-1 self-center text-xs font-semibold text-brand-700 sm:flex">
                        {a.cta}
                        <ChevronLeft size={14} aria-hidden />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Quick access */}
        <Card>
          <CardHeader title="دسترسی سریع" />
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: '/me/requests/new', icon: Plus, t: 'ثبت درخواست جدید', d: 'ورود به مرکز درخواست‌ها', primary: true },
              { to: '/me/documents/contracts', icon: FileSignature, t: 'قراردادهای من', d: 'مشاهده و امضا' },
              { to: '/me/documents/payslips', icon: Receipt, t: 'فیش حقوقی', d: 'مشاهده حقوق ماهانه' },
              { to: '/me/documents/personnel', icon: FolderOpen, t: 'مدارک من', d: 'مشاهده و تکمیل مدارک' },
            ].map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-3 transition-colors',
                  q.primary ? 'border-brand-800 bg-brand-800 text-white hover:bg-brand-900' : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-25',
                )}
              >
                <q.icon size={20} aria-hidden className={q.primary ? 'text-accent-300' : 'text-brand-700'} />
                <span>
                  <span className="block text-[13px] font-bold leading-5">{q.t}</span>
                  <span className={cn('block text-2xs', q.primary ? 'text-brand-100' : 'text-ink-500')}>{q.d}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="آخرین فعالیت‌ها"
            action={
              <Link to="/me/requests" className="text-xs font-semibold text-brand-700 hover:underline">
                همه درخواست‌ها
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState compact icon={Inbox} title="هنوز درخواستی ثبت نکرده‌اید" action={<ButtonLink to="/me/requests/new" size="sm" icon={Plus}>ثبت درخواست</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recent.map((r) => {
                const t = requestType(db, r.typeId)!
                const Icon = iconFor(t.icon)
                return (
                  <li key={r.id}>
                    <Link to={`/me/requests/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-ink-25">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{t.title}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {requestSummary(r) || '—'}، {formatRelative(r.updatedAt)}
                        </span>
                      </span>
                      <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {drafts.length ? (
            <Link to="/me/requests?status=draft" className="mt-3 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700 hover:bg-ink-100">
              <FilePen size={14} aria-hidden /> {formatNumber(drafts.length)} پیش‌نویس ذخیره‌شده دارید که هنوز ارسال نشده است.
              <ArrowLeft size={14} className="ms-auto" aria-hidden />
            </Link>
          ) : null}
        </Card>

        <div className="space-y-5">
          {/* Latest payslip */}
          <Card>
            <CardHeader title="آخرین فیش حقوقی" icon={Wallet} />
            {latest ? (
              <Link to={`/me/documents/payslips/${latest.id}`} className="block rounded-lg hover:bg-ink-25">
                <p className="text-xs text-ink-500">{formatPeriod(latest.year, latest.month)}</p>
                <p className="mt-0.5 text-xl font-extrabold tabular">{formatRial(net)}</p>
                <p className="text-2xs text-ink-500">خالص پرداختی</p>
                <div className="mt-2.5">
                  <StatusBadge size="sm" meta={latest.payment ? PAYMENT_STATUS[latest.payment.status] : PAYMENT_STATUS.unknown} />
                </div>
                {latest.payment?.status !== 'paid' ? <p className="mt-2 text-2xs leading-5 text-ink-500">صدور فیش به معنی واریز حقوق نیست؛ وضعیت پرداخت از سامانه پرداخت دریافت می‌شود.</p> : null}
              </Link>
            ) : (
              <p className="text-sm text-ink-500">هنوز فیشی صادر نشده است.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="مانده مرخصی" icon={CalendarDays} />
            <p className="text-2xl font-extrabold tabular">
              {formatNumber(emp.leaveBalanceDays)} <span className="text-sm font-medium text-ink-500">روز</span>
            </p>
            <p className="mt-1 text-xs text-ink-500">تا پایان سال {formatNumber(toJalali(new Date()).jy)} — بر اساس آخرین کارکرد ثبت‌شده</p>
            <ButtonLink to="/me/requests/new?type=leave_daily" variant="secondary" size="sm" className="mt-3">
              ثبت مرخصی
            </ButtonLink>
          </Card>
        </div>
      </div>
    </div>
  )
}
