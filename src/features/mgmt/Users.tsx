import { Fragment, useMemo, useState } from 'react'
import { Check, Minus, Pencil, ShieldCheck, UserPlus, Users as UsersIcon, UserX } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  FilterBar,
  IconButton,
  Input,
  Ltr,
  PageHeader,
  PageState,
  RadioGroup,
  SearchInput,
  Select,
  Tabs,
  useToast,
  type Column,
} from '@/components/ui'
import { useActions, useSession } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { PERMISSION_GROUPS, PERMISSION_LABEL, ROLE_LABEL, SUBROLES } from '@/config/permissions'
import { formatMobile, formatRelative, toEnDigits } from '@/lib/format'
import { isValidMobile } from '@/lib/validation'
import type { AppUser, RoleKey, SubRole } from '@/types/domain'
import { cn } from '@/lib/cn'

export interface UsersScope {
  /** Restrict to an organisation / company; undefined = whole platform (admin) */
  role?: 'org' | 'company'
  entityId?: string
  base: string
}

export function UsersPage({ scope }: { scope: UsersScope }) {
  const [tab, setTab] = useState('users')
  return (
    <>
      <PageHeader
        title="کاربران و سطح دسترسی"
        description="دسترسی هر کاربر به نوع عملیات و دامنه داده (پروژه‌ها) وابسته است. داشتن پنل به معنی دسترسی به همه اطلاعات مجموعه نیست."
        breadcrumbs={[{ label: 'داشبورد', to: scope.base }, { label: 'کاربران و دسترسی‌ها' }]}
      />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'کاربران' }, { id: 'roles', label: 'نقش‌ها و مجوزها', icon: ShieldCheck }]} />
      <PageState>{() => (tab === 'users' ? <UserList scope={scope} /> : <RoleMatrix roles={scope.role ? [scope.role] : ['org', 'company']} />)}</PageState>
    </>
  )
}

function UserList({ scope }: { scope: UsersScope }) {
  const db = useDB()
  const session = useSession()
  const actions = useActions()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [edit, setEdit] = useState<AppUser | 'new' | null>(null)
  const [deactivate, setDeactivate] = useState<AppUser | null>(null)
  const users = db.users.filter((u) => !scope.role || (scope.role === 'org' ? u.orgId === scope.entityId : u.companyId === scope.entityId))
  const rows = useMemo(() => users.filter((u) => (!q || u.name.includes(q) || u.email.includes(q) || u.mobile.includes(toEnDigits(q))) && (!role || u.subRole === role) && (!status || u.status === status)), [users, q, role, status])
  const entityName = (u: AppUser) => (u.orgId ? db.organizations.find((o) => o.id === u.orgId)?.name : u.companyId ? db.companies.find((c) => c.id === u.companyId)?.name : 'سامانه')

  const columns: Column<AppUser>[] = [
    {
      id: 'name',
      header: 'کاربر',
      cell: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={u.name} size={32} color="#13665f" />
          <div>
            <p className="font-medium">{u.name}</p>
            <p className="text-2xs text-ink-500">
              <Ltr>{u.email}</Ltr>
            </p>
          </div>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    ...(!scope.role ? [{ id: 'entity', header: 'مجموعه', cell: (u: AppUser) => <span className="text-xs">{entityName(u)}</span> } as Column<AppUser>] : []),
    { id: 'role', header: 'نقش', cell: (u) => <span className="text-xs">{SUBROLES[u.subRole].label}</span> },
    { id: 'scope', header: 'دامنه داده', cell: (u) => (u.projectScope === 'all' ? <span className="text-xs text-ink-600">همه پروژه‌های مجموعه</span> : <span className="text-xs">{u.projectScope.map((p) => db.projects.find((x) => x.id === p)?.code).join('، ')}</span>) },
    { id: 'mobile', header: 'موبایل', label: 'موبایل', hideable: true, cell: (u) => <Ltr className="text-xs">{formatMobile(u.mobile)}</Ltr> },
    { id: 'status', header: 'وضعیت', cell: (u) => <Badge size="sm" tone={u.status === 'active' ? 'success' : u.status === 'invited' ? 'info' : 'muted'}>{{ active: 'فعال', invited: 'دعوت‌شده', inactive: 'غیرفعال' }[u.status]}</Badge> },
    { id: 'last', header: 'آخرین ورود', label: 'آخرین ورود', hideable: true, cell: (u) => <span className="text-xs text-ink-500">{u.lastLogin ? formatRelative(u.lastLogin) : '—'}</span> },
    {
      id: 'act',
      header: <span className="sr-only">عملیات</span>,
      cell: (u) => (
        <div className="flex gap-1">
          <IconButton icon={Pencil} size="sm" label={`ویرایش دسترسی ${u.name}`} onClick={() => setEdit(u)} />
          {u.status !== 'inactive' && u.id !== session?.userId ? <IconButton icon={UserX} size="sm" variant="danger-ghost" label={`غیرفعال کردن ${u.name}`} onClick={() => setDeactivate(u)} /> : null}
        </div>
      ),
    },
  ]
  const roleOptions = (Object.keys(SUBROLES) as SubRole[]).filter((r) => SUBROLES[r].role !== 'employee' && (!scope.role || SUBROLES[r].role === scope.role))
  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="نام، ایمیل یا موبایل" />}
        activeCount={[role, status].filter(Boolean).length}
        onClear={() => {
          setRole('')
          setStatus('')
        }}
        actions={
          <Button icon={UserPlus} onClick={() => setEdit('new')}>
            دعوت کاربر
          </Button>
        }
      >
        <Select aria-label="نقش" className="w-full sm:w-52" value={role} onChange={(e) => setRole(e.target.value)} placeholder="همه نقش‌ها" options={roleOptions.map((r) => ({ value: r, label: SUBROLES[r].label }))} />
        <Select aria-label="وضعیت" className="w-full sm:w-36" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="همه وضعیت‌ها" options={[{ value: 'active', label: 'فعال' }, { value: 'invited', label: 'دعوت‌شده' }, { value: 'inactive', label: 'غیرفعال' }]} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(u) => u.id}
        columnChooser
        caption="فهرست کاربران"
        mobileCard={(u) => (
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{u.name}</p>
              <p className="text-xs text-ink-500">{SUBROLES[u.subRole].label}</p>
              {!scope.role ? <p className="text-2xs text-ink-500">{entityName(u)}</p> : null}
            </div>
            <IconButton icon={Pencil} size="sm" label="ویرایش" onClick={() => setEdit(u)} />
          </div>
        )}
        empty={<EmptyState compact icon={UsersIcon} title="کاربری پیدا نشد" />}
      />
      {edit ? <UserDialog user={edit === 'new' ? undefined : edit} scope={scope} roleOptions={roleOptions} onClose={() => setEdit(null)} /> : null}
      <ConfirmDialog
        open={deactivate !== null}
        onClose={() => setDeactivate(null)}
        tone="danger"
        title={`غیرفعال کردن ${deactivate?.name}؟`}
        description="دسترسی این کاربر بلافاصله قطع می‌شود. سوابق تصمیم‌ها و فعالیت‌های او حفظ می‌شود."
        confirmLabel="غیرفعال کردن"
        onConfirm={async () => {
          if (!deactivate) return
          try {
            await actions.upsertUser({ ...deactivate, status: 'inactive' })
            toast.success('کاربر غیرفعال شد')
          } catch (x) {
            toast.fromError(x)
          }
          setDeactivate(null)
        }}
      />
    </>
  )
}

