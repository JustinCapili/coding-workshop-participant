import { Link as RouterLink, Outlet } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useAuth } from '../../auth/useAuth'
import { hasRole } from '../../domain/roles'

/**
 * Renders children only for users holding `role` (or a role that inherits from it) and, when given,
 * passing `when(user)`, such as `isDefaultAdmin` for pages only admin@acme.inc may use.
 */
export default function RequireRole({ role, when }) {
  const { user } = useAuth()
  if (!hasRole(user, role) || (when && !when(user))) {
    return (
      <Alert
        severity="warning"
        action={
          <Button component={RouterLink} to="/dashboard" color="inherit" size="small">
            Back to dashboard
          </Button>
        }
      >
        You do not have permission to view this page.
      </Alert>
    )
  }
  return <Outlet />
}
