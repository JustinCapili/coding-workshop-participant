import { useState } from 'react'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Tooltip from '@mui/material/Tooltip'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import HistoryIcon from '@mui/icons-material/History'
import PanToolIcon from '@mui/icons-material/PanTool'
import ActionCard from '../../components/dashboard/ActionCard'
import PageHeader from '../../components/common/PageHeader'
import IncidentBoard from '../../components/reports/IncidentBoard'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import { ReportStatus } from '../../domain/reportStatus'
import { errorMessage } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'

/**
 * Engineer dashboard: everything an employee gets plus the team's current incidents, filterable
 * by location and status, with a "request assignment" action that routes to the Faculty Admin.
 */
export default function EngineerDashboard({ user }) {
  const { notify } = useSnackbar()
  const [pendingId, setPendingId] = useState(null)

  const requestAssignment = async (report, reload) => {
    setPendingId(report.reportId)
    try {
      await reportsService.requestAssignment(report.reportId, user)
      notify('Request sent to your Faculty Admin for approval')
      reload()
    } catch (err) {
      notify(errorMessage(err), 'error')
    } finally {
      setPendingId(null)
    }
  }

  const renderActions = (report, reload) => {
    if (report.status !== ReportStatus.UNASSIGNED) return null
    const alreadyRequested = report.pendingAssignmentRequests?.some((r) => r.engineerId === user.employeeId)
    return (
      <Tooltip title={alreadyRequested ? 'Waiting for Faculty Admin approval' : 'Ask to be assigned to this incident'}>
        <span>
          <Button
            size="small"
            variant={alreadyRequested ? 'outlined' : 'contained'}
            startIcon={<PanToolIcon />}
            disabled={alreadyRequested || pendingId === report.reportId}
            loading={pendingId === report.reportId}
            onClick={() => requestAssignment(report, reload)}
          >
            {alreadyRequested ? 'Requested' : 'Request assignment'}
          </Button>
        </span>
      </Tooltip>
    )
  }

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Pick up open incidents on your team, or file one yourself." />

      <Grid container spacing={2} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <ActionCard
            title="Create Incident Report"
            description="File a new report as an employee. It starts unassigned like any other."
            to="/reports/new"
            icon={AddCircleOutlineIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <ActionCard
            title="Previous Reports"
            description="Browse approved and archived reports to find how similar problems were solved."
            to="/reports/previous"
            icon={HistoryIcon}
          />
        </Grid>
      </Grid>

      <IncidentBoard viewer={user} renderActions={renderActions} showAuthor />
    </>
  )
}
