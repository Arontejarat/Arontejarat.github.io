import { createBrowserRouter, Outlet } from 'react-router'
import { RequirePerm, RequireRole, RootRedirect, SessionWatcher } from './guards'
import { ForgotPasswordPage, LoginPage, OtpPage } from '@/features/auth/AuthPages'
import { ForbiddenPage, NotFoundPage, PublicPrivacyPage, RouteErrorPage, SessionExpiredPage, SystemStatusPage } from '@/features/system/SystemPages'
// Employee
import { EmployeeLayout } from '@/features/employee/EmployeeLayout'
// Organisation & company (shared implementation)
import { MgmtLayout } from '@/features/mgmt/MgmtLayout'
// Admin
import { AdminLayout } from '@/features/admin/AdminLayout'
import type { RouteObject } from 'react-router'
import type { ComponentType } from 'react'
import type { Permission } from '@/types/domain'
import { PageSkeleton } from '@/components/ui'

const LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  '@/app/adapters': () => import('@/app/adapters'),
  '@/features/admin/AdminOverview': () => import('@/features/admin/AdminOverview'),
  '@/features/admin/AdminPages': () => import('@/features/admin/AdminPages'),
  '@/features/employee/Dashboard': () => import('@/features/employee/Dashboard'),
  '@/features/employee/documents/Contracts': () => import('@/features/employee/documents/Contracts'),
  '@/features/employee/documents/DocumentsHub': () => import('@/features/employee/documents/DocumentsHub'),
  '@/features/employee/documents/Payslips': () => import('@/features/employee/documents/Payslips'),
  '@/features/employee/documents/Personnel': () => import('@/features/employee/documents/Personnel'),
  '@/features/employee/help/Help': () => import('@/features/employee/help/Help'),
  '@/features/employee/profile/Profile': () => import('@/features/employee/profile/Profile'),
  '@/features/employee/requests/MyRequests': () => import('@/features/employee/requests/MyRequests'),
  '@/features/employee/requests/NewRequest': () => import('@/features/employee/requests/NewRequest'),
  '@/features/employee/requests/RequestDetail': () => import('@/features/employee/requests/RequestDetail'),
  '@/features/mgmt/ActivityLog': () => import('@/features/mgmt/ActivityLog'),
  '@/features/mgmt/CalendarPage': () => import('@/features/mgmt/CalendarPage'),
  '@/features/mgmt/DocumentReview': () => import('@/features/mgmt/DocumentReview'),
  '@/features/mgmt/ExcelImport': () => import('@/features/mgmt/ExcelImport'),
  '@/features/mgmt/MgmtContracts': () => import('@/features/mgmt/MgmtContracts'),
  '@/features/mgmt/MgmtDashboard': () => import('@/features/mgmt/MgmtDashboard'),
  '@/features/mgmt/OrgFiles': () => import('@/features/mgmt/OrgFiles'),
  '@/features/mgmt/Projects': () => import('@/features/mgmt/Projects'),
  '@/features/mgmt/Reports': () => import('@/features/mgmt/Reports'),
  '@/features/mgmt/RequestQueue': () => import('@/features/mgmt/RequestQueue'),
  '@/features/mgmt/Settings': () => import('@/features/mgmt/Settings'),
  '@/features/mgmt/Tasks': () => import('@/features/mgmt/Tasks'),
  '@/features/mgmt/Users': () => import('@/features/mgmt/Users'),
  '@/features/mgmt/WorkerDetail': () => import('@/features/mgmt/WorkerDetail'),
  '@/features/mgmt/Workforce': () => import('@/features/mgmt/Workforce'),
  '@/features/notifications/Notifications': () => import('@/features/notifications/Notifications'),
}

