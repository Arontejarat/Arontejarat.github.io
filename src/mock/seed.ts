/**
 * DEMO DATA — not production data.
 * Generates a coherent sample dataset relative to the current date so that
 * deadlines, "this month" contracts and payslips always look current.
 */
import { DEFAULT_REQUEST_TYPES } from '@/config/requestTypes'
import { DOC_TYPES } from '@/config/documentTypes'
import { toFaDigits } from '@/lib/format'
import { shiftJalaliMonth, toJalali, jalaliToISO, jalaliMonthLength } from '@/lib/jalali'
import type {
  AlertRule,
  AppNotification,
  AppUser,
  AuditEntry,
  Company,
  Contract,
  ContractStage,
  DocVersion,
  Employee,
  EmployeeRequest,
  OrgFile,
  Organization,
  Payslip,
  PersonnelDocument,
  Project,
  RequestStatus,
  RequestStep,
  RequestTypeDef,
  Session,
  Task,
} from '@/types/domain'
import { AVATAR_COLORS, FIRST_F, FIRST_M, LAST, at, day, int, mobile, nationalId, pick, seededRandom, sheba } from './generators'

export interface SupportTicket {
  id: string
  number: string
  employeeId: string
  subject: string
  category: string
  status: 'open' | 'answered' | 'closed'
  createdAt: string
  messages: { id: string; at: string; author: string; fromSupport: boolean; text: string }[]
}

export interface DB {
  version: number
  companies: Company[]
  organizations: Organization[]
  projects: Project[]
  employees: Employee[]
  users: AppUser[]
  requestTypes: RequestTypeDef[]
  requests: EmployeeRequest[]
  contracts: Contract[]
  payslips: Payslip[]
  documents: PersonnelDocument[]
  orgFiles: OrgFile[]
  tasks: Task[]
  notifications: AppNotification[]
  audit: AuditEntry[]
  alertRules: AlertRule[]
  sessions: Session[]
  tickets: SupportTicket[]
  settings: {
    signatureOtpTtlSec: number
    otpMaxAttempts: number
    otpResendCooldownSec: number
    sessionTimeoutMin: number
    smsEnabled: boolean
    emailEnabled: boolean
    maintenanceBanner: string
  }
}

export const DB_VERSION = 5

export const DEMO_EMPLOYEE_ID = 'e1'

