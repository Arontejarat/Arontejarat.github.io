import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Bot, CalendarDays, Columns3, Link2, List, ListTodo, Plus, Repeat, SearchX, Send, Workflow, UserRound } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Checkbox,
  DataTable,
  DatePicker,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Input,
  PageHeader,
  PageState,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Timeline,
  useToast,
  type Column,
  DeadlineBadge,
} from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { projectById, projectInScope, userById } from '@/mock/selectors'
import { TASK_KIND, TASK_PRIORITY, TASK_STATUS } from '@/config/status'
import { daysUntil, formatDate, formatDeadline, formatRelative, toFaDigits } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import { cn } from '@/lib/cn'
import type { Task, TaskLink, TaskPriority, TaskStatus } from '@/types/domain'
import { useMgmt } from './useMgmt'
import { MonthCalendar } from './MonthCalendar'

export function linkPath(base: string, l: TaskLink) {
  switch (l.type) {
    case 'contract':
      return `${base}/contracts/${l.id}`
    case 'request':
      return `${base}/requests/${l.id}`
    case 'document':
      return `${base}/documents?doc=${l.id}`
    case 'project':
      return `${base}/projects/${l.id}`
    case 'employee':
      return `${base}/workforce/${l.id}`
    case 'import':
      return `${base}/import`
  }
}

export function TasksPage() {
  const m = useMgmt()
  const [create, setCreate] = useState(false)
  return (
    <>
      <PageHeader
        title="وظایف و تسک‌ها"
        description="وظایف دستی، خودکار و سیستمی در یک‌جا. وظایف خودکار به رکورد اصلی متصل‌اند و با رفع علت به‌صورت خودکار بسته می‌شوند."
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'وظایف' }]}
        actions={m.can('tasks.manage') ? <Button icon={Plus} onClick={() => setCreate(true)}>وظیفه جدید</Button> : null}
      />
      <PageState>{({ empty }) => <Board empty={empty} />}</PageState>
      {create ? <CreateTaskDialog onClose={() => setCreate(false)} /> : null}
    </>
  )
}

