import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { CheckCheck, CircleCheck, CircleX, Forward, Inbox, Lock, MessageSquare, NotebookPen, RotateCcw, SearchX, ShieldAlert, UserPlus } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DataTable,
  Dialog,
  DocumentPreview,
  EmptyState,
  Field,
  FilterBar,
  Ltr,
  PageHeader,
  PageState,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
  type Column,
  DeadlineBadge,
} from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { activeParty, employeeById, employeeInScope, fullName, projectById, projectInScope, requestType, scopedRequests } from '@/mock/selectors'
import { REQUEST_STATUS } from '@/config/status'
import { PARTY_LABEL, REQUEST_CATEGORIES } from '@/config/requestTypes'
import { formatDate, formatDeadline, toEnDigits, toFaDigits } from '@/lib/format'
import { daysUntil } from '@/lib/format'
import { iconFor } from '@/config/icons'
import type { EmployeeRequest, RequestStatus } from '@/types/domain'
import { AttachmentList, RequestHistory, RequestProgress, RequestValues, requestSummary } from '@/features/requests/RequestViews'
import { useMgmt } from './useMgmt'
import { AssignFollowupDialog } from './AssignFollowup'

export function RequestQueuePage() {
  const m = useMgmt()
  return (
    <>
      <PageHeader title="مرکز درخواست‌ها" description="صف رسیدگی به درخواست‌های نیروها؛ هر درخواست بر اساس گردش کار نوع خود به مرجع مسئول می‌رسد." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'مرکز درخواست‌ها' }]} />
      <PageState>{({ empty }) => <Queue empty={empty} />}</PageState>
    </>
  )
}

