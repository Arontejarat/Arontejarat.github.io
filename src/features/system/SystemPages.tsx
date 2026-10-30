import type { ReactNode } from 'react'
import { Link, isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { CircleCheck, Clock, CloudOff, FileQuestion, Lock, RefreshCw, Server, ShieldCheck, TimerOff, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Badge, Button, ButtonLink, Card } from '@/components/ui'
import { BrandMark } from '@/components/shell/AppShell'
import { HOME_BY_ROLE, useAuth } from '@/auth/auth'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useDB } from '@/mock/store'

function Centered({ icon: Icon, tone = 'brand', title, description, children, code }: { icon: LucideIcon; tone?: 'brand' | 'danger' | 'warning' | 'success'; title: string; description: ReactNode; children?: ReactNode; code?: string }) {
  const toneCls = { brand: 'bg-brand-50 text-brand-700', danger: 'bg-red-50 text-red-600', warning: 'bg-amber-50 text-amber-600', success: 'bg-emerald-50 text-emerald-600' }[tone]
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 py-12">
      <div className="max-w-md text-center">
        <span className={cn('mx-auto grid size-16 place-items-center rounded-2xl', toneCls)}>
          <Icon size={30} aria-hidden />
        </span>
        {code ? <p className="mt-5 text-sm font-semibold tabular text-ink-400">{code}</p> : null}
        <h1 className="mt-2 text-2xl font-extrabold">{title}</h1>
        <div className="mt-2 text-sm leading-7 text-ink-600">{description}</div>
        {children ? <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div> : null}
      </div>
    </div>
  )
}

function useHome() {
  const { session } = useAuth()
  return session ? HOME_BY_ROLE[session.role] : '/login'
}

export function NotFoundPage() {
  const home = useHome()
  return (
    <Centered icon={FileQuestion} code="۴۰۴" title="صفحه موردنظر پیدا نشد" description="ممکن است نشانی را اشتباه وارد کرده باشید یا این صفحه جابه‌جا شده باشد.">
      <ButtonLink to={home}>بازگشت به داشبورد</ButtonLink>
    </Centered>
  )
}

export function ForbiddenPage() {
  const home = useHome()
  return (
    <Centered
      icon={Lock}
      tone="warning"
      code="۴۰۳"
      title="دسترسی به این بخش مجاز نیست"
      description="این بخش برای نقش کاربری شما تعریف نشده است. اگر فکر می‌کنید باید به آن دسترسی داشته باشید، با مدیر مجموعه خود تماس بگیرید."
    >
      <ButtonLink to={home}>بازگشت به پنل خودم</ButtonLink>
    </Centered>
  )
}

export function SessionExpiredPage() {
  const { clearExpired } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-ink-50">
      <Centered
        icon={TimerOff}
        tone="warning"
        title="نشست شما به پایان رسید"
        description="به‌دلیل عدم فعالیت، برای حفظ امنیت اطلاعات از حساب خارج شدید. اطلاعات ذخیره‌نشده فرم‌ها ممکن است از بین رفته باشد؛ پیش‌نویس‌های ذخیره‌شده در دسترس هستند."
      >
        <Button
          onClick={() => {
            clearExpired()
            navigate('/login', { replace: true })
          }}
        >
          ورود دوباره
        </Button>
      </Centered>
    </div>
  )
}

export function RouteErrorPage() {
  const error = useRouteError()
  const home = useHome()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  if (notFound) return <NotFoundPage />
  return (
    <div className="min-h-dvh bg-ink-50">
      <Centered icon={TriangleAlert} tone="danger" title="خطای غیرمنتظره رخ داد" description="مشکلی در نمایش این صفحه پیش آمد. اطلاعات شما حفظ شده است؛ صفحه را دوباره بارگذاری کنید یا به داشبورد بازگردید.">
        <Button icon={RefreshCw} onClick={() => window.location.reload()}>
          بارگذاری دوباره
        </Button>
        <ButtonLink to={home} variant="outline">
          بازگشت به داشبورد
        </ButtonLink>
      </Centered>
    </div>
  )
}

