/**
 * Changing your password from Settings, with a second browser signed in as the same person to
 * prove every other session is signed out, not just the one that made the change.
 */
import { register } from './support/api'
import { useBrowser } from './support/browser'
import { emailFor } from './support/config'

describe('changing your password', () => {
  const here = useBrowser('changing')
  const elsewhere = useBrowser('elsewhere')
  const account = { email: emailFor('taylor'), password: 'taylor-old-password' }
  const newPassword = 'taylor-new-password'

  beforeAll(async () => {
    await register(account.email, account.password)
  })

  it('signs the same person in in two browsers', async () => {
    await here.app.signIn(account.email, account.password)
    await elsewhere.app.signIn(account.email, account.password)
    await here.app.heading('Welcome, Taylor')
    await elsewhere.app.heading('Welcome, Taylor')
  })

  it('stops at step one when the current password is wrong', async () => {
    const { app } = here
    await app.openAccountMenu()
    await app.press('Settings')
    await app.heading('Settings')

    await app.fill('Current password', 'not-my-password')
    await app.press('Continue')

    await app.alert('Current password is incorrect')
    await app.field('Current password')
  })

  it('checks the new password is typed the same twice', async () => {
    const { app } = here
    await app.fill('Current password', account.password)
    await app.press('Continue')

    await app.fill('New password', newPassword)
    await app.fill('Confirm new password', 'something-else')
    await app.press('Change password')

    await app.text('Passwords do not match')
  })

  it('changes the password and keeps this browser signed in', async () => {
    const { app } = here
    await app.fill('Confirm new password', newPassword)
    await app.press('Change password')

    await app.alert('Password changed')
    await app.visit('/dashboard')
    await app.heading('Welcome, Taylor')
  })

  it('signs the other browser out on its next request', async () => {
    const { app, driver } = elsewhere
    await driver.navigate().refresh()

    await app.waitForPath(/^\/login$/)
    await app.alert('Your session has expired')
  })

  it('accepts only the new password from then on', async () => {
    const { app } = elsewhere
    await app.fill('Employee email', account.email)
    await app.fill('Password', account.password)
    await app.press('Sign in')
    await app.alert('Invalid email or password')

    await app.signIn(account.email, newPassword)
    await app.heading('Welcome, Taylor')
  })
})
