import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useAuth } from '../../auth/useAuth'
import ErrorAlert from '../../components/common/ErrorAlert'
import PageHeader from '../../components/common/PageHeader'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import { INCIDENT_TYPES, PRIORITIES } from '../../domain/incidentOptions'
import { useSubmit } from '../../hooks/useSubmit'
import * as reportsService from '../../services/reportsService'

const INITIAL = { title: '', incidentType: '', priority: 'MEDIUM', location: '', body: '' }

function validate(values) {
  const errors = {}
  if (!values.title.trim()) errors.title = 'Give the report a short title'
  else if (values.title.trim().length < 5) errors.title = 'Title should be at least 5 characters'
  if (!values.incidentType) errors.incidentType = 'Choose the type of incident'
  if (!values.priority) errors.priority = 'Choose a priority'
  if (!values.location.trim()) errors.location = 'Where is the problem? Room number or floor'
  return errors
}

/** `/reports/new` — creates a Report in UNASSIGNED authored by the current user. */
export default function CreateReportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notify } = useSnackbar()
  const [values, setValues] = useState(INITIAL)
  const [touched, setTouched] = useState({})

  const errors = validate(values)
  const showError = (field) => touched[field] && errors[field]

  const [submit, { submitting, error }] = useSubmit(async () => {
    const report = await reportsService.createReport(values, user)
    notify(`Report ${report.reportId} created`)
    navigate(`/reports/${report.reportId}`)
  })

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))
  const blur = (field) => () => setTouched((t) => ({ ...t, [field]: true }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setTouched({ title: true, incidentType: true, priority: true, location: true })
    if (Object.keys(errors).length) return
    submit()
  }

  return (
    <>
      <PageHeader title="Create Incident Report" subtitle="Describe what is wrong and where. The report starts unassigned; a Faculty Admin will put an engineer on it." />

      <Card sx={{ maxWidth: 760 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2.5}>
            <TextField
              label="Title"
              value={values.title}
              onChange={set('title')}
              onBlur={blur('title')}
              error={Boolean(showError('title'))}
              helperText={showError('title') || 'e.g. "Projector in Room 204 not powering on"'}
              required
              autoFocus
              disabled={submitting}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Type of incident"
                  value={values.incidentType}
                  onChange={set('incidentType')}
                  onBlur={blur('incidentType')}
                  error={Boolean(showError('incidentType'))}
                  helperText={showError('incidentType') || ' '}
                  required
                  disabled={submitting}
                >
                  {INCIDENT_TYPES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Priority"
                  value={values.priority}
                  onChange={set('priority')}
                  onBlur={blur('priority')}
                  error={Boolean(showError('priority'))}
                  helperText={showError('priority') || ' '}
                  required
                  disabled={submitting}
                >
                  {PRIORITIES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label="Location"
              placeholder="Building, floor and room number"
              value={values.location}
              onChange={set('location')}
              onBlur={blur('location')}
              error={Boolean(showError('location'))}
              helperText={showError('location') || 'Room number / floor'}
              required
              disabled={submitting}
            />
            <TextField
              label="Description"
              multiline
              minRows={4}
              value={values.body}
              onChange={set('body')}
              helperText="Optional. What happened, when it started, anything you already tried."
              disabled={submitting}
            />

            <ErrorAlert error={error} />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button component={RouterLink} to="/dashboard" disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} loading={submitting}>
                Submit report
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </>
  )
}
