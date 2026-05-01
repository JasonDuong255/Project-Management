import {
  BarChart3,
  BellRing,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings2,
  UserCog,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppData } from '../context/AppContext'
import { getTaskDeadlineNotifications } from '../lib/calculations'
import { getRoleLabel } from '../lib/formatters'
import type { UserRole } from '../types'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Tổng quan',
    icon: LayoutDashboard,
  },
  {
    to: '/projects',
    label: 'Dự án',
    icon: FolderKanban,
  },
  {
    to: '/member-workspace',
    label: 'Không gian thành viên',
    icon: UserCog,
  },
  {
    to: '/gantt',
    label: 'Biểu đồ Gantt',
    icon: CalendarRange,
  },
  {
    to: '/reports',
    label: 'Báo cáo',
    icon: BarChart3,
  },
  {
    to: '/notifications',
    label: 'Thông báo',
    icon: BellRing,
  },
  {
    to: '/admin/catalogs',
    label: 'Cài đặt hệ thống',
    icon: Settings2,
    roles: ['PMO', 'SYSTEM_ADMIN'],
  },
]

export function AppShell() {
  const { currentUser, logout, planItems, projects, users } = useAppData()
  const navigate = useNavigate()
  const location = useLocation()

  if (!currentUser) {
    return null
  }

  const availableNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(currentUser.role),
  )

  const currentTitle =
    availableNavItems.find((item) => location.pathname.startsWith(item.to))?.label ??
    'Quản lý dự án'

  const notificationCount = getTaskDeadlineNotifications(
    planItems,
    projects,
    users,
    currentUser,
  ).length

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">Q</div>
          <h1>QLDA</h1>
        </div>

        <nav className="sidebar-nav">
          {availableNavItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'nav-link nav-link--active' : 'nav-link'
                }
              >
                <Icon size={18} />
                <span className="nav-link__content">
                  <span>{item.label}</span>
                  {item.to === '/notifications' && notificationCount ? (
                    <span className="nav-link__badge">{notificationCount}</span>
                  ) : null}
                </span>
              </NavLink>
            )
          })}
        </nav>

        <div className="profile-block">
          <div
            className="avatar-chip"
            style={{ backgroundColor: currentUser.avatarColor }}
          >
            {currentUser.name
              .split(' ')
              .slice(-1)[0]
              ?.charAt(0)
              .toUpperCase()}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{getRoleLabel(currentUser.role)}</span>
          </div>
          <button type="button" className="ghost-button" onClick={handleLogout} title="Đăng xuất">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="app-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Mô đun đang xem</span>
            <h2>{currentTitle}</h2>
          </div>
          <div className="topbar-meta">
            <div className="topbar-search">
              <Search size={14} />
              <span>Tìm kiếm...</span>
            </div>
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={() => navigate('/notifications')}
              title="Thông báo"
            >
              <MessageSquare size={18} />
            </button>
            <button
              type="button"
              className="topbar-icon-btn topbar-icon-btn--badge"
              onClick={() => navigate('/notifications')}
              title="Thông báo"
              data-count={notificationCount || undefined}
            >
              <BellRing size={18} />
            </button>
            <span className="status-pill tone-info">{currentUser.unit}</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
