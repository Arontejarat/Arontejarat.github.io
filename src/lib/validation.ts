import { toEnDigits } from './format'

/** Iranian national ID (کد ملی) checksum validation. */
export function isValidNationalId(input: string): boolean {
  const code = toEnDigits(input).trim()
  if (!/^\d{10}$/.test(code)) return false
  if (/^(\d)\1{9}$/.test(code)) return false
  const check = Number(code[9])
  const sum = code
    .slice(0, 9)
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (10 - i), 0)
  const r = sum % 11
  return r < 2 ? check === r : check === 11 - r
}

/** Normalises user input into canonical IR + 24 digits form. */
export function normalizeSheba(input: string) {
  return toEnDigits(input).replace(/[\s-]/g, '').toUpperCase().replace(/^(?!IR)/, 'IR')
}

/** IBAN (شبا) validation with the ISO 13616 mod-97 check. */
export function isValidSheba(input: string): boolean {
  const s = normalizeSheba(input)
  if (!/^IR\d{24}$/.test(s)) return false
  const rearranged = s.slice(4) + '1827' + s.slice(2, 4) // I=18, R=27
  let rem = 0
  for (const ch of rearranged) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

/** Bank code is digits 5–7 of the IBAN (after IRkk0). */
const BANKS: Record<string, string> = {
  '017': 'بانک ملی ایران',
  '012': 'بانک ملت',
  '018': 'بانک تجارت',
  '019': 'بانک صادرات ایران',
  '015': 'بانک سپه',
  '016': 'بانک کشاورزی',
  '014': 'بانک مسکن',
  '021': 'پست بانک',
  '055': 'بانک اقتصاد نوین',
  '054': 'بانک پارسیان',
  '057': 'بانک پاسارگاد',
  '056': 'بانک سامان',
  '062': 'بانک آینده',
  '058': 'بانک سرمایه',
  '070': 'بانک رسالت',
}

export function bankFromSheba(input: string): string | null {
  const s = normalizeSheba(input)
  if (s.length < 7) return null
  return BANKS[s.slice(4, 7)] ?? null
}

export function isValidMobile(input: string) {
  return /^09\d{9}$/.test(toEnDigits(input).trim())
}

export function isValidPostalCode(input: string) {
  return /^\d{10}$/.test(toEnDigits(input).trim())
}

export interface PasswordCheck {
  id: string
  label: string
  ok: boolean
}

export function checkPassword(pw: string): PasswordCheck[] {
  return [
    { id: 'len', label: 'حداقل ۸ نویسه', ok: pw.length >= 8 },
    { id: 'case', label: 'حروف بزرگ و کوچک لاتین', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: 'digit', label: 'دست‌کم یک رقم', ok: /\d/.test(toEnDigits(pw)) },
    { id: 'sym', label: 'دست‌کم یک نماد مانند ! یا @', ok: /[^A-Za-z0-9۰-۹\s]/.test(pw) },
  ]
}
