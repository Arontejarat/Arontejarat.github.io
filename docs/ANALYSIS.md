# PRD Analysis — سامانه یکپارچه مدیریت و تأمین نیرو

Source: `سند جامع نیازمندی.docx` (v1.1). The document has two parts:

1. **Employee panel PRD** (پنل نیروی کار): sections ۱–۱۶, 36 page codes.
2. **Organization + staffing company PRD** (پنل سازمان و شرکت تأمین نیرو): sections ۱–۱۳, 22 page codes.

There is **no dedicated section for the system administrator**. Its scope is taken from the role table
(«مدیریت کاربران، تنظیمات، ساختار سازمانی، گردش کارها و دسترسی‌ها») and from every requirement that says
"configurable through system settings". See *Assumptions*.

The docx also contains three flow diagrams: the request lifecycle, monthly-contract SMS signing, and document review.
The "داشبورد عملیات" and "نمونه رابط کاربری برای تسک‌ها" headings have no mock-up content in the file.

---

## 1. Product summary

The platform connects four parties:

| Party | Responsibility |
|---|---|
| نیروی کار (employee) | Views their own personal, job and contract data. Submits all requests through **one** Request Center. Signs monthly contracts, reads payslips and uploads personnel documents. |
| شرکت تأمین نیرو (staffing company) | Manages its workforce, projects, worker and project contracts, request processing, document review, tasks/deadlines, Excel import, reports and company users. |
| سازمان درخواست‌دهنده (client organization) | Manages the workers deployed to it. Reviews documents, decides on the requests routed to it, monitors and approves contracts, and runs organization documents, users and reports. |
| ادمین کل (administrator) | Manages platform users, organizations and companies, roles and permissions, the request-type catalogue, workflows, alert thresholds, audit and system status. |

Key invariants from the PRD:

- **Approved ≠ executed.** For example, an approved salary advance has not necessarily been paid.
- **Payslip issued ≠ payment in progress ≠ paid.**
- **The employee's signature is tracked separately from the other parties' signatures.** An SMS code alone is not a legally valid signature in every case.
- **Removing a worker from a project ≠ ending their employment.** Removal never deletes their records.
- **Document versions are preserved.** A replacement keeps the previous file and its rejection reason.
- **Project, contract, worker, document and request statuses are independent.**
- **"Near signature deadline" ≠ "near contract end".**
- Every request, task and contract has a named owner. Automatic tasks link to their source record.
- Contradictory concurrent decisions must be prevented. The backend enforces this; the UI shows a "decision already recorded" state.
- All access control is enforced on the server. Hiding UI elements is not protection.

## 2. Role & permission matrix (UI scope)

| Capability | Employee | Organization | Company | Admin |
|---|---|---|---|---|
| Own profile, job info | ✔ view; official fields via request | – | – | – |
| Submit requests | ✔ (Request Center) | – | – | – |
| Review requests | – | ✔ routed to org | ✔ routed to company | configure workflows only |
| Internal notes on requests | – | ✔ | ✔ | – |
| Workforce list / inline edit | – | ✔ org scope | ✔ company scope | – |
| Bulk edit / Excel import | – | ✔ (bulk edit) | ✔ (bulk + Excel) | – |
| Document review | own uploads only | ✔ types assigned to org | ✔ types assigned to company | – |
| Contracts | own: view + SMS sign | view + approve where authorised | manage, send, remind | thresholds |
| Projects | – | view related | full management | view all |
| Tasks | – | organisational & referred | full (manual / automatic / system) | – |
| Calendar & deadlines | – | – | ✔ | – |
| Org/Company documents | – | ✔ | ✔ | – |
| Reports | – | org reports | company reports | platform overview |
| Users & permissions | – | org users | company users | all users + role definitions |
| Request types / workflows | – | – | – | ✔ |
| Audit / activity history | own activity | org scope | company scope | platform |

