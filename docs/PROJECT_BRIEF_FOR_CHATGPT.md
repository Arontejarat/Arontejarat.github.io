# سامانه نیرو / Niroo — Complete Project Brief for ChatGPT

This document describes the current repository, including the customer-requested additions. It is intended to be uploaded or pasted into another ChatGPT conversation. It distinguishes implemented frontend behavior from business intent, simulated services, known issues, and future production work.

## 1. Identity and current maturity

- Product name in the interface: سامانه نیرو (Niroo).
- General description: سامانه یکپارچه مدیریت و تأمین نیرو — an integrated workforce and staffing-management platform.
- npm package: niroo-platform, version 0.1.0, private package.
- Primary language: Persian (Farsi).
- Reading direction: right to left (RTL).
- Primary date system in the interface: Jalali / Solar Hijri.
- Money unit: Iranian rial, not toman; amount controls may also show a toman helper.
- Application type: responsive browser-based single-page application (SPA).
- Present implementation: a frontend prototype with a substantial mock business-data layer and working local interactions.
- No production backend, HTTP business API, central database, real SMS provider, payment provider, or real identity-verification integration is implemented.
- The codebase is suitable for demonstrating, reviewing and refining the product and as a starting point for a production implementation. It must not be described as already providing secure multi-tenant production services.

## 2. What problem the project solves

Staffing companies employ or supply workers who perform services at client organizations. This creates several distinct relationships: the company handles employment and administration, the organization supervises the work performed at its site, and the worker needs access to their own records and a formal request channel.

The platform brings workforce records, assignments, worker requests, personnel documents, contracts, payslips, project staffing, operational tasks, and company–organization document exchanges into one application. Its intended benefit is to reduce scattered spreadsheets, paper forms, phone calls and message-based follow-ups, while making responsibility and status visible.

For example, a services company may supply cleaning staff, guards, receptionists, administrative workers or maintenance staff to a hospital, municipality or university. The worker uploads personnel documents and signs a monthly contract. The organization supervises attendance and submits the monthly work report. The company publishes a payslip and submits a project statement to the organization.

These sectors are use-case examples, not evidence of actual customer deployments. The sample dataset contains Iranian organizations and service-company scenarios. This is an operational staffing platform rather than a public job board or an applicant-tracking/recruitment pipeline.

## 3. Essential business vocabulary

| Term | Meaning in this project |
|---|---|
| Employee / worker / نیروی کار | The person performing the work and accessing their own records. |
| Staffing company / شرکت تأمین نیرو | The company supplying/managing the workforce and employment administration. |
| Client organization / سازمان درخواست‌دهنده نیرو | The organization receiving the workers' services. This is different from their staffing company. |
| Project / پروژه | A service engagement joining a company and an organization, with workforce demand, assignments, team and contracts. |
| Worker contract / قرارداد نیرو | The employment contract involving the worker and company. |
| Project contract / قرارداد پروژه | The main service contract between the company and client organization. |
| Statement / صورت‌وضعیت | A project billing/progress/service statement submitted by the company to its client organization. In the current implementation it is a titled, period-tagged file, not a computed accounting ledger. |
| Work report / کارکرد | A monthly work/attendance/performance report sent by the organization to the company. Currently a file exchange, not an automated time-clock integration. |
| Payslip / فیش حقوقی | The employee's wage statement. Publishing it does not establish that payment occurred. |
| Insurance registration/code | Personnel evidence or a numeric insurance identifier, not an integration that actually enrolls the employee in insurance. |

## 4. The four user panels

### Employee — /me

Employees use a personal self-service portal. They can see a dashboard, required actions, recent requests, latest payslip and leave information. They can submit and track requests, save drafts, respond to corrections, view contracts, complete the simulated SMS-signing flow, read their own payslips and publish personnel documents.

Additional screens cover profile and employment details, contact/security forms, personal activity, notifications, document search, help/FAQ, support tickets and privacy. Official identity information is generally presented as read-only and corrected through requests. Some profile/security operations remain simulated rather than functioning account services.

### Client organization — /org

The organization sees the workforce and projects within its allowed organization/project scope. Its users can inspect worker details, handle routed employee requests, review designated document types, view related projects and contracts, manage tasks and organizational files, access reports and maintain permitted users/settings.

The customer additions let the organization receive and review company statements, submit monthly work reports to the company, and view worker contracts explicitly forwarded by the company after signing.

