import { Bell, CircleHelp, FileText, Inbox, LayoutDashboard, LifeBuoy, Search, ShieldCheck, UserRound } from 'lucide-react'
import { AppShell, type NavItem } from '@/components/shell/AppShell'
import { useCurrentEmployee } from '@/auth/auth'
import { useDB } from '@/mock/store'
import { contractsNeedingEmployeeSignature, documentsNeedingAction } from '@/mock/selectors'

export function EmployeeLayout() {
  const db = useDB()
  const emp = useCurrentEmployee()
  const unread = db.notifications.filter((n) => n.audience.role === 'employee' && n.audience.id === emp.id && !n.read).length
  const needsFix = db.requests.filter((r) => r.employeeId === emp.id && r.status === 'needs_correction').length
  const docsAction = contractsNeedingEmployeeSignature(db, emp.id).length + documentsNeedingAction(db, emp.id).length

  // The five-section main menu defined by the PRD
  const main: NavItem[] = [
    { to: '/me', label: 'داشبورد', icon: LayoutDashboard, end: true },
    { to: '/me/requests', label: 'درخواست‌ها', icon: Inbox, count: needsFix },
    { to: '/me/documents', label: 'اسناد من', icon: FileText, count: docsAction },
    { to: '/me/notifications', label: 'اعلان‌ها', icon: Bell, count: unread },
    { to: '/me/profile', label: 'پروفایل', icon: UserRound },
  ]
  const desktopMain = main.map((m) => (m.to === '/me/requests' ? { ...m, label: 'مرکز درخواست‌ها' } : m))

  return (
    <AppShell
      roleLabel="پنل پرسنلی"
      groups={[
        { items: desktopMain },
        {
          title: 'سایر',
          items: [
            { to: '/me/documents/search', label: 'جست‌وجوی اسناد', icon: Search },
            { to: '/me/help', label: 'راهنما و پرسش‌ها', icon: CircleHelp },
            { to: '/me/support', label: 'پشتیبانی', icon: LifeBuoy },
            { to: '/me/privacy', label: 'قوانین و حریم خصوصی', icon: ShieldCheck },
          ],
        },
      ]}
      bottomNav={main}
      notificationsTo="/me/notifications"
      unread={unread}
      profileTo="/me/profile"
      helpTo="/me/help"
    />
  )
}
