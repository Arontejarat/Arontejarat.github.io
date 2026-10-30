import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Bell, ChevronDown, CircleHelp, LogOut, Menu, UserRound, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Avatar, CountBadge, Drawer, DropdownMenu, IconButton, type MenuItem } from '@/components/ui'
import { useAuth } from '@/auth/auth'
import { SUBROLES } from '@/config/permissions'
import { DemoBar } from './DemoBar'
import { useDB } from '@/mock/store'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  count?: number
}

export interface NavGroup {
  title?: string
  items: NavItem[]
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#152a4d" />
      <path d="M9 22V10l14 12V10" stroke="#34bcab" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SideNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="منوی اصلی" className="space-y-5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title ? <p className="mb-1.5 px-3 text-2xs font-semibold tracking-wide text-ink-400">{g.title}</p> : null}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-50 text-brand-900' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <it.icon size={18} className={isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600'} aria-hidden />
                      <span className="flex-1">{it.label}</span>
                      {it.count ? <CountBadge count={it.count} tone={isActive ? 'brand' : 'neutral'} /> : null}
                      {isActive ? <span className="sr-only">(صفحه فعلی)</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export interface AppShellProps {
  groups: NavGroup[]
  /** Mobile bottom navigation (employee panel) */
  bottomNav?: NavItem[]
  roleLabel: string
  scopeLabel?: string
  notificationsTo: string
  unread: number
  profileTo?: string
  helpTo?: string
  sidebarFooter?: ReactNode
}

export function AppShell({ groups, bottomNav, roleLabel, scopeLabel, notificationsTo, unread, profileTo, helpTo, sidebarFooter }: AppShellProps) {
  const { session, logout } = useAuth()
  const db = useDB()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const accountItems: MenuItem[] = [
    ...(profileTo ? [{ label: 'پروفایل و امنیت حساب', icon: UserRound, onSelect: () => navigate(profileTo) }] : []),
    ...(helpTo ? [{ label: 'راهنما و پشتیبانی', icon: CircleHelp, onSelect: () => navigate(helpTo) }] : []),
    {
      label: 'خروج از حساب',
      icon: LogOut,
      tone: 'danger' as const,
      onSelect: () => {
        logout()
        navigate('/login', { replace: true })
      },
    },
  ]

  const name = session?.name ?? ''
  const color = session?.role === 'employee' ? db.employees.find((e) => e.id === session.employeeId)?.photoColor : '#13665f'

  const brand = (
    <Link to={groups[0]?.items[0]?.to ?? '/'} className="flex items-center gap-2.5 rounded-lg">
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold text-ink-900">سامانه نیرو</span>
        <span className="block text-2xs text-ink-500">{roleLabel}</span>
      </span>
    </Link>
  )

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-[200] rounded-md bg-white px-3 py-2 text-sm font-semibold text-brand-800 shadow-md focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        پرش به محتوای اصلی
      </a>
      <DemoBar />
      <div className="flex">
        {/* Desktop sidebar (start = right edge in RTL) */}
        <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-ink-200 bg-white lg:flex">
          <div className="flex h-16 items-center px-4">{brand}</div>
          {scopeLabel ? (
            <div className="mx-3 mb-3 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2">
              <p className="text-2xs text-ink-500">محدوده دسترسی</p>
              <p className="truncate text-xs font-semibold text-ink-800">{scopeLabel}</p>
            </div>
          ) : null}
          <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
            <SideNav groups={groups} />
          </div>
          {sidebarFooter ? <div className="border-t border-ink-100 p-3">{sidebarFooter}</div> : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-ink-200 bg-white/90 px-3 backdrop-blur sm:h-16 sm:px-5">
            {!bottomNav ? <IconButton icon={Menu} label="باز کردن منو" className="lg:hidden" onClick={() => setDrawer(true)} /> : null}
            <div className="lg:hidden">{brand}</div>
            <div className="flex-1" />
            {helpTo ? <IconButton icon={CircleHelp} label="راهنما" onClick={() => navigate(helpTo)} className={bottomNav ? '' : 'max-sm:hidden'} /> : null}
            <IconButton icon={Bell} label={unread ? `اعلان‌ها (${unread} خوانده‌نشده)` : 'اعلان‌ها'} badge={unread} onClick={() => navigate(notificationsTo)} className={bottomNav ? 'max-lg:hidden' : ''} />
            <DropdownMenu
              trigger={
                <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-ink-100" aria-label="منوی حساب کاربری">
                  <Avatar name={name} color={color} size={34} />
                  <span className="hidden text-start leading-tight md:block">
                    <span className="block text-sm font-semibold text-ink-900">{name}</span>
                    <span className="block text-2xs text-ink-500">{session ? SUBROLES[session.subRole].label : ''}</span>
                  </span>
                  <ChevronDown size={16} className="hidden text-ink-400 md:block" aria-hidden />
                </button>
              }
              header={
                <div className="border-b border-ink-100 px-3 pb-2.5 pt-1.5">
                  <p className="text-sm font-semibold text-ink-900">{name}</p>
                  <p className="text-xs text-ink-500">{session ? SUBROLES[session.subRole].label : ''}</p>
                  {scopeLabel ? <p className="text-xs text-ink-500">{scopeLabel}</p> : null}
                </div>
              }
              items={accountItems}
              minWidth={240}
            />
          </header>

          <main id="main" tabIndex={-1} className={cn('mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 focus:outline-none sm:px-6 sm:py-7', bottomNav && 'pb-28 lg:pb-8')}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile drawer navigation (management panels) */}
      {!bottomNav ? (
        <Drawer open={drawer} onClose={() => setDrawer(false)} title={roleLabel} description={scopeLabel}>
          <SideNav groups={groups} onNavigate={() => setDrawer(false)} />
        </Drawer>
      ) : null}

      {/* Mobile bottom navigation (employee panel — five sections) */}
      {bottomNav ? (
        <nav aria-label="منوی اصلی" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 pb-safe backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {bottomNav.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) => cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-brand-800' : 'text-ink-500 hover:text-ink-800')}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand-700" aria-hidden /> : null}
                      <span className="relative">
                        <it.icon size={22} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                        {it.count ? (
                          <span className="absolute -top-1.5 -end-2.5">
                            <CountBadge count={it.count} />
                          </span>
                        ) : null}
                      </span>
                      <span>{it.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
