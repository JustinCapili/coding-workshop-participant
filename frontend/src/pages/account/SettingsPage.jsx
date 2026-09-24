import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import LockResetIcon from '@mui/icons-material/LockReset'
import { useAuth } from '../../auth/useAuth'
import ErrorAlert from '../../components/common/ErrorAlert'
import PageHeader from '../../components/common/PageHeader'
import { useSnackbar } from '../../components/feedback/useSnackbar'
import { useSubmit } from '../../hooks/useSubmit'
import * as authService from '../../services/authService'

/** Matches AuthController.MIN_PASSWORD_LENGTH. */
const MIN_PASSWORD_LENGTH = 8

const STEPS = ["Confirm it's you", 'Choose a new password']

function newPasswordErrors({ current, next, confirm }) {
  const errors = {}
  if (next.length < MIN_PASSWORD_LENGTH) errors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters`
  else if (next === current) errors.next = 'Choose a password different from your current one'
  if (confirm !== next) errors.confirm = 'Passwords do not match'
  return errors
}

/**
 * `/settings` (all roles) — the signed-in user's account settings, reached from the avatar menu.
 *
 * Changing the password takes two steps: the current password is checked with the server first,
 * then the new one is entered twice. The backend checks the current password again on the change
 * itself and signs out every other session; this browser carries on with the token it returns.
 */
export default function SettingsPage() {
  const { user, changePassword } = useAuth()
  const { notify } = useSnackbar()
  const [step, setStep] = useState(0)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [changed, setChanged] = useState(false)

  const [verify, verifying] = useSubmit(async () => {
    await authService.verifyPassword(current)
    setTouched(false)
    setStep(1)
  })

  const [change, changing] = useSubmit(async () => {
    await changePassword(current, next)
    startOver()
    setChanged(true)
    notify('Password changed')
  })

  // Back, and after a successful change: nothing typed is kept, least of all the current password.
  function startOver() {
    setStep(0)
    setCurrent('')
    setNext('')
    setConfirm('')
    setTouched(false)
  }

  const currentError = touched && !current ? 'Enter your current password' : ''
  const errors = touched ? newPasswordErrors({ current, next, confirm }) : {}

  const handleVerify = (e) => {
    e.preventDefault()
    setTouched(true)
    setChanged(false)
    if (!current) return
    verify()
  }

  const handleChange = (e) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(newPasswordErrors({ current, next, confirm })).length) return
    change()
  }

  const handleBack = () => {
    changing.reset()
    startOver()
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={`Manage the account you signed in with, ${user.email} (employee ID ${user.employeeId}).`}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2">
                Change password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Changing your password signs you out everywhere else. You stay signed in here.
              </Typography>

              <Stepper activeStep={step} sx={{ mb: 3 }}>
                {STEPS.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {step === 0 ? (
                <Stack component="form" onSubmit={handleVerify} noValidate spacing={2}>
                  <TextField
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => {
                      setCurrent(e.target.value)
                      verifying.reset()
                    }}
                    error={Boolean(currentError)}
                    helperText={currentError || ' '}
                    required
                    autoFocus
                    disabled={verifying.submitting}
                  />
                  <ErrorAlert error={verifying.error} />
                  {changed && (
                    <Alert severity="success" onClose={() => setChanged(false)}>
                      Your password has been changed. Use the new one next time you sign in.
                    </Alert>
                  )}
                  <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={verifying.submitting} loading={verifying.submitting}>
                      Continue
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack component="form" onSubmit={handleChange} noValidate spacing={2}>
                  <TextField
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => {
                      setNext(e.target.value)
                      changing.reset()
                    }}
                    error={Boolean(errors.next)}
                    helperText={errors.next || `At least ${MIN_PASSWORD_LENGTH} characters.`}
                    required
                    autoFocus
                    disabled={changing.submitting}
                  />
                  <TextField
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value)
                      changing.reset()
                    }}
                    error={Boolean(errors.confirm)}
                    helperText={errors.confirm || ' '}
                    required
                    disabled={changing.submitting}
                  />
                  <ErrorAlert error={changing.error} />
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button onClick={handleBack} disabled={changing.submitting}>
                      Back
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<LockResetIcon />}
                      disabled={changing.submitting}
                      loading={changing.submitting}
                    >
                      Change password
                    </Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
