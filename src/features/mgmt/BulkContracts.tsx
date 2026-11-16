import { useRef, useState } from 'react'
import { Users } from 'lucide-react'
import { Link } from 'react-router'
import { Button, Card, CardHeader, Checkbox, DatePicker, Field, Input, PageHeader, PageState, Select, useToast, Callout, EmptyState } from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { fullName, projectInScope, scopedEmployees } from '@/mock/selectors'
import { ContractBody } from '@/features/contracts/ContractParts'
import { formatDate, formatNumber, toEnDigits } from '@/lib/format'
import { uid } from '@/lib/cn'
import { jalaliMonthLength, jalaliToISO, toJalali } from '@/lib/jalali'
import type { Contract, ContractBatch } from '@/types/domain'
import type { BatchContractInput } from '@/mock/contractBatch'
import { useMgmt } from './useMgmt'
export function BulkContractsPage() {
  const db = useDB(); const m = useMgmt(); const actions = useActions(); const toast = useToast()
  const today = toJalali(new Date())
  const [q, setQ] = useState(''); const [project, setProject] = useState(''); const [org, setOrg] = useState(''); const [status, setStatus] = useState('')
  const [ids, setIds] = useState<Set<string>>(new Set())
  const templates = db.documentTemplates.filter((t) => t.companyId === m.entityId)
  const projects = db.projects.filter((p) => projectInScope(m.scope, p) && p.status !== 'closed')
  const employees = scopedEmployees(db, m.scope)
  const [v, setV] = useState({ contractType: 'قرارداد کار موقت', startDate: jalaliToISO(today.jy, today.jm, 1), endDate: jalaliToISO(today.jy, today.jm, jalaliMonthLength(today.jy, today.jm)), templateId: templates[0]?.id ?? '', description: '', salary: '', workingConditions: '۴۴ ساعت در هفته', projectId: '' })
  const [step, setStep] = useState<'edit' | 'preview' | 'result'>('edit')
  const [warnings, setWarnings] = useState<{ employeeId: string; name: string; error?: string }[]>([])
  const [snapshot, setSnapshot] = useState<BatchContractInput | null>(null)
  const [result, setResult] = useState<ContractBatch | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const batchKey = useRef(uid('batch'))
  const rows = employees.filter((e) => (!q || fullName(e).includes(q) || e.personnelNo.includes(toEnDigits(q).toUpperCase()) || (m.can('workforce.sensitive') && e.nationalId.includes(toEnDigits(q)))) && (!project || e.projectId === project) && (!org || e.orgId === org) && (!status || e.employmentStatus === status))
  const selected = employees.filter((e) => ids.has(e.id))
  const template = templates.find((t) => t.id === v.templateId)
  const preview = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (!v.salary.trim()) throw new Error('مبلغ حقوق توافق‌شده را وارد کنید؛ برای قرارداد بدون مبلغ، صفر وارد کنید.')
      const input: BatchContractInput = { ...v, salary: Number(toEnDigits(v.salary)), batchId: batchKey.current, employeeIds: selected.map((e) => e.id), templateVersion: template?.version ?? 0 }
      const checks = await actions.previewContractBatch(input)
      setWarnings(checks); setSnapshot(input); setStep('preview')
    } catch (e) { setError(e instanceof Error ? e.message : 'پیش‌نمایش انجام نشد.') } finally { setBusy(false) }
  }
  const generate = async (retry = false) => {
    if (!snapshot || busy) return
    setBusy(true); setError('')
    try {
      const employeeIds = retry ? result?.results.filter((r) => !r.contractId).map((r) => r.employeeId) ?? [] : snapshot.employeeIds
      const res = await actions.createContractBatch({ ...snapshot, employeeIds })
      setResult(res); setStep('result'); toast.success('نتیجه صدور گروهی آماده است')
    } catch (e) { setError(e instanceof Error ? e.message : 'صدور انجام نشد؛ با همین عملیات دوباره تلاش کنید.') } finally { setBusy(false) }
  }
  const remove = (id: string) => { setIds((ids) => new Set([...ids].filter((x) => x !== id))); setWarnings((xs) => xs.filter((x) => x.employeeId !== id)); setSnapshot((s) => s ? { ...s, employeeIds: s.employeeIds.filter((x) => x !== id) } : s) }
  const first = selected[0]
  const sample: Contract | undefined = first && snapshot && template ? { id: 'preview', number: 'پیش‌نمایش', kind: 'worker', title: v.contractType, contractType: v.contractType, companyId: first.companyId, orgId: first.orgId, projectId: snapshot.projectId || first.projectId || '', employeeId: first.id, startDate: snapshot.startDate, endDate: snapshot.endDate, stage: 'draft', parties: [], version: 1, versionHash: '', documentFormat: template, salary: [{ label: 'حقوق توافق‌شده', amount: snapshot.salary }], workHours: snapshot.workingConditions, jobTitle: first.jobTitle, workplace: first.workplace, description: snapshot.description, history: [] } : undefined
  return <>
    <PageHeader title="صدور گروهی قرارداد" description="برای هر نیرو یک پیش‌نویس مستقل با وضعیت و امضای جداگانه ایجاد می‌شود." back={{ to: '/company/contracts', label: 'قراردادها' }} />
    {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {step === 'edit' ? <PageState>{() => <div className="space-y-5"><Card><CardHeader title={'انتخاب نیروها — ' + formatNumber(selected.length) + ' نفر'} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label="جست‌وجوی نیرو" placeholder={m.can('workforce.sensitive') ? 'نام، پرسنلی یا کد ملی' : 'نام یا کد پرسنلی'} value={q} onChange={(e) => setQ(e.target.value)} /><Select aria-label="پروژه نیرو" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={projects.map((p) => ({ value: p.id, label: p.name }))} /><Select aria-label="سازمان" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="همه سازمان‌ها" options={db.organizations.filter((o) => employees.some((e) => e.orgId === o.id)).map((o) => ({ value: o.id, label: o.name }))} /><Select aria-label="وضعیت اشتغال" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={[{ value: 'active', label: 'فعال' }, { value: 'pending_start', label: 'در انتظار شروع' }, { value: 'suspended', label: 'تعلیق‌شده' }, { value: 'terminated', label: 'خاتمه‌یافته' }]} /></div><div className="my-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setIds(new Set([...ids, ...rows.map((e) => e.id)]))}>انتخاب همه نتایج ({formatNumber(rows.length)})</Button><Button variant="ghost" size="sm" onClick={() => setIds(new Set())}>لغو همه انتخاب‌ها</Button></div><ul className="max-h-80 overflow-y-auto divide-y divide-ink-100">{rows.map((e) => <li key={e.id} className="py-3"><Checkbox label={fullName(e) + ' — ' + e.personnelNo} checked={ids.has(e.id)} onChange={(event) => setIds((previous) => { const next = new Set(previous); if (event) next.add(e.id); else next.delete(e.id); return next })} /></li>)}</ul>{!rows.length ? <EmptyState icon={Users} compact title="نیرویی با این فیلترها نیست" /> : null}</Card><Card><CardHeader title="تنظیم قراردادها" /><div className="grid gap-4 sm:grid-cols-2"><Field label="نوع قرارداد" required>{(p) => <Input id={p.id} value={v.contractType} onChange={(e) => setV({ ...v, contractType: e.target.value })} maxLength={150} />}</Field><Field label="قالب شرکت" required>{(p) => <Select id={p.id} value={v.templateId} onChange={(e) => setV({ ...v, templateId: e.target.value })} options={templates.map((t) => ({ value: t.id, label: t.name }))} />}</Field><Field label="تاریخ شروع" required>{(p) => <DatePicker id={p.id} value={v.startDate} onChange={(startDate) => setV({ ...v, startDate })} clearable={false} />}</Field><Field label="تاریخ پایان" required>{(p) => <DatePicker id={p.id} value={v.endDate} onChange={(endDate) => setV({ ...v, endDate })} clearable={false} />}</Field><Field label="حقوق و مزایای توافق‌شده (ریال)" required>{(p) => <Input id={p.id} value={v.salary} onChange={(e) => setV({ ...v, salary: toEnDigits(e.target.value) })} inputMode="numeric" ltr />}</Field><Field label="شرایط و ساعات کار" required>{(p) => <Input id={p.id} value={v.workingConditions} onChange={(e) => setV({ ...v, workingConditions: e.target.value })} maxLength={500} />}</Field><Field label="پروژه در قرارداد" helper="خالی: پروژه فعلی هر نیرو. این انتخاب، پرونده استقرار نیرو را تغییر نمی‌دهد.">{(p) => <Select id={p.id} aria-describedby={p.describedBy} value={v.projectId} onChange={(e) => setV({ ...v, projectId: e.target.value })} placeholder="پروژه فعلی هر نیرو" options={projects.map((p) => ({ value: p.id, label: p.name }))} />}</Field><Field label="شرح قرارداد">{(p) => <Input id={p.id} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={1000} />}</Field></div><Button className="mt-5" disabled={!selected.length} loading={busy} onClick={preview}>بررسی و پیش‌نمایش {formatNumber(selected.length)} قرارداد</Button></Card></div>}</PageState> : null}
    {step === 'preview' && snapshot ? <div className="space-y-5"><Card><CardHeader title="بازبینی پیش از صدور" /><p className="text-sm">{formatNumber(snapshot.employeeIds.length)} نیرو؛ {snapshot.contractType}؛ از {formatDate(snapshot.startDate)} تا {formatDate(snapshot.endDate)}؛ قالب {template?.name}</p><ul className="mt-4 divide-y divide-ink-100">{warnings.map((r) => <li key={r.employeeId} className="flex flex-wrap items-center gap-3 py-3 text-sm"><span className="flex-1">{r.name}</span>{r.error ? <span className="text-red-700">{r.error}</span> : <span className="text-ink-600">آماده صدور</span>}<Button size="xs" variant="ghost" onClick={() => remove(r.employeeId)}>حذف از گروه</Button></li>)}</ul><Callout tone="neutral" className="mt-4">ردیف‌های نامعتبر با علت گزارش می‌شوند. موفقیت هر ردیف حفظ می‌شود و تکرار عملیات، قرارداد موفق را دوباره صادر نمی‌کند.</Callout><div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={() => setStep('edit')}>بازگشت و ویرایش</Button><Button loading={busy} disabled={!snapshot.employeeIds.length} onClick={() => generate()}>تأیید نهایی و صدور قراردادهای مستقل</Button></div></Card>{sample ? <Card><CardHeader title="نمونه سند اولین نیروی انتخاب‌شده" /><ContractBody c={sample} db={db} employee={first} /></Card> : null}</div> : null}
    {step === 'result' && result ? <Card><CardHeader title="گزارش صدور گروهی" /><h2 className="mb-3 font-bold">موفق: {formatNumber(result.results.filter((r) => r.contractId).length)}</h2><ul className="space-y-3">{result.results.filter((r) => r.contractId).map((r) => <li key={r.employeeId} className="text-sm"><Link className="font-semibold text-brand-700 underline" to={'/company/contracts/' + r.contractId}>{fullName(employees.find((e) => e.id === r.employeeId)!)} — مشاهده قرارداد</Link></li>)}</ul><h2 className="mb-3 mt-6 font-bold">ناموفق: {formatNumber(result.results.filter((r) => !r.contractId).length)}</h2><ul className="space-y-3">{result.results.filter((r) => !r.contractId).map((r) => <li key={r.employeeId} className="text-sm text-red-700">{employees.find((e) => e.id === r.employeeId)?.personnelNo ?? 'نیرو'} — {r.error}</li>)}</ul><div className="mt-5 flex flex-wrap gap-3">{result.results.some((r) => !r.contractId) ? <Button loading={busy} onClick={() => generate(true)}>تلاش دوباره فقط برای ناموفق‌ها</Button> : null}<Button variant="outline" onClick={() => { batchKey.current = uid('batch'); setIds(new Set()); setResult(null); setStep('edit') }}>عملیات جدید</Button></div></Card> : null}
  </>
}