### Staffing company — /company

The company manages workforce, project staffing, worker contracts and project contracts, request queues, personnel-document review, tasks, deadlines, documents, reports and permitted users/settings. Workforce tools include filtering, column selection, inline editing, bulk edit previews, CSV import/export and worker creation.

The customer additions let it send statements to an organization, receive work reports, forward signed worker contracts, and publish payroll files for individual employees/months.

### Platform administrator — /admin

The administrator manages platform-level structures and configuration: organizations/companies, users, role/permission visibility, request-type definitions, ordered workflows, alert rules, system settings, audit views and operational monitoring screens.

The admin scope was derived from the original requirements' references to platform administration and configuration; the source PRD did not contain a dedicated administrator chapter. It should not be assumed that every visual configuration screen implements a complete production policy engine.

## 5. Sub-roles and permissions

Internal sub-roles are employee, org_admin, org_hr, org_requests, cmp_admin, cmp_pm, cmp_hr, cmp_contracts, cmp_exec and sys_admin.

Human labels include organization administrator, organization HR, organization request officer, company administrator, company project manager, company HR, company contracts specialist, company operations specialist and platform administrator.

The application separates operation permission from data scope. A user may have permission to view workforce records but only for certain projects. The permission vocabulary includes workforce.view/edit/bulk/import/status/sensitive, documents.view/review/download, requests.view/decide/refer/execute, contracts.view/manage/approve, projects.view/manage, tasks.view/manage, files.manage, payslips.manage, reports.view, users.manage, settings.manage and activity.view.

SUBROLES in src/config/permissions.ts is the current static permission map. Management-user records supply organization/company ownership and a project scope of all or an explicit project-ID list. UI permissions are read from the session sub-role; scope is read from the user record. These are browser-side mechanisms, not a server security boundary. The new business actions also validate role, permissions and scope against the mock DB. Broader legacy mutations are not uniformly hardened to that level.

## 6. Request Center and its 20 request types

The Request Center uses configurable definitions rather than twenty separately written form pages. A definition supplies fields, validation/rules, description, category, workflow and optional execution label. DynamicForm renders the fields; shared request logic computes and validates values.

The current catalogue is:

| ID | Request | Default review route | Separate execution label, if configured |
|---|---|---|---|
| advance | Salary advance / مساعده | Company HR, then company finance | Pay advance |
| payslip_objection | Payslip or work-report objection | Company payroll | Correct payslip |
| deductions_review | Deductions/overtime review | Company payroll | None |
| leave_daily | Daily leave | Organization supervisor, then company personnel | Record in work report |
| leave_hourly | Hourly leave | Organization supervisor | Record in work report |
| leave_sick | Sick leave | Organization supervisor, then company personnel | Record in work report |
| attendance_fix | Attendance/work correction | Organization supervisor, then company personnel | Apply work correction |
| marital_change | Marital-status change | Company personnel | Apply personnel change |
| child_info | Child information | Company personnel | Apply personnel change |
| identity_fix | Identity correction | Company personnel | Apply personnel change |
| bank_change | Bank-account change | Company HR, then company finance | Activate payroll account |
| workplace_change | Workplace/shift/transfer | Company project manager, then organization HR manager | Apply work-plan change |
| certificate | Employment/work-history certificate | Company administration | Issue certificate |
| id_card | ID-card issuance | Company administration, then organization security | Deliver card |
| employment_docs | Complete employment documents | Company HR | None |
| insurance_followup | Insurance follow-up | Company insurance unit | None |
| equipment | Work equipment | Organization support | Deliver equipment |
| safety_incident | Accident/safety issue | Organization safety unit, then company project manager | None |
| general | Complaint/problem/general request | Company HR manager | None |
| resignation | Resignation/termination request | Company HR manager, then organization HR manager | Settlement/termination |

The routes above describe configured review stages and labels. They do not represent external departments or independent integrations already connected to the application. Admin users can edit request definitions in the demo.

The employee selects a request type, completes the form, optionally saves a draft, reviews the entered data, submits and receives a tracking number. The request enters the configured review stages. Reviewers can approve, reject with a reason, return for correction, refer it, add internal notes and communicate with the employee through visible messages. Returned requests can be corrected and resubmitted. Cancellation is available under status restrictions.

