import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus, Download, Pencil, Eye } from 'lucide-react'
import { Badge, Button, ButtonLink, Callout, Card, DatePicker, Dialog, EmptyState, Field, FileUploader, Input, MonthPicker, PageHeader, PageState, PermissionState, SearchInput, Select, Textarea, useToast } from '@/components/ui'
import { StoredFile } from '@/components/ui/StoredFile'
import { useActions, useCan, useCurrentEmployee, useScope, useSession } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { scopedEmployees, fullName } from '@/mock/selectors'
import { policyFor } from '@/mock/hrRules'
import { formatDate, formatPeriod, toEnDigits, toFaDigits } from '@/lib/format'
import { downloadCsv } from '@/features/mgmt/Workforce'
import { jalaliMonthLength, periodKey, toISODate, toJalali } from '@/lib/jalali'
import type { Attachment, Child, InsuranceRecord, RecordHistory, ReviewStatus } from '@/types/domain'

const REVIEW = { pending: { label: 'در انتظار بررسی', tone: 'brand' }, approved: { label: 'تأییدشده', tone: 'success' }, rejected: { label: 'ردشده', tone: 'danger' }, needs_correction: { label: 'نیازمند اصلاح', tone: 'warning' } } as const
export function FamilyPage() { return <PersonnelRecords kind="family" /> }
export function InsurancePage() { return <PersonnelRecords kind="insurance" /> }
function OwnRecords({ kind }: { kind: 'family' | 'insurance' }) { const emp = useCurrentEmployee(); return <Records kind={kind} ownEmployeeId={emp.id} /> }
function PersonnelRecords({ kind }: { kind: 'family' | 'insurance' }) {
  const session = useSession()
  const canView = useCan(kind === 'family' ? (session?.role === 'employee' ? 'family.manage' : 'family.review') : 'insurance.view')
  if (!canView) return <PermissionState />
  return session?.role === 'employee' ? <OwnRecords kind={kind} /> : <Records kind={kind} />
}
function Records({ kind, ownEmployeeId }: { kind: 'family' | 'insurance'; ownEmployeeId?: string }) {
  const db = useDB()
  const scope = useScope()
  const actions = useActions()
  const toast = useToast()
  const [params] = useSearchParams()
  const employees = ownEmployeeId ? db.employees.filter((e) => e.id === ownEmployeeId) : scopedEmployees(db, scope)
  const [employeeId, setEmployeeId] = useState(ownEmployeeId ?? params.get('employee') ?? '')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [editRecord, setEditRecord] = useState<{ employeeId: string; child?: Child; insurance?: InsuranceRecord } | null>(null)
  const [detail, setDetail] = useState<{ employeeId: string; id: string } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const canEdit = useCan(kind === 'family' ? 'family.manage' : 'insurance.edit')
  const canReview = useCan(kind === 'family' ? 'family.review' : 'insurance.verify')
  const sensitive = useCan('workforce.sensitive') || Boolean(ownEmployeeId)
  const allowed = new Set(employees.map((e) => e.id))
  const rows: { employeeId: string; record: Child | InsuranceRecord }[] = kind === 'family' ? employees.flatMap((e) => e.children.map((c) => ({ employeeId: e.id, record: c }))) : db.insuranceRecords.filter((r) => allowed.has(r.employeeId) && (Boolean(ownEmployeeId) || r.companyId === scope.companyId)).map((r) => ({ employeeId: r.employeeId, record: r }))
  const shown = rows.filter((r) => (!employeeId || r.employeeId === employeeId) && (!status || r.record.status === status) && (!q || ('fullName' in r.record ? r.record.fullName.includes(q) : r.record.employer.includes(q)) || fullName(employees.find((e) => e.id === r.employeeId)!).includes(q)))
  const current = rows.find((r) => r.record.id === detail?.id && r.employeeId === detail.employeeId)
  const title = kind === 'family' ? 'اطلاعات و مدارک فرزندان' : 'سوابق و روزهای بیمه'
  const review = async (decision: ReviewStatus) => {
    if (!current || busy) return
    if (decision !== 'approved' && !note.trim()) { toast.error('علت رد یا موارد اصلاح را بنویسید.'); return }
    setBusy(true)
    try {
      if (kind === 'family') await actions.reviewChild(current.employeeId, current.record.id, decision, note, current.record.version ?? 1)
      else await actions.reviewInsurance(current.record.id, decision, note, current.record.version ?? 1)
      toast.success('نتیجه بررسی ثبت شد'); setDetail(null)
    } catch (e) { toast.fromError(e) } finally { setBusy(false) }
  }
  return <>
    <PageHeader title={title} description={kind === 'family' ? 'ثبت تولد، مدارک و پیگیری بررسی منابع انسانی؛ هشدار سن، مزایا را خودکار تغییر نمی‌دهد.' : 'ثبت دستی روزهای بیمه و بررسی شرکت؛ اتصال به تأمین اجتماعی هنوز فعال نیست.'} actions={<div className="flex flex-wrap gap-2">{kind === 'insurance' && !ownEmployeeId ? <Button icon={Download} variant="outline" onClick={async () => { try { const rs = await actions.exportInsurance(); downloadCsv('insurance.csv', ['کد پرسنلی', 'سال', 'ماه', 'روز', 'کارفرما', 'شماره بیمه', 'وضعیت'], rs.filter((r) => (!employeeId || r.employeeId === employeeId) && (!status || r.status === status)).map((r) => [employees.find((e) => e.id === r.employeeId)?.personnelNo ?? '', r.year, r.month, r.days, r.employer, r.registrationNumber, REVIEW[r.status].label])); } catch (e) { toast.fromError(e) } }}>خروجی بیمه</Button> : null}{canEdit ? <Button icon={Plus} disabled={!ownEmployeeId && !allowed.has(employeeId)} onClick={() => setEditRecord({ employeeId: ownEmployeeId ?? employeeId })}>{kind === 'family' ? 'ثبت فرزند' : 'ثبت سابقه بیمه'}</Button> : null}</div>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><SearchInput value={q} onChange={setQ} placeholder={kind === 'family' ? 'نام فرزند یا نیرو' : 'نام کارفرما یا نیرو'} />{!ownEmployeeId ? <Select aria-label="نیروی کار" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="همه نیروها؛ برای ثبت، یک نیرو انتخاب کنید" options={employees.map((e) => ({ value: e.id, label: fullName(e) + ' — ' + e.personnelNo }))} /> : <ButtonLink variant="outline" to={kind === 'family' ? '/me/profile/personal' : '/me/documents/personnel/upload?type=insurance_registration'}>{kind === 'family' ? 'اطلاعات فردی من' : 'مدرک ثبت‌نام / کد بیمه'}</ButtonLink>}<Select aria-label="وضعیت" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={Object.entries(REVIEW).map(([value, s]) => ({ value, label: s.label }))} /></div>
    <PageState loadKey={kind}>{({ empty }) => empty || !shown.length ? <EmptyState icon={Eye} title="رکوردی پیدا نشد" description={ownEmployeeId ? 'اطلاعات را با دکمه ثبت وارد کنید.' : 'نیرو و وضعیت را بررسی کنید؛ برای ثبت، ابتدا نیرو را انتخاب کنید.'} /> : <div className="space-y-3">{shown.map(({ record: r, employeeId: id }) => <Card key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><h2 className="font-semibold">{'fullName' in r ? r.fullName : formatPeriod(r.year, r.month) + ' — ' + toFaDigits(r.days) + ' روز'}</h2><p className="mt-1 text-sm text-ink-600">{ownEmployeeId ? '' : fullName(employees.find((e) => e.id === id)!) + ' — '}{'birthDate' in r ? 'تولد: ' + formatDate(r.birthDate) : r.employer}</p>{r.reviewNote ? <p className="mt-1 text-sm text-ink-700">{r.reviewNote}</p> : null}</div><Badge tone={REVIEW[r.status ?? 'pending'].tone}>{REVIEW[r.status ?? 'pending'].label}</Badge><div className="flex gap-2"><Button variant="outline" size="sm" icon={Eye} onClick={() => { setDetail({ employeeId: id, id: r.id }); setNote('') }}>مدارک و سوابق</Button>{canEdit && (!ownEmployeeId || r.status !== 'approved') ? <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditRecord({ employeeId: id, child: kind === 'family' ? r as Child : undefined, insurance: kind === 'insurance' ? r as InsuranceRecord : undefined })}>ویرایش</Button> : null}</div></Card>)}</div>}</PageState>
    {editRecord ? kind === 'family' ? <ChildForm employeeId={editRecord.employeeId} child={editRecord.child} onClose={() => setEditRecord(null)} /> : <InsuranceForm employeeId={editRecord.employeeId} record={editRecord.insurance} onClose={() => setEditRecord(null)} /> : null}
    <Dialog open={Boolean(current)} onClose={() => setDetail(null)} dismissable={!busy} title="مدارک و سابقه بررسی" size="xl" footer={current && canReview && current.record.status === 'pending' ? <><Button variant="danger-ghost" disabled={busy} onClick={() => review('rejected')}>رد</Button><Button variant="outline" disabled={busy} onClick={() => review('needs_correction')}>درخواست اصلاح</Button><Button loading={busy} onClick={() => review('approved')}>تأیید اطلاعات</Button></> : undefined}>
      {current ? <div className="space-y-5"><p className="text-sm">{'nationalId' in current.record && current.record.nationalId ? 'کد ملی: ' + (sensitive ? current.record.nationalId : '••••••••••') : ''}</p><p className="text-sm">تاریخ ثبت: {formatDate('registeredAt' in current.record ? current.record.registeredAt : (current.record as InsuranceRecord).submittedAt) || 'نامشخص'}</p>{current.record.documents?.map((f) => <StoredFile key={f.id} file={f} />)}{!current.record.documents?.length ? <Callout tone="neutral">فایلی برای این رکورد ثبت نشده است.</Callout> : null}<HistoryList entries={current.record.history ?? []} />{canReview && current.record.status === 'pending' ? <Field label="توضیح بررسی" helper="علت رد یا موارد اصلاح الزامی است.">{(p) => <Textarea id={p.id} aria-describedby={p.describedBy} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} disabled={busy} />}</Field> : null}</div> : null}
    </Dialog>
  </>
}
function HistoryList({ entries }: { entries: RecordHistory[] }) {
  return <section><h3 className="mb-3 text-sm font-bold">تاریخچه تغییرات</h3><ul className="space-y-3">{entries.map((h) => <li key={h.id} className="rounded-lg bg-ink-50 p-3 text-sm"><p>{h.action} — {h.by} — {formatDate(h.at, 'datetime')}</p>{h.note ? <p className="mt-1">{h.note}</p> : null}{[h.before, h.after].filter(Boolean).map((s, i) => { let snapshot: { fullName?: string; firstName?: string; lastName?: string; birthDate?: string; days?: number; employer?: string; documents?: Attachment[] }; try { snapshot = JSON.parse(s!) } catch { return null } return <details key={i} className="mt-2"><summary className="cursor-pointer text-brand-700">{h.before && i === 0 ? 'اطلاعات قبلی' : 'اطلاعات ثبت‌شده'}</summary><p className="mt-2">{snapshot.fullName ?? [snapshot.firstName, snapshot.lastName].filter(Boolean).join(' ')} {snapshot.birthDate ? formatDate(snapshot.birthDate) : ''}{snapshot.days !== undefined ? toFaDigits(snapshot.days) + ' روز — ' + snapshot.employer : ''}</p>{snapshot.documents?.map((f) => <div className="mt-3" key={f.id}><StoredFile file={f} /></div>)}</details> })}</li>)}</ul>{!entries.length ? <p className="text-sm text-ink-600">اطلاعات قدیمی بدون تاریخچه ثبت شده است.</p> : null}</section>
}
function ChildForm({ employeeId, child, onClose }: { employeeId: string; child?: Child; onClose: () => void }) {
  const db = useDB(); const actions = useActions(); const toast = useToast()
  const emp = db.employees.find((e) => e.id === employeeId)!
  const policy = policyFor(db, emp.companyId)
  const [v, setV] = useState({ firstName: child?.firstName ?? '', lastName: child?.lastName ?? emp.lastName, nationalId: child?.nationalId ?? '', birthDate: child?.birthDate ?? '', relation: child?.relation ?? 'son' as 'son' | 'daughter' })
  const [files, setFiles] = useState<Attachment[]>(child?.documents ?? [])
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const save = async () => { if (busy) return; setBusy(true); setError(''); try { await actions.saveChild(employeeId, { ...v, documents: files }, child?.id, child?.version ?? 0); toast.success('اطلاعات برای بررسی منابع انسانی ارسال شد'); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'ثبت انجام نشد.') } finally { setBusy(false) } }
  return <Dialog open onClose={onClose} dismissable={!busy} title={child ? 'ویرایش اطلاعات فرزند' : 'ثبت فرزند'} size="lg" footer={<><Button variant="outline" disabled={busy} onClick={onClose}>انصراف</Button><Button loading={busy} onClick={save}>ثبت و ارسال برای بررسی</Button></>}><fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">{error ? <div role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</div> : null}<Field label="نام" required>{(p) => <Input id={p.id} value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} maxLength={80} />}</Field><Field label="نام خانوادگی" required>{(p) => <Input id={p.id} value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} maxLength={100} />}</Field><Field label="کد ملی فرزند" required={policy.childNationalIdRequired}>{(p) => <Input id={p.id} value={v.nationalId} onChange={(e) => setV({ ...v, nationalId: toEnDigits(e.target.value) })} inputMode="numeric" maxLength={10} ltr />}</Field><Field label="تاریخ تولد" required>{(p) => <DatePicker id={p.id} value={v.birthDate} onChange={(birthDate) => setV({ ...v, birthDate })} max={toISODate(new Date())} />}</Field><Field label="نسبت" required>{(p) => <Select id={p.id} value={v.relation} onChange={(e) => setV({ ...v, relation: e.target.value as 'son' | 'daughter' })} options={[{ value: 'son', label: 'پسر' }, { value: 'daughter', label: 'دختر' }]} />}</Field><Field label="شناسنامه و مدارک پشتیبان" required helper="فایل اول شناسنامه فرزند است؛ مدارک تکمیلی را پس از آن اضافه کنید. برای جایگزینی، فایل قبلی را حذف و نسخه جدید را بارگذاری کنید؛ سوابق حفظ می‌شود." className="sm:col-span-2">{(p) => <FileUploader persistFile id={p.id} describedBy={p.describedBy} value={files} onChange={setFiles} maxFiles={5} maxSizeMb={10} />}</Field></fieldset></Dialog>
}
function InsuranceForm({ employeeId, record, onClose }: { employeeId: string; record?: InsuranceRecord; onClose: () => void }) {
  const db = useDB(); const actions = useActions(); const toast = useToast()
  const emp = db.employees.find((e) => e.id === employeeId)!
  const today = toJalali(new Date())
  const [period, setPeriod] = useState(periodKey(record?.year ?? today.jy, record?.month ?? today.jm))
  const [days, setDays] = useState(String(record?.days ?? ''))
  const [employer, setEmployer] = useState(record?.employer ?? db.companies.find((c) => c.id === emp.companyId)?.name ?? '')
  const [number, setNumber] = useState(record?.registrationNumber ?? '')
  const [files, setFiles] = useState<Attachment[]>(record?.documents ?? [])
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const [year, month] = period.split('-').map(Number)
  const cap = year && month ? Math.min(jalaliMonthLength(year, month), policyFor(db, emp.companyId).insuranceMonthlyCap ?? 31) : 0
  const save = async () => { if (busy) return; setBusy(true); setError(''); try { if (!days.trim()) throw new Error('تعداد روز بیمه را وارد کنید.'); await actions.saveInsurance(employeeId, { year, month, days: Number(toEnDigits(days)), employer, registrationNumber: number, documents: files }, record?.id, record?.version ?? 0); toast.success('سابقه برای بررسی ارسال شد'); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'ثبت انجام نشد.') } finally { setBusy(false) } }
  return <Dialog open onClose={onClose} dismissable={!busy} title={record ? 'اصلاح سابقه بیمه' : 'ثبت دستی سابقه بیمه'} size="lg" footer={<><Button variant="outline" disabled={busy} onClick={onClose}>انصراف</Button><Button loading={busy} onClick={save}>ثبت و ارسال برای بررسی</Button></>}><fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">{error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}<Field label="سال و ماه بیمه" required>{(p) => <MonthPicker id={p.id} value={period} onChange={setPeriod} />}</Field><Field label="روزهای بیمه" required helper={'حداکثر این دوره: ' + toFaDigits(cap) + ' روز؛ صفر نیز مجاز است.'}>{(p) => <Input id={p.id} aria-describedby={p.describedBy} value={days} onChange={(e) => setDays(toEnDigits(e.target.value))} inputMode="numeric" ltr />}</Field><Field label="کارفرما / شرکت" required>{(p) => <Input id={p.id} value={employer} onChange={(e) => setEmployer(e.target.value)} maxLength={150} />}</Field><Field label="شماره بیمه" optionalLabel>{(p) => <Input id={p.id} value={number} onChange={(e) => setNumber(toEnDigits(e.target.value))} maxLength={40} ltr />}</Field><Field label="سوابق یا فهرست بیمه به‌روز" optionalLabel helper="فایل قبلی در تاریخچه حفظ می‌شود. تأیید شرکت به معنی استعلام رسمی تأمین اجتماعی نیست." className="sm:col-span-2">{(p) => <FileUploader persistFile id={p.id} describedBy={p.describedBy} value={files} onChange={setFiles} maxFiles={5} maxSizeMb={10} />}</Field></fieldset></Dialog>
}
