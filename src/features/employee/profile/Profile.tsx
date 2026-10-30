import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { Activity, BadgeCheck, Briefcase, Building2, ChevronLeft, Eye, EyeOff, History, KeyRound, LogOut, Mail, MapPin, Monitor, Pencil, Phone, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  Input,
  Ltr,
  NavTabs,
  OtpInput,
  PageHeader,
  PasswordInput,
  StatusBadge,
  Switch,
  Timeline,
  useToast,
} from '@/components/ui'
import { DEMO_OTP, DEMO_PASSWORD, useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, fullName, orgById, projectById } from '@/mock/selectors'
import { EMPLOYMENT_STATUS } from '@/config/status'
import { MARITAL_LABEL, SHIFT_LABEL } from '@/config/requestTypes'
import { displayId, formatDate, formatMobile, formatRelative, mask, maskSheba, toEnDigits } from '@/lib/format'
import { checkPassword, isValidMobile } from '@/lib/validation'
import { sleep } from '@/lib/cn'
import { PasswordRules } from '@/features/auth/AuthPages'

export function ProfileLayout() {
  return (
    <>
      <PageHeader title="پروفایل" description="اطلاعات فردی، شغلی و تنظیمات امنیتی حساب شما." breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'پروفایل' }]} />
      <NavTabs
        className="mb-5"
        tabs={[
          { to: '/me/profile', label: 'خلاصه', end: true },
          { to: '/me/profile/personal', label: 'اطلاعات فردی' },
          { to: '/me/profile/job', label: 'شغل و محل خدمت' },
          { to: '/me/profile/contact', label: 'اطلاعات تماس' },
          { to: '/me/profile/password', label: 'تغییر رمز' },
          { to: '/me/profile/security', label: 'امنیت حساب' },
          { to: '/me/profile/activity', label: 'سوابق فعالیت' },
        ]}
      />
      <Outlet />
    </>
  )
}

function OfficialBadge() {
  return (
    <Badge size="sm" tone="success" icon={BadgeCheck}>
      تأییدشده در پرونده
    </Badge>
  )
}

