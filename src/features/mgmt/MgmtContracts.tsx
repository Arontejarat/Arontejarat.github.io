import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { Bell, CalendarClock, CircleCheck, FilePlus2, FileSignature, History, PenLine, RotateCcw, SearchX, Send, Siren, UserPlus } from 'lucide-react'
import {
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DatePicker,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  FilterBar,
  Ltr,
  MonthPicker,
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
import { employeeById, fullName, projectById, projectInScope, scopedContracts, scopedEmployees, signatureStatus, validityStatus } from '@/mock/selectors'
import { CONTRACT_STAGE, SIGNATURE_STATUS, VALIDITY_STATUS } from '@/config/status'
import { daysUntil, formatDate, formatDeadline, formatPeriod, formatRial } from '@/lib/format'
import { jalaliMonthLength, jalaliToISO, toISODate, toJalali, periodKey, shiftJalaliMonth } from '@/lib/jalali'
import type { Contract, ContractStage } from '@/types/domain'
import { ContractBody, SignaturePanel, versionLabel } from '@/features/contracts/ContractParts'
import { useMgmt } from './useMgmt'
import { AssignFollowupDialog } from './AssignFollowup'

const SIGN_STAGES: ContractStage[] = ['awaiting_worker', 'awaiting_other', 'partially_signed']

/** Automatic contract alerts derived from state + dates (PRD part 2 §6) */
export function contractAlerts(c: Contract) {
  const out: { key: string; text: string; tone: 'warning' | 'danger' }[] = []
  if (c.stage === 'ready_to_send') out.push({ key: 'not_sent', text: 'آماده امضاست اما ارسال نشده است', tone: 'warning' })
  if (c.stage === 'awaiting_worker' && c.parties.every((p) => !p.signedAt)) out.push({ key: 'no_sign', text: 'ارسال شده اما امضایی انجام نشده است', tone: 'warning' })
  if (['awaiting_other', 'partially_signed'].includes(c.stage)) out.push({ key: 'one_side', text: 'یکی از طرف‌ها امضا کرده و طرف دیگر هنوز اقدام نکرده است', tone: 'warning' })
  if (c.signDeadline && signatureStatus(c) !== 'complete' && SIGN_STAGES.concat('ready_to_send').includes(c.stage) && daysUntil(c.signDeadline) <= 3) out.push({ key: 'deadline', text: `مهلت امضا ${formatDeadline(c.signDeadline).text}`, tone: 'danger' })
  if (c.kind === 'project' && validityStatus(c) === 'near_end') out.push({ key: 'near_end', text: 'به پایان دوره اعتبار نزدیک است', tone: 'warning' })
  if (validityStatus(c) === 'expired' && c.stage !== 'completed' && !c.terminated) out.push({ key: 'expired', text: 'منقضی شده و تعیین تکلیف نشده است', tone: 'danger' })
  if (c.kind === 'project' && validityStatus(c) === 'expired' && c.stage === 'completed' && !c.terminated && daysUntil(c.endDate) > -60) out.push({ key: 'expired', text: 'منقضی شده؛ تمدید یا خاتمه را تعیین کنید', tone: 'danger' })
  return out
}

export function MgmtContractsPage() {
  const m = useMgmt()
  const [create, setCreate] = useState(false)
  return (
    <>
      <PageHeader
        title="قراردادها و وضعیت امضا"
        description={m.isCompany ? 'تهیه، ارسال و پیگیری قراردادهای نیروها و قراردادهای اصلی پروژه.' : 'مشاهده قراردادهای نیروهای مستقر و تأیید قراردادهای پروژه طبق مجوز.'}
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'قراردادها' }]}
        actions={
          m.can('contracts.manage') ? (
            <Button icon={FilePlus2} onClick={() => setCreate(true)}>
              ایجاد قرارداد ماهانه
            </Button>
          ) : null
        }
      />
      <PageState>{({ empty }) => <List empty={empty} />}</PageState>
      {create ? <CreateContractDialog onClose={() => setCreate(false)} /> : null}
    </>
  )
}

