import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CircleCheck, CircleX, Download, FileCheck2, History, Info, Lock, RotateCcw, SearchX } from 'lucide-react'
import {
  Button,
  Callout,
  DataTable,
  DatePicker,
  Dialog,
  DocumentPreview,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Ltr,
  PageHeader,
  PageState,
  RadioGroup,
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
import { canReviewDocType, currentVersion, documentStatus, employeeById, fullName, projectById, projectInScope, scopedDocuments } from '@/mock/selectors'
import { DOC_REJECT_REASONS, DOC_TYPES, docType } from '@/config/documentTypes'
import { DOC_STATUS } from '@/config/status'
import { formatDate, formatDeadline, formatRelative, toFaDigits } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import type { DocStatus, PersonnelDocument } from '@/types/domain'
import { useMgmt } from './useMgmt'
import { OrgFilesPanel } from './OrgFiles'

export function DocumentReviewPage() {
  const m = useMgmt()
  const [view, setView] = useState('workers')
  return (
    <>
      <PageHeader title="بررسی مدارک" description="تأیید، رد یا اعلام نقص مدارک نیروها. نسخه‌های قبلی و علت رد هر نسخه حفظ می‌شود." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'بررسی مدارک' }]} />
      <Tabs
        className="mb-5"
        value={view}
        onChange={setView}
        tabs={[
          { id: 'workers', label: 'مدارک نیروها' },
          { id: 'org', label: m.isCompany ? 'اسناد ارسالی سازمان‌ها' : 'اسناد ارسالی شرکت‌ها' },
        ]}
      />
      {view === 'workers' ? <PageState>{({ empty }) => <Queue empty={empty} />}</PageState> : <OrgFilesPanel incoming />}
    </>
  )
}

