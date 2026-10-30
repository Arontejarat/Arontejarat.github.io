import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, Bell, Briefcase, Building2, ChevronLeft, Mail, MessageSquareText, Pencil, Plus, Save, Trash2, Workflow, X } from 'lucide-react'
import {
  Badge,
  BarList,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  Dialog,
  Drawer,
  Field,
  IconButton,
  Input,
  Ltr,
  PageHeader,
  PageState,
  Select,
  StatCard,
  Switch,
  Tabs,
  Textarea,
  useToast,
  type Column,
} from '@/components/ui'
import { useActions } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { PARTY_LABEL, REQUEST_CATEGORIES } from '@/config/requestTypes'
import { DOC_TYPES } from '@/config/documentTypes'
import { iconFor } from '@/config/icons'
import { activeParty, currentVersion, requestType } from '@/mock/selectors'
import { daysUntil, formatNumber, formatRial, toEnDigits, toFaDigits } from '@/lib/format'
import type { AlertRule, Party, RequestTypeDef } from '@/types/domain'
import { cn } from '@/lib/cn'
import { RoleMatrix } from '@/features/mgmt/Users'
import { SUBROLES } from '@/config/permissions'
import { Hourglass, Inbox, FileCheck2, ListTodo } from 'lucide-react'

/* ---------------- Organisations & companies ---------------- */

export function AdminOrganizationsPage() {
  const db = useDB()
  const actions = useActions()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'org' | 'company') ?? 'org'
  const [edit, setEdit] = useState<{ kind: 'org' | 'company'; id?: string } | null>(null)
  const list = tab === 'org' ? db.organizations : db.companies
  type Row = (typeof list)[number]
  const columns: Column<Row>[] = [
    { id: 'name', header: 'نام', cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { id: 'kind', header: tab === 'org' ? 'نوع' : 'شماره ثبت', cell: (r) => <span className="text-xs">{'kind' in r ? r.kind : r.registrationNo}</span> },
    { id: 'city', header: 'شهر', cell: (r) => r.city },
    { id: 'contact', header: 'رابط', cell: (r) => <span className="text-xs">{r.contactName}، <Ltr>{r.contactPhone}</Ltr></span> },
    { id: 'projects', header: 'پروژه‌ها', cell: (r) => toFaDigits(db.projects.filter((p) => (tab === 'org' ? p.orgId : p.companyId) === r.id).length) },
    { id: 'users', header: 'کاربران', cell: (r) => toFaDigits(db.users.filter((u) => (tab === 'org' ? u.orgId : u.companyId) === r.id).length) },
    { id: 'status', header: 'وضعیت', cell: (r) => <Badge size="sm" tone={r.status === 'active' ? 'success' : 'muted'}>{r.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge> },
    { id: 'act', header: <span className="sr-only">ویرایش</span>, cell: (r) => <IconButton icon={Pencil} size="sm" label={`ویرایش ${r.name}`} onClick={() => setEdit({ kind: tab, id: r.id })} /> },
  ]
  return (
    <>
      <PageHeader title="سازمان‌ها و شرکت‌ها" description="ساختار سازمانی پلتفرم: سازمان‌های درخواست‌دهنده و شرکت‌های تأمین نیرو." actions={<Button icon={Plus} onClick={() => setEdit({ kind: tab })}>{tab === 'org' ? 'سازمان جدید' : 'شرکت جدید'}</Button>} />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { id: 'org', label: 'سازمان‌های درخواست‌دهنده', icon: Building2, count: db.organizations.length },
          { id: 'company', label: 'شرکت‌های تأمین نیرو', icon: Briefcase, count: db.companies.length },
        ]}
      />
      <PageState loadKey={tab}>{() => <DataTable rows={list as Row[]} columns={columns} getId={(r) => r.id} caption={tab === 'org' ? 'سازمان‌ها' : 'شرکت‌ها'} mobileCard={(r) => (<div className="flex items-start justify-between"><div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-ink-500">{r.city}، {r.contactName}</p></div><IconButton icon={Pencil} size="sm" label="ویرایش" onClick={() => setEdit({ kind: tab, id: r.id })} /></div>)} />}</PageState>
      {edit ? (
        <OrgDialog
          kind={edit.kind}
          initial={edit.id ? (edit.kind === 'org' ? db.organizations.find((o) => o.id === edit.id) : db.companies.find((c) => c.id === edit.id)) : undefined}
          onClose={() => setEdit(null)}
          onSave={async (data) => {
            try {
              await actions.upsertOrganization(edit.kind, data)
              toast.success('ذخیره شد')
              setEdit(null)
            } catch (x) {
              toast.fromError(x)
            }
          }}
        />
      ) : null}
    </>
  )
}

function OrgDialog({ kind, initial, onClose, onSave }: { kind: 'org' | 'company'; initial?: { id: string; name: string; city: string; contactName: string; contactPhone: string; status: 'active' | 'inactive'; kind?: string; registrationNo?: string }; onClose: () => void; onSave: (d: Parameters<ReturnType<typeof useActions>['upsertOrganization']>[1]) => void }) {
  const [v, setV] = useState({ name: initial?.name ?? '', city: initial?.city ?? '', contactName: initial?.contactName ?? '', contactPhone: initial?.contactPhone ?? '', status: initial?.status ?? 'active', kind: initial?.kind ?? 'بیمارستان', registrationNo: initial?.registrationNo ?? '' })
  const [err, setErr] = useState('')
  return (
    <Dialog
      open
      onClose={onClose}
      title={initial ? `ویرایش ${initial.name}` : kind === 'org' ? 'ثبت سازمان جدید' : 'ثبت شرکت جدید'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button icon={Save} onClick={() => (v.name.trim() && v.city.trim() ? onSave({ id: initial?.id, ...v, status: v.status as 'active' | 'inactive' }) : setErr('نام و شهر الزامی است.'))}>
            ذخیره
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام" required error={err && !v.name ? err : undefined}>{(p) => <Input id={p.id} invalid={p.invalid} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
        <Field label="شهر" required>{(p) => <Input id={p.id} value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />}</Field>
        {kind === 'org' ? (
          <Field label="نوع سازمان">{(p) => <Select id={p.id} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })} options={['بیمارستان', 'شهرداری', 'دانشگاه', 'اداره دولتی', 'شرکت خصوصی'].map((x) => ({ value: x, label: x }))} />}</Field>
        ) : (
          <Field label="شماره ثبت">{(p) => <Input id={p.id} value={v.registrationNo} onChange={(e) => setV({ ...v, registrationNo: e.target.value })} />}</Field>
        )}
        <Field label="وضعیت">{(p) => <Select id={p.id} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as 'active' | 'inactive' })} options={[{ value: 'active', label: 'فعال' }, { value: 'inactive', label: 'غیرفعال' }]} />}</Field>
        <Field label="نام رابط">{(p) => <Input id={p.id} value={v.contactName} onChange={(e) => setV({ ...v, contactName: e.target.value })} />}</Field>
        <Field label="تلفن رابط">{(p) => <Input id={p.id} ltr value={v.contactPhone} onChange={(e) => setV({ ...v, contactPhone: e.target.value })} />}</Field>
      </div>
      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
    </Dialog>
  )
}

