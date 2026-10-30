import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Check, Download, FileSpreadsheet, Pencil, SearchX, UserPlus, Users, X } from 'lucide-react'
import {
  Avatar,
  Button,
  ButtonLink,
  Callout,
  ConfirmDialog,
  DataTable,
  DatePicker,
  Dialog,
  EmptyState,
  Field,
  FilterBar,
  IconButton,
  Input,
  Ltr,
  PageHeader,
  PageState,
  SearchInput,
  Select,
  StatusBadge,
  useToast,
  type Column,
} from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { companyById, fullName, orgById, projectById, projectInScope, scopedEmployees, workerContractSummary, workerDocSummary } from '@/mock/selectors'
import { EMPLOYMENT_STATUS, WORKER_CONTRACT_SUMMARY, WORKER_DOC_SUMMARY } from '@/config/status'
import { SHIFT_LABEL } from '@/config/requestTypes'
import { formatDate, mask, toEnDigits, toFaDigits } from '@/lib/format'
import { isValidMobile, isValidNationalId } from '@/lib/validation'
import { toISODate } from '@/lib/jalali'
import type { Employee, EmploymentStatus } from '@/types/domain'
import { useMgmt } from './useMgmt'

type EditableKey = 'jobTitle' | 'projectId' | 'shift' | 'employmentStatus'
const FIELD_LABEL: Record<EditableKey, string> = { jobTitle: 'سمت شغلی', projectId: 'پروژه', shift: 'شیفت', employmentStatus: 'وضعیت اشتغال' }

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  // BOM so Excel opens UTF-8 Persian text correctly
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function WorkforcePage() {
  const m = useMgmt()
  const [addOpen, setAddOpen] = useState(false)
  return (
    <>
      <PageHeader
        title={m.isCompany ? 'مدیریت نیروها' : 'نیروهای مستقر در سازمان'}
        description="جست‌وجو، فیلتر و ویرایش اطلاعات مجاز نیروها در همان جدول. همه تغییرات در سوابق ثبت می‌شود."
        breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'نیروها' }]}
        actions={
          <>
            {m.can('workforce.import') ? (
              <ButtonLink to={`${m.base}/import`} variant="outline" icon={FileSpreadsheet}>
                ورود از Excel
              </ButtonLink>
            ) : null}
            {m.can('workforce.edit') ? (
              <Button icon={UserPlus} onClick={() => setAddOpen(true)}>
                افزودن نیرو
              </Button>
            ) : null}
          </>
        }
      />
      <PageState>{({ empty }) => <Table empty={empty} />}</PageState>
      {addOpen ? <AddWorkerDialog onClose={() => setAddOpen(false)} /> : null}
    </>
  )
}

