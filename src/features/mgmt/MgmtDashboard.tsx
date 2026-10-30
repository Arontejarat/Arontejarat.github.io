import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Activity, CalendarClock, ChevronLeft, FileCheck2, FileSignature, Inbox, ListTodo, PenLine, Siren, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { BulletBar, Button, Card, CardHeader, DeadlineBadge, EmptyState, FilterBar, IconButton, PageHeader, PageState, Select, StackedBar, StatCard, StatusBadge, Tabs } from '@/components/ui'
import { useDB } from '@/mock/store'
import {
  activeParty,
  canReviewDocType,
  currentVersion,
  effectiveProjectStatus,
  employeeById,
  fullName,
  projectInScope,
  projectStaffing,
  requestType,
  scopedContracts,
  scopedDocuments,
  scopedEmployees,
  scopedRequests,
  signatureStatus,
  userById,
  validityStatus,
} from '@/mock/selectors'
import { PROJECT_STATUS, REQUEST_STATUS, TASK_PRIORITY, TASK_STATUS } from '@/config/status'
import { daysUntil, displayId, formatDate, formatDeadline, formatNumber, formatRelative } from '@/lib/format'
import { docType } from '@/config/documentTypes'
import type { TaskLink } from '@/types/domain'
import { useMgmt } from './useMgmt'
import { AssignFollowupDialog } from './AssignFollowup'

export function MgmtDashboard() {
  return <PageState variant="dashboard">{() => <Body />}</PageState>
}

