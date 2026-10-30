import { useCurrentEmployee } from '@/auth/auth'
import { useMgmt } from '@/features/mgmt/useMgmt'
import { NotificationDetailPage, NotificationsPage } from '@/features/notifications/Notifications'
import { UsersPage } from '@/features/mgmt/Users'
import { ActivityLogPage } from '@/features/mgmt/ActivityLog'

/* Small adapters that bind shared pages to the current audience */
export function EmpNotifications() {
  const e = useCurrentEmployee()
  return <NotificationsPage audience={{ role: 'employee', id: e.id }} basePath="/me/notifications" breadcrumbs={[{ label: 'داشبورد', to: '/me' }, { label: 'اعلان‌ها' }]} />
}
export function EmpNotificationDetail() {
  const e = useCurrentEmployee()
  return <NotificationDetailPage audience={{ role: 'employee', id: e.id }} basePath="/me/notifications" />
}
export function MgmtNotifications() {
  const m = useMgmt()
  return <NotificationsPage audience={{ role: m.role, id: m.entityId }} basePath={`${m.base}/notifications`} breadcrumbs={[{ label: 'داشبورد', to: m.base }, { label: 'اعلان‌ها و رویدادها' }]} />
}
export function MgmtNotificationDetail() {
  const m = useMgmt()
  return <NotificationDetailPage audience={{ role: m.role, id: m.entityId }} basePath={`${m.base}/notifications`} />
}
export function MgmtUsers() {
  const m = useMgmt()
  return <UsersPage scope={{ role: m.role, entityId: m.entityId, base: m.base }} />
}
export function MgmtActivity() {
  const m = useMgmt()
  return <ActivityLogPage base={m.base} filter={(a) => (m.role === 'org' ? a.orgId === m.entityId : a.companyId === m.entityId)} />
}


export function AdminNotifications() {
  return <NotificationsPage audience={{ role: 'admin', id: 'platform' }} basePath="/admin/notifications" breadcrumbs={[{ label: 'نمای کلی', to: '/admin' }, { label: 'اعلان‌ها' }]} />
}
export function AdminNotificationDetail() {
  return <NotificationDetailPage audience={{ role: 'admin', id: 'platform' }} basePath="/admin/notifications" />
}
export function AdminUsers() {
  return <UsersPage scope={{ base: '/admin' }} />
}
export function AdminAudit() {
  return <ActivityLogPage base="/admin" title="سوابق ممیزی" filter={() => true} />
}
