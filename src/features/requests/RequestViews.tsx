import {
  Ban,
  Building2,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleX,
  FilePen,
  Forward,
  Hourglass,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  UserCheck,
  Briefcase,
} from 'lucide-react'
import type { Employee, EmployeeRequest, RequestEvent, RequestTypeDef } from '@/types/domain'
import { DescriptionList, Timeline, type TimelineItem } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatFileSize, formatRial, toFaDigits } from '@/lib/format'
import { PARTY_LABEL } from '@/config/requestTypes'
import { displayValue, visibleFields } from './logic'
import type { Tone } from '@/config/status'

const EVENT_META: Record<RequestEvent['kind'], { icon: typeof Send; tone: Tone; title: string }> = {
  created: { icon: FilePen, tone: 'muted', title: 'ایجاد درخواست' },
  submitted: { icon: Send, tone: 'info', title: 'ثبت و دریافت شماره پیگیری' },
  assigned: { icon: UserCheck, tone: 'brand', title: 'ارجاع به مرجع رسیدگی' },
  step_approved: { icon: CircleCheck, tone: 'success', title: 'تأیید مرحله' },
  approved: { icon: CircleCheck, tone: 'success', title: 'تأیید نهایی درخواست' },
  rejected: { icon: CircleX, tone: 'danger', title: 'رد درخواست' },
  returned: { icon: RotateCcw, tone: 'warning', title: 'برگشت برای اصلاح' },
  resubmitted: { icon: Send, tone: 'info', title: 'ارسال مجدد پس از اصلاح' },
  cancelled: { icon: Ban, tone: 'muted', title: 'لغو درخواست' },
  executed: { icon: CheckCheck, tone: 'accent', title: 'ثبت اجرای نهایی' },
  referred: { icon: Forward, tone: 'brand', title: 'ارجاع داخلی' },
  message: { icon: MessageSquare, tone: 'neutral', title: 'پیام' },
}

export function RequestHistory({ request, showActors = true }: { request: EmployeeRequest; showActors?: boolean }) {
  const items: TimelineItem[] = [...request.history]
    .filter((h) => h.kind !== 'message')
    .reverse()
    .map((h, i) => {
      const m = EVENT_META[h.kind]
      return {
        id: h.id,
        icon: m.icon,
        tone: m.tone,
        current: i === 0,
        title: m.title,
        time: formatDate(h.at, 'datetime'),
        body: (
          <>
            {showActors ? <span className="text-ink-500">{h.actor}</span> : null}
            {h.note ? <p className="mt-0.5 text-ink-700">{h.note}</p> : null}
          </>
        ),
      }
    })
  return <Timeline items={items} />
}