function Table({ empty }: { empty: boolean }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [project, setProject] = useState('')
  const [counterpart, setCounterpart] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [docs, setDocs] = useState('')
  const [contract, setContract] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ id: string; field: EditableKey; value: string } | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<{ id: string; value: EmploymentStatus } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const canEdit = m.can('workforce.edit')
  const sensitive = m.can('workforce.sensitive')
  const projects = db.projects.filter((p) => projectInScope(m.scope, p) && p.status !== 'closed')

  const all = empty ? [] : scopedEmployees(db, m.scope)
  const rows = useMemo(() => {
    const query = toEnDigits(q.trim())
    return all.filter(
      (e) =>
        (!query || fullName(e).includes(q.trim()) || e.personnelNo.includes(query.toUpperCase()) || (sensitive && e.nationalId.includes(query))) &&
        (!project || (project === 'none' ? !e.projectId : e.projectId === project)) &&
        (!counterpart || (m.isCompany ? e.orgId === counterpart : e.companyId === counterpart)) &&
        (!status || e.employmentStatus === status) &&
        (!docs || workerDocSummary(db, e) === docs) &&
        (!contract || workerContractSummary(db, e) === contract),
    )
  }, [all, q, project, counterpart, status, docs, contract, db, m.isCompany, sensitive])

  const saveInline = async () => {
    if (!editing) return
    if (editing.field === 'employmentStatus') {
      setStatusConfirm({ id: editing.id, value: editing.value as EmploymentStatus })
      return
    }
    try {
      await actions.updateEmployeeFields([editing.id], { [editing.field]: editing.value || null }, 'inline')
      toast.success('تغییر ذخیره شد', `${FIELD_LABEL[editing.field]} به‌روز شد و در سوابق ثبت شد.`)
      setEditing(null)
    } catch (e) {
      toast.fromError(e)
    }
  }

  const editableCell = (e: Employee, field: EditableKey, display: React.ReactNode, editor: React.ReactNode, perm = canEdit) => {
    if (editing && editing.id === e.id && editing.field === field) {
      return (
        <div className="flex min-w-44 items-center gap-1" data-no-row-click>
          <div className="flex-1">{editor}</div>
          <IconButton icon={Check} label="ذخیره" size="sm" variant="primary" onClick={saveInline} />
          <IconButton icon={X} label="انصراف" size="sm" onClick={() => setEditing(null)} />
        </div>
      )
    }
    return (
      <div className="group/cell flex items-center gap-1">
        <span className="min-w-0">{display}</span>
        {perm ? (
          <button
            type="button"
            onClick={() => setEditing({ id: e.id, field, value: String(e[field] ?? '') })}
            className="grid size-6 shrink-0 place-items-center rounded text-ink-400 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-700 focus:opacity-100 group-hover/cell:opacity-100"
            aria-label={`ویرایش ${FIELD_LABEL[field]} ${fullName(e)}`}
          >
            <Pencil size={13} />
          </button>
        ) : null}
      </div>
    )
  }

  const ed = (onChange: (v: string) => void, value: string, options?: { value: string; label: string }[]) =>
    options ? (
      <Select aria-label="مقدار جدید" value={value} onChange={(e) => onChange(e.target.value)} options={options} className="[&_select]:h-8" autoFocus />
    ) : (
      <Input aria-label="مقدار جدید" value={value} onChange={(e) => onChange(e.target.value)} className="h-8" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveInline()} />
    )
  const setVal = (v: string) => setEditing((x) => (x ? { ...x, value: v } : x))
  const projectOptions = [{ value: '', label: 'بدون پروژه' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]
  const shiftOptions = Object.entries(SHIFT_LABEL).map(([value, label]) => ({ value, label }))
  const statusOptions = (Object.keys(EMPLOYMENT_STATUS) as EmploymentStatus[]).map((s) => ({ value: s, label: EMPLOYMENT_STATUS[s].label }))

  const columns: Column<Employee>[] = [
    { id: 'no', header: 'کد پرسنلی', cell: (e) => <Ltr className="text-xs text-ink-600">{e.personnelNo}</Ltr>, sortValue: (e) => e.personnelNo },
    {
      id: 'name',
      header: 'نام و نام خانوادگی',
      cell: (e) => (
        <Link to={`${m.base}/workforce/${e.id}`} className="flex items-center gap-2 font-medium text-ink-900 hover:text-brand-700 hover:underline">
          <Avatar name={fullName(e)} color={e.photoColor} size={28} />
          {fullName(e)}
        </Link>
      ),
      sortValue: (e) => e.lastName,
    },
    { id: 'nid', header: 'کد ملی', label: 'کد ملی', hideable: true, cell: (e) => <Ltr className="text-xs">{sensitive ? e.nationalId : mask(e.nationalId, 3)}</Ltr> },
    { id: 'org', header: m.isCompany ? 'سازمان محل خدمت' : 'سازمان', label: 'سازمان محل خدمت', hideable: true, defaultHidden: !m.isCompany, cell: (e) => <span className="block max-w-40 truncate text-xs" title={orgById(db, e.orgId)?.name}>{orgById(db, e.orgId)?.name}</span> },
    { id: 'company', header: 'شرکت تأمین‌کننده', label: 'شرکت تأمین‌کننده', hideable: true, defaultHidden: m.isCompany, cell: (e) => <span className="block max-w-40 truncate text-xs" title={companyById(db, e.companyId)?.name}>{companyById(db, e.companyId)?.name}</span> },
    {
      id: 'project',
      header: 'پروژه',
      label: 'پروژه',
      hideable: true,
      sortValue: (e) => projectById(db, e.projectId)?.name ?? '',
      cell: (e) => editableCell(e, 'projectId', <span className="block max-w-44 truncate text-xs" title={projectById(db, e.projectId)?.name}>{projectById(db, e.projectId)?.name ?? <span className="text-ink-400">خارج از پروژه</span>}</span>, ed(setVal, editing?.value ?? '', projectOptions)),
    },
    { id: 'job', header: 'سمت شغلی', label: 'سمت شغلی', hideable: true, sortValue: (e) => e.jobTitle, cell: (e) => editableCell(e, 'jobTitle', <span className="text-xs">{e.jobTitle}</span>, ed(setVal, editing?.value ?? '')) },
    { id: 'shift', header: 'شیفت', label: 'شیفت', hideable: true, defaultHidden: true, cell: (e) => editableCell(e, 'shift', <span className="text-xs">{SHIFT_LABEL[e.shift]}</span>, ed(setVal, editing?.value ?? '', shiftOptions)) },
    {
      id: 'status',
      header: 'وضعیت اشتغال',
      label: 'وضعیت اشتغال',
      hideable: true,
      sortValue: (e) => e.employmentStatus,
      cell: (e) => editableCell(e, 'employmentStatus', <StatusBadge meta={EMPLOYMENT_STATUS[e.employmentStatus]} size="sm" />, ed(setVal, editing?.value ?? '', statusOptions), canEdit && m.can('workforce.status')),
    },
    { id: 'docs', header: 'مدارک', label: 'وضعیت مدارک', hideable: true, cell: (e) => <StatusBadge meta={WORKER_DOC_SUMMARY[workerDocSummary(db, e)]} variant="dot" />, sortValue: (e) => workerDocSummary(db, e) },
    { id: 'contract', header: 'قرارداد', label: 'وضعیت قرارداد', hideable: true, cell: (e) => <StatusBadge meta={WORKER_CONTRACT_SUMMARY[workerContractSummary(db, e)]} variant="dot" />, sortValue: (e) => workerContractSummary(db, e) },
    { id: 'start', header: 'شروع همکاری', label: 'تاریخ شروع همکاری', hideable: true, defaultHidden: true, cell: (e) => <span className="text-xs">{formatDate(e.startDate, 'short')}</span>, sortValue: (e) => e.startDate },
  ]

  const exportCsv = () => {
    downloadCsv(
      `workforce-${toISODate(new Date())}.csv`,
      ['کد پرسنلی', 'نام', 'نام خانوادگی', 'کد ملی', 'سازمان', 'شرکت', 'پروژه', 'سمت', 'وضعیت اشتغال', 'مدارک', 'قرارداد', 'شروع همکاری'],
      rows.map((e) => [
        e.personnelNo,
        e.firstName,
        e.lastName,
        // Export respects the viewer's permission level
        sensitive ? e.nationalId : mask(e.nationalId, 3),
        orgById(db, e.orgId)?.name ?? '',
        companyById(db, e.companyId)?.name ?? '',
        projectById(db, e.projectId)?.name ?? '',
        e.jobTitle,
        EMPLOYMENT_STATUS[e.employmentStatus].label,
        WORKER_DOC_SUMMARY[workerDocSummary(db, e)].label,
        WORKER_CONTRACT_SUMMARY[workerContractSummary(db, e)].label,
        formatDate(e.startDate, 'short'),
      ]),
    )
    toast.success('فایل خروجی آماده شد', `${toFaDigits(rows.length)} ردیف — قابل باز شدن در Excel`)
  }

  if (all.length === 0) return <EmptyState icon={Users} title="نیرویی در محدوده شما ثبت نشده است" description="نیروهای جدید را از طریق فرم افزودن یا ورود گروهی Excel ثبت کنید." />

  const counterparts = m.isCompany ? db.organizations.filter((o) => all.some((e) => e.orgId === o.id)) : db.companies.filter((c) => all.some((e) => e.companyId === c.id))
  const active = [project, counterpart, status, docs, contract].filter(Boolean).length

  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder={sensitive ? 'نام، کد پرسنلی یا کد ملی' : 'نام یا کد پرسنلی'} />}
        activeCount={active}
        onClear={() => {
          setProject('')
          setCounterpart('')
          setStatus('')
          setDocs('')
          setContract('')
        }}
        actions={
          <Button variant="outline" icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
            خروجی Excel
          </Button>
        }
      >
        <Select aria-label="پروژه" className="w-full sm:w-48" value={project} onChange={(e) => setProject(e.target.value)} placeholder="همه پروژه‌ها" options={[...projects.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: 'خارج از پروژه' }]} />
        {counterparts.length > 1 ? <Select aria-label={m.isCompany ? 'سازمان' : 'شرکت'} className="w-full sm:w-44" value={counterpart} onChange={(e) => setCounterpart(e.target.value)} placeholder={m.isCompany ? 'همه سازمان‌ها' : 'همه شرکت‌ها'} options={counterparts.map((c) => ({ value: c.id, label: c.name }))} /> : null}
        <Select aria-label="وضعیت اشتغال" className="w-full sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="وضعیت اشتغال" options={statusOptions} />
        <Select aria-label="وضعیت مدارک" className="w-full sm:w-36" value={docs} onChange={(e) => setDocs(e.target.value)} placeholder="وضعیت مدارک" options={Object.entries(WORKER_DOC_SUMMARY).map(([value, x]) => ({ value, label: x.label }))} />
        <Select aria-label="وضعیت قرارداد" className="w-full sm:w-40" value={contract} onChange={(e) => setContract(e.target.value)} placeholder="وضعیت قرارداد" options={Object.entries(WORKER_CONTRACT_SUMMARY).map(([value, x]) => ({ value, label: x.label }))} />
      </FilterBar>

      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-sm font-medium text-brand-900">{toFaDigits(selected.size)} نیرو انتخاب شده</span>
          <div className="flex gap-2">
            {m.can('workforce.bulk') ? (
              <Button size="sm" icon={Pencil} onClick={() => setBulkOpen(true)}>
                ویرایش گروهی
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              لغو انتخاب
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        getId={(e) => e.id}
        selectable={m.can('workforce.bulk')}
        selected={selected}
        onSelectedChange={setSelected}
        columnChooser
        pageSize={12}
        caption="جدول نیروها"
        initialSort={{ id: 'name', dir: 'asc' }}
        mobileCard={(e, sel) => (
          <div className="flex items-start gap-3">
            {sel ? <div className="pt-1">{sel}</div> : null}
            <Link to={`${m.base}/workforce/${e.id}`} className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar name={fullName(e)} color={e.photoColor} size={32} />
                  <div>
                    <p className="text-sm font-semibold">{fullName(e)}</p>
                    <p className="text-2xs text-ink-500">
                      <Ltr>{e.personnelNo}</Ltr>، {e.jobTitle}
                    </p>
                  </div>
                </div>
                <StatusBadge meta={EMPLOYMENT_STATUS[e.employmentStatus]} size="sm" />
              </div>
              <p className="mt-2 truncate text-xs text-ink-600">{projectById(db, e.projectId)?.name ?? 'خارج از پروژه'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge meta={WORKER_DOC_SUMMARY[workerDocSummary(db, e)]} size="sm" />
                <StatusBadge meta={WORKER_CONTRACT_SUMMARY[workerContractSummary(db, e)]} size="sm" />
              </div>
            </Link>
          </div>
        )}
        empty={<EmptyState compact icon={SearchX} title="نیرویی با این مشخصات پیدا نشد" />}
      />

      <ConfirmDialog
        open={statusConfirm !== null}
        onClose={() => setStatusConfirm(null)}
        tone="warning"
        title="تغییر وضعیت اشتغال؟"
        description={statusConfirm ? `وضعیت به «${EMPLOYMENT_STATUS[statusConfirm.value].label}» تغییر می‌کند. سوابق قرارداد، فیش و مدارک حفظ می‌شود.` : ''}
        confirmLabel="تأیید تغییر"
        onConfirm={async () => {
          if (!statusConfirm) return
          try {
            await actions.updateEmployeeFields([statusConfirm.id], { employmentStatus: statusConfirm.value }, 'inline')
            toast.success('وضعیت اشتغال تغییر کرد')
            setEditing(null)
          } catch (e) {
            toast.fromError(e)
          }
          setStatusConfirm(null)
        }}
      />
      {bulkOpen ? <BulkEditDialog ids={[...selected]} onClose={() => setBulkOpen(false)} onDone={() => setSelected(new Set())} projects={projectOptions} /> : null}
    </>
  )
}

function BulkEditDialog({ ids, onClose, onDone, projects }: { ids: string[]; onClose: () => void; onDone: () => void; projects: { value: string; label: string }[] }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const [field, setField] = useState<EditableKey>('projectId')
  const [value, setValue] = useState('')
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState(false)
  const emps = ids.map((id) => db.employees.find((e) => e.id === id)!).filter(Boolean)
  const show = (v: string) =>
    field === 'projectId' ? projectById(db, v)?.name ?? 'بدون پروژه' : field === 'shift' ? SHIFT_LABEL[v] ?? v : field === 'employmentStatus' ? EMPLOYMENT_STATUS[v as EmploymentStatus]?.label ?? v : v || '—'
  const changes = emps.filter((e) => String(e[field] ?? '') !== value)
  const fields: EditableKey[] = ['projectId', 'jobTitle', 'shift', ...(m.can('workforce.status') ? (['employmentStatus'] as EditableKey[]) : [])]
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissable={!busy}
      title={step === 'edit' ? `ویرایش گروهی ${toFaDigits(ids.length)} نیرو` : 'پیش‌نمایش تغییرات'}
      description={step === 'edit' ? 'فیلد و مقدار جدید را انتخاب کنید. پیش از ثبت، فهرست تغییرات را بازبینی می‌کنید.' : 'ردیف‌هایی که مقدارشان تغییر نمی‌کند نادیده گرفته می‌شوند.'}
      footer={
        step === 'edit' ? (
          <>
            <Button variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button onClick={() => setStep('preview')} disabled={field === 'jobTitle' ? !value.trim() : field !== 'projectId' && !value}>
              پیش‌نمایش تغییرات
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep('edit')} disabled={busy}>
              بازگشت
            </Button>
            <Button
              loading={busy}
              disabled={changes.length === 0}
              onClick={async () => {
                setBusy(true)
                try {
                  await actions.updateEmployeeFields(
                    changes.map((e) => e.id),
                    { [field]: value || null },
                    'bulk',
                  )
                  toast.success('ویرایش گروهی ثبت شد', `${toFaDigits(changes.length)} نیرو به‌روز شد.`)
                  onDone()
                  onClose()
                } catch (e) {
                  toast.fromError(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              تأیید نهایی و ثبت ({toFaDigits(changes.length)})
            </Button>
          </>
        )
      }
    >
      {step === 'edit' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="فیلد">
            {(p) => (
              <Select
                id={p.id}
                value={field}
                onChange={(e) => {
                  setField(e.target.value as EditableKey)
                  setValue('')
                }}
                options={fields.map((f) => ({ value: f, label: FIELD_LABEL[f] }))}
              />
            )}
          </Field>
          <Field label="مقدار جدید">
            {(p) =>
              field === 'jobTitle' ? (
                <Input id={p.id} value={value} onChange={(e) => setValue(e.target.value)} />
              ) : (
                <Select
                  id={p.id}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={field === 'projectId' ? undefined : 'انتخاب کنید'}
                  options={field === 'projectId' ? projects : field === 'shift' ? Object.entries(SHIFT_LABEL).map(([v, l]) => ({ value: v, label: l })) : Object.entries(EMPLOYMENT_STATUS).map(([v, x]) => ({ value: v, label: x.label }))}
                />
              )
            }
          </Field>
          {field === 'projectId' ? <Callout tone="info" className="sm:col-span-2">انتقال یا خروج از پروژه، سوابق قرارداد، فیش، مدارک و درخواست‌های نیرو را حذف نمی‌کند.</Callout> : null}
        </div>
      ) : changes.length === 0 ? (
        <EmptyState compact icon={Check} title="تغییری اعمال نمی‌شود" description="مقدار فعلی همه نیروهای انتخاب‌شده با مقدار جدید یکسان است." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-ink-200">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs text-ink-600">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">نیرو</th>
                <th className="px-3 py-2 text-start font-semibold">مقدار فعلی</th>
                <th className="px-3 py-2 text-start font-semibold">مقدار جدید</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((e) => (
                <tr key={e.id} className="border-t border-ink-100">
                  <td className="px-3 py-2">{fullName(e)}</td>
                  <td className="px-3 py-2 text-ink-500 line-through decoration-ink-300">{show(String(e[field] ?? ''))}</td>
                  <td className="px-3 py-2 font-medium text-emerald-700">{show(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  )
}

function AddWorkerDialog({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const m = useMgmt()
  const actions = useActions()
  const toast = useToast()
  const projects = db.projects.filter((p) => projectInScope(m.scope, p) && p.status !== 'closed')
  const [v, setV] = useState({ firstName: '', lastName: '', nationalId: '', mobile: '', personnelNo: '', projectCode: projects[0]?.code ?? '', jobTitle: '', startDate: toISODate(new Date()) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof v, val: string) => setV((x) => ({ ...x, [k]: val }))
  const submit = async () => {
    const e: Record<string, string> = {}
    if (!v.firstName.trim()) e.firstName = 'نام را وارد کنید.'
    if (!v.lastName.trim()) e.lastName = 'نام خانوادگی را وارد کنید.'
    if (!isValidNationalId(v.nationalId)) e.nationalId = 'کد ملی معتبر نیست.'
    if (!isValidMobile(v.mobile)) e.mobile = 'شماره موبایل معتبر نیست.'
    if (!v.personnelNo.trim()) e.personnelNo = 'کد پرسنلی را وارد کنید.'
    if (!v.jobTitle.trim()) e.jobTitle = 'سمت شغلی را وارد کنید.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await actions.addEmployee({ ...v, nationalId: toEnDigits(v.nationalId), mobile: toEnDigits(v.mobile), personnelNo: toEnDigits(v.personnelNo).toUpperCase() })
      toast.success('نیروی جدید ثبت شد', 'وضعیت اشتغال «در انتظار شروع» است تا مدارک و قرارداد تکمیل شود.')
      onClose()
    } catch (err) {
      toast.fromError(err)
    } finally {
      setBusy(false)
    }
  }
  const field = (k: keyof typeof v, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Field label={label} required error={errors[k]}>
      {(p) => <Input id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} value={v[k]} onChange={(e) => set(k, e.target.value)} {...extra} />}
    </Field>
  )
  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      title="افزودن نیروی جدید"
      description="نیرو به پروژه انتخاب‌شده اضافه می‌شود. برای ورود تعداد زیاد، از ورود گروهی Excel استفاده کنید."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={submit} loading={busy}>
            ثبت نیرو
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field('firstName', 'نام')}
        {field('lastName', 'نام خانوادگی')}
        {field('nationalId', 'کد ملی', { ltr: true, inputMode: 'numeric', maxLength: 10 })}
        {field('mobile', 'شماره موبایل', { ltr: true, inputMode: 'tel', maxLength: 11, placeholder: '09xxxxxxxxx' })}
        {field('personnelNo', 'کد پرسنلی', { ltr: true, placeholder: 'PA-10999' })}
        {field('jobTitle', 'سمت شغلی')}
        <Field label="پروژه" required>
          {(p) => <Select id={p.id} value={v.projectCode} onChange={(e) => set('projectCode', e.target.value)} options={projects.map((x) => ({ value: x.code, label: x.name }))} />}
        </Field>
        <Field label="تاریخ شروع همکاری" required>
          {(p) => <DatePicker id={p.id} value={v.startDate} onChange={(d) => set('startDate', d)} clearable={false} />}
        </Field>
      </div>
    </Dialog>
  )
}
