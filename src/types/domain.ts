/**
 * Domain model shared by every panel.
 * The shapes mirror what a backend API is expected to return; the mock layer
 * (src/mock) produces the same shapes so the UI can be re-pointed at real
 * endpoints without changes to components.
 */

export type RoleKey = 'employee' | 'org' | 'company' | 'admin'

export type SubRole =
  | 'employee'
  | 'org_admin'
  | 'org_hr'
  | 'org_requests'
  | 'cmp_admin'
  | 'cmp_pm'
  | 'cmp_hr'
  | 'cmp_contracts'
  | 'cmp_exec'
  | 'sys_admin'

export type Permission =
  | 'dashboard.view'
  | 'workforce.view'
  | 'workforce.edit'
  | 'workforce.bulk'
  | 'workforce.import'
  | 'workforce.status'
  | 'workforce.sensitive'
  | 'documents.view'
  | 'documents.review'
  | 'documents.download'
  | 'requests.view'
  | 'requests.decide'
  | 'requests.refer'
  | 'requests.execute'
  | 'contracts.view'
  | 'contracts.manage'
  | 'contracts.approve'
  | 'projects.view'
  | 'projects.manage'
  | 'tasks.view'
  | 'tasks.manage'
  | 'files.manage'
  | 'reports.view'
  | 'users.manage'
  | 'settings.manage'
  | 'activity.view'

export type Party = 'company' | 'org'

/* ------------------------------------------------------------------ */
/* Organisations                                                        */
/* ------------------------------------------------------------------ */

export interface Organization {
  id: string
  name: string
  kind: string // بیمارستان، شهرداری، ...
  city: string
  status: 'active' | 'inactive'
  contactName: string
  contactPhone: string
}

export interface Company {
  id: string
  name: string
  registrationNo: string
  city: string
  status: 'active' | 'inactive'
  contactName: string
  contactPhone: string
}

/* ------------------------------------------------------------------ */
/* Workforce                                                            */
/* ------------------------------------------------------------------ */

export type EmploymentStatus = 'active' | 'pending_start' | 'suspended' | 'terminated'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'

export interface BankAccount {
  id: string
  bank: string
  sheba: string
  holder: string
  verified: boolean
  /** Only one verified account is active for salary payment. */
  activeForPayroll: boolean
}

export interface Child {
  id: string
  fullName: string
  birthDate: string
  relation: 'son' | 'daughter'
}

export interface ChangeLogEntry {
  id: string
  at: string
  by: string
  field: string
  before: string
  after: string
  source: 'inline' | 'bulk' | 'import' | 'request' | 'system'
}

export interface Employee {
  id: string
  personnelNo: string
  firstName: string
  lastName: string
  nationalId: string
  mobile: string
  email?: string
  birthDate: string
  maritalStatus: MaritalStatus
  address: string
  postalCode: string
  photoColor: string
  jobTitle: string
  unit: string
  companyId: string
  orgId: string
  projectId: string | null
  workplace: string
  workplaceAddress: string
  startDate: string
  contractType: string
  contractStart: string
  contractEnd: string
  shift: string
  supervisor?: string
  employmentStatus: EmploymentStatus
  children: Child[]
  bankAccounts: BankAccount[]
  changeLog: ChangeLogEntry[]
  leaveBalanceDays: number
  /** Assignment history: entries and exits from projects. */
  assignments: { id: string; projectId: string; from: string; to?: string; note?: string }[]
}

/* ------------------------------------------------------------------ */
/* Requests                                                             */
/* ------------------------------------------------------------------ */

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'executed'

export type RequestCategoryId = 'finance' | 'leave' | 'personal' | 'bank' | 'job' | 'admin' | 'insurance' | 'other'

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'amount'
  | 'select'
  | 'radio'
  | 'date'
  | 'month'
  | 'time'
  | 'checkbox'
  | 'readonly'
  | 'sheba'
  | 'nationalId'
  | 'account'
  | 'payslipLink'
  | 'files'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  helper?: string
  placeholder?: string
  options?: FieldOption[]
  min?: number
  max?: number
  maxLength?: number
  /** Show only when another field has one of these values */
  showIf?: { field: string; in: string[] }
  /** Value computed from other fields (read-only) */
  computed?: 'leaveDays' | 'leaveHours'
  /** Pre-filled from the employee record (read-only) */
  prefill?: 'maritalStatus' | 'workplace' | 'shift'
  /** Accepted file types for kind=files */
  accept?: string[]
  maxFiles?: number
  /** Marks medical / identity / banking data for restricted access */
  sensitive?: boolean
  fullWidth?: boolean
}