Status values are draft, submitted, in_review, needs_correction, approved, executed, rejected and cancelled. Requests requiring execution retain a separate completion action after approval. Execution records do not imply a bank transaction or full HR automation: the current executeRequest implementation applies actual personnel-data changes for bank_change and marital_change, while many other execution labels mainly record a note, status, history and notification.

Validation includes required fields, amount limits, date order, working-day counts, leave balance checks, selected leave overlaps, bank-account and national-ID checks, and type-specific conditions. The default salary advance rule opens from day 10 of the local Jalali month and has configured amount limits and a single-open-request restriction. Leave working days exclude Fridays and a fixed list of holidays; lunar holidays and a real employer work calendar are absent. Do not assume full production-grade leave accrual or attendance computation.

## 7. Personnel documents and insurance

Document categories are identity, photo, education, bank, employment, family, insurance, contract and other. Types include national card, birth certificate, personnel photo, educational degree, bank proof, no-criminal-record certificate, health certificate, marriage certificate, insurance registration/code, insurance history, contract annex and job-specific license/certificate.

A document definition specifies whether it is required, allowed MIME types, file size, expiry requirements, review party and whether it is sensitive. The checklist presents completion and review states. The upload flow shows requirements, file selection/camera input, progress, preview, confirmation and a receipt. Review outcomes are pending, approved, rejected or needs_fix; missing/expired states are derived separately. Rejections preserve the reason and may include a correction deadline. Replacement keeps earlier versions.

The customer specifically requested insurance registration or an insurance code as a worker document. The required insurance_registration type accepts a proof file, a numeric code, or both. Persian digits are normalized to English digits for storage. Code-only entries are allowed and validated as 1–30 digits; there is no authoritative insurer verification. The code belongs to that document version and company reviewers can inspect it. Existing insurance history remains a separate optional document type.

## 8. Contracts and signed-contract forwarding

Worker and project contracts are different record kinds. The UI separately derives preparation stage, signature status and date-based validity.

Preparation stages include draft, company_review, org_review, ready_to_send, awaiting_worker, awaiting_other, partially_signed, completed, cancelled and superseded. Signature states include unsigned, awaiting, partial and complete. Validity states include not_started, active, near_end, expired and terminated.

The company can create a monthly worker contract, review it, send it with a signing deadline, issue reminders and record company signatures. The employee reads and accepts the contract and enters a demo OTP with expiry, attempt limits and resend timing. The signature record refers to the shown versionHash and produces a receipt. Project-contract review can involve the organization before signature. Contract history and party signatures are displayed independently.

These signatures, hashes and receipts are demo records. Hashes are not evidence of a cryptographic document-signing service, real SMS issuance is absent, and legal validity must not be claimed.

For the customer addition, company users with contracts.manage can explicitly forward a worker contract to the organization only when the contract stage is completed and both worker and company signatures are present. Forwarding stores sharedWithOrg with timestamp, sender and versionHash, adds history/audit and creates an organization notification. Re-sending the same version is rejected. Scoped organization contract views hide worker contracts until the current version was forwarded. Project contracts retain their existing process.

Forwarding exposes the application's signed contract record/body; it does not generate and deliver a legally signed PDF artifact from a backend.

## 9. Company–organization statements and work reports

The customer requested two opposite-direction exchanges:

1. Company sends a statement (صورت‌وضعیت) to the organization.
2. Organization sends a work report (کارکرد) to the company.

Both use the same BusinessDocuments screen implementation with different kind values: statement or work_report. The sender chooses title, project, Jalali month, optional description and one attachment. The counterpart is derived from that project's organization/company and shown in the form. Documents have shared access, pending review and ownership metadata.

Accepted attachments are PDF, JPEG, PNG, XLSX, XLS and CSV, up to 10 MiB as enforced by the code's 1024-based size check. The original file is retained in the browser file store. PDF/images can be viewed and downloaded; spreadsheet attachments are downloaded for external viewing. Spreadsheet contents are not parsed by these exchange workflows.

Lists support title search, project/status filters and responsive layouts. Eligible recipient users can approve or reject; rejection requires a reason. Review records retain note, reviewer and review time. The sender is notified of the result. The sender cannot approve its own outgoing document, and completed reviews cannot simply be overwritten by a second conflicting review.

These records are currently OrgFile entries extended with kind, period, attachment and review metadata, not separate database tables. There is no automatic invoice calculation, VAT calculation, accounting posting, payment settlement, employee attendance extraction or payroll calculation from their files.

