/**
 * Making a faculty admin, all through the browser: admin@acme.inc promotes an engineer from the
 * Faculty Admins page, and the engineer signs back in with the password they already had, now a
 * faculty admin who cannot make faculty admins themselves.
 */
import { createEngineer } from './support/api'
import { useBrowser } from './support/browser'
import { ADMIN, RUN_ID, emailFor } from './support/config'

const NO_PERMISSION = 'You do not have permission to view this page.'

describe('promoting an engineer to faculty admin', () => {
  const session = useBrowser()
  const jamie = {
    email: emailFor('jamie'),
    password: 'jamie-own-password',
    employeeId: `E2E-${RUN_ID}-FA`.toUpperCase(),
  }

  beforeAll(async () => {
    await createEngineer(jamie)
  })

  it('lets admin@acme.inc promote them from Faculty Admins, after a confirmation', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    expect(await app.sidebarLinks()).toContain('Faculty Admins')

    await app.press('Faculty Admins')
    await app.heading('Faculty Admins')
    await app.fill('Filter by name, email or ID', jamie.employeeId)
    await app.pressNear(`//*[normalize-space(.)='${jamie.email} · ${jamie.employeeId}']`, 'Make Faculty Admin')

    await app.text('leave the team they are on')
    await app.press('Make Faculty Admin', { within: "//*[@role='dialog']" })
    await app.alert(`${jamie.email} is now a faculty admin`)
    await app.signOut()
  })

  it('signs them in with their own password, as a faculty admin who cannot make more', async () => {
    const { app } = session
    await app.signIn(jamie.email, jamie.password)
    await app.heading('Team overview')

    expect(await app.sidebarLinks()).toEqual([
      'Dashboard',
      'Common Cases',
      'Previous Reports',
      'Request Inventory',
      'Create Engineer',
      'Current Open Cases',
    ])
    await app.visit('/team/admins')
    await app.alert(NO_PERMISSION)
    await app.signOut()
  })
})
