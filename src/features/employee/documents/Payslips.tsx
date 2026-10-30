import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ChevronLeft, CircleCheck, CircleDashed, Download, FileWarning, History, Loader, Receipt, SearchX } from 'lucide-react'
import { Button, ButtonLink, Callout, Card, CardHeader, ColumnChart, DataTable, EmptyState, FilterBar, Ltr, PageHeader, PageState, SearchInput, Select, StatusBadge, Tabs, type Column } from '@/components/ui'
import { useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, fullName } from '@/mock/selectors'
import { PAYMENT_STATUS, PAYSLIP_STATUS } from '@/config/status'
import { formatDate, formatNumber, formatPeriod, formatRial, toFaDigits } from '@/lib/format'
import { JALALI_MONTHS, periodKey } from '@/lib/jalali'
import { cn } from '@/lib/cn'
import type { Payslip } from '@/types/domain'
import { DocumentsTabs } from './DocumentsHub'

export const gross = (p: Pick<Payslip, 'earnings'>) => p.earnings.reduce((a, b) => a + b.amount, 0)
export const totalDeductions = (p: Pick<Payslip, 'deductions'>) => p.deductions.reduce((a, b) => a + b.amount, 0)
export const netPay = (p: Pick<Payslip, 'earnings' | 'deductions'>) => gross(p) - totalDeductions(p)

function paymentMeta(p: Payslip) {
  return p.payment ? PAYMENT_STATUS[p.payment.status] : PAYMENT_STATUS.unknown
}

export function PayslipListPage() {
  return (
    <>
      <PageHeader title="فیش‌های حقوقی" description="فیش‌های صادرشده و سوابق پرداخت شما." breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'فیش‌های حقوقی' }]} back={{ to: '/me/documents', label: 'اسناد من' }} />
      <DocumentsTabs />
      <PageState>{({ empty }) => <PayslipList empty={empty} />}</PageState>
    </>
  )
}

function PayslipList({ empty }: { empty: boolean }) {
  const db = useDB()
  const emp = useCurrentEmployee()
  const all = empty ? [] : db.payslips.filter((p) => p.employeeId === emp.id).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
  const years = [...new Set(all.map((p) => p.year))]
  const [year, setYear] = useState(String(years[0] ?? ''))
  const [month, setMonth] = useState('')
  const [q, setQ] = useState('')
  const rows = useMemo(() => all.filter((p) => (!year || String(p.year) === year) && (!month || String(p.month) === month) && (!q || formatPeriod(p.year, p.month).includes(q))), [all, year, month, q])
  if (all.length === 0) return <EmptyState icon={Receipt} title="هنوز فیش حقوقی صادر نشده است" description="پس از محاسبه حقوق اولین ماه کاری، فیش شما در این بخش نمایش داده می‌شود." />
  const trend = [...all].slice(0, 12).reverse()

  const columns: Column<Payslip>[] = [
    { id: 'period', header: 'دوره حقوق', cell: (p) => <span className="font-semibold">{formatPeriod(p.year, p.month)}</span>, sortValue: (p) => p.year * 12 + p.month },
    { id: 'status', header: 'وضعیت فیش', cell: (p) => <StatusBadge meta={PAYSLIP_STATUS[p.status]} variant="dot" /> },
    { id: 'net', header: 'مبلغ خالص', cell: (p) => <span className="font-semibold tabular">{formatRial(netPay(p))}</span>, sortValue: netPay },
    { id: 'issued', header: 'تاریخ صدور', cell: (p) => formatDate(p.correctedAt ?? p.issuedAt) },
    { id: 'pay', header: 'وضعیت پرداخت', cell: (p) => <StatusBadge meta={paymentMeta(p)} size="sm" /> },
    { id: 'go', header: <span className="sr-only">جزئیات</span>, cell: () => <ChevronLeft size={16} className="text-ink-300" aria-hidden />, className: 'w-8' },
  ]
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="خالص پرداختی ماه‌های اخیر" description="روند مبلغ خالص درج‌شده در فیش‌ها (ریال)" />
        <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-500">آخرین فیش ({formatPeriod(all[0].year, all[0].month)})</dt>
            <dd className="text-base font-bold tabular">{formatRial(netPay(all[0]))}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">میانگین {toFaDigits(trend.length)} ماه</dt>
            <dd className="text-base font-bold tabular">{formatRial(Math.round(trend.reduce((a, p) => a + netPay(p), 0) / trend.length))}</dd>
          </div>
          <div className="max-sm:hidden">
            <dt className="text-xs text-ink-500">بیشترین</dt>
            <dd className="text-base font-bold tabular">{formatRial(Math.max(...trend.map(netPay)))}</dd>
          </div>
        </dl>
        <ColumnChart data={trend.map((p) => ({ label: JALALI_MONTHS[p.month - 1], sub: formatPeriod(p.year, p.month), value: netPay(p) }))} format={(n) => formatRial(n)} highlightLast />
      </Card>
      <div>
        <FilterBar
          search={<SearchInput value={q} onChange={setQ} placeholder="جست‌وجوی دوره، مثلاً مهر" />}
          activeCount={[month].filter(Boolean).length}
          onClear={() => setMonth('')}
        >
          <Select aria-label="سال شمسی" className="w-full sm:w-36" value={year} onChange={(e) => setYear(e.target.value)} placeholder="همه سال‌ها" options={years.map((y) => ({ value: String(y), label: toFaDigits(y) }))} />
          <Select aria-label="ماه" className="w-full sm:w-36" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="همه ماه‌ها" options={JALALI_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        </FilterBar>
        <DataTable
          rows={rows}
          columns={columns}
          getId={(p) => p.id}
          rowHref={(p) => `/me/documents/payslips/${p.id}`}
          pageSize={12}
          caption="فهرست فیش‌های حقوقی"
          mobileCard={(p) => (
            <Link to={`/me/documents/payslips/${p.id}`} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{formatPeriod(p.year, p.month)}</p>
                <p className="mt-0.5 text-base font-extrabold tabular">{formatRial(netPay(p))}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusBadge meta={PAYSLIP_STATUS[p.status]} size="sm" />
                  <StatusBadge meta={paymentMeta(p)} size="sm" />
                </div>
              </div>
              <ChevronLeft size={18} className="text-ink-300" aria-hidden />
            </Link>
          )}
          empty={<EmptyState compact icon={SearchX} title="فیشی برای این دوره پیدا نشد" />}
        />
      </div>
    </div>
  )
}

