import { screen, waitFor } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import IncidentBoard from './IncidentBoard'

const bob = seededUser('bob@acme.com')

// Bob's team (FA-001) has four open reports; RPT-1007 is archived and never shows here.
// Oldest filed first: 9 days, 4 days, 2 days and 3 hours ago.
const BOB_OPEN = [
  'Broken chair in Room 110',
  'Wi-Fi drops every few minutes in lecture hall',
  'Projector in Room 204 not powering on',
  'Water leak under sink in 3rd floor kitchenette',
]

function cardTitles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
}

afterEach(() => jest.restoreAllMocks())

describe('IncidentBoard', () => {
  it("lists the viewer's open reports, oldest filed first, with a count", async () => {
    renderWithProviders(<IncidentBoard viewer={bob} />)

    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
    expect(cardTitles()).toEqual(BOB_OPEN)
  })

  it('uses the title it is given and passes the rows to onLoaded', async () => {
    const onLoaded = jest.fn()
    renderWithProviders(<IncidentBoard viewer={bob} title="Team incidents" onLoaded={onLoaded} />)

    expect(await screen.findByRole('heading', { name: 'Team incidents 4 reports' })).toBeInTheDocument()
    expect(onLoaded).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ reportId: 'RPT-1001' })]))
  })

  it('filters by location', async () => {
    const { user } = renderWithProviders(<IncidentBoard viewer={bob} />)
    await screen.findByRole('heading', { name: /4 reports/ })

    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'room 204')

    expect(await screen.findByRole('heading', { name: 'Current incidents 1 report' })).toBeInTheDocument()
    expect(cardTitles()).toEqual(['Projector in Room 204 not powering on'])
  })

  it('filters by status, offering only open statuses, and Clear resets both filters', async () => {
    const { user } = renderWithProviders(<IncidentBoard viewer={bob} />)
    await screen.findByRole('heading', { name: /4 reports/ })

    await user.click(screen.getByRole('combobox', { name: /status/i }))
    expect(screen.queryByRole('option', { name: 'Archived' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Unassigned' }))
    expect(await screen.findByRole('heading', { name: 'Current incidents 1 report' })).toBeInTheDocument()
    expect(cardTitles()).toEqual(['Water leak under sink in 3rd floor kitchenette'])

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
  })

  it('suggests clearing a filter when nothing matches', async () => {
    const { user } = renderWithProviders(<IncidentBoard viewer={bob} />)
    await screen.findByRole('heading', { name: /4 reports/ })

    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'Mars')

    expect(await screen.findByText('No open incidents match')).toBeInTheDocument()
    expect(screen.getByText('Try clearing a filter.')).toBeInTheDocument()
  })

  it('says nothing is waiting when the viewer has no open reports at all', async () => {
    renderWithProviders(<IncidentBoard viewer={{ employeeId: 'EMP-999', role: 'EMPLOYEE' }} />)

    expect(await screen.findByText('No open incidents match')).toBeInTheDocument()
    expect(screen.getByText('Nothing is waiting on you right now.')).toBeInTheDocument()
  })

  it('renders page actions on each card and lets them reload the board', async () => {
    const renderActions = jest.fn((report, reload) => (
      <button type="button" onClick={reload}>
        Refresh {report.reportId}
      </button>
    ))
    const spy = jest.spyOn(reportsService, 'listReports')
    const { user } = renderWithProviders(<IncidentBoard viewer={bob} renderActions={renderActions} />)

    await user.click(await screen.findByRole('button', { name: 'Refresh RPT-1001' }))

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy).toHaveBeenLastCalledWith({ viewer: bob, location: '', status: undefined, openOnly: true })
  })

  it('shows a load error with Retry', async () => {
    jest.spyOn(reportsService, 'listReports').mockRejectedValueOnce(new ApiError(500, 'Boom'))
    const { user } = renderWithProviders(<IncidentBoard viewer={bob} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Current incidents 4 reports' })).toBeInTheDocument()
  })
})
