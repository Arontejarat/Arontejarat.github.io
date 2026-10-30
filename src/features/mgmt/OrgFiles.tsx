import { useMemo, useState } from 'react'
import { CircleCheck, CircleX, FileText, FolderOpen, Lock, Upload, Users, Building2 } from 'lucide-react'
import { Badge, Button, DataTable, DatePicker, Dialog, EmptyState, Field, FileUploader, FilterBar, Input, PageHeader, PageState, RadioGroup, SearchInput, Select, Textarea, useToast, type Column } from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { projectById, projectInScope } from '@/mock/selectors'
import { ORG_FILE_TYPES } from '@/config/documentTypes'
import { formatDate, formatFileSize } from '@/lib/format'
import { toISODate } from '@/lib/jalali'
import type { Attachment, OrgFile } from '@/types/domain'
import { useMgmt } from './useMgmt'

const ACCESS: Record<OrgFile['access'], { label: string; hint: string }> = {
  internal: { label: 'داخلی', hint: 'فقط کاربران مجموعه خودتان' },
  shared: { label: 'اشتراکی', hint: 'قابل مشاهده برای طرف مقابل در همان پروژه' },
  restricted: { label: 'محدود', hint: 'فقط مدیران و کاربران تعیین‌شده' },
}
const REVIEW: Record<OrgFile['reviewStatus'], { label: string; tone: 'muted' | 'brand' | 'success' | 'danger' }> = {
  none: { label: 'بدون نیاز به بررسی', tone: 'muted' },
  pending: { label: 'در انتظار بررسی', tone: 'brand' },
  approved: { label: 'تأییدشده', tone: 'success' },
  rejected: { label: 'ردشده', tone: 'danger' },
}

export function OrgFilesPage() {
  const m = useMgmt()
  return (
    <>
      <PageHeader title={m.isCompany ? 'اسناد شرکت و پروژه' : 'اسناد سازمان'} description="مجوزها، معرفی‌نامه‌ها، مکاتبات و مستندات پروژه و قرارداد." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'اسناد' }]} />
      <PageState>{() => <OrgFilesPanel />}</PageState>
    </>
  )
}

