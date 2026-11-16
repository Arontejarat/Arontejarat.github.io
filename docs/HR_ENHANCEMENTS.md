# Niroo — HR enhancements delivery notes

## Scope and working behavior

### Employee essentials

The employee dashboard now includes «اقدامات ضروری من» before its KPI/history sections. It links directly to personnel documents, contracts, payslips, insurance, personal information, requests and children. A pure selector evaluates signed contract parties and the actual contract date range, not only a label or the employee's summary contractEnd field. Missing, expired, preparing, future and awaiting-employee-signature states remain distinct. Required documents show every outstanding item with missing, pending, rejected, needs-fix or expired status and an appropriate direct upload/review action. Existing actions remain available below.

Employees cannot issue employer contracts. The missing/expired action creates a deduplicated company follow-up task and navigates to their contract workflow; the company issues the contract. Issuance closes the preparation task. State derives from the current store and updates after mutations.

### Payslips and company formats

Both employee list rows/mobile cards and payslip details offer the original-file download, original print/PDF workflow and a separate branded preview/print-to-PDF option. Download authorization checks employee ownership or company scope in the action layer. The actual Blob is read from IndexedDB. Previous versions retain their original file references. A popup-blocked or missing-file operation reports an error.

Generated structured payslip previews display actual earnings/deductions and payment status. File-only payslips never invent amounts: their separate branded output is explicitly a cover/metadata sheet naming the unchanged original file, not an edited or merged original PDF. Printing uses the browser's print/save-as-PDF function; it is not server PDF generation.

Company administrators manage multiple named formats at /company/document-templates. Fields include name/logo/registration/address/contact, header/footer, contract/payslip titles, signatory name/title, signature/stamp areas, optional number and extra company text. The configuration previews both document kinds before saving. Payroll publishing now selects a company format and previews the original file and separate branded sheet before publication. Individual contract creation and bulk issuance also preview the company format. Generated contracts and newly published payslips store a format snapshot; later edits never rewrite the snapshot or the uploaded original. Existing legacy records keep their prior representation.

### Children and family review

Employees manage children at /me/family; HR reviews company-scoped records at /company/family. Child extends the existing Employee.children model with separate names, optional/required-by-policy national ID, Jalali-selected birthday stored as ISO, registration timestamp, version, documents, review state/note and history. The first attachment is the birth certificate; later attachments are supporting documents. Original replacements remain reachable from history snapshots. Legacy children are migrated to pending without inventing their original registration dates.

New and edited submissions notify company HR through the existing company audience, create/deduplicate an assigned review task and enter pending status. HR approves, rejects or requests corrections; non-approval requires a reason. Employee editing is allowed before approval or after rejection/correction; HR can amend approved records, with a new pending review and preserved history. Optimistic version checks reject stale edits. National IDs are validated when supplied or required by policy and masked for readers without the sensitive-data permission. Detailed before/after history presents the changed names, dates, days and documents without exposing hidden national IDs.

The extensible FAMILY_RULES evaluator currently supports a company-configurable child-age threshold (default 18). It uses a Jalali anniversary derived from the real birthday, with Esfand 30 clamped to Esfand 29 in a non-leap anniversary year. Reaching the threshold records an audit event and notifies both employee and company, including child, birth date, threshold and an explicit statement that benefits/insurance are not changed. A persisted key includes rule, company, employee, child, birth date and threshold to prevent duplicates across app reloads. Changing the birthday or threshold creates a different rule condition. Evaluation runs on app startup, window focus, each minute while open, and mutations. Overdue conditions catch up on next launch; this is not an always-running external scheduler.

### Manual insurance history

/me/insurance and /company/insurance provide employee/company-scoped manual period records. Fields are Jalali year/month, day count, employer, registration number, optional original supporting files, submission time, review state, HR note and versioned change history. Company HR can return, approve/reject or amend authorized records. Employee changes to approved entries are blocked; HR amendments reopen review. Existing employee/employer/period duplicates require editing the existing record. Export is scoped to the authorized company/project records and selected employee/status filters.

Day validation uses the actual Jalali month length (31/30/29 or 30 for Esfand) and an optional company cap; a cap can reduce but never increase calendar length. Counts must be finite integers including zero. Future periods and invalid periods are rejected. Documents are PDF/JPG/PNG, up to five attachments and 10 MiB each. This is manual company verification, not insurer certification.

src/services/socialSecurity.ts defines history-inquiry, registration-verification and day-verification interfaces. Its adapter declares available=false and rejects calls with a clear unavailable message. No undocumented endpoint or fabricated successful response exists.

### Bulk worker contracts

/company/contracts/bulk uses scoped employee checkboxes with name/personnel search, national-ID search only with workforce.sensitive, project/org/status filters, selection of all filtered results, deselection and selected count. Configuration includes type, Jalali start/end, format, compensation in rials (zero explicitly allowed), work conditions, description and optional contract project override. An override affects the contract only, not the employee's assignment record.

Server-like validation inside the mock action checks permission, company/project scope, allowed format and format version, valid dates with end strictly after start, finite nonnegative salary and overlap with any non-cancelled/non-superseded, non-terminated worker contract. Terminated workers fail individually. Preview lists every selected worker and failure, permits removing rows and shows the first worker's document. Final confirmation creates one independent draft per valid worker, with unique ID/number, parties, salary, job/workplace and identity snapshot, format snapshot, creator/time, batch ID and history. It never automatically signs or sends the contracts.

