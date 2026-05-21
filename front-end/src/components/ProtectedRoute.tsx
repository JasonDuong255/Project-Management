import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAppData } from '../context/AppContext'
import type { UserRole } from '../types'

interface ProtectedRouteProps extends PropsWithChildren {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { currentUser, isLoading } = useAppData()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="screen-loader">
        <div className="loader-card">
          <h2>Đang nạp dữ liệu…</h2>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children ?? <Outlet />
}