function Queue({ empty }: { empty: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? 'pending')
  const [type, setType] = useState('')
  const [project, setProject] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const openId = params.get('doc')
  const all = empty ? [] : scopedDocuments(db, m.scope)
  const rows = useMemo(
    () =>
      all
        .filter((d) => {
          const e = employeeById(db, d.employeeId)!
          return (
            (!status || documentStatus(d) === status) &&
            (!type || d.typeId === type) &&
            (!project || e.projectId === project) &&
            (!mineOnly || canReviewDocType(m.role, d.typeId)) &&
            (!q || fullName(e).includes(q) || docType(d.typeId)?.title.includes(q))
          )
        })
        .sort((a, b) => currentVersion(b).uploadedAt.localeCompare(currentVersion(a).uploadedAt)),
    [all, status, type, project, mineOnly, q, db, m.role],
  )
  const reviewable = (d: PersonnelDocument) => m.can('documents.review') && canReviewDocType(m.role, d.typeId) && currentVersion(d).status === 'pending'
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('doc', id)
    else p.delete('doc')
    setParams(p, { replace: true })
  }
  const bulkDocs = [...selected].map((id) => db.documents.find((d) => d.id === id)!).filter((d) => d && reviewable(d))

  const columns: Column<PersonnelDocument>[] = [
    {
      id: 'owner',
      header: 'نیرو',
      cell: (d) => {
        const e = employeeById(db, d.employeeId)!
        return (
          <div>
            <p className="font-medium">{fullName(e)}</p>
            <p className="text-2xs text-ink-500">{projectById(db, e.projectId)?.name ?? '—'}</p>
          </div>
        )
      },
      sortValue: (d) => employeeById(db, d.employeeId)?.lastName ?? '',
    },
    {
      id: 'type',
      header: 'نوع مدرک',
      cell: (d) => (
        <span className="flex items-center gap-1.5">
          {docType(d.typeId)?.title}
          {docType(d.typeId)?.sensitive ? <Lock size={12} className="text-ink-400" aria-label="حساس" /> : null}
        </span>
      ),
    },
    { id: 'at', header: 'تاریخ بارگذاری', cell: (d) => <span className="text-xs">{formatDate(currentVersion(d).uploadedAt)}</span>, sortValue: (d) => currentVersion(d).uploadedAt },
    { id: 'v', header: 'نسخه', cell: (d) => toFaDigits(currentVersion(d).version), className: 'text-center' },
    { id: 'status', header: 'وضعیت', cell: (d) => <StatusBadge meta={DOC_STATUS[documentStatus(d)]} size="sm" /> },
    { id: 'rev', header: 'بررسی‌کننده', label: 'بررسی‌کننده', hideable: true, cell: (d) => <span className="text-xs">{currentVersion(d).reviewer ?? (docType(d.typeId)?.reviewParty === 'org' ? 'سازمان' : 'شرکت')}</span> },
    { id: 'reason', header: 'توضیح نقص', label: 'توضیح نقص', hideable: true, cell: (d) => <span className="line-clamp-1 max-w-48 text-xs text-ink-600">{currentVersion(d).reason ?? '—'}</span> },
    {
      id: 'dl',
      header: 'مهلت اصلاح',
      label: 'مهلت اصلاح',
      hideable: true,
      cell: (d) => {
        const v = currentVersion(d)
        if (!v.fixDeadline || !['needs_fix', 'rejected'].includes(v.status)) return '—'
        const dl = formatDeadline(v.fixDeadline)
        return <DeadlineBadge d={dl}>{dl.text}</DeadlineBadge>
      },
    },
    {
      id: 'act',
      header: <span className="sr-only">عملیات</span>,
      cell: (d) => (
        <Button size="xs" variant={reviewable(d) ? 'secondary' : 'ghost'} onClick={() => setOpen(d.id)}>
          {reviewable(d) ? 'بررسی' : 'مشاهده'}
        </Button>
      ),
    },
  ]

  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="نام نیرو یا نوع مدرک" />}
        activeCount={[status, type, project, mineOnly ? '1' : ''].filter(Boolean).length}
        onClear={() => {
          setStatus('')
          setType('')
          setProject('')
          setMineOnly(false)
        }}
      >
        <Select aria-label="وضعیت" className="w-full sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={(Object.keys(DOC_STATUS) as DocStatus[]).filter((s) => s !== 'not_submitted').map((s) => ({ value: s, label: DOC_STATUS[s].label }))} />
        <Select aria-label="نوع مدرک" className="w-full sm:w-48" value={type} onChange={(e) => setType(e.target.value)} placeholder="همه انواع مدرک" options={DOC_TYPES.map((t) => ({ value: t.id, label: t.title }))} />
        <Select aria-label="پروژه" className="w-full sm:w-48" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <Select aria-label="مرجع بررسی" className="w-full sm:w-48" value={mineOnly ? 'mine' : ''} onChange={(e) => setMineOnly(e.target.value === 'mine')} placeholder="همه مراجع بررسی" options={[{ value: 'mine', label: 'فقط مدارک در مسئولیت ما' }]} />
      </FilterBar>
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-sm font-medium text-brand-900">
            {toFaDigits(selected.size)} مدرک انتخاب شده ({toFaDigits(bulkDocs.length)} قابل بررسی توسط شما)
          </span>
          <div className="flex gap-2">
            <Button size="sm" icon={CircleCheck} disabled={bulkDocs.length === 0} onClick={() => setBulkOpen(true)}>
              تأیید گروهی
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              لغو انتخاب
            </Button>
          </div>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        columns={columns}
        getId={(d) => d.id}
        onRowClick={(d) => setOpen(d.id)}
        selectable={m.can('documents.review')}
        selected={selected}
        onSelectedChange={setSelected}
        columnChooser
        caption="صف بررسی مدارک"
        mobileCard={(d, sel) => {
          const e = employeeById(db, d.employeeId)!
          return (
            <div className="flex items-start gap-3">
              {sel ? <div className="pt-1">{sel}</div> : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{docType(d.typeId)?.title}</p>
                    <p className="text-xs text-ink-500">{fullName(e)}</p>
                  </div>
                  <StatusBadge meta={DOC_STATUS[documentStatus(d)]} size="sm" />
                </div>
                <p className="mt-1.5 text-2xs text-ink-500">
                  نسخه {toFaDigits(currentVersion(d).version)}، {formatRelative(currentVersion(d).uploadedAt)}
                </p>
              </div>
            </div>
          )
        }}
        empty={<EmptyState compact icon={status === 'pending' ? FileCheck2 : SearchX} title={status === 'pending' ? 'مدرکی در انتظار بررسی نیست' : 'مدرکی با این فیلترها پیدا نشد'} />}
      />
      {openId ? <ReviewDrawer docId={openId} onClose={() => setOpen(null)} /> : null}
      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        dismissable={!bulkBusy}
        title="تأیید گروهی مدارک"
        description="فقط مدارکی که در انتظار بررسی و در مسئولیت شما هستند تأیید می‌شوند. پیش از تأیید، فهرست را بازبینی کنید."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
              انصراف
            </Button>
            <Button
              icon={CircleCheck}
              loading={bulkBusy}
              onClick={async () => {
                setBulkBusy(true)
                let ok = 0
                for (const d of bulkDocs) {
                  try {
                    await actions.reviewDocument(d.id, 'approve')
                    ok += 1
                  } catch (e) {
                    toast.fromError(e)
                    break
                  }
                }
                setBulkBusy(false)
                setBulkOpen(false)
                setSelected(new Set())
                if (ok) toast.success(`${toFaDigits(ok)} مدرک تأیید شد`)
              }}
            >
              تأیید {toFaDigits(bulkDocs.length)} مدرک
            </Button>
          </>
        }
      >
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
          {bulkDocs.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{docType(d.typeId)?.title}</span>
              <span className="text-xs text-ink-500">{fullName(employeeById(db, d.employeeId)!)}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}

