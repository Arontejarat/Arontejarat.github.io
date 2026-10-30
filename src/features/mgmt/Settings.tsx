import { useState } from 'react'
import { Bell, Building2, CalendarClock, Plus, Save, X } from 'lucide-react'
import { Badge, Button, Callout, Card, CardHeader, Field, Input, PageHeader, Switch, useToast } from '@/components/ui'
import { useDB } from '@/mock/store'
import { toEnDigits, toFaDigits } from '@/lib/format'
import { useMgmt } from './useMgmt'
import { sleep } from '@/lib/cn'

export function MgmtSettingsPage() {
  const db = useDB()
  const m = useMgmt()
  const toast = useToast()
  const entity = m.isCompany ? db.companies.find((c) => c.id === m.entityId) : db.organizations.find((o) => o.id === m.entityId)
  const [contact, setContact] = useState({ name: entity?.contactName ?? '', phone: entity?.contactPhone ?? '' })
  const [channels, setChannels] = useState({ sms: true, email: true, digest: false })
  const [thresholds, setThresholds] = useState([7, 3, 1])
  const [newT, setNewT] = useState('')
  const [defaultDeadline, setDefaultDeadline] = useState('5')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    await sleep(500)
    setBusy(false)
    toast.success('تنظیمات ذخیره شد', 'تنظیمات در این نسخه نمایشی فقط در همین نشست اعمال می‌شود.')
  }
  return (
    <>
      <PageHeader
        title={m.isCompany ? 'تنظیمات شرکت' : 'تنظیمات سازمان'}
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'تنظیمات' }]}
        actions={
          <Button icon={Save} onClick={save} loading={busy}>
            ذخیره تنظیمات
          </Button>
        }
      />
      <div className="grid max-w-4xl gap-5">
        <Card>
          <CardHeader title="مشخصات مجموعه" icon={Building2} description="نام رسمی و ساختار سازمانی توسط ادمین سامانه مدیریت می‌شود." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام مجموعه">{(p) => <Input id={p.id} value={entity?.name ?? ''} readOnly />}</Field>
            <Field label="شهر">{(p) => <Input id={p.id} value={entity?.city ?? ''} readOnly />}</Field>
            <Field label="نام رابط" required>{(p) => <Input id={p.id} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />}</Field>
            <Field label="تلفن رابط" required>{(p) => <Input id={p.id} ltr value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />}</Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="کانال‌های اعلان" icon={Bell} description="هر کاربر فقط اعلان‌های مرتبط با مسئولیت خود را دریافت می‌کند." />
          <div className="space-y-4">
            <Switch checked disabled onChange={() => undefined} label="اعلان داخل سامانه" description="همیشه فعال؛ مرجع اصلی پیگیری" />
            <Switch checked={channels.sms} onChange={(v) => setChannels({ ...channels, sms: v })} label="پیامک برای موارد مهم" description="قرارداد آماده امضا، مهلت نزدیک، هشدار فوری" />
            <Switch checked={channels.email} onChange={(v) => setChannels({ ...channels, email: v })} label="ایمیل" description="برای کاربرانی که ایمیل معتبر دارند" />
            <Switch checked={channels.digest} onChange={(v) => setChannels({ ...channels, digest: v })} label="خلاصه روزانه" description="یک ایمیل روزانه به‌جای اعلان‌های جداگانه غیرفوری" />
          </div>
        </Card>
        {m.isCompany ? (
          <Card>
            <CardHeader title="هشدارهای مهلت امضای قرارداد" icon={CalendarClock} description="آستانه‌های یادآوری پیش از مهلت امضا (روز). قوانین پیش‌فرض سامانه توسط ادمین تعیین می‌شود." />
            <div className="flex flex-wrap items-center gap-2">
              {thresholds
                .sort((a, b) => b - a)
                .map((t) => (
                  <Badge key={t} tone="brand">
                    {toFaDigits(t)} روز قبل
                    <button type="button" onClick={() => setThresholds(thresholds.filter((x) => x !== t))} className="ms-1 rounded hover:bg-brand-100" aria-label={`حذف آستانه ${t} روز`}>
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              <div className="flex items-center gap-1">
                <Input aria-label="آستانه جدید (روز)" ltr className="h-8 w-20" value={newT} onChange={(e) => setNewT(e.target.value)} placeholder="۱۴" />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Plus}
                  onClick={() => {
                    const n = Number(toEnDigits(newT))
                    if (n > 0 && n <= 60 && !thresholds.includes(n)) setThresholds([...thresholds, n])
                    setNewT('')
                  }}
                >
                  افزودن
                </Button>
              </div>
            </div>
            <div className="mt-5 max-w-xs">
              <Field label="مهلت پیش‌فرض امضا پس از ارسال (روز)">{(p) => <Input id={p.id} ltr value={defaultDeadline} onChange={(e) => setDefaultDeadline(e.target.value)} />}</Field>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="تأیید قراردادها" icon={CalendarClock} />
            <Callout tone="neutral">تأیید قراردادهای پروژه از طرف سازمان فقط توسط نقش «مدیر کل سازمان» یا کاربرانی که مجوز «تأیید قرارداد» دارند انجام می‌شود. برای تغییر، از بخش کاربران و دسترسی‌ها اقدام کنید.</Callout>
          </Card>
        )}
      </div>
    </>
  )
}
