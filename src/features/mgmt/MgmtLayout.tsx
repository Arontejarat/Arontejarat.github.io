import { Activity, Bell, CalendarDays, ChartColumn, FileCheck2, FileSignature, FileSpreadsheet, FolderKanban, FolderOpen, Inbox, LayoutDashboard, ListTodo, Settings, ShieldCheck, Users } from 'lucide-react'
import { AppShell, type NavGroup, type NavItem } from '@/components/shell/AppShell'
import { useDB } from '@/mock/store'
import { activeParty, canReviewDocType, currentVersion, scopedDocuments, scopedRequests } from '@/mock/selectors'
import { ROLE_LABEL } from '@/config/permissions'
import type { Permission } from '@/types/domain'
import { useMgmt } from './useMgmt'

export function MgmtLayout() {
  const db = useDB()
  const m = useMgmt()
  const pendingRequests = scopedRequests(db, m.scope).filter((r) => activeParty(r) === m.role).length
  const pendingDocs = scopedDocuments(db, m.scope).filter((d) => currentVersion(d).status === 'pending' && canReviewDocType(m.role, d.typeId)).length
  const myTasks = db.tasks.filter((t) => t.assigneeId === m.user?.id && t.status !== 'done').length
  const unread = db.notifications.filter((n) => n.audience.role === m.role && n.audience.id === m.entityId && !n.read).length

  const item = (perm: Permission | null, it: NavItem, onlyCompany = false): NavItem[] => ((perm === null || m.can(perm)) && (!onlyCompany || m.isCompany) ? [it] : [])
  const b = m.base
  const groups: NavGroup[] = [
    {
      items: [
        ...item('dashboard.view', { to: b, label: 'داشبورد عملیات', icon: LayoutDashboard, end: true }),
        ...item(null, { to: `${b}/notifications`, label: 'اعلان‌ها و رویدادها', icon: Bell, count: unread }),
      ],
    },
    {
      title: 'عملیات',
      items: [
        ...item('requests.view', { to: `${b}/requests`, label: 'مرکز درخواست‌ها', icon: Inbox, count: m.can('requests.decide') ? pendingRequests : 0 }),
        ...item('documents.view', { to: `${b}/documents`, label: 'بررسی مدارک', icon: FileCheck2, count: m.can('documents.review') ? pendingDocs : 0 }),
        ...item('workforce.view', { to: `${b}/workforce`, label: m.isCompany ? 'مدیریت نیروها' : 'نیروهای مستقر', icon: Users }),
        ...item('contracts.view', { to: `${b}/contracts`, label: 'قراردادها', icon: FileSignature }),
        ...item('projects.view', { to: `${b}/projects`, label: m.isCompany ? 'مدیریت پروژه‌ها' : 'پروژه‌های مرتبط', icon: FolderKanban }),
        ...item('tasks.view', { to: `${b}/tasks`, label: 'وظایف و تسک‌ها', icon: ListTodo, count: myTasks }),
        ...item('tasks.view', { to: `${b}/calendar`, label: 'تقویم و مهلت‌ها', icon: CalendarDays }, true),
        ...item('workforce.import', { to: `${b}/import`, label: 'ورود و خروج Excel', icon: FileSpreadsheet }, true),
      ],
    },
    {
      title: 'اسناد و گزارش',
      items: [
        ...item('files.manage', { to: `${b}/files`, label: m.isCompany ? 'اسناد شرکت و پروژه' : 'اسناد سازمان', icon: FolderOpen }),
        ...item('reports.view', { to: `${b}/reports`, label: 'گزارش‌ها', icon: ChartColumn }),
        ...item('activity.view', { to: `${b}/activity`, label: 'تاریخچه فعالیت‌ها', icon: Activity }),
      ],
    },
    {
      title: 'مدیریت',
      items: [
        ...item('users.manage', { to: `${b}/users`, label: 'کاربران و دسترسی‌ها', icon: ShieldCheck }),
        ...item('settings.manage', { to: `${b}/settings`, label: m.isCompany ? 'تنظیمات شرکت' : 'تنظیمات سازمان', icon: Settings }),
      ],
    },
  ].filter((g) => g.items.length > 0)

  return <AppShell roleLabel={ROLE_LABEL[m.role]} scopeLabel={m.scopeLabel} groups={groups} notificationsTo={`${b}/notifications`} unread={unread} />
}
