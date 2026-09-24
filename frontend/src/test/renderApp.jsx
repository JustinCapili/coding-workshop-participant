/**
 * Render helpers for component and page tests.
 *
 * renderApp mounts the whole application, as main.jsx does, at a given route and optionally
 * signed in as one of the seeded mock accounts. Pages then talk to the mock backend (see
 * setupEnv.js), so a test drives the real page, the real services and the real routing.
 *
 * renderWithProviders mounts a single component with the contexts it reads supplied directly,
 * for components whose collaborators a test wants to control.
 */
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import App from '../App'
import AuthProvider from '../auth/AuthProvider'
import { AuthContext } from '../auth/authContext'
import SnackbarProvider from '../components/feedback/SnackbarProvider'
import { SnackbarContext } from '../components/feedback/snackbarContext'
import { employees } from '../services/mock/fixtures'
import { toPublic } from '../services/mock/employeesMock'
import theme from '../theme'

const SESSION_KEY = 'acme-incident-session'

/** The public record of a seeded mock account, by email. */
export function seededUser(email) {
  const employee = employees.find((e) => e.email === email)
  if (!employee) throw new Error(`No seeded account ${email}`)
  return toPublic(employee)
}

/** Puts a mock session in sessionStorage, as a sign-in would, so AuthProvider restores it. */
export function signInAs(email) {
  const user = seededUser(email)
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: `mock-token-${user.employeeId}`, user }),
  )
  return user
}

/**
 * Renders the whole app at `route`.
 *
 * @param {{ route?: string, as?: string }} options `as` is a seeded email to be signed in as
 * @returns the render result plus `user`, a userEvent instance
 */
export function renderApp({ route = '/', as } = {}) {
  if (as) signInAs(as)
  const user = userEvent.setup()
  const result = render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <SnackbarProvider>
            <App />
          </SnackbarProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { ...result, user }
}

/**
 * Renders one component with the auth and snackbar contexts supplied by the test.
 *
 * @param {import('react').ReactNode} ui the component
 * @param {object} options
 * @param {object} [options.auth] overrides for the auth context value; `user` is the signed-in user
 * @param {Function} [options.notify] the snackbar's notify; a jest.fn by default
 * @param {string} [options.route] the initial location
 * @param {string} [options.path] a route pattern to mount `ui` under, for pages that read params
 */
export function renderWithProviders(ui, { auth = {}, notify = jest.fn(), route = '/', path } = {}) {
  const authValue = {
    user: null,
    token: null,
    initializing: false,
    sessionExpired: false,
    signedOut: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    changePassword: jest.fn(),
    ...auth,
  }
  const user = userEvent.setup()
  const result = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <AuthContext.Provider value={authValue}>
          <SnackbarContext.Provider value={{ notify }}>
            {path ? (
              <Routes>
                <Route path={path} element={ui} />
                <Route path="*" element={<div>Navigated away</div>} />
              </Routes>
            ) : (
              ui
            )}
          </SnackbarContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { ...result, user, auth: authValue, notify }
}
