import { useMemo, useState } from 'react'
import { Download, Info } from 'lucide-react'
import { BarList, BulletBar, Button, Callout, Card, CardHeader, PageHeader, PageState, Select, StackedBar, Tabs, useToast } from '@/components/ui'
import { useDB } from '@/mock/store'
import {
  activeParty,
  currentVersion,
  effectiveProjectStatus,
  fullName,
  orgById,
  companyById,
  projectById,
  projectInScope,
  projectStaffing,
  projectTasks,
  requestType,
  scopedContracts,
  scopedDocuments,
  scopedEmployees,
  scopedRequests,
  signatureStatus,
  taskProgress,
  userById,
  validityStatus,
  workerDocSummary,
} from '@/mock/selectors'
import { PROJECT_STATUS, REQUEST_STATUS, WORKER_DOC_SUMMARY } from '@/config/status'
import { daysUntil, formatDate, formatNumber, toFaDigits } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import { useMgmt } from './useMgmt'
import { downloadCsv } from './Workforce'

export function ReportsPage() {
  const m = useMgmt()
  return (
    <>
      <PageHeader title={m.isCompany ? 'گزارش‌های اجرایی و عملکردی' : 'گزارش‌های سازمانی'} description="همه گزارش‌ها از داده‌های واقعی بخش‌های مختلف محاسبه می‌شوند و قابل دریافت به‌صورت فایل هستند." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'گزارش‌ها' }]} />
      <PageState variant="dashboard">{() => <Body />}</PageState>
    </>
  )
}