function ReviewDrawer({ docId, onClose }: { docId: string; onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const d = db.documents.find((x) => x.id === docId)
  const [decision, setDecision] = useState<'approve' | 'needs_fix' | 'reject'>('approve')
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const [deadline, setDeadline] = useState(toISODate(new Date(Date.now() + 5 * 86_400_000)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [versionShown, setVersionShown] = useState<number | null>(null)
  if (!d) return null
  const e = employeeById(db, d.employeeId)!
  const t = docType(d.typeId)!
  const cur = currentVersion(d)
  const shown = d.versions.find((v) => v.version === (versionShown ?? cur.version)) ?? cur
  const isMine = canReviewDocType(m.role, d.typeId)
  const canDecide = m.can('documents.review') && isMine && cur.status === 'pending'
  // Viewing permission ≠ download permission (PRD security principle)
  const canDownload = m.can('documents.download')
  const restricted = Boolean(t.sensitive) && !m.can('documents.review')

  const submit = async () => {
    setErr('')
    const reasonLabel = DOC_REJECT_REASONS.find((r) => r.code === reasonCode)?.label
    if (decision !== 'approve' && !reasonCode) return setErr('علت را از فهرست انتخاب کنید.')
    if (decision !== 'approve' && reasonCode === 'other' && !note.trim()) return setErr('توضیح تکمیلی را بنویسید.')
    setBusy(true)
    try {
      await actions.reviewDocument(d.id, decision, reasonCode || undefined, decision === 'approve' ? undefined : [reasonLabel, note.trim()].filter(Boolean).join(' — '), decision === 'needs_fix' ? deadline : undefined)
      toast.success(decision === 'approve' ? 'مدرک تأیید شد' : decision === 'reject' ? 'مدرک رد شد' : 'نقص مدرک اعلام شد', decision !== 'approve' ? 'اعلان برای نیروی کار ارسال و وظیفه پیگیری ایجاد شد.' : undefined)
      onClose()
    } catch (x) {
      toast.fromError(x)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="xl"
      dismissable={!busy}
      title={`${t.title} — ${fullName(e)}`}
      description={`نسخه ${toFaDigits(cur.version)}، ارسال ${formatDate(cur.uploadedAt, 'datetime')}`}
      footer={
        canDecide ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              انصراف
            </Button>
            <Button onClick={submit} loading={busy} variant={decision === 'reject' ? 'danger' : 'primary'} icon={decision === 'approve' ? CircleCheck : decision === 'reject' ? CircleX : RotateCcw}>
              {decision === 'approve' ? 'تأیید مدرک' : decision === 'reject' ? 'رد مدرک' : 'اعلام نقص'}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <DocumentPreview source={{ fileName: shown.fileName, mime: shown.mime, previewUrl: shown.previewUrl, title: t.title }} restricted={restricted} watermark={`${m.user?.name} — ${formatDate(new Date())}`} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
            <span dir="auto">{shown.fileName}</span>
            {canDownload ? (
              <Button size="xs" variant="ghost" icon={Download} onClick={() => toast.info('دریافت فایل', 'در نسخه عملیاتی فایل از طریق پیوند امن و موقت دریافت می‌شود.')}>
                دریافت فایل
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Lock size={12} aria-hidden /> دریافت فایل برای نقش شما مجاز نیست
              </span>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <dl className="space-y-2 rounded-lg border border-ink-200 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">کد پرسنلی</dt>
              <dd>
                <Ltr>{e.personnelNo}</Ltr>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">مرجع بررسی</dt>
              <dd>{t.reviewParty === 'org' ? 'سازمان محل خدمت' : 'شرکت تأمین نیرو'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">وضعیت</dt>
              <dd>
                <StatusBadge meta={DOC_STATUS[documentStatus(d)]} size="sm" />
              </dd>
            </div>
            {d.expiresAt ? (
              <div className="flex justify-between">
                <dt className="text-ink-500">اعتبار تا</dt>
                <dd>{formatDate(d.expiresAt)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="rounded-lg bg-ink-50 p-3 text-xs leading-6 text-ink-600">
            <span className="font-semibold text-ink-800">الزامات: </span>
            {t.requirements}
          </p>

          {canDecide ? (
            <div className="space-y-3">
              <p className="text-sm font-bold">نتیجه بررسی</p>
              <RadioGroup
                name="decision"
                value={decision}
                onChange={(v) => setDecision(v as typeof decision)}
                options={[
                  { value: 'approve', label: 'تأیید' },
                  { value: 'needs_fix', label: 'نیازمند اصلاح', description: 'نیروی کار نسخه اصلاحی ارسال می‌کند' },
                  { value: 'reject', label: 'رد' },
                ]}
              />
              {decision !== 'approve' ? (
                <>
                  <Field label="علت" required error={err && !reasonCode ? err : undefined}>
                    {(p) => <Select id={p.id} invalid={p.invalid} value={reasonCode} onChange={(x) => setReasonCode(x.target.value)} placeholder="انتخاب از فهرست استاندارد" options={DOC_REJECT_REASONS.map((r) => ({ value: r.code, label: r.label }))} />}
                  </Field>
                  <Field label="توضیح تکمیلی" required={reasonCode === 'other'} optionalLabel={reasonCode !== 'other'} error={err && reasonCode ? err : undefined}>
                    {(p) => <Textarea id={p.id} invalid={p.invalid} value={note} onChange={(x) => setNote(x.target.value)} maxLength={300} className="min-h-20" />}
                  </Field>
                  {decision === 'needs_fix' ? (
                    <Field label="مهلت اصلاح">
                      {(p) => <DatePicker id={p.id} value={deadline} onChange={setDeadline} min={toISODate(new Date())} />}
                    </Field>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : cur.status === 'pending' && !isMine ? (
            <Callout tone="info" icon={Info}>
              بررسی این نوع مدرک در اختیار {t.reviewParty === 'org' ? 'سازمان محل خدمت' : 'شرکت تأمین نیرو'} است. شما فقط امکان مشاهده دارید.
            </Callout>
          ) : cur.status === 'pending' ? (
            <Callout tone="info">نقش شما مجوز تأیید یا رد مدرک را ندارد.</Callout>
          ) : cur.reason ? (
            <Callout tone="warning" title={DOC_STATUS[cur.status].label}>
              {cur.reason}
            </Callout>
          ) : null}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <History size={15} aria-hidden /> سوابق نسخه‌ها
            </p>
            <Timeline
              items={[...d.versions].reverse().map((v) => ({
                id: String(v.version),
                icon: FileCheck2,
                tone: DOC_STATUS[v.status].tone,
                current: v.version === shown.version,
                title: (
                  <button type="button" className="text-start hover:underline" onClick={() => setVersionShown(v.version)}>
                    نسخه {toFaDigits(v.version)} — {DOC_STATUS[v.status].label}
                  </button>
                ),
                time: formatDate(v.uploadedAt),
                body: [v.reviewer ? `${v.reviewer}، ${formatDate(v.reviewedAt)}` : null, v.reason].filter(Boolean).join(' — ') || undefined,
              }))}
            />
          </div>
          <Link to={`${m.base}/workforce/${e.id}`} className="block text-xs font-semibold text-brand-700 hover:underline">
            مشاهده پرونده نیرو
          </Link>
        </div>
      </div>
    </Drawer>
  )
}