export function PayslipDetailPage() {
  const { id } = useParams()
  const db = useDB()
  const emp = useCurrentEmployee()
  const p = db.payslips.find((x) => x.id === id)
  const [version, setVersion] = useState('current')
  if (!p) return <Navigate to="/me/documents/payslips" replace />
  // Server enforces this too: employees can only read their own payslips
  if (p.employeeId !== emp.id) return <Navigate to="/forbidden" replace />
  const shown: Omit<Payslip, 'previous'> = version === 'current' ? p : p.previous?.find((x) => String(x.version) === version) ?? p
  const company = companyById(db, emp.companyId)
  const paySteps = [
    { label: 'فیش صادر شده', done: true, date: formatDate(p.issuedAt), icon: Receipt },
    { label: 'پرداخت در حال انجام', done: Boolean(p.payment), active: p.payment?.status === 'processing', icon: Loader },
    { label: 'پرداخت انجام شده', done: p.payment?.status === 'paid', date: p.payment?.paidAt ? formatDate(p.payment.paidAt) : undefined, icon: CircleCheck },
  ]
  return (
    <>
      <PageHeader
        title={`فیش حقوقی ${formatPeriod(p.year, p.month)}`}
        breadcrumbs={[{ label: 'اسناد من', to: '/me/documents' }, { label: 'فیش‌های حقوقی', to: '/me/documents/payslips' }, { label: formatPeriod(p.year, p.month) }]}
        back={{ to: '/me/documents/payslips', label: 'فیش‌های حقوقی' }}
        meta={<StatusBadge meta={PAYSLIP_STATUS[p.status]} />}
        actions={
          <>
            <ButtonLink to={`/me/requests/new?type=payslip_objection&month=${periodKey(p.year, p.month)}`} variant="ghost" icon={FileWarning} className="no-print">
              اعتراض به فیش
            </ButtonLink>
            <Button icon={Download} variant="outline" onClick={() => window.print()} className="no-print">
              دریافت PDF
            </Button>
          </>
        }
      />
      {p.previous?.length ? (
        <div className="no-print mb-4">
          <Tabs
            variant="pills"
            value={version}
            onChange={setVersion}
            tabs={[{ id: 'current', label: `نسخه فعلی (${toFaDigits(p.version)})`, icon: CircleCheck }, ...p.previous.map((v) => ({ id: String(v.version), label: `نسخه قبلی (${toFaDigits(v.version)})`, icon: History }))]}
          />
          {version !== 'current' ? (
            <Callout tone="warning" className="mt-3" title="در حال مشاهده نسخه اصلاح‌شده قبلی">
              این نسخه جایگزین شده و فقط برای سابقه نمایش داده می‌شود.
            </Callout>
          ) : p.correctionNote ? (
            <Callout tone="info" className="mt-3" title={`اصلاح‌شده در ${formatDate(p.correctedAt)}`}>
              {p.correctionNote}
            </Callout>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="print-area">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-4">
            <div>
              <p className="text-xs text-ink-500">{company?.name}</p>
              <p className="text-base font-bold">{fullName(emp)}</p>
              <p className="text-xs text-ink-500">
                شماره پرسنلی <Ltr>{emp.personnelNo}</Ltr>، {emp.jobTitle}
              </p>
            </div>
            <div className="text-end text-xs text-ink-500">
              <p>دوره: {formatPeriod(shown.year, shown.month)}</p>
              <p>کارکرد: {formatNumber(shown.workDays)} روز</p>
              <p>صدور: {formatDate(shown.issuedAt)}</p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <LineTable title="دریافتی‌ها" lines={shown.earnings} total={gross(shown)} totalLabel="جمع ناخالص" />
            <LineTable title="کسورات" lines={shown.deductions} total={totalDeductions(shown)} totalLabel="جمع کسورات" negative />
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-900 px-5 py-4 text-white">
            <span className="text-sm">خالص پرداختی</span>
            <span className="text-xl font-extrabold tabular">{formatRial(netPay(shown))}</span>
          </div>
          <p className="mt-3 text-2xs leading-5 text-ink-500">اقلام فیش بر اساس اطلاعات سامانه حقوق و دستمزد نمایش داده می‌شود و ممکن است برای همه نیروها یکسان نباشد.</p>
        </Card>

        <aside className="no-print space-y-5">
          <Card>
            <CardHeader title="وضعیت پرداخت" description="صدور فیش به معنی واریز حقوق نیست." />
            <ol className="space-y-3">
              {paySteps.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={cn('grid size-8 place-items-center rounded-full', s.done ? (s.active ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600') : 'border border-dashed border-ink-300 text-ink-400')}>
                    {s.done ? <s.icon size={16} aria-hidden /> : <CircleDashed size={16} aria-hidden />}
                  </span>
                  <span className="flex-1 text-sm">
                    <span className={cn('block font-medium', !s.done && 'text-ink-500')}>{s.label}</span>
                    {s.date ? <span className="block text-xs text-ink-500">{s.date}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            {!p.payment ? <p className="mt-3 rounded-md bg-ink-50 p-2.5 text-xs text-ink-600">{PAYMENT_STATUS.unknown.hint}</p> : null}
            {p.payment?.reference ? (
              <p className="mt-3 text-xs text-ink-500">
                شماره پیگیری بانکی: <Ltr>{toFaDigits(p.payment.reference)}</Ltr>
              </p>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="خلاصه" />
            <dl className="space-y-2 text-sm">
              {[
                ['جمع ناخالص', formatRial(gross(shown))],
                ['جمع کسورات', formatRial(totalDeductions(shown))],
                ['خالص پرداختی', formatRial(netPay(shown))],
                ['اضافه‌کاری', `${formatNumber(shown.overtimeHours)} ساعت`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </>
  )
}

function LineTable({ title, lines, total, totalLabel, negative }: { title: string; lines: { label: string; amount: number; note?: string }[]; total: number; totalLabel: string; negative?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <table className="w-full text-sm">
        <tbody>
          {lines.map((l) => (
            <tr key={l.label} className="border-b border-ink-100">
              <td className="py-2 text-ink-700">
                {l.label}
                {l.note ? <span className="ms-1 text-xs text-ink-500">({toFaDigits(l.note)})</span> : null}
              </td>
              <td className={cn('py-2 text-end tabular', negative && 'text-red-700')}>{formatRial(l.amount, { unit: false })}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-2.5 font-bold">{totalLabel}</td>
            <td className={cn('pt-2.5 text-end font-bold tabular', negative && 'text-red-700')}>{formatRial(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
