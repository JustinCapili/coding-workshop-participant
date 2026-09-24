import { screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import { assignEngineers, requestClose } from '../../services/mock/reportsMock'
import * as reportsService from '../../services/reportsService'
import { renderApp, seededUser } from '../../test/renderApp'

async function openPage(email) {
  const result = renderApp({ route: '/team/open-cases', as: email })
  await screen.findByRole('table', { name: 'Open cases' })
  return result
}

function section(name) {
  return within(screen.getByRole('heading', { name }).closest('.MuiCard-root'))
}

/** One request row in a queue, found by the report it is about. */
function requestRow(queue, reportId) {
  return within(section(queue).getByRole('link', { name: reportId }).closest('.MuiStack-root'))
}

function caseRow(reportId) {
  return within(within(screen.getByRole('table', { name: 'Open cases' })).getByRole('row', { name: new RegExp(reportId) }))
}

afterEach(() => jest.restoreAllMocks())

describe('OpenCasesPage', () => {
  it("shows a faculty admin's queues and open cases", async () => {
    await openPage('frank@acme.com')

    expect(screen.getByRole('heading', { name: 'Current Open Cases' })).toBeInTheDocument()
    expect(screen.getByText('Open reports on your team and the approvals waiting on you.')).toBeInTheDocument()
    expect(section('Engineer assignment requests').getByText(/wants to work this incident/)).toHaveTextContent(
      'Carol Singh wants to work this incident',
    )
    expect(section('Close requests').getByText(/asked to close this report/)).toHaveTextContent(
      'Alice Nguyen asked to close this report',
    )
    expect(screen.getByText(/Approving a close request walks the report forward/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Open cases 4' })).toBeInTheDocument()
  })

  it('lists each open case with its reporter, assignees, pending requests and an assign action', async () => {
    await openPage('frank@acme.com')

    const rows = within(screen.getByRole('table', { name: 'Open cases' })).getAllByRole('row')
    expect(rows).toHaveLength(5) // header + four cases
    expect(caseRow('RPT-1002').getByText('RPT-1002 · 1 request(s)')).toBeInTheDocument()
    expect(caseRow('RPT-1002').getByText('—')).toBeInTheDocument()
    expect(caseRow('RPT-1002').getByRole('button', { name: 'Assign' })).toBeInTheDocument()
    expect(caseRow('RPT-1004').getByText('RPT-1004 · close requested')).toBeInTheDocument()
    expect(caseRow('RPT-1004').getByText('Carol Singh')).toBeInTheDocument()
    expect(caseRow('RPT-1004').getByText('Alice Nguyen')).toBeInTheDocument()
    expect(caseRow('RPT-1004').getByRole('button', { name: 'Reassign' })).toBeInTheDocument()
    expect(caseRow('RPT-1001').getByRole('link', { name: 'Projector in Room 204 not powering on' })).toHaveAttribute(
      'href',
      '/reports/RPT-1001',
    )
  })

  it('shows a global admin every team', async () => {
    await openPage('admin@acme.inc')

    expect(screen.getByText('Open reports and pending approvals across all teams.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Open cases 6' })).toBeInTheDocument()
    expect(caseRow('RPT-1008').getByText('Eric Okafor')).toBeInTheDocument()
  })

  it('approves an assignment request', async () => {
    const { user } = await openPage('frank@acme.com')

    await user.click(requestRow('Engineer assignment requests', 'RPT-1002').getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('Carol Singh assigned to RPT-1002')).toBeInTheDocument()
    expect(await section('Engineer assignment requests').findByText('No engineers are waiting on approval.')).toBeInTheDocument()
    expect(await caseRow('RPT-1002').findByText('Carol Singh')).toBeInTheDocument()
  })

  it('declines an assignment request', async () => {
    const { user } = await openPage('frank@acme.com')

    await user.click(requestRow('Engineer assignment requests', 'RPT-1002').getByRole('button', { name: 'Decline' }))

    expect(await screen.findByText('Request declined')).toBeInTheDocument()
    expect(await section('Engineer assignment requests').findByText('No engineers are waiting on approval.')).toBeInTheDocument()
    expect(caseRow('RPT-1002').getByRole('button', { name: 'Assign' })).toBeInTheDocument()
  })

  it('disables Approve once the report is no longer unassigned', async () => {
    await assignEngineers('RPT-1002', ['ENG-001'], seededUser('frank@acme.com'))
    await openPage('frank@acme.com')

    const row = requestRow('Engineer assignment requests', 'RPT-1002')
    expect(row.getByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(row.getByRole('button', { name: 'Decline' })).toBeEnabled()
    expect(row.getByText('Assigned')).toBeInTheDocument()
  })

  it('confirms a close request, archiving the report', async () => {
    const { user } = await openPage('frank@acme.com')

    await user.click(requestRow('Close requests', 'RPT-1004').getByRole('button', { name: 'Confirm & archive' }))

    expect(await screen.findByText('RPT-1004 archived')).toBeInTheDocument()
    expect(await section('Close requests').findByText('No close requests waiting.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Open cases 3' })).toBeInTheDocument()
  })

  it('declines a close request', async () => {
    const { user } = await openPage('frank@acme.com')

    await user.click(requestRow('Close requests', 'RPT-1004').getByRole('button', { name: 'Decline' }))

    expect(await screen.findByText('Close request declined')).toBeInTheDocument()
    expect(await section('Close requests').findByText('No close requests waiting.')).toBeInTheDocument()
    await waitFor(() => expect(caseRow('RPT-1004').queryByText(/close requested/)).not.toBeInTheDocument())
  })

  it('disables Confirm & archive for a close request on an unassigned report', async () => {
    await requestClose('RPT-1002', seededUser('alice@acme.com'))
    await openPage('frank@acme.com')

    expect(requestRow('Close requests', 'RPT-1002').getByRole('button', { name: 'Confirm & archive' })).toBeDisabled()
    expect(requestRow('Close requests', 'RPT-1004').getByRole('button', { name: 'Confirm & archive' })).toBeEnabled()
  })

  it('reports a failed approval in the snackbar and keeps the request', async () => {
    jest.spyOn(reportsService, 'approveAssignmentRequest').mockRejectedValue(new ApiError(409, 'Request already resolved'))
    const { user } = await openPage('frank@acme.com')

    await user.click(requestRow('Engineer assignment requests', 'RPT-1002').getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('Request already resolved')).toBeInTheDocument()
    expect(requestRow('Engineer assignment requests', 'RPT-1002').getByRole('button', { name: 'Approve' })).toBeEnabled()
  })

  it('assigns an engineer from the table', async () => {
    const { user } = await openPage('frank@acme.com')

    await user.click(caseRow('RPT-1002').getByRole('button', { name: 'Assign' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
    await user.click(await within(dialog).findByRole('combobox', { name: 'Engineers' }))
    await user.click(await screen.findByRole('option', { name: 'Bob Martinez (bob@acme.com)' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save assignment' }))

    expect(await screen.findByText('Assignment saved')).toBeInTheDocument()
    expect(await caseRow('RPT-1002').findByRole('button', { name: 'Reassign' })).toBeInTheDocument()
    expect(caseRow('RPT-1002').getByText('Bob Martinez')).toBeInTheDocument()
  })

  it('opens Reassign with the current assignees and closes on Cancel', async () => {
    const { user } = await openPage('frank@acme.com')

    await user.click(caseRow('RPT-1001').getByRole('button', { name: 'Reassign' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
    expect(await within(dialog).findByText('Bob Martinez')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('shows empty queues for a team with nothing pending', async () => {
    await openPage('grace@acme.com')

    expect(section('Engineer assignment requests').getByText('No engineers are waiting on approval.')).toBeInTheDocument()
    expect(section('Close requests').getByText('No close requests waiting.')).toBeInTheDocument()
    expect(screen.queryByText(/Approving a close request walks the report forward/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Open cases 2' })).toBeInTheDocument()
  })

  it('shows an empty state when there are no open cases', async () => {
    jest.spyOn(reportsService, 'listReports').mockResolvedValue([])
    renderApp({ route: '/team/open-cases', as: 'frank@acme.com' })

    expect(await screen.findByText('No open cases')).toBeInTheDocument()
    expect(screen.getByText('Everything in scope is archived.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a queue load error and recovers on Retry', async () => {
    jest.spyOn(reportsService, 'listPendingRequests').mockRejectedValueOnce(new ApiError(500, 'Queue unavailable'))
    const { user } = renderApp({ route: '/team/open-cases', as: 'frank@acme.com' })

    expect(await screen.findByText('Queue unavailable')).toBeInTheDocument()
    await user.click(section('Engineer assignment requests').getByRole('button', { name: 'Retry' }))

    expect(await section('Engineer assignment requests').findByText(/wants to work this incident/)).toBeInTheDocument()
  })

  it('shows a case list load error and recovers on Retry', async () => {
    jest.spyOn(reportsService, 'listReports').mockRejectedValueOnce(new ApiError(500, 'Cases unavailable'))
    const { user } = renderApp({ route: '/team/open-cases', as: 'frank@acme.com' })

    expect(await screen.findByText('Cases unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Open cases 4' })).toBeInTheDocument()
  })
})
