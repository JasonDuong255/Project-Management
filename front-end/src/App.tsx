import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { ConfirmDialogProvider } from './components/ConfirmDialog'
import { LoadingOverlayProvider } from './components/LoadingOverlay'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import { AppProvider, useAppData } from './context/AppContext'
import { AdminCatalogPage } from './pages/AdminCatalogPage'
import { DashboardPage } from './pages/DashboardPage'
import { GanttPage } from './pages/GanttPage'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { MemberWorkspacePage } from './pages/MemberWorkspacePage'
import { NotificationCenterPage } from './pages/NotificationCenterPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportsPage } from './pages/ReportsPage'

function LoginRoute() {
  const { currentUser, isLoading } = useAppData()

  if (isLoading) {
    return (
      <div className="screen-loader">
        <div className="loader-card">
          <span className="eyebrow">QLDA</span>
          <h2>Đang tải dữ liệu</h2>
          <p>Đang kết nối với Supabase và tải snapshot từ backend...</p>
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
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/member-workspace" element={<MemberWorkspacePage />} />
            <Route path="/gantt" element={<GanttPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/admin/catalogs"
              element={
                <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'PMO']}>
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
    <ToastProvider>
      <ConfirmDialogProvider>
        <LoadingOverlayProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </LoadingOverlayProvider>
      </ConfirmDialogProvider>
    </ToastProvider>
  )
}

export default App
