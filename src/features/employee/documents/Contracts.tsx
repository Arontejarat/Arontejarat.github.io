import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, Download, Eye, FileSignature, History, MessageSquareText, PenLine, Printer, Scale, SearchX, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react'
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  DescriptionList,
  EmptyState,
  FilterBar,
  Ltr,
  OtpInput,
  PageHeader,
  PageState,
  SearchInput,
  Select,
  StatusBadge,
  Timeline,
  useToast,
  type Column,
} from '@/components/ui'
import { DEMO_OTP, useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, employeeContractStatus } from '@/mock/selectors'
import { EMPLOYEE_CONTRACT_STATUS, type EmployeeContractStatus } from '@/config/status'
import { formatDate, formatDeadline, formatPeriod, mask, toEnDigits, toFaDigits } from '@/lib/format'
import { JALALI_MONTHS } from '@/lib/jalali'
import { sleep } from '@/lib/cn'
import type { Contract } from '@/types/domain'
import { ContractBody, SignaturePanel, versionLabel } from '@/features/contracts/ContractParts'
import { DocumentsTabs } from './DocumentsHub'
import { OperationResult } from '@/features/system/SystemPages'
import { mmss } from '@/features/auth/AuthPages'

/* ---------------- CTR-01 ---------------- */

export function ContractListPage() {
  return (
    <>
      <PageHeader title="قراردادهای ماهانه" description="آرشیو قراردادهای شما؛ قرارداد هر ماه پیش از شروع دوره برای امضا ارسال می‌شود." breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'قراردادها' }]} back={{ to: '/me/documents', label: 'اسناد من' }} />
      <DocumentsTabs />
      <PageState>{({ empty }) => <ContractList empty={empty} />}</PageState>
    </>
  )
}

