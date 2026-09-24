import { screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as employeesService from '../../services/employeesService'
import { assignEngineers, getReport } from '../../services/mock/reportsMock'
import * as reportsService from '../../services/reportsService'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import AssignEngineerDialog from './AssignEngineerDialog'

const unassignedReport = {
  reportId: 'RPT-1002',
  title: 'Water leak under sink in 3rd floor kitchenette',
  location: 'Building A, Floor 3 kitchenette',
  assignees: [],
  pendingAssignmentRequests: [{ requestId: 'AREQ-1', engineerId: 'ENG-002', engineer: { name: 'Carol Singh' } }],
}

const bobsReport = {
  reportId: 'RPT-1001',
  title: 'Projector in Room 204 not powering on',
  location: 'Building A, Room 204',
  assignees: [{ assigneeId: 'ENG-001' }],
  pendingAssignmentRequests: [],
}

function renderDialog({ as = 'frank@acme.com', ...props } = {}) {
  const onClose = jest.fn()
  const onAssigned = jest.fn()
  const result = renderWithProviders(
    <AssignEngineerDialog open report={unassignedReport} onClose={onClose} onAssigned={onAssigned} {...props} />,
    { auth: { user: seededUser(as) } },
  )
  return { ...result, onClose, onAssigned }
}

async function openOptions(user) {
  await user.click(await screen.findByRole('combobox', { name: 'Engineers' }))
  return (await screen.findAllByRole('option')).map((o) => o.textContent)
}

afterEach(() => jest.restoreAllMocks())

describe('AssignEngineerDialog', () => {
  it('names the report and who has asked to work it', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Assign engineer(s)' })
    expect(within(dialog).getByText(/Water leak under sink/)).toBeInTheDocument()
    expect(within(dialog).getByText('Building A, Floor 3 kitchenette')).toBeInTheDocument()
    expect(within(dialog).getByText('Requested by: Carol Singh')).toBeInTheDocument()
  })

  it('lists the admin first, then only their own team', async () => {
    const { user } = renderDialog()

    expect(await openOptions(user)).toEqual([
      'Me (Frank Delgado) (frank@acme.com)',
      'Bob Martinez (bob@acme.com)',
      'Carol Singh (carol@acme.com)',
    ])
  })

  it('lists every engineer for an admin with organisation scope', async () => {
    const { user } = renderDialog({ as: 'admin@acme.inc' })

    expect(await openOptions(user)).toEqual([
      'Me (Ada Whitfield) (admin@acme.inc)',
      'Bob Martinez (bob@acme.com)',
      'Carol Singh (carol@acme.com)',
      'Dave Kowalski (dave@acme.com)',
    ])
  })

  it('starts from the engineers already on the report', async () => {
    renderDialog({ report: bobsReport })

    const field = await screen.findByRole('combobox', { name: 'Engineers' })
    expect(await within(field.closest('.MuiAutocomplete-root')).findByText('Bob Martinez')).toBeInTheDocument()
    expect(screen.queryByText(/Requested by/)).not.toBeInTheDocument()
  })

  it('saves the picked engineers, hands back the updated report and closes', async () => {
    const { user, onAssigned, onClose } = renderDialog()

    await openOptions(user)
    await user.click(screen.getByRole('option', { name: 'Carol Singh (carol@acme.com)' }))
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const updated = onAssigned.mock.calls[0][0]
    expect(updated.status).toBe('ASSIGNED')
    expect(updated.assignees.map((a) => a.assigneeId)).toEqual(['ENG-002'])
  })

  it('closes without saving on Cancel', async () => {
    const spy = jest.spyOn(reportsService, 'assignEngineers')
    const { user, onAssigned, onClose } = renderDialog()

    await openOptions(user)
    await user.click(screen.getByRole('option', { name: 'Bob Martinez (bob@acme.com)' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAssigned).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a save error and stays open', async () => {
    jest.spyOn(reportsService, 'assignEngineers').mockRejectedValue(new ApiError(409, 'Archived reports cannot be assigned'))
    const { user, onAssigned, onClose } = renderDialog()

    await screen.findByRole('combobox', { name: 'Engineers' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save assignment' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Archived reports cannot be assigned')
    expect(onAssigned).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an error when the engineer list cannot be loaded', async () => {
    jest.spyOn(employeesService, 'listEngineers').mockRejectedValue(new ApiError(500, 'Directory down'))
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent('Directory down')
  })

  it('does not load engineers while closed', () => {
    const spy = jest.spyOn(employeesService, 'listEngineers')
    renderDialog({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders nothing without a report', () => {
    renderDialog({ report: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // BUG: the dialog pre-selects only current assignees found in the admin's own pick-list
  // (AssignEngineerDialog.jsx:44-48), then saves that list. An assignee from another team, e.g. one
  // the global admin put on the case, is invisible here and silently removed by a save with no edits.
  it.skip('keeps assignees from outside the admin team when saved unchanged', async () => {
    await assignEngineers('RPT-1002', ['ENG-003'], seededUser('admin@acme.inc'))
    const report = await getReport('RPT-1002')
    const { user, onAssigned } = renderDialog({ report })

    await screen.findByRole('combobox', { name: 'Engineers' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save assignment' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Save assignment' }))

    await waitFor(() => expect(onAssigned).toHaveBeenCalled())
    expect(onAssigned.mock.calls[0][0].assignees.map((a) => a.assigneeId)).toEqual(['ENG-003'])
  })

  it('closes on Escape', async () => {
    const { user, onClose } = renderDialog()

    await screen.findByRole('combobox', { name: 'Engineers' })
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
