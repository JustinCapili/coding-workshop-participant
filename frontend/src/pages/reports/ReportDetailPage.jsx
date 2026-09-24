import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PanToolIcon from '@mui/icons-material/PanTool'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { useAuth } from '../../auth/useAuth'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ErrorAlert from '../../components/common/ErrorAlert'
import LoadingState from '../../components/common/LoadingState'
import PriorityChip from '../../components/common/PriorityChip'
import StatusChip from '../../components/common/StatusChip'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import ActivityThread from '../../components/reports/ActivityThread'
import AssignEngineerDialog from '../../components/reports/AssignEngineerDialog'
import AssigneeList from '../../components/reports/AssigneeList'
import ReportStatusActions from '../../components/reports/ReportStatusActions'
import { INCIDENT_TYPES, labelFor } from '../../domain/incidentOptions'
import { ReportStatus } from '../../domain/reportStatus'
import { Role, isFacultyAdmin } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import { useSubmit } from '../../hooks/useSubmit'
import { errorMessage } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { formatDateTime } from '../../utils/format'

function Detail({ label, children }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>{typeof children === 'string' ? <Typography variant="body2">{children}</Typography> : children}</Box>
    </Box>
  )
}

/** `/reports/:reportId` — title, status, assignees, activity thread and role-aware actions. */
export default function ReportDetailPage() {
  const { reportId } = useParams()
  const { user } = useAuth()
  const { notify } = useSnackbar()
  const [confirmClose, setConfirmClose] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const { data: report, loading, error, reload } = useAsync(
    () => reportsService.getReport(reportId, { viewer: user }),
    [reportId, user],
  )

  const act = async (fn, successMessage) => {
    try {
      await fn()
      if (successMessage) notify(successMessage)
      reload()
    } catch (err) {
      notify(errorMessage(err), 'error')
    }
  }

  const [requestClose, closeState] = useSubmit(async () => {
    await reportsService.requestClose(reportId, user)
    setConfirmClose(false)
    notify('Close request sent to your Faculty Admin for confirmation')
    reload()
  })
  const [requestAssignment, requestState] = useSubmit(() =>
    act(() => reportsService.requestAssignment(reportId, user), 'Request sent to your Faculty Admin'),
  )
  // A faculty admin takes a case directly, joining whoever is already on it; no approval step.
  const [takeCase, takeState] = useSubmit(() =>
    act(
      () =>
        reportsService.assignEngineers(
          reportId,
          [...report.assignees.map((a) => a.assigneeId), user.employeeId],
          user,
        ),
      'You are now on this case',
    ),
  )
  const [transition, transitionState] = useSubmit((next) =>
    act(() => reportsService.transitionReport(reportId, next, user), `Status changed to ${next}`),
  )

  if (loading && !report) return <LoadingState label="Loading report…" />
  // Retrying cannot turn "you may not see this" or "it does not exist" into anything else.
  if (error) {
    return <ErrorAlert error={error} onRetry={[403, 404].includes(error.status) ? undefined : reload} />
  }
  if (!report) return null

  const isAuthor = report.authorId === user.employeeId
  const admin = isFacultyAdmin(user)
  const isEngineerRole = user.role === Role.ENGINEER
  const alreadyRequested = report.pendingAssignmentRequests.some((r) => r.engineerId === user.employeeId)
  const canRequestClose = isAuthor && report.status !== ReportStatus.ARCHIVED && !report.pendingCloseRequest
  const canRequestAssignment = isEngineerRole && report.status === ReportStatus.UNASSIGNED
  const canTakeCase =
    admin &&
    report.status !== ReportStatus.ARCHIVED &&
    !report.assignees.some((a) => a.assigneeId === user.employeeId)
  const busy = requestState.submitting || transitionState.submitting || takeState.submitting

  return (
    <>
      <Button component={RouterLink} to="/dashboard" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1 }}>
        Back to dashboard
      </Button>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <StatusChip status={report.status} size="medium" />
        <PriorityChip priority={report.priority} />
        <Typography variant="body2" color="text.secondary">
          {report.reportId}
          {report.incidentType && ` · ${labelFor(INCIDENT_TYPES, report.incidentType)}`}
        </Typography>
      </Stack>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        {report.title}
      </Typography>

      {report.pendingCloseRequest && (
        <Alert
          severity="info"
          icon={<DoneAllIcon fontSize="inherit" />}
          sx={{ mb: 2 }}
          action={
            admin ? (
              <Stack direction="row" spacing={1}>
                <Button color="inherit" size="small" onClick={() => act(() => reportsService.declineCloseRequest(report.pendingCloseRequest.requestId, user), 'Close request declined')}>
                  Decline
                </Button>
                <Button color="inherit" size="small" variant="outlined" onClick={() => act(() => reportsService.approveCloseRequest(report.pendingCloseRequest.requestId, user), 'Report archived')}>
                  Confirm close
                </Button>
              </Stack>
            ) : undefined
          }
        >
          {isAuthor ? 'You asked to close this report. ' : 'The reporter asked to close this report. '}
          {admin ? 'Confirming will archive it.' : 'A Faculty Admin needs to confirm before it is archived.'}
        </Alert>
      )}

      {admin && report.pendingAssignmentRequests.length > 0 && (
        <Alert severity="warning" icon={<PanToolIcon fontSize="inherit" />} sx={{ mb: 2 }}>
          <Stack spacing={1}>
            {report.pendingAssignmentRequests.map((r) => (
              <Stack key={r.requestId} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  <strong>{r.engineer.name}</strong> requested to work this incident
                </Typography>
                <Button size="small" color="inherit" onClick={() => act(() => reportsService.declineAssignmentRequest(r.requestId, user), 'Request declined')}>
                  Decline
                </Button>
                <Button size="small" color="inherit" variant="outlined" onClick={() => act(() => reportsService.approveAssignmentRequest(r.requestId, user), `${r.engineer.name} assigned`)}>
                  Approve
                </Button>
              </Stack>
            ))}
          </Stack>
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }} order={{ xs: 2, md: 1 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {report.body || <em>No description provided.</em>}
              </Typography>
            </CardContent>
          </Card>

          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Activity
          </Typography>
          <ActivityThread
            activity={report.activity}
            reportAuthorId={report.authorId}
            onComment={(body) => reportsService.addComment(reportId, body, user).then(reload)}
            disabled={report.status === ReportStatus.ARCHIVED}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }} order={{ xs: 1, md: 2 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Detail label="Assignee(s)">
                  <AssigneeList assignees={report.assignees} />
                </Detail>
                <Detail label="Location">{report.location}</Detail>
                <Detail label="Reported by">{`${report.author?.name ?? report.authorId} · ${report.author?.email ?? ''}`}</Detail>
                <Detail label="Created">{formatDateTime(report.createdAt)}</Detail>
                <Detail label="Last updated">{formatDateTime(report.updatedAt)}</Detail>

                {(admin || canRequestAssignment || canRequestClose || report.status !== ReportStatus.ARCHIVED) && <Divider />}

                <ReportStatusActions report={report} user={user} onTransition={transition} busy={busy} />

                {canTakeCase && (
                  <Button
                    variant="contained"
                    startIcon={<PanToolIcon />}
                    disabled={busy}
                    loading={takeState.submitting}
                    onClick={takeCase}
                  >
                    Take this case
                  </Button>
                )}

                {admin && report.status !== ReportStatus.ARCHIVED && (
                  <Button variant="outlined" startIcon={<PersonAddAlt1Icon />} onClick={() => setAssignOpen(true)}>
                    {report.assignees.length ? 'Reassign engineer(s)' : 'Assign engineer(s)'}
                  </Button>
                )}

                {canRequestAssignment && (
                  <Tooltip title={alreadyRequested ? 'Waiting for Faculty Admin approval' : ''}>
                    <span>
                      <Button
                        fullWidth
                        variant={alreadyRequested ? 'outlined' : 'contained'}
                        startIcon={<PanToolIcon />}
                        disabled={alreadyRequested || busy}
                        loading={requestState.submitting}
                        onClick={requestAssignment}
                      >
                        {alreadyRequested ? 'Assignment requested' : 'Request assignment'}
                      </Button>
                    </span>
                  </Tooltip>
                )}

                {canRequestClose && (
                  <Button variant="outlined" color="secondary" startIcon={<DoneAllIcon />} onClick={() => setConfirmClose(true)}>
                    Request to close
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmClose}
        title="Request to close this report?"
        description="This will not archive the report immediately. A Faculty Admin will review your request and confirm the close."
        confirmLabel="Send close request"
        busy={closeState.submitting}
        error={closeState.error}
        onConfirm={requestClose}
        onClose={() => {
          setConfirmClose(false)
          closeState.reset()
        }}
      />

      <AssignEngineerDialog
        open={assignOpen}
        report={report}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => {
          notify('Assignment saved')
          reload()
        }}
      />
    </>
  )
}