function ContractList({ empty }: { empty: boolean }) {
  const db = useDB()
  const emp = useCurrentEmployee()
  const [params] = useSearchParams()
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [q, setQ] = useState('')
  const all = empty ? [] : db.contracts.filter((c) => c.employeeId === emp.id && c.stage !== 'superseded')
  const years = [...new Set(all.map((c) => c.periodYear!))].sort((a, b) => b - a)
  const rows = useMemo(
    () =>
      all
        .filter((c) => (!year || String(c.periodYear) === year) && (!month || String(c.periodMonth) === month) && (!status || employeeContractStatus(c) === status))
        .filter((c) => !q || c.number.toUpperCase().includes(toEnDigits(q).toUpperCase()) || JALALI_MONTHS[(c.periodMonth ?? 1) - 1].includes(q))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [all, year, month, status, q],
  )
  if (all.length === 0) return <EmptyState icon={FileSignature} title="قراردادی برای شما صادر نشده است" description="پس از صدور قرارداد ماهانه توسط شرکت، از طریق اعلان باخبر می‌شوید و قرارداد در این بخش نمایش داده می‌شود." />

  const columns: Column<Contract>[] = [
    { id: 'period', header: 'دوره', cell: (c) => <span className="font-semibold">{formatPeriod(c.periodYear!, c.periodMonth!)}</span>, sortValue: (c) => c.startDate },
    { id: 'company', header: 'شرکت طرف قرارداد', cell: (c) => companyById(db, c.companyId)?.name, hideable: true, label: 'شرکت' },
    { id: 'job', header: 'عنوان شغلی', cell: (c) => c.jobTitle, hideable: true, label: 'عنوان شغلی' },
    { id: 'place', header: 'محل خدمت', cell: (c) => <span className="text-xs">{c.workplace}</span>, hideable: true, defaultHidden: true, label: 'محل خدمت' },
    { id: 'range', header: 'شروع و پایان', cell: (c) => <span className="whitespace-nowrap text-xs">{formatDate(c.startDate, 'short')} – {formatDate(c.endDate, 'short')}</span> },
    { id: 'status', header: 'وضعیت', cell: (c) => <StatusBadge meta={EMPLOYEE_CONTRACT_STATUS[employeeContractStatus(c)]} /> },
    { id: 'signed', header: 'تاریخ امضای شما', cell: (c) => (c.employeeSignature ? formatDate(c.employeeSignature.signedAt) : '—') },
    {
      id: 'act',
      header: <span className="sr-only">عملیات</span>,
      cell: (c) =>
        employeeContractStatus(c) === 'ready' || employeeContractStatus(c) === 'viewed' ? (
          <ButtonLink to={`/me/documents/contracts/${c.id}`} size="xs" icon={PenLine}>
            مشاهده و امضا
          </ButtonLink>
        ) : (
          <ButtonLink to={`/me/documents/contracts/${c.id}`} size="xs" variant="ghost" icon={Eye}>
            مشاهده
          </ButtonLink>
        ),
    },
  ]
  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="جست‌وجو با شماره قرارداد یا نام ماه" />}
        activeCount={[year, month, status].filter(Boolean).length}
        onClear={() => {
          setYear('')
          setMonth('')
          setStatus('')
        }}
      >
        <Select aria-label="سال" className="w-full sm:w-36" value={year} onChange={(e) => setYear(e.target.value)} placeholder="همه سال‌ها" options={years.map((y) => ({ value: String(y), label: toFaDigits(y) }))} />
        <Select aria-label="ماه" className="w-full sm:w-36" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="همه ماه‌ها" options={JALALI_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Select aria-label="وضعیت" className="w-full sm:w-52" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={(Object.keys(EMPLOYEE_CONTRACT_STATUS) as EmployeeContractStatus[]).map((s) => ({ value: s, label: EMPLOYEE_CONTRACT_STATUS[s].label }))} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(c) => c.id}
        columnChooser
        rowHref={(c) => `/me/documents/contracts/${c.id}`}
        caption="فهرست قراردادهای ماهانه"
        mobileCard={(c) => {
          const s = employeeContractStatus(c)
          return (
            <Link to={`/me/documents/contracts/${c.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">قرارداد {formatPeriod(c.periodYear!, c.periodMonth!)}</p>
                  <p className="text-xs text-ink-500">{c.jobTitle}</p>
                </div>
                <StatusBadge meta={EMPLOYEE_CONTRACT_STATUS[s]} size="sm" />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                <span>{c.employeeSignature ? `امضای شما: ${formatDate(c.employeeSignature.signedAt)}` : c.signDeadline ? `مهلت امضا: ${formatDeadline(c.signDeadline).text}` : formatDate(c.startDate)}</span>
                <ChevronLeft size={16} aria-hidden />
              </div>
            </Link>
          )
        }}
        empty={<EmptyState compact icon={SearchX} title="قراردادی با این فیلترها پیدا نشد" />}
      />
    </>
  )
}

/* ---------------- CTR-02 ---------------- */

function useMyContract() {
  const { id } = useParams()
  const db = useDB()
  const emp = useCurrentEmployee()
  const c = db.contracts.find((x) => x.id === id)
  return { c: c && c.employeeId === emp.id ? c : undefined, exists: Boolean(c), db, emp }
}

export function ContractViewPage() {
  const { c, exists, db, emp } = useMyContract()
  const actions = useActions()
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)
  const viewedRef = useRef(false)
  useEffect(() => {
    if (c && c.stage === 'awaiting_worker' && !c.viewedAt && !viewedRef.current) {
      viewedRef.current = true
      void actions.markContractViewed(c.id).catch(() => undefined)
    }
  }, [c, actions])
  if (!c) return exists ? <Navigate to="/forbidden" replace /> : <Navigate to="/me/documents/contracts" replace />
  const s = employeeContractStatus(c)
  const canSign = c.stage === 'awaiting_worker' && !c.employeeSignature
  const dl = c.signDeadline ? formatDeadline(c.signDeadline) : null
  const versions = db.contracts.filter((x) => x.employeeId === emp.id && x.periodYear === c.periodYear && x.periodMonth === c.periodMonth && x.id !== c.id)

  return (
    <>
      <PageHeader
        title={`قرارداد ${formatPeriod(c.periodYear!, c.periodMonth!)}`}
        breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'قراردادها', to: '/me/documents/contracts' }, { label: c.number }]}
        back={{ to: '/me/documents/contracts', label: 'قراردادها' }}
        meta={
          <>
            <StatusBadge meta={EMPLOYEE_CONTRACT_STATUS[s]} />
            <span className="text-xs text-ink-500">
              شماره <Ltr>{c.number}</Ltr>، نسخه {toFaDigits(c.version)}
            </span>
          </>
        }
        actions={
          <Button variant="outline" icon={s === 'completed' ? Download : Printer} onClick={() => window.print()} className="no-print">
            {s === 'completed' ? 'دریافت نسخه نهایی (PDF)' : 'چاپ / ذخیره PDF'}
          </Button>
        }
      />
      {canSign ? (
        <Callout tone="warning" icon={PenLine} title="این قرارداد منتظر امضای شماست" className="no-print mb-5">
          متن کامل قرارداد را مطالعه کنید، سپس با تأیید پذیرش و وارد کردن کد پیامکی امضا کنید.
          {dl ? ` مهلت امضا: ${formatDate(c.signDeadline)} (${dl.text}).` : ''}
        </Callout>
      ) : s === 'signed_by_me' ? (
        <Callout tone="info" icon={ShieldCheck} title="امضای شما ثبت شد" className="no-print mb-5" action={<ButtonLink to={`/me/documents/contracts/${c.id}/receipt`} size="sm" variant="outline">مشاهده رسید</ButtonLink>}>
          امضای شرکت هنوز ثبت نشده است. پس از تکمیل امضاها، نسخه نهایی قابل دریافت می‌شود.
        </Callout>
      ) : s === 'preparing' ? (
        <Callout tone="neutral" title="قرارداد در حال آماده‌سازی است" className="no-print mb-5">
          پس از نهایی شدن توسط شرکت، برای امضا ارسال می‌شود. در حال حاضر اقدامی از طرف شما لازم نیست.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="print-area">
          <ContractBody c={c} db={db} employee={emp} />
          {canSign ? (
            <div className="no-print mt-8 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <Checkbox checked={accepted} onChange={setAccepted} label="متن کامل قرارداد را مطالعه کردم و مفاد آن را می‌پذیرم." description={`این تأیید برای نسخه ${versionLabel(c)} ثبت می‌شود.`} />
              <Button className="mt-4" icon={MessageSquareText} disabled={!accepted} onClick={() => navigate(`/me/documents/contracts/${c.id}/sign`, { state: { hash: c.versionHash } })} block>
                تأیید و امضا با کد پیامکی
              </Button>
              {!accepted ? <p className="mt-2 text-center text-xs text-ink-500">برای ادامه، ابتدا پذیرش مفاد قرارداد را تأیید کنید.</p> : null}
            </div>
          ) : null}
        </Card>
        <aside className="no-print space-y-5">
          <Card>
            <CardHeader title="وضعیت امضا" description="امضای شما و سایر طرف‌ها جداگانه پیگیری می‌شود." />
            <SignaturePanel c={c} highlightRole="worker" />
          </Card>
          <Card>
            <CardHeader title="مشخصات" />
            <DescriptionList
              columns={1}
              items={[
                { label: 'شرکت طرف قرارداد', value: companyById(db, c.companyId)?.name },
                { label: 'عنوان شغلی', value: c.jobTitle },
                { label: 'محل خدمت', value: c.workplace },
                { label: 'مدت', value: `${formatDate(c.startDate)} تا ${formatDate(c.endDate)}` },
                { label: 'شناسه نسخه', value: <Ltr mono>{versionLabel(c)}</Ltr> },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="سوابق تأیید" icon={History} />
            <Timeline items={[...c.history].reverse().map((h, i) => ({ id: h.id, icon: History, tone: i === 0 ? 'brand' : 'neutral', title: h.text, time: formatDate(h.at, 'datetime'), body: h.actor }))} />
            {versions.length ? (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <p className="text-xs font-semibold text-ink-600">نسخه‌های دیگر این دوره</p>
                {versions.map((v) => (
                  <Link key={v.id} to={`/me/documents/contracts/${v.id}`} className="mt-1.5 flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-ink-50">
                    <span>
                      نسخه {toFaDigits(v.version)} — <Ltr>{v.number}</Ltr>
                    </span>
                    <Badge size="sm" tone="muted">
                      {v.stage === 'superseded' ? 'جایگزین‌شده' : 'فعال'}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  )
}

/* ---------------- CTR-03 ---------------- */

export function ContractSignPage() {
  const { c, exists, db, emp } = useMyContract()
  const actions = useActions()
  const navigate = useNavigate()
  const toast = useToast()
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [busy, setBusy] = useState(false)
  const [sentAt, setSentAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  if (!c) return exists ? <Navigate to="/forbidden" replace /> : <Navigate to="/me/documents/contracts" replace />
  // Already signed (e.g. right after signing, or revisiting the URL) → show the receipt
  if (c.employeeSignature) return <Navigate to={`/me/documents/contracts/${c.id}/receipt?new=1`} replace />
  if (c.stage !== 'awaiting_worker') return <Navigate to={`/me/documents/contracts/${c.id}`} replace />

  const ttl = db.settings.signatureOtpTtlSec
  const max = db.settings.otpMaxAttempts
  const cooldown = db.settings.otpResendCooldownSec
  const elapsed = sent ? Math.floor((now - sentAt) / 1000) : 0
  const left = Math.max(0, ttl - elapsed)
  const resendIn = Math.max(0, cooldown - elapsed)
  const locked = attempts >= max

  const send = async () => {
    setSending(true)
    await sleep(700)
    setSending(false)
    setSent(true)
    setSentAt(Date.now())
    setNow(Date.now())
    setAttempts(0)
    setCode('')
    setError('')
    toast.info('کد تأیید ارسال شد', `به شماره \u2066${emp.mobile.slice(0, 4)}•••${emp.mobile.slice(-4)}\u2069`)
  }

  const sign = async () => {
    if (busy) return
    if (toEnDigits(code).length < 5) return setError('کد ۵ رقمی را کامل وارد کنید.')
    if (left === 0) return setError('مهلت استفاده از کد پایان یافته است. کد جدید دریافت کنید.')
    if (toEnDigits(code) !== DEMO_OTP) {
      const n = attempts + 1
      setAttempts(n)
      setCode('')
      return setError(n >= max ? 'تعداد تلاش‌های مجاز به پایان رسید. کد جدید دریافت کنید.' : `کد واردشده صحیح نیست. ${toFaDigits(max - n)} تلاش دیگر باقی مانده است.`)
    }
    setBusy(true)
    try {
      await actions.signContractByEmployee(c.id, c.versionHash)
      navigate(`/me/documents/contracts/${c.id}/receipt?new=1`, { replace: true })
    } catch (e) {
      toast.fromError(e, 'امضا ثبت نشد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="امضای قرارداد" breadcrumbs={[{ label: 'قراردادها', to: '/me/documents/contracts' }, { label: c.number, to: `/me/documents/contracts/${c.id}` }, { label: 'امضا' }]} back={{ to: `/me/documents/contracts/${c.id}`, label: 'بازگشت به قرارداد' }} />
      <div className="mx-auto max-w-lg space-y-4">
        <Card>
          <h2 className="text-sm font-bold">سندی که امضا می‌کنید</h2>
          <dl className="mt-3 divide-y divide-ink-100 rounded-lg border border-ink-200 text-sm">
            {[
              ['قرارداد', `ماهانه ${formatPeriod(c.periodYear!, c.periodMonth!)}`],
              ['شماره', <Ltr key="n">{c.number}</Ltr>],
              ['شناسه نسخه', <Ltr key="h" mono>{versionLabel(c)}</Ltr>],
              ['امضاکننده', `${emp.firstName} ${emp.lastName}`],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-ink-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          {!sent ? (
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
                <Smartphone size={22} aria-hidden />
              </span>
              <p className="mt-3 text-sm leading-7 text-ink-700">
                کد تأیید به شماره موبایل تأییدشده شما{' '}
                <Ltr className="font-semibold">
                  {emp.mobile.slice(0, 4)}
                  {mask(emp.mobile.slice(4), 4)}
                </Ltr>{' '}
                ارسال می‌شود.
              </p>
              <Button className="mt-4" block onClick={send} loading={sending} icon={MessageSquareText}>
                ارسال کد تأیید
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-4 text-center text-sm text-ink-700">کد ۵ رقمی ارسال‌شده را وارد کنید.</p>
              <OtpInput value={code} onChange={(v) => { setCode(v); setError('') }} invalid={Boolean(error)} disabled={locked || busy} autoFocus />
              {error ? (
                <p role="alert" className="mt-3 text-center text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : null}
              <p className="mt-3 text-center text-xs text-ink-500" aria-live="polite">
                {left > 0 ? <>اعتبار کد: <span className="font-semibold tabular">{mmss(left)}</span></> : <span className="text-red-700">کد منقضی شد.</span>}
              </p>
              <Button className="mt-4" block icon={FileSignature} onClick={sign} loading={busy} disabled={locked}>
                ثبت امضا
              </Button>
              <div className="mt-3 text-center">
                <Button variant="link" size="sm" onClick={send} disabled={resendIn > 0 || sending}>
                  {resendIn > 0 ? `ارسال مجدد کد تا ${mmss(resendIn)} دیگر` : 'ارسال مجدد کد'}
                </Button>
              </div>
              <p className="mt-3 rounded-md bg-ink-50 p-2 text-center text-2xs text-ink-500">
                محیط نمایشی: کد <bdi dir="ltr" className="font-mono font-semibold">{DEMO_OTP}</bdi>
              </p>
            </div>
          )}
        </Card>
        <Callout tone="neutral" icon={Scale} title="درباره اعتبار امضا">
          با وارد کردن کد، پذیرش شما همراه با تاریخ، ساعت، شناسه نسخه و نتیجه احراز هویت ثبت می‌شود. اعتبار حقوقی امضا بر اساس روش امضای مصوب و قوانین قابل اعمال تعیین می‌شود و کد پیامکی به‌تنهایی در همه شرایط جایگزین امضای الکترونیکی معتبر نیست.
        </Callout>
      </div>
    </>
  )
}

/* ---------------- CTR-04 ---------------- */

export function ContractReceiptPage() {
  const { c, exists, emp } = useMyContract()
  const [params] = useSearchParams()
  if (!c) return exists ? <Navigate to="/forbidden" replace /> : <Navigate to="/me/documents/contracts" replace />
  if (!c.employeeSignature) return <Navigate to={`/me/documents/contracts/${c.id}`} replace />
  const pendingOthers = c.parties.filter((p) => p.role !== 'worker' && p.required && !p.signedAt)
  const sig = c.employeeSignature
  return (
    <>
      {params.get('new') ? null : <PageHeader title="رسید امضا" breadcrumbs={[{ label: 'قراردادها', to: '/me/documents/contracts' }, { label: c.number, to: `/me/documents/contracts/${c.id}` }, { label: 'رسید' }]} back={{ to: `/me/documents/contracts/${c.id}`, label: 'قرارداد' }} />}
      <OperationResult
        title={params.get('new') ? 'امضای شما با موفقیت ثبت شد' : 'رسید امضای قرارداد'}
        description={
          pendingOthers.length ? (
            <span className="inline-flex items-start gap-1.5 text-start">
              <TriangleAlert size={16} className="mt-1 shrink-0 text-amber-600" aria-hidden />
              <span>امضای {pendingOthers.map((p) => p.name).join('، ')} هنوز ثبت نشده است. قرارداد پس از تکمیل همه امضاها نهایی می‌شود و به شما اطلاع داده خواهد شد.</span>
            </span>
          ) : (
            'همه امضاهای موردنیاز تکمیل شده و نسخه نهایی قرارداد قابل دریافت است.'
          )
        }
        details={[
          { label: 'شماره رسید', value: <Ltr>{sig.receiptNo}</Ltr> },
          { label: 'شماره قرارداد', value: <Ltr>{c.number}</Ltr> },
          { label: 'شناسه نسخه امضاشده', value: <Ltr mono>{versionLabel(c)}</Ltr> },
          { label: 'امضاکننده', value: `${emp.firstName} ${emp.lastName}` },
          { label: 'تاریخ و ساعت', value: formatDate(sig.signedAt, 'datetime') },
          { label: 'روش احراز هویت', value: 'کد یک‌بارمصرف پیامکی — موفق' },
          { label: 'شماره موبایل', value: <Ltr>{`${sig.mobile.slice(0, 4)}•••${sig.mobile.slice(-4)}`}</Ltr> },
        ]}
        actions={
          <>
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>
              چاپ رسید
            </Button>
            {pendingOthers.length === 0 ? (
              <ButtonLink to={`/me/documents/contracts/${c.id}`} icon={Download}>
                دریافت نسخه نهایی
              </ButtonLink>
            ) : (
              <ButtonLink to={`/me/documents/contracts/${c.id}`}>مشاهده قرارداد</ButtonLink>
            )}
          </>
        }
      />
    </>
  )
}
