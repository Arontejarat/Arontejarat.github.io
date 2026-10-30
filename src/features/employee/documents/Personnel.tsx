import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { CalendarClock, ChevronLeft, FileCheck2, FileText, FolderOpen, History, RefreshCw, Send, ShieldCheck, Upload } from 'lucide-react'
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  DatePicker,
  DocumentPreview,
  EmptyState,
  Field,
  FileUploader,
  Ltr,
  PageHeader,
  PageState,
  ProgressBar,
  Select,
  StatusBadge,
  Timeline,
  useToast,
} from '@/components/ui'
import { useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { currentVersion, documentStatus, employeeDocumentChecklist } from '@/mock/selectors'
import { DOC_CATEGORIES, DOC_TYPES, docType } from '@/config/documentTypes'
import { DOC_STATUS } from '@/config/status'
import { daysUntil, formatDate, formatDeadline, formatFileSize, formatNumber, toFaDigits } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import { cn } from '@/lib/cn'
import type { Attachment, DocStatus, PersonnelDocument } from '@/types/domain'
import { acceptLabel } from '@/components/ui/FileUploader'
import { DocumentsTabs } from './DocumentsHub'
import { OperationResult } from '@/features/system/SystemPages'

/** Statuses in which the employee may upload a (new) version */
export function canReplace(doc: PersonnelDocument | undefined) {
  const s = documentStatus(doc)
  if (s === 'not_submitted' || s === 'rejected' || s === 'needs_fix' || s === 'expired') return true
  if (s === 'approved' && doc?.expiresAt && daysUntil(doc.expiresAt) <= 30) return true
  return false
}

/* ---------------- DOC-01 ---------------- */

export function PersonnelListPage() {
  return (
    <>
      <PageHeader
        title="مدارک پرسنلی"
        description="مدارک موردنیاز پرونده خود را ارسال کنید و نتیجه بررسی را پیگیری کنید."
        breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'مدارک پرسنلی' }]}
        back={{ to: '/me/documents', label: 'اسناد من' }}
        actions={
          <ButtonLink to="/me/documents/personnel/upload" icon={Upload}>
            ارسال مدرک
          </ButtonLink>
        }
      />
      <DocumentsTabs />
      <PageState>{({ empty }) => <PersonnelList empty={empty} />}</PageState>
    </>
  )
}

