# سامانه یکپارچه نیرو — Workforce & Staffing Platform (frontend)

This is a Persian, RTL, mobile-first frontend for the platform specified in `سند جامع نیازمندی.docx`.
It has four role-specific panels: employee, client organization, staffing company and system administrator.
They share one design system, one data model and one mock data layer.

The PRD analysis (role matrix, page inventory, workflow map and assumptions) is in [docs/ANALYSIS.md](docs/ANALYSIS.md).

## Run

Requires Node ≥ 22.

The simplest way is the run script. It checks the Node version, installs dependencies when needed, and starts the app:

```bash
./run.sh            # dev server → http://localhost:5173
./run.sh prod       # production build + preview → http://localhost:4173
./run.sh build      # build only (dist/)
./run.sh check      # type-check only
PORT=8080 HOST=0.0.0.0 ./run.sh   # custom port / reachable from a phone on the same network
```

Or with npm directly:

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript (strict)
npm run build      # production build → dist/
npm run preview    # serve the build
```

### Demo sign-in
Open the **ورود سریع با حساب‌های نمایشی** panel on the login page and pick an account. There is one account per role and sub-role.
You can also sign in with mobile + password: every account uses `Demo@1234`, and the SMS code is `12345`.

| Panel | Example account |
|---|---|
| Employee `/me` | علی رضایی — `09121234567` |
| Organization `/org` | فرزانه احمدی (مدیر کل سازمان), سعید موسوی (کارشناس منابع انسانی), نرگس کاظمی (مسئول درخواست‌ها) |
| Company `/company` | حمید صادقی (مدیر شرکت), مریم حسینی (مدیر پروژه — limited to 2 projects), رضا نوری (HR), الهام جعفری (قراردادها), مهدی کریمی (اجرایی) |
| Admin `/admin` | پریسا یوسفی |

The dark **نسخه نمایشی** bar at the top of every panel opens the **ابزار نمایش** menu. It lets you:
- simulate network failure, a slow connection or empty data, to see the error, loading and empty states;
- change the simulated day of the month, which drives the "advance from day 10" rule;
- switch role without signing out;
- reset the demo data.

## Stack
React 19, TypeScript 7, Vite 8, Tailwind CSS 4, React Router 8 (data router, route-level code splitting), lucide-react icons and the Vazirmatn variable font.
The Jalali calendar conversion is implemented locally in `src/lib/jalali.ts` and verified against `Intl` for every day across 20 years. There is no date library dependency.

## Structure

```
src/
  app/            router, route guards, role adapters
  auth/           session, demo accounts, permissions & data-scope hooks
  components/ui/  design system (buttons, form controls, Jalali date/month picker, combobox,
                  dialog/drawer/menu/popover, toast, data table, charts, timeline,
                  file uploader, document preview, empty/error/permission states)
  components/shell/ app shell (sidebar, top bar, five-section mobile bottom nav, demo bar)
  config/         status vocabulary, request-type catalogue, document types, permissions, icons
  features/
    auth/ system/                   login, OTP, password recovery, error/403/404/session/status pages
    employee/                       dashboard, request center, documents (contracts, payslips, personnel), profile, help
    requests/ contracts/ notifications/  logic and views shared across panels
    mgmt/                           organization + company panels (one implementation, role-scoped)
    admin/                          administrator panel
  lib/            formatting (Persian digits, Rial, Jalali), validation (national ID, IBAN, mobile), utils
  mock/           ⚠ demo data layer: seed, mutations, selectors, store
  types/          domain model