## 10. Payroll and employee payslips

There are two representations:

- Existing seeded/structured payslips contain earnings, deductions, working days, overtime, period, version and optional payment information. They support calculated net pay, a trend chart, detailed line items and browser print-to-PDF.
- Newly uploaded file payslips have source=file, the original Attachment, uploader and version history. The company selects a worker, a Jalali month and a PDF/JPEG/PNG file up to 10 MiB.

The company administrator and company HR sub-roles have payslips.manage in the present map. Scope checks restrict eligible employees. Publishing creates an employee notification and the file appears under the selected employee's payslip list/details. Employees have an ownership check on the detail route. The file can be read/downloaded after page reload in that same browser.

Replacing a payslip for an existing employee/month requires a correction reason and expectedVersion. A stale expectedVersion causes a conflict. The previous record snapshot and file metadata are preserved and can be viewed through version tabs. Publishing a payroll file preserves any existing payment information and otherwise leaves payment unknown.

File-only payslips do not invent numeric earnings or deductions. They are excluded from the structured net-pay chart, and lists/dashboard indicate that the amount is in the file instead of pretending it is zero.

The customer's wording allowed either a file-based payslip upload or an Excel-based process. The file alternative is implemented. Structured payroll import from Excel, extracting payroll amounts from PDFs, OCR and payroll calculations from work-report files are NOT implemented. Excel attachments in work reports/statements do not change that boundary.

## 11. Workforce, projects, tasks, reports and supporting modules

Workforce records include personal and employment data, company/org/project IDs, workplace, shift, contract dates, leave balance, bank accounts, children, assignment history and change log. Management screens provide search, filters, sorting, pagination, column choice, sensitive-data masking, selected inline fields, bulk previews, CSV export and worker details.

Project records link a company and organization and include code, dates, team IDs, main contract, staffing demand and status. Staffing summaries are derived from assigned employees. The effective project-status selector avoids labeling an operational project running when its main contract is not fully signed and can flag staffing shortages or overdue tasks.

Tasks can be manual, automatic or system-generated, with assignee, due date, priority, status, source-record link, comments/history, dependencies and recurring settings. List, Kanban and calendar views are available. Some mock action events generate deduplicated follow-up tasks and close them when the triggering issue is resolved. This is event simulation in the browser, not a background scheduler running while users are offline.

Reports and dashboards aggregate local demo records; they do not fetch a central BI data source. Notification screens provide read/unread handling, categories and record links. In-app notifications are mock DB entries, not delivered SMS/email/push messages. Audit/activity views record operations but localStorage is editable, so the logs are not tamper-proof.

General org/company files remain separate from the dedicated statement/work-report screens. Some old seeded/general files only carry metadata or previews, so do not assume every historical sample has a real downloadable binary.

## 12. Workforce CSV import/export

The existing workforce import accepts CSV exported from Excel, not native XLSX parsing. The CSV columns are personnel number, first name, last name, national ID, mobile, project code, job title and Jalali start date. The UI validates rows and previews add, update, duplicate or error outcomes before confirmation. A sample/template and result counts are available.

Known limitation: update detection and applyImport only update project and job title for existing workers. Changing name, mobile or start date in the imported row does not update those columns. They are used when creating a new worker. Do not describe this as a full-field synchronization tool.

## 13. Main routes

| Area | Routes |
|---|---|
| Public/auth | /login, /login/otp, /forgot-password, /session-expired, /status, /privacy, /forbidden; fallback not-found handling |
| Employee home | /me |
| Employee requests | /me/requests, /me/requests/new, /me/requests/:id, /me/requests/:id/edit, /me/requests/:id/result |
| Employee documents | /me/documents, /me/documents/search |
| Employee contracts | /me/documents/contracts, /me/documents/contracts/:id, /me/documents/contracts/:id/sign, /me/documents/contracts/:id/receipt |
| Employee payslips | /me/documents/payslips, /me/documents/payslips/:id |
| Employee personnel docs | /me/documents/personnel, /me/documents/personnel/upload, /me/documents/personnel/:id |
| Employee profile | /me/profile and personal, job, contact, password, security, activity child paths |
| Employee support | /me/notifications, /me/notifications/:id, /me/help, /me/support, /me/privacy |
| Shared management | Both /org and /company provide workforce[/:id], documents, requests[/:id], contracts[/:id], files, projects[/:id], tasks, reports, users, activity, settings, notifications[/:id] |
| Business exchanges | /company/statements, /org/statements, /org/work-reports, /company/work-reports |
| Company-only extras | /company/calendar, /company/import, /company/payroll |
| Administrator | /admin plus users, roles, organizations, request-types, workflows, alerts, settings, audit, monitoring, notifications[/:id] |

