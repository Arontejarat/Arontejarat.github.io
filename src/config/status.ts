import type { LucideIcon } from 'lucide-react'
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  FilePen,
  FileClock,
  Hourglass,
  PenLine,
  Pause,
  RotateCcw,
  Send,
  ShieldCheck,
  TriangleAlert,
  CheckCheck,
  Archive,
  Eye,
  CalendarClock,
  Wallet,
  Loader,
  Receipt,
  CircleSlash,
  Rocket,
  ClipboardList,
} from 'lucide-react'
import type {
  ContractStage,
  DocStatus,
  EmploymentStatus,
  ProjectStatus,
  RequestStatus,
  SignatureStatus,
  TaskPriority,
  TaskStatus,
  ValidityStatus,
} from '@/types/domain'

export type Tone = 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'danger' | 'accent' | 'muted'

export interface StatusMeta {
  label: string
  tone: Tone
  icon: LucideIcon
  /** Plain-language explanation shown in tooltips and detail pages */
  hint?: string
}

export const REQUEST_STATUS: Record<RequestStatus, StatusMeta> = {
  draft: { label: 'پیش‌نویس', tone: 'muted', icon: FilePen, hint: 'درخواست هنوز ارسال نهایی نشده است.' },
  submitted: { label: 'ثبت‌شده', tone: 'info', icon: Send, hint: 'درخواست ثبت شده و شماره پیگیری دارد.' },
  in_review: { label: 'در حال بررسی', tone: 'brand', icon: Hourglass, hint: 'درخواست در مرجع رسیدگی قرار دارد.' },
  needs_correction: {
    label: 'نیازمند اصلاح',
    tone: 'warning',
    icon: RotateCcw,
    hint: 'اطلاعات یا مدارک باید اصلاح و دوباره ارسال شود.',
  },
  approved: {
    label: 'تأییدشده',
    tone: 'success',
    icon: CircleCheck,
    hint: 'مرجع رسیدگی درخواست را تأیید کرده است؛ این به معنی اجرای نهایی نیست.',
  },
  rejected: { label: 'ردشده', tone: 'danger', icon: CircleX, hint: 'درخواست رد شده و دلیل آن ثبت شده است.' },
  cancelled: { label: 'لغوشده', tone: 'muted', icon: Ban, hint: 'درخواست طبق ضوابط لغو شده است.' },
  executed: {
    label: 'اجراشده',
    tone: 'accent',
    icon: CheckCheck,
    hint: 'اقدام نهایی (مثلاً پرداخت یا اعمال در پرونده) در سامانه ثبت شده است.',
  },
}

/** Open = still needs someone's action */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ['submitted', 'in_review', 'needs_correction']

export const CONTRACT_STAGE: Record<ContractStage, StatusMeta> = {
  draft: { label: 'پیش‌نویس', tone: 'muted', icon: FilePen },
  company_review: { label: 'در انتظار بررسی شرکت', tone: 'info', icon: FileClock },
  org_review: { label: 'در انتظار بررسی سازمان', tone: 'info', icon: FileClock },
  ready_to_send: { label: 'آماده ارسال برای امضا', tone: 'brand', icon: Send },
  awaiting_worker: { label: 'در انتظار امضای نیروی کار', tone: 'warning', icon: PenLine },
  awaiting_other: { label: 'در انتظار امضای طرف دیگر', tone: 'warning', icon: Hourglass },
  partially_signed: { label: 'امضای ناقص', tone: 'warning', icon: TriangleAlert },
  completed: { label: 'امضا و تکمیل‌شده', tone: 'success', icon: ShieldCheck },
  cancelled: { label: 'لغوشده', tone: 'muted', icon: Ban },
  superseded: { label: 'جایگزین‌شده با نسخه جدید', tone: 'muted', icon: Archive },
}

/** Employee-facing contract status (PRD part 1, §7.4) */
export type EmployeeContractStatus =
  | 'preparing'
  | 'ready'
  | 'viewed'
  | 'signed_by_me'
  | 'completed'
  | 'expired'
  | 'cancelled'

