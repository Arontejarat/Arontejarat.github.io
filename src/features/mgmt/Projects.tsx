import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { CalendarRange, FileSignature, FolderKanban, Info, ListTodo, Plus, SearchX, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import {
  Avatar,
  BulletBar,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  DatePicker,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  FilterBar,
  IconButton,
  Input,
  Ltr,
  PageHeader,
  PageState,
  ProgressBar,
  ProgressRing,
  SearchInput,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
  DeadlineBadge,
} from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { effectiveProjectStatus, fullName, orgById, projectInScope, projectStaffing, projectTasks, signatureStatus, taskProgress, userById, validityStatus, companyById } from '@/mock/selectors'
import { CONTRACT_STAGE, EMPLOYMENT_STATUS, PROJECT_STATUS, SIGNATURE_STATUS, TASK_PRIORITY, TASK_STATUS, VALIDITY_STATUS } from '@/config/status'
import { daysUntil, formatDate, formatDeadline, formatNumber, toFaDigits } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import type { Project, ProjectStatus } from '@/types/domain'
import { useMgmt } from './useMgmt'
import { OrgFilesPanel } from './OrgFiles'

export function ProjectsPage() {
  const m = useMgmt()
  const [create, setCreate] = useState(false)
  return (
    <>
      <PageHeader
        title={m.isCompany ? 'مدیریت پروژه‌ها' : 'پروژه‌های مرتبط'}
        description="نیاز و تخصیص نیرو، وضعیت قرارداد اصلی، پیشرفت وظایف و اسناد هر پروژه."
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'پروژه‌ها' }]}
        actions={m.can('projects.manage') ? <Button icon={Plus} onClick={() => setCreate(true)}>پروژه جدید</Button> : null}
      />
      <PageState>{({ empty }) => <List empty={empty} />}</PageState>
      {create ? <CreateProjectDialog onClose={() => setCreate(false)} /> : null}
    </>
  )
}

function List({ empty }: { empty: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [org, setOrg] = useState('')
  const all = empty ? [] : db.projects.filter((p) => projectInScope(m.scope, p))
  const rows = useMemo(
    () => all.filter((p) => (!q || p.name.includes(q) || p.code.includes(q.toUpperCase())) && (!status || effectiveProjectStatus(db, p).status === status) && (!org || p.orgId === org)),
    [all, q, status, org, db],
  )
  if (all.length === 0) return <EmptyState icon={FolderKanban} title="پروژه‌ای در محدوده شما وجود ندارد" />
  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="نام یا کد پروژه" />}
        activeCount={[status, org].filter(Boolean).length}
        onClear={() => {
          setStatus('')
          setOrg('')
        }}
      >
        <Select aria-label="وضعیت" className="w-full sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))} />
        {m.isCompany ? <Select aria-label="سازمان کارفرما" className="w-full sm:w-52" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="همه سازمان‌ها" options={[...new Set(all.map((p) => p.orgId))].map((id) => ({ value: id, label: orgById(db, id)?.name ?? '' }))} /> : null}
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState compact icon={SearchX} title="پروژه‌ای پیدا نشد" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  )
}