Routes remain subject to role/permission guards. A page's existence does not mean every sub-role may access it.

## 14. Technology stack

The following are the version ranges declared in package.json, not a claim about the latest external package releases:

| Technology | Declared version | Use |
|---|---|---|
| React and react-dom | ^19.3.1 | Components, rendering, state and context |
| TypeScript | ^7.0.2 | Strict type checking; domain/UI contracts |
| Vite | ^8.3.5 | Development server and production bundling |
| React Router | ^8.5.0 | Browser routing, nested layouts and lazy page modules |
| Tailwind CSS and Vite plugin | ^4.3.3 | Utility styling and shared tokens |
| @vitejs/plugin-react | ^6.1.2 | React/Vite integration |
| lucide-react | ^1.61.0 | Icon library |
| @fontsource-variable/vazirmatn | ^5.3.0 | Locally bundled Persian variable font |
| Node.js | >=22 | Development/build/test runtime |

package-lock.json pins dependency resolutions for npm ci. There is no Redux/Zustand state library, external date library, backend framework, ORM or database driver in the app dependencies. React Context/state implement the mock store and authentication context. Jalali conversion, digit normalization, money/date formatting, mobile/national-ID/IBAN checks and some CSV utilities are implemented locally.

## 15. Repository map and developer entry points

- src/main.tsx: mounts React StrictMode, StoreProvider, AuthProvider, ToastProvider and RouterProvider.
- src/app/router.tsx: route definitions, page-to-module mapping and route-level lazy imports.
- src/app/guards.tsx: role/permission gates, role home redirect and session-expiry navigation.
- src/app/adapters.tsx: role-specific adapters for shared pages.
- src/auth/auth.tsx: demo session, account list, auth hooks, current actor, permission/scope hooks.
- src/components/shell/: sidebar/top bar/mobile navigation and demo tools.
- src/components/ui/: common buttons, fields, selectors, dialogs, drawers, tabs, toast, tables, charts, timelines, Jalali pickers, uploader and preview controls.
- src/components/ui/StoredFile.tsx: reads an original blob, creates a temporary object URL, displays PDF/image and provides downloading; revokes its object URL on cleanup.
- src/config/requestTypes.ts: 20 request definitions and their form/workflow settings.
- src/config/documentTypes.ts: document categories, requirements and designated reviewers.
- src/config/permissions.ts: sub-role permissions, labels and display groups.
- src/config/status.ts: status vocabulary, labels, icons and colors.
- src/types/domain.ts: shared TypeScript domain models.
- src/features/employee/: dashboard, requests, profile, documents and help pages.
- src/features/requests/: reusable dynamic form, validation/computation and request views.
- src/features/contracts/: shared contract body and signature presentation.
- src/features/mgmt/: shared company/org management screens.
- src/features/mgmt/BusinessDocuments.tsx: statement/work-report lists, send form and recipient review.
- src/features/mgmt/Payroll.tsx: company payslip management/upload.
- src/features/mgmt/MgmtContracts.tsx: management contract workflow and forwarding action.
- src/features/admin/, notifications/, auth/, system/: corresponding features.
- src/mock/seed.ts: DB shape, schema version and generated sample dataset.
- src/mock/generators.ts: repeatable sample-data helpers.
- src/mock/store.tsx: React state, local persistence, asynchronous action binding and demo loading/failure behavior.
- src/mock/actions.ts: existing request, contract, worker, task, document and administrative mutations.
- src/mock/businessActions.ts: new exchange sending/review, worker-contract forwarding and payroll publishing rules.
- src/mock/selectors.ts: queries, record lookup, data scopes and derived statuses.
- src/mock/businessSelectors.ts: project-scoped statement/work-report selection.
- src/lib/fileStorage.ts: original browser-file persistence using IndexedDB.
- src/lib/jalali.ts, format.ts, validation.ts, cn.ts: calendar, formatting, validation and helpers.
- src/styles/index.css: theme tokens, Tailwind integration and shared styles.
- tests/business-workflows.mjs: committed business-action regression suite.
- docs/ANALYSIS.md: original requirements interpretation and original route/workflow inventory.
- docs/CUSTOMER_CHANGES.md: Persian notes on the five customer additions.
- سند جامع نیازمندی.docx: original requirements document supplied with the repository.
- vite.config.ts, tsconfig.json, vercel.json: build/type/hosting configuration.
- run.sh: development/build helper.