export function createSeed(): DB {
  const rng = seededRandom(1405)
  const today = toJalali(new Date())

  /* ---------------------------------------------------------------- */
  const companies: Company[] = [
    { id: 'c1', name: 'شرکت خدماتی پارس‌آرمان', registrationNo: '۴۵۸۲۱۰', city: 'مشهد', status: 'active', contactName: 'حمید صادقی', contactPhone: '05137654321' },
    { id: 'c2', name: 'شرکت تأمین نیروی آتیه‌سازان', registrationNo: '۳۹۱۰۷۷', city: 'تهران', status: 'active', contactName: 'بابک فرهادی', contactPhone: '02188776655' },
  ]

  const organizations: Organization[] = [
    { id: 'o1', name: 'بیمارستان امام رضا (ع)', kind: 'بیمارستان', city: 'مشهد', status: 'active', contactName: 'فرزانه احمدی', contactPhone: '05138543031' },
    { id: 'o2', name: 'شهرداری منطقه ۶', kind: 'شهرداری', city: 'مشهد', status: 'active', contactName: 'کامران زمانی', contactPhone: '05137281100' },
    { id: 'o3', name: 'دانشگاه علوم پزشکی', kind: 'دانشگاه', city: 'تهران', status: 'active', contactName: 'شهره نجفی', contactPhone: '02166554433' },
  ]

  /* ---------------------------------------------------------------- */
  const users: AppUser[] = [
    { id: 'u-o1', name: 'فرزانه احمدی', email: 'f.ahmadi@imamreza-hosp.ir', mobile: '09151234567', role: 'org', subRole: 'org_admin', orgId: 'o1', projectScope: 'all', status: 'active', lastLogin: at(0, 8, 12) },
    { id: 'u-o2', name: 'سعید موسوی', email: 's.mousavi@imamreza-hosp.ir', mobile: '09153456789', role: 'org', subRole: 'org_hr', orgId: 'o1', projectScope: 'all', status: 'active', lastLogin: at(-1, 9, 40) },
    { id: 'u-o3', name: 'نرگس کاظمی', email: 'n.kazemi@imamreza-hosp.ir', mobile: '09154567890', role: 'org', subRole: 'org_requests', orgId: 'o1', projectScope: 'all', status: 'active', lastLogin: at(0, 7, 55) },
    { id: 'u-o4', name: 'کامران زمانی', email: 'k.zamani@mashhad6.ir', mobile: '09155678901', role: 'org', subRole: 'org_admin', orgId: 'o2', projectScope: 'all', status: 'active', lastLogin: at(-3, 11) },
    { id: 'u-c1', name: 'حمید صادقی', email: 'h.sadeghi@parsarman.co', mobile: '09121112233', role: 'company', subRole: 'cmp_admin', companyId: 'c1', projectScope: 'all', status: 'active', lastLogin: at(0, 8, 3) },
    { id: 'u-c2', name: 'مریم حسینی', email: 'm.hosseini@parsarman.co', mobile: '09122223344', role: 'company', subRole: 'cmp_pm', companyId: 'c1', projectScope: ['p1', 'p2'], status: 'active', lastLogin: at(0, 9, 20) },
    { id: 'u-c3', name: 'رضا نوری', email: 'r.nouri@parsarman.co', mobile: '09123334455', role: 'company', subRole: 'cmp_hr', companyId: 'c1', projectScope: 'all', status: 'active', lastLogin: at(-1, 16) },
    { id: 'u-c4', name: 'الهام جعفری', email: 'e.jafari@parsarman.co', mobile: '09124445566', role: 'company', subRole: 'cmp_contracts', companyId: 'c1', projectScope: 'all', status: 'active', lastLogin: at(0, 10, 45) },
    { id: 'u-c5', name: 'مهدی کریمی', email: 'm.karimi@parsarman.co', mobile: '09125556677', role: 'company', subRole: 'cmp_exec', companyId: 'c1', projectScope: ['p1'], status: 'active', lastLogin: at(-2, 13) },
    { id: 'u-c6', name: 'امیر رحیمی', email: 'a.rahimi@parsarman.co', mobile: '09126667788', role: 'company', subRole: 'cmp_pm', companyId: 'c1', projectScope: ['p3', 'p4'], status: 'active', lastLogin: at(-1, 8) },
    { id: 'u-c7', name: 'سمیه طاهری', email: 's.taheri@parsarman.co', mobile: '09127778899', role: 'company', subRole: 'cmp_hr', companyId: 'c1', projectScope: 'all', status: 'invited' },
    { id: 'u-c8', name: 'بابک فرهادی', email: 'b.farhadi@atiehsazan.ir', mobile: '09128889900', role: 'company', subRole: 'cmp_admin', companyId: 'c2', projectScope: 'all', status: 'active', lastLogin: at(-1, 12) },
    { id: 'u-a1', name: 'پریسا یوسفی', email: 'admin@niroo-platform.ir', mobile: '09129990011', role: 'admin', subRole: 'sys_admin', projectScope: 'all', status: 'active', lastLogin: at(0, 7, 30) },
    { id: 'u-a2', name: 'جواد شریفی', email: 'j.sharifi@niroo-platform.ir', mobile: '09120001122', role: 'admin', subRole: 'sys_admin', projectScope: 'all', status: 'inactive', lastLogin: at(-40, 10) },
  ]

  /* ---------------------------------------------------------------- */
  const projects: Project[] = [
    {
      id: 'p1',
      code: 'PRJ-1403-021',
      name: 'خدمات پشتیبانی و نظافت بیمارستان',
      orgId: 'o1',
      companyId: 'c1',
      managerId: 'u-c2',
      teamIds: ['u-c3', 'u-c5'],
      startDate: day(-420),
      endDate: day(310),
      demand: [
        { title: 'نیروی خدماتی', required: 12 },
        { title: 'سرپرست شیفت', required: 2 },
      ],
      mainContractId: 'pc1',
      status: 'running',
      description: 'تأمین نیروی خدماتی، نظافت بخش‌های بستری و سرپرستی شیفت‌ها در سه نوبت کاری.',
    },
    {
      id: 'p2',
      code: 'PRJ-1404-007',
      name: 'تأمین نیروی اداری و پذیرش',
      orgId: 'o1',
      companyId: 'c1',
      managerId: 'u-c2',
      teamIds: ['u-c3', 'u-c4'],
      startDate: day(-200),
      endDate: day(165),
      demand: [
        { title: 'کارشناس خدمات اداری', required: 6 },
        { title: 'کارشناس پذیرش', required: 5 },
        { title: 'اپراتور بایگانی', required: 2 },
      ],
      mainContractId: 'pc2',
      status: 'needs_followup',
      description: 'نیروی پذیرش، بایگانی و امور اداری ساختمان مرکزی بیمارستان.',
    },
    {
      id: 'p3',
      code: 'PRJ-1405-003',
      name: 'خدمات شهری و فضای سبز',
      orgId: 'o2',
      companyId: 'c1',
      managerId: 'u-c6',
      teamIds: ['u-c4'],
      startDate: day(-25),
      endDate: day(340),
      demand: [
        { title: 'کارگر فضای سبز', required: 10 },
        { title: 'راننده', required: 2 },
      ],
      mainContractId: 'pc3',
      // Stored as running, but the main contract is not fully signed → UI derives the real state.
      status: 'running',
      description: 'نگهداری فضای سبز بوستان‌ها و معابر منطقه ۶.',
    },
    {
      id: 'p4',
      code: 'PRJ-1405-011',
      name: 'نگهبانی و انتظامات ساختمان مرکزی',
      orgId: 'o2',
      companyId: 'c1',
      managerId: 'u-c6',
      teamIds: [],
      startDate: day(20),
      endDate: day(385),
      demand: [{ title: 'نگهبان', required: 6 }],
      status: 'planning',
      description: 'تأمین نگهبان برای ساختمان مرکزی شهرداری در شیفت‌های شبانه‌روزی.',
    },
    {
      id: 'p5',
      code: 'PRJ-ATI-1404-02',
      name: 'تأمین نیروی آزمایشگاه',
      orgId: 'o1',
      companyId: 'c2',
      managerId: 'u-c8',
      teamIds: [],
      startDate: day(-150),
      endDate: day(215),
      demand: [{ title: 'کاردان آزمایشگاه', required: 4 }],
      mainContractId: 'pc5',
      status: 'running',
      description: 'کاردان‌های آزمایشگاه تشخیص طبی.',
    },
    {
      id: 'p6',
      code: 'PRJ-1402-014',
      name: 'پشتیبانی رویداد نمایشگاه کتاب',
      orgId: 'o2',
      companyId: 'c1',
      managerId: 'u-c6',
      teamIds: [],
      startDate: day(-600),
      endDate: day(-540),
      demand: [{ title: 'نیروی پشتیبانی', required: 8 }],
      status: 'closed',
      description: 'پروژه کوتاه‌مدت خاتمه‌یافته.',
    },
  ]

  /* ---------------------------------------------------------------- */
  const BANK_CODES = ['017', '012', '018', '019', '056', '057']
  const BANK_NAMES: Record<string, string> = {
    '017': 'بانک ملی ایران',
    '012': 'بانک ملت',
    '018': 'بانک تجارت',
    '019': 'بانک صادرات ایران',
    '056': 'بانک سامان',
    '057': 'بانک پاسارگاد',
  }

  const projectJobs: Record<string, { title: string; unit: string; workplace: string }[]> = {
    p1: [
      { title: 'نیروی خدماتی', unit: 'بخش بستری', workplace: 'بیمارستان امام رضا (ع) — ساختمان بستری' },
      { title: 'سرپرست شیفت', unit: 'خدمات عمومی', workplace: 'بیمارستان امام رضا (ع) — ساختمان بستری' },
    ],
    p2: [
      { title: 'کارشناس خدمات اداری', unit: 'واحد اداری', workplace: 'بیمارستان امام رضا (ع) — ساختمان اداری' },
      { title: 'کارشناس پذیرش', unit: 'پذیرش سرپایی', workplace: 'بیمارستان امام رضا (ع) — درمانگاه' },
      { title: 'اپراتور بایگانی', unit: 'مدارک پزشکی', workplace: 'بیمارستان امام رضا (ع) — ساختمان اداری' },
    ],
    p3: [
      { title: 'کارگر فضای سبز', unit: 'فضای سبز', workplace: 'شهرداری منطقه ۶ — بوستان ملت' },
      { title: 'راننده', unit: 'نقلیه', workplace: 'شهرداری منطقه ۶ — پارکینگ مرکزی' },
    ],
    p5: [{ title: 'کاردان آزمایشگاه', unit: 'آزمایشگاه تشخیص طبی', workplace: 'بیمارستان امام رضا (ع) — آزمایشگاه' }],
  }
  const projectAddress: Record<string, string> = {
    p1: 'مشهد، میدان بیمارستان امام رضا',
    p2: 'مشهد، میدان بیمارستان امام رضا',
    p5: 'مشهد، میدان بیمارستان امام رضا',
    p3: 'مشهد، بلوار سجاد، شهرداری منطقه ۶',
  }

  const employees: Employee[] = []
  const shifts = ['morning', 'evening', 'night', 'rotating']

  function makeEmployee(i: number, override: Partial<Employee> = {}): Employee {
    const female = rng() < 0.45
    const firstName = pick(rng, female ? FIRST_F : FIRST_M)
    const lastName = pick(rng, LAST)
    const projectId = override.projectId ?? pick(rng, ['p1', 'p1', 'p1', 'p2', 'p2', 'p3', 'p3', 'p5'])
    const project = projects.find((p) => p.id === projectId)!
    const job = pick(rng, projectJobs[projectId] ?? projectJobs.p1)
    const bankCode = pick(rng, BANK_CODES)
    const startOffset = -int(rng, 40, 900)
    const contractEndOffset = int(rng, -20, 160)
    const status = override.employmentStatus ?? (rng() < 0.06 ? 'suspended' : rng() < 0.05 ? 'pending_start' : 'active')
    return {
      id: `e${i}`,
      personnelNo: `${project.companyId === 'c1' ? 'PA' : 'AT'}-${String(10230 + i * 7)}`,
      firstName,
      lastName,
      nationalId: nationalId(rng),
      mobile: mobile(rng),
      birthDate: day(-int(rng, 22 * 365, 52 * 365)),
      maritalStatus: rng() < 0.6 ? 'married' : 'single',
      address: pick(rng, ['مشهد، بلوار وکیل‌آباد، کوچه ۱۲، پلاک ۸', 'مشهد، بلوار سجاد، خیابان بهار ۴، پلاک ۲۱', 'مشهد، خیابان احمدآباد، کوچه ۹، پلاک ۳', 'مشهد، قاسم‌آباد، بلوار شریعتی، پلاک ۴۰']),
      postalCode: String(int(rng, 9100000000, 9199999999)),
      photoColor: pick(rng, AVATAR_COLORS),
      jobTitle: job.title,
      unit: job.unit,
      companyId: project.companyId,
      orgId: project.orgId,
      projectId,
      workplace: job.workplace,
      workplaceAddress: projectAddress[projectId] ?? '',
      startDate: day(startOffset),
      contractType: 'قرارداد کار موقت (ماهانه)',
      contractStart: day(contractEndOffset - 365),
      contractEnd: day(contractEndOffset),
      shift: pick(rng, shifts),
      supervisor: pick(rng, ['محسن قاسمی', 'لیلا عباسی', 'یاسر هاشمی']),
      employmentStatus: status,
      children: [],
      bankAccounts: [
        {
          id: `ba-${i}`,
          bank: BANK_NAMES[bankCode],
          sheba: sheba(rng, bankCode),
          holder: `${firstName} ${lastName}`,
          verified: true,
          activeForPayroll: true,
        },
      ],
      changeLog: [],
      leaveBalanceDays: int(rng, 2, 24),
      assignments: [{ id: `as-${i}`, projectId, from: day(startOffset) }],
      ...override,
    }
  }

  // Demo employee — matches the PRD dashboard example ("علی عزیز")
  const e1 = makeEmployee(1, {
    firstName: 'علی',
    lastName: 'رضایی',
    nationalId: '0012345679',
    mobile: '09121234567',
    email: 'ali.rezaei@example.com',
    birthDate: '1992-05-14',
    maritalStatus: 'married',
    address: 'مشهد، بلوار وکیل‌آباد، وکیل‌آباد ۲۴، کوچه نسترن ۳، پلاک ۱۶، واحد ۴',
    postalCode: '9188765431',
    photoColor: '#244378',
    jobTitle: 'کارشناس خدمات اداری',
    unit: 'واحد اداری',
    companyId: 'c1',
    orgId: 'o1',
    projectId: 'p2',
    workplace: 'بیمارستان امام رضا (ع) — ساختمان اداری',
    workplaceAddress: 'مشهد، میدان بیمارستان امام رضا، ساختمان اداری، طبقه دوم',
    startDate: day(-640),
    contractStart: day(-310),
    contractEnd: day(55),
    shift: 'morning',
    supervisor: 'لیلا عباسی',
    employmentStatus: 'active',
    leaveBalanceDays: 11,
    personnelNo: 'PA-10237',
    children: [{ id: 'ch1', fullName: 'نیکا رضایی', birthDate: '2021-03-02', relation: 'daughter' }],
    bankAccounts: [
      { id: 'ba-1', bank: 'بانک ملت', sheba: 'IR820120000000004561237890', holder: 'علی رضایی', verified: true, activeForPayroll: true },
    ],
    assignments: [
      { id: 'as-1a', projectId: 'p1', from: day(-640), to: day(-201), note: 'انتقال به پروژه اداری' },
      { id: 'as-1b', projectId: 'p2', from: day(-200) },
    ],
    changeLog: [
      { id: 'cl1', at: at(-201, 11), by: 'رضا نوری', field: 'پروژه', before: 'خدمات پشتیبانی و نظافت بیمارستان', after: 'تأمین نیروی اداری و پذیرش', source: 'inline' },
      { id: 'cl2', at: at(-201, 11, 5), by: 'رضا نوری', field: 'سمت شغلی', before: 'نیروی خدماتی', after: 'کارشناس خدمات اداری', source: 'inline' },
    ],
  })
  // Recompute the sample IBAN check digits so it validates
  e1.bankAccounts[0].sheba = sheba(seededRandom(7), '012')
  employees.push(e1)
  for (let i = 2; i <= 46; i += 1) employees.push(makeEmployee(i))
  // A few edge cases for the management tables
  employees[5].employmentStatus = 'terminated'
  employees[5].projectId = null
  employees[5].assignments[0].to = day(-30)
  employees[9].employmentStatus = 'pending_start'

  /* ---------------------------------------------------------------- */
  const requestTypes = structuredClone(DEFAULT_REQUEST_TYPES)
  const typeById = (id: string) => requestTypes.find((t) => t.id === id)!

  const requests: EmployeeRequest[] = []
  let reqSeq = 1200

  function buildSteps(typeId: string, status: RequestStatus, decider: string, decidedAt: string): { steps: RequestStep[]; current: number } {
    const t = typeById(typeId)
    const steps: RequestStep[] = t.workflow.map((w) => ({ party: w.party, label: w.label, status: 'waiting' }))
    if (status === 'draft' || status === 'cancelled') return { steps, current: 0 }
    if (status === 'submitted') {
      steps[0].status = 'active'
      return { steps, current: 0 }
    }
    if (status === 'in_review') {
      const cur = steps.length > 1 && rng() < 0.5 ? 1 : 0
      for (let i = 0; i < cur; i += 1) Object.assign(steps[i], { status: 'approved', decidedBy: decider, decidedAt })
      steps[cur].status = 'active'
      return { steps, current: cur }
    }
    if (status === 'needs_correction') {
      steps[0].status = 'returned'
      steps[0].decidedBy = decider
      steps[0].decidedAt = decidedAt
      return { steps, current: 0 }
    }
    if (status === 'rejected') {
      steps[0].status = 'rejected'
      steps[0].decidedBy = decider
      steps[0].decidedAt = decidedAt
      return { steps, current: 0 }
    }
    // approved / executed
    steps.forEach((s) => Object.assign(s, { status: 'approved', decidedBy: decider, decidedAt }))
    return { steps, current: steps.length - 1 }
  }

  function addRequest(r: {
    employeeId: string
    typeId: string
    status: RequestStatus
    daysAgo: number
    values: Record<string, unknown>
    correctionNote?: string
    rejectionReason?: string
    execution?: string
    assignee?: string
    messages?: EmployeeRequest['messages']
    internalNotes?: EmployeeRequest['internalNotes']
    attachments?: EmployeeRequest['attachments']
    confidential?: boolean
  }) {
    reqSeq += int(rng, 3, 17)
    const t = typeById(r.typeId)
    const emp = employees.find((e) => e.id === r.employeeId)!
    const empName = `${emp.firstName} ${emp.lastName}`
    const created = at(-r.daysAgo, int(rng, 8, 16), int(rng, 0, 59))
    const decidedAt = at(-r.daysAgo + Math.min(2, Math.max(0, r.daysAgo - 1)), 12, 10)
    const decider = t.workflow[0].party === 'org' ? 'نرگس کاظمی' : 'رضا نوری'
    const { steps, current } = buildSteps(r.typeId, r.status, decider, decidedAt)
    const history: EmployeeRequest['history'] = [{ id: `h${reqSeq}a`, at: created, actor: empName, actorRole: 'employee', kind: 'created' }]
    if (r.status !== 'draft') {
      history.push({ id: `h${reqSeq}b`, at: created, actor: empName, actorRole: 'employee', kind: 'submitted' })
      history.push({
        id: `h${reqSeq}c`,
        at: created,
        actor: 'سامانه',
        actorRole: 'system',
        kind: 'assigned',
        note: `ارجاع خودکار به ${t.workflow[0].label}`,
      })
    }
    steps.forEach((s, i) => {
      if (s.status === 'approved') {
        history.push({
          id: `h${reqSeq}s${i}`,
          at: s.decidedAt!,
          actor: s.decidedBy!,
          actorRole: s.party,
          kind: i === steps.length - 1 ? 'approved' : 'step_approved',
          note: i === steps.length - 1 ? 'درخواست تأیید شد.' : `تأیید مرحله «${s.label}»`,
        })
      }
    })
    if (r.status === 'needs_correction')
      history.push({ id: `h${reqSeq}r`, at: decidedAt, actor: decider, actorRole: t.workflow[0].party, kind: 'returned', note: r.correctionNote })
    if (r.status === 'rejected')
      history.push({ id: `h${reqSeq}x`, at: decidedAt, actor: decider, actorRole: t.workflow[0].party, kind: 'rejected', note: r.rejectionReason })
    if (r.status === 'cancelled')
      history.push({ id: `h${reqSeq}l`, at: at(-r.daysAgo, 17), actor: empName, actorRole: 'employee', kind: 'cancelled', note: 'لغو توسط درخواست‌دهنده' })
    let execution: EmployeeRequest['execution']
    if (r.status === 'executed') {
      execution = { at: at(-r.daysAgo + 3, 11), by: 'واحد مالی شرکت', note: r.execution ?? 'اقدام نهایی ثبت شد.' }
      history.push({ id: `h${reqSeq}e`, at: execution.at, actor: execution.by, actorRole: 'company', kind: 'executed', note: execution.note })
    }
    const open = ['submitted', 'in_review', 'needs_correction'].includes(r.status)
    requests.push({
      id: `r${reqSeq}`,
      trackingNo: `${today.jy}${String(reqSeq).padStart(5, '0')}`,
      typeId: r.typeId,
      employeeId: r.employeeId,
      status: r.status,
      createdAt: created,
      submittedAt: r.status === 'draft' ? undefined : created,
      updatedAt: history[history.length - 1].at,
      finalizedAt: ['approved', 'rejected', 'executed', 'cancelled'].includes(r.status) ? history[history.length - 1].at : undefined,
      values: r.values,
      attachments: r.attachments ?? [],
      steps,
      currentStep: current,
      assignee: open ? r.assignee ?? (steps[current]?.party === 'org' ? 'نرگس کاظمی' : 'رضا نوری') : undefined,
      dueAt: open ? at(-r.daysAgo + t.slaDays, 16) : undefined,
      history,
      messages: r.messages ?? [],
      internalNotes: r.internalNotes ?? [],
      correctionNote: r.correctionNote,
      rejectionReason: r.rejectionReason,
      execution,
      confidential: r.confidential,
    })
  }

  const prev = shiftJalaliMonth(today.jy, today.jm, -1)
  const prev2 = shiftJalaliMonth(today.jy, today.jm, -2)
  const monthVal = (m: { jy: number; jm: number }) => `${m.jy}-${String(m.jm).padStart(2, '0')}`

  // --- Demo employee's requests (one per meaningful state) ---
  addRequest({
    employeeId: 'e1',
    typeId: 'leave_daily',
    status: 'in_review',
    daysAgo: 1,
    values: { leaveKind: 'entitled', startDate: day(6), endDate: day(7), days: 2, substitute: 'هماهنگ‌شده با خانم شریفی', description: 'سفر خانوادگی' },
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'bank_change',
    status: 'needs_correction',
    daysAgo: 4,
    values: { sheba: sheba(seededRandom(99), '056'), bank: 'بانک سامان', holder: 'علی رضایی', description: '' },
    correctionNote: 'تصویر کارت بانکی خوانا نیست و نام صاحب حساب دیده نمی‌شود. لطفاً گواهی شبا یا تصویر واضح کارت را بارگذاری کنید.',
    attachments: [{ id: 'att1', name: 'bank-card.jpg', size: 412_000, mime: 'image/jpeg', uploadedAt: at(-4, 9) }],
    messages: [
      { id: 'm1', at: at(-3, 10, 20), author: 'رضا نوری', authorRole: 'company', text: 'تصویر کارت بانکی خوانا نیست و نام صاحب حساب دیده نمی‌شود. لطفاً گواهی شبا یا تصویر واضح کارت را بارگذاری کنید.' },
    ],
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'advance',
    status: 'approved',
    daysAgo: 6,
    values: { amount: 150_000_000, month: monthVal(today), account: 'ba-1', terms: true, description: 'هزینه درمان' },
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'advance',
    status: 'executed',
    daysAgo: 38,
    values: { amount: 100_000_000, month: monthVal(prev), account: 'ba-1', terms: true },
    execution: 'مبلغ ۱۰۰٬۰۰۰٬۰۰۰ ریال به حساب ملت شما واریز شد. شماره پیگیری بانکی ۷۷۴۱۲۰۹۸',
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'payslip_objection',
    status: 'submitted',
    daysAgo: 0,
    values: { month: monthVal(prev), subject: 'overtime', amount: 8_400_000, description: '۱۲ ساعت اضافه‌کاری شیفت عصر روزهای ۱۸ و ۱۹ در فیش لحاظ نشده است.' },
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'certificate',
    status: 'rejected',
    daysAgo: 21,
    values: { certKind: 'history', language: 'en', recipient: 'سفارت', copies: 1 },
    rejectionReason: 'صدور گواهی سابقه کار به زبان انگلیسی فقط برای سوابق بیش از دو سال امکان‌پذیر است. می‌توانید گواهی فارسی درخواست کنید.',
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'leave_hourly',
    status: 'cancelled',
    daysAgo: 15,
    values: { date: day(-14), startTime: '10:00', endTime: '12:00', hours: 2, reason: 'admin' },
  })
  addRequest({
    employeeId: 'e1',
    typeId: 'general',
    status: 'draft',
    daysAgo: 2,
    values: { topic: 'problem', title: 'خرابی کارت تردد', description: 'کارت تردد من از هفته گذشته' },
  })

  // --- Other employees' requests for the review queues ---
  const otherTypes = ['leave_daily', 'leave_hourly', 'leave_sick', 'advance', 'payslip_objection', 'bank_change', 'workplace_change', 'certificate', 'marital_change', 'equipment', 'attendance_fix', 'insurance_followup', 'safety_incident']
  const otherStatuses: RequestStatus[] = ['submitted', 'submitted', 'in_review', 'in_review', 'in_review', 'needs_correction', 'approved', 'executed', 'rejected']
  for (let i = 0; i < 34; i += 1) {
    const emp = employees[int(rng, 1, employees.length - 1)]
    if (emp.employmentStatus === 'terminated') continue
    const typeId = pick(rng, otherTypes)
    const status = pick(rng, otherStatuses)
    const values: Record<string, unknown> = { description: pick(rng, ['', 'لطفاً بررسی شود.', 'با سرپرست هماهنگ شده است.']) }
    if (typeId.startsWith('leave_') && typeId !== 'leave_hourly') Object.assign(values, { leaveKind: 'entitled', startDate: day(int(rng, -5, 12)), endDate: day(int(rng, 13, 16)), days: int(rng, 1, 4) })
    if (typeId === 'leave_hourly') Object.assign(values, { date: day(int(rng, 0, 6)), startTime: '09:00', endTime: '11:30', hours: 2.5, reason: 'medical' })
    if (typeId === 'advance') Object.assign(values, { amount: int(rng, 3, 20) * 10_000_000, month: monthVal(today), account: emp.bankAccounts[0].id, terms: true })
    if (typeId === 'payslip_objection') Object.assign(values, { month: monthVal(prev2), subject: pick(rng, ['overtime', 'deductions', 'base']), description: 'مبلغ اضافه‌کاری کمتر از کارکرد ثبت‌شده است.' })
    if (typeId === 'workplace_change') Object.assign(values, { changeKind: 'shift', proposedShift: 'morning', effectiveDate: day(20), reason: 'ادامه تحصیل' })
    if (typeId === 'certificate') Object.assign(values, { certKind: 'employment', language: 'fa', recipient: 'بانک ملی' })
    if (typeId === 'equipment') Object.assign(values, { item: 'لباس کار زمستانی', quantity: 2, description: 'لباس فعلی فرسوده شده است.' })
    if (typeId === 'bank_change') Object.assign(values, { sheba: sheba(rng, '017'), bank: 'بانک ملی ایران', holder: `${emp.firstName} ${emp.lastName}` })
    if (typeId === 'marital_change') Object.assign(values, { newStatus: 'married', changeDate: day(-20) })
    if (typeId === 'attendance_fix') Object.assign(values, { date: day(-3), fixKind: 'missing_out', endTime: '16:10', description: 'دستگاه حضور و غیاب خاموش بود.' })
    if (typeId === 'insurance_followup') Object.assign(values, { issue: 'missing', fromMonth: monthVal(prev2), description: 'سابقه ماه گذشته در سامانه تأمین اجتماعی ثبت نشده است.' })
    if (typeId === 'safety_incident') Object.assign(values, { date: day(-1), location: 'انبار طبقه منفی یک', description: 'نشت آب و لغزندگی کف' })
    addRequest({
      employeeId: emp.id,
      typeId,
      status,
      daysAgo: int(rng, 0, 12),
      values,
      correctionNote: status === 'needs_correction' ? 'مدرک پیوست ناقص است؛ لطفاً تصویر کامل را ارسال کنید.' : undefined,
      rejectionReason: status === 'rejected' ? 'با توجه به برنامه شیفت بخش، امکان موافقت در این بازه وجود ندارد.' : undefined,
      attachments:
        typeId === 'leave_sick'
          ? [{ id: `att-s${i}`, name: 'medical-certificate.pdf', size: 288_000, mime: 'application/pdf', uploadedAt: at(-1, 9) }]
          : [],
      internalNotes:
        i % 5 === 0
          ? [{ id: `in${i}`, at: at(-1, 15), author: 'رضا نوری', authorRole: 'company', text: 'سابقه درخواست مشابه در ماه قبل بررسی شود.' }]
          : [],
    })
  }

  /* ---------------------------------------------------------------- */
  const contracts: Contract[] = []
  const hash = () => Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0') + Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0')

  function monthRange(jy: number, jm: number) {
    return { start: jalaliToISO(jy, jm, 1), end: jalaliToISO(jy, jm, jalaliMonthLength(jy, jm)) }
  }

  function salaryFor(emp: Employee) {
    const base = emp.jobTitle.includes('سرپرست') ? 168_000_000 : emp.jobTitle.includes('کارشناس') ? 152_000_000 : 128_000_000
    return [
      { label: 'حقوق پایه', amount: base },
      { label: 'حق مسکن', amount: 9_000_000 },
      { label: 'بن کارگری', amount: 22_000_000 },
      { label: 'حق اولاد', amount: emp.children.length * 13_000_000 },
    ]
  }

  function addWorkerContract(emp: Employee, offset: number, stage: ContractStage, extras: Partial<Contract> = {}) {
    const p = shiftJalaliMonth(today.jy, today.jm, offset)
    const { start, end } = monthRange(p.jy, p.jm)
    const project = projects.find((x) => x.id === emp.projectId) ?? projects[0]
    const company = companies.find((c) => c.id === emp.companyId)!
    const signedWorker = ['awaiting_other', 'partially_signed', 'completed'].includes(stage)
    const signedCompany = stage === 'completed' || stage === 'partially_signed'
    const number = `CT-${p.jy}${String(p.jm).padStart(2, '0')}-${emp.personnelNo.slice(3)}`
    const versionHash = hash()
    const sentAt = at(offset * 30 - 2, 9)
    const c: Contract = {
      id: `ct-${emp.id}-${p.jy}${p.jm}`,
      number,
      kind: 'worker',
      title: `قرارداد ماهانه ${emp.firstName} ${emp.lastName}`,
      employeeId: emp.id,
      companyId: emp.companyId,
      orgId: emp.orgId,
      projectId: project.id,
      periodYear: p.jy,
      periodMonth: p.jm,
      jobTitle: emp.jobTitle,
      workplace: emp.workplace,
      startDate: start,
      endDate: end,
      stage,
      parties: [
        { role: 'worker', name: `${emp.firstName} ${emp.lastName}`, required: true, signedAt: signedWorker ? at(offset * 30 - 1, 11) : undefined },
        { role: 'company', name: company.name, required: true, signedAt: signedCompany ? at(offset * 30, 10) : undefined, signedBy: signedCompany ? 'حمید صادقی' : undefined },
      ],
      signDeadline: ['awaiting_worker', 'awaiting_other', 'partially_signed', 'ready_to_send'].includes(stage) ? day(offset * 30 + int(rng, 1, 6)) : undefined,
      versionHash,
      version: 1,
      employeeSignature: signedWorker
        ? { signedAt: at(offset * 30 - 1, 11), receiptNo: `SG-${number.slice(3)}`, method: 'sms_otp', mobile: emp.mobile, versionHash }
        : undefined,
      viewedAt: signedWorker ? at(offset * 30 - 1, 10, 40) : undefined,
      salary: salaryFor(emp).filter((s) => s.amount > 0),
      workHours: '۴۴ ساعت در هفته؛ شنبه تا چهارشنبه ۷ تا ۱۴:۳۰ و پنجشنبه ۷ تا ۱۲',
      history: [
        { id: hash(), at: at(offset * 30 - 5, 9), actor: 'الهام جعفری', text: 'پیش‌نویس قرارداد ایجاد شد.' },
        ...(stage !== 'draft' ? [{ id: hash(), at: at(offset * 30 - 4, 12), actor: 'رضا نوری', text: 'بررسی شرکت انجام شد.' }] : []),
        ...(['awaiting_worker', 'awaiting_other', 'partially_signed', 'completed'].includes(stage)
          ? [{ id: hash(), at: sentAt, actor: 'الهام جعفری', text: 'قرارداد برای امضای نیروی کار ارسال شد.' }]
          : []),
        ...(signedWorker ? [{ id: hash(), at: at(offset * 30 - 1, 11), actor: `${emp.firstName} ${emp.lastName}`, text: 'امضای نیروی کار با کد پیامکی ثبت شد.' }] : []),
        ...(signedCompany ? [{ id: hash(), at: at(offset * 30, 10), actor: 'حمید صادقی', text: 'امضای شرکت ثبت شد.' }] : []),
      ],
      ...extras,
    }
    contracts.push(c)
    return c
  }

  // Demo employee: current month awaiting signature, previous months completed
  addWorkerContract(e1, 0, 'awaiting_worker', { signDeadline: day(3) })
  for (let k = -1; k >= -6; k -= 1) addWorkerContract(e1, k, 'completed')
  // An older superseded version to show versioning
  const superseded = addWorkerContract(e1, -2, 'superseded')
  superseded.id = superseded.id + '-v0'
  superseded.number = superseded.number + '-R0'
  superseded.version = 0
  superseded.history.push({ id: hash(), at: at(-62, 9), actor: 'الهام جعفری', text: 'به‌دلیل اصلاح حق اولاد، نسخه جدید جایگزین شد.' })

  const workerStages: ContractStage[] = ['awaiting_worker', 'awaiting_worker', 'awaiting_other', 'completed', 'completed', 'completed', 'ready_to_send', 'company_review', 'draft', 'partially_signed', 'org_review']
  employees.slice(1).forEach((emp) => {
    if (emp.employmentStatus === 'terminated') return
    addWorkerContract(emp, 0, pick(rng, workerStages))
    addWorkerContract(emp, -1, 'completed')
  })

  // Project (main) contracts — company ⇄ organisation
  const projectContract = (id: string, projectId: string, stage: ContractStage, start: string, end: string, value: number, signDeadline?: string): Contract => {
    const project = projects.find((p) => p.id === projectId)!
    const company = companies.find((c) => c.id === project.companyId)!
    const org = organizations.find((o) => o.id === project.orgId)!
    const companySigned = ['awaiting_other', 'partially_signed', 'completed'].includes(stage)
    const orgSigned = stage === 'completed'
    return {
      id,
      number: `PC-${project.code.slice(4)}`,
      kind: 'project',
      title: `قرارداد اصلی ${project.name}`,
      companyId: company.id,
      orgId: org.id,
      projectId,
      startDate: start,
      endDate: end,
      stage,
      parties: [
        { role: 'company', name: company.name, required: true, signedAt: companySigned ? at(-30, 10) : undefined, signedBy: companySigned ? 'حمید صادقی' : undefined },
        { role: 'org', name: org.name, required: true, signedAt: orgSigned ? at(-28, 12) : undefined, signedBy: orgSigned ? org.contactName : undefined },
      ],
      signDeadline,
      versionHash: hash(),
      version: 1,
      value,
      history: [
        { id: hash(), at: at(-45, 9), actor: 'الهام جعفری', text: 'پیش‌نویس قرارداد پروژه ایجاد شد.' },
        ...(companySigned ? [{ id: hash(), at: at(-30, 10), actor: 'حمید صادقی', text: 'امضای شرکت ثبت شد.' }] : []),
        ...(orgSigned ? [{ id: hash(), at: at(-28, 12), actor: org.contactName, text: 'امضای سازمان ثبت شد.' }] : []),
      ],
    }
  }
  contracts.push(
    projectContract('pc1', 'p1', 'completed', projects[0].startDate, projects[0].endDate, 48_600_000_000),
    projectContract('pc2', 'p2', 'completed', projects[1].startDate, day(24), 31_200_000_000),
    projectContract('pc3', 'p3', 'partially_signed', projects[2].startDate, projects[2].endDate, 27_500_000_000, day(2)),
    projectContract('pc4', 'p4', 'org_review', projects[3].startDate, projects[3].endDate, 15_800_000_000, day(12)),
    projectContract('pc5', 'p5', 'completed', projects[4].startDate, projects[4].endDate, 9_400_000_000),
    projectContract('pc6', 'p6', 'completed', projects[5].startDate, projects[5].endDate, 2_100_000_000),
  )
  projects[3].mainContractId = 'pc4'
  projects[5].mainContractId = 'pc6'

  /* ---------------------------------------------------------------- */
  const payslips: Payslip[] = []
  function makePayslip(emp: Employee, offset: number): Payslip {
    const p = shiftJalaliMonth(today.jy, today.jm, offset)
    const base = salaryFor(emp)
    const overtimeHours = int(rng, 0, 28)
    const overtime = overtimeHours * 1_450_000
    const shiftPay = emp.shift === 'night' || emp.shift === 'rotating' ? 14_000_000 : 0
    const earnings = [
      { label: 'حقوق پایه', amount: base[0].amount },
      { label: 'مزایای شغلی', amount: 12_500_000 },
      { label: 'اضافه‌کاری', amount: overtime, note: `${overtimeHours} ساعت` },
      { label: 'حق شیفت یا نوبت‌کاری', amount: shiftPay },
      { label: 'حق مسکن', amount: 9_000_000 },
      { label: 'بن کارگری', amount: 22_000_000 },
      { label: 'حق اولاد', amount: emp.children.length * 13_000_000 },
    ].filter((x) => x.amount > 0)
    const gross = earnings.reduce((a, b) => a + b.amount, 0)
    const deductions = [
      { label: 'بیمه سهم کارمند (۷٪)', amount: Math.round(gross * 0.07) },
      { label: 'مالیات حقوق', amount: Math.max(0, Math.round((gross - 240_000_000) * 0.1)) },
      ...(emp.id === 'e1' && offset === -1 ? [{ label: 'مساعده تسویه‌شده', amount: 100_000_000 }] : []),
    ].filter((x) => x.amount > 0)
    return {
      id: `ps-${emp.id}-${p.jy}${String(p.jm).padStart(2, '0')}`,
      employeeId: emp.id,
      year: p.jy,
      month: p.jm,
      status: 'final',
      version: 1,
      earnings,
      deductions,
      workDays: jalaliMonthLength(p.jy, p.jm) - int(rng, 0, 2),
      overtimeHours,
      issuedAt: at(offset * 30 + 3, 10),
      payment: { status: 'paid', paidAt: at(offset * 30 + 5, 9), reference: String(int(rng, 10000000, 99999999)) },
    }
  }
  for (let k = -1; k >= -14; k -= 1) payslips.push(makePayslip(e1, k))
  // Latest payslip: issued, payment still processing (issued ≠ paid)
  payslips[0].payment = { status: 'processing' }
  payslips[0].issuedAt = at(-3, 10)
  // Corrected payslip with previous version
  const corrected = payslips[1]
  const original = structuredClone(corrected)
  original.earnings = original.earnings.filter((x) => x.label !== 'اضافه‌کاری')
  corrected.status = 'corrected'
  corrected.version = 2
  corrected.correctedAt = at(-40, 14)
  corrected.correctionNote = 'اضافه‌کاری ثبت‌نشده در نسخه اول، پس از بررسی اعتراض اضافه شد.'
  corrected.previous = [{ ...original, status: 'final', version: 1 }]
  // An old payslip whose payment info is not available from the payment system
  payslips[payslips.length - 1].payment = null
  employees.slice(1, 12).forEach((emp) => payslips.push(makePayslip(emp, -1)))

  /* ---------------------------------------------------------------- */
  const documents: PersonnelDocument[] = []
  let receipt = 5100
  function ver(v: Partial<DocVersion> & { status: DocVersion['status'] }, daysAgo: number, fileName: string, by: string): DocVersion {
    receipt += 1
    return {
      version: 1,
      fileName,
      size: int(rng, 180_000, 2_400_000),
      mime: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      uploadedAt: at(-daysAgo, int(rng, 8, 18)),
      uploadedBy: by,
      receiptNo: `DR-${receipt}`,
      ...v,
    }
  }
  const e1Name = 'علی رضایی'
  documents.push(
    { id: 'd1', employeeId: 'e1', typeId: 'national_card', versions: [ver({ status: 'approved', reviewer: 'رضا نوری', reviewedAt: at(-630, 11) }, 635, 'national-card.jpg', e1Name)] },
    { id: 'd2', employeeId: 'e1', typeId: 'birth_cert', versions: [ver({ status: 'approved', reviewer: 'رضا نوری', reviewedAt: at(-630, 11) }, 635, 'shenasnameh.pdf', e1Name)] },
    { id: 'd3', employeeId: 'e1', typeId: 'photo', versions: [ver({ status: 'approved', reviewer: 'رضا نوری', reviewedAt: at(-300, 11) }, 302, 'photo-3x4.jpg', e1Name)] },
    {
      id: 'd4',
      employeeId: 'e1',
      typeId: 'degree',
      versions: [
        ver({ status: 'rejected', reviewer: 'رضا نوری', reviewedAt: at(-20, 10), reasonCode: 'unreadable', reason: 'تصویر خوانا نیست' }, 22, 'degree.jpg', e1Name),
        {
          ...ver(
            {
              status: 'needs_fix',
              reviewer: 'رضا نوری',
              reviewedAt: at(-2, 13),
              reasonCode: 'incomplete',
              reason: 'پشت مدرک (مهر تأیید دانشگاه) ارسال نشده است. هر دو روی مدرک را در یک فایل PDF ارسال کنید.',
              fixDeadline: day(5),
            },
            5,
            'degree-scan.pdf',
            e1Name,
          ),
          version: 2,
        },
      ],
    },
    { id: 'd5', employeeId: 'e1', typeId: 'bank_proof', versions: [ver({ status: 'pending' }, 1, 'sheba-certificate.pdf', e1Name)] },
    {
      id: 'd6',
      employeeId: 'e1',
      typeId: 'no_criminal',
      expiresAt: day(18),
      versions: [ver({ status: 'approved', reviewer: 'سعید موسوی', reviewedAt: at(-160, 9) }, 165, 'soo-pishineh.pdf', e1Name)],
    },
    {
      id: 'd7',
      employeeId: 'e1',
      typeId: 'marriage_cert',
      versions: [ver({ status: 'approved', reviewer: 'رضا نوری', reviewedAt: at(-500, 9) }, 505, 'marriage.pdf', e1Name)],
    },
  )
  // Other employees: a spread of review states for the management review queue
  let docSeq = 10
  employees.slice(1).forEach((emp) => {
    const name = `${emp.firstName} ${emp.lastName}`
    DOC_TYPES.filter((d) => d.required).forEach((dt) => {
      const r = rng()
      if (r < 0.03) return // not submitted → incomplete
      docSeq += 1
      const status: DocVersion['status'] = r < 0.8 ? 'approved' : r < 0.9 ? 'pending' : r < 0.96 ? 'needs_fix' : 'rejected'
      const reviewer = dt.reviewParty === 'org' ? 'سعید موسوی' : 'رضا نوری'
      documents.push({
        id: `d${docSeq}`,
        employeeId: emp.id,
        typeId: dt.id,
        expiresAt: dt.hasExpiry ? day(int(rng, -10, 200)) : undefined,
        versions: [
          ver(
            status === 'pending'
              ? { status }
              : {
                  status,
                  reviewer,
                  reviewedAt: at(-int(rng, 1, 30), 11),
                  reasonCode: status === 'approved' ? undefined : 'unreadable',
                  reason: status === 'approved' ? undefined : 'تصویر خوانا نیست',
                  fixDeadline: status === 'needs_fix' ? day(int(rng, 1, 7)) : undefined,
                },
            int(rng, 0, 40),
            `${dt.id}.${dt.accept.includes('application/pdf') && rng() < 0.5 ? 'pdf' : 'jpg'}`,
            name,
          ),
        ],
      })
    })
  })

  /* ---------------------------------------------------------------- */
  const orgFiles: OrgFile[] = [
    { id: 'f1', owner: 'org', ownerId: 'o1', title: 'معرفی‌نامه نیروهای جدید پذیرش', docType: 'معرفی‌نامه', projectId: 'p2', description: 'معرفی ۳ نیروی پذیرش برای شروع از ابتدای ماه', date: day(-6), access: 'shared', reviewStatus: 'approved', fileName: 'moarefi-paziresh.pdf', size: 312_000, uploadedBy: 'فرزانه احمدی' },
    { id: 'f2', owner: 'org', ownerId: 'o1', title: 'دستورالعمل ایمنی بخش‌های بستری', docType: 'مجوز سازمانی', projectId: 'p1', description: 'نسخه بازنگری‌شده دستورالعمل', date: day(-20), access: 'shared', reviewStatus: 'none', fileName: 'safety-guideline.pdf', size: 1_820_000, uploadedBy: 'سعید موسوی' },
    { id: 'f3', owner: 'org', ownerId: 'o1', title: 'صورت‌جلسه ارزیابی عملکرد فصل تابستان', docType: 'مکاتبه', projectId: 'p1', description: '', date: day(-12), access: 'internal', reviewStatus: 'none', fileName: 'arzyabi-tabestan.pdf', size: 640_000, uploadedBy: 'فرزانه احمدی' },
    { id: 'f4', owner: 'company', ownerId: 'c1', title: 'ضمانت‌نامه حسن انجام کار', docType: 'مستندات قرارداد', projectId: 'p1', description: 'ضمانت‌نامه بانکی پروژه نظافت', date: day(-400), access: 'shared', reviewStatus: 'approved', fileName: 'zemanatname.pdf', size: 520_000, uploadedBy: 'حمید صادقی' },
    { id: 'f5', owner: 'company', ownerId: 'c1', title: 'فهرست بیمه نیروهای پروژه اداری', docType: 'فایل پروژه', projectId: 'p2', description: 'لیست بیمه ماه گذشته', date: day(-8), access: 'shared', reviewStatus: 'pending', fileName: 'list-bimeh.pdf', size: 210_000, uploadedBy: 'رضا نوری' },
    { id: 'f6', owner: 'company', ownerId: 'c1', title: 'برنامه شیفت ماه جاری', docType: 'فایل پروژه', projectId: 'p1', description: '', date: day(-2), access: 'shared', reviewStatus: 'none', fileName: 'shift-plan.pdf', size: 150_000, uploadedBy: 'مریم حسینی' },
    { id: 'f7', owner: 'company', ownerId: 'c1', title: 'پیش‌نویس قرارداد نگهبانی', docType: 'مستندات قرارداد', projectId: 'p4', description: 'ارسال‌شده برای بررسی سازمان', date: day(-3), access: 'restricted', reviewStatus: 'pending', fileName: 'draft-negahbani.pdf', size: 380_000, uploadedBy: 'الهام جعفری' },
  ]

  /* ---------------------------------------------------------------- */
  const tasks: Task[] = []
  let taskSeq = 300
  const addTask = (t: Partial<Task> & Pick<Task, 'title' | 'assigneeId' | 'dueAt' | 'priority' | 'status' | 'kind'>) => {
    taskSeq += 1
    tasks.push({
      id: `t${taskSeq}`,
      scope: 'company',
      scopeId: 'c1',
      createdBy: t.kind === 'manual' ? 'حمید صادقی' : 'سامانه',
      createdAt: at(-int(rng, 1, 10), 9),
      comments: [],
      history: [{ id: `th${taskSeq}`, at: at(-int(rng, 1, 10), 9), actor: t.kind === 'manual' ? 'حمید صادقی' : 'سامانه', text: 'وظیفه ایجاد شد.' }],
      ...t,
    })
  }
  const awaitingWorker = contracts.filter((c) => c.kind === 'worker' && c.stage === 'awaiting_worker' && c.companyId === 'c1').slice(0, 4)
  awaitingWorker.forEach((c, i) =>
    addTask({
      title: `پیگیری تکمیل امضای ${c.title.replace('قرارداد ماهانه ', '')}`,
      kind: 'system',
      ruleId: 'contract_sent',
      link: { type: 'contract', id: c.id, label: c.number },
      projectId: c.projectId,
      assigneeId: 'u-c4',
      dueAt: c.signDeadline ?? day(3),
      priority: i === 0 ? 'high' : 'medium',
      status: 'todo',
    }),
  )
  addTask({
    title: 'پیگیری امضای سازمان برای قرارداد خدمات شهری',
    kind: 'automatic',
    ruleId: 'sign_deadline',
    link: { type: 'contract', id: 'pc3', label: 'PC-1405-003' },
    projectId: 'p3',
    assigneeId: 'u-c6',
    dueAt: day(2),
    priority: 'urgent',
    status: 'in_progress',
  })
  addTask({
    title: 'بررسی تمدید یا خاتمه قرارداد پروژه اداری',
    kind: 'automatic',
    ruleId: 'contract_near_end',
    link: { type: 'contract', id: 'pc2', label: 'PC-1404-007' },
    projectId: 'p2',
    assigneeId: 'u-c2',
    dueAt: day(10),
    priority: 'high',
    status: 'todo',
  })
  const rejectedDocs = documents.filter((d) => ['needs_fix', 'rejected'].includes(d.versions[d.versions.length - 1].status)).slice(0, 3)
  rejectedDocs.forEach((d) => {
    const emp = employees.find((e) => e.id === d.employeeId)!
    addTask({
      title: `پیگیری بارگذاری نسخه اصلاحی مدرک ${emp.firstName} ${emp.lastName}`,
      kind: 'system',
      ruleId: 'doc_rejected',
      link: { type: 'document', id: d.id, label: DOC_TYPES.find((x) => x.id === d.typeId)?.title ?? '' },
      projectId: emp.projectId ?? undefined,
      assigneeId: 'u-c3',
      dueAt: d.versions[d.versions.length - 1].fixDeadline ?? day(4),
      priority: 'medium',
      status: 'todo',
    })
  })
  addTask({
    title: 'بررسی ظرفیت و تأمین ۲ کارشناس پذیرش',
    description: 'سازمان برای پوشش شیفت عصر درمانگاه درخواست ۲ نیروی پذیرش جدید ثبت کرده است.',
    kind: 'automatic',
    ruleId: 'org_new_worker',
    link: { type: 'project', id: 'p2', label: 'PRJ-1404-007' },
    projectId: 'p2',
    assigneeId: 'u-c2',
    dueAt: day(-1),
    priority: 'high',
    status: 'in_progress',
  })
  addTask({ title: 'تهیه لیست بیمه ماه جاری', kind: 'manual', projectId: 'p1', assigneeId: 'u-c3', dueAt: day(5), priority: 'medium', status: 'todo', recurring: 'monthly' })
  addTask({ title: 'جلسه هماهنگی با واحد خدمات بیمارستان', kind: 'manual', projectId: 'p1', assigneeId: 'u-c1', dueAt: day(1), priority: 'medium', status: 'todo', recurring: 'weekly' })
  addTask({ title: 'جذب و مصاحبه نگهبان برای پروژه شهرداری', kind: 'manual', projectId: 'p4', assigneeId: 'u-c1', dueAt: day(14), priority: 'high', status: 'todo' })
  addTask({ title: 'تحویل لباس کار نیروهای فضای سبز', kind: 'manual', projectId: 'p3', assigneeId: 'u-c5', dueAt: day(-3), priority: 'low', status: 'blocked', description: 'منتظر تأمین سایز از تأمین‌کننده' })
  addTask({ title: 'آموزش ایمنی نیروهای جدید', kind: 'manual', projectId: 'p1', assigneeId: 'u-c5', dueAt: day(-6), priority: 'medium', status: 'done' })
  addTask({ title: 'اصلاح فایل Excel نیروهای فضای سبز و بارگذاری مجدد', kind: 'automatic', ruleId: 'excel_error', link: { type: 'import', id: 'imp-12', label: 'ورود گروهی #12' }, projectId: 'p3', assigneeId: 'u-c3', dueAt: day(2), priority: 'medium', status: 'todo' })
  const longOpen = requests.find((r) => r.status === 'in_review' && r.employeeId !== 'e1')
  if (longOpen)
    addTask({
      title: `پیگیری درخواست ${toFaDigits(longOpen.trackingNo)} که بیش از زمان مجاز باز مانده`,
      kind: 'automatic',
      ruleId: 'request_overdue',
      link: { type: 'request', id: longOpen.id, label: longOpen.trackingNo },
      assigneeId: 'u-c3',
      dueAt: day(0),
      priority: 'high',
      status: 'todo',
    })
  // Organisation-side tasks
  const orgTask = (title: string, assigneeId: string, due: number, priority: Task['priority'], status: Task['status'], link?: Task['link']) => {
    taskSeq += 1
    tasks.push({
      id: `t${taskSeq}`,
      title,
      scope: 'org',
      scopeId: 'o1',
      assigneeId,
      createdBy: link ? 'سامانه' : 'فرزانه احمدی',
      kind: link ? 'system' : 'manual',
      link,
      priority,
      status,
      dueAt: day(due),
      createdAt: at(-3, 9),
      comments: [],
      history: [{ id: `th${taskSeq}`, at: at(-3, 9), actor: link ? 'سامانه' : 'فرزانه احمدی', text: 'وظیفه ایجاد شد.' }],
    })
  }
  orgTask('بررسی گواهی عدم سوءپیشینه نیروهای جدید', 'u-o2', 2, 'high', 'todo')
  orgTask('ارسال معرفی‌نامه نیروهای پذیرش به حراست', 'u-o1', -1, 'medium', 'in_progress')
  orgTask('تصمیم درباره درخواست‌های تغییر شیفت', 'u-o3', 1, 'high', 'todo', { type: 'request', id: requests.find((r) => r.typeId === 'workplace_change')?.id ?? '', label: 'تغییر شیفت' })

  /* ---------------------------------------------------------------- */
  const notifications: AppNotification[] = []
  let nSeq = 0
  const notify = (n: Omit<AppNotification, 'id'>) => {
    nSeq += 1
    notifications.push({ id: `n${nSeq}`, ...n })
  }
  const me = { role: 'employee' as const, id: 'e1' }
  const currentContract = contracts.find((c) => c.employeeId === 'e1' && c.stage === 'awaiting_worker')!
  const e1Reqs = requests.filter((r) => r.employeeId === 'e1')
  notify({ audience: me, category: 'contract', title: 'قرارداد ماه جاری آماده امضاست', body: 'قرارداد ماهانه شما آماده مشاهده و امضاست. مهلت امضا ۳ روز دیگر است.', at: at(-1, 9, 5), read: false, urgent: true, link: `/me/documents/contracts/${currentContract.id}` })
  notify({ audience: me, category: 'request', title: 'درخواست شما نیازمند اصلاح است', body: 'درخواست «ثبت یا تغییر اطلاعات بانکی» برای اصلاح به شما برگشت داده شد.', at: at(-3, 10, 21), read: false, link: `/me/requests/${e1Reqs.find((r) => r.status === 'needs_correction')!.id}` })
  notify({ audience: me, category: 'document', title: 'مدرک تحصیلی نیازمند اصلاح است', body: 'پشت مدرک ارسال نشده است. دلیل و مهلت اصلاح را در جزئیات مدرک ببینید.', at: at(-2, 13), read: true, link: '/me/documents/personnel/d4' })
  notify({ audience: me, category: 'request', title: 'درخواست مساعده تأیید شد', body: 'درخواست مساعده شما تأیید شد. پرداخت پس از ثبت توسط واحد مالی اطلاع‌رسانی می‌شود.', at: at(-5, 12, 10), read: true, link: `/me/requests/${e1Reqs.find((r) => r.status === 'approved')!.id}` })
  notify({ audience: me, category: 'payslip', title: 'فیش حقوقی ماه گذشته صادر شد', body: 'فیش حقوقی صادر شد. وضعیت پرداخت: در حال انجام.', at: at(-3, 10), read: true, link: `/me/documents/payslips/${payslips[0].id}` })
  notify({ audience: me, category: 'document', title: 'یادآوری پایان اعتبار مدرک', body: 'اعتبار گواهی عدم سوءپیشینه شما ۱۸ روز دیگر به پایان می‌رسد.', at: at(-1, 8), read: false, link: '/me/documents/personnel/d6' })
  notify({ audience: me, category: 'admin', title: 'اطلاعیه شرکت', body: 'جلسه توجیهی ایمنی برای همه نیروهای پروژه اداری روز دوشنبه ساعت ۱۰ برگزار می‌شود.', at: at(-6, 15), read: true })
  notify({ audience: me, category: 'security', title: 'ورود از دستگاه جدید', body: 'ورود به حساب شما از یک مرورگر جدید ثبت شد. اگر این شما نبودید رمز عبور را تغییر دهید.', at: at(-9, 21, 14), read: true, link: '/me/profile/security' })
  notify({ audience: me, category: 'request', title: 'درخواست ثبت شد', body: 'درخواست «اعتراض به فیش حقوقی یا کارکرد» با موفقیت ثبت شد.', at: at(0, 9, 2), read: false, link: `/me/requests/${e1Reqs.find((r) => r.status === 'submitted')!.id}` })

  const orgA = { role: 'org' as const, id: 'o1' }
  notify({ audience: orgA, category: 'request', title: 'درخواست‌های جدید در صف سازمان', body: 'چند درخواست مرخصی و تغییر شیفت برای تصمیم سازمان ثبت شده است.', at: at(0, 8, 30), read: false, link: '/org/requests' })
  notify({ audience: orgA, category: 'contract', title: 'قرارداد نگهبانی در انتظار بررسی سازمان', body: 'قرارداد PC-1405-011 برای بررسی سازمان ارسال شده است.', at: at(-1, 11), read: false, urgent: true, link: '/org/contracts/pc4' })
  notify({ audience: orgA, category: 'document', title: 'مدرک جدید بارگذاری شد', body: 'مدارک تازه‌ای از نیروهای پروژه پشتیبانی برای بررسی ارسال شده است.', at: at(-1, 15), read: true, link: '/org/documents' })
  notify({ audience: orgA, category: 'project', title: 'فهرست نیروهای پروژه تغییر کرد', body: 'دو نیروی جدید به پروژه تأمین نیروی اداری اضافه شدند.', at: at(-4, 10), read: true, link: '/org/projects/p2' })

  const cmpA = { role: 'company' as const, id: 'c1' }
  notify({ audience: cmpA, category: 'contract', title: 'مهلت امضای قرارداد خدمات شهری نزدیک است', body: 'امضای سازمان برای PC-1405-003 هنوز ثبت نشده؛ مهلت ۲ روز دیگر.', at: at(0, 8), read: false, urgent: true, link: '/company/contracts/pc3' })
  notify({ audience: cmpA, category: 'task', title: 'وظیفه جدید به شما واگذار شد', body: 'بررسی ظرفیت و تأمین ۲ کارشناس پذیرش', at: at(-1, 9), read: false, link: '/company/tasks' })
  notify({ audience: cmpA, category: 'import', title: 'فایل Excel دارای خطا بود', body: 'ورود گروهی نیروهای فضای سبز: ۳ ردیف خطا دارد.', at: at(-2, 14), read: true, link: '/company/import' })
  notify({ audience: cmpA, category: 'request', title: 'درخواست جدید ثبت شد', body: 'درخواست‌های جدید در صف رسیدگی شرکت قرار گرفت.', at: at(0, 9, 3), read: false, link: '/company/requests' })
  notify({ audience: cmpA, category: 'project', title: 'پروژه از وضعیت مورد انتظار خارج شد', body: 'پروژه تأمین نیروی اداری با کمبود نیرو مواجه است.', at: at(-3, 10), read: true, link: '/company/projects/p2' })
  notify({ audience: cmpA, category: 'task', title: 'موعد وظیفه گذشته است', body: 'تحویل لباس کار نیروهای فضای سبز از موعد گذشته است.', at: at(-2, 8), read: true, urgent: true, link: '/company/tasks' })

  const adm = { role: 'admin' as const, id: 'platform' }
  notify({ audience: adm, category: 'security', title: 'تلاش‌های ناموفق ورود', body: '۱۲ تلاش ناموفق ورود از یک نشانی IP در یک ساعت گذشته ثبت شد.', at: at(0, 6, 40), read: false, urgent: true, link: '/admin/audit' })
  notify({ audience: adm, category: 'admin', title: 'درخواست ایجاد کاربر شرکت', body: 'شرکت پارس‌آرمان یک کاربر جدید دعوت کرده است.', at: at(-1, 12), read: false, link: '/admin/users' })
  notify({ audience: adm, category: 'admin', title: 'سرویس پیامک با تأخیر پاسخ می‌دهد', body: 'میانگین زمان تحویل پیامک به ۴۵ ثانیه رسیده است.', at: at(-1, 18), read: true, link: '/admin/status' })

  /* ---------------------------------------------------------------- */
  const audit: AuditEntry[] = []
  let aSeq = 0
  const log = (e: Omit<AuditEntry, 'id'>) => {
    aSeq += 1
    audit.push({ id: `a${aSeq}`, ...e })
  }
  log({ at: at(0, 9, 2), actor: 'علی رضایی', actorRole: 'employee', employeeId: 'e1', companyId: 'c1', orgId: 'o1', action: 'ثبت درخواست', entity: { type: 'request', id: e1Reqs[4].id, label: e1Reqs[4].trackingNo }, result: 'success' })
  log({ at: at(0, 8, 58), actor: 'علی رضایی', actorRole: 'employee', employeeId: 'e1', action: 'ورود به سامانه', entity: { type: 'session', id: 's1', label: 'Chrome — Android' }, result: 'success' })
  log({ at: at(-2, 13), actor: 'رضا نوری', actorRole: 'company', companyId: 'c1', orgId: 'o1', employeeId: 'e1', action: 'اعلام نقص مدرک', entity: { type: 'document', id: 'd4', label: 'مدرک تحصیلی — علی رضایی' }, result: 'success', detail: 'پشت مدرک ارسال نشده است.' })
  log({ at: at(-3, 10, 20), actor: 'رضا نوری', actorRole: 'company', companyId: 'c1', orgId: 'o1', employeeId: 'e1', action: 'برگشت درخواست برای اصلاح', entity: { type: 'request', id: e1Reqs[1].id, label: e1Reqs[1].trackingNo }, result: 'success' })
  log({ at: at(-5, 12, 10), actor: 'رضا نوری', actorRole: 'company', companyId: 'c1', orgId: 'o1', employeeId: 'e1', action: 'تأیید درخواست مساعده', entity: { type: 'request', id: e1Reqs[2].id, label: e1Reqs[2].trackingNo }, result: 'success' })
  log({ at: at(-1, 11), actor: 'الهام جعفری', actorRole: 'company', companyId: 'c1', orgId: 'o2', action: 'ارسال قرارداد برای بررسی سازمان', entity: { type: 'contract', id: 'pc4', label: 'PC-1405-011' }, result: 'success' })
  log({ at: at(-2, 14), actor: 'رضا نوری', actorRole: 'company', companyId: 'c1', action: 'ورود گروهی Excel', entity: { type: 'import', id: 'imp-12', label: 'نیروهای فضای سبز' }, result: 'failure', detail: '۳ ردیف خطا؛ هیچ تغییری ثبت نشد.' })
  log({ at: at(-4, 10), actor: 'مریم حسینی', actorRole: 'company', companyId: 'c1', orgId: 'o1', action: 'افزودن نیرو به پروژه', entity: { type: 'project', id: 'p2', label: 'PRJ-1404-007' }, result: 'success', detail: '۲ نیرو' })
  log({ at: at(-1, 15, 30), actor: 'سعید موسوی', actorRole: 'org', orgId: 'o1', companyId: 'c1', action: 'تأیید مدرک', entity: { type: 'document', id: 'd20', label: 'گواهی عدم سوءپیشینه' }, result: 'success' })
  log({ at: at(0, 6, 40), actor: 'ناشناس', actorRole: 'system', action: 'ورود ناموفق', entity: { type: 'session', id: 'x', label: '185.12.x.x' }, result: 'failure', detail: '۱۲ تلاش در ۶۰ دقیقه' })
  log({ at: at(-6, 10), actor: 'پریسا یوسفی', actorRole: 'admin', action: 'تغییر تنظیمات نوع درخواست', entity: { type: 'requestType', id: 'advance', label: 'درخواست مساعده' }, result: 'success', detail: 'سقف مبلغ: ۵۰۰٬۰۰۰٬۰۰۰ ریال' })
  log({ at: at(-9, 21, 14), actor: 'علی رضایی', actorRole: 'employee', employeeId: 'e1', action: 'ورود از دستگاه جدید', entity: { type: 'session', id: 's3', label: 'Firefox — Windows' }, result: 'success' })
  log({ at: at(-30, 11), actor: 'علی رضایی', actorRole: 'employee', employeeId: 'e1', companyId: 'c1', action: 'امضای قرارداد', entity: { type: 'contract', id: 'x', label: 'قرارداد ماه گذشته' }, result: 'success' })

  /* ---------------------------------------------------------------- */
  const alertRules: AlertRule[] = [
    { id: 'contract_sent', event: 'قرارداد برای امضا ارسال شد', description: 'پیگیری تکمیل امضا برای کارشناس قرارداد', thresholds: [], createsTask: true, notifies: ['inapp'], enabled: true, assigneeRole: 'کارشناس قراردادها' },
    { id: 'sign_deadline', event: 'مهلت امضای قرارداد نزدیک است', description: 'یادآوری و پیگیری امضا', thresholds: [7, 3, 1], createsTask: true, notifies: ['inapp', 'sms'], enabled: true, assigneeRole: 'مسئول قرارداد' },
    { id: 'doc_rejected', event: 'مدرک نیرو رد شد', description: 'پیگیری بارگذاری نسخه اصلاحی', thresholds: [], createsTask: true, notifies: ['inapp', 'sms'], enabled: true, assigneeRole: 'کارشناس منابع انسانی' },
    { id: 'org_new_worker', event: 'سازمان نیروی جدید درخواست کرد', description: 'بررسی ظرفیت و تأمین نیرو', thresholds: [], createsTask: true, notifies: ['inapp', 'email'], enabled: true, assigneeRole: 'مدیر پروژه شرکت' },
    { id: 'shift_change', event: 'سازمان درخواست تغییر شیفت ثبت کرد', description: 'بررسی و اعلام نتیجه', thresholds: [], createsTask: true, notifies: ['inapp'], enabled: true, assigneeRole: 'مسئول پروژه' },
    { id: 'excel_error', event: 'اطلاعات Excel دارای خطا بود', description: 'اصلاح فایل و بارگذاری مجدد', thresholds: [], createsTask: true, notifies: ['inapp'], enabled: true, assigneeRole: 'بارگذار فایل' },
    { id: 'contract_near_end', event: 'قرارداد در آستانه پایان است', description: 'بررسی تمدید یا خاتمه', thresholds: [30, 14, 7], createsTask: true, notifies: ['inapp', 'email'], enabled: true, assigneeRole: 'مدیر پروژه و مسئول قرارداد' },
    { id: 'request_overdue', event: 'درخواست بیش از زمان مجاز باز ماند', description: 'پیگیری و ارجاع به مسئول', thresholds: [0], createsTask: true, notifies: ['inapp'], enabled: true, assigneeRole: 'مسئول رسیدگی' },
    { id: 'doc_expiry', event: 'پایان اعتبار مدرک نزدیک است', description: 'یادآوری به نیروی کار', thresholds: [30, 7], createsTask: false, notifies: ['inapp', 'sms'], enabled: true, assigneeRole: 'نیروی کار' },
  ]

  const sessions: Session[] = [
    { id: 's1', device: 'Chrome — Android 14', location: 'مشهد', ip: '5.120.44.18', lastActive: at(0, 9, 2), current: true },
    { id: 's2', device: 'Safari — iPad', location: 'مشهد', ip: '5.120.44.18', lastActive: at(-2, 20, 10), current: false },
    { id: 's3', device: 'Firefox — Windows 11', location: 'تهران', ip: '91.98.12.200', lastActive: at(-9, 21, 14), current: false },
  ]

  const tickets: SupportTicket[] = [
    {
      id: 'tk1',
      number: 'SUP-2041',
      employeeId: 'e1',
      subject: 'دانلود فیش حقوقی در مرورگر گوشی',
      category: 'technical',
      status: 'answered',
      createdAt: at(-12, 10),
      messages: [
        { id: 'tm1', at: at(-12, 10), author: 'علی رضایی', fromSupport: false, text: 'دکمه دریافت PDF در گوشی من کار نمی‌کند.' },
        { id: 'tm2', at: at(-11, 9), author: 'پشتیبانی سامانه', fromSupport: true, text: 'مشکل برطرف شد. لطفاً صفحه را یک بار بازنشانی کنید و دوباره امتحان کنید.' },
      ],
    },
  ]

  return {
    version: DB_VERSION,
    companies,
    organizations,
    projects,
    employees,
    users,
    requestTypes,
    requests,
    contracts,
    payslips,
    documents,
    orgFiles,
    tasks,
    notifications,
    audit,
    alertRules,
    sessions,
    tickets,
    settings: {
      signatureOtpTtlSec: 120,
      otpMaxAttempts: 5,
      otpResendCooldownSec: 60,
      sessionTimeoutMin: 30,
      smsEnabled: true,
      emailEnabled: true,
      maintenanceBanner: '',
    },
  }
}
