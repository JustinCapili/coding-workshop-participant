/**
 * What each role can reach: the sidebar it is shown, and the pages it is refused when it types
 * their address anyway.
 */
import { createEngineer, register } from './support/api'
import { useBrowser } from './support/browser'
import { ADMIN, RUN_ID, emailFor } from './support/config'

const NO_PERMISSION = 'You do not have permission to view this page.'

describe('what each role can reach', () => {
  const session = useBrowser()
  const employee = { email: emailFor('morgan'), password: 'morgan-password' }
  const engineer = {
    email: emailFor('riley'),
    password: 'riley-password',
    employeeId: `E2E-${RUN_ID}-ACC`.toUpperCase(),
  }

  beforeAll(async () => {
    await register(employee.email, employee.password)
    await createEngineer(engineer)
  })

  it('gives an employee Dashboard and Common Cases, and refuses the team pages', async () => {
    const { app } = session
    await app.signIn(employee.email, employee.password)

    expect(await app.sidebarLinks()).toEqual(['Dashboard', 'Common Cases'])

    await app.press('Common Cases')
    await app.heading('Common Cases')

    for (const pathname of ['/team/open-cases', '/team/engineers/new', '/reports/previous']) {
      await app.visit(pathname)
      await app.alert(NO_PERMISSION)
    }
    await app.signOut()
  })

  it('adds the engineer pages for an engineer, but not the team pages', async () => {
    const { app } = session
    await app.signIn(engineer.email, engineer.password)

    expect(await app.sidebarLinks()).toEqual([
      'Dashboard',
      'Common Cases',
      'Previous Reports',
      'Request Inventory',
    ])

    await app.press('Previous Reports')
    await app.heading('Previous Reports')

    await app.visit('/team/open-cases')
    await app.alert(NO_PERMISSION)
    await app.signOut()
  })

  it('gives the default admin every section, including Faculty Admins', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)

    expect(await app.sidebarLinks()).toEqual([
      'Dashboard',
      'Common Cases',
      'Previous Reports',
      'Request Inventory',
      'Create Engineer',
      'Current Open Cases',
      'Faculty Admins',
    ])
    await app.signOut()
  })

  it('starts the next person on their own dashboard, not the page the last one logged out from', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.visit('/team/open-cases')
    await app.heading('Current Open Cases')
    await app.signOut()

    // On the same tab, straight after: the admin-only page must not be remembered.
    await app.signIn(employee.email, employee.password, { here: true })

    expect(await app.path()).toBe('/dashboard')
    await app.heading('Welcome, Morgan')
  })
})
