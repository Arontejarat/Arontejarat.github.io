import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ArrowLeftRight, Ban, EllipsisVertical, Eye, EyeOff, FileText, History, Lock, LogOut, MapPin, Pencil, UserMinus } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DatePicker,
  DescriptionList,
  Dialog,
  DropdownMenu,
  EmptyState,
  Field,
  Ltr,
  PageHeader,
  PageState,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Timeline,
  useToast,
} from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, documentStatus, employeeDocumentChecklist, employeeInScope, fullName, orgById, projectById, projectInScope, requestType, workerContractSummary, workerDocSummary } from '@/mock/selectors'
import { DOC_STATUS, EMPLOYMENT_STATUS, REQUEST_STATUS, VALIDITY_STATUS, CONTRACT_STAGE, WORKER_CONTRACT_SUMMARY, WORKER_DOC_SUMMARY } from '@/config/status'
import { MARITAL_LABEL, SHIFT_LABEL } from '@/config/requestTypes'
import { formatDate, formatMobile, formatPeriod, mask, maskSheba } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import { validityStatus } from '@/mock/selectors'
import { useMgmt } from './useMgmt'

export function WorkerDetailPage() {
  const { id } = useParams()
  const db = useDB()
  const m = useMgmt()
  const e = db.employees.find((x) => x.id === id)
  if (!e) return <Navigate to={`${m.base}/workforce`} replace />
  // Data-scope check (the backend enforces the same rule)
  if (!employeeInScope(m.scope, e)) return <Navigate to="/forbidden" replace />
  return <PageState variant="detail" loadKey={e.id}>{() => <Detail id={e.id} />}</PageState>
}

