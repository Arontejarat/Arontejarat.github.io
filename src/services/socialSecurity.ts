import type { InsuranceRecord } from '@/types/domain'
/** A server adapter must supply authenticated, consented, audited official inquiries. */
export interface SocialSecurityProvider {
  available: boolean
  inquireHistory(employeeId: string): Promise<InsuranceRecord[]>
  verifyRegistration(employeeId: string, registrationNumber: string): Promise<{ verified: boolean; reference: string }>
  verifyDays(employeeId: string, year: number, month: number): Promise<{ days: number; reference: string }>
}
const unavailable = async (): Promise<never> => { throw new Error('اتصال به سازمان تأمین اجتماعی هنوز پیاده‌سازی نشده است.') }
export const socialSecurityProvider: SocialSecurityProvider = { available: false, inquireHistory: unavailable, verifyRegistration: unavailable, verifyDays: unavailable }
