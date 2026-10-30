import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowRight, BadgeCheck, Building2, Briefcase, KeyRound, LockKeyhole, MessageSquareText, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { Button, Callout, Field, Input, OtpInput, PasswordInput, Tabs, useToast } from '@/components/ui'
import { BrandMark } from '@/components/shell/AppShell'
import { DEMO_OTP, DEMO_PASSWORD, HOME_BY_ROLE, demoAccounts, useAuth, type AuthSession } from '@/auth/auth'
import { useDB, useDemo } from '@/mock/store'
import { SUBROLES } from '@/config/permissions'
import { formatMobile, toEnDigits, toFaDigits } from '@/lib/format'
import { checkPassword, isValidMobile } from '@/lib/validation'
import { sleep } from '@/lib/cn'
import { cn } from '@/lib/cn'

export function AuthLayout({ children, title, subtitle, back }: { children: ReactNode; title: string; subtitle?: string; back?: { to: string; label: string } }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="relative flex items-center gap-3 text-white">
          <BrandMark size={40} />
          <div>
            <p className="text-lg font-extrabold">سامانه یکپارچه نیرو</p>
            <p className="text-xs text-brand-200">مدیریت و تأمین نیروی انسانی</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-[1.5] text-white">امور پرسنلی، قراردادها و درخواست‌ها؛ در یک پنل امن و یکپارچه.</h2>
          <ul className="mt-8 space-y-4 text-sm text-brand-100">
            {[
              { icon: UserRound, t: 'نیروی کار', d: 'ثبت درخواست، امضای قرارداد ماهانه، فیش حقوقی و مدارک' },
              { icon: Building2, t: 'سازمان محل خدمت', d: 'بررسی مدارک، تصمیم درباره درخواست‌ها و پایش قراردادها' },
              { icon: Briefcase, t: 'شرکت تأمین نیرو', d: 'پروژه‌ها، نیروها، وظایف و مهلت‌های اجرایی' },
            ].map((x) => (
              <li key={x.t} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-accent-300">
                  <x.icon size={18} aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-white">{x.t}</span>
                  {x.d}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-brand-300">
          <ShieldCheck size={14} aria-hidden /> ارتباط رمزنگاری‌شده، دسترسی بر اساس نقش، ثبت سوابق ممیزی
        </p>
      </aside>
      <main className="flex flex-col bg-white px-5 py-8 sm:px-10">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <BrandMark size={36} />
          <span className="text-base font-extrabold">سامانه یکپارچه نیرو</span>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          {back ? (
            <Link to={back.to} className="mb-6 inline-flex w-fit items-center gap-1 text-sm text-ink-600 hover:text-brand-700">
              <ArrowRight size={16} aria-hidden /> {back.label}
            </Link>
          ) : null}
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm leading-6 text-ink-600">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-8 text-center text-xs text-ink-500">
          <Link to="/status" className="hover:text-brand-700 hover:underline">
            وضعیت سامانه
          </Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="hover:text-brand-700 hover:underline">
            قوانین و حریم خصوصی
          </Link>
        </p>
      </main>
    </div>
  )
}

/** Generic message: never reveals whether an account exists */
const GENERIC_LOGIN_ERROR = 'شماره موبایل یا رمز عبور صحیح نیست.'

export function LoginPage() {
  const db = useDB()
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { demo } = useDemo()
  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ mobile?: string; password?: string; form?: string }>({})
  const [loading, setLoading] = useState(false)
  const accounts = demoAccounts(db)
  const from = (location.state as { from?: string } | null)?.from

  if (session) return <Navigate to={HOME_BY_ROLE[session.role]} replace />

  const finish = (s: Omit<AuthSession, 'startedAt'>) => {
    login({ ...s, startedAt: new Date().toISOString() })
    const home = HOME_BY_ROLE[s.role]
    navigate(from && from.startsWith(home) ? from : home, { replace: true })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const m = toEnDigits(mobile.trim())
    const next: typeof errors = {}
    if (!isValidMobile(m)) next.mobile = 'شماره موبایل را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.'
    if (mode === 'password' && !password) next.password = 'رمز عبور را وارد کنید.'
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    await sleep(demo.slow ? 1500 : 500)
    if (demo.failNetwork) {
      setLoading(false)
      setErrors({ form: 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.' })
      return
    }
    if (mode === 'otp') {
      setLoading(false)
      navigate('/login/otp', { state: { mobile: m, from } })
      return
    }
    const acc = accounts.find((a) => a.mobile === m)
    setLoading(false)
    if (!acc || password !== DEMO_PASSWORD) {
      setErrors({ form: GENERIC_LOGIN_ERROR })
      return
    }
    finish(acc.session)
  }

  return (
    <AuthLayout title="ورود به سامانه" subtitle="با شماره موبایل ثبت‌شده در پرونده خود وارد شوید.">
      <Tabs
        variant="pills"
        value={mode}
        onChange={(v) => {
          setMode(v as 'password' | 'otp')
          setErrors({})
        }}
        tabs={[
          { id: 'password', label: 'رمز عبور', icon: KeyRound },
          { id: 'otp', label: 'کد پیامکی', icon: MessageSquareText },
        ]}
        className="mb-5"
      />
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors.form ? <Callout tone="danger">{errors.form}</Callout> : null}
        <Field label="شماره موبایل" required error={errors.mobile}>
          {(p) => (
            <Input
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              ltr
              inputMode="tel"
              autoComplete="tel"
              placeholder="09xxxxxxxxx"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              prefix={<Smartphone size={16} />}
              maxLength={11}
            />
          )}
        </Field>
        {mode === 'password' ? (
          <Field
            label="رمز عبور"
            required
            error={errors.password}
            labelAction={
              <Link to="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
                فراموشی رمز عبور
              </Link>
            }
          >
            {(p) => <PasswordInput id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        ) : (
          <p className="text-xs leading-6 text-ink-500">کد یک‌بارمصرف به شماره موبایل ثبت‌شده ارسال می‌شود و فقط برای مدت محدودی معتبر است.</p>
        )}
        <Button type="submit" size="lg" block loading={loading}>
          {mode === 'password' ? 'ورود' : 'دریافت کد تأیید'}
        </Button>
      </form>

      <details className="group mt-8 rounded-xl border border-ink-200 bg-ink-25 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink-800">
          ورود سریع با حساب‌های نمایشی
          <span className="text-xs font-normal text-ink-500 group-open:hidden">نمایش</span>
        </summary>
        <p className="mt-2 text-xs leading-5 text-ink-500">
          رمز همه حساب‌ها <bdi dir="ltr" className="font-mono font-semibold text-ink-700">{DEMO_PASSWORD}</bdi> و کد پیامکی <bdi dir="ltr" className="font-mono font-semibold text-ink-700">{DEMO_OTP}</bdi> است.
        </p>
        <ul className="mt-3 space-y-1.5">
          {accounts.map((a) => (
            <li key={a.session.subRole}>
              <button
                type="button"
                onClick={() => finish(a.session)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-white px-3 py-2 text-start shadow-xs ring-1 ring-ink-200 hover:ring-brand-300"
              >
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', a.session.role === 'employee' ? 'bg-accent-50 text-accent-700' : a.session.role === 'org' ? 'bg-sky-50 text-sky-700' : a.session.role === 'company' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-700')}>
                  {a.session.role === 'employee' ? <UserRound size={16} /> : a.session.role === 'org' ? <Building2 size={16} /> : a.session.role === 'company' ? <Briefcase size={16} /> : <LockKeyhole size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{SUBROLES[a.session.subRole].label}</span>
                  <span className="block truncate text-2xs text-ink-500">
                    {a.session.name}، {a.org}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </AuthLayout>
  )
}

/** Countdown helper for code expiry / resend cooldown */
function useCountdown(seconds: number, key: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const iv = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(iv)
  }, [seconds, key])
  return left
}

export const mmss = (s: number) => toFaDigits(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)

export function OtpPage() {
  const db = useDB()
  const { login, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { mobile?: string; from?: string; purpose?: 'reset' } | null
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [sendKey, setSendKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const ttl = db.settings.signatureOtpTtlSec
  const max = db.settings.otpMaxAttempts
  const expiry = useCountdown(ttl, sendKey)
  const cooldown = useCountdown(db.settings.otpResendCooldownSec, sendKey)
  const [resends, setResends] = useState(0)

  if (session) return <Navigate to={HOME_BY_ROLE[session.role]} replace />
  if (!state?.mobile) return <Navigate to="/login" replace />
  const locked = attempts >= max

  const verify = async () => {
    if (code.length < 5) {
      setError('کد ۵ رقمی را کامل وارد کنید.')
      return
    }
    if (expiry === 0) {
      setError('مهلت استفاده از کد پایان یافته است. کد جدید دریافت کنید.')
      return
    }
    setLoading(true)
    await sleep(500)
    setLoading(false)
    if (code !== DEMO_OTP) {
      const n = attempts + 1
      setAttempts(n)
      setCode('')
      setError(n >= max ? 'تعداد تلاش‌های مجاز به پایان رسید. چند دقیقه دیگر دوباره تلاش کنید.' : `کد واردشده صحیح نیست. ${toFaDigits(max - n)} تلاش دیگر باقی مانده است.`)
      return
    }
    if (state.purpose === 'reset') {
      navigate('/forgot-password', { state: { mobile: state.mobile, verified: true }, replace: true })
      return
    }
    const acc = demoAccounts(db).find((a) => a.mobile === state.mobile)
    if (!acc) {
      // Same message as a wrong code: do not disclose account existence
      setError('کد واردشده صحیح نیست.')
      return
    }
    login({ ...acc.session, startedAt: new Date().toISOString() })
    navigate(HOME_BY_ROLE[acc.session.role], { replace: true })
  }

  return (
    <AuthLayout title="تأیید شماره موبایل" subtitle={`اگر این شماره در سامانه ثبت شده باشد، کد ۵ رقمی به آن ارسال شده است.`} back={{ to: state.purpose === 'reset' ? '/forgot-password' : '/login', label: 'تغییر شماره' }}>
      <p className="mb-5 text-center text-sm text-ink-700">
        <bdi dir="ltr" className="font-mono font-semibold">
          {formatMobile(state.mobile)}
        </bdi>
      </p>
      <OtpInput value={code} onChange={(v) => { setCode(v); setError('') }} invalid={Boolean(error)} disabled={locked} autoFocus />
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-center text-xs text-ink-500" aria-live="polite">
        {expiry > 0 ? (
          <>
            اعتبار کد: <span className="font-semibold tabular text-ink-700">{mmss(expiry)}</span>
          </>
        ) : (
          <span className="text-red-700">کد منقضی شده است.</span>
        )}
      </p>
      <Button size="lg" block className="mt-5" onClick={verify} loading={loading} disabled={locked}>
        تأیید و ادامه
      </Button>
      <div className="mt-4 text-center">
        <Button
          variant="link"
          size="sm"
          disabled={cooldown > 0 || resends >= 3}
          onClick={() => {
            setSendKey((k) => k + 1)
            setResends((r) => r + 1)
            setAttempts(0)
            setCode('')
            setError('')
            toast.info('کد جدید ارسال شد')
          }}
        >
          {resends >= 3 ? 'سقف ارسال مجدد کد امروز تکمیل شده است' : cooldown > 0 ? `ارسال مجدد کد تا ${mmss(cooldown)} دیگر` : 'ارسال مجدد کد'}
        </Button>
      </div>
      <p className="mt-6 rounded-lg bg-ink-50 p-3 text-center text-xs text-ink-500">
        محیط نمایشی: کد <bdi dir="ltr" className="font-mono font-semibold">{DEMO_OTP}</bdi> است.
      </p>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { mobile?: string; verified?: boolean } | null
  const toast = useToast()
  const [mobile, setMobile] = useState(state?.mobile ?? '')
  const [nationalId, setNationalId] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const checks = checkPassword(pw)

  if (state?.verified) {
    return (
      <AuthLayout title="تعیین رمز عبور جدید" subtitle="هویت شما تأیید شد. رمز جدیدی انتخاب کنید.">
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const next: Record<string, string> = {}
            if (!checks.every((c) => c.ok)) next.pw = 'رمز عبور با سیاست امنیتی سامانه مطابقت ندارد.'
            if (pw !== pw2) next.pw2 = 'تکرار رمز با رمز جدید یکسان نیست.'
            setErrors(next)
            if (Object.keys(next).length) return
            setLoading(true)
            await sleep(600)
            setLoading(false)
            toast.success('رمز عبور تغییر کرد', 'با رمز جدید وارد شوید. نشست‌های فعال دیگر بسته شدند.')
            navigate('/login', { replace: true })
          }}
        >
          <Field label="رمز عبور جدید" required error={errors.pw}>
            {(p) => <PasswordInput id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
          </Field>
          <PasswordRules checks={checks} />
          <Field label="تکرار رمز عبور جدید" required error={errors.pw2}>
            {(p) => <PasswordInput id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
          </Field>
          <Button type="submit" size="lg" block loading={loading}>
            ثبت رمز جدید
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="بازیابی رمز عبور" subtitle="برای حفظ امنیت پرونده، هویت شما با کد ملی و کد پیامکی تأیید می‌شود." back={{ to: '/login', label: 'بازگشت به ورود' }}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const next: Record<string, string> = {}
          if (!isValidMobile(mobile)) next.mobile = 'شماره موبایل را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.'
          if (!/^\d{10}$/.test(toEnDigits(nationalId))) next.nationalId = 'کد ملی ۱۰ رقمی را وارد کنید.'
          setErrors(next)
          if (Object.keys(next).length) return
          setLoading(true)
          await sleep(700)
          setLoading(false)
          navigate('/login/otp', { state: { mobile: toEnDigits(mobile), purpose: 'reset' } })
        }}
      >
        <Field label="شماره موبایل" required error={errors.mobile}>
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} ltr inputMode="tel" placeholder="09xxxxxxxxx" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={11} />}
        </Field>
        <Field label="کد ملی" required error={errors.nationalId} helper="کد ملی با اطلاعات سامانه ثبت احوال / تأمین اجتماعی تطبیق داده می‌شود.">
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} ltr inputMode="numeric" value={nationalId} onChange={(e) => setNationalId(e.target.value)} maxLength={10} />}
        </Field>
        <Callout tone="neutral" icon={BadgeCheck}>
          در صورت تطابق اطلاعات، کد تأیید به شماره ثبت‌شده ارسال می‌شود. برای حفظ حریم خصوصی، نتیجه تطبیق نمایش داده نمی‌شود.
        </Callout>
        <Button type="submit" size="lg" block loading={loading}>
          ادامه و دریافت کد
        </Button>
      </form>
    </AuthLayout>
  )
}

export function PasswordRules({ checks }: { checks: ReturnType<typeof checkPassword> }) {
  return (
    <ul className="grid grid-cols-2 gap-1.5 text-xs" aria-label="شرایط رمز عبور">
      {checks.map((c) => (
        <li key={c.id} className={cn('flex items-center gap-1.5', c.ok ? 'text-emerald-700' : 'text-ink-500')}>
          <span className={cn('grid size-4 place-items-center rounded-full text-[10px]', c.ok ? 'bg-emerald-100' : 'bg-ink-100')} aria-hidden>
            {c.ok ? '✓' : '•'}
          </span>
          {c.label}
          <span className="sr-only">{c.ok ? '(رعایت شده)' : '(رعایت نشده)'}</span>
        </li>
      ))}
    </ul>
  )
}
