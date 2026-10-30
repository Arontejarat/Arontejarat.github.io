import { useMemo, useState } from 'react'
import { ChevronDown, CircleHelp, Headset, LifeBuoy, MessageSquare, Plus, Send } from 'lucide-react'
import { Badge, Button, ButtonLink, Card, CardHeader, Dialog, EmptyState, Field, Input, PageHeader, SearchInput, Select, Textarea, useToast } from '@/components/ui'
import { useActions, useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { formatDate, formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PrivacyContent } from '@/features/system/SystemPages'

const FAQ: { cat: string; q: string; a: string }[] = [
  { cat: 'درخواست‌ها', q: 'چطور درخواست مرخصی ثبت کنم؟', a: 'از منوی «مرکز درخواست‌ها» گزینه «ثبت درخواست جدید» را بزنید، نوع «مرخصی روزانه» یا «مرخصی ساعتی» را انتخاب کنید و فرم را تکمیل کنید. مدت مرخصی بر اساس روزهای کاری به‌صورت خودکار محاسبه می‌شود.' },
  { cat: 'درخواست‌ها', q: 'چرا دکمه ثبت مساعده غیرفعال است؟', a: 'طبق ضوابط، درخواست مساعده از روز دهم هر ماه قابل ثبت است. همچنین تا وقتی یک درخواست مساعده باز دارید، امکان ثبت درخواست جدید وجود ندارد.' },
  { cat: 'درخواست‌ها', q: 'فرق «تأییدشده» و «اجراشده» چیست؟', a: '«تأییدشده» یعنی مرجع رسیدگی با درخواست موافقت کرده است. «اجراشده» یعنی اقدام نهایی، مثلاً واریز مساعده یا اعمال تغییر در پرونده، انجام و ثبت شده است.' },
  { cat: 'درخواست‌ها', q: 'درخواستم برای اصلاح برگشت خورده؛ چه کنم؟', a: 'وارد جزئیات درخواست شوید؛ توضیح مسئول رسیدگی نمایش داده می‌شود. با دکمه «اصلاح و ارسال مجدد» اطلاعات یا مدارک را اصلاح کنید.' },
  { cat: 'قرارداد', q: 'قرارداد ماهانه را چطور امضا کنم؟', a: 'در «اسناد من ← قراردادها» قرارداد آماده امضا را باز کنید، متن کامل را مطالعه و پذیرش را تأیید کنید و سپس کد پیامکی ارسال‌شده به موبایل خود را وارد کنید. پس از امضا، رسید امضا نمایش داده می‌شود.' },
  { cat: 'قرارداد', q: 'چرا بعد از امضا، قرارداد هنوز «تکمیل» نشده است؟', a: 'امضای شما جدا از امضای شرکت ثبت می‌شود. قرارداد پس از امضای همه طرف‌ها تکمیل و نسخه نهایی قابل دریافت می‌شود.' },
  { cat: 'حقوق', q: 'فیش صادر شده ولی حقوق واریز نشده؛ چرا؟', a: 'صدور فیش به معنی واریز حقوق نیست. وضعیت پرداخت در جزئیات فیش و فقط بر اساس اطلاعات سامانه پرداخت نمایش داده می‌شود.' },
  { cat: 'حقوق', q: 'به مبلغ فیش اعتراض دارم.', a: 'در صفحه جزئیات فیش، دکمه «اعتراض به فیش» را بزنید یا از مرکز درخواست‌ها نوع «اعتراض به فیش حقوقی یا کارکرد» را انتخاب کنید.' },
  { cat: 'مدارک', q: 'چه فایل‌هایی قابل بارگذاری است؟', a: 'فایل‌های PDF، JPG و PNG. حداکثر حجم برای هر نوع مدرک در صفحه ارسال نمایش داده می‌شود.' },
  { cat: 'حساب', q: 'چطور شماره موبایلم را تغییر دهم؟', a: 'از «پروفایل ← اطلاعات تماس» گزینه تغییر شماره را انتخاب کنید. برای امنیت، رمز فعلی و کد ارسال‌شده به شماره جدید لازم است.' },
]

export function HelpPage() {
  const [q, setQ] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const items = useMemo(() => FAQ.filter((f) => !q || f.q.includes(q) || f.a.includes(q)), [q])
  const cats = [...new Set(items.map((f) => f.cat))]
  return (
    <>
      <PageHeader title="راهنما و پرسش‌های متداول" breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'راهنما' }]} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <SearchInput value={q} onChange={setQ} placeholder="جست‌وجو در پرسش‌ها…" />
          {items.length === 0 ? <EmptyState compact icon={CircleHelp} title="پرسشی پیدا نشد" description="سؤال خود را از طریق پشتیبانی مطرح کنید." action={<ButtonLink to="/me/support" icon={Headset}>پشتیبانی</ButtonLink>} /> : null}
          {cats.map((c) => (
            <section key={c}>
              <h2 className="mb-2 text-sm font-bold text-ink-700">{c}</h2>
              <Card padded={false}>
                <ul className="divide-y divide-ink-100">
                  {items
                    .filter((f) => f.cat === c)
                    .map((f) => {
                      const i = FAQ.indexOf(f)
                      const open = openIdx === i
                      return (
                        <li key={f.q}>
                          <button type="button" aria-expanded={open} onClick={() => setOpenIdx(open ? null : i)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start text-sm font-semibold hover:bg-ink-25">
                            {f.q}
                            <ChevronDown size={18} className={cn('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} aria-hidden />
                          </button>
                          {open ? <p className="px-4 pb-4 text-sm leading-7 text-ink-600">{f.a}</p> : null}
                        </li>
                      )
                    })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
        <aside>
          <Card>
            <LifeBuoy size={24} className="text-brand-700" aria-hidden />
            <p className="mt-3 font-bold">پاسخ خود را پیدا نکردید؟</p>
            <p className="mt-1 text-xs leading-6 text-ink-600">برای مشکلات فنی سامانه، تیکت پشتیبانی ثبت کنید. برای امور پرسنلی (مرخصی، حقوق، قرارداد) از مرکز درخواست‌ها استفاده کنید.</p>
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink to="/me/support" icon={Headset}>
                پشتیبانی فنی
              </ButtonLink>
              <ButtonLink to="/me/requests/new" variant="outline">
                مرکز درخواست‌ها
              </ButtonLink>
            </div>
          </Card>
        </aside>
      </div>
    </>
  )
}

export function SupportPage() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const actions = useActions()
  const toast = useToast()
  const tickets = db.tickets.filter((t) => t.employeeId === emp.id)
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('technical')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<string | null>(tickets[0]?.id ?? null)
  const [reply, setReply] = useState('')
  const ticket = tickets.find((t) => t.id === active)
  const submit = async () => {
    const next: Record<string, string> = {}
    if (!subject.trim()) next.subject = 'موضوع را وارد کنید.'
    if (text.trim().length < 10) next.text = 'شرح مشکل را دست‌کم در ۱۰ نویسه بنویسید.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const t = await actions.createTicket(subject, category, text)
      setActive(t.id)
      setOpen(false)
      setSubject('')
      setText('')
      toast.success('تیکت پشتیبانی ثبت شد', `شماره پیگیری ${t.number}`)
    } catch (e) {
      toast.fromError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader title="پشتیبانی" description="ثبت و پیگیری مشکلات فنی سامانه." breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'پشتیبانی' }]} actions={<Button icon={Plus} onClick={() => setOpen(true)}>تیکت جدید</Button>} />
      {tickets.length === 0 ? (
        <EmptyState icon={Headset} title="تیکتی ثبت نکرده‌اید" action={<Button icon={Plus} onClick={() => setOpen(true)}>ثبت تیکت</Button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setActive(t.id)} aria-current={t.id === active} className={cn('w-full px-4 py-3 text-start hover:bg-ink-25', t.id === active && 'bg-brand-50/60')}>
                    <p className="text-sm font-semibold">{t.subject}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-2xs text-ink-500">
                      <bdi dir="ltr">{t.number}</bdi>، {formatRelative(t.createdAt)}
                      <Badge size="sm" tone={t.status === 'answered' ? 'success' : t.status === 'open' ? 'brand' : 'muted'}>
                        {t.status === 'answered' ? 'پاسخ داده شد' : t.status === 'open' ? 'در حال بررسی' : 'بسته'}
                      </Badge>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {ticket ? (
            <Card>
              <CardHeader title={ticket.subject} description={`${ticket.number}، ${formatDate(ticket.createdAt, 'datetime')}`} icon={MessageSquare} />
              <ul className="space-y-3">
                {ticket.messages.map((m) => (
                  <li key={m.id} className={cn('flex', m.fromSupport ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] rounded-xl px-3.5 py-2.5', m.fromSupport ? 'bg-ink-100' : 'bg-brand-50')}>
                      <p className="text-2xs font-semibold text-ink-600">
                        {m.fromSupport ? m.author : 'شما'}، {formatDate(m.at, 'datetime')}
                      </p>
                      <p className="mt-0.5 text-sm leading-6">{m.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2 border-t border-ink-100 pt-4">
                <Textarea aria-label="پاسخ" value={reply} onChange={(e) => setReply(e.target.value)} className="min-h-12" placeholder="پاسخ خود را بنویسید…" />
                <Button
                  icon={Send}
                  disabled={!reply.trim()}
                  onClick={async () => {
                    try {
                      await actions.replyTicket(ticket.id, reply)
                      setReply('')
                    } catch (e) {
                      toast.fromError(e)
                    }
                  }}
                  className="self-end"
                >
                  ارسال
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت تیکت پشتیبانی"
        description="فقط برای مشکلات فنی سامانه. امور پرسنلی را از مرکز درخواست‌ها پیگیری کنید."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submit} loading={busy}>
              ثبت تیکت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="دسته" required>
            {(p) => <Select id={p.id} value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'technical', label: 'مشکل فنی' }, { value: 'login', label: 'ورود و حساب کاربری' }, { value: 'upload', label: 'بارگذاری فایل' }, { value: 'other', label: 'سایر' }]} />}
          </Field>
          <Field label="موضوع" required error={errors.subject}>
            {(p) => <Input id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} />}
          </Field>
          <Field label="شرح مشکل" required error={errors.text} helper="در صورت امکان، مراحلی که منجر به خطا شد را بنویسید.">
            {(p) => <Textarea id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} showCount />}
          </Field>
        </div>
      </Dialog>
    </>
  )
}

export function PrivacyPage() {
  return (
    <>
      <PageHeader title="قوانین و حریم خصوصی" breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'حریم خصوصی' }]} />
      <Card className="max-w-3xl">
        <PrivacyContent />
      </Card>
    </>
  )
}
