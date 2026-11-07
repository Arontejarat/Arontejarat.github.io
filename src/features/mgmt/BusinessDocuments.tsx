import { useState } from 'react'
import { FileText, Send } from 'lucide-react'
import { Badge, Button, Callout, DataTable, Dialog, EmptyState, Field, FileUploader, FilterBar, Input, MonthPicker, PageHeader, PageState, SearchInput, Select, Textarea, useToast, type Column } from '@/components/ui'
import { StoredFile } from '@/components/ui/StoredFile'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { projectById, projectInScope } from '@/mock/selectors'
import { businessFiles } from '@/mock/businessSelectors'
import { DOCUMENT_MIMES } from '@/mock/businessActions'
import { formatDate, formatPeriod } from '@/lib/format'
import { periodKey, toJalali } from '@/lib/jalali'
import type { Attachment, OrgFile } from '@/types/domain'
import { useMgmt } from './useMgmt'

const STATES = { pending: { label: 'در انتظار بررسی', tone: 'brand' }, approved: { label: 'تأییدشده', tone: 'success' }, rejected: { label: 'ردشده', tone: 'danger' }, none: { label: 'بدون بررسی', tone: 'muted' } } as const
function periodLabel(value?: string) { const [y, m] = (value ?? '').split('-').map(Number); return y && m ? formatPeriod(y, m) : '—' }
export function StatementsPage() { return <BusinessDocuments kind="statement" /> }
export function WorkReportsPage() { return <BusinessDocuments kind="work_report" /> }
function BusinessDocuments({ kind }: { kind: 'statement' | 'work_report' }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const title = kind === 'statement' ? 'صورت‌وضعیت' : 'کارکرد'
  const sender = kind === 'statement' ? 'company' : 'org'
  const canSend = m.role === sender && m.can('files.manage')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [project, setProject] = useState('')
  const [compose, setCompose] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  const files = businessFiles(db, m.scope, kind).filter((f) => (!q || f.title.includes(q)) && (!status || f.reviewStatus === status) && (!project || f.projectId === project)).sort((a, b) => b.date.localeCompare(a.date))
  const current = businessFiles(db, m.scope, kind).find((f) => f.id === selected)
  const view = (f: OrgFile) => { setSelected(f.id); setNote(''); setError('') }
  const review = async (decision: 'approved' | 'rejected') => {
    if (!current || busy) return
    if (decision === 'rejected' && !note.trim()) { setError('علت رد را بنویسید.'); return }
    setBusy(true)
    try { await actions.reviewBusinessDocument(current.id, decision, note); toast.success('نتیجه بررسی ثبت شد'); setSelected(null) }
    catch (e) { toast.fromError(e) } finally { setBusy(false) }
  }
  const columns: Column<OrgFile>[] = [
    { id: 'title', header: 'عنوان', cell: (f) => <button className="text-start font-semibold text-brand-700 hover:underline" onClick={() => view(f)}>{f.title}</button> },
    { id: 'project', header: 'پروژه', cell: (f) => projectById(db, f.projectId)?.name ?? '—' },
    { id: 'period', header: 'دوره', cell: (f) => periodLabel(f.period) },
    { id: 'date', header: 'تاریخ ارسال', cell: (f) => formatDate(f.date) },
    { id: 'status', header: 'وضعیت', cell: (f) => <Badge tone={STATES[f.reviewStatus].tone}>{STATES[f.reviewStatus].label}</Badge> },
    { id: 'view', header: 'فایل و جزئیات', cell: (f) => <Button size="sm" variant="outline" onClick={() => view(f)}>مشاهده</Button> },
  ]
  return <>
    <PageHeader title={kind === 'statement' ? 'صورت‌وضعیت‌های پروژه' : 'کارکرد نیروها'} description={kind === 'statement' ? 'ارسال صورت‌وضعیت از شرکت به سازمان و پیگیری نتیجه بررسی.' : 'ارسال کارکرد ماهانه از سازمان به شرکت برای محاسبه حقوق.'} breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: title }]} actions={canSend ? <Button icon={Send} onClick={() => setCompose(true)}>ارسال {title}</Button> : undefined} />
    <FilterBar search={<SearchInput value={q} onChange={setQ} placeholder={'جست‌وجوی ' + title} />} activeCount={[status, project].filter(Boolean).length} onClear={() => { setStatus(''); setProject('') }}>
      <Select aria-label="پروژه" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
      <Select aria-label="وضعیت بررسی" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={['pending', 'approved', 'rejected'].map((s) => ({ value: s, label: STATES[s as keyof typeof STATES].label }))} />
    </FilterBar>
    <PageState loadKey={kind}>{({ empty }) => <DataTable rows={empty ? [] : files} columns={columns} getId={(f) => f.id} caption={'فهرست ' + title} mobileCard={(f) => <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{f.title}</p><Badge tone={STATES[f.reviewStatus].tone}>{STATES[f.reviewStatus].label}</Badge></div><p className="text-xs text-ink-600">{projectById(db, f.projectId)?.name} — {periodLabel(f.period)}</p><Button size="sm" variant="outline" onClick={() => view(f)}>مشاهده فایل و جزئیات</Button></div>} empty={<EmptyState icon={FileText} title={files.length || q || status || project ? 'سندی با این فیلترها پیدا نشد' : title + 'ی ارسال نشده است'} description={canSend ? 'پروژه، دوره ماهانه و فایل را انتخاب کنید.' : 'اسناد ارسال‌شده توسط طرف مقابل در این بخش نمایش داده می‌شود.'} action={canSend ? <Button onClick={() => setCompose(true)}>ارسال {title}</Button> : undefined} />} />}</PageState>
    {compose ? <Compose kind={kind} onClose={() => setCompose(false)} /> : null}
    <Dialog open={Boolean(current)} onClose={() => setSelected(null)} dismissable={!busy} size="xl" title={current?.title ?? title} footer={current && m.role !== sender && m.can('documents.review') && current.reviewStatus === 'pending' ? <><Button variant="danger-ghost" disabled={busy} onClick={() => review('rejected')}>رد {title}</Button><Button loading={busy} onClick={() => review('approved')}>تأیید {title}</Button></> : undefined}>
      {current ? <div className="space-y-4"><p className="text-sm text-ink-600">{projectById(db, current.projectId)?.name} — {periodLabel(current.period)} — ارسال توسط {current.uploadedBy} در {formatDate(current.date)}</p><Badge tone={STATES[current.reviewStatus].tone}>{STATES[current.reviewStatus].label}</Badge>{current.description ? <p className="whitespace-pre-wrap text-sm">{current.description}</p> : null}{current.attachment ? <StoredFile file={current.attachment} /> : null}{current.reviewNote ? <Callout tone={current.reviewStatus === 'rejected' ? 'warning' : 'neutral'} title="نتیجه بررسی">{current.reviewNote} — {current.reviewedBy}</Callout> : null}{m.role !== sender && m.can('documents.review') && current.reviewStatus === 'pending' ? <Field label="توضیح بررسی" helper="برای رد سند، ثبت علت الزامی است." error={error}>{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} disabled={busy} value={note} onChange={(e) => { setNote(e.target.value); setError('') }} maxLength={1000} />}</Field> : null}</div> : null}
    </Dialog>
  </>
}
function Compose({ kind, onClose }: { kind: 'statement' | 'work_report'; onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const today = toJalali(new Date())
  const title = kind === 'statement' ? 'صورت‌وضعیت' : 'کارکرد'
  const projects = db.projects.filter((p) => projectInScope(m.scope, p))
  const [v, setV] = useState({ title: '', projectId: '', period: periodKey(today.jy, today.jm), description: '' })
  const [files, setFiles] = useState<Attachment[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const project = projects.find((p) => p.id === v.projectId)
  const recipient = m.isCompany ? db.organizations.find((o) => o.id === project?.orgId)?.name : db.companies.find((c) => c.id === project?.companyId)?.name
  const submit = async () => {
    if (busy) return
    const e: Record<string, string> = {}
    if (!v.title.trim()) e.title = 'عنوان را وارد کنید.'
    if (!project) e.project = 'پروژه را انتخاب کنید.'
    if (!v.period) e.period = 'دوره را انتخاب کنید.'
    if (!files[0]) e.file = 'فایل را بارگذاری کنید.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try { await actions.sendBusinessDocument({ ...v, kind, attachment: files[0] }); toast.success(title + ' ارسال شد', 'فایل برای ' + recipient + ' قابل مشاهده است.'); onClose() }
    catch (e) { toast.fromError(e) } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} dismissable={!busy} title={'ارسال ' + title} size="lg" footer={<><Button variant="outline" disabled={busy} onClick={onClose}>انصراف</Button><Button icon={Send} loading={busy} onClick={submit}>ارسال به {m.isCompany ? 'سازمان' : 'شرکت'}</Button></>}>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field label="عنوان" required error={errors.title} className="sm:col-span-2">{(p) => <Input id={p.id} invalid={p.invalid} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={150} />}</Field>
      <Field label="پروژه" required error={errors.project}>{(p) => <Select id={p.id} invalid={p.invalid} value={v.projectId} onChange={(e) => setV({ ...v, projectId: e.target.value })} placeholder="انتخاب پروژه" options={projects.map((p) => ({ value: p.id, label: p.name }))} />}</Field>
      <Field label="دوره ماهانه" required error={errors.period}>{(p) => <MonthPicker id={p.id} value={v.period} onChange={(period) => setV({ ...v, period })} />}</Field>
      {recipient ? <p className="text-sm text-ink-600 sm:col-span-2">گیرنده: <strong>{recipient}</strong></p> : null}
      <Field label="توضیح" optionalLabel className="sm:col-span-2">{(p) => <Textarea id={p.id} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={1000} />}</Field>
      <Field label={'فایل ' + title} required error={errors.file} className="sm:col-span-2">{(p) => <FileUploader persistFile id={p.id} invalid={p.invalid} describedBy={p.describedBy} value={files} onChange={setFiles} accept={DOCUMENT_MIMES} maxFiles={1} maxSizeMb={10} />}</Field>
    </fieldset>
  </Dialog>
}