function ProjectCard({ p }: { p: Project }) {
  const db = useDB()
  const m = useMgmt()
  const eff = effectiveProjectStatus(db, p)
  const staff = projectStaffing(db, p)
  const tasks = projectTasks(db, p.id)
  const open = tasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => daysUntil(t.dueAt) < 0)
  const main = db.contracts.find((c) => c.id === p.mainContractId)
  const manager = userById(db, p.managerId)
  return (
    <Link to={`${m.base}/projects/${p.id}`} className="group flex flex-col rounded-xl border border-ink-200/80 bg-white p-4 shadow-xs transition hover:border-ink-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xs text-ink-500">
            <Ltr>{p.code}</Ltr>، {m.isCompany ? orgById(db, p.orgId)?.name : companyById(db, p.companyId)?.name}
          </p>
          <h3 className="mt-0.5 truncate text-[15px] font-bold group-hover:text-brand-800">{p.name}</h3>
        </div>
        <StatusBadge meta={PROJECT_STATUS[eff.status]} size="sm" />
      </div>
      {eff.reason ? <p className="mt-1.5 text-xs text-amber-700">{eff.reason}</p> : null}
      <div className="mt-4">
        <BulletBar label="تأمین نیرو" actual={staff.allocated} target={staff.required} extra={`${formatNumber(staff.deployed)} نفر مستقر و فعال`} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
        <div>
          <p className="text-base font-bold tabular">{formatNumber(open.length)}</p>
          <p className="text-2xs text-ink-500">وظیفه باز</p>
        </div>
        <div>
          <p className={`text-base font-bold tabular ${overdue.length ? 'text-red-600' : ''}`}>{formatNumber(overdue.length)}</p>
          <p className="text-2xs text-ink-500">معوق</p>
        </div>
        <div>
          <p className="text-base font-bold tabular">{formatNumber(Math.round(taskProgress(tasks)))}٪</p>
          <p className="text-2xs text-ink-500">پیشرفت وظایف</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <FileSignature size={13} aria-hidden /> قرارداد اصلی: {main ? SIGNATURE_STATUS[signatureStatus(main)].label : 'ثبت نشده'}
        </span>
        <span>{manager?.name}</span>
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------------ */

export function ProjectDetailPage() {
  const { id } = useParams()
  const db = useDB()
  const m = useMgmt()
  const p = db.projects.find((x) => x.id === id)
  if (!p) return <Navigate to={`${m.base}/projects`} replace />
  if (!projectInScope(m.scope, p)) return <Navigate to="/forbidden" replace />
  return <PageState variant="detail" loadKey={p.id}>{() => <Detail id={p.id} />}</PageState>
}

function Detail({ id }: { id: string }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const p = db.projects.find((x) => x.id === id)!
  const [tab, setTab] = useState('overview')
  const [addOpen, setAddOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const eff = effectiveProjectStatus(db, p)
  const staff = projectStaffing(db, p)
  const tasks = projectTasks(db, p.id)
  const openTasks = tasks.filter((t) => t.status !== 'done')
  const main = db.contracts.find((c) => c.id === p.mainContractId)
  const workerContracts = db.contracts.filter((c) => c.projectId === p.id && c.kind === 'worker' && !['superseded', 'cancelled'].includes(c.stage))
  const awaitingSign = workerContracts.filter((c) => signatureStatus(c) !== 'complete' && ['awaiting_worker', 'awaiting_other', 'partially_signed'].includes(c.stage))
  const canManage = m.can('projects.manage')
  const manual: ProjectStatus[] = ['planning', 'preparing', 'running', 'paused', 'closed']

  return (
    <>
      <PageHeader
        title={p.name}
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'پروژه‌ها', to: `${m.base}/projects` }, { label: p.code }]}
        back={{ to: `${m.base}/projects`, label: 'پروژه‌ها' }}
        meta={
          <>
            <StatusBadge meta={PROJECT_STATUS[eff.status]} />
            <span className="text-xs text-ink-500">
              <Ltr>{p.code}</Ltr>، {orgById(db, p.orgId)?.name}
            </span>
          </>
        }
        actions={
          canManage ? (
            <Select
              aria-label="تغییر وضعیت پروژه"
              className="w-48"
              value={p.status}
              onChange={async (e) => {
                try {
                  await actions.updateProject(p.id, { status: e.target.value as ProjectStatus })
                  toast.success('وضعیت پروژه به‌روز شد')
                } catch (x) {
                  toast.fromError(x)
                }
              }}
              options={manual.map((s) => ({ value: s, label: `وضعیت: ${PROJECT_STATUS[s].label}` }))}
            />
          ) : null
        }
      />
      {eff.reason ? (
        <Callout tone="warning" icon={Info} className="mb-5" title={`وضعیت نمایش‌داده‌شده: ${PROJECT_STATUS[eff.status].label}`}>
          {eff.reason}
          {p.status !== eff.status ? ` (وضعیت ثبت‌شده: ${PROJECT_STATUS[p.status].label}). وضعیت پروژه از رویدادهای واقعی آن محاسبه می‌شود.` : ''}
        </Callout>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="نیروی تخصیص‌یافته / نیاز" value={`${formatNumber(staff.allocated)} / ${formatNumber(staff.required)}`} icon={Users} tone={staff.allocated < staff.required ? 'warning' : 'success'} />
        <StatCard label="وظیفه باز" value={openTasks.length} icon={ListTodo} tone="brand" hint={`${formatNumber(openTasks.filter((t) => daysUntil(t.dueAt) < 0).length)} معوق`} to={`${m.base}/tasks?project=${p.id}`} />
        <StatCard label="قرارداد نیرو در انتظار امضا" value={awaitingSign.length} icon={FileSignature} tone="warning" to={`${m.base}/contracts`} />
        <StatCard label="پایان پروژه" value={formatDate(p.endDate)} icon={CalendarRange} tone="neutral" hint={formatDeadline(p.endDate).text} />
      </div>

      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'نمای کلی' },
          { id: 'workers', label: 'نیروها', count: staff.workers.length },
          { id: 'tasks', label: 'وظایف', count: openTasks.length },
          { id: 'docs', label: 'اسناد و مکاتبات' },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="نیاز و تخصیص نیرو به تفکیک سمت" />
            <div className="space-y-4">
              {p.demand.map((d) => {
                const allocated = staff.workers.filter((w) => w.jobTitle === d.title).length
                return <BulletBar key={d.title} label={d.title} actual={allocated} target={d.required} extra={allocated < d.required ? `کمبود ${formatNumber(d.required - allocated)} نفر` : 'تکمیل'} />
              })}
            </div>
            <div className="mt-6 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-3">
              {(['active', 'pending_start', 'suspended'] as const).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <StatusBadge meta={EMPLOYMENT_STATUS[s]} size="sm" />
                  <span className="font-bold tabular">{formatNumber(staff.workers.filter((w) => w.employmentStatus === s).length)}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader title="قرارداد اصلی پروژه" icon={FileSignature} />
              {main ? (
                <Link to={`${m.base}/contracts/${main.id}`} className="block space-y-2 rounded-lg hover:bg-ink-25">
                  <p className="text-sm font-semibold">
                    <Ltr>{main.number}</Ltr>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge meta={CONTRACT_STAGE[main.stage]} size="sm" />
                    <StatusBadge meta={SIGNATURE_STATUS[signatureStatus(main)]} size="sm" />
                    <StatusBadge meta={VALIDITY_STATUS[validityStatus(main)]} size="sm" />
                  </div>
                  <p className="text-xs text-ink-500">
                    {formatDate(main.startDate)} تا {formatDate(main.endDate)}
                  </p>
                </Link>
              ) : (
                <p className="text-sm text-ink-500">قرارداد اصلی هنوز ثبت نشده است.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="تیم پروژه" action={canManage ? <Button size="xs" variant="ghost" onClick={() => setTeamOpen(true)}>ویرایش</Button> : null} />
              <ul className="space-y-2">
                {[p.managerId, ...p.teamIds].map((uid, i) => {
                  const u = userById(db, uid)
                  return u ? (
                    <li key={uid} className="flex items-center gap-2.5">
                      <Avatar name={u.name} size={30} color="#13665f" />
                      <span className="text-sm">
                        <span className="block font-medium">{u.name}</span>
                        <span className="block text-2xs text-ink-500">{i === 0 ? 'مدیر پروژه' : 'عضو تیم'}</span>
                      </span>
                    </li>
                  ) : null
                })}
              </ul>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <ProgressRing value={taskProgress(tasks)} tone="accent" />
                <div>
                  <p className="text-sm font-bold">پیشرفت وظایف</p>
                  <p className="text-xs text-ink-500">
                    {formatNumber(tasks.filter((t) => t.status === 'done').length)} از {formatNumber(tasks.length)} وظیفه انجام شده
                  </p>
                </div>
              </div>
            </Card>
          </div>
          <Card className="lg:col-span-3">
            <CardHeader title="شرح پروژه" />
            <DescriptionList
              columns={3}
              items={[
                { label: 'سازمان کارفرما', value: orgById(db, p.orgId)?.name },
                { label: 'شرکت تأمین‌کننده', value: companyById(db, p.companyId)?.name },
                { label: 'مدت', value: `${formatDate(p.startDate)} تا ${formatDate(p.endDate)}` },
                { label: 'شرح', value: p.description, full: true },
              ]}
            />
          </Card>
        </div>
      ) : null}

      {tab === 'workers' ? (
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-bold">نیروهای تخصیص‌یافته</p>
            {m.can('workforce.edit') ? (
              <Button size="sm" icon={UserPlus} onClick={() => setAddOpen(true)}>
                افزودن نیرو به پروژه
              </Button>
            ) : null}
          </div>
          {staff.workers.length === 0 ? (
            <EmptyState compact icon={Users} title="نیرویی به این پروژه تخصیص داده نشده است" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {staff.workers.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={fullName(w)} color={w.photoColor} size={32} />
                  <Link to={`${m.base}/workforce/${w.id}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block text-sm font-medium">{fullName(w)}</span>
                    <span className="block text-2xs text-ink-500">
                      {w.jobTitle}، از {formatDate(w.assignments.find((a) => a.projectId === p.id && !a.to)?.from ?? w.startDate)}
                    </span>
                  </Link>
                  <StatusBadge meta={EMPLOYMENT_STATUS[w.employmentStatus]} size="sm" />
                  {m.can('workforce.edit') ? <RemoveButton id={w.id} name={fullName(w)} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'tasks' ? (
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-bold">وظایف پروژه</p>
            <Link to={`${m.base}/tasks?project=${p.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
              مدیریت در برد وظایف
            </Link>
          </div>
          {tasks.length === 0 ? (
            <EmptyState compact icon={ListTodo} title="وظیفه‌ای ثبت نشده است" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {tasks.map((t) => {
                const d = formatDeadline(t.dueAt)
                return (
                  <li key={t.id}>
                    <Link to={`${m.base}/tasks?task=${t.id}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-ink-25">
                      <span className="min-w-0 flex-1 text-sm">{t.title}</span>
                      <StatusBadge meta={TASK_STATUS[t.status]} size="sm" />
                      <StatusBadge meta={TASK_PRIORITY[t.priority]} size="sm" />
                      {t.status !== 'done' ? <DeadlineBadge d={d}>{d.text}</DeadlineBadge> : null}
                      <span className="text-2xs text-ink-500">{userById(db, t.assigneeId)?.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="px-4 pb-4">
            <ProgressBar value={taskProgress(tasks)} label="پیشرفت" showValue tone="accent" className="mt-4" />
          </div>
        </Card>
      ) : null}

      {tab === 'docs' ? <ProjectDocs projectId={p.id} /> : null}

      {addOpen ? <AddToProjectDialog projectId={p.id} onClose={() => setAddOpen(false)} /> : null}
      {teamOpen ? <TeamDialog p={p} onClose={() => setTeamOpen(false)} /> : null}
    </>
  )
}

function ProjectDocs({ projectId }: { projectId: string }) {
  const db = useDB()
  const files = db.orgFiles.filter((f) => f.projectId === projectId && f.access !== 'restricted')
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="اسناد و مکاتبات پروژه" description={`${toFaDigits(files.length)} سند`} />
        {files.length === 0 ? (
          <p className="text-sm text-ink-500">سندی برای این پروژه ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="block text-2xs text-ink-500">
                    {f.docType}، {f.owner === 'org' ? 'ارسال سازمان' : 'ارسال شرکت'}، {formatDate(f.date)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <OrgFilesPanel />
    </div>
  )
}

function RemoveButton({ id, name }: { id: string; name: string }) {
  const actions = useActions()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <>
      <IconButton icon={UserMinus} label={`خروج ${name} از پروژه`} size="sm" variant="danger-ghost" onClick={() => setOpen(true)} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`خروج ${name} از پروژه`}
        tone="warning"
        icon={UserMinus}
        description="حذف از فهرست فعال پروژه با خاتمه همکاری متفاوت است و سوابق قرارداد، فیش، مدارک و درخواست‌ها حفظ می‌شود."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!note.trim()}
              onClick={async () => {
                setBusy(true)
                try {
                  await actions.removeFromProject(id, note)
                  toast.success('نیرو از پروژه خارج شد')
                  setOpen(false)
                } catch (x) {
                  toast.fromError(x)
                } finally {
                  setBusy(false)
                }
              }}
            >
              خروج از پروژه
            </Button>
          </>
        }
      >
        <Field label="علت" required>
          {(p) => <Textarea id={p.id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </Dialog>
    </>
  )
}

function AddToProjectDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const project = db.projects.find((p) => p.id === projectId)!
  const candidates = db.employees.filter((e) => e.companyId === project.companyId && e.projectId !== projectId && e.employmentStatus !== 'terminated' && (m.role === 'company' ? e.companyId === m.entityId : e.orgId === m.entityId))
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="افزودن نیرو به پروژه"
      description="نیروهای انتخاب‌شده از پروژه فعلی خود به این پروژه منتقل می‌شوند؛ سوابق قبلی حفظ می‌شود."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            loading={busy}
            disabled={sel.size === 0}
            onClick={async () => {
              setBusy(true)
              try {
                await actions.updateEmployeeFields([...sel], { projectId }, 'bulk')
                toast.success(`${toFaDigits(sel.size)} نیرو به پروژه اضافه شد`)
                onClose()
              } catch (x) {
                toast.fromError(x)
              } finally {
                setBusy(false)
              }
            }}
          >
            افزودن ({toFaDigits(sel.size)})
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <EmptyState compact icon={Users} title="نیروی قابل افزودن وجود ندارد" />
      ) : (
        <ul className="max-h-[50vh] divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-200">
          {candidates.map((e) => (
            <li key={e.id} className="px-3 py-2">
              <Checkbox
                checked={sel.has(e.id)}
                onChange={(v) => {
                  const n = new Set(sel)
                  if (v) n.add(e.id)
                  else n.delete(e.id)
                  setSel(n)
                }}
                label={fullName(e)}
                description={`${e.jobTitle}، ${db.projects.find((p) => p.id === e.projectId)?.name ?? 'خارج از پروژه'}`}
              />
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

function TeamDialog({ p, onClose }: { p: Project; onClose: () => void }) {
  const db = useDB()
  const actions = useActions()
  const toast = useToast()
  const users = db.users.filter((u) => u.companyId === p.companyId && u.status === 'active')
  const [manager, setManager] = useState(p.managerId)
  const [team, setTeam] = useState<Set<string>>(new Set(p.teamIds))
  return (
    <Dialog
      open
      onClose={onClose}
      title="مدیر پروژه و اعضای تیم"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            onClick={async () => {
              try {
                await actions.updateProject(p.id, { managerId: manager, teamIds: [...team].filter((x) => x !== manager) })
                toast.success('تیم پروژه به‌روز شد')
                onClose()
              } catch (x) {
                toast.fromError(x)
              }
            }}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="مدیر پروژه" required>
          {(f) => <Select id={f.id} value={manager} onChange={(e) => setManager(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />}
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium">اعضای تیم</p>
          <div className="space-y-1.5">
            {users
              .filter((u) => u.id !== manager)
              .map((u) => (
                <Checkbox
                  key={u.id}
                  checked={team.has(u.id)}
                  onChange={(v) => {
                    const n = new Set(team)
                    if (v) n.add(u.id)
                    else n.delete(u.id)
                    setTeam(n)
                  }}
                  label={u.name}
                />
              ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const users = db.users.filter((u) => u.companyId === m.entityId && u.status === 'active')
  const [v, setV] = useState({ name: '', code: '', orgId: db.organizations[0]?.id ?? '', managerId: m.user?.id ?? '', startDate: toISODate(new Date()), endDate: '', description: '' })
  const [demand, setDemand] = useState([{ title: '', required: 1 }])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const e: Record<string, string> = {}
    if (!v.name.trim()) e.name = 'نام پروژه را وارد کنید.'
    if (!/^[A-Z0-9-]{4,}$/.test(v.code.toUpperCase())) e.code = 'کد پروژه با حروف لاتین، عدد و خط تیره (مثلاً PRJ-1405-020).'
    if (!v.endDate) e.endDate = 'تاریخ پایان را انتخاب کنید.'
    else if (v.endDate <= v.startDate) e.endDate = 'تاریخ پایان باید بعد از شروع باشد.'
    if (demand.some((d) => !d.title.trim() || d.required < 1)) e.demand = 'برای هر سمت، عنوان و تعداد معتبر وارد کنید.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await actions.createProject({ ...v, code: v.code.toUpperCase(), companyId: m.entityId, demand })
      toast.success('پروژه ایجاد شد', 'وضعیت پروژه «برنامه‌ریزی» است تا قرارداد اصلی ثبت و امضا شود.')
      onClose()
    } catch (x) {
      toast.fromError(x)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      size="lg"
      title="ایجاد پروژه جدید"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={busy}>
            ایجاد پروژه
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام پروژه" required error={errors.name}>
          {(p) => <Input id={p.id} invalid={p.invalid} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        </Field>
        <Field label="کد پروژه" required error={errors.code}>
          {(p) => <Input id={p.id} invalid={p.invalid} ltr value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="PRJ-1405-020" />}
        </Field>
        <Field label="سازمان کارفرما" required>
          {(p) => <Select id={p.id} value={v.orgId} onChange={(e) => setV({ ...v, orgId: e.target.value })} options={db.organizations.filter((o) => o.status === 'active').map((o) => ({ value: o.id, label: o.name }))} />}
        </Field>
        <Field label="مدیر پروژه" required>
          {(p) => <Select id={p.id} value={v.managerId} onChange={(e) => setV({ ...v, managerId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} />}
        </Field>
        <Field label="تاریخ شروع" required>
          {(p) => <DatePicker id={p.id} value={v.startDate} onChange={(d) => setV({ ...v, startDate: d })} clearable={false} />}
        </Field>
        <Field label="تاریخ پایان" required error={errors.endDate}>
          {(p) => <DatePicker id={p.id} invalid={p.invalid} value={v.endDate} onChange={(d) => setV({ ...v, endDate: d })} min={v.startDate} />}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">نیروی موردنیاز به تفکیک سمت</p>
          <div className="space-y-2">
            {demand.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label="عنوان سمت" placeholder="عنوان سمت" value={d.title} onChange={(e) => setDemand(demand.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input aria-label="تعداد" ltr inputMode="numeric" className="w-24" value={String(d.required)} onChange={(e) => setDemand(demand.map((x, j) => (j === i ? { ...x, required: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} />
                <IconButton icon={Trash2} label="حذف سمت" size="sm" variant="danger-ghost" disabled={demand.length === 1} onClick={() => setDemand(demand.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
          {errors.demand ? <p className="mt-1 text-xs text-red-700">{errors.demand}</p> : null}
          <Button variant="link" size="sm" icon={Plus} className="mt-2" onClick={() => setDemand([...demand, { title: '', required: 1 }])}>
            افزودن سمت
          </Button>
        </div>
        <Field label="شرح" optionalLabel className="sm:col-span-2">
          {(p) => <Textarea id={p.id} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="min-h-20" />}
        </Field>
      </div>
    </Dialog>
  )
}