export const EMPLOYEE_CONTRACT_STATUS: Record<EmployeeContractStatus, StatusMeta> = {
  preparing: { label: 'در حال آماده‌سازی', tone: 'muted', icon: CircleDashed, hint: 'قرارداد هنوز برای امضا ارسال نشده است.' },
  ready: { label: 'آماده مشاهده و امضا', tone: 'warning', icon: PenLine, hint: 'متن قرارداد را مطالعه و امضا کنید.' },
  viewed: { label: 'مشاهده‌شده', tone: 'brand', icon: Eye, hint: 'قرارداد را دیده‌اید اما هنوز امضا نکرده‌اید.' },
  signed_by_me: {
    label: 'امضاشده توسط شما',
    tone: 'info',
    icon: CircleCheck,
    hint: 'امضای شما ثبت شد؛ امضای سایر طرف‌ها هنوز تکمیل نشده است.',
  },
  completed: { label: 'تکمیل امضاهای موردنیاز', tone: 'success', icon: ShieldCheck, hint: 'همه طرف‌ها قرارداد را امضا کرده‌اند.' },
  expired: { label: 'منقضی‌شده', tone: 'muted', icon: CalendarClock },
  cancelled: { label: 'لغو یا جایگزین‌شده', tone: 'muted', icon: Archive },
}

export const SIGNATURE_STATUS: Record<SignatureStatus, StatusMeta> = {
  unsigned: { label: 'امضانشده', tone: 'muted', icon: CircleDashed },
  awaiting: { label: 'در انتظار امضا', tone: 'warning', icon: PenLine },
  partial: { label: 'امضای ناقص', tone: 'warning', icon: TriangleAlert },
  complete: { label: 'تکمیل‌شده', tone: 'success', icon: ShieldCheck },
}

export const VALIDITY_STATUS: Record<ValidityStatus, StatusMeta> = {
  not_started: { label: 'شروع‌نشده', tone: 'muted', icon: Clock },
  active: { label: 'فعال', tone: 'success', icon: CircleDot },
  near_end: { label: 'نزدیک به پایان', tone: 'warning', icon: CalendarClock },
  expired: { label: 'منقضی', tone: 'danger', icon: CircleSlash },
  terminated: { label: 'خاتمه‌یافته', tone: 'muted', icon: Ban },
}

export const DOC_STATUS: Record<DocStatus, StatusMeta> = {
  not_submitted: { label: 'ارسال نشده', tone: 'muted', icon: CircleDashed },
  pending: { label: 'در انتظار بررسی', tone: 'brand', icon: Hourglass },
  approved: { label: 'تأییدشده', tone: 'success', icon: CircleCheck },
  rejected: { label: 'ردشده', tone: 'danger', icon: CircleX },
  needs_fix: { label: 'نیازمند اصلاح', tone: 'warning', icon: RotateCcw },
  expired: { label: 'منقضی‌شده', tone: 'danger', icon: CalendarClock },
}

export const EMPLOYMENT_STATUS: Record<EmploymentStatus, StatusMeta> = {
  active: { label: 'فعال', tone: 'success', icon: CircleDot },
  pending_start: { label: 'در انتظار شروع', tone: 'info', icon: Clock },
  suspended: { label: 'تعلیق‌شده', tone: 'warning', icon: Pause },
  terminated: { label: 'خاتمه‌یافته', tone: 'muted', icon: Ban },
}

export type WorkerDocSummary = 'complete' | 'incomplete' | 'pending'
export const WORKER_DOC_SUMMARY: Record<WorkerDocSummary, StatusMeta> = {
  complete: { label: 'کامل', tone: 'success', icon: CircleCheck },
  incomplete: { label: 'ناقص', tone: 'danger', icon: TriangleAlert },
  pending: { label: 'در انتظار بررسی', tone: 'brand', icon: Hourglass },
}

