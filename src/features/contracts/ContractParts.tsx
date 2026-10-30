import { CircleCheck, CircleDashed, Hourglass } from 'lucide-react'
import type { Contract, Employee } from '@/types/domain'
import { cn } from '@/lib/cn'
import { formatDate, formatPeriod, formatRial, toFaDigits } from '@/lib/format'
import { SHIFT_LABEL } from '@/config/requestTypes'
import type { DB } from '@/mock/seed'
import { companyById, orgById, projectById } from '@/mock/selectors'

/** Full contract text — rendered from the exact version that is signed. */
export function ContractBody({ c, db, employee }: { c: Contract; db: DB; employee?: Employee }) {
  const company = companyById(db, c.companyId)
  const org = orgById(db, c.orgId)
  const project = projectById(db, c.projectId)
  const total = c.salary?.reduce((a, b) => a + b.amount, 0) ?? 0
  if (c.kind === 'project') {
    return (
      <article className="contract-prose text-[15px] leading-8 text-ink-800">
        <h2 className="text-center text-lg font-extrabold">{c.title}</h2>
        <p className="text-center text-xs text-ink-500">
          شماره <bdi dir="ltr">{c.number}</bdi>، نسخه {toFaDigits(c.version)}
        </p>
        <h3>ماده ۱ — طرفین قرارداد</h3>
        <p>
          این قرارداد میان <strong>{company?.name}</strong> (پیمانکار) و <strong>{org?.name}</strong> (کارفرما) منعقد می‌شود.
        </p>
        <h3>ماده ۲ — موضوع</h3>
        <p>
          تأمین نیروی انسانی برای پروژه «{project?.name}» با کد <bdi dir="ltr">{project?.code}</bdi> مطابق پیوست شرح خدمات و جدول نیروی موردنیاز.
        </p>
        <h3>ماده ۳ — مدت</h3>
        <p>
          از {formatDate(c.startDate, 'long')} تا {formatDate(c.endDate, 'long')}.
        </p>
        <h3>ماده ۴ — مبلغ قرارداد</h3>
        <p>مبلغ کل قرارداد {formatRial(c.value)} است که به‌صورت ماهانه و پس از تأیید کارکرد پرداخت می‌شود.</p>
        <h3>ماده ۵ — تعهدات</h3>
        <p>پیمانکار مسئول پرداخت حقوق، بیمه و مزایای قانونی نیروها است. کارفرما مسئول تأیید کارکرد ماهانه و فراهم کردن شرایط ایمن کار است.</p>
      </article>
    )
  }
  return (
    <article className="contract-prose text-[15px] leading-8 text-ink-800">
      <h2 className="text-center text-lg font-extrabold">قرارداد کار موقت ماهانه</h2>
      <p className="text-center text-xs text-ink-500">
        شماره <bdi dir="ltr">{c.number}</bdi>، دوره {c.periodYear ? formatPeriod(c.periodYear, c.periodMonth!) : ''}، نسخه {toFaDigits(c.version)}
      </p>
      <h3>ماده ۱ — مشخصات طرفین</h3>
      <p>
        <strong>کارفرما:</strong> {company?.name}، به شماره ثبت {company?.registrationNo}، به نمایندگی مدیرعامل.
        <br />
        <strong>کارگر:</strong> {employee ? `${employee.firstName} ${employee.lastName}` : c.parties.find((p) => p.role === 'worker')?.name}، کد ملی{' '}
        <bdi dir="ltr">{employee ? `${employee.nationalId.slice(0, 3)}•••${employee.nationalId.slice(-2)}` : '—'}</bdi>، شماره پرسنلی <bdi dir="ltr">{employee?.personnelNo}</bdi>.
      </p>
      <h3>ماده ۲ — عنوان شغلی و محل خدمت</h3>
      <p>
        کارگر در سمت <strong>{c.jobTitle}</strong> در <strong>{c.workplace}</strong> متعلق به {org?.name}، در قالب پروژه «{project?.name}» به کار گمارده می‌شود.
      </p>
      <h3>ماده ۳ — مدت قرارداد</h3>
      <p>
        از {formatDate(c.startDate, 'long')} تا {formatDate(c.endDate, 'long')}.
      </p>
      <h3>ماده ۴ — حقوق و مزایا</h3>
      <div className="my-2 overflow-hidden rounded-lg border border-ink-200">
        <table className="w-full text-sm">
          <tbody>
            {c.salary?.map((s) => (
              <tr key={s.label} className="border-b border-ink-100 last:border-0">
                <td className="px-3 py-2 text-ink-700">{s.label}</td>
                <td className="px-3 py-2 text-end font-medium tabular">{formatRial(s.amount)}</td>
              </tr>
            ))}
            <tr className="bg-ink-50">
              <td className="px-3 py-2 font-bold">جمع حقوق و مزایای ثابت ماهانه</td>
              <td className="px-3 py-2 text-end font-bold tabular">{formatRial(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>اضافه‌کاری، نوبت‌کاری و سایر مزایای متغیر بر اساس کارکرد تأییدشده و مطابق قانون کار محاسبه و پرداخت می‌شود.</p>
      <h3>ماده ۵ — ساعات کار و شیفت</h3>
      <p>
        {c.workHours}
        {employee ? `؛ شیفت ثبت‌شده: ${SHIFT_LABEL[employee.shift] ?? employee.shift}` : ''}.
      </p>
      <h3>ماده ۶ — تعهدات طرفین</h3>
      <p>کارگر متعهد است دستورالعمل‌های ایمنی و انضباطی محل خدمت را رعایت کند و اطلاعات محرمانه را حفظ نماید. کارفرما متعهد به پرداخت به‌موقع حقوق، بیمه تأمین اجتماعی و سایر مزایای قانونی است.</p>
      <h3>ماده ۷ — مرخصی و مزایا</h3>
      <p>مرخصی استحقاقی، استعلاجی و سایر مرخصی‌ها مطابق قانون کار و آیین‌نامه‌های مربوط است و از طریق مرکز درخواست‌های سامانه ثبت می‌شود.</p>
      <h3>ماده ۸ — سایر شرایط</h3>
      <p>این قرارداد در {toFaDigits(8)} ماده و یک نسخه الکترونیکی تنظیم شده است. نسخه امضاشده قابل تغییر نیست و هرگونه تغییر فقط از طریق صدور نسخه جدید امکان‌پذیر است.</p>
    </article>
  )
}

/** Signature status per party. The employee's signature is shown separately from the others. */
export function SignaturePanel({ c, highlightRole }: { c: Contract; highlightRole?: 'worker' | 'company' | 'org' }) {
  return (
    <ul className="space-y-2.5">
      {c.parties.map((p) => {
        const awaiting = !p.signedAt && ['awaiting_worker', 'awaiting_other', 'partially_signed'].includes(c.stage)
        return (
          <li key={p.role} className={cn('flex items-start gap-3 rounded-lg border p-3', highlightRole === p.role ? 'border-brand-200 bg-brand-50/40' : 'border-ink-200')}>
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', p.signedAt ? 'bg-emerald-50 text-emerald-600' : awaiting ? 'bg-amber-50 text-amber-600' : 'bg-ink-100 text-ink-400')}>
              {p.signedAt ? <CircleCheck size={17} /> : awaiting ? <Hourglass size={17} /> : <CircleDashed size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-2xs text-ink-500">{p.role === 'worker' ? 'نیروی کار' : p.role === 'company' ? 'شرکت تأمین نیرو' : 'سازمان کارفرما'}</p>
              <p className="truncate text-sm font-semibold text-ink-900">
                {p.name}
                {highlightRole === p.role ? <span className="ms-1 text-xs font-normal text-brand-700">(شما)</span> : null}
              </p>
              <p className={cn('mt-0.5 text-xs', p.signedAt ? 'text-emerald-700' : awaiting ? 'text-amber-700' : 'text-ink-500')}>
                {p.signedAt ? `امضا شد — ${formatDate(p.signedAt, 'datetime')}` : awaiting ? 'در انتظار امضا' : 'هنوز برای امضا ارسال نشده'}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Print-friendly short hash of the signed version */
export function versionLabel(c: Contract) {
  return `${c.versionHash.slice(0, 4)}-${c.versionHash.slice(4, 8)}-${c.versionHash.slice(8, 12)}`.toUpperCase()
}