function Board({ empty }: { empty: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('kanban')
  const [q, setQ] = useState('')
  const [project, setProject] = useState(params.get('project') ?? '')
  const [assignee, setAssignee] = useState(m.can('tasks.manage') ? '' : m.user?.id ?? '')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [due, setDue] = useState(params.get('due') ?? '')
  const [kind, setKind] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const openId = params.get('task')
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('task', id)
    else p.delete('task')
    setParams(p, { replace: true })
  }
  // Executive users only see items assigned to them
  const restricted = !m.can('tasks.manage')
  const all = empty ? [] : db.tasks.filter((t) => t.scope === m.role && t.scopeId === m.entityId && (!t.projectId || projectInScope(m.scope, db.projects.find((p) => p.id === t.projectId)!)) && (!restricted || t.assigneeId === m.user?.id))
  const rows = useMemo(
    () =>
      all.filter(
        (t) =>
          (!q || t.title.includes(q)) &&
          (!project || t.projectId === project) &&
          (!assignee || t.assigneeId === assignee) &&
          (!status || t.status === status) &&
          (!priority || t.priority === priority) &&
          (!kind || t.kind === kind) &&
          (!due || (t.status !== 'done' && (due === 'overdue' ? daysUntil(t.dueAt) < 0 : daysUntil(t.dueAt) >= 0 && daysUntil(t.dueAt) <= 3))),
      ),
    [all, q, project, assignee, status, priority, kind, due],
  )
  const users = db.users.filter((u) => (m.role === 'org' ? u.orgId === m.user?.orgId : u.companyId === m.user?.companyId))
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))

  const move = async (id: string, s: TaskStatus) => {
    const t = db.tasks.find((x) => x.id === id)
    if (!t || t.status === s) return
    const blockers = (t.dependsOn ?? []).map((d) => db.tasks.find((x) => x.id === d)).filter((x) => x && x.status !== 'done')
    if (s === 'done' && blockers.length) {
      toast.error('این وظیفه به وظایف دیگری وابسته است', `ابتدا «${blockers[0]!.title}» باید انجام شود.`)
      return
    }
    try {
      await actions.updateTask(id, { status: s })
    } catch (x) {
      toast.fromError(x)
    }
  }

  const columns: Column<Task>[] = [
    {
      id: 'title',
      header: 'عنوان',
      cell: (t) => (
        <div>
          <p className="font-medium">{t.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-500">
            <KindBadge t={t} />
            {t.link ? <span className="inline-flex items-center gap-1"><Link2 size={11} /> {t.link.label}</span> : null}
          </p>
        </div>
      ),
      sortValue: (t) => t.title,
    },
    { id: 'project', header: 'پروژه', cell: (t) => <span className="text-xs">{projectById(db, t.projectId)?.name ?? '—'}</span> },
    { id: 'assignee', header: 'مسئول', cell: (t) => <span className="text-xs">{userById(db, t.assigneeId)?.name}</span> },
    { id: 'priority', header: 'اولویت', cell: (t) => <StatusBadge meta={TASK_PRIORITY[t.priority]} variant="dot" />, sortValue: (t) => ['low', 'medium', 'high', 'urgent'].indexOf(t.priority) },
    { id: 'status', header: 'وضعیت', cell: (t) => <StatusBadge meta={TASK_STATUS[t.status]} size="sm" /> },
    { id: 'due', header: 'مهلت', cell: (t) => <DueBadge t={t} />, sortValue: (t) => t.dueAt },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="pills"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'kanban', label: 'برد کانبان', icon: Columns3 },
            { id: 'list', label: 'فهرست', icon: List },
            { id: 'calendar', label: 'تقویم', icon: CalendarDays },
          ]}
        />
        {restricted ? <Badge tone="neutral" icon={UserRound}>فقط وظایف واگذارشده به شما</Badge> : null}
      </div>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="جست‌وجوی عنوان وظیفه" />}
        activeCount={[project, assignee, status, priority, due, kind].filter(Boolean).length}
        onClear={() => {
          setProject('')
          setAssignee(restricted ? m.user?.id ?? '' : '')
          setStatus('')
          setPriority('')
          setDue('')
          setKind('')
        }}
      >
        <Select aria-label="پروژه" className="w-full sm:w-44" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        {!restricted ? <Select aria-label="مسئول" className="w-full sm:w-40" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="همه مسئولان" options={users.map((u) => ({ value: u.id, label: u.name }))} /> : null}
        {view !== 'kanban' ? <Select aria-label="وضعیت" className="w-full sm:w-36" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="وضعیت" options={(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS[s].label }))} /> : null}
        <Select aria-label="اولویت" className="w-full sm:w-32" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="اولویت" options={(Object.keys(TASK_PRIORITY) as TaskPriority[]).map((s) => ({ value: s, label: TASK_PRIORITY[s].label }))} />
        <Select aria-label="مهلت" className="w-full sm:w-40" value={due} onChange={(e) => setDue(e.target.value)} placeholder="همه مهلت‌ها" options={[{ value: 'overdue', label: 'معوق' }, { value: 'soon', label: 'موعد نزدیک (۳ روز)' }]} />
        <Select aria-label="نوع" className="w-full sm:w-32" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="همه انواع" options={Object.entries(TASK_KIND).map(([v, x]) => ({ value: v, label: x.label }))} />
      </FilterBar>

      {all.length === 0 ? (
        <EmptyState icon={ListTodo} title="وظیفه‌ای ثبت نشده است" description="وظایف دستی را ایجاد کنید؛ وظایف خودکار بر اساس رویدادهای سامانه ساخته می‌شوند." />
      ) : view === 'kanban' ? (
        <div className="no-scrollbar relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => {
            const col = rows.filter((t) => t.status === s).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
            return (
              <section
                key={s}
                aria-label={TASK_STATUS[s].label}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) void move(dragId, s)
                  setDragId(null)
                }}
                className={cn('w-[78vw] shrink-0 snap-start rounded-xl border border-ink-200 bg-ink-50/70 p-2.5 sm:w-72 md:w-auto', dragId && 'ring-1 ring-brand-200')}
              >
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <StatusBadge meta={TASK_STATUS[s]} />
                  <span className="text-xs font-semibold tabular text-ink-500">{toFaDigits(col.length)}</span>
                </div>
                <ul className="min-h-24 space-y-2">
                  {col.map((t) => (
                    <li key={t.id} draggable={!restricted || t.assigneeId === m.user?.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)}>
                      <TaskCard t={t} onOpen={() => setOpen(t.id)} onMove={(st) => move(t.id, st)} />
                    </li>
                  ))}
                  {col.length === 0 ? <li className="rounded-lg border border-dashed border-ink-300 px-3 py-6 text-center text-xs text-ink-400">موردی نیست</li> : null}
                </ul>
              </section>
            )
          })}
        </div>
      ) : view === 'list' ? (
        <DataTable rows={rows} columns={columns} getId={(t) => t.id} onRowClick={(t) => setOpen(t.id)} initialSort={{ id: 'due', dir: 'asc' }} caption="فهرست وظایف" mobileCard={(t) => <TaskCardContent t={t} />} empty={<EmptyState compact icon={SearchX} title="وظیفه‌ای با این فیلترها پیدا نشد" />} />
      ) : (
        <MonthCalendar events={rows.map((t) => ({ id: t.id, date: t.dueAt, title: t.title, tone: t.status === 'done' ? 'success' : daysUntil(t.dueAt) < 0 ? 'danger' : TASK_PRIORITY[t.priority].tone, onClick: () => setOpen(t.id) }))} />
      )}
      {openId ? <TaskDrawer id={openId} onClose={() => setOpen(null)} /> : null}
    </>
  )
}