const PAGE_MODULE: Record<string, string> = {
  ActivityLogPage: '@/features/mgmt/ActivityLog',
  AdminAlertsPage: '@/features/admin/AdminPages',
  AdminAudit: '@/app/adapters',
  AdminMonitoringPage: '@/features/admin/AdminPages',
  AdminNotificationDetail: '@/app/adapters',
  AdminNotifications: '@/app/adapters',
  AdminOrganizationsPage: '@/features/admin/AdminPages',
  AdminOverview: '@/features/admin/AdminOverview',
  AdminRequestTypesPage: '@/features/admin/AdminPages',
  AdminRolesPage: '@/features/admin/AdminPages',
  AdminSettingsPage: '@/features/admin/AdminPages',
  AdminUsers: '@/app/adapters',
  AdminWorkflowsPage: '@/features/admin/AdminPages',
  CalendarPage: '@/features/mgmt/CalendarPage',
  ContractListPage: '@/features/employee/documents/Contracts',
  ContractReceiptPage: '@/features/employee/documents/Contracts',
  ContractSignPage: '@/features/employee/documents/Contracts',
  ContractViewPage: '@/features/employee/documents/Contracts',
  DocumentDetailPage: '@/features/employee/documents/Personnel',
  DocumentReviewPage: '@/features/mgmt/DocumentReview',
  DocumentSearchPage: '@/features/employee/documents/DocumentsHub',
  DocumentUploadPage: '@/features/employee/documents/Personnel',
  DocumentsHubPage: '@/features/employee/documents/DocumentsHub',
  EmpNotificationDetail: '@/app/adapters',
  EmpNotifications: '@/app/adapters',
  EmployeeDashboard: '@/features/employee/Dashboard',
  ExcelImportPage: '@/features/mgmt/ExcelImport',
  HelpPage: '@/features/employee/help/Help',
  MgmtActivity: '@/app/adapters',
  MgmtContractDetailPage: '@/features/mgmt/MgmtContracts',
  MgmtContractsPage: '@/features/mgmt/MgmtContracts',
  MgmtDashboard: '@/features/mgmt/MgmtDashboard',
  MgmtNotificationDetail: '@/app/adapters',
  MgmtNotifications: '@/app/adapters',
  MgmtSettingsPage: '@/features/mgmt/Settings',
  MgmtUsers: '@/app/adapters',
  MyRequestsPage: '@/features/employee/requests/MyRequests',
  NewRequestPage: '@/features/employee/requests/NewRequest',
  NotificationDetailPage: '@/features/notifications/Notifications',
  NotificationsPage: '@/features/notifications/Notifications',
  OrgFilesPage: '@/features/mgmt/OrgFiles',
  PayslipDetailPage: '@/features/employee/documents/Payslips',
  PayslipListPage: '@/features/employee/documents/Payslips',
  PersonnelListPage: '@/features/employee/documents/Personnel',
  PrivacyPage: '@/features/employee/help/Help',
  ProfileActivity: '@/features/employee/profile/Profile',
  ProfileContact: '@/features/employee/profile/Profile',
  ProfileHome: '@/features/employee/profile/Profile',
  ProfileJob: '@/features/employee/profile/Profile',
  ProfileLayout: '@/features/employee/profile/Profile',
  ProfilePassword: '@/features/employee/profile/Profile',
  ProfilePersonal: '@/features/employee/profile/Profile',
  ProfileSecurity: '@/features/employee/profile/Profile',
  ProjectDetailPage: '@/features/mgmt/Projects',
  ProjectsPage: '@/features/mgmt/Projects',
  ReportsPage: '@/features/mgmt/Reports',
  RequestDetailPage: '@/features/employee/requests/RequestDetail',
  RequestEditPage: '@/features/employee/requests/RequestDetail',
  RequestQueuePage: '@/features/mgmt/RequestQueue',
  RequestResultPage: '@/features/employee/requests/RequestDetail',
  RequestReviewPage: '@/features/mgmt/RequestQueue',
  SupportPage: '@/features/employee/help/Help',
  TasksPage: '@/features/mgmt/Tasks',
  UsersPage: '@/features/mgmt/Users',
  WorkerDetailPage: '@/features/mgmt/WorkerDetail',
  WorkforcePage: '@/features/mgmt/Workforce',
}

/** Route-level code splitting: each page module is loaded on first visit. */
function page(name: string, perm?: Permission): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => {
      const mod = await LOADERS[PAGE_MODULE[name]]()
      const C = mod[name] as ComponentType
      return { Component: perm ? () => <RequirePerm perm={perm}><C /></RequirePerm> : C }
    },
  }
}


function Root() {
  return (
    <>
      <SessionWatcher />
      <Outlet />
    </>
  )
}

