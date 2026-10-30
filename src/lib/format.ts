import { JALALI_MONTHS, parseISODate, toJalali, WEEKDAYS_LONG, persianWeekday } from './jalali'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Latin → Persian digits for display. */
export function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)])
}

/** Persian/Arabic → Latin digits. Always normalise user input with this before validation or storage. */
export function toEnDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
}

const numberFmt = new Intl.NumberFormat('fa-IR')

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return numberFmt.format(n)
}

/** Amounts are stored in Rial. */
export function formatRial(n: number | null | undefined, opts: { unit?: boolean } = {}): string {
  if (n === null || n === undefined) return '—'
  return opts.unit === false ? formatNumber(n) : `${formatNumber(n)} ریال`
}

export function rialToTomanWords(n: number): string {
  if (!n) return ''
  const toman = Math.floor(n / 10)
  if (toman >= 1_000_000) return `معادل ${formatNumber(Math.round(toman / 100_000) / 10)} میلیون تومان`
  if (toman >= 1_000) return `معادل ${formatNumber(Math.round(toman / 100) / 10)} هزار تومان`
  return `معادل ${formatNumber(toman)} تومان`
}

export function formatPercent(n: number) {
  return `${formatNumber(Math.round(n))}٪`
}

type DateStyle = 'short' | 'medium' | 'long' | 'datetime' | 'time' | 'monthYear' | 'weekday'

/** Jalali, Persian-digit date formatting. Accepts ISO strings or Date. */
export function formatDate(value: string | Date | null | undefined, style: DateStyle = 'medium'): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? parseISODate(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  const j = toJalali(d)
  const time = `${toFaDigits(String(d.getHours()).padStart(2, '0'))}:${toFaDigits(String(d.getMinutes()).padStart(2, '0'))}`
  switch (style) {
    case 'short':
      return toFaDigits(`${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`)
    case 'long':
      return `${WEEKDAYS_LONG[persianWeekday(d)]} ${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`
    case 'datetime':
      return `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}، ساعت ${time}`
    case 'time':
      return time
    case 'monthYear':
      return `${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`
    case 'weekday':
      return WEEKDAYS_LONG[persianWeekday(d)]
    default:
      return `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`
  }
}

export function formatPeriod(jy: number, jm: number) {
  return `${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`
}

/** "۵ دقیقه پیش" / "۳ روز دیگر" */
export function formatRelative(value: string | Date, now = new Date()): string {
  const d = typeof value === 'string' ? parseISODate(value) : value
  const diff = d.getTime() - now.getTime()
  const abs = Math.abs(diff)
  const future = diff > 0
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  let text: string
  if (abs < min) return 'همین حالا'
  if (abs < hour) text = `${toFaDigits(Math.round(abs / min))} دقیقه`
  else if (abs < day) text = `${toFaDigits(Math.round(abs / hour))} ساعت`
  else if (abs < 30 * day) text = `${toFaDigits(Math.round(abs / day))} روز`
  else return formatDate(d)
  return future ? `${text} دیگر` : `${text} پیش`
}

/** Whole days from today (local) until the given date; negative if past. */
export function daysUntil(value: string | Date, now = new Date()): number {
  const d = typeof value === 'string' ? parseISODate(value) : value
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function formatDeadline(value: string | null | undefined, now = new Date()): { text: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (!value) return { text: '—', tone: 'neutral' }
  const n = daysUntil(value, now)
  if (n < 0) return { text: `${toFaDigits(-n)} روز گذشته`, tone: 'danger' }
  if (n === 0) return { text: 'امروز', tone: 'danger' }
  if (n === 1) return { text: 'فردا', tone: 'warning' }
  if (n <= 3) return { text: `${toFaDigits(n)} روز مانده`, tone: 'warning' }
  return { text: `${toFaDigits(n)} روز مانده`, tone: 'neutral' }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${formatNumber(bytes)} بایت`
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} کیلوبایت`
  return `${formatNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} مگابایت`
}

/** Masks all but the last `visible` characters: ۰۰۷۱۲۳۴۵۶۷ → •••••۴۵۶۷ */
export function mask(value: string, visible = 4) {
  if (!value) return ''
  const keep = value.slice(-visible)
  return '•'.repeat(Math.max(0, value.length - visible)) + keep
}

export function maskSheba(sheba: string) {
  // IR12 •••• •••• •••• •••• 1234 56 — keep country/check digits and the tail
  if (sheba.length < 10) return sheba
  return `${sheba.slice(0, 4)} •••• •••• •••• ${sheba.slice(-6)}`
}

export function formatMobile(mobile: string) {
  // 09121234567 → 0912 123 4567 (kept LTR by callers)
  const m = toEnDigits(mobile)
  if (m.length !== 11) return m
  return `${m.slice(0, 4)} ${m.slice(4, 7)} ${m.slice(7)}`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ? '‌' + parts[1][0] : '')
}

/** Purely numeric identifiers (tracking numbers) are shown with Persian digits; mixed codes stay as-is. */
export function displayId(label: string) {
  return /^[\d\s]+$/.test(label) ? toFaDigits(label) : label
}