function Queue({ empty }: { empty: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const [params, setParams] = useSearchParams()
  const queue = params.get('queue') ?? (params.get('status') ? 'all' : 'mine')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [type, setType] = useState('')
  const [project, setProject] = useState('')
  const [overdue, setOverdue] = useState(false)
  const [q, setQ] = useState('')
  const all = empty ? [] : scopedRequests(db, m.scope)
  const mine = all.filter((r) => activeParty(r) === m.role)
  const toExecute = all.filter((r) => r.status === 'approved' && requestType(db, r.typeId)?.executionLabel && r.steps.some((s) => s.party === m.role))
  const base = queue === 'mine' ? mine : queue === 'execute' ? toExecute : all
  const rows = useMemo(() => {
    const query = toEnDigits(q.trim())
    return base
      .filter((r) => {
        const e = employeeById(db, r.employeeId)!
        const t = requestType(db, r.typeId)
        return (
          (!status || r.status === status) &&
          (!type || (type.startsWith('cat:') ? t?.category === type.slice(4) : r.typeId === type)) &&
          (!project || e.projectId === project) &&
          (!overdue || (r.dueAt && daysUntil(r.dueAt) < 0 && ['submitted', 'in_review'].includes(r.status))) &&
          (!query || r.trackingNo.includes(query) || (!r.confidential && fullName(e).includes(q.trim())))
        )
      })
      .sort((a, b) => (a.dueAt ?? 'z').localeCompare(b.dueAt ?? 'z'))
  }, [base, status, type, project, overdue, q, db])

  const columns: Column<EmployeeRequest>[] = [
    { id: 'no', header: 'شماره', cell: (r) => <Ltr className="text-xs">{toFaDigits(r.trackingNo)}</Ltr>, sortValue: (r) => r.trackingNo },
    {
      id: 'emp',
      header: 'نیروی کار',
      cell: (r) =>
        r.confidential && activeParty(r) !== m.role ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
            <Lock size={12} /> محرمانه
          </span>
        ) : (
          <span className="font-medium">{fullName(employeeById(db, r.employeeId)!)}</span>
        ),
    },
    {
      id: 'type',
      header: 'نوع درخواست',
      cell: (r) => {
        const t = requestType(db, r.typeId)!
        const Icon = iconFor(t.icon)
        return (
          <span className="flex items-center gap-2">
            <Icon size={15} className="text-ink-400" aria-hidden />
            <span>
              <span className="block text-[13px]">{t.title}</span>
              <span className="block max-w-56 truncate text-2xs text-ink-500">{r.confidential ? '' : requestSummary(r)}</span>
            </span>
          </span>
        )
      },
    },
    { id: 'project', header: 'پروژه و محل خدمت', label: 'پروژه', hideable: true, cell: (r) => <span className="text-xs">{projectById(db, employeeById(db, r.employeeId)?.projectId)?.name ?? '—'}</span> },
    { id: 'date', header: 'تاریخ ثبت', cell: (r) => <span className="text-xs">{formatDate(r.submittedAt)}</span>, sortValue: (r) => r.submittedAt ?? '' },
    {
      id: 'owner',
      header: 'مسئول فعلی',
      label: 'مسئول فعلی',
      hideable: true,
      cell: (r) => {
        const p = activeParty(r)
        return <span className="text-xs">{p ? `${PARTY_LABEL[p]} — ${r.assignee ?? r.steps[r.currentStep].label}` : r.status === 'needs_correction' ? 'نیروی کار' : r.status === 'approved' ? 'ثبت اجرا' : '—'}</span>
      },
    },
    { id: 'status', header: 'وضعیت', cell: (r) => <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" /> },
    {
      id: 'due',
      header: 'مهلت رسیدگی',
      cell: (r) => {
        if (!r.dueAt || !['submitted', 'in_review'].includes(r.status)) return <span className="text-ink-400">—</span>
        const d = formatDeadline(r.dueAt)
        return <DeadlineBadge d={d}>{d.text}</DeadlineBadge>
      },
      sortValue: (r) => r.dueAt ?? 'z',
    },
  ]

  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  return (
    <>
      <Tabs
        className="mb-4"
        value={queue}
        onChange={(v) => {
          const p = new URLSearchParams(params)
          p.set('queue', v)
          setParams(p, { replace: true })
        }}
        tabs={[
          { id: 'mine', label: 'منتظر تصمیم ما', count: mine.length },
          ...(m.can('requests.execute') ? [{ id: 'execute', label: 'آماده ثبت اجرا', count: toExecute.length }] : []),
          { id: 'all', label: 'همه درخواست‌ها', count: all.length },
        ]}
      />
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="شماره پیگیری یا نام نیرو" />}
        activeCount={[status, type, project, overdue ? '1' : ''].filter(Boolean).length}
        onClear={() => {
          setStatus('')
          setType('')
          setProject('')
          setOverdue(false)
        }}
      >
        <Select aria-label="وضعیت" className="w-full sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={(Object.keys(REQUEST_STATUS) as RequestStatus[]).filter((s) => s !== 'draft').map((s) => ({ value: s, label: REQUEST_STATUS[s].label }))} />
        <Select aria-label="نوع" className="w-full sm:w-52" value={type} onChange={(e) => setType(e.target.value)} placeholder="همه انواع" options={[...REQUEST_CATEGORIES.map((c) => ({ value: `cat:${c.id}`, label: `دسته: ${c.title}` })), ...db.requestTypes.map((t) => ({ value: t.id, label: t.title }))]} />
        <Select aria-label="پروژه" className="w-full sm:w-48" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <Select aria-label="مهلت" className="w-full sm:w-40" value={overdue ? '1' : ''} onChange={(e) => setOverdue(e.target.value === '1')} placeholder="همه مهلت‌ها" options={[{ value: '1', label: 'فقط معوق' }]} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.id}
        rowHref={(r) => `${m.base}/requests/${r.id}`}
        columnChooser
        pageSize={12}
        caption="صف درخواست‌ها"
        rowClassName={(r) => (r.dueAt && daysUntil(r.dueAt) < 0 && ['submitted', 'in_review'].includes(r.status) ? 'bg-red-50/40' : undefined)}
        mobileCard={(r) => {
          const t = requestType(db, r.typeId)!
          const d = r.dueAt && ['submitted', 'in_review'].includes(r.status) ? formatDeadline(r.dueAt) : null
          return (
            <Link to={`${m.base}/requests/${r.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-ink-500">{r.confidential ? 'محرمانه' : fullName(employeeById(db, r.employeeId)!)}</p>
                </div>
                <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-2xs text-ink-500">
                <Ltr>#{toFaDigits(r.trackingNo)}</Ltr>
                {d ? <DeadlineBadge d={d}>{d.text}</DeadlineBadge> : null}
              </div>
            </Link>
          )
        }}
        empty={<EmptyState compact icon={queue === 'mine' ? Inbox : SearchX} title={queue === 'mine' ? 'درخواستی منتظر تصمیم شما نیست' : 'درخواستی با این مشخصات پیدا نشد'} />}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

export function RequestReviewPage() {
  const { id } = useParams()
  const db = useDB()
  const m = useMgmt()
  const r = db.requests.find((x) => x.id === id)
  if (!r || r.status === 'draft') return <Navigate to={`${m.base}/requests`} replace />
  const e = employeeById(db, r.employeeId)!
  if (!employeeInScope(m.scope, e) || !r.steps.some((s) => s.party === m.role)) return <Navigate to="/forbidden" replace />
  return <PageState variant="detail" loadKey={r.id}>{() => <Review id={r.id} />}</PageState>
}

function Review({ id }: { id: string }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const navigate = useNavigate()
  const r = db.requests.find((x) => x.id === id)!
  const e = employeeById(db, r.employeeId)!
  const t = requestType(db, r.typeId)!
  const myTurn = activeParty(r) === m.role
  const canDecide = myTurn && m.can('requests.decide')
  const canExecute = r.status === 'approved' && Boolean(t.executionLabel) && m.can('requests.execute')
  const [decision, setDecision] = useState<'approve' | 'reject' | 'return' | 'execute' | 'refer' | null>(null)
  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [internal, setInternal] = useState('')
  const [preview, setPreview] = useState<number | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const expected = useRef(r.updatedAt)
  const started = useRef(false)

  useEffect(() => {
    // Opening a newly submitted request moves it to "in review" for the responsible party
    if (!started.current && r.status === 'submitted' && myTurn && m.can('requests.decide')) {
      started.current = true
      void actions.startReview(r.id).catch(() => undefined)
    }
  }, [r.status, r.id, myTurn, m, actions])

  const open = (d: typeof decision) => {
    expected.current = r.updatedAt
    setNote('')
    setErr('')
    setDecision(d)
  }
  const confirm = async () => {
    if ((decision === 'reject' || decision === 'return') && !note.trim()) return setErr(decision === 'reject' ? 'ثبت دلیل رد الزامی است.' : 'موارد نیازمند اصلاح را بنویسید.')
    if (decision === 'execute' && !note.trim()) return setErr('شرح اقدام انجام‌شده را بنویسید (مثلاً شماره پیگیری پرداخت).')
    if (decision === 'refer' && !assignee) return setErr('مسئول جدید را انتخاب کنید.')
    setBusy(true)
    try {
      if (decision === 'execute') await actions.executeRequest(r.id, note)
      else if (decision === 'refer') await actions.referRequest(r.id, assignee, note)
      else await actions.decideRequest(r.id, decision!, note, expected.current)
      toast.success(
        { approve: 'تصمیم ثبت شد: تأیید', reject: 'درخواست رد شد', return: 'درخواست برای اصلاح برگشت داده شد', execute: 'اجرای درخواست ثبت شد', refer: 'درخواست ارجاع شد' }[decision!],
        decision === 'refer' ? undefined : 'اعلان برای نیروی کار ارسال شد.',
      )
      setDecision(null)
      if (decision !== 'refer') navigate(`${m.base}/requests?queue=mine`)
    } catch (x) {
      toast.fromError(x)
      setDecision(null)
    } finally {
      setBusy(false)
    }
  }

  const sensitiveFiles = t.fields.some((f) => f.kind === 'files' && f.sensitive)
  const users = db.users.filter((u) => u.status === 'active' && (m.role === 'org' ? u.orgId === m.user?.orgId : u.companyId === m.user?.companyId) && u.id !== m.user?.id)

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'مرکز درخواست‌ها', to: `${m.base}/requests` }, { label: toFaDigits(r.trackingNo) }]}
        back={{ to: `${m.base}/requests`, label: 'مرکز درخواست‌ها' }}
        meta={
          <>
            <StatusBadge meta={REQUEST_STATUS[r.status]} />
            <span className="text-xs text-ink-500">
              شماره <Ltr className="font-semibold text-ink-800">{toFaDigits(r.trackingNo)}</Ltr>، ثبت {formatDate(r.submittedAt, 'datetime')}
            </span>
            {r.confidential ? <Badge tone="neutral" icon={Lock} size="sm">محرمانه</Badge> : null}
          </>
        }
        actions={m.can('tasks.manage') ? <Button variant="ghost" icon={UserPlus} onClick={() => setAssignOpen(true)}>تعیین مسئول پیگیری</Button> : null}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="مسیر رسیدگی" description={`گردش کار «${t.title}»`} />
            <RequestProgress request={r} type={t} />
          </Card>
          <Card>
            <CardHeader title="اطلاعات درخواست" />
            <RequestValues request={r} type={t} employee={e} />
          </Card>
          <Card>
            <CardHeader title="مدارک پیوست" />
            {sensitiveFiles && !m.can('requests.decide') ? (
              <Callout tone="neutral" icon={ShieldAlert}>
                این درخواست حاوی مدارک حساس (پزشکی/هویتی) است و فقط برای مسئولان مجاز رسیدگی قابل مشاهده است.
              </Callout>
            ) : (
              <AttachmentList request={r} onOpen={setPreview} />
            )}
          </Card>
          <Card>
            <CardHeader title="پیام‌های ردوبدل‌شده با نیروی کار" icon={MessageSquare} />
            {r.messages.length === 0 ? (
              <p className="text-sm text-ink-500">پیامی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {r.messages.map((msg) => (
                  <li key={msg.id} className="rounded-lg bg-ink-50 px-3 py-2">
                    <p className="text-2xs font-semibold text-ink-500">
                      {msg.author}، {formatDate(msg.at, 'datetime')}
                    </p>
                    <p className="text-sm leading-6">{msg.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader title="یادداشت‌های داخلی" icon={NotebookPen} description="این یادداشت‌ها برای نیروی کار قابل مشاهده نیست." />
            <ul className="space-y-2">
              {r.internalNotes.map((n) => (
                <li key={n.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-amber-100">
                  <p className="text-2xs font-semibold text-ink-500">
                    {n.author}، {formatDate(n.at, 'datetime')}
                  </p>
                  <p className="text-sm leading-6">{n.text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Textarea aria-label="یادداشت داخلی" value={internal} onChange={(x) => setInternal(x.target.value)} className="min-h-12 bg-white" placeholder="یادداشت داخلی…" maxLength={500} />
              <Button
                variant="outline"
                className="self-end"
                disabled={!internal.trim()}
                onClick={async () => {
                  try {
                    await actions.addInternalNote(r.id, internal.trim())
                    setInternal('')
                  } catch (x) {
                    toast.fromError(x)
                  }
                }}
              >
                ثبت
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className={canDecide || canExecute ? 'border-brand-200 ring-1 ring-brand-100' : ''}>
            <CardHeader title="تصمیم‌گیری" />
            {canDecide ? (
              <div className="space-y-2">
                <p className="mb-2 text-xs leading-5 text-ink-600">
                  مرحله فعلی: <strong>{r.steps[r.currentStep].label}</strong>
                  {r.currentStep < r.steps.length - 1 ? ` — پس از تأیید به «${r.steps[r.currentStep + 1].label}» ارجاع می‌شود.` : ' — آخرین مرحله تأیید.'}
                </p>
                <Button block icon={CircleCheck} onClick={() => open('approve')}>
                  تأیید
                </Button>
                <Button block variant="outline" icon={RotateCcw} onClick={() => open('return')}>
                  برگشت برای اصلاح
                </Button>
                <Button block variant="danger-ghost" icon={CircleX} onClick={() => open('reject')}>
                  رد درخواست
                </Button>
                {m.can('requests.refer') ? (
                  <Button block variant="ghost" icon={Forward} onClick={() => open('refer')}>
                    ارجاع به همکار یا واحد دیگر
                  </Button>
                ) : null}
              </div>
            ) : canExecute ? (
              <div className="space-y-2">
                <Callout tone="success" title="درخواست تأیید شده است">
                  تأیید با اجرا متفاوت است. پس از انجام «{t.executionLabel}»، اجرای آن را ثبت کنید.
                </Callout>
                <Button block icon={CheckCheck} variant="accent" onClick={() => open('execute')}>
                  ثبت اجرا: {t.executionLabel}
                </Button>
              </div>
            ) : (
              <p className="text-sm leading-6 text-ink-600">
                {myTurn && !m.can('requests.decide')
                  ? 'نقش شما مجوز تصمیم‌گیری درباره درخواست‌ها را ندارد.'
                  : r.status === 'needs_correction'
                    ? 'درخواست برای اصلاح به نیروی کار برگشت داده شده است.'
                    : activeParty(r)
                      ? `این مرحله در اختیار ${PARTY_LABEL[activeParty(r)!]} است.`
                      : `وضعیت نهایی: ${REQUEST_STATUS[r.status].label}`}
              </p>
            )}
            {r.execution ? <p className="mt-3 rounded-md bg-accent-50 p-2.5 text-xs text-accent-900">{r.execution.note}</p> : null}
            {r.rejectionReason ? <p className="mt-3 rounded-md bg-red-50 p-2.5 text-xs text-red-900">دلیل رد: {r.rejectionReason}</p> : null}
          </Card>
          <Card>
            <CardHeader title="درخواست‌دهنده" />
            {r.confidential && !myTurn ? (
              <p className="text-sm text-ink-500">هویت درخواست‌دهنده محرمانه است.</p>
            ) : (
              <>
                <p className="font-semibold">{fullName(e)}</p>
                <p className="text-xs text-ink-500">
                  <Ltr>{e.personnelNo}</Ltr>، {e.jobTitle}
                </p>
                <p className="mt-1 text-xs text-ink-500">{projectById(db, e.projectId)?.name}</p>
                {t.category === 'leave' ? <p className="mt-2 text-xs">مانده مرخصی: <strong>{toFaDigits(e.leaveBalanceDays)} روز</strong></p> : null}
                {m.can('workforce.view') ? (
                  <Link to={`${m.base}/workforce/${e.id}`} className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
                    پرونده نیرو
                  </Link>
                ) : null}
              </>
            )}
          </Card>
          <Card>
            <CardHeader title="تاریخچه تصمیم‌ها و اقدامات" />
            <RequestHistory request={r} />
          </Card>
        </aside>
      </div>

      <Dialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        dismissable={!busy}
        title={{ approve: 'تأیید درخواست', reject: 'رد درخواست', return: 'برگشت برای اصلاح', execute: `ثبت اجرا: ${t.executionLabel}`, refer: 'ارجاع درخواست' }[decision ?? 'approve']}
        tone={decision === 'reject' ? 'danger' : decision === 'return' ? 'warning' : 'default'}
        description={
          decision === 'approve'
            ? r.currentStep < r.steps.length - 1
              ? `پس از تأیید، درخواست به «${r.steps[r.currentStep + 1].label}» ارجاع می‌شود.`
              : t.executionLabel
                ? `تأیید نهایی ثبت می‌شود؛ «${t.executionLabel}» جداگانه ثبت خواهد شد.`
                : 'تأیید نهایی ثبت و به نیروی کار اطلاع داده می‌شود.'
            : decision === 'return'
              ? 'توضیح شما برای نیروی کار نمایش داده می‌شود تا اطلاعات یا مدارک را اصلاح کند.'
              : decision === 'reject'
                ? 'دلیل رد برای نیروی کار نمایش داده می‌شود.'
                : decision === 'refer'
                  ? 'مسئول بررسی تغییر می‌کند؛ یادداشت به‌صورت داخلی ثبت می‌شود.'
                  : 'این ثبت، اقدام نهایی را در سوابق درخواست ثبت می‌کند.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>
              انصراف
            </Button>
            <Button variant={decision === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={confirm}>
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {decision === 'refer' ? (
            <Field label="مسئول جدید" required error={err && !assignee ? err : undefined}>
              {(p) => <Select id={p.id} invalid={p.invalid} value={assignee} onChange={(x) => setAssignee(x.target.value)} placeholder="انتخاب کنید" options={users.map((u) => ({ value: u.name, label: u.name }))} />}
            </Field>
          ) : null}
          <Field
            label={decision === 'reject' ? 'دلیل رد' : decision === 'return' ? 'موارد نیازمند اصلاح' : decision === 'execute' ? 'شرح اقدام انجام‌شده' : 'توضیح'}
            required={decision === 'reject' || decision === 'return' || decision === 'execute'}
            optionalLabel={decision === 'approve' || decision === 'refer'}
            error={err && (decision !== 'refer' || assignee) ? err : undefined}
          >
            {(p) => <Textarea id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} value={note} onChange={(x) => setNote(x.target.value)} maxLength={500} showCount />}
          </Field>
        </div>
      </Dialog>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} title={preview !== null ? r.attachments[preview]?.name : ''} size="lg">
        {preview !== null && r.attachments[preview] ? <DocumentPreview source={{ fileName: r.attachments[preview].name, mime: r.attachments[preview].mime, previewUrl: r.attachments[preview].previewUrl, title: r.attachments[preview].name }} watermark={m.user?.name} /> : null}
      </Dialog>
      {assignOpen ? <AssignFollowupDialog open onClose={() => setAssignOpen(false)} link={{ type: 'request', id: r.id, label: r.trackingNo }} defaultTitle={`پیگیری درخواست ${r.trackingNo}`} projectId={e.projectId ?? undefined} /> : null}
    </>
  )
}
