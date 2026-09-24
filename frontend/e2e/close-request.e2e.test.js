/**
 * Closing a report on the reporter's request: the author asks, a faculty admin confirms (archiving
 * it) or declines (leaving it open). Assignment goes through the admin's Assign dialog, the other
 * way onto a report besides an engineer's request.
 *
 * The engineer and the employee are arranged through the API; everything under test goes through
 * the browser.
 */
import { createEngineer, register } from './support/api'
import { useBrowser } from './support/browser'
import { ADMIN, RUN_ID, emailFor } from './support/config'

describe('asking to close a report', () => {
  const session = useBrowser()
  const engineer = {
    email: emailFor('jordan'),
    password: 'jordan-password',
    employeeId: `E2E-${RUN_ID}-CLS`.toUpperCase(),
  }
  const employee = { email: emailFor('alex'), password: 'alex-password' }

  beforeAll(async () => {
    await createEngineer(engineer)
    await register(employee.email, employee.password)
  })

  it('archives the report when the admin confirms the close request', async () => {
    const { app } = session
    const title = `Leaking tap in kitchen ${RUN_ID}`

    await app.signIn(employee.email, employee.password)
    const reportId = await app.fileReport({ title, type: 'Facilities', location: 'Staff kitchen' })
    await app.signOut()

    // The admin assigns the engineer from the Open cases table.
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.visit('/team/open-cases')
    await app.pressNear(`//tr//a[normalize-space(.)='${title}']`, 'Assign')
    await app.heading('Assign engineer(s)')
    await app.pick('Engineers', engineer.email)
    await app.press('Save assignment')
    await app.alert('Assignment saved')
    await app.signOut()

    await app.signIn(employee.email, employee.password)
    await app.openReport(reportId, title)
    await app.status('Assigned')
    await app.press('Request to close')
    await app.press('Send close request')
    await app.alert('Close request sent to your Faculty Admin')
    await app.text('You asked to close this report.')
    await app.signOut()

    await app.signIn(ADMIN.email, ADMIN.password)
    await app.openReport(reportId, title)
    await app.text('The reporter asked to close this report.')
    await app.press('Confirm close')
    await app.alert('Report archived')
    await app.status('Archived')
    await app.signOut()
  })

  it('leaves the report open when the admin declines, and the author can ask again', async () => {
    const { app } = session
    const title = `Flickering corridor light ${RUN_ID}`

    await app.signIn(employee.email, employee.password)
    const reportId = await app.fileReport({ title, location: 'Corridor B' })
    await app.signOut()

    // This time from the report page.
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.openReport(reportId, title)
    await app.press('Assign engineer(s)')
    await app.pick('Engineers', engineer.email)
    await app.press('Save assignment')
    await app.status('Assigned')
    await app.signOut()

    await app.signIn(employee.email, employee.password)
    await app.openReport(reportId, title)
    await app.press('Request to close')
    await app.press('Send close request')
    await app.text('You asked to close this report.')
    await app.signOut()

    await app.signIn(ADMIN.email, ADMIN.password)
    await app.openReport(reportId, title)
    await app.press('Decline')
    await app.alert('Close request declined')
    await app.status('Assigned')
    await app.signOut()

    await app.signIn(employee.email, employee.password)
    await app.openReport(reportId, title)
    await app.status('Assigned')
    await app.button('Request to close')
  })
})
