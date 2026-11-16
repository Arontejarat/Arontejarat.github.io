import { DB_VERSION, type DB } from './seed'

/** Additive v5→v6 migration: preserve IDs, versions, binary keys and every existing collection. */
export function migrateDB(input: DB): DB {
  if (!input || !Array.isArray(input.employees) || !Array.isArray(input.companies)) throw new Error('ساختار داده نامعتبر است.')
  if (input.version > DB_VERSION) throw new Error('نسخه داده جدیدتر از برنامه است؛ از نسخه جدید برنامه استفاده کنید.')
  const db = structuredClone(input)
  db.documentTemplates ??= db.companies.map((c) => ({ id: 'format-' + c.id, companyId: c.id, name: 'قالب رسمی', companyName: c.name, registrationInfo: c.registrationNo, address: c.city, contact: c.contactPhone, header: '', footer: '', contractTitle: 'قرارداد کار', payslipTitle: 'فیش حقوقی', signatoryName: c.contactName, signatoryTitle: 'نماینده مجاز شرکت', signatureArea: true, stampArea: true, showNumber: true, extraText: '', version: 1 }))
  db.hrPolicies ??= db.companies.map((c) => ({ companyId: c.id, childAgeThreshold: 18, childNationalIdRequired: false }))
  db.insuranceRecords ??= []
  db.contractBatches ??= []
  db.ruleEvents ??= []
  db.employees.forEach((e) => e.children.forEach((c) => {
    c.firstName ??= c.fullName.split(' ')[0] ?? ''
    c.lastName ??= c.fullName.split(' ').slice(1).join(' ') || e.lastName
    c.status ??= 'pending'
    c.version ??= 1
    c.documents ??= []
    c.history ??= []
    // Legacy entries have no known registration timestamp: never invent one.
  }))
  db.version = DB_VERSION
  return db
}
