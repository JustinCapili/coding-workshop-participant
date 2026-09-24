/**
 * The main path through the product, with every role taking its turn in one browser:
 * a faculty admin creates an engineer, an employee files a report, the engineer asks to work it,
 * the admin approves, the engineer works it and submits it, the admin approves and archives it,
 * and the employee sees the outcome, including the engineer's comment.
 *
 * The tests run in order and each picks up where the last left off.
 */
import { useBrowser } from './support/browser'
import { ADMIN, RUN_ID, emailFor } from './support/config'

describe('a report from filing to archive', () => {
  const session = useBrowser()
  const engineer = {
    email: emailFor('casey'),
    password: 'casey-temp-password',
    employeeId: `E2E-${RUN_ID}-ENG`.toUpperCase(),
  }
  const employee = { email: emailFor('sam'), password: 'sam-password' }
  const title = `Projector flickering in 204 ${RUN_ID}`
  const comment = `Swapped the HDMI cable (${RUN_ID})`
  let reportId

  it('lets the faculty admin create an engineer on their team', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.press('Create Engineer')
    await app.heading('Create Engineer')

    await app.fill('Employee email', engineer.email)
    await app.fill('Employee ID', engineer.employeeId)
    await app.fill('Temporary password', engineer.password)
    await app.press('Create engineer')

    await app.alert(`(${engineer.email}) created as an engineer on your team`)
    await app.signOut()
  })

  it('lets a newly registered employee file a report, which starts unassigned', async () => {
    const { app } = session
    await app.register(employee.email, employee.password)
    reportId = await app.fileReport({
      title,
      type: 'Facilities',
      location: 'Room 204',
      description: 'The ceiling projector flickers every few seconds.',
    })

    await app.status('Unassigned')
    await app.text('Nobody assigned yet')
    await app.signOut()
  })

  it('lets the engineer find the report and ask to work it', async () => {
    const { app } = session
    await app.signIn(engineer.email, engineer.password)
    await app.heading('Welcome, Casey')
    await app.openReport(reportId, title)

    await app.press('Request assignment')

    await app.alert('Request sent to your Faculty Admin')
    await app.button('Assignment requested')
    await app.signOut()
  })

  it('lets the faculty admin approve the request from Current Open Cases', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.press('Current Open Cases')
    await app.heading('Current Open Cases')

    await app.pressNear(`//a[normalize-space(.)='${reportId}']`, 'Approve')

    await app.alert(`assigned to ${reportId}`)
    await app.signOut()
  })

  it('lets the engineer start work, comment, and submit it for review', async () => {
    const { app } = session
    await app.signIn(engineer.email, engineer.password)
    await app.openReport(reportId, title)
    await app.status('Assigned')

    await app.press('Start work')
    await app.status('In progress')

    await app.fill('Add a comment', comment)
    await app.press('Comment')
    await app.text(comment)

    await app.press('Submit for review')
    await app.status('Submitted')
    await app.signOut()
  })

  it('lets the faculty admin approve the work and archive the report', async () => {
    const { app } = session
    await app.signIn(ADMIN.email, ADMIN.password)
    await app.openReport(reportId, title)
    await app.status('Submitted')

    await app.press('Approve')
    await app.status('Approved')

    await app.press('Archive')
    await app.status('Archived')
    await app.signOut()
  })

  it('shows the employee their report archived, with the whole history', async () => {
    const { app } = session
    await app.signIn(employee.email, employee.password)
    await app.openReport(reportId, title)

    await app.status('Archived')
    await app.text(comment)
    expect(await (await app.field('Add a comment')).isEnabled()).toBe(false)
  })
})
