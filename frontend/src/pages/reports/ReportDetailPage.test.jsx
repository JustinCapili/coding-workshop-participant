import { screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import { requestClose } from '../../services/mock/reportsMock'
import { getDb } from '../../services/mock/mockStore'
import * as reportsService from '../../services/reportsService'
import { renderApp, seededUser } from '../../test/renderApp'

/** Opens `/reports/:reportId` as `email` and waits for the report title. */
async function openReport(reportId, email) {
  const result = renderApp({ route: `/reports/${reportId}`, as: email })
  await screen.findByRole('heading', { level: 1 })
  return result
}

/** The details card on the right, which holds the assignees and the action buttons. */
function sidebar() {
  return within(screen.getByText('Assignee(s)').closest('.MuiCardContent-root'))
}

function statusChip() {
  // The status chip sits next to the priority chip, above the title.
  return screen.getByText(/priority$/).closest('.MuiStack-root').querySelector('.MuiChip-root')
}

function alertWith(text) {
  return within(screen.getByText(text, { exact: false }).closest('[role="alert"]'))
}

afterEach(() => jest.restoreAllMocks())

describe('ReportDetailPage', () => {
  describe('details', () => {
    it('shows the report, its people and its activity', async () => {
      await openReport('RPT-1001', 'alice@acme.com')

      expect(screen.getByRole('heading', { level: 1, name: 'Projector in Room 204 not powering on' })).toBeInTheDocument()
      expect(statusChip()).toHaveTextContent('In progress')
      expect(screen.getByText('Medium priority')).toBeInTheDocument()
      expect(screen.getByText('RPT-1001 · IT')).toBeInTheDocument()
      expect(screen.getByText(/The ceiling projector shows no power light/)).toBeInTheDocument()
      expect(sidebar().getByText('Bob Martinez')).toBeInTheDocument()
      expect(sidebar().getByText('Building A, Room 204')).toBeInTheDocument()
      expect(sidebar().getByText('Alice Nguyen · alice@acme.com')).toBeInTheDocument()

      const thread = within(screen.getByRole('region', { name: 'Activity' }))
      expect(thread.getByText('It was working yesterday afternoon.')).toBeInTheDocument()
      expect(thread.getByText('Power supply looks dead. Ordering a replacement lamp module.')).toBeInTheDocument()
      expect(thread.getByText('ASSIGNED → IN_PROGRESS')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
    })

    it('gives the author only "Request to close" and no status buttons', async () => {
      await openReport('RPT-1001', 'alice@acme.com')

      expect(sidebar().getAllByRole('button').map((b) => b.textContent)).toEqual(['Request to close'])
    })

    it('says so when a report has no description, and leaves out a missing incident type', async () => {
      const report = getDb().reports.find((r) => r.reportId === 'RPT-1002')
      report.body = ''
      delete report.incidentType
      await openReport('RPT-1002', 'alice@acme.com')

      expect(screen.getByText('No description provided.')).toBeInTheDocument()
      expect(screen.getByText('RPT-1002')).toBeInTheDocument()
      expect(sidebar().getByText('Nobody assigned yet')).toBeInTheDocument()
    })

    it('says a report that does not exist was not found, without offering Retry', async () => {
      renderApp({ route: '/reports/RPT-9999', as: 'alice@acme.com' })

      expect(await screen.findByText('Report RPT-9999 not found')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    })

    it("refuses an employee another person's report, without offering Retry", async () => {
      renderApp({ route: '/reports/RPT-1003', as: 'alice@acme.com' })

      expect(await screen.findByText('You do not have access to this report')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    })

    it('offers Retry on any other load error', async () => {
      jest.spyOn(reportsService, 'getReport').mockRejectedValueOnce(new ApiError(500, 'Boom'))
      const { user } = renderApp({ route: '/reports/RPT-1001', as: 'alice@acme.com' })

      expect(await screen.findByText('Boom')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Retry' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Projector in Room 204 not powering on' })).toBeInTheDocument()
    })
  })

  describe('engineer requesting assignment', () => {
    it('sends the request and then shows it as requested', async () => {
      const { user } = await openReport('RPT-1002', 'bob@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Request assignment' }))

      expect(await screen.findByText('Request sent to your Faculty Admin')).toBeInTheDocument()
      expect(await sidebar().findByRole('button', { name: 'Assignment requested' })).toBeDisabled()
      // Carol's seeded request, then Bob's.
      expect(screen.getAllByText(/requested assignment/)).toHaveLength(2)
    })

    it('shows a request the engineer already made as requested', async () => {
      await openReport('RPT-1002', 'carol@acme.com')

      expect(sidebar().getByRole('button', { name: 'Assignment requested' })).toBeDisabled()
    })

    it('reports a failed request in the snackbar', async () => {
      jest.spyOn(reportsService, 'requestAssignment').mockRejectedValue(new ApiError(409, 'Only unassigned reports can be requested'))
      const { user } = await openReport('RPT-1002', 'bob@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Request assignment' }))

      expect(await screen.findByText('Only unassigned reports can be requested')).toBeInTheDocument()
      expect(sidebar().getByRole('button', { name: 'Request assignment' })).toBeEnabled()
    })

    it('is not offered once the report is assigned', async () => {
      await openReport('RPT-1001', 'carol@acme.com')

      expect(screen.queryByRole('button', { name: 'Request assignment' })).not.toBeInTheDocument()
    })
  })

  describe('faculty admin handling an assignment request', () => {
    it('lists the pending request with Approve and Decline', async () => {
      await openReport('RPT-1002', 'frank@acme.com')

      const request = alertWith('requested to work this incident')
      expect(request.getByText('Carol Singh')).toBeInTheDocument()
      expect(request.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
      expect(request.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
    })

    it('approves it, assigning the engineer', async () => {
      const { user } = await openReport('RPT-1002', 'frank@acme.com')

      await user.click(alertWith('requested to work this incident').getByRole('button', { name: 'Approve' }))

      expect(await screen.findByText('Carol Singh assigned')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('Assigned'))
      expect(sidebar().getByText('Carol Singh')).toBeInTheDocument()
      expect(screen.queryByText('requested to work this incident', { exact: false })).not.toBeInTheDocument()
    })

    it('declines it, leaving the report unassigned', async () => {
      const { user } = await openReport('RPT-1002', 'frank@acme.com')

      await user.click(alertWith('requested to work this incident').getByRole('button', { name: 'Decline' }))

      expect(await screen.findByText('Request declined')).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.queryByText('requested to work this incident', { exact: false })).not.toBeInTheDocument(),
      )
      expect(statusChip()).toHaveTextContent('Unassigned')
    })

    it('is not shown to the engineer who asked', async () => {
      await openReport('RPT-1002', 'carol@acme.com')

      expect(screen.queryByText('requested to work this incident', { exact: false })).not.toBeInTheDocument()
    })
  })

  describe('faculty admin assigning', () => {
    it('takes the case directly', async () => {
      const { user } = await openReport('RPT-1002', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Take this case' }))

      expect(await screen.findByText('You are now on this case')).toBeInTheDocument()
      expect(await sidebar().findByText('Frank Delgado')).toBeInTheDocument()
      expect(sidebar().queryByRole('button', { name: 'Take this case' })).not.toBeInTheDocument()
      expect(sidebar().getByRole('button', { name: 'Reassign engineer(s)' })).toBeInTheDocument()
    })

    it('joins whoever is already on the case', async () => {
      const { user } = await openReport('RPT-1001', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Take this case' }))

      expect(await sidebar().findByText('Frank Delgado')).toBeInTheDocument()
      expect(sidebar().getByText('Bob Martinez')).toBeInTheDocument()
    })

    it('reports a failed take in the snackbar', async () => {
      jest.spyOn(reportsService, 'assignEngineers').mockRejectedValue(new ApiError(500, 'Take failed'))
      const { user } = await openReport('RPT-1002', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Take this case' }))

      expect(await screen.findByText('Take failed')).toBeInTheDocument()
    })

    it('assigns an engineer through the dialog', async () => {
      const { user } = await openReport('RPT-1002', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Assign engineer(s)' }))
      const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
      expect(within(dialog).getByText('Requested by: Carol Singh')).toBeInTheDocument()
      await user.click(await within(dialog).findByRole('combobox', { name: 'Engineers' }))
      await user.click(await screen.findByRole('option', { name: 'Bob Martinez (bob@acme.com)' }))
      await user.click(within(dialog).getByRole('button', { name: 'Save assignment' }))

      expect(await screen.findByText('Assignment saved')).toBeInTheDocument()
      expect(await sidebar().findByText('Bob Martinez')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('Assigned'))
    })

    it('reassigns the case to a different engineer', async () => {
      const { user } = await openReport('RPT-1001', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Reassign engineer(s)' }))
      const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
      const bobChip = (await within(dialog).findByText('Bob Martinez')).closest('.MuiChip-root')
      await user.click(within(bobChip).getByTestId('CancelIcon'))
      await user.click(within(dialog).getByRole('combobox', { name: 'Engineers' }))
      await user.click(await screen.findByRole('option', { name: 'Carol Singh (carol@acme.com)' }))
      await user.click(within(dialog).getByRole('button', { name: 'Save assignment' }))

      expect(await screen.findByText('Assignment saved')).toBeInTheDocument()
      expect(await sidebar().findByText('Carol Singh')).toBeInTheDocument()
      expect(sidebar().queryByText('Bob Martinez')).not.toBeInTheDocument()
    })

    it('closes the dialog on Cancel', async () => {
      const { user } = await openReport('RPT-1001', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Reassign engineer(s)' }))
      const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(dialog).not.toBeInTheDocument())
    })

    it('offers no assignment actions on an archived report', async () => {
      await openReport('RPT-1007', 'frank@acme.com')

      expect(sidebar().queryAllByRole('button')).toHaveLength(0)
    })
  })

  describe('status transitions', () => {
    it('lets the assignee start work', async () => {
      const { user } = await openReport('RPT-1003', 'dave@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Start work' }))

      expect(await screen.findByText('Status changed to IN_PROGRESS')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('In progress'))
      expect(sidebar().getByRole('button', { name: 'Submit for review' })).toBeInTheDocument()
    })

    it('lets the assignee submit for review', async () => {
      const { user } = await openReport('RPT-1001', 'bob@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Submit for review' }))

      expect(await screen.findByText('Status changed to SUBMITTED')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('Submitted'))
      expect(sidebar().queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument()
    })

    it('lets a faculty admin approve a submitted report', async () => {
      const { user } = await openReport('RPT-1004', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Approve' }))

      expect(await screen.findByText('Status changed to APPROVED')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('Approved'))
      expect(sidebar().getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    })

    it('lets a faculty admin send a submitted report back', async () => {
      const { user } = await openReport('RPT-1004', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Send back' }))

      expect(await screen.findByText('Status changed to IN_PROGRESS')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('In progress'))
    })

    it('lets a faculty admin archive an approved report, which closes the thread', async () => {
      const { user } = await openReport('RPT-1005', 'frank@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Archive' }))

      expect(await screen.findByText('Status changed to ARCHIVED')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('Archived'))
      expect(screen.getByRole('textbox', { name: 'Add a comment' })).toBeDisabled()
    })

    it('reports a rejected transition in the snackbar', async () => {
      jest.spyOn(reportsService, 'transitionReport').mockRejectedValue(
        new ApiError(409, 'Cannot move report from ASSIGNED to IN_PROGRESS'),
      )
      const { user } = await openReport('RPT-1003', 'dave@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Start work' }))

      expect(await screen.findByText('Cannot move report from ASSIGNED to IN_PROGRESS')).toBeInTheDocument()
      expect(statusChip()).toHaveTextContent('Assigned')
    })
  })

  describe('author requesting a close', () => {
    it('asks for confirmation, then sends the request', async () => {
      const { user } = await openReport('RPT-1001', 'alice@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Request to close' }))
      const dialog = await screen.findByRole('dialog', { name: 'Request to close this report?' })
      expect(within(dialog).getByText(/will not archive the report immediately/)).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Send close request' }))

      expect(await screen.findByText('Close request sent to your Faculty Admin for confirmation')).toBeInTheDocument()
      await waitFor(() => expect(dialog).not.toBeInTheDocument())
      expect(
        await screen.findByText('You asked to close this report. A Faculty Admin needs to confirm before it is archived.'),
      ).toBeInTheDocument()
      expect(sidebar().queryByRole('button', { name: 'Request to close' })).not.toBeInTheDocument()
    })

    it('does nothing when the author cancels', async () => {
      const spy = jest.spyOn(reportsService, 'requestClose')
      const { user } = await openReport('RPT-1001', 'alice@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Request to close' }))
      const dialog = await screen.findByRole('dialog', { name: 'Request to close this report?' })
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(dialog).not.toBeInTheDocument())
      expect(spy).not.toHaveBeenCalled()
    })

    it('shows a failed request in the dialog and clears it on Cancel', async () => {
      jest.spyOn(reportsService, 'requestClose').mockRejectedValue(new ApiError(409, 'A close request is already awaiting confirmation'))
      const { user } = await openReport('RPT-1001', 'alice@acme.com')

      await user.click(sidebar().getByRole('button', { name: 'Request to close' }))
      let dialog = await screen.findByRole('dialog', { name: 'Request to close this report?' })
      await user.click(within(dialog).getByRole('button', { name: 'Send close request' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('A close request is already awaiting confirmation')

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(dialog).not.toBeInTheDocument())
      await user.click(sidebar().getByRole('button', { name: 'Request to close' }))
      dialog = await screen.findByRole('dialog', { name: 'Request to close this report?' })
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    })

    it('tells the author their request is pending', async () => {
      await openReport('RPT-1004', 'alice@acme.com')

      expect(
        screen.getByText('You asked to close this report. A Faculty Admin needs to confirm before it is archived.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirm close' })).not.toBeInTheDocument()
      expect(sidebar().queryByRole('button', { name: 'Request to close' })).not.toBeInTheDocument()
    })
  })

  describe('faculty admin handling a close request', () => {
    it('explains that confirming will archive the report', async () => {
      await openReport('RPT-1004', 'frank@acme.com')

      expect(screen.getByText('The reporter asked to close this report. Confirming will archive it.')).toBeInTheDocument()
    })

    it('confirms the close, archiving the report', async () => {
      const { user } = await openReport('RPT-1004', 'frank@acme.com')

      await user.click(alertWith('asked to close this report').getByRole('button', { name: 'Confirm close' }))

      expect(await screen.findByText('Report archived')).toBeInTheDocument()
      await waitFor(() => expect(statusChip()).toHaveTextContent('Archived'))
      expect(screen.queryByText(/asked to close this report\./)).not.toBeInTheDocument()
      expect(screen.getByText(/confirmed close request/)).toBeInTheDocument()
    })

    it('declines the close, leaving the report as it was', async () => {
      const { user } = await openReport('RPT-1004', 'frank@acme.com')

      await user.click(alertWith('asked to close this report').getByRole('button', { name: 'Decline' }))

      expect(await screen.findByText('Close request declined')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText(/asked to close this report\./)).not.toBeInTheDocument())
      expect(statusChip()).toHaveTextContent('Submitted')
    })

    it('cannot confirm the close of an unassigned report', async () => {
      await requestClose('RPT-1002', seededUser('alice@acme.com'))
      const { user } = await openReport('RPT-1002', 'frank@acme.com')

      await user.click(alertWith('asked to close this report').getByRole('button', { name: 'Confirm close' }))

      expect(await screen.findByText('Assign an engineer before closing, or decline the request')).toBeInTheDocument()
      expect(statusChip()).toHaveTextContent('Unassigned')
    })
  })

  describe('comments', () => {
    it('adds a comment to the thread', async () => {
      const { user } = await openReport('RPT-1001', 'bob@acme.com')

      await user.type(screen.getByRole('textbox', { name: 'Add a comment' }), 'New lamp fitted, testing now.')
      await user.click(screen.getByRole('button', { name: 'Comment' }))

      const thread = within(screen.getByRole('region', { name: 'Activity' }))
      expect(await thread.findByText('New lamp fitted, testing now.')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Add a comment' })).toHaveValue('')
    })

    it('marks comments from the reporter', async () => {
      await openReport('RPT-1001', 'bob@acme.com')

      const reporterComment = screen.getByText('It was working yesterday afternoon.').closest('.MuiPaper-root')
      expect(within(reporterComment).getByText('Reporter')).toBeInTheDocument()
    })

    it('shows a failed comment in the thread', async () => {
      jest.spyOn(reportsService, 'addComment').mockRejectedValue(new ApiError(500, 'Comment not saved'))
      const { user } = await openReport('RPT-1001', 'bob@acme.com')

      await user.type(screen.getByRole('textbox', { name: 'Add a comment' }), 'Hello')
      await user.click(screen.getByRole('button', { name: 'Comment' }))

      const thread = within(screen.getByRole('region', { name: 'Activity' }))
      expect(await thread.findByRole('alert')).toHaveTextContent('Comment not saved')
    })

    it('disables commenting on an archived report', async () => {
      await openReport('RPT-1007', 'alice@acme.com')

      expect(screen.getByRole('textbox', { name: 'Add a comment' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Request to close' })).not.toBeInTheDocument()
    })
  })
})
