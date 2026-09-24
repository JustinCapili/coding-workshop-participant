import { fireEvent, screen, waitFor } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { renderApp } from '../../test/renderApp'

const DAY = 24 * 60 * 60 * 1000
const CHAIR = 'Broken chair in Room 110' // RPT-1005, approved 2 days ago, Bob
const PRINTER = 'Printer jams on every duplex job' // RPT-1007, archived 27 days ago, Carol

/** yyyy-mm-dd for `days` ago, as an <input type="date"> holds it. */
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10)

function cardTitles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
}

async function openPage(email) {
  const result = renderApp({ route: '/reports/previous', as: email })
  await screen.findByRole('heading', { name: CHAIR })
  return result
}

async function engineerOptions(user) {
  await user.click(screen.getByRole('combobox', { name: /completed by/i }))
  return (await screen.findAllByRole('option')).map((o) => o.textContent)
}

afterEach(() => jest.restoreAllMocks())

describe('PreviousReportsPage', () => {
  it("shows an engineer the team's approved and archived reports with their reporters", async () => {
    await openPage('bob@acme.com')

    expect(screen.getByRole('heading', { name: 'Previous Reports' })).toBeInTheDocument()
    expect(cardTitles()).toEqual([CHAIR, PRINTER])
    expect(screen.getAllByText(/· Alice Nguyen ·/)).toHaveLength(2)
  })

  it('filters by the engineer who completed the report', async () => {
    const { user } = await openPage('bob@acme.com')

    expect(await engineerOptions(user)).toEqual(['Any engineer', 'Bob Martinez', 'Carol Singh'])
    await user.click(screen.getByRole('option', { name: 'Carol Singh' }))

    await waitFor(() => expect(cardTitles()).toEqual([PRINTER]))
  })

  it('filters by a from date', async () => {
    await openPage('bob@acme.com')

    fireEvent.change(screen.getByLabelText('From'), { target: { value: daysAgo(10) } })

    await waitFor(() => expect(cardTitles()).toEqual([CHAIR]))
  })

  it('filters by a to date', async () => {
    await openPage('bob@acme.com')

    fireEvent.change(screen.getByLabelText('To'), { target: { value: daysAgo(10) } })

    await waitFor(() => expect(cardTitles()).toEqual([PRINTER]))
  })

  it('shows an empty state when nothing matches, and Clear brings everything back', async () => {
    const { user } = await openPage('bob@acme.com')

    fireEvent.change(screen.getByLabelText('To'), { target: { value: daysAgo(60) } })

    expect(await screen.findByText('No completed reports match')).toBeInTheDocument()
    expect(screen.getByText('Widen the date range or pick a different engineer.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByRole('heading', { name: CHAIR })).toBeInTheDocument()
    expect(cardTitles()).toEqual([CHAIR, PRINTER])
    expect(screen.getByLabelText('To')).toHaveValue('')
  })

  it('lets a faculty admin filter for cases they completed themselves', async () => {
    const { user } = await openPage('frank@acme.com')

    expect(await engineerOptions(user)).toEqual(['Any engineer', 'Me (Frank Delgado)', 'Bob Martinez', 'Carol Singh'])
    await user.click(screen.getByRole('option', { name: 'Me (Frank Delgado)' }))

    expect(await screen.findByText('No completed reports match')).toBeInTheDocument()
  })

  it('offers a global admin every engineer', async () => {
    const { user } = await openPage('admin@acme.inc')

    expect(cardTitles()).toEqual([CHAIR, 'HVAC too cold in server room', PRINTER])
    expect(await engineerOptions(user)).toEqual([
      'Any engineer',
      'Me (Ada Whitfield)',
      'Bob Martinez',
      'Carol Singh',
      'Dave Kowalski',
    ])
  })

  it('is not available to an employee', async () => {
    renderApp({ route: '/reports/previous', as: 'alice@acme.com' })

    expect(await screen.findByText('You do not have permission to view this page.')).toBeInTheDocument()
  })

  it('shows a load error and recovers on Retry', async () => {
    jest.spyOn(reportsService, 'listReports').mockRejectedValueOnce(new ApiError(500, 'Boom'))
    const { user } = renderApp({ route: '/reports/previous', as: 'bob@acme.com' })

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: CHAIR })).toBeInTheDocument()
  })
})