```

### Mock data layer
Everything under `src/mock/` is demo-only:
- `seed.ts` generates consistent sample data relative to today. National IDs and IBANs pass their checksums.
- `actions.ts` simulates the server-side behavior the PRD describes: audit entries, notifications, automatic tasks with de-duplication and auto-close, optimistic-concurrency conflicts, and version preservation.
- `store.tsx` exposes the mutations as async calls with latency and optional failure, and persists to `localStorage`.

Components call the store only through `useActions()`, `usePageLoad()` and the selectors. To integrate a backend, replace those with API calls; components do not need to change.
The UI never claims data reached a server. It is labeled "stored in this browser".

## Implemented

**Cross-cutting**
- Persian RTL throughout, with logical properties and RTL-aware arrows, pagination, tabs keyboard navigation and calendar.
- Jalali dates and Persian digits. LTR values (IBAN, mobile, codes) are isolated with `<bdi>`.
- Mobile-first layouts:
  - tables become cards on small screens;
  - filters collapse behind a button;
  - dialogs become bottom sheets;
  - the kanban becomes a horizontal swipe.
- Loading skeletons, error-with-retry, empty, permission-denied, 404, session-expired (inactivity timeout) and operation-result pages.
- Accessibility:
  - semantic landmarks and a skip link;
  - labeled fields, with errors announced and linked via `aria-describedby`;
  - focus-trapped dialogs and drawers;
  - visible focus states;
  - status shown with icon plus text, never color alone.
- Duplicate-submit protection, input preserved on failure, and confirmation for consequential actions.

**Employee (PRD part 1, all 36 page codes)**
- Dashboard: action-required list, clickable counts, quick access, recent activity, latest payslip, leave balance.
- Request Center: one entry point with a searchable grouped type selector and a dynamic form for all 20 request types.
  - Validation covers amounts, date order, working days, leave overlap and balance, IBAN, national ID, and the advance rule from day 10 of the month.
  - Changing type or leaving the page with unsaved input asks first.
  - Draft save, a review step, then a tracking number.
  - The request list has search and filters.
  - The detail page shows the workflow tracker (approval and execution as separate steps), history timeline, messages, correction and resubmit, and cancellation.
- Contracts: archive and filters, a readable contract body, and separate per-party signature status.
  - Signing: read-and-accept, then an SMS OTP with expiry, attempt limit and resend cooldown, bound to the version hash, then a receipt.
  - The legal-validity disclaimer from the PRD is shown.
- Payslips: year/month filters, net-pay trend, earnings and deductions, issued vs. processing vs. paid as distinct states, previous corrected versions, print to PDF, objection shortcut.
- Personnel documents: category checklist and completion progress.
  - Guided upload: requirements, type/size checks, camera capture on mobile, progress with retry, preview, receipt.
  - Rejection reasons and correction deadlines; replacement keeps earlier versions; expiry warnings.
- Profile: personal info (read-only official data that links to correction requests, masked national ID), job and workplace (company and organization shown separately), contact (mobile change with re-authentication), password policy, sessions and logout from other devices, personal activity log.
- Notifications (read/unread, categories, deep links), document search, help/FAQ, support tickets, privacy.

**Organization and company (PRD part 2, all 22 page codes)**
- Operations dashboard:
  - filters by project, counterpart and period;
  - clickable KPIs computed from live data;
  - urgent alerts separate from routine items;
  - decision queue, my tasks vs. team tasks, assigning an owner and deadline to any item;
  - staffing bullet charts and recent activity.
- Workforce table:
  - search, multi-filter, sort, column chooser, pagination;
  - permission-aware masking and CSV export;
  - inline editing of permitted fields;
  - bulk edit with a before/after preview and confirmation;
  - add worker;
  - change history with old value, new value, who and when.
- Worker detail with documents, requests, contracts and history. Removing from a project is kept separate from ending employment; ending employment is sent for approval, not applied directly.
- Document review:
  - each document type is reviewable only by its assigned party;
  - standard rejection reasons with an optional deadline;
  - version history;
  - viewing permission is separate from download permission;
  - bulk approval through a preview;
  - an automatic follow-up task is created and closes itself when a new version arrives.
- Request review queue:
  - mine / to execute / all;
  - approve, return, or reject (reason required);
  - referral, internal notes hidden from the employee;
  - execution recorded as a separate step;
  - optimistic concurrency against conflicting decisions;
  - routing per type across company and organization steps.
- Contracts: worker and project contracts as separate record types; separate stage, signature and validity statuses; the automatic alerts from the PRD; create, review, send with deadline, remind, party signatures, organization approve/return.
- Projects (company):
  - create a project, assign team and status;
  - status derived from real events (an unsigned main contract is never shown as "running");
  - staffing per role, members, tasks and documents.
- Tasks: manual, automatic and system tasks; links to source records; dependencies; recurrence; list / kanban (drag-and-drop with a keyboard alternative) / Jalali calendar; referral, comments, history.
- Calendar of every deadline type; Excel import/export (CSV template, row validation, new/update/duplicate/error preview, confirmation, result report); reports (shared plus role-specific).
- Users and permissions (operation scope plus project data scope), role/permission matrix, immutable activity log with export, settings.

**Admin** (derived; see assumption A1)
- Platform overview, users across all organizations, role matrix, organizations and companies.
- Request-type catalogue editor: enable/disable, rules, amount limits, SLA, execution step, required fields, ordered workflow steps.
- Workflow map, alert rules (thresholds, channels, task creation), system settings (OTP, session timeout, channels, status banner), audit log, operational monitoring.

## Verified
- `npm run typecheck` and `npm run build` pass.
- A headless-Chrome smoke test visited every route for every role at 375 px and 1440 px. It found no console errors, no runtime exceptions and no horizontal overflow. Out-of-scope records correctly returned 403.
- A scripted run of 30 end-to-end flows passed. It covered:
  - validation and submit;
  - the type-change and leave-page guards;
  - OTP contract signing to receipt;
  - document replacement with version history;
  - correction resubmit;
  - company approval and execution;
  - reject without a reason being blocked;
  - document correction request with an automatic task;
  - bulk edit, Excel import and organization contract approval;
  - permission and role blocking.

## Backend dependencies / not implemented
These are UI-ready but need a real backend. None of them can be enforced in a browser.
- **Authentication:** real identity verification (ثبت احوال / تأمین اجتماعی), SMS delivery, OTP issuance, rate limiting, password hashing, session revocation. Demo credentials are hard-coded for the prototype only.
- **Authorization:** server-side role and data-scope checks on every endpoint. The UI hides actions, but that is not protection.
- **Legally valid e-signature** and immutable storage of signed contract versions; generated PDFs (the prototype uses browser print-to-PDF).
- **Files:** storage, malware scanning, content validation, signed short-lived URLs, encryption at rest, retention policy.
- **Data feeds:** real payroll and payment-system integration for payment status; the work calendar, including lunar holidays (the demo knows only Fridays and fixed-date holidays); leave balances.
- **Excel:** native `.xlsx` parsing. The demo parses CSV exported from Excel.
- **Platform services:** notification delivery (SMS/email), scheduled jobs for deadline alerts and recurring tasks, a tamper-proof audit store, concurrency control on the server.
- **Settings persistence:** organization/company settings, the employee's notification preferences and SMS 2FA toggle, and mobile-number changes are simulated in the UI only. Admin settings and request-type edits are persisted in the mock store.
