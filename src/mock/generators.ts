/* Deterministic helpers used only by the mock seed. */

export function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof seededRandom>

export const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]
export const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min

export function nationalId(rng: Rng) {
  let digits = ''
  for (let i = 0; i < 9; i += 1) digits += String(int(rng, 0, 9))
  if (/^(\d)\1+$/.test(digits)) digits = '0' + digits.slice(1, 8) + '7'
  const sum = digits.split('').reduce((acc, d, i) => acc + Number(d) * (10 - i), 0)
  const r = sum % 11
  return digits + String(r < 2 ? r : 11 - r)
}

export function sheba(rng: Rng, bankCode: string) {
  let account = ''
  for (let i = 0; i < 19; i += 1) account += String(int(rng, 0, 9))
  const bban = '0' + bankCode.slice(1) + '0' + account // 22 digits
  const bb = bban.length === 22 ? bban : bban.padEnd(22, '0').slice(0, 22)
  const rearranged = bb + '1827' + '00'
  let rem = 0
  for (const ch of rearranged) rem = (rem * 10 + Number(ch)) % 97
  const check = String(98 - rem).padStart(2, '0')
  return `IR${check}${bb}`
}

export function mobile(rng: Rng) {
  return `09${pick(rng, ['12', '13', '15', '19', '35', '36', '01', '02'])}${String(int(rng, 1000000, 9999999))}`
}

const DAY = 86_400_000

/** ISO datetime n days from now at the given hour */
export function at(days: number, hour = 10, minute = 0) {
  const d = new Date(Date.now() + days * DAY)
  d.setHours(hour, minute, 0, 0)
  // Events dated "today" or earlier never appear to be in the future
  if (days <= 0 && d.getTime() > Date.now()) return new Date(Date.now() - (60 + hour) * 60_000).toISOString()
  return d.toISOString()
}

/** yyyy-mm-dd n days from today (local) */
export function day(days: number) {
  const d = new Date(Date.now() + days * DAY)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const FIRST_M = ['علی', 'محمد', 'حسین', 'رضا', 'مهدی', 'امیر', 'سعید', 'مجید', 'حمید', 'جواد', 'احسان', 'محسن', 'وحید', 'بهزاد', 'کاوه', 'یاسر', 'پویا', 'آرش']
export const FIRST_F = ['زهرا', 'فاطمه', 'مریم', 'سارا', 'نرگس', 'الهام', 'لیلا', 'سمیه', 'نیلوفر', 'مینا', 'پریسا', 'شیما', 'راضیه', 'هانیه', 'ریحانه', 'آزاده']
export const LAST = [
  'رضایی',
  'محمدی',
  'حسینی',
  'احمدی',
  'کریمی',
  'موسوی',
  'جعفری',
  'صادقی',
  'رحیمی',
  'نوری',
  'کاظمی',
  'قاسمی',
  'عباسی',
  'هاشمی',
  'میرزایی',
  'یوسفی',
  'شریفی',
  'طاهری',
  'اکبری',
  'سلیمانی',
  'باقری',
  'فرهادی',
  'نجفی',
  'زمانی',
  'شجاعی',
  'توکلی',
]

export const AVATAR_COLORS = ['#244378', '#13665f', '#7c3a5a', '#7a5a14', '#3f6bb0', '#5b4a8a', '#1f6f8b', '#8a4a2a']
