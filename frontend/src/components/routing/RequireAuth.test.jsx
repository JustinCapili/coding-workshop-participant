import { screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import RequireAuth from './RequireAuth'

/** Stands in for the login page and shows where the visitor was sent from. */
function LoginProbe() {
  const { state } = useLocation()
  return <p>Login, from {state?.from ? `${state.from.pathname}${state.from.search}` : 'nowhere'}</p>
}

function renderGuarded(auth) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route element={<RequireAuth />}>
        <Route path="/reports/:reportId" element={<p>Report page</p>} />
      </Route>
    </Routes>,
    { auth, route: '/reports/RPT-1001?tab=activity' },
  )
}

describe('RequireAuth', () => {
  it('shows "Restoring session…" while the session is being restored', () => {
    renderGuarded({ initializing: true })

    expect(screen.getByRole('status')).toHaveTextContent('Restoring session…')
    expect(screen.queryByText('Report page')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Login/)).not.toBeInTheDocument()
  })

  it('sends a signed-out visitor to /login, remembering the page they wanted', () => {
    renderGuarded({ user: null })

    expect(screen.getByText('Login, from /reports/RPT-1001?tab=activity')).toBeInTheDocument()
    expect(screen.queryByText('Report page')).not.toBeInTheDocument()
  })

  it('does not remember the page when the user has just signed out on purpose', () => {
    renderGuarded({ user: null, signedOut: true })

    expect(screen.getByText('Login, from nowhere')).toBeInTheDocument()
  })

  it('renders the page for a signed-in user', () => {
    renderGuarded({ user: seededUser('alice@acme.com') })
    expect(screen.getByText('Report page')).toBeInTheDocument()
  })
})