export type WorkerContractSummary = 'draft' | 'awaiting' | 'active' | 'near_end' | 'expired' | 'none'
export const WORKER_CONTRACT_SUMMARY: Record<WorkerContractSummary, StatusMeta> = {
  draft: { label: 'پیش‌نویس', tone: 'muted', icon: FilePen },
  awaiting: { label: 'در انتظار امضا', tone: 'warning', icon: PenLine },
  active: { label: 'فعال', tone: 'success', icon: CircleDot },
  near_end: { label: 'نزدیک به پایان', tone: 'warning', icon: CalendarClock },
  expired: { label: 'منقضی', tone: 'danger', icon: CircleSlash },
  none: { label: 'بدون قرارداد', tone: 'muted', icon: CircleDashed },
}

export const PAYSLIP_STATUS: Record<'draft' | 'final' | 'corrected', StatusMeta> = {
  draft: { label: 'پیش‌نویس', tone: 'muted', icon: FilePen },
  final: { label: 'نهایی', tone: 'success', icon: CircleCheck },
  corrected: { label: 'اصلاح‌شده', tone: 'info', icon: RotateCcw },
}

/** Issued ≠ processing ≠ paid (PRD part 1, §8.3) */
export const PAYMENT_STATUS: Record<'issued' | 'processing' | 'paid' | 'unknown', StatusMeta> = {
  issued: { label: 'فیش صادر شده', tone: 'info', icon: Receipt, hint: 'صدور فیش به معنی واریز حقوق نیست.' },
  processing: { label: 'پرداخت در حال انجام', tone: 'warning', icon: Loader },
  paid: { label: 'پرداخت انجام شده', tone: 'success', icon: Wallet },
  unknown: {
    label: 'اطلاعات پرداخت موجود نیست',
    tone: 'muted',
    icon: CircleDashed,
    hint: 'وضعیت پرداخت فقط از سامانه پرداخت دریافت می‌شود.',
  },
}

export const PROJECT_STATUS: Record<ProjectStatus, StatusMeta> = {
  planning: { label: 'برنامه‌ریزی', tone: 'muted', icon: ClipboardList },
  preparing: { label: 'در حال آماده‌سازی', tone: 'info', icon: Loader },
  awaiting_contract: { label: 'در انتظار تأیید یا قرارداد', tone: 'warning', icon: FileClock },
  running: { label: 'در حال اجرا', tone: 'success', icon: Rocket },
  needs_followup: { label: 'نیازمند پیگیری', tone: 'danger', icon: TriangleAlert },
  closed: { label: 'خاتمه‌یافته', tone: 'muted', icon: Archive },
  paused: { label: 'متوقف‌شده', tone: 'muted', icon: Pause },
}

export const TASK_STATUS: Record<TaskStatus, StatusMeta> = {
  todo: { label: 'انجام‌نشده', tone: 'muted', icon: CircleDashed },
  in_progress: { label: 'در حال انجام', tone: 'brand', icon: Loader },
  blocked: { label: 'متوقف', tone: 'warning', icon: Pause },
  done: { label: 'انجام‌شده', tone: 'success', icon: CircleCheck },
}

export const TASK_PRIORITY: Record<TaskPriority, StatusMeta> = {
  low: { label: 'کم', tone: 'muted', icon: CircleDot },
  medium: { label: 'متوسط', tone: 'info', icon: CircleDot },
  high: { label: 'زیاد', tone: 'warning', icon: CircleDot },
  urgent: { label: 'فوری', tone: 'danger', icon: TriangleAlert },
}

export const TASK_KIND: Record<'manual' | 'automatic' | 'system', { label: string; hint: string }> = {
  manual: { label: 'دستی', hint: 'توسط کاربر ایجاد شده است.' },
  automatic: { label: 'خودکار', hint: 'بر اساس یک قانون در سامانه ایجاد شده است.' },
  system: { label: 'سیستمی', hint: 'به یک رکورد واقعی متصل است و وضعیت آن را منعکس می‌کند.' },
}
