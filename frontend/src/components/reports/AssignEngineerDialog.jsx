import { useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useAuth } from '../../auth/useAuth'
import { Scope } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import { useSubmit } from '../../hooks/useSubmit'
import * as employeesService from '../../services/employeesService'
import * as reportsService from '../../services/reportsService'
import ErrorAlert from '../common/ErrorAlert'

/**
 * Assign / reassign engineers on a report. The pick-list is the admin themselves, then their own
 * team, or every engineer for a global-scope admin. `onAssigned(report)` receives the updated report.
 */
export default function AssignEngineerDialog({ open, report, onClose, onAssigned }) {
  const { user } = useAuth()
  // null = "untouched": show the report's current assignees until the admin edits the list.
  const [selected, setSelected] = useState(null)

  const { data: team, loading, error: loadError } = useAsync(
    () =>
      open
        ? employeesService.listEngineers(user.scope === Scope.ALL ? {} : { facultyAdminId: user.employeeId })
        : Promise.resolve([]),
    [open, user.employeeId, user.scope],
  )

  // The admin can work a case themselves, so they head the list. Without this, opening the dialog
  // on a case they had taken and saving would silently take them off it.
  const engineers = useMemo(() => {
    if (!team) return null
    const me = { employeeId: user.employeeId, email: user.email, name: `Me (${user.name})` }
    return [me, ...team.filter((e) => e.employeeId !== user.employeeId)]
  }, [team, user])

  const currentAssignees = useMemo(() => {
    if (!report || !engineers) return []
    const currentIds = new Set(report.assignees?.map((a) => a.assigneeId) ?? [])
    return engineers.filter((e) => currentIds.has(e.employeeId))
  }, [report, engineers])

  const value = selected ?? currentAssignees

  const handleClose = () => {
    setSelected(null)
    onClose()
  }

  const [submit, { submitting, error }] = useSubmit(async () => {
    const updated = await reportsService.assignEngineers(
      report.reportId,
      value.map((e) => e.employeeId),
      user,
    )
    onAssigned?.(updated)
    handleClose()
  })

  if (!report) return null

  return (
    <Dialog open={open} onClose={submitting ? undefined : handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign engineer(s)</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {report.title} — <strong>{report.location}</strong>
        </DialogContentText>
        <Autocomplete
          multiple
          options={engineers ?? []}
          loading={loading}
          value={value}
          onChange={(_, next) => setSelected(next)}
          getOptionLabel={(e) => `${e.name} (${e.email})`}
          isOptionEqualToValue={(a, b) => a.employeeId === b.employeeId}
          renderValue={(values, getItemProps) =>
            values.map((option, index) => (
              <Chip {...getItemProps({ index })} key={option.employeeId} label={option.name} size="small" />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label="Engineers" placeholder="Search your team, or pick yourself" autoFocus />
          )}
        />
        {report.pendingAssignmentRequests?.length > 0 && (
          <DialogContentText sx={{ mt: 2 }} variant="body2">
            Requested by: {report.pendingAssignmentRequests.map((r) => r.engineer.name).join(', ')}
          </DialogContentText>
        )}
        <ErrorAlert error={loadError || error} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} variant="contained" disabled={submitting || loading} loading={submitting}>
          Save assignment
        </Button>
      </DialogActions>
    </Dialog>
  )
}
