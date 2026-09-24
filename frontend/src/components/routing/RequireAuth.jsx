import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import LoadingState from '../common/LoadingState'

/**
 * Redirects unauthenticated visitors to /login, remembering where they were going so signing in
 * returns them there. Not after a deliberate log-out: the page being left belongs to the person who
 * just left, and the next to sign in on this tab should start on their own dashboard.
 */
export default function RequireAuth() {
  const { user, initializing, signedOut } = useAuth()
  const location = useLocation()

  if (initializing) return <LoadingState label="Restoring session…" minHeight="60vh" />
  if (!user) return <Navigate to="/login" replace state={signedOut ? undefined : { from: location }} />
  return <Outlet />
}