function mgmtRoutes(): RouteObject[] {
  return [
    { index: true, ...page('MgmtDashboard', 'dashboard.view') },
    { path: 'notifications', ...page('MgmtNotifications') },
    { path: 'notifications/:id', ...page('MgmtNotificationDetail') },
    { path: 'workforce', ...page('WorkforcePage', 'workforce.view') },
    { path: 'workforce/:id', ...page('WorkerDetailPage', 'workforce.view') },
    { path: 'documents', ...page('DocumentReviewPage', 'documents.view') },
    { path: 'requests', ...page('RequestQueuePage', 'requests.view') },
    { path: 'requests/:id', ...page('RequestReviewPage', 'requests.view') },
    { path: 'contracts', ...page('MgmtContractsPage', 'contracts.view') },
    { path: 'contracts/:id', ...page('MgmtContractDetailPage', 'contracts.view') },
    { path: 'files', ...page('OrgFilesPage', 'files.manage') },
    { path: 'projects', ...page('ProjectsPage', 'projects.view') },
    { path: 'projects/:id', ...page('ProjectDetailPage', 'projects.view') },
    { path: 'tasks', ...page('TasksPage', 'tasks.view') },
    { path: 'reports', ...page('ReportsPage', 'reports.view') },
    { path: 'users', ...page('MgmtUsers', 'users.manage') },
    { path: 'activity', ...page('MgmtActivity', 'activity.view') },
    { path: 'settings', ...page('MgmtSettingsPage', 'settings.manage') },
  ]
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <div className="p-6"><PageSkeleton /></div>,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'login/otp', element: <OtpPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'session-expired', element: <SessionExpiredPage /> },
      { path: 'status', element: <SystemStatusPage /> },
      { path: 'privacy', element: <PublicPrivacyPage /> },
      {
        path: 'me',
        element: (
          <RequireRole role="employee">
            <EmployeeLayout />
          </RequireRole>
        ),
        children: [
          { index: true, ...page('EmployeeDashboard') },
          { path: 'requests', ...page('MyRequestsPage') },
          { path: 'requests/new', ...page('NewRequestPage') },
          { path: 'requests/:id', ...page('RequestDetailPage') },
          { path: 'requests/:id/edit', ...page('RequestEditPage') },
          { path: 'requests/:id/result', ...page('RequestResultPage') },
          { path: 'documents', ...page('DocumentsHubPage') },
          { path: 'documents/search', ...page('DocumentSearchPage') },
          { path: 'documents/contracts', ...page('ContractListPage') },
          { path: 'documents/contracts/:id', ...page('ContractViewPage') },
          { path: 'documents/contracts/:id/sign', ...page('ContractSignPage') },
          { path: 'documents/contracts/:id/receipt', ...page('ContractReceiptPage') },
          { path: 'documents/payslips', ...page('PayslipListPage') },
          { path: 'documents/payslips/:id', ...page('PayslipDetailPage') },
          { path: 'documents/personnel', ...page('PersonnelListPage') },
          { path: 'documents/personnel/upload', ...page('DocumentUploadPage') },
          { path: 'documents/personnel/:id', ...page('DocumentDetailPage') },
          {
            path: 'profile',
            ...page('ProfileLayout'),
            children: [
              { index: true, ...page('ProfileHome') },
              { path: 'personal', ...page('ProfilePersonal') },
              { path: 'job', ...page('ProfileJob') },
              { path: 'contact', ...page('ProfileContact') },
              { path: 'password', ...page('ProfilePassword') },
              { path: 'security', ...page('ProfileSecurity') },
              { path: 'activity', ...page('ProfileActivity') },
            ],
          },
          { path: 'notifications', ...page('EmpNotifications') },
          { path: 'notifications/:id', ...page('EmpNotificationDetail') },
          { path: 'help', ...page('HelpPage') },
          { path: 'support', ...page('SupportPage') },
          { path: 'privacy', ...page('PrivacyPage') },
          { path: 'forbidden', element: <ForbiddenPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'org',
        element: (
          <RequireRole role="org">
            <MgmtLayout />
          </RequireRole>
        ),
        children: [...mgmtRoutes(), { path: '*', element: <NotFoundPage /> }],
      },
      {
        path: 'company',
        element: (
          <RequireRole role="company">
            <MgmtLayout />
          </RequireRole>
        ),
        children: [
          ...mgmtRoutes(),
          { path: 'calendar', ...page('CalendarPage', 'tasks.view') },
          { path: 'import', ...page('ExcelImportPage', 'workforce.import') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'admin',
        element: (
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          { index: true, ...page('AdminOverview') },
          { path: 'notifications', ...page('AdminNotifications') },
          { path: 'notifications/:id', ...page('AdminNotificationDetail') },
          { path: 'users', ...page('AdminUsers') },
          { path: 'roles', ...page('AdminRolesPage') },
          { path: 'organizations', ...page('AdminOrganizationsPage') },
          { path: 'request-types', ...page('AdminRequestTypesPage') },
          { path: 'workflows', ...page('AdminWorkflowsPage') },
          { path: 'alerts', ...page('AdminAlertsPage') },
          { path: 'settings', ...page('AdminSettingsPage') },
          { path: 'audit', ...page('AdminAudit') },
          { path: 'monitoring', ...page('AdminMonitoringPage') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: 'forbidden', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
