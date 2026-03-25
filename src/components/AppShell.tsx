import {
  BarChart3,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings2,
  TimerReset,
  UserCog,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAppData } from '../context/AppContext'
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
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    to: '/projects',
    label: 'Dự án',
    icon: FolderKanban,
  },
  {
    to: '/workload',
    label: 'Phân bổ giờ công',
    icon: TimerReset,
    roles: ['PROJECT_ADMIN', 'SYSTEM_ADMIN'],
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
    to: '/admin/catalogs',
    label: 'Danh mục hệ thống',
    icon: Settings2,
    roles: ['SYSTEM_ADMIN'],
  },
]

export function AppShell() {
  const { currentUser, logout } = useAppData()
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

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="eyebrow">Internal PM Platform</span>
          <h1>Project Product Management</h1>
          <p>
            Bộ khung frontend mô phỏng cho hệ thống quản lý dự án nội bộ của công ty.
          </p>
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
                <span>{item.label}</span>
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
          <button type="button" className="ghost-button" onClick={handleLogout}>
            <LogOut size={16} />
            Đăng xuất
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
            <span className="status-pill tone-info">{currentUser.unit}</span>
            <span className="status-pill tone-neutral">
              Sức chứa tháng: {currentUser.monthlyCapacity}h
            </span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
