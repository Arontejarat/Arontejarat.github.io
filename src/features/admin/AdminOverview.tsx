import { Link } from 'react-router'
import { Activity, Briefcase, Building2, CircleCheck, FileCheck2, Inbox, ShieldAlert, TriangleAlert, Users, UserRound } from 'lucide-react'
import { Badge, BarList, Card, CardHeader, EmptyState, PageHeader, PageState, StackedBar, StatCard } from '@/components/ui'
import { useDB } from '@/mock/store'
import { currentVersion, effectiveProjectStatus, requestType } from '@/mock/selectors'
import { PROJECT_STATUS, REQUEST_STATUS } from '@/config/status'
import { daysUntil, formatNumber, formatRelative } from '@/lib/format'
import type { ProjectStatus } from '@/types/domain'

export function AdminOverview() {
  return (
    <>
      <PageHeader title="نمای کلی سامانه" description="وضعیت پلتفرم، کاربران، ساختار سازمانی و رویدادهای امنیتی." />
      <PageState variant="dashboard">{() => <Body />}</PageState>
    </>
  )
}

function Body() {
  const db = useDB()
  const openReq = db.requests.filter((r) => ['submitted', 'in_review', 'needs_correction'].includes(r.status))
  const overdue = openReq.filter((r) => r.dueAt && daysUntil(r.dueAt) < 0)
  const pendingDocs = db.documents.filter((d) => currentVersion(d).status === 'pending')
  const failures = db.audit.filter((a) => a.result === 'failure')
  const security = db.notifications.filter((n) => n.audience.role === 'admin' && n.category === 'security')
  const byType = Object.entries(db.requests.reduce<Record<string, number>>((a, r) => ({ ...a, [r.typeId]: (a[r.typeId] ?? 0) + 1 }), {}))
    .map(([k, v]) => ({ label: requestType(db, k)?.title ?? k, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
  const projStatus = (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => ({ label: PROJECT_STATUS[s].label, value: db.projects.filter((p) => effectiveProjectStatus(db, p).status === s).length, tone: PROJECT_STATUS[s].tone }))
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="سازمان فعال" value={db.organizations.filter((o) => o.status === 'active').length} icon={Building2} to="/admin/organizations" />
        <StatCard label="شرکت تأمین نیرو" value={db.companies.filter((c) => c.status === 'active').length} icon={Briefcase} to="/admin/organizations?tab=company" />
        <StatCard label="کاربر مدیریتی فعال" value={db.users.filter((u) => u.status === 'active').length} icon={Users} to="/admin/users" hint={`${formatNumber(db.users.filter((u) => u.status === 'invited').length)} دعوت در انتظار`} />
        <StatCard label="نیروی کار" value={db.employees.length} icon={UserRound} tone="accent" />
        <StatCard label="درخواست باز" value={openReq.length} icon={Inbox} tone="warning" hint={overdue.length ? <span className="text-red-700">{formatNumber(overdue.length)} معوق</span> : undefined} to="/admin/monitoring" />
        <StatCard label="مدرک در انتظار بررسی" value={pendingDocs.length} icon={FileCheck2} tone="info" to="/admin/monitoring" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="رویدادهای امنیتی" icon={ShieldAlert} action={<Link to="/admin/audit" className="text-xs font-semibold text-brand-700 hover:underline">سوابق ممیزی</Link>} />
          {security.length === 0 && failures.length === 0 ? (
            <EmptyState compact icon={CircleCheck} title="رویداد امنیتی ثبت نشده است" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {security.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-2.5">
                  <TriangleAlert size={16} className="mt-1 shrink-0 text-red-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-ink-600">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-2xs text-ink-500">{formatRelative(n.at)}</span>
                </li>
              ))}
              {failures.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <Activity size={16} className="mt-1 shrink-0 text-amber-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.action} — ناموفق</p>
                    <p className="text-xs text-ink-600">
                      {a.actor}، {a.entity.label} {a.detail ? `· ${a.detail}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-2xs text-ink-500">{formatRelative(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="وضعیت سرویس‌ها" action={<Link to="/status" className="text-xs font-semibold text-brand-700 hover:underline">صفحه عمومی</Link>} />
          <ul className="space-y-2.5 text-sm">
            {[
              ['احراز هویت', true],
              ['درخواست‌ها و گردش کار', true],
              ['سرویس پیامک', false],
              ['ذخیره‌سازی فایل', true],
              ['اسکن بدافزار فایل‌ها', true],
            ].map(([name, ok]) => (
              <li key={String(name)} className="flex items-center justify-between">
                <span>{name}</span>
                <Badge size="sm" tone={ok ? 'success' : 'warning'} icon={ok ? CircleCheck : TriangleAlert}>
                  {ok ? 'عادی' : 'تأخیر'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="پرتکرارترین انواع درخواست" />
          <BarList data={byType} />
        </Card>
        <Card>
          <CardHeader title="وضعیت درخواست‌ها و پروژه‌ها" />
          <p className="mb-2 text-xs font-semibold text-ink-600">درخواست‌ها ({formatNumber(db.requests.length)})</p>
          <StackedBar segments={(['submitted', 'in_review', 'needs_correction', 'approved', 'executed', 'rejected'] as const).map((s) => ({ label: REQUEST_STATUS[s].label, value: db.requests.filter((r) => r.status === s).length, tone: REQUEST_STATUS[s].tone }))} />
          <div className="mt-6 border-t border-ink-100 pt-4">
            <p className="mb-2 text-xs font-semibold text-ink-600">پروژه‌ها ({formatNumber(db.projects.length)}) — وضعیت محاسبه‌شده از رویدادهای واقعی</p>
            <StackedBar segments={projStatus.filter((x) => x.value > 0)} />
          </div>
        </Card>
      </div>
    </div>
  )
}