/* ---------------- Request types ---------------- */

export function AdminRequestTypesPage() {
  const db = useDB()
  const actions = useActions()
  const toast = useToast()
  const [edit, setEdit] = useState<RequestTypeDef | null>(null)
  return (
    <>
      <PageHeader title="انواع درخواست و فرم‌ها" description="فهرست کشویی مرکز درخواست‌ها از این تنظیمات ساخته می‌شود. افزودن نوع جدید نیازی به تغییر منوی اصلی ندارد." breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'انواع درخواست' }]} />
      <PageState>
        {() => (
          <div className="space-y-5">
            {REQUEST_CATEGORIES.map((c) => (
              <section key={c.id}>
                <h2 className="mb-2 text-sm font-bold text-ink-700">{c.title}</h2>
                <Card padded={false}>
                  <ul className="divide-y divide-ink-100">
                    {db.requestTypes
                      .filter((t) => t.category === c.id)
                      .map((t) => {
                        const Icon = iconFor(t.icon)
                        return (
                          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className={cn('grid size-9 place-items-center rounded-lg', t.enabled ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-400')}>
                              <Icon size={17} aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm font-semibold', !t.enabled && 'text-ink-500')}>{t.title}</p>
                              <p className="text-2xs text-ink-500">
                                <Ltr>{t.id}</Ltr>، {toFaDigits(t.fields.length)} فیلد، مهلت {toFaDigits(t.slaDays)} روز، {t.workflow.map((w) => PARTY_LABEL[w.party]).join(' ← ')}
                              </p>
                            </div>
                            <Switch
                              checked={t.enabled}
                              onChange={async (v) => {
                                try {
                                  await actions.updateRequestType({ ...t, enabled: v })
                                  toast.success(v ? `«${t.title}» فعال شد` : `«${t.title}» غیرفعال شد`, v ? 'این گزینه در مرکز درخواست‌های نیروها نمایش داده می‌شود.' : 'درخواست‌های ثبت‌شده قبلی حفظ می‌شوند.')
                                } catch (x) {
                                  toast.fromError(x)
                                }
                              }}
                              label={<span className="sr-only">فعال بودن {t.title}</span>}
                            />
                            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(structuredClone(t))}>
                              تنظیمات
                            </Button>
                          </li>
                        )
                      })}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}
      </PageState>
      {edit ? <TypeEditor def={edit} onClose={() => setEdit(null)} /> : null}
    </>
  )
}

function TypeEditor({ def, onClose }: { def: RequestTypeDef; onClose: () => void }) {
  const actions = useActions()
  const toast = useToast()
  const [t, setT] = useState(def)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<RequestTypeDef>) => setT({ ...t, ...patch })
  const setRule = (k: keyof NonNullable<RequestTypeDef['rules']>, v: number | boolean | undefined) => set({ rules: { ...t.rules, [k]: v } })
  const num = (s: string) => (s.trim() === '' ? undefined : Number(toEnDigits(s).replace(/\D/g, '')))
  const moveStep = (i: number, d: -1 | 1) => {
    const w = [...t.workflow]
    ;[w[i], w[i + d]] = [w[i + d], w[i]]
    set({ workflow: w })
  }
  return (
    <Drawer
      open
      onClose={onClose}
      width="xl"
      title={`تنظیمات «${def.title}»`}
      description="تغییرات فقط روی درخواست‌های جدید اعمال می‌شود."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button
            icon={Save}
            loading={busy}
            onClick={async () => {
              if (!t.title.trim() || t.workflow.length === 0) return toast.error('عنوان و دست‌کم یک مرحله گردش کار الزامی است')
              setBusy(true)
              try {
                await actions.updateRequestType(t)
                toast.success('تنظیمات نوع درخواست ذخیره شد')
                onClose()
              } catch (x) {
                toast.fromError(x)
              } finally {
                setBusy(false)
              }
            }}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان" required>{(p) => <Input id={p.id} value={t.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
          <Field label="دسته">{(p) => <Select id={p.id} value={t.category} onChange={(e) => set({ category: e.target.value as RequestTypeDef['category'] })} options={REQUEST_CATEGORIES.map((c) => ({ value: c.id, label: c.title }))} />}</Field>
          <Field label="توضیح برای نیروی کار" className="sm:col-span-2">{(p) => <Textarea id={p.id} value={t.description} onChange={(e) => set({ description: e.target.value })} className="min-h-16" />}</Field>
          <Field label="زمان هدف رسیدگی (روز)">{(p) => <Input id={p.id} ltr value={String(t.slaDays)} onChange={(e) => set({ slaDays: num(e.target.value) ?? 1 })} />}</Field>
          <Field label="عنوان مرحله اجرا" optionalLabel helper="مثلاً «پرداخت مساعده»؛ خالی یعنی تأیید، پایان کار است.">{(p) => <Input id={p.id} value={t.executionLabel ?? ''} onChange={(e) => set({ executionLabel: e.target.value || undefined })} />}</Field>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-bold">قواعد</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="حداقل مبلغ (ریال)" optionalLabel helper={t.rules?.minAmount ? formatRial(t.rules.minAmount) : undefined}>{(p) => <Input id={p.id} ltr value={t.rules?.minAmount ? String(t.rules.minAmount) : ''} onChange={(e) => setRule('minAmount', num(e.target.value))} />}</Field>
            <Field label="حداکثر مبلغ (ریال)" optionalLabel helper={t.rules?.maxAmount ? formatRial(t.rules.maxAmount) : undefined}>{(p) => <Input id={p.id} ltr value={t.rules?.maxAmount ? String(t.rules.maxAmount) : ''} onChange={(e) => setRule('maxAmount', num(e.target.value))} />}</Field>
            <Field label="قابل ثبت از روز ... ماه" optionalLabel>{(p) => <Input id={p.id} ltr value={t.rules?.availableFromDay ? String(t.rules.availableFromDay) : ''} onChange={(e) => setRule('availableFromDay', num(e.target.value))} />}</Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox checked={Boolean(t.rules?.singleOpen)} onChange={(v) => setRule('singleOpen', v)} label="جلوگیری از درخواست هم‌زمان" description="تا تعیین تکلیف درخواست قبلی، درخواست جدید ثبت نشود" />
            <Checkbox checked={Boolean(t.confidentialAllowed)} onChange={(v) => set({ confidentialAllowed: v })} label="امکان ثبت محرمانه" />
          </div>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-bold">گردش کار تأیید</h3>
          <p className="mb-3 text-xs text-ink-500">مرجع رسیدگی و ترتیب تأیید. درخواست به ترتیب از مراحل زیر عبور می‌کند.</p>
          <ol className="space-y-2">
            {t.workflow.map((w, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 p-2.5">
                <span className="grid size-7 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">{toFaDigits(i + 1)}</span>
                <Select aria-label="مرجع" className="w-44" value={w.party} onChange={(e) => set({ workflow: t.workflow.map((x, j) => (j === i ? { ...x, party: e.target.value as Party } : x)) })} options={[{ value: 'company', label: PARTY_LABEL.company }, { value: 'org', label: PARTY_LABEL.org }]} />
                <Input aria-label="عنوان مرحله" className="min-w-40 flex-1" value={w.label} onChange={(e) => set({ workflow: t.workflow.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <IconButton icon={ArrowUp} size="sm" label="انتقال به بالا" disabled={i === 0} onClick={() => moveStep(i, -1)} />
                <IconButton icon={ArrowDown} size="sm" label="انتقال به پایین" disabled={i === t.workflow.length - 1} onClick={() => moveStep(i, 1)} />
                <IconButton icon={Trash2} size="sm" variant="danger-ghost" label="حذف مرحله" disabled={t.workflow.length === 1} onClick={() => set({ workflow: t.workflow.filter((_, j) => j !== i) })} />
              </li>
            ))}
          </ol>
          <Button variant="link" size="sm" icon={Plus} className="mt-2" onClick={() => set({ workflow: [...t.workflow, { party: 'company', label: 'مرحله جدید' }] })}>
            افزودن مرحله
          </Button>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-bold">فیلدهای فرم</h3>
          <p className="mb-3 text-xs text-ink-500">الزامی بودن هر فیلد قابل تنظیم است. افزودن نوع فیلد جدید نیازمند پیکربندی سمت سرور است.</p>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {t.fields.map((f, i) => (
              <li key={f.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">
                  {f.label}
                  <span className="ms-2 text-2xs text-ink-500">
                    <Ltr>{f.kind}</Ltr>
                    {f.sensitive ? '، حساس' : ''}
                    {f.showIf ? '، شرطی' : ''}
                  </span>
                </span>
                {f.kind === 'readonly' ? (
                  <Badge size="sm" tone="muted">خودکار</Badge>
                ) : (
                  <Checkbox checked={Boolean(f.required)} onChange={(v) => set({ fields: t.fields.map((x, j) => (j === i ? { ...x, required: v } : x)) })} label="الزامی" />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  )
}

/* ---------------- Workflows ---------------- */

export function AdminWorkflowsPage() {
  const db = useDB()
  return (
    <>
      <PageHeader title="گردش کارها" description="مسیر رسیدگی هر نوع درخواست و مرجع بررسی هر نوع مدرک. همه درخواست‌ها لزوماً به تأیید هر دو طرف نیاز ندارند." breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'گردش کارها' }]} />
      <PageState>
        {() => (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card padded={false}>
              <div className="p-4">
                <CardHeader title="درخواست‌ها" icon={Workflow} className="mb-0" />
              </div>
              <ul className="divide-y divide-ink-100">
                {db.requestTypes.map((t) => (
                  <li key={t.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm font-semibold', !t.enabled && 'text-ink-400')}>
                        {t.title} {!t.enabled ? <Badge size="sm" tone="muted">غیرفعال</Badge> : null}
                      </p>
                      <Link to="/admin/request-types" className="text-2xs font-semibold text-brand-700 hover:underline">
                        ویرایش
                      </Link>
                    </div>
                    <ol className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge size="sm" tone="muted">نیروی کار</Badge>
                      {t.workflow.map((w, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <ChevronLeft size={13} className="text-ink-300" aria-hidden />
                          <Badge size="sm" tone={w.party === 'org' ? 'info' : 'brand'} icon={w.party === 'org' ? Building2 : Briefcase}>
                            {w.label}
                          </Badge>
                        </li>
                      ))}
                      {t.executionLabel ? (
                        <li className="flex items-center gap-1.5">
                          <ChevronLeft size={13} className="text-ink-300" aria-hidden />
                          <Badge size="sm" tone="accent">{t.executionLabel}</Badge>
                        </li>
                      ) : null}
                    </ol>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-5">
              <Card>
                <CardHeader title="مرجع بررسی مدارک" />
                <ul className="divide-y divide-ink-100 text-sm">
                  {DOC_TYPES.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2">
                      <span>{d.title}</span>
                      <Badge size="sm" tone={d.reviewParty === 'org' ? 'info' : 'brand'}>
                        {PARTY_LABEL[d.reviewParty]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="گردش کار قراردادها" />
                <ol className="space-y-1.5 text-[13px]">
                  {['پیش‌نویس', 'بررسی شرکت', 'بررسی سازمان (قرارداد پروژه)', 'آماده ارسال برای امضا', 'امضای نیروی کار / طرف دیگر', 'امضا و تکمیل', 'فعال → نزدیک به پایان → منقضی'].map((s, i) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded-full bg-ink-100 text-2xs font-bold">{toFaDigits(i + 1)}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          </div>
        )}
      </PageState>
    </>
  )
}

/* ---------------- Alert rules ---------------- */

export function AdminAlertsPage() {
  const db = useDB()
  const actions = useActions()
  const toast = useToast()
  const save = async (r: AlertRule) => {
    try {
      await actions.updateAlertRule(r)
      toast.success('قانون هشدار به‌روز شد')
    } catch (x) {
      toast.fromError(x)
    }
  }
  return (
    <>
      <PageHeader title="قوانین هشدار و اعلان" description="رویدادهایی که سامانه بر اساس آن‌ها وظیفه خودکار ایجاد می‌کند یا اعلان می‌فرستد. تسک تکراری ساخته نمی‌شود و با رفع علت، تسک بسته می‌شود." breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'قوانین هشدار' }]} />
      <PageState>
        {() => (
          <div className="space-y-3">
            {db.alertRules.map((r) => (
              <AlertRuleCard key={r.id} rule={r} onSave={save} />
            ))}
          </div>
        )}
      </PageState>
    </>
  )
}

function AlertRuleCard({ rule, onSave }: { rule: AlertRule; onSave: (r: AlertRule) => void }) {
  const [t, setT] = useState('')
  const r = rule
  const toggleChannel = (c: 'inapp' | 'sms' | 'email') => onSave({ ...r, notifies: r.notifies.includes(c) ? r.notifies.filter((x) => x !== c) : [...r.notifies, c] })
  return (
    <Card className={cn(!r.enabled && 'opacity-70')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{r.event}</p>
          <p className="mt-0.5 text-xs text-ink-600">
            وظیفه پیشنهادی: {r.description} — مسئول: {r.assigneeRole}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-500">آستانه‌ها:</span>
            {r.thresholds.length === 0 ? <span className="text-xs text-ink-400">هنگام وقوع رویداد</span> : null}
            {r.thresholds.map((d) => (
              <Badge key={d} tone="brand" size="sm">
                {d === 0 ? 'روز موعد' : `${toFaDigits(d)} روز قبل`}
                <button type="button" onClick={() => onSave({ ...r, thresholds: r.thresholds.filter((x) => x !== d) })} aria-label={`حذف آستانه ${d}`} className="ms-0.5">
                  <X size={11} />
                </button>
              </Badge>
            ))}
            <Input aria-label="افزودن آستانه (روز)" ltr className="h-7 w-16 text-xs" value={t} onChange={(e) => setT(e.target.value)} placeholder="روز" />
            <Button
              size="xs"
              variant="ghost"
              icon={Plus}
              onClick={() => {
                const n = Number(toEnDigits(t))
                if (!Number.isNaN(n) && n >= 0 && n <= 90 && !r.thresholds.includes(n)) onSave({ ...r, thresholds: [...r.thresholds, n].sort((a, b) => b - a) })
                setT('')
              }}
            >
              افزودن
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 lg:flex-col lg:items-end">
          <Switch checked={r.enabled} onChange={(v) => onSave({ ...r, enabled: v })} label="فعال" />
          <Switch checked={r.createsTask} onChange={(v) => onSave({ ...r, createsTask: v })} label="ایجاد وظیفه" />
          <div className="flex gap-1" role="group" aria-label="کانال‌های اعلان">
            {(
              [
                ['inapp', 'داخلی', Bell],
                ['sms', 'پیامک', MessageSquareText],
                ['email', 'ایمیل', Mail],
              ] as const
            ).map(([c, l, I]) => (
              <button key={c} type="button" aria-pressed={r.notifies.includes(c)} onClick={() => toggleChannel(c)} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium', r.notifies.includes(c) ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-500')}>
                <I size={12} aria-hidden /> {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ---------------- Settings ---------------- */

export function AdminSettingsPage() {
  const db = useDB()
  const actions = useActions()
  const toast = useToast()
  const [s, setS] = useState(db.settings)
  const [busy, setBusy] = useState(false)
  const n = (v: string) => Number(toEnDigits(v).replace(/\D/g, '')) || 0
  return (
    <>
      <PageHeader
        title="تنظیمات سامانه"
        breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'تنظیمات' }]}
        actions={
          <Button
            icon={Save}
            loading={busy}
            onClick={async () => {
              if (s.signatureOtpTtlSec < 30 || s.otpMaxAttempts < 1 || s.sessionTimeoutMin < 5) return toast.error('مقادیر نامعتبر', 'اعتبار کد حداقل ۳۰ ثانیه و مهلت نشست حداقل ۵ دقیقه است.')
              setBusy(true)
              try {
                await actions.updateSettings(s)
                toast.success('تنظیمات سامانه ذخیره شد')
              } catch (x) {
                toast.fromError(x)
              } finally {
                setBusy(false)
              }
            }}
          >
            ذخیره
          </Button>
        }
      />
      <div className="grid max-w-4xl gap-5">
        <Card>
          <CardHeader title="احراز هویت و نشست" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="مدت اعتبار کد پیامکی (ثانیه)">{(p) => <Input id={p.id} ltr value={String(s.signatureOtpTtlSec)} onChange={(e) => setS({ ...s, signatureOtpTtlSec: n(e.target.value) })} />}</Field>
            <Field label="سقف تلاش برای کد">{(p) => <Input id={p.id} ltr value={String(s.otpMaxAttempts)} onChange={(e) => setS({ ...s, otpMaxAttempts: n(e.target.value) })} />}</Field>
            <Field label="فاصله ارسال مجدد کد (ثانیه)">{(p) => <Input id={p.id} ltr value={String(s.otpResendCooldownSec)} onChange={(e) => setS({ ...s, otpResendCooldownSec: n(e.target.value) })} />}</Field>
            <Field label="خاتمه نشست پس از عدم فعالیت (دقیقه)">{(p) => <Input id={p.id} ltr value={String(s.sessionTimeoutMin)} onChange={(e) => setS({ ...s, sessionTimeoutMin: n(e.target.value) })} />}</Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="کانال‌های ارتباطی" />
          <div className="space-y-4">
            <Switch checked={s.smsEnabled} onChange={(v) => setS({ ...s, smsEnabled: v })} label="سرویس پیامک" description="برای کد تأیید و رویدادهای مهم" />
            <Switch checked={s.emailEnabled} onChange={(v) => setS({ ...s, emailEnabled: v })} label="سرویس ایمیل" />
          </div>
        </Card>
        <Card>
          <CardHeader title="اطلاعیه وضعیت سامانه" description="در صفحه وضعیت سامانه نمایش داده می‌شود؛ خالی بگذارید تا پنهان شود." />
          <Textarea aria-label="متن اطلاعیه" value={s.maintenanceBanner} onChange={(e) => setS({ ...s, maintenanceBanner: e.target.value })} placeholder="مثلاً: به‌روزرسانی سامانه پنجشنبه ساعت ۲۲ تا ۲۴ انجام می‌شود." maxLength={300} showCount />
        </Card>
        <Callout tone="neutral">سیاست رمز عبور، رمزنگاری اطلاعات حساس، اسکن بدافزار فایل‌ها و مدت نگهداری اسناد در لایه سرور پیکربندی می‌شوند و از این رابط قابل تغییر نیستند.</Callout>
      </div>
    </>
  )
}

/* ---------------- Monitoring ---------------- */

export function AdminMonitoringPage() {
  const db = useDB()
  const open = db.requests.filter((r) => ['submitted', 'in_review'].includes(r.status))
  const overdue = open.filter((r) => r.dueAt && daysUntil(r.dueAt) < 0)
  const pending = db.documents.filter((d) => currentVersion(d).status === 'pending')
  const tasksLate = db.tasks.filter((t) => t.status !== 'done' && daysUntil(t.dueAt) < 0)
  const queues = [
    ...db.companies.map((c) => ({ label: `${c.name} (شرکت)`, value: open.filter((r) => activeParty(r) === 'company' && db.employees.find((e) => e.id === r.employeeId)?.companyId === c.id).length })),
    ...db.organizations.map((o) => ({ label: `${o.name} (سازمان)`, value: open.filter((r) => activeParty(r) === 'org' && db.employees.find((e) => e.id === r.employeeId)?.orgId === o.id).length })),
  ].filter((q) => q.value > 0)
  return (
    <>
      <PageHeader title="پایش عملیات" description="وضعیت صف‌های رسیدگی در کل پلتفرم برای شناسایی گلوگاه‌ها." breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'پایش عملیات' }]} />
      <PageState variant="dashboard">
        {() => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="درخواست در صف رسیدگی" value={open.length} icon={Inbox} />
              <StatCard label="درخواست معوق" value={overdue.length} icon={Hourglass} tone="danger" />
              <StatCard label="مدرک در انتظار بررسی" value={pending.length} icon={FileCheck2} tone="info" />
              <StatCard label="وظیفه معوق" value={tasksLate.length} icon={ListTodo} tone="warning" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader title="درخواست‌های باز به تفکیک مرجع" />
                <BarList data={queues} />
              </Card>
              <Card>
                <CardHeader title="درخواست‌های معوق" />
                <ul className="divide-y divide-ink-100 text-sm">
                  {overdue.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex justify-between gap-2 py-2">
                      <span>{requestType(db, r.typeId)?.title}</span>
                      <span className="text-xs text-red-700">{toFaDigits(-daysUntil(r.dueAt!))} روز تأخیر، {PARTY_LABEL[activeParty(r)!]}</span>
                    </li>
                  ))}
                  {overdue.length === 0 ? <li className="py-4 text-center text-ink-500">درخواست معوقی وجود ندارد.</li> : null}
                </ul>
              </Card>
            </div>
            <Card>
              <CardHeader title="کاربران به تفکیک نقش" />
              <BarList data={Object.entries(SUBROLES).filter(([k]) => k !== 'employee').map(([k, v]) => ({ label: v.label, value: db.users.filter((u) => u.subRole === k && u.status === 'active').length }))} unit="نفر" />
              <p className="mt-3 text-xs text-ink-500">مجموع نیروهای کار ثبت‌شده: {formatNumber(db.employees.length)}</p>
            </Card>
          </div>
        )}
      </PageState>
    </>
  )
}

export function AdminRolesPage() {
  return (
    <>
      <PageHeader title="نقش‌ها و دسترسی‌ها" description="نقش‌های داخلی سازمان و شرکت و مجوزهای هر نقش. دسترسی به نوع عملیات و دامنه داده هر دو وابسته است." breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'نقش‌ها' }]} />
      <div className="space-y-5">
        <RoleMatrix roles={['org', 'company']} />
        <Card>
          <CardHeader title="نقش نیروی کار" />
          <p className="text-sm leading-7 text-ink-600">هر نیروی کار فقط پرونده خود را می‌بیند: اطلاعات شخصی و شغلی، درخواست‌ها، قراردادها، فیش‌ها و مدارک خود. ویرایش اطلاعات رسمی فقط از طریق مرکز درخواست‌ها و تغییر وضعیت استخدامی، محل خدمت یا شیفت فقط از طریق گردش کار مجاز است.</p>
        </Card>
      </div>
    </>
  )
}
