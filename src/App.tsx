import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppProvider, useAppData } from './context/AppContext'
import { AdminCatalogPage } from './pages/AdminCatalogPage'
import { DashboardPage } from './pages/DashboardPage'
import { GanttPage } from './pages/GanttPage'
import { LoginPage } from './pages/LoginPage'
import { MemberWorkspacePage } from './pages/MemberWorkspacePage'
import { NotificationCenterPage } from './pages/NotificationCenterPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportsPage } from './pages/ReportsPage'
import { WorkloadPage } from './pages/WorkloadPage'

function LoginRoute() {
  const { currentUser, isLoading } = useAppData()

  if (isLoading) {
    return (
      <div className="screen-loader">
        <div className="loader-card">
          <span className="eyebrow">PPM Demo Suite</span>
          <h2>Đang chuẩn bị dữ liệu demo</h2>
          <p>Khởi tạo phiên đăng nhập và dữ liệu mô phỏng từ JSON...</p>
        </div>
      </div>
    )
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />
  }

  return <LoginPage />
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/notifications" element={<NotificationCenterPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route
              path="/workload"
              element={
                <ProtectedRoute allowedRoles={['PROJECT_ADMIN', 'SYSTEM_ADMIN']}>
                  <WorkloadPage />
                </ProtectedRoute>
              }
            />
            <Route path="/member-workspace" element={<MemberWorkspacePage />} />
            <Route path="/gantt" element={<GanttPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/admin/catalogs"
              element={
                <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']}>
                  <AdminCatalogPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}

export default App
