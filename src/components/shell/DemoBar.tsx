import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FlaskConical, RotateCcw, Users } from 'lucide-react'
import { Button, Popover, Select, Switch, ConfirmDialog, useToast } from '@/components/ui'
import { useDemo, useStore } from '@/mock/store'
import { HOME_BY_ROLE, demoAccounts, useAuth } from '@/auth/auth'
import { SUBROLES } from '@/config/permissions'
import { toFaDigits } from '@/lib/format'

/**
 * Persistent strip that makes it explicit this is a prototype with simulated
 * data, and exposes controls to exercise loading / error / empty states.
 */
export function DemoBar() {
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const { demo, setDemo } = useDemo()
  const { reset, db } = useStore()
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const accounts = demoAccounts(db)

  return (
    <div className="no-print flex h-8 items-center justify-between gap-2 bg-brand-950 px-3 text-[11px] text-brand-100 sm:px-4">
      <p className="truncate">
        <span className="font-semibold text-white">نسخه نمایشی</span>
        <span className="hidden sm:inline"> — داده‌ها نمونه هستند و فقط در همین مرورگر ذخیره می‌شوند؛ هیچ اطلاعاتی به سرور ارسال نمی‌شود.</span>
      </p>
      <button ref={ref} onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 font-medium text-white hover:bg-white/10">
        <FlaskConical size={13} aria-hidden />
        ابزار نمایش
        {demo.failNetwork || demo.slow || demo.emptyMode || demo.dayOverride ? <span className="size-1.5 rounded-full bg-amber-400" aria-label="شبیه‌سازی فعال است" /> : null}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align="end" label="ابزار نمایش" className="w-[min(92vw,340px)] p-4 text-ink-800">
        <p className="mb-3 text-sm font-bold">شبیه‌سازی وضعیت‌ها</p>
        <div className="space-y-3.5">
          <Switch checked={demo.failNetwork} onChange={(v) => setDemo({ failNetwork: v })} label="قطع ارتباط با سرور" description="بارگذاری صفحه‌ها و ذخیره فرم‌ها با خطا مواجه می‌شود؛ اطلاعات فرم حفظ می‌شود." />
          <Switch checked={demo.slow} onChange={(v) => setDemo({ slow: v })} label="اینترنت کند" description="حالت‌های بارگذاری و جلوگیری از ارسال تکراری را ببینید." />
          <Switch checked={demo.emptyMode} onChange={(v) => setDemo({ emptyMode: v })} label="حالت بدون داده" description="فهرست‌ها خالی نمایش داده می‌شوند." />
          <div>
            <label htmlFor="demo-day" className="text-sm font-medium">
              روز جاری ماه (برای قاعده مساعده)
            </label>
            <Select
              id="demo-day"
              className="mt-1.5"
              value={demo.dayOverride ? String(demo.dayOverride) : ''}
              onChange={(e) => setDemo({ dayOverride: e.target.value ? Number(e.target.value) : null })}
              placeholder="تاریخ واقعی امروز"
              options={[3, 9, 10, 15, 25].map((d) => ({ value: String(d), label: `روز ${toFaDigits(d)} ماه` }))}
            />
          </div>
        </div>
        <hr className="my-4 border-ink-100" />
        <label htmlFor="demo-role" className="flex items-center gap-1.5 text-sm font-medium">
          <Users size={15} aria-hidden /> ورود با نقش دیگر
        </label>
        <Select
          id="demo-role"
          className="mt-1.5"
          value={session?.subRole ?? ''}
          onChange={(e) => {
            const acc = accounts.find((a) => a.session.subRole === e.target.value)
            if (!acc) return
            login({ ...acc.session, startedAt: new Date().toISOString() })
            setOpen(false)
            navigate(HOME_BY_ROLE[acc.session.role])
          }}
          options={accounts.map((a) => ({ value: a.session.subRole, label: `${SUBROLES[a.session.subRole].label} — ${a.session.name}` }))}
        />
        <Button variant="outline" size="sm" icon={RotateCcw} className="mt-4" block onClick={() => setConfirmReset(true)}>
          بازنشانی داده‌های نمایشی
        </Button>
      </Popover>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        tone="warning"
        title="بازنشانی داده‌های نمایشی؟"
        description="همه تغییراتی که در این مرورگر ایجاد کرده‌اید (درخواست‌ها، امضاها، بارگذاری‌ها) حذف و داده‌های نمونه اولیه بازگردانده می‌شود."
        confirmLabel="بازنشانی"
        onConfirm={() => {
          reset()
          setConfirmReset(false)
          setOpen(false)
          toast.success('داده‌های نمایشی بازنشانی شد')
        }}
      />
    </div>
  )
}