function Detail({ id }: { id: string }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const e = db.employees.find((x) => x.id === id)!
  const [tab, setTab] = useState('overview')
  const [reveal, setReveal] = useState(false)
  const [dialog, setDialog] = useState<'transfer' | 'remove' | 'terminate' | null>(null)
  const [note, setNote] = useState('')
  const [target, setTarget] = useState('')
  const [lastDay, setLastDay] = useState(toISODate(new Date(Date.now() + 14 * 86_400_000)))
  const [busy, setBusy] = useState(false)
  const sensitive = m.can('workforce.sensitive')
  const requests = db.requests.filter((r) => r.employeeId === e.id && r.status !== 'draft' && r.steps.some((s) => s.party === m.role))
  const contracts = db.contracts.filter((c) => c.employeeId === e.id).sort((a, b) => b.startDate.localeCompare(a.startDate))
  const checklist = employeeDocumentChecklist(db, e)
  const projects = db.projects.filter((p) => projectInScope(m.scope, p) && p.status !== 'closed' && p.id !== e.projectId)

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(msg)
      setDialog(null)
      setNote('')
    } catch (err) {
      toast.fromError(err)
    } finally {
      setBusy(false)
    }
  }

  const menu = [
    ...(m.can('workforce.edit') && projects.length ? [{ label: 'انتقال به پروژه دیگر', icon: ArrowLeftRight, onSelect: () => setDialog('transfer') }] : []),
    ...(m.can('workforce.edit') && e.projectId ? [{ label: 'خروج از پروژه', icon: UserMinus, onSelect: () => setDialog('remove') }] : []),
    ...(m.can('workforce.status') && e.employmentStatus !== 'terminated' ? ['separator' as const, { label: 'درخواست خاتمه همکاری', icon: LogOut, tone: 'danger' as const, onSelect: () => setDialog('terminate') }] : []),
  ]

  return (
    <>
      <PageHeader
        title={fullName(e)}
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'نیروها', to: `${m.base}/workforce` }, { label: fullName(e) }]}
        back={{ to: `${m.base}/workforce`, label: 'نیروها' }}
        meta={
          <>
            <StatusBadge meta={EMPLOYMENT_STATUS[e.employmentStatus]} />
            <StatusBadge meta={WORKER_DOC_SUMMARY[workerDocSummary(db, e)]} />
            <StatusBadge meta={WORKER_CONTRACT_SUMMARY[workerContractSummary(db, e)]} />
          </>
        }
        actions={
          menu.length ? (
            <DropdownMenu
              trigger={
                <Button variant="outline" icon={EllipsisVertical}>
                  اقدامات
                </Button>
              }
              items={menu}
            />
          ) : null
        }
      />

      <Card className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={fullName(e)} color={e.photoColor} size={56} />
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <div>
            <dt className="text-2xs text-ink-500">کد پرسنلی</dt>
            <dd className="font-semibold">
              <Ltr>{e.personnelNo}</Ltr>
            </dd>
          </div>
          <div>
            <dt className="text-2xs text-ink-500">سمت شغلی</dt>
            <dd className="font-semibold">{e.jobTitle}</dd>
          </div>
          <div>
            <dt className="text-2xs text-ink-500">پروژه</dt>
            <dd className="font-semibold">{projectById(db, e.projectId)?.name ?? 'خارج از پروژه'}</dd>
          </div>
          <div>
            <dt className="text-2xs text-ink-500">{m.isCompany ? 'سازمان محل خدمت' : 'شرکت تأمین‌کننده'}</dt>
            <dd className="font-semibold">{m.isCompany ? orgById(db, e.orgId)?.name : companyById(db, e.companyId)?.name}</dd>
          </div>
        </dl>
      </Card>

      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'اطلاعات' },
          { id: 'documents', label: 'مدارک', count: checklist.filter((x) => x.status !== 'approved').length || undefined },
          { id: 'requests', label: 'درخواست‌ها', count: requests.length },
          { id: 'contracts', label: 'قراردادها', count: contracts.length },
          { id: 'history', label: 'سوابق تغییرات', icon: History },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="اطلاعات فردی"
              action={
                sensitive ? (
                  <Button variant="ghost" size="sm" icon={reveal ? EyeOff : Eye} onClick={() => setReveal((r) => !r)}>
                    {reveal ? 'پنهان کردن' : 'نمایش کامل'}
                  </Button>
                ) : (
                  <Badge size="sm" tone="muted" icon={Lock}>
                    نمایش محدود
                  </Badge>
                )
              }
            />
            <DescriptionList
              items={[
                { label: 'کد ملی', value: <Ltr>{sensitive && reveal ? e.nationalId : mask(e.nationalId, 3)}</Ltr> },
                { label: 'شماره موبایل', value: <Ltr>{sensitive && reveal ? formatMobile(e.mobile) : `${e.mobile.slice(0, 4)}•••${e.mobile.slice(-3)}`}</Ltr> },
                { label: 'تاریخ تولد', value: sensitive ? formatDate(e.birthDate) : '—' },
                { label: 'وضعیت تأهل', value: MARITAL_LABEL[e.maritalStatus] },
                ...(m.isCompany && sensitive ? [{ label: 'حساب حقوق', value: e.bankAccounts.find((b) => b.activeForPayroll) ? <Ltr mono>{maskSheba(e.bankAccounts.find((b) => b.activeForPayroll)!.sheba)}</Ltr> : 'ثبت نشده', full: true }] : []),
              ]}
            />
            {!sensitive ? <p className="mt-4 text-xs text-ink-500">نقش شما اجازه مشاهده کامل اطلاعات هویتی و بانکی را ندارد.</p> : null}
          </Card>
          <Card>
            <CardHeader title="اطلاعات شغلی" icon={MapPin} />
            <DescriptionList
              items={[
                { label: 'واحد', value: e.unit || '—' },
                { label: 'محل خدمت', value: e.workplace },
                { label: 'شیفت', value: SHIFT_LABEL[e.shift] },
                { label: 'شروع همکاری', value: formatDate(e.startDate) },
                { label: 'نوع قرارداد', value: e.contractType },
                { label: 'مدت قرارداد', value: `${formatDate(e.contractStart)} تا ${formatDate(e.contractEnd)}` },
                { label: 'مسئول مستقیم', value: e.supervisor ?? '—' },
                { label: 'مانده مرخصی', value: `${e.leaveBalanceDays.toLocaleString('fa-IR')} روز` },
              ]}
            />
          </Card>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {checklist.map(({ type, doc }) => (
              <li key={type.id} className="flex items-center gap-3 px-4 py-3">
                <FileText size={18} className="text-ink-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{type.title}</p>
                  <p className="text-xs text-ink-500">
                    بررسی: {type.reviewParty === 'org' ? 'سازمان' : 'شرکت'}
                    {doc ? `، نسخه ${doc.versions.length.toLocaleString('fa-IR')}` : ''}
                    {doc?.expiresAt ? `، اعتبار تا ${formatDate(doc.expiresAt)}` : ''}
                  </p>
                </div>
                <StatusBadge meta={DOC_STATUS[documentStatus(doc)]} size="sm" />
                {doc && m.can('documents.view') ? (
                  <Link to={`${m.base}/documents?doc=${doc.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                    مشاهده
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === 'requests' ? (
        requests.length === 0 ? (
          <EmptyState icon={FileText} title="درخواستی در محدوده شما ثبت نشده است" />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link to={`${m.base}/requests/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-25">
                    <span>
                      <span className="block text-sm font-semibold">{requestType(db, r.typeId)?.title}</span>
                      <span className="block text-xs text-ink-500">
                        <Ltr>{r.trackingNo}</Ltr>، {formatDate(r.submittedAt)}
                      </span>
                    </span>
                    <StatusBadge meta={REQUEST_STATUS[r.status]} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {tab === 'contracts' ? (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {contracts.map((c) => (
              <li key={c.id}>
                <Link to={`${m.base}/contracts/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-ink-25">
                  <span>
                    <span className="block text-sm font-semibold">{c.periodYear ? formatPeriod(c.periodYear, c.periodMonth!) : c.title}</span>
                    <span className="block text-xs text-ink-500">
                      <Ltr>{c.number}</Ltr>
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <StatusBadge meta={CONTRACT_STAGE[c.stage]} size="sm" />
                    <StatusBadge meta={VALIDITY_STATUS[validityStatus(c)]} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === 'history' ? (
        <Card>
          <CardHeader title="سوابق تغییرات" description="مقدار قبلی، مقدار جدید، تغییردهنده و زمان هر تغییر" />
          {e.changeLog.length === 0 && e.assignments.length === 0 ? (
            <EmptyState compact icon={History} title="تغییری ثبت نشده است" />
          ) : (
            <Timeline
              items={[
                ...e.changeLog.map((c) => ({
                  id: c.id,
                  icon: Pencil,
                  tone: 'brand' as const,
                  title: `${c.field}: ${c.before || '—'} ← ${c.after}`,
                  time: formatDate(c.at, 'datetime'),
                  body: `${c.by}، ${{ inline: 'ویرایش در جدول', bulk: 'ویرایش گروهی', import: 'ورود Excel', request: 'اجرای درخواست', system: 'سامانه' }[c.source]}`,
                })),
                ...e.assignments.map((a) => ({ id: a.id, icon: MapPin, tone: 'neutral' as const, title: `استقرار در ${projectById(db, a.projectId)?.name ?? '—'}`, time: `${formatDate(a.from)}${a.to ? ` تا ${formatDate(a.to)}` : ' تاکنون'}`, body: a.note })),
              ]}
            />
          )}
        </Card>
      ) : null}

      <Dialog
        open={dialog === 'transfer'}
        onClose={() => setDialog(null)}
        title="انتقال به پروژه دیگر"
        description="سوابق نیرو در پروژه فعلی حفظ می‌شود و تاریخ پایان استقرار ثبت می‌شود."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              انصراف
            </Button>
            <Button loading={busy} disabled={!target} onClick={() => run(() => actions.updateEmployeeFields([e.id], { projectId: target }, 'inline'), 'نیرو منتقل شد')}>
              انتقال
            </Button>
          </>
        }
      >
        <Field label="پروژه مقصد" required>
          {(p) => <Select id={p.id} value={target} onChange={(x) => setTarget(x.target.value)} placeholder="انتخاب کنید" options={projects.map((x) => ({ value: x.id, label: x.name }))} />}
        </Field>
      </Dialog>

      <Dialog
        open={dialog === 'remove'}
        onClose={() => setDialog(null)}
        title="خروج از پروژه"
        icon={UserMinus}
        tone="warning"
        description="نیرو از فهرست فعال پروژه خارج می‌شود. این کار با خاتمه همکاری متفاوت است و سوابق قرارداد، فیش حقوقی، مدارک و درخواست‌های او حذف نمی‌شود."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => run(() => actions.removeFromProject(e.id, note), 'نیرو از پروژه خارج شد')}>
              خروج از پروژه
            </Button>
          </>
        }
      >
        <Field label="علت" required>
          {(p) => <Textarea id={p.id} value={note} onChange={(x) => setNote(x.target.value)} maxLength={300} />}
        </Field>
      </Dialog>

      <Dialog
        open={dialog === 'terminate'}
        onClose={() => setDialog(null)}
        title="درخواست خاتمه همکاری"
        icon={Ban}
        tone="danger"
        description="خاتمه همکاری مستقیماً اعمال نمی‌شود؛ درخواست برای تأیید نقش مسئول (مدیر شرکت) ارسال و به‌صورت وظیفه پیگیری می‌شود."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => run(() => actions.requestTermination(e.id, note, formatDate(lastDay)), 'درخواست خاتمه برای تأیید ارسال شد')}>
              ارسال برای تأیید
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="آخرین روز کاری" required>
            {(p) => <DatePicker id={p.id} value={lastDay} onChange={setLastDay} clearable={false} />}
          </Field>
          <Field label="دلیل" required>
            {(p) => <Textarea id={p.id} value={note} onChange={(x) => setNote(x.target.value)} maxLength={500} />}
          </Field>
          <Callout tone="neutral">پس از تأیید، تسویه حساب، بیمه و قرارداد طبق فرایند شرکت انجام می‌شود.</Callout>
        </div>
      </Dialog>
    </>
  )
}
