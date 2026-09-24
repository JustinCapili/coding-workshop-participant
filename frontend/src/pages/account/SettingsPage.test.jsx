import { screen, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as authService from '../../services/authService'
import { renderApp } from '../../test/renderApp'

const CHANGED = 'Your password has been changed. Use the new one next time you sign in.'

const currentField = () => screen.getByLabelText(/^current password/i)
const newField = () => screen.getByLabelText(/^new password/i)
const confirmField = () => screen.getByLabelText(/^confirm new password/i)

async function renderSettings() {
  const result = renderApp({ route: '/settings', as: 'alice@acme.com' })
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  return result
}

/** Pastes rather than types: one change event instead of a whole-app render per keystroke. */
async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

async function continueWith(user, password) {
  await fill(user, currentField(), password)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

async function changeTo(user, next, confirm = next) {
  if (next) await fill(user, newField(), next)
  if (confirm) await fill(user, confirmField(), confirm)
  await user.click(screen.getByRole('button', { name: 'Change password' }))
}

afterEach(() => jest.restoreAllMocks())

describe('SettingsPage', () => {
  it('names the signed-in account and starts on the first of two steps', async () => {
    await renderSettings()

    expect(
      screen.getByText('Manage the account you signed in with, alice@acme.com (employee ID EMP-001).'),
    ).toBeInTheDocument()
    expect(screen.getByText("Confirm it's you")).toBeInTheDocument()
    expect(screen.getByText('Choose a new password')).toBeInTheDocument()
    expect(currentField()).toHaveValue('')
    expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument()
  })

  describe('step 1: the current password', () => {
    it('asks for it before checking anything', async () => {
      const verifyPassword = jest.spyOn(authService, 'verifyPassword')
      const { user } = await renderSettings()

      await user.click(screen.getByRole('button', { name: 'Continue' }))
      expect(screen.getByText('Enter your current password')).toBeInTheDocument()
      expect(verifyPassword).not.toHaveBeenCalled()
    })

    it('says when it is wrong, until the user types again', async () => {
      const { user } = await renderSettings()

      await continueWith(user, 'not-it')
      expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
      expect(currentField()).toBeInTheDocument()

      await user.type(currentField(), 'x')
      expect(screen.queryByText('Current password is incorrect')).not.toBeInTheDocument()
    })

    it('moves on to choosing a new password when it is right', async () => {
      const { user } = await renderSettings()

      await continueWith(user, 'password')
      expect(await screen.findByLabelText(/^new password/i)).toHaveValue('')
      expect(confirmField()).toHaveValue('')
      expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
      expect(screen.queryByLabelText(/^current password/i)).not.toBeInTheDocument()
    })
  })

  describe('step 2: the new password', () => {
    async function renderStepTwo() {
      const result = await renderSettings()
      await continueWith(result.user, 'password')
      await screen.findByLabelText(/^new password/i)
      return result
    }

    it('needs at least 8 characters', async () => {
      const { user } = await renderStepTwo()

      await changeTo(user, '', '')
      expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
    })

    it('needs a password different from the current one', async () => {
      const { user } = await renderStepTwo()

      await changeTo(user, 'password')
      expect(screen.getByText('Choose a password different from your current one')).toBeInTheDocument()
    })

    it('needs the confirmation to match', async () => {
      const { user } = await renderStepTwo()

      await changeTo(user, 'new-password-1', 'new-password-2')
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
    })

    it('Back returns to step 1 with everything cleared', async () => {
      const { user } = await renderStepTwo()
      await changeTo(user, 'short', 'shorter')

      await user.click(screen.getByRole('button', { name: 'Back' }))
      expect(currentField()).toHaveValue('')
      expect(screen.queryByText('Enter your current password')).not.toBeInTheDocument()

      await continueWith(user, 'password')
      expect(await screen.findByLabelText(/^new password/i)).toHaveValue('')
      expect(screen.queryByText('Use at least 8 characters')).not.toBeInTheDocument()
    })

    it.each([
      ['new password', newField],
      ['confirmation', confirmField],
    ])('shows a failed change until the %s is edited', async (_, field) => {
      jest.spyOn(authService, 'changePassword').mockRejectedValue(new ApiError(500, 'Boom'))
      const { user } = await renderStepTwo()

      await changeTo(user, 'new-password-1')
      expect(await screen.findByText('Boom')).toBeInTheDocument()
      await user.type(field(), '!')
      expect(screen.queryByText('Boom')).not.toBeInTheDocument()
    })

    it('forgets a failed change on Back', async () => {
      jest.spyOn(authService, 'changePassword').mockRejectedValue(new ApiError(500, 'Boom'))
      const { user } = await renderStepTwo()
      await changeTo(user, 'new-password-1')
      await screen.findByText('Boom')

      await user.click(screen.getByRole('button', { name: 'Back' }))
      await continueWith(user, 'password')
      await screen.findByLabelText(/^new password/i)
      expect(screen.queryByText('Boom')).not.toBeInTheDocument()
    })

    it('changes the password, confirms it and starts over at step 1', async () => {
      const { user } = await renderStepTwo()

      await changeTo(user, 'new-password-1')
      expect(await screen.findByText('Password changed')).toBeInTheDocument()
      const success = screen.getByText(CHANGED)
      expect(success.closest('[role="alert"]')).toHaveClass('MuiAlert-standardSuccess')
      expect(currentField()).toHaveValue('')
      expect(screen.queryByText('Enter your current password')).not.toBeInTheDocument()

      await user.click(within(success.closest('[role="alert"]')).getByRole('button', { name: 'Close' }))
      expect(screen.queryByText(CHANGED)).not.toBeInTheDocument()
    })

    it('drops the success message once the user starts another change', async () => {
      const { user } = await renderStepTwo()
      await changeTo(user, 'new-password-1')
      await screen.findByText(CHANGED)

      await continueWith(user, 'new-password-1')
      expect(await screen.findByLabelText(/^new password/i)).toBeInTheDocument()
      expect(screen.queryByText(CHANGED)).not.toBeInTheDocument()
    })

    it('makes the new password the one to sign in with', async () => {
      const { user } = await renderStepTwo()
      await changeTo(user, 'new-password-1')
      await screen.findByText(CHANGED)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Log out' }))
      await fill(user, await screen.findByLabelText(/employee email/i), 'alice@acme.com')
      await fill(user, screen.getByLabelText(/^password/i), 'password')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()

      await user.clear(screen.getByLabelText(/^password/i))
      await fill(user, screen.getByLabelText(/^password/i), 'new-password-1')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByRole('button', { name: 'Account menu' })).toBeInTheDocument()
      expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument()
    })
  })
})