A persisted ContractBatch contains company, creator, time, configuration fingerprint and one success/error result per unique employee. Replaying a successful row with the same operation key never generates another contract. Failed rows can be retried independently and successes remain. Reusing a batch key with changed settings or previously unselected employees is rejected. Per-row validation occurs before insertion; expected business failures are captured individually. The store commits the completed batch clone once, so an injected network failure before processing commits nothing and the same token can safely retry. Unexpected app/browser/storage failures and cross-tab concurrent writes still require real backend transactions.

## Data and migration

DB_VERSION is 6. src/mock/migrate.ts performs an additive, idempotent migration of the version-5 database, preserving employee IDs, contracts, payslips and their versions, file keys, requests, documents and all existing collections. It adds company documentTemplates, hrPolicies, insuranceRecords, contractBatches and ruleEvents. Existing Child records receive optional names/status/version/documents/history defaults. New seed data includes company defaults. Unknown future versions are rejected by the migration function rather than downgraded. The existing corrupt-storage fallback remains part of the demo store; production needs backed-up transactional migrations.

Contract gains documentFormat, employeeSnapshot, contractType/description, createdBy/createdAt and batchId. Payslip gains a documentFormat snapshot. Child remains nested in Employee. InsuranceRecord links employeeId and companyId. CompanyDocumentTemplate and CompanyHRPolicy each have a company owner. TaskLink recognizes family and insurance and routes to the appropriate company review page/employee filter.

## New permissions

- family.manage: employee own records; company HR/admin within scope.
- family.review: company HR/admin.
- insurance.view/edit: employee own records; company HR/admin within scope.
- insurance.verify: company HR/admin.
- contracts.bulk: company admin.
- templates.manage: company admin; includes company HR-rule configuration.
- payslips.download: employee own payslips; company HR/admin within scope.
- workforce.sensitive remains the existing sensitive-personnel/search/masking control.

All new writes, exports, bulk issuance and original-payslip authorization validate permission and scope in the action layer. UI route guards remain an additional usability layer. The browser holds the entire mock DB, so none of this is production security.

## Modified and new source files

New:
- src/mock/migrate.ts
- src/mock/hrRules.ts
- src/mock/hrActions.ts
- src/mock/contractBatch.ts
- src/services/socialSecurity.ts
- src/lib/printDocument.ts
- src/features/employee/EssentialActions.tsx
- src/features/personnel/PersonnelRecords.tsx
- src/features/documents/CompanyDocument.tsx
- src/features/documents/PayslipActions.tsx
- src/features/mgmt/DocumentTemplates.tsx
- src/features/mgmt/BulkContracts.tsx
- tests/hr-enhancements.mjs
- docs/HR_ENHANCEMENTS.md

Updated:
- src/types/domain.ts
- src/config/permissions.ts
- src/mock/seed.ts
- src/mock/store.tsx
- src/mock/businessActions.ts
- src/app/router.tsx
- src/features/employee/EmployeeLayout.tsx
- src/features/employee/Dashboard.tsx
- src/features/employee/documents/Payslips.tsx
- src/features/contracts/ContractParts.tsx
- src/features/mgmt/MgmtLayout.tsx
- src/features/mgmt/MgmtContracts.tsx
- src/features/mgmt/Payroll.tsx
- src/features/mgmt/Tasks.tsx
- package.json (test script)
- README.md (feature documentation link)

## Verification

Run npm run typecheck, npm test and npm run build. The original 26 business checks remain and the new HR suite covers non-destructive migration, distinct essentials states, ownership/RBAC restrictions, child correction/history, anniversary boundaries/deduplication, calendar insurance limits, review/export, explicit unavailable external provider, company format/version isolation, original file preservation, bulk independent signatures, overlap, idempotency and partial-failure retries. Browser acceptance tests additionally exercise uploads, original-file downloads, template previews, date pickers and rendered responsiveness. The final delivery message records results actually run.

## Remaining production requirements

Implement a real identity/session service and enforce authorization on every server read, write, export, file URL, template and batch operation. Store files centrally with per-record access checks, content scanning/validation and retention; browser MIME/size checks are not security. Use database transactions with unique idempotency keys and overlap constraints/locking, durable per-worker batch results, audit storage, version checks, migrations and backups. A scheduler must run birthday rules independently of browsers, in the agreed business timezone, with unique event keys and reliable delivery.

Social Security integration needs an officially supported provider/API agreement, credentials, user consent/legal authorization as applicable, exact identifier/period contracts, permitted queries, rate limits, retries, provenance and reconciliation rules. Secrets and official records must be handled by the backend. Confirm the applicable insurance calendar/day rules with the customer before replacing the current configurable manual model. Do not infer eligibility or remove benefits from an age alert.

Real SMS, legal e-signatures, payroll calculation, structured Excel payroll parsing, central multi-user synchronization and official insurance verification remain outside this demo. Legacy unrelated review defects documented in PROJECT_BRIEF_FOR_CHATGPT.md are not silently claimed resolved by this extension.

## Final verification results

- npm run typecheck: passed.
- npm test: passed, 26 existing business checks plus 49 new HR checks (75 total).
- npm run build: passed.
- Local Chrome acceptance: passed with no runtime exceptions; includes version-5 migration, essential actions, child Jalali birthday/certificate/age alerts, HR family review, insurance submission/correction, template persistence, payroll preview, original downloads from both list and detail, bulk issuance, partial-failure results and failed-only retry.
- Downloaded PDF matched uploaded bytes exactly.
- Responsive checks at 1440, 768 and 390 pixels: no horizontal overflow. Final family-screen production inspector: zero FAIL; three WARN for shared-shell label contrast, demo-banner edge spacing and sparse desktop-list whitespace.
- UI detector: no findings.
- Independent finish review and documentation review: ship within the browser-local demo boundary; no extension-specific blocking issue.
