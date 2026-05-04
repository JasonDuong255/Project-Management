import {
  BarChart3,
  BellRing,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  UserCog,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
    label: 'Việc của tôi',
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
    label: 'Cài đặt',
    icon: Settings2,
    roles: ['PMO', 'SYSTEM_ADMIN'],
  },
]

export function AppShell() {
  const { currentUser, logout, planItems, projects, users } = useAppData()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    if (searchOpen) {
      document.addEventListener('mousedown', onClickOutside)
      return () => document.removeEventListener('mousedown', onClickOutside)
    }
    return undefined
  }, [searchOpen])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return { projects: [], tasks: [] }
    const matchedProjects = projects
      .filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q),
      )
      .slice(0, 6)
    const matchedTasks = planItems
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 6)
    return { projects: matchedProjects, tasks: matchedTasks }
  }, [searchQuery, projects, planItems])

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
            <span className="eyebrow">Module</span>
            <h2>{currentTitle}</h2>
          </div>
          <div className="topbar-meta">
            <div
              ref={searchRef}
              className="topbar-search"
              style={{ position: 'relative' }}
            >
              <Search size={14} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Tìm dự án, task..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 'inherit',
                  width: '180px',
                  color: 'inherit',
                }}
              />
              {searchOpen && searchQuery.trim() ? (
                <div
                  className="panel"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '320px',
                    zIndex: 50,
                    padding: '0.5rem',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '420px',
                    overflowY: 'auto',
                  }}
                >
                  {searchResults.projects.length === 0 &&
                  searchResults.tasks.length === 0 ? (
                    <p style={{ padding: '0.5rem' }}>Không có kết quả.</p>
                  ) : null}
                  {searchResults.projects.length ? (
                    <div>
                      <span className="eyebrow" style={{ padding: '0 0.5rem' }}>
                        Dự án
                      </span>
                      {searchResults.projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="ghost-button"
                          style={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                          }}
                          onClick={() => {
                            navigate(`/projects/${p.id}`)
                            setSearchOpen(false)
                            setSearchQuery('')
                          }}
                        >
                          <strong>{p.code}</strong> — {p.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {searchResults.tasks.length ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className="eyebrow" style={{ padding: '0 0.5rem' }}>
                        Công việc
                      </span>
                      {searchResults.tasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="ghost-button"
                          style={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                          }}
                          onClick={() => {
                            navigate(`/projects/${t.projectId}`)
                            setSearchOpen(false)
                            setSearchQuery('')
                          }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
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