## 16. Data model and relationships

The mock DB is one JavaScript object containing companies, organizations, projects, employees, users, requestTypes, requests, contracts, payslips, documents, orgFiles, tasks, notifications, audit, alertRules, sessions, tickets and settings.

An organization can have several service projects. A company can supply workers across several organizations/projects. A project has companyId and orgId. An employee has companyId, orgId, a current projectId or null and an assignment history. Employee requests, payslips and personnel documents point to employeeId. Contracts point to companyId, orgId and projectId, and worker contracts also have employeeId. Management users have a role/sub-role and organization/company/project scope. Tasks can link to a request, contract, document, project, worker or import record. Notifications carry an audience role/ID and a deep link.

New statement/work-report files extend OrgFile rather than adding a separate collection. Payroll originals are referenced by Attachment.storageKey. Insurance codes live on DocVersion. Worker-contract forwarding metadata lives on Contract.sharedWithOrg. Previous payslips and document versions preserve snapshots in their record structures.

## 17. How the application runs internally

On startup, the store tries to read niroo-demo-db from localStorage. It uses that record if it can parse it and its version matches DB_VERSION; otherwise it creates seed data. AuthProvider reads niroo-demo-session and determines the role home. Route guards choose allowed screens. Components obtain records with useDB and selectors, and initiate changes through useActions.

A typical mutation is:

User action -> form validation -> bound action from useActions -> simulated delay -> optional demo network failure -> check actor -> structuredClone of latest mock DB -> synchronous mutation -> commit cloned DB -> React re-render -> debounced localStorage persistence.

The debounce is 250 ms; pagehide/visibility changes also flush the current DB. The default action delay is roughly 280–600 ms; slow mode uses roughly 1.6–2.5 seconds. usePageLoad independently simulates page loading/error states. These delays do not represent HTTP requests.

Because failed mutations occur on an uncommitted clone, they generally leave the stored DB unchanged. Selected mutations use expected timestamps or versions to model conflicts. This is not distributed locking, a multi-user transaction system, real-time synchronization or cross-tab conflict resolution.

For file workflows with persistFile enabled, the original Blob is first saved in IndexedDB. Its storageKey is saved in attachment metadata inside localStorage. A viewer loads that Blob and creates an object URL only while mounted. Image thumbnails can also be downscaled for preview. Metadata-only seeded records and legacy uploads should not be assumed to retain a full original file.

The relevant storage names are niroo-demo-db, niroo-demo-settings, niroo-demo-session and the niroo-demo-files IndexedDB database with files object store. Storage belongs to that browser profile and origin: using another device, browser, host or port does not automatically share the records. Resetting demo DB records reseeds metadata; it does not constitute a file-retention or cleanup service.

## 18. Demo sign-in and testing the business story

Use the quick demo-account panel on /login. The common demo password is Demo@1234 and the demo OTP is 12345. The employee example is علی رضایی with mobile 09121234567. Other demo personas include company manager حمید صادقی, company HR رضا نوری, project manager مریم حسینی, contracts specialist الهام جعفری, organization administrator فرزانه احمدی and platform administrator پریسا یوسفی. These are sample accounts.

The demo tools bar can switch roles, simulate a slow connection/network failure/empty data, override the Jalali day-of-month for advance-request availability and reset sample data.

A useful demonstration sequence in the SAME browser is: sign in as an employee and submit insurance proof/code; switch to company HR and review it; inspect the contract flow and complete signatures; forward the completed worker contract as the company; switch to the organization and view it; submit a work-report attachment; switch back to the company and review it; publish a payslip for that employee/month; switch to the employee and open/download it; send a company statement and review it from the organization panel.

The role switch is a demonstration of counterpart workflows against one local data store. It is not actual network delivery to another person's device.

## 19. Local setup, tests and deployment

Install Node.js 22 or newer and use the project root:

~~~bash
npm ci
npm run dev
~~~

The usual development address is http://localhost:5173. Available commands:

~~~bash
npm run typecheck
npm test
npm run build
npm run preview
~~~