function Body() {
  const db = useDB()
  const m = useMgmt()
  const toast = useToast()
  const [tab, setTab] = useState(m.isCompany ? 'company' : 'org')
  const [project, setProject] = useState('')
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  const d = useMemo(() => {
    const emps = scopedEmployees(db, m.scope).filter((e) => !project || e.projectId === project)
    const ids = new Set(emps.map((e) => e.id))
    const reqs = scopedRequests(db, m.scope).filter((r) => ids.has(r.employeeId))
    const docs = scopedDocuments(db, m.scope).filter((x) => ids.has(x.employeeId))
    const contracts = scopedContracts(db, m.scope).filter((c) => (!project || c.projectId === project) && !['superseded', 'cancelled'].includes(c.stage))
    const tasks = db.tasks.filter((t) => t.scope === m.role && t.scopeId === m.entityId && (!project || t.projectId === project))
    const reviewed = docs.flatMap((x) => x.versions).filter((v) => v.reviewedAt)
    const avgReview = reviewed.length ? reviewed.reduce((a, v) => a + (new Date(v.reviewedAt!).getTime() - new Date(v.uploadedAt).getTime()), 0) / reviewed.length / 86_400_000 : 0
    return { emps, reqs, docs, contracts, tasks, avgReview }
  }, [db, m.scope, m.role, m.entityId, project])

  const byProject = projects.map((p) => ({ label: p.name, value: d.emps.filter((e) => e.projectId === p.id && e.employmentStatus !== 'terminated').length })).filter((x) => x.value > 0)
  const reqSegments = (['submitted', 'in_review', 'needs_correction', 'approved', 'executed', 'rejected', 'cancelled'] as const).map((s) => ({ label: REQUEST_STATUS[s].label, value: d.reqs.filter((r) => r.status === s).length, tone: REQUEST_STATUS[s].tone }))
  const overdueReq = d.reqs.filter((r) => r.dueAt && daysUntil(r.dueAt) < 0 && ['submitted', 'in_review'].includes(r.status))
  const byType = Object.entries(d.reqs.reduce<Record<string, number>>((a, r) => ({ ...a, [r.typeId]: (a[r.typeId] ?? 0) + 1 }), {}))
    .map(([k, v]) => ({ label: requestType(db, k)?.title ?? k, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const docSeg = (['complete', 'pending', 'incomplete'] as const).map((s) => ({ label: WORKER_DOC_SUMMARY[s].label, value: d.emps.filter((e) => workerDocSummary(db, e) === s).length, tone: WORKER_DOC_SUMMARY[s].tone }))
  const nearSign = d.contracts.filter((c) => c.signDeadline && signatureStatus(c) !== 'complete' && daysUntil(c.signDeadline) <= 7 && ['awaiting_worker', 'awaiting_other', 'partially_signed', 'ready_to_send'].includes(c.stage))
  const nearEnd = d.contracts.filter((c) => validityStatus(c) === 'near_end' && c.kind === 'project')
  const movements = d.emps
    .flatMap((e) => e.assignments.map((a) => ({ e, a })))
    .filter(({ a }) => daysUntil(a.from) >= -90 || (a.to && daysUntil(a.to) >= -90))
    .sort((x, y) => (y.a.to ?? y.a.from).localeCompare(x.a.to ?? x.a.from))
    .slice(0, 10)
  const openTasks = d.tasks.filter((t) => t.status !== 'done')
  const lateTasks = openTasks.filter((t) => daysUntil(t.dueAt) < 0)
  const avgDelay = lateTasks.length ? lateTasks.reduce((a, t) => a - daysUntil(t.dueAt), 0) / lateTasks.length : 0
  const people = [...new Set(d.tasks.map((t) => t.assigneeId))].map((uid) => {
    const ts = d.tasks.filter((t) => t.assigneeId === uid)
    const late = ts.filter((t) => t.status !== 'done' && daysUntil(t.dueAt) < 0)
    const resolved = d.reqs.filter((r) => r.history.some((h) => h.actor === userById(db, uid)?.name && ['approved', 'rejected', 'returned', 'step_approved'].includes(h.kind)))
    return { name: userById(db, uid)?.name ?? '—', total: ts.length, done: ts.filter((t) => t.status === 'done').length, open: ts.filter((t) => t.status !== 'done').length, late: late.length, maxDelay: late.reduce((a, t) => Math.max(a, -daysUntil(t.dueAt)), 0), decisions: resolved.length, auto: ts.filter((t) => t.kind !== 'manual').length }
  })
  const changes = d.emps.flatMap((e) => e.changeLog.map((c) => ({ e, c }))).sort((a, b) => b.c.at.localeCompare(a.c.at)).slice(0, 10)

  const exportAll = () => {
    downloadCsv(`report-${toISODate(new Date())}.csv`, ['شاخص', 'مقدار'], [
      ['نیروهای فعال', d.emps.filter((e) => e.employmentStatus === 'active').length],
      ['درخواست‌های باز', d.reqs.filter((r) => ['submitted', 'in_review', 'needs_correction'].includes(r.status)).length],
      ['درخواست‌های تأییدشده', d.reqs.filter((r) => r.status === 'approved').length],
      ['درخواست‌های اجراشده', d.reqs.filter((r) => r.status === 'executed').length],
      ['درخواست‌های ردشده', d.reqs.filter((r) => r.status === 'rejected').length],
      ['درخواست‌های معوق', overdueReq.length],
      ['میانگین زمان بررسی مدارک (روز)', Math.round(d.avgReview * 10) / 10],
      ['قراردادهای نزدیک به مهلت امضا', nearSign.length],
      ['قراردادهای نزدیک به پایان', nearEnd.length],
      ['وظایف باز', openTasks.length],
      ['وظایف معوق', lateTasks.length],
      ...people.map((p) => [`وظایف ${p.name} (کل/انجام/معوق)`, `${p.total}/${p.done}/${p.late}`] as [string, string]),
    ])
    toast.success('گزارش دریافت شد')
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="pills" value={tab} onChange={setTab} tabs={[{ id: m.isCompany ? 'company' : 'org', label: m.isCompany ? 'گزارش‌های ویژه شرکت' : 'گزارش‌های ویژه سازمان' }, { id: 'shared', label: 'گزارش‌های مشترک' }]} />
        <div className="flex gap-2">
          <Select aria-label="پروژه" className="w-52" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
          <Button variant="outline" icon={Download} onClick={exportAll}>
            دریافت گزارش
          </Button>
        </div>
      </div>

      {tab === 'company' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="ظرفیت تأمین در برابر نیاز پروژه" description="نیروی تخصیص‌یافته / نیاز تعریف‌شده" />
            <div className="space-y-4">
              {projects
                .filter((p) => p.status !== 'closed' && (!project || p.id === project))
                .map((p) => {
                  const s = projectStaffing(db, p)
                  return <BulletBar key={p.id} label={p.name} actual={s.allocated} target={s.required} extra={s.allocated < s.required ? `کمبود ${toFaDigits(s.required - s.allocated)} نفر` : 'بدون کمبود'} />
                })}
            </div>
          </Card>
          <Card>
            <CardHeader title="کمبود نیرو به تفکیک سمت" />
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-500">
                <tr>
                  <th className="py-2 text-start font-semibold">پروژه / سمت</th>
                  <th className="py-2 text-end font-semibold">نیاز</th>
                  <th className="py-2 text-end font-semibold">تخصیص</th>
                  <th className="py-2 text-end font-semibold">کمبود</th>
                </tr>
              </thead>
              <tbody>
                {projects
                  .filter((p) => p.status !== 'closed' && (!project || p.id === project))
                  .flatMap((p) =>
                    p.demand.map((dm) => {
                      const al = db.employees.filter((e) => e.projectId === p.id && e.jobTitle === dm.title && e.employmentStatus !== 'terminated').length
                      return (
                        <tr key={p.id + dm.title} className="border-t border-ink-100">
                          <td className="py-2">
                            {dm.title}
                            <span className="block text-2xs text-ink-500">{p.name}</span>
                          </td>
                          <td className="py-2 text-end tabular">{formatNumber(dm.required)}</td>
                          <td className="py-2 text-end tabular">{formatNumber(al)}</td>
                          <td className={`py-2 text-end font-semibold tabular ${al < dm.required ? 'text-amber-700' : 'text-emerald-700'}`}>{formatNumber(Math.max(0, dm.required - al))}</td>
                        </tr>
                      )
                    }),
                  )}
              </tbody>
            </table>
          </Card>
          <Card>
            <CardHeader title="پیشرفت پروژه‌ها و وظایف" />
            <ul className="space-y-3">
              {projects
                .filter((p) => !project || p.id === project)
                .map((p) => {
                  const ts = projectTasks(db, p.id)
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-2xs text-ink-500">{PROJECT_STATUS[effectiveProjectStatus(db, p).status].label}</span>
                      </span>
                      <span className="w-40 shrink-0">
                        <span className="mb-1 flex justify-between text-2xs text-ink-500">
                          <span>{toFaDigits(ts.filter((t) => t.status === 'done').length)}/{toFaDigits(ts.length)}</span>
                          <span>{formatNumber(Math.round(taskProgress(ts)))}٪</span>
                        </span>
                        <span className="block h-2 overflow-hidden rounded-full bg-ink-100">
                          <span className="block h-full rounded-full bg-accent-600" style={{ width: `${taskProgress(ts)}%` }} />
                        </span>
                      </span>
                    </li>
                  )
                })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="قراردادهای نیازمند تمدید یا تکمیل امضا" />
            <ul className="divide-y divide-ink-100 text-sm">
              {[...nearEnd.map((c) => ({ c, why: `پایان ${formatDate(c.endDate)}` })), ...nearSign.map((c) => ({ c, why: `مهلت امضا ${formatDate(c.signDeadline)}` }))].slice(0, 10).map(({ c, why }) => (
                <li key={c.id + why} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{c.employeeId ? fullName(db.employees.find((e) => e.id === c.employeeId)!) : c.title}</span>
                  <span className="shrink-0 text-xs text-ink-500">{why}</span>
                </li>
              ))}
              {nearEnd.length + nearSign.length === 0 ? <li className="py-4 text-center text-ink-500">موردی وجود ندارد.</li> : null}
            </ul>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="عملکرد مسئولان" description="تعداد وظایف، تأخیر و تصمیم‌های ثبت‌شده هر مسئول" />
            <Callout tone="info" icon={Info} className="mb-4">
              عملکرد نباید فقط با تعداد تسک‌های بسته‌شده سنجیده شود. زمان رسیدگی، میزان تأخیر، کیفیت انجام و نوع وظیفه (دستی یا خودکار) را نیز در تفسیر در نظر بگیرید.
            </Callout>
            <div className="scrollbar-thin relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs text-ink-500">
                  <tr>
                    {['مسئول', 'کل وظایف', 'انجام‌شده', 'باز', 'معوق', 'بیشترین تأخیر', 'وظایف خودکار/سیستمی', 'تصمیم درباره درخواست'].map((h) => (
                      <th key={h} className="py-2 text-start font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.name} className="border-t border-ink-100">
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 tabular">{formatNumber(p.total)}</td>
                      <td className="py-2 tabular">{formatNumber(p.done)}</td>
                      <td className="py-2 tabular">{formatNumber(p.open)}</td>
                      <td className={`py-2 tabular ${p.late ? 'font-semibold text-red-700' : ''}`}>{formatNumber(p.late)}</td>
                      <td className="py-2 tabular">{p.maxDelay ? `${formatNumber(p.maxDelay)} روز` : '—'}</td>
                      <td className="py-2 tabular">{formatNumber(p.auto)}</td>
                      <td className="py-2 tabular">{formatNumber(p.decisions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : tab === 'org' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="نیروهای فعال در محل خدمت" />
            <p className="mb-4 text-3xl font-extrabold tabular">{formatNumber(d.emps.filter((e) => e.employmentStatus === 'active').length)}</p>
            <BarList data={[...new Set(d.emps.map((e) => e.companyId))].map((cid) => ({ label: companyById(db, cid)?.name ?? '', value: d.emps.filter((e) => e.companyId === cid && e.employmentStatus === 'active').length }))} unit="نفر" />
          </Card>
          <Card>
            <CardHeader title="وضعیت مدارک نیروها" description={`میانگین زمان بررسی: ${formatNumber(Math.round(d.avgReview * 10) / 10)} روز`} />
            <StackedBar segments={docSeg} />
          </Card>
          <Card>
            <CardHeader title="درخواست‌های نیازمند تصمیم سازمان" />
            <p className="text-3xl font-extrabold tabular">{formatNumber(d.reqs.filter((r) => activeParty(r) === 'org').length)}</p>
            <p className="mt-1 text-xs text-ink-500">{formatNumber(overdueReq.filter((r) => activeParty(r) === 'org').length)} مورد از زمان هدف گذشته است.</p>
            <div className="mt-4">
              <BarList data={byType.filter((t) => d.reqs.some((r) => activeParty(r) === 'org' && requestType(db, r.typeId)?.title === t.label)).map((t) => ({ label: t.label, value: d.reqs.filter((r) => activeParty(r) === 'org' && requestType(db, r.typeId)?.title === t.label).length }))} />
            </div>
          </Card>
          <Card>
            <CardHeader title="تغییرات فهرست نیروها" />
            <ul className="divide-y divide-ink-100 text-sm">
              {changes.map(({ e, c }) => (
                <li key={c.id} className="py-2">
                  <span className="font-medium">{fullName(e)}</span> — {c.field}: {c.before || '—'} ← {c.after}
                  <span className="block text-2xs text-ink-500">
                    {c.by}، {formatDate(c.at)}
                  </span>
                </li>
              ))}
              {changes.length === 0 ? <li className="py-4 text-center text-ink-500">تغییری ثبت نشده است.</li> : null}
            </ul>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="قراردادهای مرتبط و اسناد سازمانی" />
            <div className="grid gap-5 sm:grid-cols-2">
              <StackedBar
                segments={[
                  { label: 'تکمیل امضا', value: d.contracts.filter((c) => signatureStatus(c) === 'complete').length, tone: 'success' },
                  { label: 'در انتظار امضا', value: d.contracts.filter((c) => signatureStatus(c) === 'awaiting').length, tone: 'warning' },
                  { label: 'امضای ناقص', value: d.contracts.filter((c) => signatureStatus(c) === 'partial').length, tone: 'danger' },
                  { label: 'امضانشده', value: d.contracts.filter((c) => signatureStatus(c) === 'unsigned').length, tone: 'muted' },
                ]}
              />
              <BarList data={[...new Set(db.orgFiles.filter((f) => f.owner === 'org' && f.ownerId === m.entityId).map((f) => f.docType))].map((t) => ({ label: t, value: db.orgFiles.filter((f) => f.owner === 'org' && f.ownerId === m.entityId && f.docType === t).length }))} unit="سند" />
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title={`فهرست نیروها به تفکیک پروژه${m.isCompany ? '' : ' و شرکت'}`} />
            <BarList data={byProject} unit="نفر" />
            {m.isCompany ? (
              <div className="mt-5 border-t border-ink-100 pt-4">
                <p className="mb-3 text-xs font-semibold text-ink-600">به تفکیک سازمان</p>
                <BarList data={[...new Set(d.emps.map((e) => e.orgId))].map((oid) => ({ label: orgById(db, oid)?.name ?? '', value: d.emps.filter((e) => e.orgId === oid).length }))} unit="نفر" />
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="وضعیت مدارک و میانگین زمان بررسی" description={`میانگین زمان بررسی هر نسخه: ${formatNumber(Math.round(d.avgReview * 10) / 10)} روز`} />
            <StackedBar segments={docSeg} />
            <p className="mt-4 text-xs text-ink-500">در انتظار بررسی: {formatNumber(d.docs.filter((x) => currentVersion(x).status === 'pending').length)} نسخه</p>
          </Card>
          <Card>
            <CardHeader title="درخواست‌های باز، تأییدشده، ردشده و معوق" description={`${formatNumber(overdueReq.length)} درخواست معوق`} />
            <StackedBar segments={reqSegments} />
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="mb-3 text-xs font-semibold text-ink-600">پرتکرارترین انواع درخواست</p>
              <BarList data={byType} />
            </div>
          </Card>
          <Card>
            <CardHeader title="وضعیت قراردادها" />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['نزدیک به مهلت امضا', nearSign.length],
                ['نزدیک به پایان', nearEnd.length],
                ['تکمیل‌شده', d.contracts.filter((c) => c.stage === 'completed').length],
                ['منقضی', d.contracts.filter((c) => validityStatus(c) === 'expired').length],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-ink-50 p-3">
                  <dt className="text-xs text-ink-500">{k}</dt>
                  <dd className="text-xl font-bold tabular">{formatNumber(Number(v))}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="تاریخچه ورود و خروج نیروها از پروژه (۹۰ روز اخیر)" />
            <ul className="divide-y divide-ink-100 text-sm">
              {movements.map(({ e, a }) => (
                <li key={a.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {fullName(e)} <span className="text-ink-500">— {projectById(db, a.projectId)?.name}</span>
                  </span>
                  <span className={`shrink-0 text-xs ${a.to ? 'text-amber-700' : 'text-emerald-700'}`}>{a.to ? `خروج ${formatDate(a.to)}` : `ورود ${formatDate(a.from)}`}</span>
                </li>
              ))}
              {movements.length === 0 ? <li className="py-4 text-center text-ink-500">جابه‌جایی ثبت نشده است.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="وضعیت وظایف و میزان تأخیر" />
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {[
                ['وظایف باز', openTasks.length],
                ['معوق', lateTasks.length],
                ['میانگین تأخیر (روز)', Math.round(avgDelay * 10) / 10],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-ink-50 p-3">
                  <dt className="text-xs text-ink-500">{k}</dt>
                  <dd className="text-xl font-bold tabular">{formatNumber(Number(v))}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="سوابق تغییر اطلاعات و تصمیم‌های کاربران" />
            <BarList
              data={Object.entries(
                db.audit
                  .filter((a) => (m.role === 'org' ? a.orgId === m.entityId : a.companyId === m.entityId))
                  .reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.action]: (acc[a.action] ?? 0) + 1 }), {}),
              )
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value)}
            />
          </Card>
        </div>
      )}
    </>
  )
}
