import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { useAuth } from '../auth/useAuth'
import { useAsync } from '../hooks/useAsync'
import { useSubmit } from '../hooks/useSubmit'
import * as authService from '../services/authService'
import { roleLabel } from '../domain/roles'

/** Matches AuthController.MIN_PASSWORD_LENGTH; only enforced when creating an account. */
const MIN_PASSWORD_LENGTH = 8

function fieldErrors({ email, password, confirm, registering }) {
  const errors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email'
  if (!password) errors.password = 'Password is required'
  else if (registering && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (registering && confirm !== password) errors.confirm = 'Passwords do not match'
  return errors
}

export default function LoginPage() {
  const { user, login, register, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // 'signin', or 'register' for the self-service "Create an account" form.
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  // Null unless VITE_USE_MOCKS=true; real accounts are never listed.
  const { data: demo } = useAsync(() => authService.listDemoAccounts(), [])
  const registering = mode === 'register'

  const [submit, { submitting, error, reset }] = useSubmit(async () => {
    if (registering) {
      await register(email, password)
      navigate('/dashboard', { replace: true })
      return
    }
    await login(email, password)
    // Post-login routing is role-aware inside /dashboard; honour a deep link if one was saved.
    navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
  })

  if (user) return <Navigate to="/dashboard" replace />

  const errors = touched ? fieldErrors({ email, password, confirm, registering }) : {}

  const handleSubmit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(fieldErrors({ email, password, confirm, registering })).length) return
    submit()
  }

  const switchMode = (next) => {
    setMode(next)
    setPassword('')
    setConfirm('')
    setTouched(false)
    reset()
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: (t) => `linear-gradient(160deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 60%, #3b6ea5 100%)`,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ReportProblemIcon color="primary" />
            <Typography variant="overline" color="text.secondary">
              ACME Inc.
            </Typography>
          </Stack>
          <Typography variant="h4" component="h1" gutterBottom>
            Incident Reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {registering
              ? 'Create an account with your employee email to file and follow incident reports.'
              : 'Sign in with your employee email. Your role decides what you see next.'}
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Employee email"
                type="email"
                autoComplete={registering ? 'email' : 'username'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={Boolean(errors.email)}
                helperText={errors.email}
                required
                autoFocus
                disabled={submitting}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete={registering ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={Boolean(errors.password)}
                helperText={errors.password ?? (registering ? `At least ${MIN_PASSWORD_LENGTH} characters` : '')}
                required
                disabled={submitting}
              />
              {registering && (
                <TextField
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  error={Boolean(errors.confirm)}
                  helperText={errors.confirm}
                  required
                  disabled={submitting}
                />
              )}
              {sessionExpired && !registering && !error && (
                <Alert severity="info">Your session has expired. Sign in again to continue.</Alert>
              )}
              {error && <Alert severity="error">{error.message}</Alert>}
              <Button type="submit" variant="contained" size="large" disabled={submitting} loading={submitting}>
                {registering ? 'Create account' : 'Sign in'}
              </Button>
              <Typography variant="body2" color="text.secondary" align="center">
                {registering ? 'Already have an account?' : 'New here?'}{' '}
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => switchMode(registering ? 'signin' : 'register')}
                  disabled={submitting}
                >
                  {registering ? 'Sign in' : 'Create an account'}
                </Link>
              </Typography>
            </Stack>
          </Box>

          {demo && !registering && (
            <>
              <Divider sx={{ my: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Demo accounts
                </Typography>
              </Divider>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {demo.accounts.map((account) => (
                  <Chip
                    key={account.email}
                    label={`${roleLabel(account)} · ${account.email}`}
                    variant="outlined"
                    onClick={() => {
                      setEmail(account.email)
                      setPassword(demo.password)
                      setTouched(false)
                    }}
                    disabled={submitting}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Password for every demo account: <code>{demo.password}</code>. Accounts are mocked
                (VITE_USE_MOCKS=true).
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