build runs TypeScript checking followed by Vite and produces dist/. preview normally serves at http://localhost:4173. Alternatively use ./run.sh, ./run.sh check, ./run.sh build or ./run.sh prod. HOST=0.0.0.0 and PORT can be passed to the helper for network/device testing, subject to local firewall/network access. Opening the app on a phone still creates that phone's own browser data.

The frontend has a Vercel configuration using the Vite framework, npm run build, dist output and a rewrite to /index.html for SPA deep links. Equivalent static hosting needs an SPA fallback. A deployed static frontend still has local demo data; deployment alone does not create a backend or shared storage. There is no currently required business-service .env configuration because no real service integration exists.

The project ZIP previously prepared is ghadri-project.zip. It includes source, tests, documentation, config and lockfile, excluding node_modules, dist and temporary inspection folders. This new brief is a separate file created after that archive; the old ZIP is not automatically refreshed by this documentation task.

## 20. Verification and known issues

During the customer-change implementation, npm test passed 26 focused model/action checks and npm run build passed. Browser verification exercised all five requested additions, including statement upload/recipient review, required rejection reason, work-report exchange, original payroll file after reload, code-only insurance submission, completed-contract forwarding and responsive checks at 1440, 768 and 390 px. No browser runtime exception was reported in those flows. An independent UI finish review accepted the extension within the demo boundary. These are recorded checks from implementation, not a claim that every possible feature/edge case is covered or that tests were rerun for this documentation-only task.

The original README also reports earlier broad smoke/calendar/E2E checks; those historical claims are not all represented as committed reusable tests. The committed test script focuses on the new business workflows. Existing shared-shell contrast/edge-spacing issues were recorded as accessibility debt.

A preceding code review identified additional legacy defects that should be carried forward as known work, not silently assumed fixed by the customer additions:

- Project transfer changes projectId without consistently synchronizing orgId/workplace, which can leave organization access scope inconsistent after a cross-organization move.
- Workforce inline/bulk status editing can directly set terminated, bypassing the intended company-approval task used in the dedicated termination-request flow.
- The save-draft-and-switch-request-type flow can retain a stale draft association; submitRequest can update values/workflow without changing the original typeId.
- Existing-worker CSV updates only apply job title/project; other editable CSV columns are ignored.

These findings were not the scope of the later five-feature implementation. A future developer should reproduce and address them. Also, scope/permission correctness must be enforced anew on the server rather than trusting UI guards or these demo tests.

## 21. What is needed for production

Production work would require a selected backend stack and API contract, central relational data storage with migrations, real authentication/session management, server-side role and tenant/project authorization for every operation, file storage and authorized file access, transactional workflow/version checks, secure OTP issuance and SMS/email delivery, background jobs and persistent audit events.

Specific integrations remain to be designed: identity/insurance verification if required, payroll/work-calendar/attendance sources, payment reconciliation if required, validated document-signing infrastructure if legally valid e-signatures are required, and native Excel parsing if chosen. Real business rules for statement calculations, leave accrual, payroll, deadlines and termination need agreement before automation. No particular backend framework, database vendor or cloud file-storage provider has been selected by the current code.

The existing frontend hooks and shared domain types are useful integration points, but switching to an API is more than replacing one function. Reads, mutations, pagination, files, validation, error handling, sessions, configuration updates and concurrency must all be reviewed against real server responses. Security and signature guarantees cannot be delivered by merely hiding buttons or storing additional browser flags.

## 22. Instructions to the next ChatGPT session

Use the following as the working instruction when sharing this brief:

> I am continuing an existing project called سامانه نیرو / Niroo. Read this brief and, if provided, the source ZIP before proposing or editing anything. Preserve the existing Persian RTL interface, Jalali dates, rial currency, four user roles and separation between staffing company and client organization. Treat the current repository as a frontend demo with localStorage metadata and IndexedDB files, not as a production backend. The five recent customer additions are already implemented: company statements to organizations, organization work reports to companies, insurance registration/code as a personnel document, explicit forwarding of fully signed worker contracts to the organization, and company-uploaded PDF/image payslips visible to the employee. Payroll Excel parsing is not implemented. Distinguish current behavior, known defects, proposed work and real integrations. Do not claim that demo OTP/signatures/audit/security/payment status provides production guarantees. Before changes, inspect the relevant actual source and explain which layer needs work. My next task is: [describe the requested task here].
