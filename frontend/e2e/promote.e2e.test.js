/**
 * Promoting an existing employee to engineer, all through the browser: the employee reads their
 * ID off the account menu, a faculty admin enters it on Create Engineer, and the employee signs
 * back in with the password they already had, now as an engineer who still owns their report.
 */
import { useBrowser } from './support/browser'
import { ADMIN, RUN_ID, emailFor } from './support/config'

describe('promoting an employee to engineer by ID', () => {
  const session = useBrowser()
  const quinn = { email: emailFor('quinn'), password: 'quinn-own-password' }
  const title = `Printer jammed on floor 3 ${RUN_ID}`
  let employeeId
  let reportId

  it('shows a newly registered employee their ID in the account menu', async () => {
    const { app } = session
    await app.register(quinn.email, quinn.password)
    await app.heading('Welcome, Quinn')
    reportId = await app.fileReport({ title, location: 'Floor 3' })

    await app.openAccountMenu()
    const line = await (await app.text('Employee ID ')).getText()
    employeeId = line.replace('Employee ID ', '').trim()
    expect(employeeId).toMatch(/^EMP-[0-9A-F]{10}$/)

    await app.press('Log out')
    await app.waitForPath(/^\/login$/)
  })

  it('lets a faculty admin promote them with nothing but that ID', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.press('Create Engineer')
    await app.heading('Promote an existing employee')

    await app.fill('Existing employee ID', employeeId.toLowerCase())
    await app.press('Promote to engineer')

    await app.alert(`(${quinn.email}) is now an engineer on your team`)
    await app.text(`${quinn.email} · ${employeeId}`)
    await app.signOut()
  })

  it('signs them in with their original password, as an engineer who still owns their report', async () => {
    const { app } = session
    await app.signIn(quinn.email, quinn.password)
    await app.heading('Welcome, Quinn')
    expect(await app.sidebarLinks()).toContain('Previous Reports')

    await app.openReport(reportId, title)
    await app.text(quinn.email)
    await app.button('Request assignment')
  })
})
