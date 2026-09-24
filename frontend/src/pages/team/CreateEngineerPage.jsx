import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import UpgradeIcon from '@mui/icons-material/Upgrade'
import { useAuth } from '../../auth/useAuth'
import EmptyState from '../../components/common/EmptyState'
import ErrorAlert from '../../components/common/ErrorAlert'
import LoadingState from '../../components/common/LoadingState'
import PageHeader from '../../components/common/PageHeader'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import { COMPANY_EMAIL_MESSAGE, isCompanyEmail } from '../../domain/accounts'
import { Scope } from '../../domain/roles'
import { useAsync } from '../../hooks/useAsync'
import { useSubmit } from '../../hooks/useSubmit'
import { USE_MOCKS } from '../../services/config'
import * as employeesService from '../../services/employeesService'
import { initials } from '../../utils/format'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

/**
 * `/team/engineers/new` (Faculty Admin+) — add an engineer to the signed-in admin's team.
 *
 * Two ways. Promote an existing employee by their id: they keep their account and password, and
 * find the id in their account menu or on Settings. Or create a new account, which against the
 * backend needs an employee id and a temporary password for the engineer's first sign-in; the mock
 * (VITE_USE_MOCKS=true) keeps the email-only flow there, where an existing employee is promoted or
 * moved.
 */