function List({ empty }: { empty: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<'worker' | 'project' | 'alerts'>(params.get('alert') === 'near_end' || params.get('stage') === 'org_review' ? 'project' : 'worker')
  const [q, setQ] = useState('')
  const [stage, setStage] = useState(params.get('stage') ?? '')
  const [sig, setSig] = useState('')
  const [validity, setValidity] = useState(params.get('alert') === 'near_end' ? 'near_end' : '')
  const [project, setProject] = useState('')
  const [nearSign, setNearSign] = useState(params.get('alert') === 'near_sign')
  const all = empty ? [] : scopedContracts(db, m.scope)
  const rows = useMemo(
    () =>
      all
        .filter((c) => (kind === 'alerts' ? contractAlerts(c).length > 0 && c.stage !== 'superseded' : c.kind === kind))
        .filter((c) => {
          const name = c.employeeId ? fullName(employeeById(db, c.employeeId)!) : c.title
          return (
            (!q || c.number.toUpperCase().includes(q.toUpperCase()) || name.includes(q)) &&
            (!stage || c.stage === stage) &&
            (!sig || signatureStatus(c) === sig) &&
            (!validity || validityStatus(c) === validity) &&
            (!project || c.projectId === project) &&
            (!nearSign || (c.signDeadline && signatureStatus(c) !== 'complete' && daysUntil(c.signDeadline) <= 7 && SIGN_STAGES.concat('ready_to_send').includes(c.stage)))
          )
        })
        .sort((a, b) => (a.signDeadline ?? 'z').localeCompare(b.signDeadline ?? 'z') || b.startDate.localeCompare(a.startDate)),
    [all, kind, q, stage, sig, validity, project, nearSign, db],
  )
  const alertCount = all.filter((c) => contractAlerts(c).length > 0 && c.stage !== 'superseded').length

  const columns: Column<Contract>[] = [
    { id: 'no', header: 'شماره قرارداد', cell: (c) => <Ltr className="text-xs font-semibold">{c.number}</Ltr>, sortValue: (c) => c.number },
    { id: 'party', header: 'نیرو یا طرف قرارداد', cell: (c) => <span className="font-medium">{c.employeeId ? fullName(employeeById(db, c.employeeId)!) : c.parties.find((p) => p.role !== 'company')?.name}</span> },
    { id: 'kind', header: 'نوع', label: 'نوع قرارداد', hideable: true, defaultHidden: kind !== 'alerts', cell: (c) => <span className="text-xs">{c.kind === 'worker' ? 'قرارداد نیروی کار' : 'قرارداد پروژه'}</span> },
    { id: 'project', header: 'پروژه', label: 'پروژه', hideable: true, cell: (c) => <span className="text-xs">{projectById(db, c.projectId)?.name}</span> },
    { id: 'range', header: 'شروع و پایان', label: 'تاریخ شروع و پایان', hideable: true, cell: (c) => <span className="whitespace-nowrap text-xs">{formatDate(c.startDate, 'short')} – {formatDate(c.endDate, 'short')}</span>, sortValue: (c) => c.startDate },
    { id: 'stage', header: 'وضعیت تهیه', cell: (c) => <StatusBadge meta={CONTRACT_STAGE[c.stage]} variant="dot" /> },
    { id: 'sig', header: 'وضعیت امضا', cell: (c) => <StatusBadge meta={SIGNATURE_STATUS[signatureStatus(c)]} size="sm" /> },
    {
      id: 'deadline',
      header: 'مهلت امضا',
      cell: (c) => {
        if (!c.signDeadline || signatureStatus(c) === 'complete') return <span className="text-ink-400">—</span>
        const d = formatDeadline(c.signDeadline)
        return <DeadlineBadge d={d}>{d.text}</DeadlineBadge>
      },
      sortValue: (c) => c.signDeadline ?? 'z',
    },
    { id: 'validity', header: 'وضعیت اعتبار', cell: (c) => <StatusBadge meta={VALIDITY_STATUS[validityStatus(c)]} variant="dot" /> },
    ...(kind === 'alerts'
      ? [
          {
            id: 'alerts',
            header: 'هشدار',
            cell: (c: Contract) => (
              <ul className="space-y-0.5">
                {contractAlerts(c).map((a) => (
                  <li key={a.key} className={`text-xs ${a.tone === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>
                    {a.text}
                  </li>
                ))}
              </ul>
            ),
          } as Column<Contract>,
        ]
      : []),
  ]
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  return (
    <>
      <Tabs
        className="mb-4"
        value={kind}
        onChange={(v) => setKind(v as typeof kind)}
        tabs={[
          { id: 'worker', label: 'قراردادهای نیروها', count: all.filter((c) => c.kind === 'worker').length },
          { id: 'project', label: 'قراردادهای پروژه', count: all.filter((c) => c.kind === 'project').length },
          { id: 'alerts', label: 'هشدارهای خودکار', icon: Siren, count: alertCount },
        ]}
      />
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="شماره قرارداد یا نام" />}
        activeCount={[stage, sig, validity, project, nearSign ? '1' : ''].filter(Boolean).length}
        onClear={() => {
          setStage('')
          setSig('')
          setValidity('')
          setProject('')
          setNearSign(false)
        }}
      >
        <Select aria-label="وضعیت تهیه" className="w-full sm:w-48" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="وضعیت تهیه" options={(Object.keys(CONTRACT_STAGE) as ContractStage[]).map((s) => ({ value: s, label: CONTRACT_STAGE[s].label }))} />
        <Select aria-label="وضعیت امضا" className="w-full sm:w-40" value={sig} onChange={(e) => setSig(e.target.value)} placeholder="وضعیت امضا" options={Object.entries(SIGNATURE_STATUS).map(([v, x]) => ({ value: v, label: x.label }))} />
        <Select aria-label="وضعیت اعتبار" className="w-full sm:w-40" value={validity} onChange={(e) => setValidity(e.target.value)} placeholder="وضعیت اعتبار" options={Object.entries(VALIDITY_STATUS).map(([v, x]) => ({ value: v, label: x.label }))} />
        <Select aria-label="پروژه" className="w-full sm:w-48" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <Select aria-label="مهلت امضا" className="w-full sm:w-48" value={nearSign ? '1' : ''} onChange={(e) => setNearSign(e.target.value === '1')} placeholder="همه مهلت‌ها" options={[{ value: '1', label: 'نزدیک به مهلت امضا (۷ روز)' }]} />
      </FilterBar>
      <p className="mb-3 text-xs text-ink-500">«نزدیک به مهلت امضا» به فرایند تکمیل امضا مربوط است و با «نزدیک به پایان» که به دوره اعتبار قرارداد مربوط است فرق دارد.</p>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(c) => c.id}
        rowHref={(c) => `${m.base}/contracts/${c.id}`}
        columnChooser
        pageSize={12}
        caption="فهرست قراردادها"
        mobileCard={(c) => (
          <Link to={`${m.base}/contracts/${c.id}`} className="block">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{c.employeeId ? fullName(employeeById(db, c.employeeId)!) : c.title}</p>
                <p className="text-2xs text-ink-500">
                  <Ltr>{c.number}</Ltr>
                </p>
              </div>
              <StatusBadge meta={SIGNATURE_STATUS[signatureStatus(c)]} size="sm" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge meta={CONTRACT_STAGE[c.stage]} size="sm" />
              <StatusBadge meta={VALIDITY_STATUS[validityStatus(c)]} size="sm" />
            </div>
          </Link>
        )}
        empty={<EmptyState compact icon={SearchX} title="قراردادی با این مشخصات پیدا نشد" />}
      />
    </>
  )
}

function CreateContractDialog({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const today = toJalali(new Date())
  const next = shiftJalaliMonth(today.jy, today.jm, 1)
  const emps = scopedEmployees(db, m.scope).filter((e) => e.employmentStatus !== 'terminated' && e.projectId)
  const [emp, setEmp] = useState('')
  const [period, setPeriod] = useState(periodKey(next.jy, next.jm))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      title="ایجاد قرارداد ماهانه"
      description="قرارداد به‌صورت پیش‌نویس ایجاد می‌شود و پس از بررسی شرکت برای امضای نیروی کار ارسال می‌شود."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              if (!emp) return setErr('نیرو را انتخاب کنید.')
              const [y, mm] = period.split('-').map(Number)
              setBusy(true)
              try {
                await actions.createWorkerContract(emp, y, mm, jalaliToISO(y, mm, 1), jalaliToISO(y, mm, jalaliMonthLength(y, mm)))
                toast.success('پیش‌نویس قرارداد ایجاد شد')
                onClose()
              } catch (x) {
                toast.fromError(x)
              } finally {
                setBusy(false)
              }
            }}
          >
            ایجاد پیش‌نویس
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="نیروی کار" required error={err}>
          {(p) => <Select id={p.id} invalid={p.invalid} value={emp} onChange={(e) => { setEmp(e.target.value); setErr('') }} placeholder="انتخاب کنید" options={emps.map((e) => ({ value: e.id, label: `${fullName(e)} — ${e.personnelNo}` }))} />}
        </Field>
        <Field label="دوره قرارداد" required>
          {(p) => <MonthPicker id={p.id} value={period} onChange={setPeriod} />}
        </Field>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

export function MgmtContractDetailPage() {
  const { id } = useParams()
  const db = useDB()
  const m = useMgmt()
  const c = db.contracts.find((x) => x.id === id)
  if (!c) return <Navigate to={`${m.base}/contracts`} replace />
  if (!scopedContracts(db, m.scope).some((x) => x.id === c.id)) return <Navigate to="/forbidden" replace />
  return <PageState variant="detail" loadKey={c.id}>{() => <Detail id={c.id} />}</PageState>
}

function Detail({ id }: { id: string }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const c = db.contracts.find((x) => x.id === id)!
  const emp = employeeById(db, c.employeeId)
  const [busy, setBusy] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [deadline, setDeadline] = useState(toISODate(new Date(Date.now() + 5 * 86_400_000)))
  const [returnOpen, setReturnOpen] = useState(false)
  const [note, setNote] = useState('')
  const [signOpen, setSignOpen] = useState<'company' | 'org' | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const alerts = contractAlerts(c)

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(msg)
      setSendOpen(false)
      setReturnOpen(false)
      setSignOpen(null)
    } catch (x) {
      toast.fromError(x)
    } finally {
      setBusy(false)
    }
  }

  const manage = m.can('contracts.manage') && m.isCompany
  const approve = m.can('contracts.approve') && m.role === 'org'
  const companyUnsigned = c.parties.find((p) => p.role === 'company' && !p.signedAt)
  const orgUnsigned = c.parties.find((p) => p.role === 'org' && !p.signedAt)

  const actionsUi = (
    <div className="space-y-2">
      {manage && c.stage === 'draft' ? (
        <Button block icon={Send} loading={busy} onClick={() => run(() => actions.advanceContractStage(c.id, 'submit_review'), 'برای بررسی شرکت ارسال شد')}>
          ارسال برای بررسی شرکت
        </Button>
      ) : null}
      {manage && c.stage === 'company_review' ? (
        <Button block icon={CircleCheck} loading={busy} onClick={() => run(() => actions.advanceContractStage(c.id, 'company_approve'), c.kind === 'project' ? 'برای بررسی سازمان ارسال شد' : 'آماده ارسال برای امضا شد')}>
          تأیید بررسی شرکت
        </Button>
      ) : null}
      {manage && c.stage === 'ready_to_send' ? (
        <Button block icon={Send} onClick={() => setSendOpen(true)}>
          ارسال برای امضا
        </Button>
      ) : null}
      {manage && SIGN_STAGES.includes(c.stage) && c.parties.some((p) => p.required && !p.signedAt && p.role !== 'company') ? (
        <Button block variant="outline" icon={Bell} loading={busy} onClick={() => run(() => actions.remindContract(c.id), 'یادآوری ارسال شد')}>
          ارسال یادآوری امضا
        </Button>
      ) : null}
      {manage && companyUnsigned && ['awaiting_other', 'partially_signed'].includes(c.stage) ? (
        <Button block icon={PenLine} onClick={() => setSignOpen('company')}>
          ثبت امضای شرکت
        </Button>
      ) : null}
      {approve && c.stage === 'org_review' ? (
        <>
          <Button block icon={CircleCheck} loading={busy} onClick={() => run(() => actions.advanceContractStage(c.id, 'org_approve'), 'قرارداد توسط سازمان تأیید شد')}>
            تأیید قرارداد
          </Button>
          <Button block variant="outline" icon={RotateCcw} onClick={() => setReturnOpen(true)}>
            برگشت برای اصلاح
          </Button>
        </>
      ) : null}
      {approve && orgUnsigned && ['awaiting_other', 'partially_signed'].includes(c.stage) ? (
        <Button block icon={PenLine} onClick={() => setSignOpen('org')}>
          ثبت امضای سازمان
        </Button>
      ) : null}
      {m.can('tasks.manage') ? (
        <Button block variant="ghost" icon={UserPlus} onClick={() => setAssignOpen(true)}>
          تعیین مسئول پیگیری
        </Button>
      ) : null}
    </div>
  )

  return (
    <>
      <PageHeader
        title={c.title}
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'قراردادها', to: `${m.base}/contracts` }, { label: c.number }]}
        back={{ to: `${m.base}/contracts`, label: 'قراردادها' }}
        meta={
          <>
            <StatusBadge meta={CONTRACT_STAGE[c.stage]} />
            <StatusBadge meta={SIGNATURE_STATUS[signatureStatus(c)]} />
            <StatusBadge meta={VALIDITY_STATUS[validityStatus(c)]} />
          </>
        }
      />
      {alerts.length ? (
        <Callout tone="warning" icon={CalendarClock} title="هشدارهای این قرارداد" className="mb-5">
          <ul className="list-inside list-disc">
            {alerts.map((a) => (
              <li key={a.key}>{a.text}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {m.role === 'org' && c.kind === 'worker' ? (
        <Callout tone="neutral" className="mb-5">
          قراردادهای نیروی کار بین شرکت تأمین نیرو و نیروی کار منعقد می‌شود؛ سازمان فقط امکان مشاهده وضعیت دارد.
        </Callout>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <ContractBody c={c} db={db} employee={emp} />
        </Card>
        <aside className="space-y-5">
          {(manage || approve || m.can('tasks.manage')) && c.stage !== 'superseded' ? (
            <Card>
              <CardHeader title="اقدامات" />
              {actionsUi}
            </Card>
          ) : null}
          <Card>
            <CardHeader title="وضعیت امضای طرف‌ها" description="وضعیت هر طرف جداگانه پیگیری می‌شود." />
            <SignaturePanel c={c} highlightRole={m.role} />
          </Card>
          <Card>
            <CardHeader title="مشخصات" icon={FileSignature} />
            <DescriptionList
              columns={1}
              items={[
                { label: 'شماره', value: <Ltr>{c.number}</Ltr> },
                { label: 'نوع', value: c.kind === 'worker' ? 'قرارداد نیروی کار' : 'قرارداد اصلی پروژه' },
                ...(c.periodYear ? [{ label: 'دوره', value: formatPeriod(c.periodYear, c.periodMonth!) }] : []),
                { label: 'پروژه', value: projectById(db, c.projectId)?.name },
                { label: 'مدت', value: `${formatDate(c.startDate)} تا ${formatDate(c.endDate)}` },
                ...(c.signDeadline ? [{ label: 'مهلت امضا', value: `${formatDate(c.signDeadline)} (${formatDeadline(c.signDeadline).text})` }] : []),
                ...(c.value ? [{ label: 'مبلغ قرارداد', value: formatRial(c.value) }] : []),
                { label: 'شناسه نسخه', value: <Ltr mono>{versionLabel(c)}</Ltr> },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="تاریخچه" icon={History} />
            <Timeline items={[...c.history].reverse().map((h, i) => ({ id: h.id, icon: History, tone: i === 0 ? 'brand' : 'neutral', title: h.text, time: formatDate(h.at, 'datetime'), body: h.actor }))} />
          </Card>
        </aside>
      </div>
      <Dialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="ارسال قرارداد برای امضا"
        description={c.kind === 'worker' ? 'قرارداد برای نیروی کار ارسال و اعلان صادر می‌شود. یک وظیفه پیگیری امضا برای مسئول قرارداد ایجاد می‌شود.' : 'قرارداد برای امضای سازمان ارسال می‌شود.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              انصراف
            </Button>
            <Button loading={busy} onClick={() => run(() => actions.sendContractForSignature(c.id, deadline), 'قرارداد برای امضا ارسال شد')}>
              ارسال
            </Button>
          </>
        }
      >
        <Field label="مهلت امضا" required>
          {(p) => <DatePicker id={p.id} value={deadline} onChange={setDeadline} min={toISODate(new Date())} clearable={false} />}
        </Field>
      </Dialog>
      <Dialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="برگشت قرارداد برای اصلاح"
        tone="warning"
        footer={
          <>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              انصراف
            </Button>
            <Button loading={busy} disabled={!note.trim()} onClick={() => run(() => actions.advanceContractStage(c.id, 'org_return', note), 'قرارداد برای اصلاح برگشت داده شد')}>
              برگشت
            </Button>
          </>
        }
      >
        <Field label="موارد نیازمند اصلاح" required>
          {(p) => <Textarea id={p.id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
        </Field>
      </Dialog>
      <ConfirmDialog
        open={signOpen !== null}
        onClose={() => setSignOpen(null)}
        loading={busy}
        title={`ثبت امضای ${signOpen === 'org' ? 'سازمان' : 'شرکت'}`}
        description={`امضای ${signOpen === 'org' ? 'سازمان' : 'شرکت'} برای نسخه ${versionLabel(c)} به نام ${m.user?.name} ثبت می‌شود. نسخه امضاشده قابل تغییر نیست.`}
        confirmLabel="ثبت امضا"
        onConfirm={() => run(() => actions.signContractAsParty(c.id, signOpen!), 'امضا ثبت شد')}
      />
      {assignOpen ? <AssignFollowupDialog open onClose={() => setAssignOpen(false)} link={{ type: 'contract', id: c.id, label: c.number }} defaultTitle={`پیگیری قرارداد ${c.number}`} projectId={c.projectId} /> : null}
    </>
  )
}