export interface WorkflowStep {
  party: Party
  label: string
}

export interface RequestTypeDef {
  id: string
  title: string
  category: RequestCategoryId
  description: string
  enabled: boolean
  fields: FieldDef[]
  workflow: WorkflowStep[]
  /** Has an execution step after approval (payment, record change, issue certificate…) */
  executionLabel?: string
  slaDays: number
  rules?: {
    minAmount?: number
    maxAmount?: number
    /** Allowed from this Jalali day of month onward */
    availableFromDay?: number
    /** Only one open request of this type at a time */
    singleOpen?: boolean
  }
  confidentialAllowed?: boolean
  icon: string
  keywords?: string[]
}

export interface Attachment {
  id: string
  name: string
  size: number
  mime: string
  uploadedAt: string
  /** data: URL for images in the demo; real files are served via signed URLs */
  previewUrl?: string
}

export interface RequestStep {
  party: Party
  label: string
  status: 'waiting' | 'active' | 'approved' | 'rejected' | 'returned'
  decidedBy?: string
  decidedAt?: string
}

export interface RequestEvent {
  id: string
  at: string
  actor: string
  actorRole: RoleKey | 'system'
  kind:
    | 'created'
    | 'submitted'
    | 'assigned'
    | 'step_approved'
    | 'approved'
    | 'rejected'
    | 'returned'
    | 'resubmitted'
    | 'cancelled'
    | 'executed'
    | 'referred'
    | 'message'
  note?: string
}

export interface RequestMessage {
  id: string
  at: string
  author: string
  authorRole: RoleKey
  text: string
}

export interface EmployeeRequest {
  id: string
  trackingNo: string
  typeId: string
  employeeId: string
  status: RequestStatus
  createdAt: string
  submittedAt?: string
  updatedAt: string
  finalizedAt?: string
  values: Record<string, unknown>
  attachments: Attachment[]
  steps: RequestStep[]
  currentStep: number
  assignee?: string
  dueAt?: string
  history: RequestEvent[]
  messages: RequestMessage[]
  internalNotes: RequestMessage[]
  correctionNote?: string
  rejectionReason?: string
  execution?: { at: string; by: string; note: string }
  confidential?: boolean
}

/* ------------------------------------------------------------------ */
/* Contracts                                                            */
/* ------------------------------------------------------------------ */

export type ContractStage =
  | 'draft'
  | 'company_review'
  | 'org_review'
  | 'ready_to_send'
  | 'awaiting_worker'
  | 'awaiting_other'
  | 'partially_signed'
  | 'completed'
  | 'cancelled'
  | 'superseded'

export type SignatureStatus = 'unsigned' | 'awaiting' | 'partial' | 'complete'
export type ValidityStatus = 'not_started' | 'active' | 'near_end' | 'expired' | 'terminated'

export interface ContractParty {
  role: 'worker' | 'company' | 'org'
  name: string
  required: boolean
  signedAt?: string
  signedBy?: string
}

export interface ContractEvent {
  id: string
  at: string
  actor: string
  text: string
}

export interface Contract {
  id: string
  number: string
  kind: 'worker' | 'project'
  title: string
  employeeId?: string
  companyId: string
  orgId: string
  projectId: string
  periodYear?: number
  periodMonth?: number
  jobTitle?: string
  workplace?: string
  startDate: string
  endDate: string
  stage: ContractStage
  parties: ContractParty[]
  signDeadline?: string
  /** Hash of the exact version shown for signature */
  versionHash: string
  version: number
  viewedAt?: string
  employeeSignature?: { signedAt: string; receiptNo: string; method: 'sms_otp'; mobile: string; versionHash: string }
  salary?: { label: string; amount: number }[]
  workHours?: string
  terminated?: boolean
  history: ContractEvent[]
  value?: number
}

/* ------------------------------------------------------------------ */
/* Payslips                                                             */
/* ------------------------------------------------------------------ */

export interface PayslipLine {
  label: string
  amount: number
  note?: string
}

export interface Payslip {
  id: string
  employeeId: string
  year: number
  month: number
  status: 'draft' | 'final' | 'corrected'
  version: number
  earnings: PayslipLine[]
  deductions: PayslipLine[]
  workDays: number
  overtimeHours: number
  issuedAt: string
  correctedAt?: string
  correctionNote?: string
  /** null = no reliable payment information available */
  payment: { status: 'processing' | 'paid'; paidAt?: string; reference?: string } | null
  previous?: Omit<Payslip, 'previous'>[]
}

