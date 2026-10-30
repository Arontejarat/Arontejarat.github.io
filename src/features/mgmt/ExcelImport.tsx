import { useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Copy, Download, FileSpreadsheet, FileUp, Pencil, Plus, RefreshCw, Upload } from 'lucide-react'
import { Badge, Button, Callout, Card, CardHeader, EmptyState, PageHeader, Tabs, useToast } from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { fullName, projectById, scopedEmployees } from '@/mock/selectors'
import { formatDate, toEnDigits, toFaDigits } from '@/lib/format'
import { isValidMobile, isValidNationalId } from '@/lib/validation'
import { jalaliMonthLength, jalaliToISO, toISODate } from '@/lib/jalali'
import { cn } from '@/lib/cn'
import type { ImportRow } from '@/mock/actions'
import { useMgmt } from './useMgmt'
import { downloadCsv } from './Workforce'

const HEADER = ['کد پرسنلی', 'نام', 'نام خانوادگی', 'کد ملی', 'موبایل', 'کد پروژه', 'سمت شغلی', 'تاریخ شروع (شمسی)']

interface Checked extends ImportRow {
  action: 'add' | 'update' | 'error' | 'duplicate'
  errors: string[]
  changes?: string[]
}

/** Minimal CSV parser (quoted fields, commas, CRLF) — enough for Excel "CSV UTF-8" exports */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1
      row.push(cell.trim())
      if (row.some((c) => c)) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c)) rows.push(row)
  return rows
}

function parseJalaliDate(v: string): string | null {
  const m = toEnDigits(v).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1300 || y > 1500 || mo < 1 || mo > 12 || d < 1 || d > jalaliMonthLength(y, mo)) return null
  return jalaliToISO(y, mo, d)
}

