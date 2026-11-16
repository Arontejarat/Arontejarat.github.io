import type { ReactNode } from 'react'
import type { CompanyDocumentTemplate, Employee, Payslip } from '@/types/domain'
import { formatDate, formatPeriod, formatRial } from '@/lib/format'

export function CompanyDocument({ template, title, number, children }: { template?: CompanyDocumentTemplate; title: string; number?: string; children: ReactNode }) {
  return <article className="space-y-5 rounded-lg bg-white p-4 text-sm leading-7 text-ink-900 sm:p-6" dir="rtl">
    {template ? <header className="space-y-2 border-b border-ink-200 pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-bold">{template.companyName}</p><p>{template.registrationInfo}</p><p>{template.address}</p><p dir="auto">{template.contact}</p></div>{template.logo?.previewUrl ? <img src={template.logo.previewUrl} alt={'نشان ' + template.companyName} className="h-16 w-24 object-contain" /> : null}</div><p className="whitespace-pre-wrap">{template.header}</p></header> : null}
    <h2 className="text-center text-lg font-bold">{title}</h2>
    {number && template?.showNumber !== false ? <p>شماره سند: <bdi>{number}</bdi></p> : null}
    {children}
    {template ? <footer className="space-y-4 border-t border-ink-200 pt-4"><p className="whitespace-pre-wrap">{template.extraText}</p><p>{template.signatoryName} — {template.signatoryTitle}</p><div className="flex flex-wrap justify-between gap-5">{template.signatureArea ? <p className="min-h-20">محل امضای نماینده مجاز</p> : null}{template.stampArea ? <p className="min-h-20">محل مهر شرکت</p> : null}</div><p className="whitespace-pre-wrap text-xs">{template.footer}</p></footer> : null}
  </article>
}
export function BrandedPayslip({ payslip, employee }: { payslip: Payslip; employee: Employee }) {
  const t = payslip.documentFormat
  const amount = (lines: { amount: number }[]) => lines.reduce((s, l) => s + l.amount, 0)
  return <CompanyDocument template={t} title={t?.payslipTitle ?? 'فیش حقوقی'} number={payslip.id}><p>نیروی کار: {employee.firstName} {employee.lastName} — شماره پرسنلی: <bdi>{employee.personnelNo}</bdi></p><p>دوره: {formatPeriod(payslip.year, payslip.month)} — صدور: {formatDate(payslip.correctedAt ?? payslip.issuedAt)}</p>{payslip.source === 'file' ? <div><p className="font-semibold">برگه مشخصات فیش پیوست</p><p>اصل فیش: <bdi>{payslip.file?.name}</bdi></p><p>مبالغ و جزئیات در فایل اصلی درج شده‌اند. این برگه جایگزین یا ویرایش فایل اصلی نیست.</p></div> : <div className="space-y-4">{[{ title: 'دریافتی‌ها', lines: payslip.earnings }, { title: 'کسورات', lines: payslip.deductions }].map((group) => <section key={group.title}><h3 className="font-bold">{group.title}</h3>{group.lines.map((l, i) => <p key={i} className="flex justify-between gap-3"><span>{l.label}</span><span>{formatRial(l.amount)}</span></p>)}</section>)}<p className="font-bold">خالص پرداختی: {formatRial(amount(payslip.earnings) - amount(payslip.deductions))}</p></div>}<p>وضعیت پرداخت: {payslip.payment?.status === 'paid' ? 'پرداخت‌شده' : payslip.payment?.status === 'processing' ? 'در حال پرداخت' : 'اطلاعات پرداخت در دسترس نیست'}</p></CompanyDocument>
}