/** `incoming` = documents sent by the counterpart (org ⇄ company) */
export function OrgFilesPanel({ incoming }: { incoming?: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [project, setProject] = useState('')
  const [open, setOpen] = useState(false)
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  const projectIds = new Set(projects.map((p) => p.id))
  const files = useMemo(
    () =>
      db.orgFiles
        .filter((f) => (incoming ? f.owner !== m.role && f.access === 'shared' && (!f.projectId || projectIds.has(f.projectId)) : f.owner === m.role && f.ownerId === m.entityId))
        .filter((f) => (!q || f.title.includes(q)) && (!type || f.docType === type) && (!project || f.projectId === project))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.orgFiles, incoming, m.role, m.entityId, q, type, project],
  )
  const canReview = incoming && m.can('documents.review')

  const columns: Column<OrgFile>[] = [
    {
      id: 'title',
      header: 'عنوان',
      cell: (f) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-red-50 text-red-700">
            <FileText size={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-medium">{f.title}</p>
            <p className="truncate text-2xs text-ink-500" dir="auto">
              {f.fileName}، {formatFileSize(f.size)}
            </p>
          </div>
        </div>
      ),
    },
    { id: 'type', header: 'نوع سند', cell: (f) => <span className="text-xs">{f.docType}</span> },
    { id: 'project', header: 'پروژه', cell: (f) => <span className="text-xs">{projectById(db, f.projectId)?.name ?? '—'}</span> },
    { id: 'date', header: 'تاریخ', cell: (f) => <span className="text-xs">{formatDate(f.date)}</span>, sortValue: (f) => f.date },
    {
      id: 'access',
      header: 'سطح دسترسی',
      cell: (f) => (
        <Badge size="sm" tone="neutral" icon={f.access === 'internal' ? Building2 : f.access === 'shared' ? Users : Lock}>
          <span title={ACCESS[f.access].hint}>{ACCESS[f.access].label}</span>
        </Badge>
      ),
    },
    { id: 'review', header: 'وضعیت بررسی', cell: (f) => <Badge size="sm" tone={REVIEW[f.reviewStatus].tone}>{REVIEW[f.reviewStatus].label}</Badge> },
    { id: 'by', header: 'ارسال‌کننده', label: 'ارسال‌کننده', hideable: true, cell: (f) => <span className="text-xs">{f.uploadedBy}</span> },
    ...(canReview
      ? [
          {
            id: 'act',
            header: <span className="sr-only">عملیات</span>,
            cell: (f: OrgFile) =>
              f.reviewStatus === 'pending' ? (
                <div className="flex gap-1">
                  <Button size="xs" variant="secondary" icon={CircleCheck} onClick={async () => { await actions.reviewOrgFile(f.id, 'approved').catch(toast.fromError); toast.success('سند تأیید شد') }}>
                    تأیید
                  </Button>
                  <Button size="xs" variant="danger-ghost" icon={CircleX} onClick={async () => { await actions.reviewOrgFile(f.id, 'rejected').catch(toast.fromError); toast.info('سند رد شد') }}>
                    رد
                  </Button>
                </div>
              ) : null,
          } as Column<OrgFile>,
        ]
      : []),
  ]

  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="جست‌وجوی عنوان سند" />}
        activeCount={[type, project].filter(Boolean).length}
        onClear={() => {
          setType('')
          setProject('')
        }}
        actions={
          !incoming && m.can('files.manage') ? (
            <Button icon={Upload} onClick={() => setOpen(true)}>
              ارسال سند
            </Button>
          ) : null
        }
      >
        <Select aria-label="نوع سند" className="w-full sm:w-44" value={type} onChange={(e) => setType(e.target.value)} placeholder="همه انواع" options={ORG_FILE_TYPES.map((t) => ({ value: t, label: t }))} />
        <Select aria-label="پروژه" className="w-full sm:w-48" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterBar>
      <DataTable
        rows={files}
        columns={columns}
        getId={(f) => f.id}
        columnChooser
        caption="فهرست اسناد"
        mobileCard={(f) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{f.title}</p>
              <Badge size="sm" tone={REVIEW[f.reviewStatus].tone}>{REVIEW[f.reviewStatus].label}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {f.docType}، {projectById(db, f.projectId)?.name ?? '—'}، {formatDate(f.date)}
            </p>
            <p className="mt-1 text-2xs text-ink-500">دسترسی: {ACCESS[f.access].label}</p>
          </div>
        )}
        empty={<EmptyState compact icon={FolderOpen} title={incoming ? 'سندی از طرف مقابل دریافت نشده است' : 'سندی ثبت نشده است'} action={!incoming && m.can('files.manage') ? <Button icon={Upload} onClick={() => setOpen(true)}>ارسال سند</Button> : undefined} />}
      />
      {open ? <UploadOrgFileDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function UploadOrgFileDialog({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  const [v, setV] = useState({ title: '', docType: ORG_FILE_TYPES[0], projectId: '', description: '', date: toISODate(new Date()), access: 'shared' as OrgFile['access'] })
  const [files, setFiles] = useState<Attachment[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const e: Record<string, string> = {}
    if (!v.title.trim()) e.title = 'عنوان سند را وارد کنید.'
    if (!files[0]) e.file = 'فایل سند را انتخاب کنید.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await actions.uploadOrgFile({ ...v, owner: m.role, ownerId: m.entityId, projectId: v.projectId || undefined, fileName: files[0].name, size: files[0].size })
      toast.success('سند ارسال شد', v.access === 'shared' ? 'سند برای طرف مقابل قابل مشاهده و بررسی است.' : undefined)
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
      title="ارسال سند"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={busy} icon={Upload}>
            ارسال
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="عنوان" required error={errors.title} className="sm:col-span-2">
          {(p) => <Input id={p.id} invalid={p.invalid} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}
        </Field>
        <Field label="نوع سند" required>
          {(p) => <Select id={p.id} value={v.docType} onChange={(e) => setV({ ...v, docType: e.target.value })} options={ORG_FILE_TYPES.map((t) => ({ value: t, label: t }))} />}
        </Field>
        <Field label="پروژه مرتبط" optionalLabel>
          {(p) => <Select id={p.id} value={v.projectId} onChange={(e) => setV({ ...v, projectId: e.target.value })} placeholder="بدون پروژه" options={projects.map((x) => ({ value: x.id, label: x.name }))} />}
        </Field>
        <Field label="تاریخ سند" required>
          {(p) => <DatePicker id={p.id} value={v.date} onChange={(d) => setV({ ...v, date: d })} clearable={false} />}
        </Field>
        <Field label="توضیح" optionalLabel className="sm:col-span-2">
          {(p) => <Textarea id={p.id} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={500} className="min-h-20" />}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">سطح دسترسی</p>
          <RadioGroup name="access" layout="cards" value={v.access} onChange={(x) => setV({ ...v, access: x as OrgFile['access'] })} options={(Object.keys(ACCESS) as OrgFile['access'][]).map((k) => ({ value: k, label: ACCESS[k].label, description: ACCESS[k].hint }))} />
        </div>
        <Field label="فایل" required error={errors.file} className="sm:col-span-2">
          {(p) => <FileUploader id={p.id} invalid={p.invalid} value={files} onChange={setFiles} maxFiles={1} maxSizeMb={10} />}
        </Field>
      </div>
    </Dialog>
  )
}
