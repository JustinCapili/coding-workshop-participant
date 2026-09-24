import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import LandingPage from '../../pages/landing/LandingPage'
import LoadingState from '../common/LoadingState'

/**
 * `/`: the landing page for a visitor who is not signed in, and straight on to their dashboard for
 * one who is. Waits for a saved session to be restored first, so a signed-in visitor never sees the
 * landing page flash by.
 */
export default function HomeRoute() {
  const { user, initializing } = useAuth()

  if (initializing) return <LoadingState label="Restoring session…" minHeight="60vh" />
  if (user) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}
