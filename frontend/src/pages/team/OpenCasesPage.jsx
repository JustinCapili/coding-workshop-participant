import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import PanToolIcon from '@mui/icons-material/PanTool'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import { useAuth } from '../../auth/useAuth'
import EmptyState from '../../components/common/EmptyState'
import ErrorAlert from '../../components/common/ErrorAlert'
import LoadingState from '../../components/common/LoadingState'
import PageHeader from '../../components/common/PageHeader'
import StatusChip from '../../components/common/StatusChip'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import AssignEngineerDialog from '../../components/reports/AssignEngineerDialog'
import { ReportStatus } from '../../domain/reportStatus'
import { Scope } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { formatRelative } from '../../utils/format'

function RequestRow({ primary, secondary, report, onApprove, onDecline, approveLabel = 'Approve', approveDisabledReason, busy }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ py: 1.5 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2">{primary}</Typography>
        <Typography variant="caption" color="text.secondary">
          {secondary} ·{' '}
          <Link component={RouterLink} to={`/reports/${report.reportId}`}>
            {report.reportId}
          </Link>{' '}
          — {report.title}
        </Typography>
      </Box>
      <StatusChip status={report.status} />
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={onDecline} disabled={busy}>
          Decline
        </Button>
        <Tooltip title={approveDisabledReason ?? ''}>
          <span>
            <Button size="small" variant="contained" onClick={onApprove} disabled={busy || Boolean(approveDisabledReason)}>
              {approveLabel}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  )
}

/**
 * `/team/open-cases` (Faculty Admin+) — every non-ARCHIVED report in scope, plus the two approval
 * queues: engineer assignment requests and author close requests. Assign/reassign from each row.
 */
export default function OpenCasesPage() {
  const { user } = useAuth()
  const { notify } = useSnackbar()
  const [assigning, setAssigning] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const isGlobal = user.scope === Scope.ALL

  const pending = useAsync(() => reportsService.listPendingRequests({ viewer: user }), [user])
  const cases = useAsync(() => reportsService.listReports({ viewer: user, openOnly: true }), [user])

  const reloadAll = () => {
    pending.reload()
    cases.reload()
  }

  const act = async (id, fn, success) => {
    setBusyId(id)
    try {
      await fn()
      notify(success)
      reloadAll()
    } catch (err) {
      notify(errorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const pendingCount = (pending.data?.assignmentRequests.length ?? 0) + (pending.data?.closeRequests.length ?? 0)

  return (
    <>
      <PageHeader title="Current Open Cases" subtitle={isGlobal ? 'Open reports and pending approvals across all teams.' : 'Open reports on your team and the approvals waiting on you.'} />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PanToolIcon color="action" />
                <Typography variant="h6" component="h2">
                  Engineer assignment requests
                </Typography>
                {pending.data && <Chip size="small" label={pending.data.assignmentRequests.length} />}
              </Stack>
              {pending.loading && !pending.data && <LoadingState minHeight={80} />}
              <ErrorAlert error={pending.error} onRetry={pending.reload} />
              {pending.data?.assignmentRequests.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No engineers are waiting on approval.
                </Typography>
              )}
              {pending.data?.assignmentRequests.map((r, i) => (
                <Box key={r.requestId} sx={{ borderTop: i ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <RequestRow
                    primary={
                      <>
                        <strong>{r.engineer.name}</strong> wants to work this incident
                      </>
                    }
                    secondary={`Requested ${formatRelative(r.requestedAt)}`}
                    report={r.report}
                    busy={busyId === r.requestId}
                    approveDisabledReason={r.report.status !== ReportStatus.UNASSIGNED ? 'Report is no longer unassigned — use Reassign below' : undefined}
                    onApprove={() => act(r.requestId, () => reportsService.approveAssignmentRequest(r.requestId, user), `${r.engineer.name} assigned to ${r.report.reportId}`)}
                    onDecline={() => act(r.requestId, () => reportsService.declineAssignmentRequest(r.requestId, user), 'Request declined')}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <DoneAllIcon color="action" />
                <Typography variant="h6" component="h2">
                  Close requests
                </Typography>
                {pending.data && <Chip size="small" label={pending.data.closeRequests.length} />}
              </Stack>
              {pending.loading && !pending.data && <LoadingState minHeight={80} />}
              {pending.data?.closeRequests.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No close requests waiting.
                </Typography>
              )}
              {pending.data?.closeRequests.map((r, i) => (
                <Box key={r.requestId} sx={{ borderTop: i ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <RequestRow
                    primary={
                      <>
                        <strong>{r.requester.name}</strong> asked to close this report
                      </>
                    }
                    secondary={`Requested ${formatRelative(r.requestedAt)}`}
                    report={r.report}
                    busy={busyId === r.requestId}
                    approveLabel="Confirm & archive"
                    approveDisabledReason={r.report.status === ReportStatus.UNASSIGNED ? 'Assign an engineer first, or decline' : undefined}
                    onApprove={() => act(r.requestId, () => reportsService.approveCloseRequest(r.requestId, user), `${r.report.reportId} archived`)}
                    onDecline={() => act(r.requestId, () => reportsService.declineCloseRequest(r.requestId, user), 'Close request declined')}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {pendingCount > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Approving a close request walks the report forward through the legal status moves to <strong>Archived</strong>; each step is recorded in the report's activity.
        </Alert>
      )}

      <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
        Open cases
        {cases.data && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {cases.data.length}
          </Typography>
        )}
      </Typography>
      {cases.loading && !cases.data && <LoadingState />}
      <ErrorAlert error={cases.error} onRetry={cases.reload} />
      {cases.data?.length === 0 && <EmptyState title="No open cases" description="Everything in scope is archived." />}
      {cases.data?.length > 0 && (
        <TableContainer component={Card}>
          <Table size="small" aria-label="Open cases">
            <TableHead>
              <TableRow>
                <TableCell>Report</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Reporter</TableCell>
                <TableCell>Assignee(s)</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.data.map((r) => (
                <TableRow key={r.reportId} hover>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Link component={RouterLink} to={`/reports/${r.reportId}`} underline="hover" sx={{ fontWeight: 600 }}>
                      {r.title}
                    </Link>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {r.reportId}
                      {r.pendingCloseRequest ? ' · close requested' : ''}
                      {r.pendingAssignmentRequests.length ? ` · ${r.pendingAssignmentRequests.length} request(s)` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={r.status} />
                  </TableCell>
                  <TableCell>{r.location}</TableCell>
                  <TableCell>{r.author?.name}</TableCell>
                  <TableCell>{r.assignees.length ? r.assignees.map((a) => a.employee.name).join(', ') : <Typography variant="body2" color="text.secondary">—</Typography>}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRelative(r.updatedAt)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<PersonAddAlt1Icon />} onClick={() => setAssigning(r)}>
                      {r.assignees.length ? 'Reassign' : 'Assign'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AssignEngineerDialog
        open={Boolean(assigning)}
        report={assigning}
        onClose={() => setAssigning(null)}
        onAssigned={() => {
          notify('Assignment saved')
          reloadAll()
        }}
      />
    </>
  )
}
