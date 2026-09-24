import { useAuth } from '../auth/useAuth'
import { Role, Scope } from '../domain/roles'
import EmployeeDashboard from './dashboard/EmployeeDashboard'
import EngineerDashboard from './dashboard/EngineerDashboard'
import FacultyAdminDashboard from './dashboard/FacultyAdminDashboard'

/** `/dashboard` — picks the dashboard for the signed-in role. */
export default function DashboardPage() {
  const { user } = useAuth()
  switch (user.role) {
    case Role.FACULTY_ADMIN:
      return <FacultyAdminDashboard user={user} scope={user.scope ?? Scope.TEAM} />
    case Role.ENGINEER:
      return <EngineerDashboard user={user} />
    default:
      return <EmployeeDashboard user={user} />
  }
}
