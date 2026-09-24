import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import PanToolIcon from '@mui/icons-material/PanTool'
import TodayIcon from '@mui/icons-material/Today'
import EngineeringIcon from '@mui/icons-material/Engineering'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import PublicIcon from '@mui/icons-material/Public'
import PageHeader from '../../components/common/PageHeader'
import ErrorAlert from '../../components/common/ErrorAlert'
import StatTile from '../../components/dashboard/StatTile'
import AssignEngineerDialog from '../../components/reports/AssignEngineerDialog'
import IncidentBoard from '../../components/reports/IncidentBoard'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import { Scope } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'

/**
 * Faculty Admin / Manager dashboard. `scope` is TEAM for a regular faculty admin and ALL for the
 * "Admin" tier, which sees every team's incidents and engineers (spec Open Question 1).
 * Admins also do engineer work: they file reports and take cases themselves, with no approval step.
 */
export default function FacultyAdminDashboard({ user, scope = Scope.TEAM }) {
  const { notify } = useSnackbar()
  const [assigning, setAssigning] = useState(null) // { report, reload }
  const [boardKey, setBoardKey] = useState(0)

  const [takingId, setTakingId] = useState(null)

  const stats = useAsync(() => reportsService.getDashboardStats({ viewer: user }), [user, boardKey])
  const isGlobal = scope === Scope.ALL

  // A faculty admin works cases too: taking one adds them to whoever is already on it.
  const takeCase = async (report) => {
    setTakingId(report.reportId)
    try {
      const ids = (report.assignees ?? []).map((a) => a.assigneeId)
      await reportsService.assignEngineers(report.reportId, [...ids, user.employeeId], user)
      notify('You are now on this case')
      setBoardKey((k) => k + 1)
    } catch (err) {
      notify(errorMessage(err), 'error')
    } finally {
      setTakingId(null)
    }
  }

  const renderActions = (report, reload) => {
    const onIt = report.assignees?.some((a) => a.assigneeId === user.employeeId)
    return (
      <Stack direction="row" spacing={1}>
        {!onIt && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PanToolIcon />}
            onClick={() => takeCase(report)}
            disabled={takingId === report.reportId}
            loading={takingId === report.reportId}
          >
            Take case
          </Button>
        )}
        <Button size="small" variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => setAssigning({ report, reload })}>
          {report.assignees?.length ? 'Reassign' : 'Assign engineer(s)'}
        </Button>
      </Stack>
    )
  }

  return (
    <>
      <PageHeader
        title={isGlobal ? 'Organisation overview' : 'Team overview'}
        subtitle={isGlobal ? 'Incidents and engineers across every faculty admin team.' : 'Incidents on your team and the engineers available to take them.'}
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/team/open-cases" variant="outlined">
              Current open cases
            </Button>
            <Button component={RouterLink} to="/reports/new" variant="contained" startIcon={<AddCircleOutlineIcon />}>
              New report
            </Button>
          </Stack>
        }
      />

      {isGlobal && (
        <Alert icon={<PublicIcon fontSize="inherit" />} severity="info" sx={{ mb: 3 }}>
          Admin scope: showing data across <strong>all teams</strong>, not just your own engineers.
        </Alert>
      )}

      <ErrorAlert error={stats.error} onRetry={stats.reload} sx={{ mb: 2 }} />
      <Grid container spacing={2} sx={{ mb: 5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Incidents today" value={stats.data?.incidentsToday ?? '—'} hint="Filed since midnight" icon={TodayIcon} loading={stats.loading && !stats.data} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Available engineers"
            value={stats.data ? `${stats.data.availableEngineers} / ${stats.data.totalEngineers}` : '—'}
            hint="Not on an active assignment"
            icon={EngineeringIcon}
            loading={stats.loading && !stats.data}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Open cases" value={stats.data?.openCases ?? '—'} hint={stats.data ? `${stats.data.unassigned} unassigned` : undefined} icon={FolderOpenIcon} loading={stats.loading && !stats.data} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Pending approvals" value={stats.data?.pendingApprovals ?? '—'} hint="Assignment and close requests" icon={PendingActionsIcon} loading={stats.loading && !stats.data} />
        </Grid>
      </Grid>

      <IncidentBoard key={boardKey} viewer={user} renderActions={renderActions} showAuthor title={isGlobal ? 'Current incidents (all teams)' : 'Current incidents'} />

      <AssignEngineerDialog
        open={Boolean(assigning)}
        report={assigning?.report ?? null}
        onClose={() => setAssigning(null)}
        onAssigned={() => {
          notify('Assignment saved')
          assigning?.reload()
          setBoardKey((k) => k + 1)
        }}
      />
    </>
  )
}
