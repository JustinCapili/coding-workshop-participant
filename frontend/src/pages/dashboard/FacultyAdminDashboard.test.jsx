import { screen, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { renderApp } from '../../test/renderApp'

const LEAK = 'Water leak under sink in 3rd floor kitchenette'
const PROJECTOR = 'Projector in Room 204 not powering on'

async function card(title) {
  return within((await screen.findByRole('heading', { name: title })).closest('.MuiCard-root'))
}

/** The stat tile whose label is `label`. */
function tile(label) {
  return within(screen.getByText(label).closest('.MuiCardContent-root'))
}

afterEach(() => jest.restoreAllMocks())

describe('FacultyAdminDashboard', () => {
  it('shows a team faculty admin their team overview and links', async () => {
    renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Team overview' })).toBeInTheDocument()
    expect(screen.getByText('Incidents on your team and the engineers available to take them.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Current open cases' })).toHaveAttribute('href', '/team/open-cases')
    expect(screen.getByRole('link', { name: 'New report' })).toHaveAttribute('href', '/reports/new')
    expect(screen.queryByText(/Admin scope/)).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
  })

  it("shows the team's stat tiles", async () => {
    renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    // Bob is busy on RPT-1001; Carol is free.
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
    expect(tile('Available engineers').getByText('Not on an active assignment')).toBeInTheDocument()
    expect(tile('Open cases').getByText('4')).toBeInTheDocument()
    expect(tile('Open cases').getByText('1 unassigned')).toBeInTheDocument()
    expect(tile('Pending approvals').getByText('2')).toBeInTheDocument()
    // How many were filed "today" depends on the clock, so only its presence is checked.
    expect(tile('Incidents today').getByText(/^\d+$/)).toBeInTheDocument()
  })

  it('shows the organisation overview and scope notice to a global admin', async () => {
    renderApp({ route: '/dashboard', as: 'admin@acme.inc' })

    expect(await screen.findByRole('heading', { name: 'Organisation overview' })).toBeInTheDocument()
    expect(screen.getByText('Incidents and engineers across every faculty admin team.')).toBeInTheDocument()
    expect(screen.getByText(/Admin scope: showing data across/)).toHaveTextContent(
      'Admin scope: showing data across all teams, not just your own engineers.',
    )
    expect(await screen.findByRole('heading', { name: 'Current incidents (all teams) 6 reports' })).toBeInTheDocument()
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
    expect(tile('Open cases').getByText('2 unassigned')).toBeInTheDocument()
  })

  it('offers Take case and Assign on an unassigned card, and Reassign where someone is on it', async () => {
    renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    const leak = await card(LEAK)
    expect(leak.getByRole('button', { name: 'Take case' })).toBeInTheDocument()
    expect(leak.getByRole('button', { name: 'Assign engineer(s)' })).toBeInTheDocument()
    expect((await card(PROJECTOR)).getByRole('button', { name: 'Reassign' })).toBeInTheDocument()
  })

  it('takes a case from its card', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    await user.click((await card(LEAK)).getByRole('button', { name: 'Take case' }))

    expect(await screen.findByText('You are now on this case')).toBeInTheDocument()
    const leak = await card(LEAK)
    expect(await leak.findByRole('button', { name: 'Reassign' })).toBeInTheDocument()
    expect(leak.queryByRole('button', { name: 'Take case' })).not.toBeInTheDocument()
    expect(leak.getByText('Assigned')).toBeInTheDocument()
  })

  it('reports a failed take in the snackbar', async () => {
    jest.spyOn(reportsService, 'assignEngineers').mockRejectedValue(new ApiError(409, 'Archived reports cannot be assigned'))
    const { user } = renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    await user.click((await card(LEAK)).getByRole('button', { name: 'Take case' }))

    expect(await screen.findByText('Archived reports cannot be assigned')).toBeInTheDocument()
  })

  it('assigns an engineer from a card through the dialog', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    await user.click((await card(LEAK)).getByRole('button', { name: 'Assign engineer(s)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
    await user.click(await within(dialog).findByRole('combobox', { name: 'Engineers' }))
    await user.click(await screen.findByRole('option', { name: 'Bob Martinez (bob@acme.com)' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save assignment' }))

    expect(await screen.findByText('Assignment saved')).toBeInTheDocument()
    expect(await (await card(LEAK)).findByRole('button', { name: 'Reassign' })).toBeInTheDocument()
  })

  it('closes the assign dialog on Cancel', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    await user.click((await card(PROJECTOR)).getByRole('button', { name: 'Reassign' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign engineer(s)' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(dialog).not.toBeInTheDocument()
  })

  it('filters the board by location and status', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'frank@acme.com' })
    await screen.findByRole('heading', { name: 'Current incidents 4 reports' })

    await user.click(screen.getByRole('combobox', { name: /status/i }))
    await user.click(screen.getByRole('option', { name: 'Submitted' }))
    expect(await screen.findByRole('heading', { name: 'Current incidents 1 report' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'nowhere')
    expect(await screen.findByText('No open incidents match')).toBeInTheDocument()
  })

  it('shows a stats error and recovers on Retry', async () => {
    jest.spyOn(reportsService, 'getDashboardStats').mockRejectedValueOnce(new ApiError(500, 'Stats unavailable'))
    const { user } = renderApp({ route: '/dashboard', as: 'frank@acme.com' })

    expect(await screen.findByText('Stats unavailable')).toBeInTheDocument()
    expect(tile('Open cases').getByText('—')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
    expect(screen.queryByText('Stats unavailable')).not.toBeInTheDocument()
  })
})