export function ExcelImportPage() {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState('import')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Checked[] | null>(null)
  const [result, setResult] = useState<{ added: number; updated: number; rejected: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const projects = db.projects.filter((p) => p.companyId === m.entityId && p.status !== 'closed')

  const validate = (raw: string[][]): Checked[] => {
    const body = raw[0]?.[0]?.includes('کد پرسنلی') ? raw.slice(1) : raw
    const seenNo = new Map<string, number>()
    const seenNid = new Map<string, number>()
    return body.map((r, i) => {
      const [personnelNo = '', firstName = '', lastName = '', nationalId = '', mobile = '', projectCode = '', jobTitle = '', start = ''] = r.map((c) => c.trim())
      const row: Checked = { rowNo: i + 2, personnelNo: toEnDigits(personnelNo).toUpperCase(), firstName, lastName, nationalId: toEnDigits(nationalId), mobile: toEnDigits(mobile), projectCode: toEnDigits(projectCode).toUpperCase(), jobTitle, startDate: '', action: 'add', errors: [] }
      if (!row.personnelNo) row.errors.push('کد پرسنلی خالی است')
      if (!firstName || !lastName) row.errors.push('نام یا نام خانوادگی خالی است')
      if (!isValidNationalId(row.nationalId)) row.errors.push('کد ملی نامعتبر')
      if (row.mobile && !isValidMobile(row.mobile)) row.errors.push('شماره موبایل نامعتبر')
      const project = db.projects.find((p) => p.code === row.projectCode && p.companyId === m.entityId)
      if (!project) row.errors.push(`پروژه ناموجود (${row.projectCode || 'خالی'})`)
      const iso = parseJalaliDate(start)
      if (!iso) row.errors.push('تاریخ نادرست (قالب ۱۴۰۵/۰۸/۱۰)')
      else row.startDate = iso
      if (!jobTitle) row.errors.push('سمت شغلی خالی است')
      // Duplicates inside the file
      if (seenNo.has(row.personnelNo)) row.errors.push(`کد پرسنلی تکراری در فایل (ردیف ${toFaDigits(seenNo.get(row.personnelNo)!)})`)
      if (seenNid.has(row.nationalId)) row.errors.push(`کد ملی تکراری در فایل (ردیف ${toFaDigits(seenNid.get(row.nationalId)!)})`)
      seenNo.set(row.personnelNo, row.rowNo)
      seenNid.set(row.nationalId, row.rowNo)
      const existing = db.employees.find((e) => e.personnelNo === row.personnelNo)
      const sameNid = db.employees.find((e) => e.nationalId === row.nationalId)
      if (row.errors.length) row.action = 'error'
      else if (existing && existing.nationalId === row.nationalId) {
        const changes: string[] = []
        if (existing.jobTitle !== jobTitle) changes.push(`سمت: ${existing.jobTitle} ← ${jobTitle}`)
        if (existing.projectId !== project!.id) changes.push(`پروژه: ${projectById(db, existing.projectId)?.code ?? '—'} ← ${project!.code}`)
        row.action = changes.length ? 'update' : 'duplicate'
        row.changes = changes
      } else if (existing) {
        row.action = 'error'
        row.errors.push('کد پرسنلی تکراری (متعلق به نیروی دیگر)')
      } else if (sameNid) {
        row.action = 'error'
        row.errors.push(`کد ملی قبلاً با کد پرسنلی ${sameNid.personnelNo} ثبت شده است`)
      }
      return row
    })
  }

  const loadFile = async (f: File | undefined) => {
    if (!f) return
    setResult(null)
    if (!/\.(csv|txt)$/i.test(f.name)) {
      toast.error('فایل انتخاب‌شده معتبر نیست', 'در این نسخه نمایشی، فایل را در Excel با قالب «CSV UTF-8» ذخیره کنید. پردازش مستقیم xlsx در سمت سرور انجام می‌شود.')
      return
    }
    const text = await f.text()
    setFileName(f.name)
    setRows(validate(parseCsv(text)))
  }

  const loadSample = () => {
    const p = projects[0]?.code ?? 'PRJ-1403-021'
    const p2 = projects[2]?.code ?? p
    const ex = scopedEmployees(db, m.scope)[3]
    const sample = [
      HEADER,
      ['PA-20011', 'نگار', 'امینی', '0499370899', '09151112233', p2, 'کارگر فضای سبز', '1405/08/15'],
      ['PA-20012', 'بهروز', 'کیانی', '0067749828', '09152223344', p2, 'کارگر فضای سبز', '1405/08/15'],
      [ex?.personnelNo ?? 'PA-10251', ex?.firstName ?? '', ex?.lastName ?? '', ex?.nationalId ?? '', ex?.mobile ?? '', p, 'سرپرست شیفت', '1404/02/01'],
      ['PA-20013', 'سحر', 'رنجبر', '1234567890', '09153334455', p2, 'راننده', '1405/08/20'],
      ['PA-20014', 'کامیار', 'صدری', '0013542419', '09154445566', 'PRJ-9999-999', 'راننده', '1405/08/20'],
      ['PA-20011', 'نگار', 'امینی', '0499370899', '09151112233', p2, 'کارگر فضای سبز', '1405/13/40'],
    ]
    setFileName('نمونه-نیروهای-فضای-سبز.csv')
    setResult(null)
    setRows(validate(sample))
  }

  const counts = rows ? { add: rows.filter((r) => r.action === 'add').length, update: rows.filter((r) => r.action === 'update').length, duplicate: rows.filter((r) => r.action === 'duplicate').length, error: rows.filter((r) => r.action === 'error').length } : null
  const shown = rows?.filter((r) => filter === 'all' || r.action === filter) ?? []

  const apply = async () => {
    if (!rows) return
    setBusy(true)
    try {
      const ok = rows.filter((r) => r.action === 'add' || r.action === 'update') as (ImportRow & { action: 'add' | 'update' })[]
      const res = await actions.applyImport(ok)
      setResult({ ...res, rejected: rows.length - ok.length })
      setRows(null)
      toast.success('ورود اطلاعات انجام شد')
    } catch (x) {
      toast.fromError(x)
    } finally {
      setBusy(false)
    }
  }

  const exportList = () => {
    const emps = scopedEmployees(db, m.scope).filter((e) => e.employmentStatus !== 'terminated')
    downloadCsv(
      `niroo-export-${toISODate(new Date())}.csv`,
      HEADER,
      emps.map((e) => [e.personnelNo, e.firstName, e.lastName, m.can('workforce.sensitive') ? e.nationalId : '', e.mobile, projectById(db, e.projectId)?.code ?? '', e.jobTitle, formatDate(e.startDate, 'short').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))]),
    )
    toast.success('فهرست نیروها با قالب ورود گروهی دریافت شد', 'می‌توانید آن را ویرایش و دوباره بارگذاری کنید.')
  }

  return (
    <>
      <PageHeader title="ورود و خروج گروهی Excel" description="بارگذاری فهرست نیروها با پیش‌نمایش و اعتبارسنجی؛ هیچ تغییری پیش از تأیید نهایی شما روی اطلاعات اصلی نوشته نمی‌شود." breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'نیروها', to: `${m.base}/workforce` }, { label: 'ورود و خروج Excel' }]} />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ id: 'import', label: 'ورود اطلاعات', icon: FileUp }, { id: 'export', label: 'خروجی فهرست', icon: Download }]} />
      {tab === 'export' ? (
        <Card className="max-w-2xl">
          <CardHeader title="دریافت فهرست نیروها" description="خروجی با همان قالب فایل ورود است تا بتوانید فهرست موجود را ویرایش و دوباره بارگذاری کنید." />
          <Callout tone="neutral">خروجی بر اساس سطح دسترسی شما تهیه می‌شود{m.can('workforce.sensitive') ? '.' : '؛ کد ملی در فایل درج نمی‌شود.'}</Callout>
          <Button className="mt-4" icon={Download} onClick={exportList}>
            دریافت فایل ({toFaDigits(scopedEmployees(db, m.scope).length)} نیرو)
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          <ol className="grid gap-3 md:grid-cols-4">
            {['دانلود فایل نمونه', 'تکمیل و بارگذاری فایل', 'بررسی پیش‌نمایش و خطاها', 'تأیید نهایی و گزارش نتیجه'].map((s, i) => {
              const step = result ? 4 : rows ? 3 : fileName ? 2 : 1
              return (
                <li key={s} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]', step > i + 1 ? 'border-emerald-200 bg-emerald-50/50' : step === i + 1 ? 'border-brand-300 bg-brand-50/60 font-semibold' : 'border-ink-200 bg-white text-ink-500')} aria-current={step === i + 1 ? 'step' : undefined}>
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-brand-800 text-white' : 'bg-ink-200 text-ink-600')}>{toFaDigits(i + 1)}</span>
                  {s}
                </li>
              )
            })}
          </ol>

          {result ? (
            <Card className="text-center">
              <CircleCheck size={36} className="mx-auto text-emerald-600" aria-hidden />
              <h2 className="mt-3 text-lg font-bold">گزارش نتیجه ورود اطلاعات</h2>
              <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xl font-bold tabular text-emerald-700">{toFaDigits(result.added)}</p>
                  <p className="text-xs text-ink-600">نیروی جدید</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-3">
                  <p className="text-xl font-bold tabular text-brand-700">{toFaDigits(result.updated)}</p>
                  <p className="text-xs text-ink-600">اصلاح‌شده</p>
                </div>
                <div className="rounded-lg bg-ink-100 p-3">
                  <p className="text-xl font-bold tabular text-ink-700">{toFaDigits(result.rejected)}</p>
                  <p className="text-xs text-ink-600">ثبت‌نشده</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-ink-500">همه تغییرات با نام شما در سوابق نیروها و تاریخچه فعالیت‌ها ثبت شد.</p>
              <Button className="mt-4" variant="outline" icon={RefreshCw} onClick={() => { setResult(null); setFileName('') }}>
                ورود فایل جدید
              </Button>
            </Card>
          ) : !rows ? (
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader title="۱. فایل نمونه" icon={FileSpreadsheet} />
                <p className="text-sm leading-7 text-ink-600">ستون‌ها: {HEADER.join('، ')}. تاریخ‌ها را به شمسی (مثلاً ۱۴۰۵/۰۸/۱۰) وارد کنید.</p>
                <Button className="mt-4" variant="outline" icon={Download} onClick={() => downloadCsv('niroo-import-template.csv', HEADER, [['PA-20001', 'نام', 'نام خانوادگی', '0012345679', '09120000000', projects[0]?.code ?? 'PRJ-1403-021', 'نیروی خدماتی', '1405/08/15']])}>
                  دانلود فایل نمونه
                </Button>
              </Card>
              <Card>
                <CardHeader title="۲. بارگذاری فایل" icon={Upload} />
                <div
                  className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ink-200 bg-ink-25 p-6 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    void loadFile(e.dataTransfer.files[0])
                  }}
                >
                  <FileUp size={26} className="text-brand-700" aria-hidden />
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    انتخاب فایل CSV
                  </Button>
                  <p className="text-xs text-ink-500">فایل Excel را با قالب «CSV UTF-8» ذخیره کنید.</p>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
                </div>
                <Button variant="link" size="sm" className="mt-3" onClick={loadSample}>
                  استفاده از فایل نمونه دارای خطا (نمایشی)
                </Button>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader
                title={`۳. پیش‌نمایش: ${fileName}`}
                description={`${toFaDigits(rows.length)} ردیف بررسی شد. ردیف‌های دارای خطا ثبت نمی‌شوند؛ فایل را اصلاح و دوباره بارگذاری کنید.`}
                action={
                  <Button variant="ghost" size="sm" onClick={() => { setRows(null); setFileName('') }}>
                    انتخاب فایل دیگر
                  </Button>
                }
              />
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'همه', n: rows.length, tone: 'neutral' as const },
                  { id: 'add', label: 'رکورد جدید', n: counts!.add, tone: 'success' as const, icon: Plus },
                  { id: 'update', label: 'اصلاح', n: counts!.update, tone: 'brand' as const, icon: Pencil },
                  { id: 'duplicate', label: 'تکراری بدون تغییر', n: counts!.duplicate, tone: 'muted' as const, icon: Copy },
                  { id: 'error', label: 'رد به‌دلیل خطا', n: counts!.error, tone: 'danger' as const, icon: CircleAlert },
                ].map((f) => (
                  <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('rounded-full ring-offset-2', filter === f.id && 'ring-2 ring-brand-400')}>
                    <Badge tone={f.tone} icon={f.icon}>
                      {f.label}: {toFaDigits(f.n)}
                    </Badge>
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <EmptyState compact icon={FileSpreadsheet} title="ردیفی در این دسته نیست" />
              ) : (
                <div className="scrollbar-thin relative overflow-x-auto rounded-lg border border-ink-200">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-ink-50 text-xs text-ink-600">
                      <tr>
                        {['ردیف', 'نتیجه', 'کد پرسنلی', 'نام', 'کد ملی', 'پروژه', 'سمت', 'توضیح'].map((h) => (
                          <th key={h} className="px-3 py-2 text-start font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.rowNo} className={cn('border-t border-ink-100', r.action === 'error' && 'bg-red-50/50')}>
                          <td className="px-3 py-2 tabular">{toFaDigits(r.rowNo)}</td>
                          <td className="px-3 py-2">
                            <Badge size="sm" tone={r.action === 'add' ? 'success' : r.action === 'update' ? 'brand' : r.action === 'error' ? 'danger' : 'muted'}>
                              {{ add: 'افزوده می‌شود', update: 'اصلاح می‌شود', duplicate: 'بدون تغییر', error: 'رد می‌شود' }[r.action]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <bdi dir="ltr" className="text-xs">{r.personnelNo}</bdi>
                          </td>
                          <td className="px-3 py-2">{`${r.firstName} ${r.lastName}`}</td>
                          <td className="px-3 py-2">
                            <bdi dir="ltr" className="text-xs">{r.nationalId}</bdi>
                          </td>
                          <td className="px-3 py-2">
                            <bdi dir="ltr" className="text-xs">{r.projectCode}</bdi>
                          </td>
                          <td className="px-3 py-2 text-xs">{r.jobTitle}</td>
                          <td className="px-3 py-2 text-xs">{r.errors.length ? <span className="text-red-700">{r.errors.join('، ')}</span> : r.changes?.length ? <span className="text-brand-800">{r.changes.join('، ')}</span> : r.action === 'duplicate' ? 'اطلاعات با پرونده فعلی یکسان است' : 'نیروی جدید — وضعیت «در انتظار شروع»'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-500">با تأیید نهایی، {toFaDigits(counts!.add)} نیروی جدید افزوده و {toFaDigits(counts!.update)} رکورد اصلاح می‌شود. {toFaDigits(counts!.error + counts!.duplicate)} ردیف ثبت نمی‌شود.</p>
                <Button loading={busy} disabled={counts!.add + counts!.update === 0} icon={CircleCheck} onClick={apply}>
                  تأیید نهایی و ثبت تغییرات
                </Button>
              </div>
            </Card>
          )}
          {!rows && !result ? (
            <Card>
              <CardHeader title="نمونه نیروهای فعلی" description="برای اطمینان از قالب، چند ردیف از فهرست فعلی:" />
              <ul className="divide-y divide-ink-100 text-sm">
                {scopedEmployees(db, m.scope)
                  .slice(0, 3)
                  .map((e) => (
                    <li key={e.id} className="flex justify-between py-2">
                      <span>{fullName(e)}</span>
                      <bdi dir="ltr" className="text-xs text-ink-500">
                        {e.personnelNo}، {projectById(db, e.projectId)?.code}
                      </bdi>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </>
  )
}
