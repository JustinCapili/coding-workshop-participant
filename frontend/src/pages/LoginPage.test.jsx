import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { ApiError } from '../services/apiError'
import * as authService from '../services/authService'
import { renderApp, renderWithProviders, seededUser } from '../test/renderApp'
import LoginPage from './LoginPage'

const emailField = () => screen.getByLabelText(/employee email/i)
const passwordField = () => screen.getByLabelText(/^password/i)
const confirmField = () => screen.getByLabelText(/^confirm password/i)

async function signIn(user, email, password) {
  await user.type(emailField(), email)
  await user.type(passwordField(), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

afterEach(() => jest.restoreAllMocks())

describe('LoginPage', () => {
  describe('signing in', () => {
    it('asks for a valid email and a password, and only after a submit', async () => {
      const { user } = renderApp({ route: '/login' })
      expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()

      await user.type(emailField(), 'not-an-email')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    })

    it('says so when the email or password is wrong', async () => {
      const { user } = renderApp({ route: '/login' })

      await signIn(user, 'bob@acme.com', 'wrong-password')
      expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    })

    it.each([
      ['alice@acme.com', 'Welcome, Alice'],
      ['bob@acme.com', 'Welcome, Bob'],
      ['frank@acme.com', 'Team overview'],
      ['admin@acme.inc', 'Organisation overview'],
    ])('lands %s on their dashboard', async (email, heading) => {
      const { user } = renderApp({ route: '/login' })

      await signIn(user, email, 'password')
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    })

    it('asks for the saved page after signing in, when RequireAuth sent the visitor here', async () => {
      const login = jest.fn().mockResolvedValue(null)
      const { user } = renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reports/new" element={<p>Create report page</p>} />
        </Routes>,
        // MemoryRouter takes a location object too, which is how the redirect's state arrives.
        { route: { pathname: '/login', state: { from: { pathname: '/reports/new' } } }, auth: { login } },
      )

      await signIn(user, 'alice@acme.com', 'password')
      expect(await screen.findByText('Create report page')).toBeInTheDocument()
    })

    it('returns to the page the visitor was sent away from', async () => {
      const { user } = renderApp({ route: '/reports/new' })
      await screen.findByRole('button', { name: 'Sign in' })

      await signIn(user, 'alice@acme.com', 'password')
      expect(await screen.findByRole('heading', { level: 1, name: 'Create Incident Report' })).toBeInTheDocument()
    })

    // Signing in sets the user before navigate(from) lands (router navigations are transitions),
    // so the page's own signed-in redirect must honour the saved page too, or the deep link is lost.
    it('sends a signed-in user on a redirected /login to the saved page, not the dashboard', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reports/new" element={<p>Create report page</p>} />
          <Route path="/dashboard" element={<p>Dashboard page</p>} />
        </Routes>,
        {
          route: { pathname: '/login', state: { from: { pathname: '/reports/new' } } },
          auth: { user: seededUser('alice@acme.com') },
        },
      )

      expect(await screen.findByText('Create report page')).toBeInTheDocument()
    })

    it('links back to the landing page', async () => {
      const { user } = renderApp({ route: '/login' })

      await user.click(await screen.findByRole('link', { name: 'Home' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'See something? Say something.' })).toBeInTheDocument()
    })

    it('sends a visitor who is already signed in to the dashboard', async () => {
      renderApp({ route: '/login', as: 'bob@acme.com' })
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Bob' })).toBeInTheDocument()
    })

    it('locks the form while signing in', async () => {
      const login = jest.fn(() => new Promise(() => {}))
      const { user } = renderWithProviders(<LoginPage />, { auth: { login } })

      await signIn(user, 'bob@acme.com', 'password')
      expect(login).toHaveBeenCalledWith('bob@acme.com', 'password')
      expect(emailField()).toBeDisabled()
      expect(passwordField()).toBeDisabled()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Create an account' })).toBeDisabled()
    })
  })

  describe('demo accounts', () => {
    it('lists one account per role with the shared password', async () => {
      renderApp({ route: '/login' })

      expect(await screen.findByRole('button', { name: 'Employee · alice@acme.com' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Engineer · bob@acme.com' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Faculty Admin · frank@acme.com' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Admin · admin@acme.inc' })).toBeInTheDocument()
      expect(screen.getByText(/Password for every demo account/)).toHaveTextContent('password')
    })

    it('fills in the form from a chip, clearing earlier errors, and signs in', async () => {
      const { user } = renderApp({ route: '/login' })
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(screen.getByText('Password is required')).toBeInTheDocument()

      await user.click(await screen.findByRole('button', { name: 'Engineer · bob@acme.com' }))
      expect(emailField()).toHaveValue('bob@acme.com')
      expect(passwordField()).toHaveValue('password')
      expect(screen.queryByText('Password is required')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Bob' })).toBeInTheDocument()
    })

    it('are not offered when the backend is real', async () => {
      jest.spyOn(authService, 'listDemoAccounts').mockResolvedValue(null)
      renderApp({ route: '/login' })

      await screen.findByRole('button', { name: 'Sign in' })
      expect(authService.listDemoAccounts).toHaveBeenCalled()
      expect(screen.queryByText('Demo accounts')).not.toBeInTheDocument()
    })
  })

  describe('creating an account', () => {
    async function openRegister(user) {
      await user.click(screen.getByRole('button', { name: 'Create an account' }))
      return confirmField()
    }

    it('starts on the sign-up form when the landing page links to it', async () => {
      renderApp({ route: '/login?mode=register' })

      expect(await screen.findByLabelText(/^confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    })

    it('switches to a sign-up form with a confirm field, and back again', async () => {
      const { user } = renderApp({ route: '/login' })
      await screen.findByText('Demo accounts')
      await user.type(passwordField(), 'typed')

      await openRegister(user)
      expect(screen.getByText(/Create an account with your @acme.inc email/)).toBeInTheDocument()
      expect(screen.getByText('Your @acme.inc address')).toBeInTheDocument()
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
      expect(passwordField()).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
      expect(screen.queryByText('Demo accounts')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(screen.queryByLabelText(/^confirm password/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
      expect(screen.getByText('Demo accounts')).toBeInTheDocument()
    })

    it('asks for an 8-character password typed twice the same', async () => {
      const { user } = renderApp({ route: '/login' })
      await openRegister(user)

      await user.click(screen.getByRole('button', { name: 'Create account' }))
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()

      await user.type(emailField(), 'new.hire@acme.inc')
      await user.type(passwordField(), 'short')
      await user.type(confirmField(), 'shorter')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
      expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    it('asks for an @acme.inc address before creating an account, but not to sign in', async () => {
      const register = jest.fn()
      const { user, auth } = renderWithProviders(<LoginPage />, { auth: { register } })
      await openRegister(user)

      await user.type(emailField(), 'new.hire@acme.com')
      await user.type(passwordField(), 'long-enough')
      await user.type(confirmField(), 'long-enough')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
      expect(screen.getByText('Use your @acme.inc email address')).toBeInTheDocument()
      expect(register).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      await user.type(passwordField(), 'password')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(screen.queryByText('Use your @acme.inc email address')).not.toBeInTheDocument()
      expect(auth.login).toHaveBeenCalledWith('new.hire@acme.com', 'password')
    })

    it('refuses an email that already has an account', async () => {
      const { user } = renderApp({ route: '/login' })
      await openRegister(user)

      await user.type(emailField(), 'admin@acme.inc')
      await user.type(passwordField(), 'long-enough')
      await user.type(confirmField(), 'long-enough')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
      expect(await screen.findByText('An account with email admin@acme.inc already exists')).toBeInTheDocument()
    })

    it('forgets a failed attempt when switching back to sign in', async () => {
      const { user } = renderApp({ route: '/login' })
      await openRegister(user)
      await user.type(emailField(), 'admin@acme.inc')
      await user.type(passwordField(), 'long-enough')
      await user.type(confirmField(), 'long-enough')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
      await screen.findByText(/already exists/)

      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(screen.queryByText(/already exists/)).not.toBeInTheDocument()
      expect(emailField()).toHaveValue('admin@acme.inc')
    })

    it('starts a new account on its dashboard even when a page was saved', async () => {
      const { user } = renderApp({ route: '/reports/new' })
      await screen.findByRole('button', { name: 'Sign in' })
      await openRegister(user)

      await user.type(emailField(), 'new.hire@acme.inc')
      await user.type(passwordField(), 'long-enough')
      await user.type(confirmField(), 'long-enough')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, New' })).toBeInTheDocument()
    })

    it('creates the account and signs straight in to the employee dashboard', async () => {
      const { user } = renderApp({ route: '/login' })
      await openRegister(user)

      await user.type(emailField(), 'new.hire@acme.inc')
      await user.type(passwordField(), 'long-enough')
      await user.type(confirmField(), 'long-enough')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, New' })).toBeInTheDocument()
      expect(within(screen.getByRole('banner')).getByText('Employee')).toBeInTheDocument()
    })
  })

  describe('after the session expired', () => {
    const notice = 'Your session has expired. Sign in again to continue.'

    it('explains why the user is back at the login page', async () => {
      renderWithProviders(<LoginPage />, { auth: { sessionExpired: true } })

      expect(screen.getByText(notice)).toBeInTheDocument()
      await screen.findByText('Demo accounts')
    })

    it('drops the notice in favour of a sign-in error, and on the sign-up form', async () => {
      const login = jest.fn().mockRejectedValue(new ApiError(401, 'Invalid email or password'))
      const { user } = renderWithProviders(<LoginPage />, { auth: { sessionExpired: true, login } })

      await signIn(user, 'bob@acme.com', 'wrong-password')
      expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
      expect(screen.queryByText(notice)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Create an account' }))
      expect(screen.queryByText(notice)).not.toBeInTheDocument()
    })
  })
})