function Body() {
  const db = useDB()
  const m = useMgmt()
  const [project, setProject] = useState('')
  const [counterpart, setCounterpart] = useState('')
  const [period, setPeriod] = useState('30')
  const [taskTab, setTaskTab] = useState('mine')
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [assign, setAssign] = useState<{ link: TaskLink; title: string; projectId?: string } | null>(null)

  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  const counterparts = m.isCompany
    ? [...new Set(projects.map((p) => p.orgId))].map((id) => ({ value: id, label: db.organizations.find((o) => o.id === id)?.name ?? '' }))
    : [...new Set(projects.map((p) => p.companyId))].map((id) => ({ value: id, label: db.companies.find((c) => c.id === id)?.name ?? '' }))

  const inFilter = (projectId: string | null | undefined, orgId?: string, companyId?: string) => {
    if (project && projectId !== project) return false
    if (counterpart && (m.isCompany ? orgId !== counterpart : companyId !== counterpart)) return false
    return true
  }
  const since = Date.now() - Number(period) * 86_400_000

  const data = useMemo(() => {
    const employees = scopedEmployees(db, m.scope).filter((e) => inFilter(e.projectId, e.orgId, e.companyId))
    const empIds = new Set(employees.map((e) => e.id))
    const requests = scopedRequests(db, m.scope).filter((r) => empIds.has(r.employeeId))
    const myQueue = requests.filter((r) => activeParty(r) === m.role)
    const overdueReq = myQueue.filter((r) => r.dueAt && daysUntil(r.dueAt) < 0)
    const docs = scopedDocuments(db, m.scope).filter((d) => empIds.has(d.employeeId))
    const pendingDocs = docs.filter((d) => currentVersion(d).status === 'pending' && canReviewDocType(m.role, d.typeId))
    const contracts = scopedContracts(db, m.scope).filter((c) => inFilter(c.projectId, c.orgId, c.companyId) && !['cancelled', 'superseded'].includes(c.stage))
    // "Near signature" is computed from real state + deadline, never entered manually
    const nearSign = contracts.filter((c) => signatureStatus(c) !== 'complete' && c.signDeadline && daysUntil(c.signDeadline) <= 7 && ['awaiting_worker', 'awaiting_other', 'partially_signed', 'ready_to_send'].includes(c.stage))
    const nearEnd = contracts.filter((c) => c.kind === 'project' && validityStatus(c) === 'near_end')
    const orgReview = contracts.filter((c) => c.stage === 'org_review')
    const tasks = db.tasks.filter((t) => t.scope === m.role && t.scopeId === m.entityId && inFilter(t.projectId))
    const openTasks = tasks.filter((t) => t.status !== 'done')
    const overdueTasks = openTasks.filter((t) => daysUntil(t.dueAt) < 0)
    const activity = db.audit
      .filter((a) => (m.role === 'org' ? a.orgId === m.entityId : a.companyId === m.entityId) && new Date(a.at).getTime() >= since)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8)
    const urgentNotifs = db.notifications.filter((n) => n.audience.role === m.role && n.audience.id === m.entityId && n.urgent && !n.read)
    return { employees, requests, myQueue, overdueReq, docs, pendingDocs, contracts, nearSign, nearEnd, orgReview, tasks, openTasks, overdueTasks, activity, urgentNotifs }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, m.scope, m.role, m.entityId, project, counterpart, period])

  const reqDist = (['submitted', 'in_review', 'needs_correction', 'approved', 'rejected', 'executed'] as const).map((s) => ({
    label: REQUEST_STATUS[s].label,
    value: data.requests.filter((r) => r.status === s).length,
    tone: REQUEST_STATUS[s].tone,
    to: `${m.base}/requests?status=${s}`,
  }))

  const alerts = [
    ...data.overdueReq.map((r) => ({ key: r.id, icon: Inbox, text: `${requestType(db, r.typeId)?.title}: از زمان هدف رسیدگی گذشته است`, sub: fullName(employeeById(db, r.employeeId)!), to: `${m.base}/requests/${r.id}`, link: { type: 'request' as const, id: r.id, label: r.trackingNo } })),
    ...data.nearSign.filter((c) => daysUntil(c.signDeadline!) <= 2).map((c) => ({ key: c.id, icon: PenLine, text: `مهلت امضای ${c.number} ${formatDeadline(c.signDeadline).text}`, sub: c.title, to: `${m.base}/contracts/${c.id}`, link: { type: 'contract' as const, id: c.id, label: c.number } })),
    ...data.contracts.filter((c) => validityStatus(c) === 'expired' && c.kind === 'project' && !c.terminated).map((c) => ({ key: `exp${c.id}`, icon: CalendarClock, text: `قرارداد ${c.number} منقضی شده و تعیین تکلیف نشده است`, sub: c.title, to: `${m.base}/contracts/${c.id}`, link: { type: 'contract' as const, id: c.id, label: c.number } })),
    ...data.urgentNotifs.map((n) => ({ key: n.id, icon: Siren, text: n.title, sub: n.body, to: n.link ?? `${m.base}/notifications`, link: undefined })),
  ]

  const myTasks = data.openTasks.filter((t) => t.assigneeId === m.user?.id)
  const shownTasks = (taskTab === 'mine' ? myTasks : data.openTasks).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 6)

  return (
    <>
      <PageHeader title="داشبورد عملیات" description={`${m.entityName} — آنچه امروز نیازمند اقدام است.`} />
      <FilterBar
        activeCount={[project, counterpart, period !== '30' ? period : ''].filter(Boolean).length}
        onClear={() => {
          setProject('')
          setCounterpart('')
          setPeriod('30')
        }}
      >
        <Select aria-label="پروژه" className="w-full sm:w-56" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        {counterparts.length > 1 ? <Select aria-label={m.isCompany ? 'سازمان' : 'شرکت'} className="w-full sm:w-52" value={counterpart} onChange={(e) => setCounterpart(e.target.value)} placeholder={m.isCompany ? 'همه سازمان‌ها' : 'همه شرکت‌ها'} options={counterparts} /> : null}
        <Select aria-label="بازه زمانی" className="w-full sm:w-40" value={period} onChange={(e) => setPeriod(e.target.value)} options={[{ value: '7', label: '۷ روز اخیر' }, { value: '30', label: '۳۰ روز اخیر' }, { value: '90', label: '۹۰ روز اخیر' }]} />
      </FilterBar>

      {alerts.length ? (
        <Card className="mb-5 border-s-4 border-s-red-500" padded={false}>
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
              <TriangleAlert size={18} className="text-red-600" aria-hidden />
              هشدارهای فوری
              <span className="rounded-full bg-red-50 px-2 text-xs font-bold text-red-700 ring-1 ring-red-200 tabular">{formatNumber(alerts.length)}</span>
            </h2>
            <span className="text-xs text-ink-500 max-sm:hidden">از مهلت گذشته یا نیازمند تعیین تکلیف امروز</span>
          </div>
          <ul className="grid divide-y divide-ink-100 px-4 pb-2 sm:px-5 lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
            {alerts.slice(0, showAllAlerts ? alerts.length : 6).map((a, i) => (
              <li key={a.key} className={`flex min-w-0 items-center gap-3 py-2.5 ${i >= 3 && !showAllAlerts ? 'max-lg:hidden' : ''} lg:border-b lg:border-ink-100`}>
                <a.icon size={16} className="shrink-0 text-red-600" aria-hidden />
                <Link to={a.to} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[13px] font-semibold text-ink-900">{a.text}</span>
                  <span className="block truncate text-xs text-ink-500">{a.sub}</span>
                </Link>
                {a.link && m.can('tasks.manage') ? <IconButton icon={UserPlus} size="sm" label="تعیین مسئول پیگیری" onClick={() => setAssign({ link: a.link!, title: `پیگیری: ${a.text}` })} /> : null}
              </li>
            ))}
          </ul>
          {alerts.length > 3 ? (
            <div className="border-t border-ink-100 px-4 py-2 sm:px-5">
              <Button variant="link" size="sm" onClick={() => setShowAllAlerts((v) => !v)} className={alerts.length <= 6 ? 'lg:hidden' : ''}>
                {showAllAlerts ? 'نمایش کمتر' : `نمایش همه هشدارها (${formatNumber(alerts.length)})`}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {m.can('requests.view') ? <StatCard label="درخواست منتظر تصمیم شما" value={data.myQueue.length} icon={Inbox} tone="brand" to={`${m.base}/requests?queue=mine`} hint={data.overdueReq.length ? <span className="text-red-700">{formatNumber(data.overdueReq.length)} مورد معوق</span> : undefined} /> : null}
        {m.can('documents.view') ? <StatCard label="مدرک در انتظار بررسی" value={data.pendingDocs.length} icon={FileCheck2} tone="info" to={`${m.base}/documents?status=pending`} /> : null}
        {m.can('contracts.view') ? <StatCard label="قرارداد نزدیک به مهلت امضا" value={data.nearSign.length} icon={PenLine} tone="warning" to={`${m.base}/contracts?alert=near_sign`} emphasis={data.nearSign.length > 0} /> : null}
        {m.can('contracts.view') ? (
          m.isCompany ? <StatCard label="قرارداد پروژه نزدیک به پایان" value={data.nearEnd.length} icon={CalendarClock} tone="warning" to={`${m.base}/contracts?alert=near_end`} /> : <StatCard label="قرارداد منتظر بررسی سازمان" value={data.orgReview.length} icon={FileSignature} tone="warning" to={`${m.base}/contracts?stage=org_review`} />
        ) : null}
        {m.can('tasks.view') ? <StatCard label="وظیفه معوق" value={data.overdueTasks.length} icon={ListTodo} tone="danger" to={`${m.base}/tasks?due=overdue`} /> : null}
        {m.can('workforce.view') ? <StatCard label="نیروی فعال" value={data.employees.filter((e) => e.employmentStatus === 'active').length} icon={Users} tone="success" to={`${m.base}/workforce?status=active`} /> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="صف تصمیم‌گیری"
            description="درخواست‌هایی که مرحله فعلی آن‌ها در اختیار شماست، به ترتیب مهلت"
            action={
              <Link to={`${m.base}/requests?queue=mine`} className="text-xs font-semibold text-brand-700 hover:underline">
                همه درخواست‌ها
              </Link>
            }
          />
          {data.myQueue.length === 0 ? (
            <EmptyState compact icon={Inbox} title="درخواستی منتظر تصمیم شما نیست" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {[...data.myQueue]
                .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
                .slice(0, 6)
                .map((r) => {
                  const e = employeeById(db, r.employeeId)!
                  const dl = formatDeadline(r.dueAt)
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2.5">
                      <Link to={`${m.base}/requests/${r.id}`} className="min-w-0 flex-1 hover:underline">
                        <span className="block text-sm font-semibold">{requestType(db, r.typeId)?.title}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {r.confidential ? 'درخواست محرمانه' : fullName(e)}، {db.projects.find((p) => p.id === e.projectId)?.name ?? '—'}
                        </span>
                      </Link>
                      <DeadlineBadge d={dl}>
                        {dl.text}
                      </DeadlineBadge>
                      <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" className="max-sm:hidden" />
                      {m.can('tasks.manage') ? <IconButton icon={UserPlus} size="sm" label="تعیین مسئول پیگیری" onClick={() => setAssign({ link: { type: 'request', id: r.id, label: r.trackingNo }, title: `پیگیری درخواست ${r.trackingNo}` })} /> : null}
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="وضعیت درخواست‌ها" description="همه درخواست‌های مرتبط با مجموعه" />
          <StackedBar segments={reqDist} />
          {m.isCompany ? null : (
            <div className="mt-6 border-t border-ink-100 pt-4">
              <p className="mb-3 text-sm font-bold">مدارک نیروها</p>
              <StackedBar
                segments={[
                  { label: 'تأییدشده', value: data.docs.filter((d) => currentVersion(d).status === 'approved').length, tone: 'success' },
                  { label: 'در انتظار بررسی', value: data.docs.filter((d) => currentVersion(d).status === 'pending').length, tone: 'brand', to: `${m.base}/documents?status=pending` },
                  { label: 'نیازمند اصلاح / رد', value: data.docs.filter((d) => ['needs_fix', 'rejected'].includes(currentVersion(d).status)).length, tone: 'warning', to: `${m.base}/documents?status=needs_fix` },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {m.can('tasks.view') ? (
          <Card>
            <CardHeader title="وظایف" action={<Link to={`${m.base}/tasks`} className="text-xs font-semibold text-brand-700 hover:underline">همه</Link>} />
            <Tabs variant="pills" value={taskTab} onChange={setTaskTab} tabs={[{ id: 'mine', label: 'کارهای من', count: myTasks.length }, { id: 'all', label: 'کل مجموعه', count: data.openTasks.length }]} className="mb-3" />
            {shownTasks.length === 0 ? (
              <EmptyState compact icon={ListTodo} title="وظیفه بازی وجود ندارد" />
            ) : (
              <ul className="space-y-2">
                {shownTasks.map((t) => {
                  const dl = formatDeadline(t.dueAt)
                  return (
                    <li key={t.id}>
                      <Link to={`${m.base}/tasks?task=${t.id}`} className="block rounded-lg border border-ink-200 p-2.5 hover:border-ink-300">
                        <span className="block text-[13px] font-semibold leading-5">{t.title}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge meta={TASK_STATUS[t.status]} size="sm" />
                          <StatusBadge meta={TASK_PRIORITY[t.priority]} size="sm" />
                          <DeadlineBadge d={dl}>
                            {dl.text}
                          </DeadlineBadge>
                          {taskTab === 'all' ? <span className="text-2xs text-ink-500">{userById(db, t.assigneeId)?.name}</span> : null}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        ) : null}

        {m.isCompany ? (
          <Card>
            <CardHeader title="تأمین و استقرار نیرو" description="نیروی تخصیص‌یافته در برابر نیاز پروژه" action={<Link to={`${m.base}/projects`} className="text-xs font-semibold text-brand-700 hover:underline">پروژه‌ها</Link>} />
            <div className="space-y-4">
              {projects
                .filter((p) => p.status !== 'closed' && (!project || p.id === project))
                .map((p) => {
                  const s = projectStaffing(db, p)
                  const eff = effectiveProjectStatus(db, p)
                  return <BulletBar key={p.id} to={`${m.base}/projects/${p.id}`} label={p.name} actual={s.allocated} target={s.required} extra={<span className="inline-flex items-center gap-1.5">{PROJECT_STATUS[eff.status].label}{eff.reason ? ` — ${eff.reason}` : ''}</span>} />
                })}
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="قراردادهای نیازمند اقدام" action={<Link to={`${m.base}/contracts`} className="text-xs font-semibold text-brand-700 hover:underline">همه</Link>} />
            {[...data.orgReview, ...data.nearSign].length === 0 ? (
              <EmptyState compact icon={FileSignature} title="موردی وجود ندارد" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {[...data.orgReview, ...data.nearSign.filter((c) => c.kind === 'project')].slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link to={`${m.base}/contracts/${c.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:underline">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{c.title}</span>
                        <span className="block text-2xs text-ink-500">{c.signDeadline ? `مهلت ${formatDate(c.signDeadline)}` : c.number}</span>
                      </span>
                      <ChevronLeft size={16} className="shrink-0 text-ink-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <CardHeader title="فعالیت‌های اخیر" icon={Activity} action={m.can('activity.view') ? <Link to={`${m.base}/activity`} className="text-xs font-semibold text-brand-700 hover:underline">تاریخچه</Link> : null} />
          {data.activity.length === 0 ? (
            <EmptyState compact icon={Activity} title="فعالیتی در این بازه ثبت نشده" />
          ) : (
            <ul className="space-y-3">
              {data.activity.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-[13px]">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.result === 'success' ? 'bg-brand-500' : 'bg-red-500'}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="font-semibold">{a.action}</span> — {displayId(a.entity.label)}
                    <span className="block text-2xs text-ink-500">
                      {a.actor}، {formatRelative(a.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {m.can('documents.review') && data.pendingDocs.length ? (
        <Card className="mt-5">
          <CardHeader title="مدارک در انتظار بررسی شما" action={<Link to={`${m.base}/documents?status=pending`} className="text-xs font-semibold text-brand-700 hover:underline">بررسی مدارک</Link>} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.pendingDocs.slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link to={`${m.base}/documents?doc=${d.id}`} className="block rounded-lg border border-ink-200 p-2.5 hover:border-ink-300">
                  <span className="block text-[13px] font-semibold">{docType(d.typeId)?.title}</span>
                  <span className="block text-xs text-ink-500">
                    {fullName(employeeById(db, d.employeeId)!)}، {formatRelative(currentVersion(d).uploadedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {assign ? <AssignFollowupDialog open onClose={() => setAssign(null)} link={assign.link} defaultTitle={assign.title} projectId={assign.projectId} /> : null}
    </>
  )
}