function PersonnelList({ empty }: { empty: boolean }) {
  const db = useDB()
  const emp = useCurrentEmployee()
  const [status, setStatus] = useState('')
  const list = empty ? [] : employeeDocumentChecklist(db, emp)
  const extra = empty ? [] : db.documents.filter((d) => d.employeeId === emp.id && !list.some((x) => x.doc?.id === d.id)).map((d) => ({ type: docType(d.typeId)!, doc: d, status: documentStatus(d) }))
  const items = [...list, ...extra].filter((x) => !status || x.status === status)
  const required = list.filter((x) => x.type.required)
  const approved = required.filter((x) => x.status === 'approved').length

  if (empty) return <EmptyState icon={FolderOpen} title="هنوز مدرکی ارسال نکرده‌اید" description="برای تکمیل پرونده پرسنلی، مدارک هویتی، تحصیلی و استخدامی خود را ارسال کنید." action={<ButtonLink to="/me/documents/personnel/upload" icon={Upload}>ارسال اولین مدرک</ButtonLink>} />

  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-bold">تکمیل پرونده</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {formatNumber(approved)} از {formatNumber(required.length)} مدرک الزامی تأیید شده است.
          </p>
          <ProgressBar value={(approved / Math.max(1, required.length)) * 100} tone={approved === required.length ? 'success' : 'brand'} className="mt-2.5" label="پیشرفت تکمیل مدارک الزامی" />
        </div>
        <Select aria-label="فیلتر وضعیت" className="w-full sm:w-52" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={(Object.keys(DOC_STATUS) as DocStatus[]).map((s) => ({ value: s, label: DOC_STATUS[s].label }))} />
      </Card>
      {DOC_CATEGORIES.map((cat) => {
        const rows = items.filter((x) => x.type.category === cat.id)
        if (rows.length === 0) return null
        return (
          <section key={cat.id}>
            <h2 className="mb-2 text-sm font-bold text-ink-800">
              {cat.title} <span className="font-normal text-ink-500">— {cat.description}</span>
            </h2>
            <Card padded={false}>
              <ul className="divide-y divide-ink-100">
                {rows.map(({ type, doc, status: s }) => {
                  const v = doc ? currentVersion(doc) : undefined
                  const to = doc ? `/me/documents/personnel/${doc.id}` : `/me/documents/personnel/upload?type=${type.id}`
                  const dl = v?.fixDeadline && ['needs_fix', 'rejected'].includes(s) ? formatDeadline(v.fixDeadline) : null
                  return (
                    <li key={type.id + (doc?.id ?? '')}>
                      <Link to={to} className="flex items-start gap-3 px-4 py-3.5 hover:bg-ink-25 sm:items-center">
                        <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', s === 'approved' ? 'bg-emerald-50 text-emerald-600' : ['rejected', 'needs_fix', 'expired'].includes(s) ? 'bg-red-50 text-red-600' : s === 'pending' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-400')}>
                          <FileText size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink-900">{type.title}</span>
                            {type.required ? <Badge size="sm" tone="muted">الزامی</Badge> : null}
                            <StatusBadge meta={DOC_STATUS[s]} size="sm" className="sm:hidden" />
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-500">
                            {v ? `نسخه ${toFaDigits(v.version)}، ارسال ${formatDate(v.uploadedAt)}` : 'ارسال نشده'}
                            {doc?.expiresAt ? `، اعتبار تا ${formatDate(doc.expiresAt)}` : ''}
                          </span>
                          {v?.reason && ['rejected', 'needs_fix'].includes(s) ? <span className="mt-1 block text-xs font-medium text-red-700">علت: {v.reason}</span> : null}
                          {dl ? <span className="mt-0.5 block text-xs text-amber-700">مهلت اصلاح: {dl.text}</span> : null}
                        </span>
                        <StatusBadge meta={DOC_STATUS[s]} className="max-sm:hidden" />
                        <ChevronLeft size={16} className="self-center text-ink-300" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </section>
        )
      })}
      {items.length === 0 ? <EmptyState compact icon={FolderOpen} title="مدرکی با این وضعیت وجود ندارد" /> : null}
    </div>
  )
}

/* ---------------- DOC-02 / DOC-04 ---------------- */

export function DocumentUploadPage() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const actions = useActions()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [typeId, setTypeId] = useState(params.get('type') ?? '')
  const [files, setFiles] = useState<Attachment[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<{ docId: string; receiptNo: string; version: number } | null>(null)
  const t = docType(typeId)
  const existing = db.documents.find((d) => d.employeeId === emp.id && d.typeId === typeId)
  const replaceable = canReplace(existing)
  const step = !t ? 1 : files.length === 0 ? 2 : 3

  const typeOptions = useMemo(
    () =>
      DOC_CATEGORIES.flatMap((c) =>
        DOC_TYPES.filter((d) => d.category === c.id).map((d) => {
          const ex = db.documents.find((x) => x.employeeId === emp.id && x.typeId === d.id)
          const ok = canReplace(ex)
          return { value: d.id, label: `${c.title} — ${d.title}${ex && !ok ? ` (${DOC_STATUS[documentStatus(ex)].label})` : ''}`, disabled: !ok }
        }),
      ),
    [db.documents, emp.id],
  )

  if (receipt) {
    return (
      <OperationResult
        title="مدرک با موفقیت ارسال شد"
        description="مدرک شما در صف بررسی قرار گرفت. نتیجه بررسی از طریق اعلان به شما اطلاع داده می‌شود."
        details={[
          { label: 'شماره رسید', value: <Ltr>{receipt.receiptNo}</Ltr> },
          { label: 'نوع مدرک', value: t?.title },
          { label: 'نسخه', value: toFaDigits(receipt.version) },
          { label: 'زمان ارسال', value: formatDate(new Date(), 'datetime') },
          { label: 'وضعیت', value: <StatusBadge meta={DOC_STATUS.pending} size="sm" /> },
        ]}
        actions={
          <>
            <ButtonLink to={`/me/documents/personnel/${receipt.docId}`}>مشاهده مدرک</ButtonLink>
            <ButtonLink to="/me/documents/personnel" variant="outline">
              بازگشت به مدارک
            </ButtonLink>
          </>
        }
      />
    )
  }

  const submit = async () => {
    if (!t || busy) return
    const next: Record<string, string> = {}
    if (files.length === 0) next.file = 'فایل مدرک را انتخاب کنید.'
    if (t.hasExpiry && !expiresAt) next.expiresAt = 'تاریخ پایان اعتبار را انتخاب کنید.'
    if (expiresAt && expiresAt <= toISODate(new Date())) next.expiresAt = 'تاریخ اعتبار باید بعد از امروز باشد.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const f = files[0]
      const { doc, version } = await actions.uploadPersonnelDocument({ typeId: t.id, fileName: f.name, size: f.size, mime: f.mime, previewUrl: f.previewUrl, expiresAt: expiresAt || undefined })
      setReceipt({ docId: doc.id, receiptNo: version.receiptNo, version: version.version })
    } catch (e) {
      toast.fromError(e, 'ارسال مدرک انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  const steps = ['انتخاب نوع مدرک', 'انتخاب فایل', 'پیش‌نمایش و ارسال']
  return (
    <>
      <PageHeader title={existing ? 'ارسال نسخه جدید مدرک' : 'ارسال مدرک'} breadcrumbs={[{ label: 'مدارک پرسنلی', to: '/me/documents/personnel' }, { label: 'ارسال مدرک' }]} back={{ to: '/me/documents/personnel', label: 'مدارک پرسنلی' }} />
      <div className="mx-auto max-w-2xl space-y-4">
        <ol className="flex items-center gap-2" aria-label="مراحل ارسال">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2" aria-current={step === i + 1 ? 'step' : undefined}>
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-brand-800 text-white' : 'bg-ink-200 text-ink-600')}>{toFaDigits(i + 1)}</span>
              <span className={cn('hidden text-xs sm:block', step === i + 1 ? 'font-semibold text-ink-900' : 'text-ink-500')}>{s}</span>
              {i < steps.length - 1 ? <span className="h-px flex-1 bg-ink-200" aria-hidden /> : null}
            </li>
          ))}
        </ol>
        <Card>
          <Field label="نوع مدرک" required helper="مدارکی که تأیید شده‌اند یا در انتظار بررسی هستند، فعلاً قابل جایگزینی نیستند.">
            {(p) => (
              <Select
                id={p.id}
                aria-describedby={p.describedBy}
                value={typeId}
                onChange={(e) => {
                  setTypeId(e.target.value)
                  setFiles([])
                }}
                placeholder="انتخاب کنید"
                options={typeOptions}
              />
            )}
          </Field>
          {t ? (
            <div className="mt-5 space-y-5">
              {existing && replaceable ? (
                <Callout tone="info" icon={RefreshCw} title="ارسال نسخه جدید">
                  نسخه قبلی ({toFaDigits(currentVersion(existing).version)}) و علت رد آن در سوابق حفظ می‌شود.
                  {currentVersion(existing).reason ? ` علت: ${currentVersion(existing).reason}` : ''}
                </Callout>
              ) : null}
              {existing && !replaceable ? <Callout tone="warning">این مدرک در وضعیت «{DOC_STATUS[documentStatus(existing)].label}» است و فعلاً قابل جایگزینی نیست.</Callout> : null}
              <div className="rounded-lg border border-ink-200 bg-ink-25 p-3.5 text-sm">
                <p className="font-semibold text-ink-900">الزامات فایل</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[13px] leading-6 text-ink-700">
                  <li>{t.requirements}</li>
                  <li>
                    فرمت مجاز: {acceptLabel(t.accept)} — حداکثر حجم {toFaDigits(t.maxSizeMb)} مگابایت
                  </li>
                  <li>مرجع بررسی: {t.reviewParty === 'org' ? 'سازمان محل خدمت' : 'شرکت تأمین نیرو'}</li>
                </ul>
                {t.sensitive ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-accent-700">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden /> اطلاعات حساس: فقط مسئولان مجاز به این فایل دسترسی دارند.
                  </p>
                ) : null}
              </div>
              {replaceable || !existing ? (
                <>
                  <Field label="فایل مدرک" required error={errors.file}>
                    {(p) => <FileUploader id={p.id} describedBy={p.describedBy} invalid={p.invalid} value={files} onChange={setFiles} accept={t.accept} maxSizeMb={t.maxSizeMb} maxFiles={1} />}
                  </Field>
                  {t.hasExpiry ? (
                    <Field label="تاریخ پایان اعتبار مدرک" required error={errors.expiresAt} helper="برای یادآوری پیش از انقضا استفاده می‌شود.">
                      {(p) => <DatePicker id={p.id} describedBy={p.describedBy} invalid={p.invalid} value={expiresAt} onChange={setExpiresAt} min={toISODate(new Date())} />}
                    </Field>
                  ) : null}
                  {files[0] ? (
                    <div>
                      <p className="mb-2 text-sm font-semibold">پیش‌نمایش</p>
                      <DocumentPreview source={{ fileName: files[0].name, mime: files[0].mime, previewUrl: files[0].previewUrl, title: t.title }} />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => navigate(-1)}>
              انصراف
            </Button>
            <Button icon={Send} onClick={submit} loading={busy} disabled={!t || (existing && !replaceable) || files.length === 0}>
              تأیید و ارسال
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ---------------- DOC-03 ---------------- */

export function DocumentDetailPage() {
  const { id } = useParams()
  const db = useDB()
  const emp = useCurrentEmployee()
  const doc = db.documents.find((d) => d.id === id)
  const [shownVersion, setShownVersion] = useState<number | null>(null)
  if (!doc) return <Navigate to="/me/documents/personnel" replace />
  if (doc.employeeId !== emp.id) return <Navigate to="/forbidden" replace />
  const t = docType(doc.typeId)!
  const s = documentStatus(doc)
  const cur = currentVersion(doc)
  const shown = doc.versions.find((v) => v.version === (shownVersion ?? cur.version)) ?? cur
  const replaceable = canReplace(doc)
  const expDays = doc.expiresAt ? daysUntil(doc.expiresAt) : null
  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'مدارک پرسنلی', to: '/me/documents/personnel' }, { label: t.title }]}
        back={{ to: '/me/documents/personnel', label: 'مدارک پرسنلی' }}
        meta={<StatusBadge meta={DOC_STATUS[s]} />}
        actions={
          replaceable ? (
            <ButtonLink to={`/me/documents/personnel/upload?type=${t.id}`} icon={RefreshCw}>
              {s === 'approved' ? 'تمدید / ارسال نسخه جدید' : 'اصلاح و ارسال نسخه جدید'}
            </ButtonLink>
          ) : null
        }
      />
      <div className="mb-5 space-y-3">
        {['rejected', 'needs_fix'].includes(s) ? (
          <Callout tone={s === 'rejected' ? 'danger' : 'warning'} title={s === 'rejected' ? 'مدرک رد شد' : 'مدرک نیازمند اصلاح است'}>
            {cur.reason}
            {cur.fixDeadline ? ` — مهلت اصلاح: ${formatDate(cur.fixDeadline)} (${formatDeadline(cur.fixDeadline).text})` : ''}
          </Callout>
        ) : null}
        {s === 'pending' ? <Callout tone="info" title="در انتظار بررسی">مدرک شما در صف بررسی {t.reviewParty === 'org' ? 'سازمان محل خدمت' : 'شرکت تأمین نیرو'} است.</Callout> : null}
        {expDays !== null && expDays >= 0 && expDays <= 30 ? (
          <Callout tone="warning" icon={CalendarClock} title="اعتبار مدرک رو به پایان است">
            اعتبار این مدرک {toFaDigits(expDays)} روز دیگر ({formatDate(doc.expiresAt)}) به پایان می‌رسد. نسخه جدید را پیش از انقضا ارسال کنید.
          </Callout>
        ) : null}
        {s === 'expired' ? <Callout tone="danger" icon={CalendarClock} title="مدرک منقضی شده است">برای تکمیل پرونده، نسخه معتبر جدید را ارسال کنید.</Callout> : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title={`پیش‌نمایش نسخه ${toFaDigits(shown.version)}`} description={<span dir="auto">{shown.fileName}</span>} />
          <DocumentPreview source={{ fileName: shown.fileName, mime: shown.mime, previewUrl: shown.previewUrl, title: t.title }} watermark={t.sensitive ? `${emp.firstName} ${emp.lastName} — فقط برای مشاهده` : undefined} />
        </Card>
        <aside className="space-y-5">
          <Card>
            <CardHeader title="جزئیات" icon={FileCheck2} />
            <dl className="space-y-2.5 text-sm">
              {[
                ['دسته', DOC_CATEGORIES.find((c) => c.id === t.category)?.title],
                ['تاریخ ارسال', formatDate(shown.uploadedAt, 'datetime')],
                ['حجم', formatFileSize(shown.size)],
                ['شماره رسید', <Ltr key="r">{shown.receiptNo}</Ltr>],
                ['بررسی‌کننده', shown.reviewer ?? '—'],
                ['تاریخ بررسی', shown.reviewedAt ? formatDate(shown.reviewedAt, 'datetime') : '—'],
                ['اعتبار تا', doc.expiresAt ? formatDate(doc.expiresAt) : 'بدون تاریخ اعتبار'],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-end font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="سوابق نسخه‌ها" icon={History} description="نسخه‌های قبلی و علت رد آن‌ها حفظ می‌شوند." />
            <Timeline
              items={[...doc.versions].reverse().map((v) => ({
                id: String(v.version),
                icon: FileText,
                tone: DOC_STATUS[v.status].tone,
                current: v.version === shown.version,
                title: (
                  <button type="button" className="text-start hover:text-brand-700 hover:underline" onClick={() => setShownVersion(v.version)}>
                    نسخه {toFaDigits(v.version)} — {DOC_STATUS[v.status].label}
                  </button>
                ),
                time: formatDate(v.uploadedAt),
                body: v.reason ? `علت: ${v.reason}` : v.reviewer ? `بررسی: ${v.reviewer}` : 'در انتظار بررسی',
              }))}
            />
          </Card>
        </aside>
      </div>
    </>
  )
}