export default function CreateEngineerPage() {
  const { user, refresh } = useAuth()
  const { notify } = useSnackbar()
  const [email, setEmail] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [lastCreated, setLastCreated] = useState(null)
  const [promoteId, setPromoteId] = useState('')
  const [promoteTouched, setPromoteTouched] = useState(false)
  const [lastPromoted, setLastPromoted] = useState(null)

  const isGlobal = user.scope === Scope.ALL
  const team = useAsync(() => employeesService.listEngineers(isGlobal ? {} : { facultyAdminId: user.employeeId }), [user, isGlobal])

  // Generated ids are upper case (EMP-37FB73AFBC), so a lower-case paste still finds the employee.
  const [promote, promoting] = useSubmit(async () => {
    const engineer = await employeesService.promoteEmployee({
      employeeId: promoteId.trim().toUpperCase(),
      facultyAdminId: user.employeeId,
    })
    setLastPromoted(engineer)
    setPromoteId('')
    setPromoteTouched(false)
    notify(`${engineer.email} is now an engineer`)
    team.reload()
  })

  const promoteIdError = promoteTouched && !promoteId.trim() ? "Enter the employee's ID" : ''

  const handlePromote = (e) => {
    e.preventDefault()
    setPromoteTouched(true)
    if (!promoteId.trim()) return
    promote()
  }

  const [submit, { submitting, error, reset }] = useSubmit(async () => {
    const engineer = await employeesService.createEngineer({
      email,
      employeeId,
      password,
      facultyAdminId: user.employeeId,
    })
    setLastCreated(engineer)
    setEmail('')
    setEmployeeId('')
    setPassword('')
    setTouched(false)
    notify(USE_MOCKS ? `${engineer.email} now has engineer permissions` : `Created ${engineer.email}`)
    team.reload()
    await refresh() // picks up any role change to the signed-in account (no-op otherwise)
  })

  // Against the backend this always creates an account, which must be a company address. The mock
  // may be promoting an existing @acme.com employee by email, so it leaves that to the mock.
  const companyEmailMissing = !USE_MOCKS && EMAIL_RE.test(email) && !isCompanyEmail(email)
  const emailError = !touched
    ? ''
    : !EMAIL_RE.test(email)
      ? 'Enter a valid employee email'
      : companyEmailMissing
        ? COMPANY_EMAIL_MESSAGE
        : ''
  const employeeIdError = !USE_MOCKS && touched && !employeeId.trim() ? 'Employee ID is required' : ''
  const passwordError =
    !USE_MOCKS && touched && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters`
      : ''

  const handleSubmit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (!EMAIL_RE.test(email) || companyEmailMissing) return
    if (!USE_MOCKS && (!employeeId.trim() || password.length < MIN_PASSWORD)) return
    submit()
  }

  return (
    <>
      <PageHeader
        title="Create Engineer"
        subtitle={
          USE_MOCKS
            ? 'Promote an employee by their ID, or grant engineer permissions by email. They join your team and can start requesting incidents.'
            : 'Promote an existing employee by their ID, or create a new engineer account on your team.'
        }
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                  Promote an existing employee
                </Typography>
                <Stack component="form" onSubmit={handlePromote} noValidate spacing={2}>
                  <TextField
                    label="Existing employee ID"
                    value={promoteId}
                    onChange={(e) => {
                      setPromoteId(e.target.value)
                      promoting.reset()
                    }}
                    error={Boolean(promoteIdError)}
                    helperText={
                      promoteIdError ||
                      "They'll find it in their account menu or on Settings. They keep their password."
                    }
                    required
                    autoFocus
                    disabled={promoting.submitting}
                  />
                  <ErrorAlert error={promoting.error} />
                  {lastPromoted && !promoting.error && (
                    <Alert severity="success" onClose={() => setLastPromoted(null)}>
                      <strong>{lastPromoted.name}</strong> ({lastPromoted.email}) is now an engineer on your team.
                    </Alert>
                  )}
                  <Stack direction="row" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<UpgradeIcon />}
                      disabled={promoting.submitting}
                      loading={promoting.submitting}
                    >
                      Promote to engineer
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                  Create a new engineer account
                </Typography>
                <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2}>
                  <TextField
                    label="Employee email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      reset()
                    }}
                    onBlur={() => setTouched(true)}
                    error={Boolean(emailError)}
                    helperText={
                      emailError ||
                      (USE_MOCKS
                        ? 'An existing employee is promoted; an unknown email creates a new engineer record.'
                        : 'They sign in with this email.')
                    }
                    required
                    disabled={submitting}
                  />
                  {!USE_MOCKS && (
                    <>
                      <TextField
                        label="Employee ID"
                        value={employeeId}
                        onChange={(e) => {
                          setEmployeeId(e.target.value)
                          reset()
                        }}
                        error={Boolean(employeeIdError)}
                        helperText={employeeIdError || 'Must be unique across all staff, e.g. ENG-004.'}
                        required
                        disabled={submitting}
                      />
                      <TextField
                        label="Temporary password"
                        type="text"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          reset()
                        }}
                        error={Boolean(passwordError)}
                        helperText={passwordError || 'Shown here so you can pass it on. It is stored hashed.'}
                        required
                        disabled={submitting}
                      />
                    </>
                  )}
                  <ErrorAlert error={error} />
                  {lastCreated && !error && (
                    <Alert severity="success" onClose={() => setLastCreated(null)}>
                      <strong>{lastCreated.name}</strong> ({lastCreated.email}){' '}
                      {lastCreated.moved
                        ? 'moved to your team'
                        : lastCreated.created
                          ? 'created as an engineer on your team'
                          : 'granted engineer permissions'}
                      .
                    </Alert>
                  )}
                  <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" startIcon={<PersonAddIcon />} disabled={submitting} loading={submitting}>
                      {USE_MOCKS ? 'Grant engineer permission' : 'Create engineer'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            {isGlobal ? 'All engineers' : 'Your engineers'}
            {team.data && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {team.data.length}
              </Typography>
            )}
          </Typography>
          {team.loading && !team.data && <LoadingState minHeight={120} />}
          <ErrorAlert error={team.error} onRetry={team.reload} />
          {team.data?.length === 0 && <EmptyState title="No engineers yet" description="Add one with the form." />}
          {team.data?.length > 0 && (
            <Card>
              <List disablePadding>
                {team.data.map((e, i) => (
                  <ListItem key={e.employeeId} divider={i < team.data.length - 1} secondaryAction={isGlobal ? <Chip size="small" variant="outlined" label={e.facultyAdminId ?? 'No team'} /> : undefined}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main', fontSize: 13 }}>{initials(e.name)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={e.name} secondary={`${e.email} · ${e.employeeId}`} />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}
        </Grid>
      </Grid>
    </>
  )
}