/* ------------------------------------------------------------------ */
/* Documents                                                            */
/* ------------------------------------------------------------------ */

export type DocStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'needs_fix' | 'expired'

export type DocCategoryId =
  | 'identity'
  | 'photo'
  | 'education'
  | 'bank'
  | 'employment'
  | 'family'
  | 'insurance'
  | 'contract'
  | 'other'

export interface DocTypeDef {
  id: string
  category: DocCategoryId
  title: string
  required: boolean
  requirements: string
  accept: string[]
  maxSizeMb: number
  hasExpiry?: boolean
  reviewParty: Party
  sensitive?: boolean
}

export interface DocVersion {
  version: number
  fileName: string
  size: number
  mime: string
  uploadedAt: string
  uploadedBy: string
  previewUrl?: string
  status: Exclude<DocStatus, 'not_submitted' | 'expired'>
  reviewer?: string
  reviewedAt?: string
  reasonCode?: string
  reason?: string
  fixDeadline?: string
  receiptNo: string
}

export interface PersonnelDocument {
  id: string
  employeeId: string
  typeId: string
  versions: DocVersion[]
  expiresAt?: string
}

export interface OrgFile {
  id: string
  owner: Party
  ownerId: string
  title: string
  docType: string
  projectId?: string
  description: string
  date: string
  access: 'internal' | 'shared' | 'restricted'
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'none'
  fileName: string
  size: number
  uploadedBy: string
}

/* ------------------------------------------------------------------ */
/* Projects & tasks                                                     */
/* ------------------------------------------------------------------ */

export type ProjectStatus = 'planning' | 'preparing' | 'awaiting_contract' | 'running' | 'needs_followup' | 'closed' | 'paused'

export interface Project {
  id: string
  code: string
  name: string
  orgId: string
  companyId: string
  managerId: string
  teamIds: string[]
  startDate: string
  endDate: string
  demand: { title: string; required: number }[]
  mainContractId?: string
  status: ProjectStatus
  description: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskLink {
  type: 'contract' | 'request' | 'document' | 'import' | 'project' | 'employee'
  id: string
  label: string
}

export interface Task {
  id: string
  title: string
  description?: string
  projectId?: string
  scope: Party
  scopeId: string
  assigneeId: string
  createdBy: string
  kind: 'manual' | 'automatic' | 'system'
  ruleId?: string
  link?: TaskLink
  priority: TaskPriority
  status: TaskStatus
  dueAt: string
  createdAt: string
  dependsOn?: string[]
  recurring?: 'weekly' | 'monthly'
  comments: { id: string; at: string; author: string; text: string }[]
  history: { id: string; at: string; actor: string; text: string }[]
  closedAutomatically?: boolean
}

/* ------------------------------------------------------------------ */
/* Notifications, users, audit                                         */
/* ------------------------------------------------------------------ */

export type NotificationCategory = 'request' | 'contract' | 'payslip' | 'document' | 'task' | 'project' | 'import' | 'admin' | 'security' | 'job'

export interface AppNotification {
  id: string
  audience: { role: RoleKey; id: string } // id = employeeId, orgId, companyId or 'platform'
  category: NotificationCategory
  title: string
  body: string
  at: string
  read: boolean
  urgent?: boolean
  link?: string
}

export interface AppUser {
  id: string
  name: string
  email: string
  mobile: string
  role: Exclude<RoleKey, 'employee'>
  subRole: SubRole
  orgId?: string
  companyId?: string
  /** 'all' or a list of project ids the user is limited to */
  projectScope: 'all' | string[]
  status: 'active' | 'inactive' | 'invited'
  lastLogin?: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  actorRole: RoleKey | 'system'
  orgId?: string
  companyId?: string
  employeeId?: string
  action: string
  entity: { type: string; id: string; label: string }
  result: 'success' | 'failure'
  detail?: string
}

export interface AlertRule {
  id: string
  event: string
  description: string
  thresholds: number[] // days before deadline
  createsTask: boolean
  notifies: ('inapp' | 'sms' | 'email')[]
  enabled: boolean
  assigneeRole: string
}

export interface Session {
  id: string
  device: string
  location: string
  ip: string
  lastActive: string
  current: boolean
}
