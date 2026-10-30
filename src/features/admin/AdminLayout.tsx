import { Activity, Bell, Building2, Gauge, LayoutDashboard, ListChecks, Settings, ShieldCheck, Siren, Users, Workflow } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { useDB } from '@/mock/store'

export function AdminLayout() {
  const db = useDB()
  const unread = db.notifications.filter((n) => n.audience.role === 'admin' && !n.read).length
  return (
    <AppShell
      roleLabel="ادمین کل سامانه"
      scopeLabel="کل پلتفرم"
      notificationsTo="/admin/notifications"
      unread={unread}
      groups={[
        {
          items: [
            { to: '/admin', label: 'نمای کلی سامانه', icon: LayoutDashboard, end: true },
            { to: '/admin/notifications', label: 'اعلان‌ها و رویدادها', icon: Bell, count: unread },
          ],
        },
        {
          title: 'کاربران و ساختار',
          items: [
            { to: '/admin/users', label: 'مدیریت کاربران', icon: Users },
            { to: '/admin/roles', label: 'نقش‌ها و دسترسی‌ها', icon: ShieldCheck },
            { to: '/admin/organizations', label: 'سازمان‌ها و شرکت‌ها', icon: Building2 },
          ],
        },
        {
          title: 'پیکربندی',
          items: [
            { to: '/admin/request-types', label: 'انواع درخواست و فرم‌ها', icon: ListChecks },
            { to: '/admin/workflows', label: 'گردش کارها', icon: Workflow },
            { to: '/admin/alerts', label: 'قوانین هشدار و اعلان', icon: Siren },
            { to: '/admin/settings', label: 'تنظیمات سامانه', icon: Settings },
          ],
        },
        {
          title: 'پایش',
          items: [
            { to: '/admin/audit', label: 'سوابق ممیزی', icon: Activity },
            { to: '/admin/monitoring', label: 'پایش عملیات', icon: Gauge },
          ],
        },
      ]}
    />
  )
}
