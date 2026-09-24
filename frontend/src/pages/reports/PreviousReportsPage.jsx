import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import PageHeader from '../../components/common/PageHeader'
import ReportFilters from '../../components/reports/ReportFilters'
import ReportGrid from '../../components/reports/ReportGrid'
import { Scope, isFacultyAdmin } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import * as employeesService from '../../services/employeesService'
import * as reportsService from '../../services/reportsService'

/**
 * `/reports/previous` (Engineer+) — APPROVED/ARCHIVED reports, read-only, filterable by date
 * range and by the engineer who completed them. Used to find prior solutions.
 */
export default function PreviousReportsPage() {
  const { user } = useAuth()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [engineerId, setEngineerId] = useState('')

  const teamScope = user.scope === Scope.ALL ? {} : { facultyAdminId: user.facultyAdminId ?? user.employeeId }
  const { data: team } = useAsync(() => employeesService.listEngineers(teamScope), [user])
  // Faculty admins work cases too, so they can filter for the ones they completed themselves.
  const engineers =
    team && isFacultyAdmin(user)
      ? [{ employeeId: user.employeeId, email: user.email, name: `Me (${user.name})` }, ...team]
      : team

  const { data, loading, error, reload } = useAsync(
    () =>
      reportsService.listReports({
        viewer: user,
        completedOnly: true,
        from: from || undefined,
        to: to || undefined,
        completedBy: engineerId || undefined,
      }),
    [user, from, to, engineerId],
  )

  return (
    <>
      <PageHeader title="Previous Reports" subtitle="Approved and archived incidents. Read-only reference for how past problems were solved." />
      <ReportFilters
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        engineerId={engineerId}
        onEngineerChange={setEngineerId}
        engineers={engineers ?? []}
        onClear={() => {
          setFrom('')
          setTo('')
          setEngineerId('')
        }}
      />
      <ReportGrid
        reports={data}
        loading={loading}
        error={error}
        onRetry={reload}
        showAuthor
        emptyTitle="No completed reports match"
        emptyDescription="Widen the date range or pick a different engineer."
      />
    </>
  )
}