/** Horizontal (desktop) / vertical (mobile) tracker of workflow steps + execution */
export function RequestProgress({ request, type }: { request: EmployeeRequest; type: RequestTypeDef }) {
  const s = request.status
  const steps: { label: string; sub: string; state: 'done' | 'active' | 'waiting' | 'failed' | 'returned' }[] = [
    { label: 'ثبت درخواست', sub: request.submittedAt ? formatDate(request.submittedAt) : 'پیش‌نویس', state: s === 'draft' ? 'active' : 'done' },
    ...request.steps.map((st) => ({
      label: st.label,
      sub: PARTY_LABEL[st.party],
      state: (st.status === 'approved' ? 'done' : st.status === 'active' ? 'active' : st.status === 'rejected' ? 'failed' : st.status === 'returned' ? 'returned' : 'waiting') as 'done',
    })),
  ]
  if (type.executionLabel) {
    steps.push({
      label: type.executionLabel,
      sub: s === 'executed' ? formatDate(request.execution?.at) : s === 'approved' ? 'در انتظار ثبت اجرا' : 'پس از تأیید',
      state: s === 'executed' ? 'done' : s === 'approved' ? 'active' : 'waiting',
    })
  }
  if (s === 'cancelled') steps.forEach((x) => x.state !== 'done' && (x.state = 'waiting'))
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:gap-0" aria-label="مراحل رسیدگی">
      {steps.map((st, i) => {
        const Icon = st.state === 'done' ? CircleCheck : st.state === 'active' ? Hourglass : st.state === 'failed' ? CircleX : st.state === 'returned' ? RotateCcw : CircleDashed
        return (
          <li key={i} className="relative flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center" aria-current={st.state === 'active' ? 'step' : undefined}>
            {i < steps.length - 1 ? (
              <span className={cn('absolute hidden h-0.5 sm:block', 'top-4 start-1/2 w-full', st.state === 'done' ? 'bg-emerald-400' : 'bg-ink-200')} aria-hidden />
            ) : null}
            <span
              className={cn(
                'relative z-[1] grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white',
                st.state === 'done' && 'bg-emerald-500 text-white',
                st.state === 'active' && 'bg-brand-700 text-white',
                st.state === 'failed' && 'bg-red-600 text-white',
                st.state === 'returned' && 'bg-amber-500 text-white',
                st.state === 'waiting' && 'border border-dashed border-ink-300 bg-white text-ink-400',
              )}
            >
              <Icon size={16} aria-hidden />
            </span>
            <div className="min-w-0 sm:mt-2 sm:px-1">
              <p className={cn('text-[13px] font-semibold leading-5', st.state === 'waiting' ? 'text-ink-500' : 'text-ink-900')}>{st.label}</p>
              <p className="text-2xs text-ink-500">{st.sub}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function RequestValues({ request, type, employee }: { request: EmployeeRequest; type: RequestTypeDef; employee?: Employee }) {
  const fields = visibleFields(type, request.values)
    .filter((f) => f.kind !== 'files' && f.kind !== 'checkbox')
    .filter((f) => {
      const v = request.values[f.name]
      return f.required || f.prefill || !(v === undefined || v === null || v === '')
    })
  const items = fields.map((f) => ({
    label: f.label,
    value: f.kind === 'sheba' ? <bdi dir="ltr" className="font-mono text-[13px]">{String(request.values[f.name] ?? '—')}</bdi> : displayValue(f, request.values[f.name], employee),
    full: f.kind === 'textarea',
  }))
  return <DescriptionList items={items} />
}

export function AttachmentList({ request, onOpen }: { request: EmployeeRequest; onOpen?: (idx: number) => void }) {
  if (request.attachments.length === 0) return <p className="text-sm text-ink-500">پیوستی ثبت نشده است.</p>
  return (
    <ul className="space-y-2">
      {request.attachments.map((a, i) => (
        <li key={a.id}>
          <button type="button" onClick={() => onOpen?.(i)} className="flex w-full items-center gap-3 rounded-lg border border-ink-200 p-2.5 text-start hover:bg-ink-25">
            {a.previewUrl ? <img src={a.previewUrl} alt="" className="size-10 rounded-md object-cover" /> : <span className="grid size-10 place-items-center rounded-md bg-ink-100 text-ink-500"><Paperclip size={16} /></span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-800" dir="auto">
                {a.name}
              </span>
              <span className="block text-xs text-ink-500">
                {formatFileSize(a.size)}، {formatDate(a.uploadedAt)}
              </span>
            </span>
            <span className="text-xs font-semibold text-brand-700">مشاهده</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One-line summary of a request for lists */
export function requestSummary(r: EmployeeRequest): string {
  const v = r.values
  if (v.startDate && v.endDate) return `${formatDate(String(v.startDate))} تا ${formatDate(String(v.endDate))}${v.days ? `، ${toFaDigits(String(v.days))} روز` : ''}`
  if (v.date && v.startTime) return `${formatDate(String(v.date))}، ${toFaDigits(String(v.startTime))} تا ${toFaDigits(String(v.endTime ?? ''))}`
  if (typeof v.amount === 'number') return formatRial(v.amount)
  if (v.title) return String(v.title)
  if (v.recipient) return `مرجع: ${String(v.recipient)}`
  if (v.item) return String(v.item)
  if (v.description) return String(v.description).slice(0, 60)
  return ''
}

export function PartyIcon({ party }: { party: 'company' | 'org' }) {
  return party === 'org' ? <Building2 size={14} aria-hidden /> : <Briefcase size={14} aria-hidden />
}