/* ---------------- PROF-01 ---------------- */
export function ProfileHome() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const lastLogin = db.sessions.find((s) => s.current)
  const links = [
    { to: '/me/profile/personal', icon: UserRound, t: 'اطلاعات فردی', d: 'مشخصات هویتی، خانوادگی و نشانی' },
    { to: '/me/profile/job', icon: Briefcase, t: 'اطلاعات شغلی و محل خدمت', d: 'شغل، شرکت تأمین نیرو و سازمان محل خدمت' },
    { to: '/me/profile/contact', icon: Phone, t: 'اطلاعات تماس', d: 'شماره موبایل، نشانی و روش دریافت اعلان' },
    { to: '/me/profile/password', icon: KeyRound, t: 'تغییر رمز عبور', d: 'تعیین رمز جدید طبق سیاست امنیتی' },
    { to: '/me/profile/security', icon: ShieldCheck, t: 'امنیت حساب و نشست‌ها', d: 'دستگاه‌های فعال و احراز هویت پیامکی' },
    { to: '/me/profile/activity', icon: History, t: 'سوابق فعالیت', d: 'عملیات مهم انجام‌شده در حساب شما' },
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="text-center">
        <Avatar name={fullName(emp)} color={emp.photoColor} size={84} className="mx-auto" />
        <h2 className="mt-3 text-lg font-extrabold">{fullName(emp)}</h2>
        <p className="text-sm text-ink-600">{emp.jobTitle}</p>
        <div className="mt-2 flex justify-center">
          <StatusBadge meta={EMPLOYMENT_STATUS[emp.employmentStatus]} />
        </div>
        <dl className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-start text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">شماره پرسنلی</dt>
            <dd>
              <Ltr className="font-semibold">{emp.personnelNo}</Ltr>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">آخرین ورود</dt>
            <dd className="font-medium">{lastLogin ? formatRelative(lastLogin.lastActive) : '—'}</dd>
          </div>
        </dl>
      </Card>
      <Card padded={false}>
        <ul className="divide-y divide-ink-100">
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-25">
                <span className="grid size-10 place-items-center rounded-lg bg-ink-100 text-ink-600">
                  <l.icon size={18} aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{l.t}</span>
                  <span className="block text-xs text-ink-500">{l.d}</span>
                </span>
                <ChevronLeft size={16} className="text-ink-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------------- PROF-02 ---------------- */
export function ProfilePersonal() {
  const emp = useCurrentEmployee()
  const [reveal, setReveal] = useState(false)
  return (
    <div className="space-y-5">
      <Callout tone="info" title="اطلاعات رسمی مستقیماً قابل ویرایش نیست">
        این اطلاعات پس از تأیید مرجع مجاز در پرونده ثبت شده است. برای اصلاح هر مورد، از دکمه «درخواست اصلاح» استفاده کنید تا درخواست از طریق مرکز درخواست‌ها بررسی شود.
      </Callout>
      <Card>
        <CardHeader title="مشخصات هویتی" action={<ButtonLink to="/me/requests/new?type=identity_fix" variant="outline" size="sm" icon={Pencil}>درخواست اصلاح اطلاعات</ButtonLink>} />
        <DescriptionList
          items={[
            { label: 'نام و نام خانوادگی', value: <span className="flex items-center gap-2">{fullName(emp)} <OfficialBadge /></span> },
            {
              label: 'کد ملی',
              value: (
                <span className="flex items-center gap-1.5">
                  <Ltr>{reveal ? emp.nationalId : mask(emp.nationalId, 3)}</Ltr>
                  <button type="button" onClick={() => setReveal((r) => !r)} className="grid size-7 place-items-center rounded text-ink-500 hover:bg-ink-100" aria-label={reveal ? 'پنهان کردن کد ملی' : 'نمایش کد ملی'} aria-pressed={reveal}>
                    {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
              ),
            },
            { label: 'تاریخ تولد', value: formatDate(emp.birthDate, 'long') },
            { label: 'شماره موبایل', value: <Ltr>{formatMobile(emp.mobile)}</Ltr> },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="اطلاعات خانوادگی" action={<ButtonLink to="/me/requests/new?type=marital_change" variant="outline" size="sm" icon={Pencil}>تغییر وضعیت تأهل</ButtonLink>} />
        <DescriptionList items={[{ label: 'وضعیت تأهل', value: MARITAL_LABEL[emp.maritalStatus] }, { label: 'تعداد فرزندان', value: emp.children.length ? `${emp.children.length.toLocaleString('fa-IR')} فرزند` : 'ثبت نشده' }]} />
        {emp.children.length ? (
          <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-200">
            {emp.children.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="font-medium">{c.fullName}</span>
                <span className="text-xs text-ink-500">
                  {c.relation === 'son' ? 'پسر' : 'دختر'}، متولد {formatDate(c.birthDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <ButtonLink to="/me/requests/new?type=child_info" variant="link" size="sm" className="mt-3">
          ثبت یا اصلاح اطلاعات فرزند
        </ButtonLink>
      </Card>
      <Card>
        <CardHeader title="نشانی" action={<ButtonLink to="/me/requests/new?type=identity_fix" variant="outline" size="sm" icon={Pencil}>درخواست اصلاح نشانی</ButtonLink>} />
        <DescriptionList items={[{ label: 'نشانی', value: emp.address, full: true }, { label: 'کد پستی', value: <Ltr>{emp.postalCode}</Ltr> }]} />
      </Card>
      <Card>
        <CardHeader title="اطلاعات بانکی" action={<ButtonLink to="/me/requests/new?type=bank_change" variant="outline" size="sm" icon={Pencil}>تغییر حساب</ButtonLink>} />
        <ul className="space-y-2">
          {emp.bankAccounts.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2.5 text-sm">
              <span className="font-medium">{b.bank}</span>
              <Ltr mono className="text-ink-700">{maskSheba(b.sheba)}</Ltr>
              {b.activeForPayroll ? <Badge size="sm" tone="success">حساب واریز حقوق</Badge> : <Badge size="sm" tone="muted">غیرفعال</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------------- PROF-03 ---------------- */
export function ProfileJob() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const company = companyById(db, emp.companyId)
  const org = orgById(db, emp.orgId)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <Briefcase size={20} aria-hidden />
            </span>
            <div>
              <p className="text-xs text-ink-500">شرکت تأمین نیرو (کارفرمای قراردادی)</p>
              <p className="font-bold">{company?.name}</p>
              <p className="mt-1 text-xs text-ink-500">مسئول قرارداد، حقوق، بیمه و امور پرسنلی</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-accent-50 text-accent-700">
              <Building2 size={20} aria-hidden />
            </span>
            <div>
              <p className="text-xs text-ink-500">سازمان محل خدمت (بهره‌بردار)</p>
              <p className="font-bold">{org?.name}</p>
              <p className="mt-1 text-xs text-ink-500">محل استقرار و انجام کار روزانه</p>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="اطلاعات شغلی" action={<ButtonLink to="/me/requests/new?type=workplace_change" variant="outline" size="sm">درخواست تغییر محل یا شیفت</ButtonLink>} />
        <DescriptionList
          columns={3}
          items={[
            { label: 'شماره پرسنلی', value: <Ltr>{emp.personnelNo}</Ltr> },
            { label: 'وضعیت همکاری', value: <StatusBadge meta={EMPLOYMENT_STATUS[emp.employmentStatus]} size="sm" /> },
            { label: 'عنوان شغلی', value: emp.jobTitle },
            { label: 'واحد سازمانی', value: emp.unit },
            { label: 'محل خدمت', value: emp.workplace },
            { label: 'نشانی محل خدمت', value: emp.workplaceAddress },
            { label: 'تاریخ شروع همکاری', value: formatDate(emp.startDate, 'long') },
            { label: 'نوع قرارداد', value: emp.contractType },
            { label: 'مدت قرارداد', value: `${formatDate(emp.contractStart)} تا ${formatDate(emp.contractEnd)}` },
            { label: 'شیفت کاری', value: SHIFT_LABEL[emp.shift] ?? emp.shift },
            { label: 'مسئول مستقیم', value: emp.supervisor ?? 'نمایش داده نمی‌شود' },
            { label: 'پروژه', value: projectById(db, emp.projectId)?.name ?? '—' },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="سوابق تغییرات" description="تغییرات شغل، محل خدمت و وضعیت همکاری" icon={History} />
        {emp.changeLog.length === 0 && emp.assignments.length <= 1 ? (
          <p className="text-sm text-ink-500">تغییری ثبت نشده است.</p>
        ) : (
          <Timeline
            items={[
              ...emp.changeLog.map((c) => ({ id: c.id, icon: Pencil, tone: 'brand' as const, title: `تغییر ${c.field}`, time: formatDate(c.at), body: `${c.before || '—'} ← ${c.after}` })),
              ...emp.assignments.map((a) => ({ id: a.id, icon: MapPin, tone: 'neutral' as const, title: `استقرار در ${projectById(db, a.projectId)?.name ?? '—'}`, time: `${formatDate(a.from)}${a.to ? ` تا ${formatDate(a.to)}` : ' تاکنون'}`, body: a.note })),
            ]}
          />
        )}
      </Card>
    </div>
  )
}

/* ---------------- PROF-04 ---------------- */
export function ProfileContact() {
  const emp = useCurrentEmployee()
  const toast = useToast()
  const [prefs, setPrefs] = useState({ sms: true, email: Boolean(emp.email) })
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [pw, setPw] = useState('')
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const reset = () => {
    setOpen(false)
    setStep(1)
    setPw('')
    setMobile('')
    setCode('')
    setErr('')
  }
  const next = async () => {
    setErr('')
    if (step === 1) {
      if (pw !== DEMO_PASSWORD) return setErr('رمز عبور صحیح نیست.')
      setStep(2)
    } else if (step === 2) {
      if (!isValidMobile(mobile)) return setErr('شماره موبایل جدید معتبر نیست.')
      if (toEnDigits(mobile) === emp.mobile) return setErr('شماره جدید با شماره فعلی یکسان است.')
      setBusy(true)
      await sleep(600)
      setBusy(false)
      setStep(3)
    } else {
      if (code !== DEMO_OTP) return setErr('کد واردشده صحیح نیست.')
      setBusy(true)
      await sleep(600)
      setBusy(false)
      reset()
      toast.info('درخواست تغییر شماره ثبت شد', 'شماره جدید پس از تأیید امور پرسنلی شرکت در پرونده جایگزین می‌شود. (محیط نمایشی)')
    }
  }
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="شماره موبایل" description="برای ورود، دریافت کد تأیید و امضای قرارداد استفاده می‌شود." icon={Smartphone} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Ltr className="text-lg font-semibold">{formatMobile(emp.mobile)}</Ltr>
          <Button variant="outline" onClick={() => setOpen(true)}>
            تغییر شماره موبایل
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="نشانی و ایمیل" icon={MapPin} action={<ButtonLink to="/me/requests/new?type=identity_fix" variant="outline" size="sm">درخواست اصلاح نشانی</ButtonLink>} />
        <DescriptionList items={[{ label: 'نشانی', value: emp.address, full: true }, { label: 'کد پستی', value: <Ltr>{emp.postalCode}</Ltr> }, { label: 'ایمیل', value: emp.email ? <Ltr>{emp.email}</Ltr> : 'ثبت نشده' }]} />
      </Card>
      <Card>
        <CardHeader title="روش دریافت اعلان" description="اعلان داخل سامانه مرجع اصلی پیگیری است و همیشه فعال است." icon={Mail} />
        <div className="space-y-4">
          <Switch checked disabled onChange={() => undefined} label="اعلان داخل سامانه" description="همه رویدادها" />
          <Switch checked={prefs.sms} onChange={(v) => { setPrefs({ ...prefs, sms: v }); toast.success('تنظیمات ذخیره شد') }} label="پیامک" description="فقط برای رویدادهای مهم مانند قرارداد آماده امضا و کد تأیید" />
          <Switch checked={prefs.email} disabled={!emp.email} onChange={(v) => { setPrefs({ ...prefs, email: v }); toast.success('تنظیمات ذخیره شد') }} label="ایمیل" description={emp.email ? 'خلاصه رویدادها' : 'ابتدا ایمیل خود را ثبت کنید'} />
        </div>
      </Card>
      <Dialog
        open={open}
        onClose={reset}
        title="تغییر شماره موبایل"
        description={step === 1 ? 'برای امنیت حساب، ابتدا رمز عبور فعلی را وارد کنید.' : step === 2 ? 'شماره جدید را وارد کنید؛ کد تأیید به آن ارسال می‌شود.' : 'کد ارسال‌شده به شماره جدید را وارد کنید.'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={reset}>
              انصراف
            </Button>
            <Button onClick={next} loading={busy}>
              {step === 3 ? 'تأیید شماره جدید' : 'ادامه'}
            </Button>
          </>
        }
      >
        {step === 1 ? (
          <Field label="رمز عبور فعلی" error={err} required>
            {(p) => <PasswordInput id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} value={pw} onChange={(e) => setPw(e.target.value)} />}
          </Field>
        ) : step === 2 ? (
          <Field label="شماره موبایل جدید" error={err} required>
            {(p) => <Input id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} ltr inputMode="tel" placeholder="09xxxxxxxxx" maxLength={11} value={mobile} onChange={(e) => setMobile(e.target.value)} />}
          </Field>
        ) : (
          <div>
            <OtpInput value={code} onChange={setCode} invalid={Boolean(err)} autoFocus />
            {err ? <p role="alert" className="mt-2 text-center text-sm text-red-700">{err}</p> : null}
            <p className="mt-3 text-center text-xs text-ink-500">محیط نمایشی: کد {DEMO_OTP}</p>
          </div>
        )}
      </Dialog>
    </div>
  )
}

/* ---------------- PROF-05 ---------------- */
export function ProfilePassword() {
  const actions = useActions()
  const toast = useToast()
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [revoke, setRevoke] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const checks = checkPassword(pw)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!cur) next.cur = 'رمز فعلی را وارد کنید.'
    if (!checks.every((c) => c.ok)) next.pw = 'رمز جدید با سیاست امنیتی سامانه مطابقت ندارد.'
    else if (pw === cur) next.pw = 'رمز جدید باید با رمز فعلی متفاوت باشد.'
    if (pw2 !== pw) next.pw2 = 'تکرار رمز با رمز جدید یکسان نیست.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await actions.changePassword(cur, pw, revoke)
      toast.success('رمز عبور تغییر کرد', revoke ? 'سایر نشست‌های فعال بسته شدند.' : undefined)
      setCur('')
      setPw('')
      setPw2('')
    } catch (err) {
      toast.fromError(err)
      if (err instanceof Error && err.message.includes('رمز فعلی')) setErrors({ cur: err.message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="max-w-xl">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="رمز فعلی" required error={errors.cur} helper={`محیط نمایشی: ${DEMO_PASSWORD}`}>
          {(p) => <PasswordInput id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} value={cur} onChange={(e) => setCur(e.target.value)} />}
        </Field>
        <Field label="رمز جدید" required error={errors.pw}>
          {(p) => <PasswordInput id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        <PasswordRules checks={checks} />
        <Field label="تکرار رمز جدید" required error={errors.pw2}>
          {(p) => <PasswordInput id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
        </Field>
        <Checkbox checked={revoke} onChange={setRevoke} label="خروج از همه دستگاه‌های دیگر" description="توصیه می‌شود اگر احتمال دسترسی دیگران به حساب وجود دارد." />
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            تأیید تغییر رمز
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ---------------- PROF-06 ---------------- */
export function ProfileSecurity() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const actions = useActions()
  const toast = useToast()
  const [twoFactor, setTwoFactor] = useState(true)
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const alerts = db.notifications.filter((n) => n.audience.role === 'employee' && n.audience.id === emp.id && n.category === 'security')
  const others = db.sessions.filter((s) => !s.current)
  const current = db.sessions.find((s) => s.current)
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="نشست‌های فعال" description="دستگاه‌هایی که اکنون به حساب شما دسترسی دارند." icon={Monitor} action={others.length ? <Button variant="danger-ghost" size="sm" icon={LogOut} onClick={() => setConfirm(others.map((s) => s.id))}>خروج از همه دستگاه‌های دیگر</Button> : null} />
          <ul className="divide-y divide-ink-100">
            {db.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span className="grid size-10 place-items-center rounded-lg bg-ink-100 text-ink-600">{s.device.includes('Android') || s.device.includes('iPad') ? <Smartphone size={18} /> : <Monitor size={18} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Ltr>{s.device}</Ltr>
                    {s.current ? <Badge size="sm" tone="success">همین دستگاه</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-500">
                    {s.location}، <Ltr>{s.ip}</Ltr>، آخرین فعالیت {formatRelative(s.lastActive)}
                  </p>
                </div>
                {!s.current ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfirm([s.id])}>
                    خروج
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="هشدارهای امنیتی" icon={ShieldCheck} />
          {alerts.length === 0 ? (
            <EmptyState compact icon={ShieldCheck} title="هشدار امنیتی ثبت نشده است" />
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-lg border border-ink-200 p-3">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-600">{a.body}</p>
                  <p className="mt-1 text-2xs text-ink-400">{formatDate(a.at, 'datetime')}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <aside className="space-y-5">
        <Card>
          <CardHeader title="آخرین ورود" />
          <p className="text-sm font-semibold">{current ? formatDate(current.lastActive, 'datetime') : '—'}</p>
          <p className="text-xs text-ink-500">{current?.device}</p>
        </Card>
        <Card>
          <Switch
            checked={twoFactor}
            onChange={(v) => {
              setTwoFactor(v)
              toast.success(v ? 'احراز هویت پیامکی فعال شد' : 'احراز هویت پیامکی غیرفعال شد')
            }}
            label="ورود دومرحله‌ای با کد پیامکی"
            description="هنگام ورود از دستگاه جدید، علاوه بر رمز، کد پیامکی درخواست می‌شود."
          />
        </Card>
        <Card>
          <CardHeader title="بازیابی حساب" />
          <p className="text-xs leading-6 text-ink-600">در صورت فراموشی رمز، بازیابی با کد ملی و کد پیامکی به شماره ثبت‌شده انجام می‌شود. اگر به شماره موبایل خود دسترسی ندارید، با پشتیبانی تماس بگیرید.</p>
          <ButtonLink to="/me/support" variant="link" size="sm" className="mt-2">
            تماس با پشتیبانی
          </ButtonLink>
        </Card>
      </aside>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        loading={busy}
        tone="warning"
        title={confirm && confirm.length > 1 ? 'خروج از همه دستگاه‌های دیگر؟' : 'خروج این دستگاه؟'}
        description="دسترسی دستگاه انتخاب‌شده بلافاصله قطع می‌شود و برای ورود دوباره، رمز عبور لازم است."
        confirmLabel="خروج"
        onConfirm={async () => {
          setBusy(true)
          try {
            await actions.revokeSessions(confirm ?? [])
            toast.success('نشست‌ها بسته شدند')
            setConfirm(null)
          } catch (e) {
            toast.fromError(e)
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

/* ---------------- Personal activity log ---------------- */
export function ProfileActivity() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const entries = db.audit.filter((a) => a.employeeId === emp.id).sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Card>
      <CardHeader title="سوابق فعالیت حساب" description="عملیات مهم مرتبط با حساب و پرونده شما. این سوابق قابل ویرایش یا حذف نیستند." icon={Activity} />
      {entries.length === 0 ? (
        <EmptyState compact icon={Activity} title="سابقه‌ای ثبت نشده است" />
      ) : (
        <Timeline
          items={entries.map((a) => ({
            id: a.id,
            icon: a.result === 'success' ? BadgeCheck : ShieldCheck,
            tone: a.result === 'success' ? (a.actorRole === 'employee' ? 'brand' : 'neutral') : 'danger',
            title: a.action,
            time: formatDate(a.at, 'datetime'),
            body: (
              <>
                {a.actorRole === 'employee' ? 'توسط شما' : `توسط ${a.actor}`}، {displayId(a.entity.label)}
                {a.detail ? <span className="block text-ink-500">{a.detail}</span> : null}
              </>
            ),
          }))}
        />
      )}
    </Card>
  )
}
