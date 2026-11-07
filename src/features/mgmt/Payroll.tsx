import { useState } from 'react'
import { Receipt, Upload } from 'lucide-react'
import { Badge, Button, Callout, DataTable, Dialog, EmptyState, Field, FileUploader, FilterBar, MonthPicker, PageHeader, PageState, SearchInput, Select, Textarea, useToast, type Column } from '@/components/ui'
import { StoredFile } from '@/components/ui/StoredFile'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { fullName, scopedEmployees } from '@/mock/selectors'
import { PAYSLIP_MIMES } from '@/mock/businessActions'
import { formatDate, formatPeriod, toFaDigits } from '@/lib/format'
import { periodKey, toJalali } from '@/lib/jalali'
import type { Attachment, Payslip } from '@/types/domain'
import { useMgmt } from './useMgmt'

export function PayrollPage() {
  const db = useDB()
  const m = useMgmt()
  const employees = scopedEmployees(db, m.scope)
  const ids = new Set(employees.map((e) => e.id))
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('')
  const [compose, setCompose] = useState<{ employeeId?: string; period?: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const current = db.payslips.find((p) => p.id === selected && ids.has(p.employeeId))
  const name = (id: string) => { const e = employees.find((e) => e.id === id); return e ? fullName(e) : '—' }
  const rows = db.payslips.filter((p) => ids.has(p.employeeId) && (!q || name(p.employeeId).includes(q) || employees.find((e) => e.id === p.employeeId)?.personnelNo.includes(q)) && (!period || periodKey(p.year, p.month) === period)).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
  const columns: Column<Payslip>[] = [
    { id: 'name', header: 'نیروی کار', cell: (p) => <span className="font-semibold">{name(p.employeeId)}</span> },
    { id: 'period', header: 'دوره', cell: (p) => formatPeriod(p.year, p.month) },
    { id: 'file', header: 'فایل', cell: (p) => p.file ? <bdi className="block max-w-52 truncate">{p.file.name}</bdi> : <span className="text-ink-500">فیش نمایشی سامانه</span> },
    { id: 'version', header: 'نسخه', cell: (p) => <Badge tone={p.status === 'corrected' ? 'warning' : 'neutral'}>{toFaDigits(p.version)}</Badge> },
    { id: 'issued', header: 'آخرین بارگذاری', cell: (p) => formatDate(p.correctedAt ?? p.issuedAt) },
    { id: 'actions', header: 'عملیات', cell: (p) => <div className="flex flex-wrap gap-2">{p.file ? <Button size="sm" variant="outline" onClick={() => setSelected(p.id)}>مشاهده فایل</Button> : null}<Button size="sm" variant="ghost" onClick={() => setCompose({ employeeId: p.employeeId, period: periodKey(p.year, p.month) })}>بارگذاری نسخه جدید</Button></div> },
  ]
  return <>
    <PageHeader title="فیش حقوق نیروها" description="فایل فیش را برای هر نیرو و ماه بارگذاری کنید؛ نیرو فقط فیش‌های خودش را می‌بیند." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'فیش حقوق نیروها' }]} actions={<Button icon={Upload} onClick={() => setCompose({})}>بارگذاری فیش حقوق</Button>} />
    <FilterBar search={<SearchInput value={q} onChange={setQ} placeholder="نام یا کد پرسنلی" />} activeCount={period ? 1 : 0} onClear={() => setPeriod('')}><MonthPicker value={period} onChange={setPeriod} /></FilterBar>
    <PageState>{({ empty }) => <DataTable rows={empty ? [] : rows} columns={columns} getId={(p) => p.id} caption="فیش حقوق نیروها" mobileCard={(p) => <div className="space-y-3"><p className="font-semibold">{name(p.employeeId)} — {formatPeriod(p.year, p.month)}</p><p className="text-xs text-ink-600">نسخه {toFaDigits(p.version)}، {formatDate(p.correctedAt ?? p.issuedAt)}</p><div className="flex flex-wrap gap-2">{p.file ? <Button size="sm" variant="outline" onClick={() => setSelected(p.id)}>مشاهده فایل</Button> : null}<Button size="sm" variant="ghost" onClick={() => setCompose({ employeeId: p.employeeId, period: periodKey(p.year, p.month) })}>بارگذاری نسخه جدید</Button></div></div>} empty={<EmptyState icon={Receipt} title="فیشی پیدا نشد" description="برای انتشار فیش حقوق، نیرو و دوره را انتخاب و فایل را بارگذاری کنید." />} />}</PageState>
    {compose ? <UploadPayslipDialog initial={compose} onClose={() => setCompose(null)} /> : null}
    <Dialog open={Boolean(current?.file)} onClose={() => setSelected(null)} title={current ? 'فیش ' + name(current.employeeId) + ' — ' + formatPeriod(current.year, current.month) : 'فیش حقوق'} size="xl">{current?.file ? <StoredFile file={current.file} /> : null}</Dialog>
  </>
}
function UploadPayslipDialog({ initial, onClose }: { initial: { employeeId?: string; period?: string }; onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const today = toJalali(new Date())
  const employees = scopedEmployees(db, m.scope)
  const [employeeId, setEmployeeId] = useState(initial.employeeId ?? '')
  const [period, setPeriod] = useState(initial.period ?? periodKey(today.jy, today.jm))
  const [files, setFiles] = useState<Attachment[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const existing = db.payslips.find((p) => p.employeeId === employeeId && periodKey(p.year, p.month) === period)
  const submit = async () => {
    if (busy) return
    const e: Record<string, string> = {}
    if (!employeeId) e.employee = 'نیروی کار را انتخاب کنید.'
    if (!period) e.period = 'ماه حقوق را انتخاب کنید.'
    if (!files[0]) e.file = 'فایل فیش را بارگذاری کنید.'
    if (existing && !note.trim()) e.note = 'دلیل جایگزینی فیش را بنویسید.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try { await actions.uploadPayslip({ employeeId, period, file: files[0], correctionNote: note, expectedVersion: existing?.version ?? 0 }); toast.success('فیش حقوق منتشر شد', 'فایل در پنل نیروی کار قابل مشاهده است.'); onClose() }
    catch (e) { toast.fromError(e) } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} dismissable={!busy} title="بارگذاری فیش حقوق" size="lg" footer={<><Button variant="outline" onClick={onClose} disabled={busy}>انصراف</Button><Button loading={busy} icon={Upload} onClick={submit}>{existing ? 'تأیید جایگزینی و انتشار' : 'انتشار برای نیرو'}</Button></>}>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <Field label="نیروی کار" required error={errors.employee}>{(p) => <Select id={p.id} invalid={p.invalid} value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setFiles([]); setNote('') }} placeholder="انتخاب نیرو" options={employees.map((e) => ({ value: e.id, label: fullName(e) + ' — ' + e.personnelNo }))} />}</Field>
      <Field label="ماه حقوق" required error={errors.period}>{(p) => <MonthPicker id={p.id} value={period} onChange={(period) => { setPeriod(period); setNote('') }} />}</Field>
      {existing ? <Callout tone="warning">برای این دوره فیش موجود است. فایل جدید به‌عنوان نسخه {toFaDigits(existing.version + 1)} منتشر می‌شود و نسخه قبلی در سوابق نیرو باقی می‌ماند.</Callout> : null}
      <Field label="فایل فیش حقوق" required error={errors.file}>{(p) => <FileUploader persistFile id={p.id} invalid={p.invalid} describedBy={p.describedBy} value={files} onChange={setFiles} accept={PAYSLIP_MIMES} maxFiles={1} maxSizeMb={10} />}</Field>
      <Field label={existing ? 'دلیل جایگزینی' : 'توضیح'} required={Boolean(existing)} error={errors.note}>{(p) => <Textarea id={p.id} invalid={p.invalid} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />}</Field>
      <p className="text-xs leading-6 text-ink-600">فایل برای نیروی انتخاب‌شده منتشر می‌شود. بارگذاری فیش به معنی ثبت پرداخت حقوق نیست.</p>
    </fieldset>
  </Dialog>
}
