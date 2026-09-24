import { Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import HomeRoute from './components/routing/HomeRoute'
import RequireAuth from './components/routing/RequireAuth'
import RequireRole from './components/routing/RequireRole'
import { isDefaultAdmin } from './domain/accounts'
import { Role } from './domain/roles'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import SettingsPage from './pages/account/SettingsPage'
import CommonCasesPage from './pages/engineer/CommonCasesPage'
import RequestInventoryPage from './pages/engineer/RequestInventoryPage'
import CreateReportPage from './pages/reports/CreateReportPage'
import PreviousReportsPage from './pages/reports/PreviousReportsPage'
import ReportDetailPage from './pages/reports/ReportDetailPage'
import CreateEngineerPage from './pages/team/CreateEngineerPage'
import FacultyAdminsPage from './pages/team/FacultyAdminsPage'
import OpenCasesPage from './pages/team/OpenCasesPage'

/**
 * Route table (see spec "Suggested routes"). `/` is the landing page for visitors who are not signed
 * in and the dashboard for everyone else (HomeRoute). Everything except `/` and /login sits behind
 * RequireAuth and the AppShell; Engineer+ and Faculty Admin+ pages are additionally gated by
 * RequireRole, and Faculty Admins only admits admin@acme.inc.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reports/new" element={<CreateReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/common-cases" element={<CommonCasesPage />} />

          <Route element={<RequireRole role={Role.ENGINEER} />}>
            <Route path="/reports/previous" element={<PreviousReportsPage />} />
            <Route path="/inventory/request" element={<RequestInventoryPage />} />
          </Route>

          <Route path="/reports/:reportId" element={<ReportDetailPage />} />

          <Route element={<RequireRole role={Role.FACULTY_ADMIN} />}>
            <Route path="/team/engineers/new" element={<CreateEngineerPage />} />
            <Route path="/team/open-cases" element={<OpenCasesPage />} />
          </Route>

          <Route element={<RequireRole role={Role.FACULTY_ADMIN} when={isDefaultAdmin} />}>
            <Route path="/team/admins" element={<FacultyAdminsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
