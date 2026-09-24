import { screen } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as reportsService from '../../services/reportsService'
import { renderApp } from '../../test/renderApp'

function myReportTitles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
}

afterEach(() => jest.restoreAllMocks())

describe('EmployeeDashboard', () => {
  it('greets the employee by first name and offers the two entry points', async () => {
    renderApp({ route: '/dashboard', as: 'alice@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Welcome, Alice' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create Incident Report/ })).toHaveAttribute('href', '/reports/new')
    expect(screen.getByRole('button', { name: /Previous report statuses/ })).toBeInTheDocument()
  })

  it('lists only the reports the employee filed, newest first, archived included', async () => {
    renderApp({ route: '/dashboard', as: 'alice@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Broken chair in Room 110' })).toBeInTheDocument()
    expect(myReportTitles()).toEqual([
      'Water leak under sink in 3rd floor kitchenette',
      'Projector in Room 204 not powering on',
      'Wi-Fi drops every few minutes in lecture hall',
      'Broken chair in Room 110',
      'Printer jams on every duplex job',
    ])
    expect(screen.queryByText('Emergency exit sign flickering')).not.toBeInTheDocument()
  })

  it('shows each report with its current status', async () => {
    renderApp({ route: '/dashboard', as: 'eric@acme.com' })

    expect(await screen.findByRole('heading', { name: 'Welcome, Eric' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Emergency exit sign flickering' })).toBeInTheDocument()
    expect(myReportTitles()).toHaveLength(3)
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('scrolls to "My reports" from the Previous report statuses card', async () => {
    const scroll = jest.spyOn(Element.prototype, 'scrollIntoView')
    const { user } = renderApp({ route: '/dashboard', as: 'alice@acme.com' })

    await user.click(await screen.findByRole('button', { name: /Previous report statuses/ }))

    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(scroll.mock.contexts[0]).toHaveAccessibleName('My reports')
  })

  it('opens a report from its card', async () => {
    const { user } = renderApp({ route: '/dashboard', as: 'alice@acme.com' })

    await user.click(await screen.findByRole('heading', { name: 'Broken chair in Room 110' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Broken chair in Room 110' })).toBeInTheDocument()
  })

  it('invites the employee to file a first report when they have none', async () => {
    jest.spyOn(reportsService, 'listReports').mockResolvedValue([])
    renderApp({ route: '/dashboard', as: 'alice@acme.com' })

    expect(await screen.findByText('You have not filed any reports yet')).toBeInTheDocument()
    expect(screen.getByText('Your reports and their statuses will show up here.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Incident Report' })).toHaveAttribute('href', '/reports/new')
  })

  it('shows a load error and recovers on Retry', async () => {
    jest.spyOn(reportsService, 'listReports').mockRejectedValueOnce(new ApiError(500, 'Boom'))
    const { user } = renderApp({ route: '/dashboard', as: 'alice@acme.com' })

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { name: 'Broken chair in Room 110' })).toBeInTheDocument()
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })
})
