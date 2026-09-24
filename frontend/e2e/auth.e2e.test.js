/**
 * Getting in and out: sign-in errors, self-service registration, signing out, and deep links that
 * survive a trip through the login page.
 */
import { useBrowser } from './support/browser'
import { ADMIN, RUN_ID, emailFor } from './support/config'

describe('signing in and out', () => {
  const session = useBrowser()
  const robin = { email: emailFor('robin'), password: 'robin-password' }
  let reportId
  const title = `Door badge reader offline ${RUN_ID}`

  it('turns a wrong password away with a message and stays on the login page', async () => {
    const { app } = session
    await app.visit('/login')
    await app.fill('Employee email', ADMIN.email)
    await app.fill('Password', 'not-the-password')
    await app.press('Sign in')

    await app.alert('Invalid email or password')
    expect(await app.path()).toBe('/login')
  })

  it('signs a faculty admin in to the team overview', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.heading('Team overview')
    await app.signOut()
  })

  it('registers a new employee, who lands on their own dashboard', async () => {
    const { app } = session
    await app.register(robin.email, robin.password)
    await app.heading('Welcome, Robin')
    reportId = await app.fileReport({ title, location: 'Main entrance' })
  })

  it('signs out, after which a protected page sends you to the login page', async () => {
    const { app } = session
    await app.signOut()
    await app.visit('/dashboard')
    await app.waitForPath(/^\/login$/)
  })

  it('brings you back to the report you asked for once you sign in', async () => {
    const { app } = session
    await app.visit(`/reports/${reportId}`)
    await app.waitForPath(/^\/login$/)

    await app.signIn(robin.email, robin.password, { here: true })

    expect(await app.waitForPath(/^\/reports\//)).toBe(`/reports/${reportId}`)
    await app.heading(title)
  })

  it('answers an unknown address with a page-not-found screen that links home', async () => {
    const { app } = session
    await app.visit('/no/such/page')
    await app.text('Page not found')
    await app.press('Go to dashboard')
    await app.heading('Welcome, Robin')
  })
})