Internal roles (PRD §11 of part 2) are modelled as sub-roles with operation **and** data scope:
مدیر کل سازمان, کارشناس منابع انسانی سازمان, مسئول درخواست‌های سازمان, مدیر شرکت, مدیر پروژه شرکت,
کارشناس منابع انسانی شرکت, کارشناس قراردادها, کارشناس اجرایی.

## 3. Page inventory (implemented routes)

### Auth & system
| Code | Page | Route |
|---|---|---|
| AUTH-01 | ورود (password / OTP) | `/login` |
| AUTH-02 | تأیید شماره موبایل (OTP) | `/login/otp` |
| AUTH-03 | بازیابی رمز عبور | `/forgot-password` |
| SYS-01 | خطا / عدم دسترسی / نشست منقضی / نتیجه عملیات / وضعیت سامانه | `/error`, `/forbidden`, `/session-expired`, `/status`, `*` |

### Employee — `/me`
| Code | Page | Route |
|---|---|---|
| DASH-01 | داشبورد | `/me` |
| REQ-01 | مرکز درخواست‌ها | `/me/requests` |
| REQ-02/03 | ثبت درخواست + فرم پویا | `/me/requests/new` |
| REQ-04 | درخواست‌های من | `/me/requests` (tab) |
| REQ-05 | جزئیات و تاریخچه | `/me/requests/:id` |
| REQ-06 | تکمیل یا اصلاح | `/me/requests/:id/edit` |
| REQ-07 | نتیجه ثبت یا لغو | `/me/requests/:id/result` |
| — | اسناد من (hub) | `/me/documents` |
| CTR-01..04 | قراردادها، مشاهده، امضای پیامکی، رسید | `/me/documents/contracts[/:id[/sign\|/receipt]]` |
| PAY-01..03 | فیش‌ها، جزئیات، PDF | `/me/documents/payslips[/:id]` |
| DOC-01..04 | مدارک، ارسال، جزئیات، جایگزینی | `/me/documents/personnel[/upload\|/:id]` |
| PROF-01..06 | پروفایل و زیرصفحه‌ها | `/me/profile[/personal\|/job\|/contact\|/password\|/security]` |
| — | سوابق فعالیت شخصی | `/me/profile/activity` |
| NOT-01/02 | اعلان‌ها و جزئیات | `/me/notifications[/:id]` |
| HELP-01/02 | راهنما، پشتیبانی، حریم خصوصی | `/me/help`, `/me/support`, `/me/privacy` |
| — | جست‌وجوی اسناد | `/me/documents/search` |

### Organization — `/org` and company — `/company` (shared implementation, role-scoped)
| Code | Page | Org route | Company route |
|---|---|---|---|
| ORG-01 / CMP-01 | داشبورد | `/org` | `/company` |
| ORG-02 / CMP-04 | نیروها (inline + bulk edit) | `/org/workforce` | `/company/workforce` |
| ORG-03 | جزئیات نیرو | `/org/workforce/:id` | `/company/workforce/:id` |
| ORG-04 / CMP-05 | بررسی مدارک | `/org/documents` | `/company/documents` |
| ORG-05 / CMP-06 | مرکز درخواست‌ها (صف رسیدگی) | `/org/requests[/:id]` | `/company/requests[/:id]` |
| ORG-06 / CMP-07 | قراردادها | `/org/contracts[/:id]` | `/company/contracts[/:id]` |
| ORG-07 | اسناد سازمان / شرکت | `/org/files` | `/company/files` |
| — | پروژه‌ها | `/org/projects` (view) | `/company/projects` (CMP-02) |
| CMP-03 | جزئیات پروژه | `/org/projects/:id` | `/company/projects/:id` |
| CMP-08 | وظایف (فهرست/کانبان/تقویم) | `/org/tasks` | `/company/tasks` |
| CMP-09 | تقویم و مهلت‌ها | – | `/company/calendar` |
| CMP-10 | ورود/خروج Excel | – | `/company/import` |
| ORG-08 / CMP-11 | گزارش‌ها | `/org/reports` | `/company/reports` |
| BOTH-01 | اعلان‌ها و رویدادها | `/org/notifications` | `/company/notifications` |
| BOTH-02 | کاربران و دسترسی‌ها | `/org/users` | `/company/users` |
| BOTH-03 | تاریخچه فعالیت‌ها | `/org/activity` | `/company/activity` |
| — | تنظیمات | `/org/settings` | `/company/settings` |

