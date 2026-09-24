import { screen, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { fileExtraReports } from '../../test/mockReports'
import { renderApp } from '../../test/renderApp'

const LEAK = 'Water leak under sink in 3rd floor kitchenette'

async function card(title) {
  return within((await screen.findByRole('heading', { name: title })).closest('.MuiCard-root'))
}

function cardTitles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
}

afterEach(() => jest.restoreAllMocks())

describe('EngineerDashboard', () => {
  it('greets the engineer and links to create and previous reports', async () => {
    renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Welcome, Bob' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create Incident Report/ })).toHaveAttribute('href', '/reports/new')
    expect(screen.getByRole('link', { name: /^Previous Reports Browse/ })).toHaveAttribute('href', '/reports/previous')
  })

  it("shows the team's open incidents with their reporters", async () => {
    renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
    expect(cardTitles()).toEqual([
      'Broken chair in Room 110',
      'Wi-Fi drops every few minutes in lecture hall',
      'Projector in Room 204 not powering on',
      LEAK,
    ])
    expect((await card(LEAK)).getByText(/· Alice Nguyen ·/)).toBeInTheDocument()
  })

  it('shows another team only its own incidents', async () => {
    renderApp({ route: '/dashboard', as: 'dave@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Current incidents 2 reports' })).toBeInTheDocument()
    expect(cardTitles()).toEqual(['Emergency exit sign flickering', 'Card reader not accepting staff badges'])
  })

  it('offers "Request assignment" only on unassigned incidents', async () => {
    renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    const leak = await card(LEAK)
    expect(leak.getByRole('button', { name: 'Request assignment' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /Request assignment|Requested/ })).toHaveLength(1)
  })

  it('sends an assignment request and then shows it as requested', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    await user.click((await card(LEAK)).getByRole('button', { name: 'Request assignment' }))

    expect(await screen.findByText('Request sent to your Faculty Admin for approval')).toBeInTheDocument()
    expect(await (await card(LEAK)).findByRole('button', { name: 'Requested' })).toBeDisabled()
  })

  it('shows a request the engineer already made as "Requested"', async () => {
    renderApp({ route: '/dashboard', as: 'carol@acme.com' })

    expect(await (await card(LEAK)).findByRole('button', { name: 'Requested' })).toBeDisabled()
  })

  it('reports a failed request in the snackbar', async () => {
    jest.spyOn(reportsService, 'requestAssignment').mockRejectedValue(new ApiError(409, 'Only unassigned reports can be requested'))
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    const leak = await card(LEAK)
    await user.click(leak.getByRole('button', { name: 'Request assignment' }))

    expect(await screen.findByText('Only unassigned reports can be requested')).toBeInTheDocument()
    expect(leak.getByRole('button', { name: 'Request assignment' })).toBeEnabled()
  })

  it('filters the board by location and status, and Clear brings everything back', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })
    await screen.findByRole('heading', { name: 'Current incidents 4 reports' })

    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'Room')
    expect(await screen.findByRole('heading', { name: 'Current incidents 2 reports' })).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: /status/i }))
    await user.click(screen.getByRole('option', { name: 'Approved' }))
    expect(await screen.findByRole('heading', { name: 'Current incidents 1 report' })).toBeInTheDocument()
    expect(cardTitles()).toEqual(['Broken chair in Room 110'])

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
  })

  it('shows an empty state when a filter matches nothing', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })
    await screen.findByRole('heading', { name: 'Current incidents 4 reports' })

    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'Building Z')

    expect(await screen.findByText('No open incidents match')).toBeInTheDocument()
    expect(screen.getByText('Try clearing a filter.')).toBeInTheDocument()
  })

  it('shows a load error and recovers on Retry', async () => {
    jest.spyOn(reportsService, 'listReports').mockRejectedValueOnce(new ApiError(500, 'Boom'))
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
  })
})

describe('EngineerDashboard: six incidents at a time', () => {
  it('shows the oldest six, loads six more at a time, and starts over when a filter changes', async () => {
    // Bob's four open incidents plus nine newer ones in the Annex: 13 in all.
    const extra = fileExtraReports(9, { location: 'Annex' })
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Current incidents 13 reports' })).toBeInTheDocument()
    expect(cardTitles()).toEqual([
      'Broken chair in Room 110',
      'Wi-Fi drops every few minutes in lecture hall',
      'Projector in Room 204 not powering on',
      LEAK,
      extra[0],
      extra[1],
    ])
    expect(screen.getByText('Showing 6 of 13')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(cardTitles()).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(cardTitles()).toHaveLength(13)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'annex')
    expect(await screen.findByRole('heading', { name: 'Current incidents 9 reports' })).toBeInTheDocument()
    expect(cardTitles()).toEqual(extra.slice(0, 6))
    expect(screen.getByText('Showing 6 of 9')).toBeInTheDocument()
  })
})

describe('EngineerDashboard: incidents assigned to the engineer', () => {
  /** The "Assigned to you" tile, as the card around its label. */
  async function assignedTile() {
    return within((await screen.findByText('Assigned to you')).closest('.MuiCard-root'))
  }

  it('counts the incidents assigned to them that are assigned or in progress', async () => {
    // Bob is on RPT-1001 (in progress) and RPT-1005 (approved, so done).
    renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    const tile = await assignedTile()
    expect(await tile.findByText('1')).toBeInTheDocument()
    expect(tile.getByText('Assigned or in progress')).toBeInTheDocument()
  })

  it('mentions work they submitted that is still awaiting review', async () => {
    // Carol is on RPT-1004 (submitted) and RPT-1007 (archived).
    renderApp({ route: '/dashboard', as: 'carol@acme.com' })

    const tile = await assignedTile()
    expect(await tile.findByText('0')).toBeInTheDocument()
    expect(tile.getByText('Assigned or in progress · 1 more awaiting review')).toBeInTheDocument()
  })

  it('shows a dash and a Retry when the count cannot be loaded, and recovers', async () => {
    const listReports = reportsService.listReports
    // Only the tile's call, which unlike the board's passes no location filter.
    jest
      .spyOn(reportsService, 'listReports')
      .mockImplementation((args) => ('location' in args ? listReports(args) : Promise.reject(new ApiError(500, 'Count failed'))))
    const { user } = renderApp({ route: '/dashboard', as: 'bob@acme.com' })

    expect(await screen.findByText('Count failed')).toBeInTheDocument()
    expect((await assignedTile()).getByText('—')).toBeInTheDocument()

    reportsService.listReports.mockRestore()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await (await assignedTile()).findByText('1')).toBeInTheDocument()
    expect(screen.queryByText('Count failed')).not.toBeInTheDocument()
  })
})
