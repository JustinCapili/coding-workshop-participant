import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import LoadingState from '../common/LoadingState'

/** Redirects unauthenticated visitors to /login, remembering where they were going. */
export default function RequireAuth() {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <LoadingState label="Restoring session…" minHeight="60vh" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