### Admin — `/admin`
Overview, users, roles & permissions, organizations & companies, request types (form catalogue), workflows,
alert & notification rules, audit log, system status, settings.

## 4. Workflow map

1. **Request**: choose type → dynamic form → validate → submit → tracking no. → routed (company / org / both, ordered)
   → approve → *executed* (separate step) | reject (reason required) | needs correction → employee edits → resubmitted.
2. **Contract (employee)**: prepared → ready → viewed → read & accept → SMS OTP (expiry, attempt limit, resend cooldown)
   → signed by employee → (other parties) → fully signed → receipt + final copy.
3. **Contract (management)**: draft → company review → org review (if needed) → ready to send → awaiting worker
   → awaiting other party → partially signed → completed → active → near end → expired/terminated; reminders; automatic alerts.
4. **Document**: upload (type → requirements → file → preview → confirm) → pending review → approve | reject/deficiency
   (standard reason + note + optional deadline) → notify → new version (previous kept) → pending review.
5. **Excel import**: download template → upload → validate → preview (new / update / duplicate / error) → confirm → result report.
6. **Automatic tasks**: event rule → task linked to source record (deduplicated) → auto-closed when the cause is resolved.

## 5. Shared component inventory
Button, IconButton, Input, PasswordInput, SearchInput, Select, Combobox (searchable), JalaliDatePicker, TimeInput,
Textarea, Checkbox, RadioGroup, Switch, FileUploader (progress, preview, type/size checks), Progress, StatusBadge,
Card, DataTable (sort, select, column chooser, inline edit, responsive cards), Pagination, Tabs, Breadcrumbs,
DropdownMenu, Tooltip, Dialog, Drawer, Toast, ConfirmDialog, Timeline, EmptyState, Skeleton, ErrorState,
charts (bar list, stacked bar, progress ring), DocumentPreview, PageHeader, FilterBar, StatCard, Avatar, MaskedValue.

## 6. Ambiguities & assumptions

| # | Topic | Decision |
|---|---|---|
| A1 | Admin panel has no dedicated PRD section | Derived from the role definition and from "configurable" requirements. No business rules invented beyond configuration screens. |
| A2 | Identity verification via ثبت احوال / تأمین اجتماعی | Shown as a step on the forgot-password and OTP screens ("در محیط نمایشی شبیه‌سازی می‌شود"). The integration is a backend dependency. |
| A3 | Advance request allowed from day 10 | Implemented against the **local Jalali date**. The demo has a toggle (in the demo bar) to simulate days before the 10th. |
| A4 | Min/max advance amount | Read from the request-type config (demo: ۱۰٬۰۰۰٬۰۰۰ – ۵۰۰٬۰۰۰٬۰۰۰ ریال). Editable in the admin request-type screen. |
| A5 | Leave balance, holidays | The demo calendar counts Fridays plus a small sample holiday list. A real work calendar is a backend dependency. |
| A6 | Excel import | The client parses **CSV** (Excel → Save As CSV UTF-8). The template is downloaded as CSV. Native `.xlsx` parsing is left to the backend. |
| A7 | PDF generation (payslip / contract / receipt) | Uses browser print-to-PDF of a print-styled view. Real signed PDFs come from the backend. |
| A8 | Session timeout | Demo: 30 minutes of inactivity → `/session-expired`. |
| A9 | Contract approval by organization | Shown only for contracts in «در انتظار بررسی سازمان» and only for roles with that permission. |
| A10 | Currency | Amounts are stored and shown in **ریال**. A toman helper is shown on amount inputs. |
| A11 | Persisted data | All operations are simulated in memory and saved to `localStorage`. The UI labels this ("داده نمایشی — ذخیره در مرورگر"). |