function UserDialog({ user, scope, roleOptions, onClose }: { user?: AppUser; scope: UsersScope; roleOptions: SubRole[]; onClose: () => void }) {
  const db = useDB()
  const actions = useActions()
  const toast = useToast()
  const [v, setV] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    mobile: user?.mobile ?? '',
    subRole: user?.subRole ?? roleOptions[0],
    entityId: user?.orgId ?? user?.companyId ?? scope.entityId ?? '',
    status: user?.status ?? 'invited',
  })
  const [allProjects, setAllProjects] = useState(!user || user.projectScope === 'all')
  const [projects, setProjects] = useState<Set<string>>(new Set(user && user.projectScope !== 'all' ? user.projectScope : []))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const role = SUBROLES[v.subRole].role as Exclude<RoleKey, 'employee'>
  const entities = role === 'org' ? db.organizations : role === 'company' ? db.companies : []
  const entityProjects = db.projects.filter((p) => (role === 'org' ? p.orgId === v.entityId : p.companyId === v.entityId))
  const submit = async () => {
    const e: Record<string, string> = {}
    if (!v.name.trim()) e.name = 'نام را وارد کنید.'
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'ایمیل معتبر نیست.'
    if (!isValidMobile(v.mobile)) e.mobile = 'شماره موبایل معتبر نیست.'
    if (role !== 'admin' && !v.entityId) e.entity = 'مجموعه را انتخاب کنید.'
    if (!allProjects && projects.size === 0 && role !== 'admin') e.projects = 'دست‌کم یک پروژه انتخاب کنید یا «همه پروژه‌ها» را بزنید.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await actions.upsertUser({
        id: user?.id,
        name: v.name,
        email: v.email,
        mobile: toEnDigits(v.mobile),
        role,
        subRole: v.subRole,
        orgId: role === 'org' ? v.entityId : undefined,
        companyId: role === 'company' ? v.entityId : undefined,
        projectScope: allProjects || role === 'admin' ? 'all' : [...projects],
        status: v.status as AppUser['status'],
        lastLogin: user?.lastLogin,
      })
      toast.success(user ? 'دسترسی کاربر به‌روز شد' : 'دعوت‌نامه ارسال شد', user ? undefined : 'کاربر پس از تأیید شماره موبایل می‌تواند وارد شود.')
      onClose()
    } catch (x) {
      toast.fromError(x)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      size="lg"
      title={user ? `ویرایش دسترسی ${user.name}` : 'دعوت کاربر جدید'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={busy}>
            {user ? 'ذخیره تغییرات' : 'ارسال دعوت'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی" required error={errors.name}>
          {(p) => <Input id={p.id} invalid={p.invalid} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        </Field>
        <Field label="ایمیل" required error={errors.email}>
          {(p) => <Input id={p.id} invalid={p.invalid} ltr value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}
        </Field>
        <Field label="شماره موبایل" required error={errors.mobile}>
          {(p) => <Input id={p.id} invalid={p.invalid} ltr inputMode="tel" maxLength={11} value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} />}
        </Field>
        <Field label="نقش" required helper={SUBROLES[v.subRole].description}>
          {(p) => <Select id={p.id} value={v.subRole} onChange={(e) => setV({ ...v, subRole: e.target.value as SubRole, entityId: scope.entityId ?? '' })} options={roleOptions.map((r) => ({ value: r, label: `${SUBROLES[r].label}${scope.role ? '' : ` (${ROLE_LABEL[SUBROLES[r].role]})`}` }))} />}
        </Field>
        {!scope.role && role !== 'admin' ? (
          <Field label={role === 'org' ? 'سازمان' : 'شرکت'} required error={errors.entity} className="sm:col-span-2">
            {(p) => <Select id={p.id} invalid={p.invalid} value={v.entityId} onChange={(e) => setV({ ...v, entityId: e.target.value })} placeholder="انتخاب کنید" options={entities.map((x) => ({ value: x.id, label: x.name }))} />}
          </Field>
        ) : null}
        {user ? (
          <Field label="وضعیت حساب">
            {(p) => <Select id={p.id} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as AppUser['status'] })} options={[{ value: 'active', label: 'فعال' }, { value: 'invited', label: 'دعوت‌شده' }, { value: 'inactive', label: 'غیرفعال' }]} />}
          </Field>
        ) : null}
        {role !== 'admin' ? (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">دامنه داده</p>
            <RadioGroup name="scope" layout="cards" value={allProjects ? 'all' : 'some'} onChange={(x) => setAllProjects(x === 'all')} options={[{ value: 'all', label: 'همه پروژه‌های مجموعه' }, { value: 'some', label: 'فقط پروژه‌های انتخاب‌شده', description: 'مثلاً کارشناس پروژه الف به پروژه ب دسترسی ندارد' }]} />
            {!allProjects ? (
              <div className="mt-3 grid gap-1.5 rounded-lg border border-ink-200 p-3 sm:grid-cols-2">
                {entityProjects.map((p) => (
                  <Checkbox
                    key={p.id}
                    checked={projects.has(p.id)}
                    onChange={(on) => {
                      const n = new Set(projects)
                      if (on) n.add(p.id)
                      else n.delete(p.id)
                      setProjects(n)
                    }}
                    label={p.name}
                    description={p.code}
                  />
                ))}
              </div>
            ) : null}
            {errors.projects ? <p className="mt-1 text-xs text-red-700">{errors.projects}</p> : null}
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">مجوزهای این نقش</p>
          <div className="flex flex-wrap gap-1.5">
            {SUBROLES[v.subRole].permissions.length ? SUBROLES[v.subRole].permissions.map((p) => <Badge key={p} size="sm" tone="neutral">{PERMISSION_LABEL[p]}</Badge>) : <span className="text-xs text-ink-500">مدیریت کامل سطح سامانه</span>}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export function RoleMatrix({ roles }: { roles: ('org' | 'company')[] }) {
  const subs = (Object.keys(SUBROLES) as SubRole[]).filter((s) => roles.includes(SUBROLES[s].role as 'org' | 'company'))
  return (
    <Card padded={false}>
      <div className="p-4">
        <CardHeader title="ماتریس نقش‌ها و مجوزها" description="مجوز هر نقش در محدوده داده‌ای اعمال می‌شود که برای کاربر تعیین شده است." className="mb-0" />
      </div>
      <Callout tone="neutral" className="mx-4 mb-4">
        این جدول فقط شکل رابط کاربری را تعیین می‌کند؛ کنترل دسترسی در سمت سرور به‌صورت مستقل اعمال می‌شود.
      </Callout>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ink-50 text-xs text-ink-600">
            <tr>
              <th className="sticky start-0 bg-ink-50 px-4 py-2.5 text-start font-semibold">مجوز</th>
              {subs.map((s) => (
                <th key={s} className="px-3 py-2.5 text-center font-semibold">
                  {SUBROLES[s].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.title}>
                <tr className="bg-ink-25">
                  <td colSpan={subs.length + 1} className="px-4 py-1.5 text-2xs font-bold text-ink-500">
                    {g.title}
                  </td>
                </tr>
                {g.keys.map((k) => (
                  <tr key={k} className="border-t border-ink-100">
                    <td className="sticky start-0 bg-white px-4 py-2 text-[13px]">{PERMISSION_LABEL[k]}</td>
                    {subs.map((s) => {
                      const has = SUBROLES[s].permissions.includes(k)
                      return (
                        <td key={s} className="px-3 py-2 text-center">
                          <span className={cn('inline-grid size-6 place-items-center rounded-full', has ? 'bg-emerald-50 text-emerald-600' : 'text-ink-300')}>{has ? <Check size={14} aria-label="دارد" /> : <Minus size={14} aria-label="ندارد" />}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