function KindBadge({ t }: { t: Task }) {
  return (
    <Badge size="sm" tone={t.kind === 'manual' ? 'neutral' : t.kind === 'automatic' ? 'accent' : 'info'} icon={t.kind === 'manual' ? UserRound : t.kind === 'automatic' ? Bot : Workflow}>
      <span title={TASK_KIND[t.kind].hint}>{TASK_KIND[t.kind].label}</span>
    </Badge>
  )
}

function DueBadge({ t }: { t: Task }) {
  if (t.status === 'done') return <span className="text-xs text-ink-500">{formatDate(t.dueAt)}</span>
  const d = formatDeadline(t.dueAt)
  return <DeadlineBadge d={d}>{d.text}</DeadlineBadge>
}

function TaskCardContent({ t }: { t: Task }) {
  const db = useDB()
  const u = userById(db, t.assigneeId)
  return (
    <div>
      <p className="text-[13px] font-semibold leading-5">{t.title}</p>
      <p className="mt-1 truncate text-2xs text-ink-500">{projectById(db, t.projectId)?.name ?? 'بدون پروژه'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <KindBadge t={t} />
        <StatusBadge meta={TASK_PRIORITY[t.priority]} size="sm" />
        <DueBadge t={t} />
        {t.recurring ? <Repeat size={12} className="text-ink-400" aria-label="تکرارشونده" /> : null}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-2xs text-ink-600">
        {u ? <Avatar name={u.name} size={20} color="#13665f" /> : null}
        {u?.name}
      </div>
    </div>
  )
}

function TaskCard({ t, onOpen, onMove }: { t: Task; onOpen: () => void; onMove: (s: TaskStatus) => void }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3 shadow-xs transition hover:border-ink-300">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <TaskCardContent t={t} />
      </button>
      {/* Keyboard / touch alternative to drag-and-drop */}
      <label className="sr-only" htmlFor={`mv-${t.id}`}>
        تغییر وضعیت
      </label>
      <select id={`mv-${t.id}`} value={t.status} onChange={(e) => onMove(e.target.value as TaskStatus)} className="mt-2 w-full rounded-md border border-ink-200 bg-ink-25 px-2 py-1 text-2xs text-ink-700">
        {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => (
          <option key={s} value={s}>
            انتقال به: {TASK_STATUS[s].label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TaskDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const t = db.tasks.find((x) => x.id === id)
  const [comment, setComment] = useState('')
  if (!t) return null
  const users = db.users.filter((u) => u.status === 'active' && (m.role === 'org' ? u.orgId === m.user?.orgId : u.companyId === m.user?.companyId))
  const canEdit = m.can('tasks.manage') || t.assigneeId === m.user?.id
  const deps = (t.dependsOn ?? []).map((d) => db.tasks.find((x) => x.id === d)).filter(Boolean) as Task[]
  const update = async (c: Partial<Task>, msg?: string) => {
    if (c.status === 'done' && deps.some((d) => d.status !== 'done')) {
      toast.error('این وظیفه به وظایف دیگری وابسته است', 'ابتدا وظایف پیش‌نیاز را انجام دهید.')
      return
    }
    try {
      await actions.updateTask(t.id, c)
      if (msg) toast.success(msg)
    } catch (x) {
      toast.fromError(x)
    }
  }
  return (
    <Drawer open onClose={onClose} width="lg" title={t.title} description={projectById(db, t.projectId)?.name}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge t={t} />
          <StatusBadge meta={TASK_STATUS[t.status]} />
          <StatusBadge meta={TASK_PRIORITY[t.priority]} />
          {t.recurring ? <Badge size="sm" tone="neutral" icon={Repeat}>{t.recurring === 'weekly' ? 'هفتگی' : 'ماهانه'}</Badge> : null}
          {t.closedAutomatically ? <Badge size="sm" tone="success">بسته‌شده خودکار</Badge> : null}
        </div>
        <p className="text-xs text-ink-500">{TASK_KIND[t.kind].hint}</p>
        {t.description ? <p className="text-sm leading-7 text-ink-700">{t.description}</p> : null}
        {t.link ? (
          <Link to={linkPath(m.base, t.link)} className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2.5 text-sm font-medium text-brand-800 hover:bg-brand-50">
            <Link2 size={16} aria-hidden /> رکورد مرتبط: {t.link.label}
          </Link>
        ) : null}
        {deps.length ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-600">وابسته به</p>
            <ul className="space-y-1">
              {deps.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md bg-ink-50 px-2.5 py-1.5 text-xs">
                  {d.title}
                  <StatusBadge meta={TASK_STATUS[d.status]} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="وضعیت">
            {(p) => <Select id={p.id} disabled={!canEdit} value={t.status} onChange={(e) => update({ status: e.target.value as TaskStatus }, 'وضعیت تغییر کرد')} options={(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS[s].label }))} />}
          </Field>
          <Field label="اولویت">
            {(p) => <Select id={p.id} disabled={!m.can('tasks.manage')} value={t.priority} onChange={(e) => update({ priority: e.target.value as TaskPriority })} options={(Object.keys(TASK_PRIORITY) as TaskPriority[]).map((s) => ({ value: s, label: TASK_PRIORITY[s].label }))} />}
          </Field>
          <Field label="مسئول (ارجاع)" helper="ارجاع به همکار دیگر در تاریخچه ثبت می‌شود.">
            {(p) => <Select id={p.id} disabled={!canEdit} value={t.assigneeId} onChange={(e) => update({ assigneeId: e.target.value }, 'وظیفه ارجاع شد')} options={users.map((u) => ({ value: u.id, label: u.name }))} />}
          </Field>
          <Field label="مهلت">
            {(p) => <DatePicker id={p.id} disabled={!m.can('tasks.manage')} value={t.dueAt.slice(0, 10)} onChange={(d) => d && update({ dueAt: d })} clearable={false} />}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">نظرها</p>
          {t.comments.length === 0 ? <p className="text-xs text-ink-500">نظری ثبت نشده است.</p> : null}
          <ul className="space-y-2">
            {t.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-ink-50 px-3 py-2">
                <p className="text-2xs font-semibold text-ink-500">
                  {c.author}، {formatRelative(c.at)}
                </p>
                <p className="text-sm">{c.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input aria-label="نظر جدید" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="نوشتن نظر…" onKeyDown={async (e) => { if (e.key === 'Enter' && comment.trim()) { await actions.addTaskComment(t.id, comment.trim()); setComment('') } }} />
            <Button
              icon={Send}
              disabled={!comment.trim()}
              onClick={async () => {
                try {
                  await actions.addTaskComment(t.id, comment.trim())
                  setComment('')
                } catch (x) {
                  toast.fromError(x)
                }
              }}
            >
              ثبت
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">تاریخچه تغییرات</p>
          <Timeline items={[...t.history].reverse().map((h) => ({ id: h.id, icon: ListTodo, tone: 'neutral', title: h.text, time: formatDate(h.at, 'datetime'), body: h.actor }))} />
        </div>
      </div>
    </Drawer>
  )
}

function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const users = db.users.filter((u) => u.status === 'active' && (m.role === 'org' ? u.orgId === m.user?.orgId : u.companyId === m.user?.companyId))
  const projects = db.projects.filter((p) => projectInScope(m.scope, p) && p.status !== 'closed')
  const [v, setV] = useState({ title: '', description: '', projectId: '', assigneeId: m.user?.id ?? '', dueAt: toISODate(new Date(Date.now() + 3 * 86_400_000)), priority: 'medium' as TaskPriority, recurring: '' as '' | 'weekly' | 'monthly' })
  const [deps, setDeps] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = db.tasks.filter((t) => t.scope === m.role && t.scopeId === m.entityId && t.status !== 'done' && (!v.projectId || t.projectId === v.projectId))
  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      size="lg"
      title="ایجاد وظیفه دستی"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              if (!v.title.trim()) return setErr('عنوان وظیفه را وارد کنید.')
              setBusy(true)
              try {
                await actions.createTask({ ...v, projectId: v.projectId || undefined, recurring: v.recurring || undefined, dependsOn: [...deps], scope: m.role, scopeId: m.entityId })
                toast.success('وظیفه ایجاد شد')
                onClose()
              } catch (x) {
                toast.fromError(x)
              } finally {
                setBusy(false)
              }
            }}
          >
            ایجاد وظیفه
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="عنوان" required error={err} className="sm:col-span-2">
          {(p) => <Input id={p.id} invalid={p.invalid} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}
        </Field>
        <Field label="شرح" optionalLabel className="sm:col-span-2">
          {(p) => <Textarea id={p.id} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="min-h-20" />}
        </Field>
        <Field label="پروژه" optionalLabel>
          {(p) => <Select id={p.id} value={v.projectId} onChange={(e) => setV({ ...v, projectId: e.target.value })} placeholder="بدون پروژه" options={projects.map((x) => ({ value: x.id, label: x.name }))} />}
        </Field>
        <Field label="مسئول" required>
          {(p) => <Select id={p.id} value={v.assigneeId} onChange={(e) => setV({ ...v, assigneeId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} />}
        </Field>
        <Field label="مهلت" required>
          {(p) => <DatePicker id={p.id} value={v.dueAt} onChange={(d) => setV({ ...v, dueAt: d })} min={toISODate(new Date())} clearable={false} />}
        </Field>
        <Field label="اولویت">
          {(p) => <Select id={p.id} value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TaskPriority })} options={(Object.keys(TASK_PRIORITY) as TaskPriority[]).map((s) => ({ value: s, label: TASK_PRIORITY[s].label }))} />}
        </Field>
        <Field label="تکرار دوره‌ای" optionalLabel>
          {(p) => <Select id={p.id} value={v.recurring} onChange={(e) => setV({ ...v, recurring: e.target.value as typeof v.recurring })} placeholder="بدون تکرار" options={[{ value: 'weekly', label: 'هفتگی' }, { value: 'monthly', label: 'ماهانه' }]} />}
        </Field>
        {candidates.length ? (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">وابسته به وظایف (پیش‌نیاز)</p>
            <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2">
              {candidates.map((c) => (
                <Checkbox
                  key={c.id}
                  checked={deps.has(c.id)}
                  onChange={(on) => {
                    const n = new Set(deps)
                    if (on) n.add(c.id)
                    else n.delete(c.id)
                    setDeps(n)
                  }}
                  label={c.title}
                />
              ))}
            </div>
          </div>
        ) : null}
        <Callout tone="neutral" className="sm:col-span-2">
          وظایف خودکار (مثلاً پیگیری امضا یا رفع نقص مدرک) را سامانه بر اساس رویدادها می‌سازد؛ نیازی به ایجاد دستی آن‌ها نیست.
        </Callout>
      </div>
    </Dialog>
  )
}