/** Shared "operation result" layout (SYS-01 / REQ-07 / DOC receipts / CTR-04) */
export function OperationResult({
  tone = 'success',
  title,
  description,
  details,
  actions,
  icon,
}: {
  tone?: 'success' | 'warning' | 'neutral'
  title: string
  description?: ReactNode
  details?: { label: string; value: ReactNode }[]
  actions?: ReactNode
  icon?: LucideIcon
}) {
  const Icon = icon ?? (tone === 'success' ? CircleCheck : tone === 'warning' ? TriangleAlert : Clock)
  return (
    <div className="mx-auto max-w-lg py-4 sm:py-8">
      <Card className="print-area text-center">
        <span className={cn('mx-auto grid size-16 place-items-center rounded-full', tone === 'success' ? 'bg-emerald-50 text-emerald-600' : tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-ink-100 text-ink-600')}>
          <Icon size={32} aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-extrabold" tabIndex={-1} autoFocus>
          {title}
        </h1>
        {description ? <div className="mt-2 text-sm leading-7 text-ink-600">{description}</div> : null}
        {details ? (
          <dl className="mt-5 divide-y divide-ink-100 rounded-lg border border-ink-200 text-start">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-xs text-ink-500">{d.label}</dt>
                <dd className="text-sm font-semibold text-ink-900">{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {actions ? <div className="no-print mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div> : null}
      </Card>
    </div>
  )
}

export function SystemStatusPage() {
  const db = useDB()
  const services = [
    { name: 'ورود و احراز هویت', status: 'ok' },
    { name: 'ثبت و پیگیری درخواست‌ها', status: 'ok' },
    { name: 'ارسال پیامک (کد تأیید و اعلان)', status: 'degraded', note: 'تحویل پیامک با تأخیر حدود ۴۵ ثانیه انجام می‌شود.' },
    { name: 'فیش حقوقی و اسناد', status: 'ok' },
    { name: 'بارگذاری فایل', status: 'ok' },
  ] as const
  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <BrandMark />
          <span className="font-extrabold">سامانه یکپارچه نیرو</span>
        </Link>
        <h1 className="text-2xl font-extrabold">وضعیت سامانه</h1>
        <p className="mt-1 text-sm text-ink-600">آخرین به‌روزرسانی: {formatDate(new Date(), 'datetime')}</p>
        {db.settings.maintenanceBanner ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{db.settings.maintenanceBanner}</div>
        ) : null}
        <Card className="mt-6" padded={false}>
          <ul className="divide-y divide-ink-100">
            {services.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="flex items-start gap-3">
                  {s.status === 'ok' ? <Server size={18} className="mt-0.5 text-ink-400" /> : <CloudOff size={18} className="mt-0.5 text-amber-600" />}
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    {'note' in s ? <p className="mt-0.5 text-xs text-ink-600">{s.note}</p> : null}
                  </div>
                </div>
                {s.status === 'ok' ? (
                  <Badge tone="success" icon={CircleCheck}>
                    عادی
                  </Badge>
                ) : (
                  <Badge tone="warning" icon={TriangleAlert}>
                    اختلال جزئی
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-4 text-xs text-ink-500">در صورت بروز اختلال، اعلان داخل سامانه مرجع اصلی اطلاع‌رسانی است.</p>
      </div>
    </div>
  )
}

export function PrivacyContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-ink-700">
      {[
        { t: 'چه اطلاعاتی نگهداری می‌شود', d: 'اطلاعات هویتی، شغلی، قراردادی، حقوق و دستمزد، بانکی و مدارک پرسنلی شما تنها به اندازه‌ای که برای انجام امور پرسنلی لازم است نگهداری می‌شود.' },
        { t: 'چه کسانی به اطلاعات دسترسی دارند', d: 'شما فقط پرونده خودتان را می‌بینید. کارشناسان شرکت تأمین نیرو و سازمان محل خدمت فقط در محدوده مسئولیت خود و بر اساس نقش تعریف‌شده دسترسی دارند. دسترسی به مدارک پزشکی، هویتی و بانکی به مسئولان مجاز محدود است.' },
        { t: 'حفاظت از اطلاعات', d: 'اطلاعات در زمان انتقال و نگهداری رمزنگاری می‌شود. فایل‌ها فقط از طریق دسترسی کنترل‌شده ارائه می‌شوند و از نظر بدافزار بررسی می‌شوند. کنترل دسترسی در سمت سرور اجرا می‌شود.' },
        { t: 'ثبت سوابق', d: 'عملیات حساس مانند امضای قرارداد، تغییر اطلاعات بانکی و تصمیم درباره درخواست‌ها همراه با زمان، انجام‌دهنده و نتیجه ثبت می‌شود و این سوابق در برابر تغییر غیرمجاز محافظت می‌شوند.' },
        { t: 'مدت نگهداری', d: 'مدت نگهداری اسناد و نحوه حذف آن‌ها مطابق ضوابط مصوب سازمان و قوانین کار و تأمین اجتماعی تعیین می‌شود.' },
        { t: 'امضای الکترونیکی', d: 'تأیید قرارداد با کد پیامکی، رضایت و احراز هویت شما را ثبت می‌کند. اعتبار حقوقی امضا بر اساس روش امضای مصوب و قوانین قابل اعمال تعیین می‌شود و کد پیامکی به‌تنهایی در همه شرایط جایگزین امضای الکترونیکی معتبر نیست.' },
      ].map((x) => (
        <section key={x.t}>
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-ink-900">
            <ShieldCheck size={17} className="text-accent-600" aria-hidden /> {x.t}
          </h2>
          <p>{x.d}</p>
        </section>
      ))}
    </div>
  )
}

export function PublicPrivacyPage() {
  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/login" className="mb-8 flex items-center gap-2.5">
          <BrandMark />
          <span className="font-extrabold">سامانه یکپارچه نیرو</span>
        </Link>
        <h1 className="mb-6 text-2xl font-extrabold">قوانین و حریم خصوصی</h1>
        <Card>
          <PrivacyContent />
        </Card>
      </div>
    </div>
  )
}
