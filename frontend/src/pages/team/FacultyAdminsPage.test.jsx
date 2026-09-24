import { screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as employeesService from '../../services/employeesService'
import { getDb } from '../../services/mock/mockStore'
import { renderApp } from '../../test/renderApp'

const candidates = () => screen.getByRole('heading', { level: 2, name: /^Employees and engineers/ }).parentElement
const admins = () => screen.getByRole('heading', { level: 2, name: /^Faculty admins/ }).parentElement
const dialog = () => screen.getByRole('dialog')

async function renderPage() {
  const result = renderApp({ route: '/team/admins', as: 'admin@acme.inc' })
  await screen.findByRole('heading', { level: 1, name: 'Faculty Admins' })
  await within(candidates()).findByText('Bob Martinez')
  return result
}

afterEach(() => jest.restoreAllMocks())

describe('FacultyAdminsPage (mock mode)', () => {
  it('lists the employees and engineers who can be promoted, and the current faculty admins', async () => {
    await renderPage()

    expect(screen.getByText('Make an employee or engineer a faculty admin. Only admin@acme.inc can do this.')).toBeInTheDocument()
    for (const name of ['Alice Nguyen', 'Eric Okafor', 'Bob Martinez', 'Carol Singh', 'Dave Kowalski']) {
      expect(within(candidates()).getByText(name)).toBeInTheDocument()
    }
    expect(within(candidates()).getByText('bob@acme.com · ENG-001')).toBeInTheDocument()
    expect(await within(admins()).findByText('Frank Delgado')).toBeInTheDocument()
    expect(within(admins()).getByText('Grace Chen')).toBeInTheDocument()
    expect(within(candidates()).queryByText('Frank Delgado')).not.toBeInTheDocument()
  })

  it('promotes an engineer after a confirmation that says they leave their team', async () => {
    const { user } = await renderPage()

    await user.click(screen.getByRole('button', { name: 'Make Bob Martinez a faculty admin' }))
    expect(within(dialog()).getByText('Make faculty admin?')).toBeInTheDocument()
    expect(within(dialog()).getByText(/Bob Martinez \(bob@acme.com\) becomes a faculty admin/)).toHaveTextContent(
      'They keep their account and password and leave the team they are on.',
    )

    await user.click(within(dialog()).getByRole('button', { name: 'Make Faculty Admin' }))

    expect(await screen.findByText('bob@acme.com is now a faculty admin')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(admins()).findByText('Bob Martinez')).toBeInTheDocument()
    await waitFor(() => expect(within(candidates()).queryByText('Bob Martinez')).not.toBeInTheDocument())
    expect(getDb().employees.find((e) => e.employeeId === 'ENG-001')).toMatchObject({
      role: 'FACULTY_ADMIN',
      email: 'bob@acme.com',
    })
  })

  it('promotes a plain employee, without mentioning a team', async () => {
    const { user } = await renderPage()

    await user.click(screen.getByRole('button', { name: 'Make Alice Nguyen a faculty admin' }))
    expect(within(dialog()).getByText(/becomes a faculty admin/)).not.toHaveTextContent('leave the team')
    await user.click(within(dialog()).getByRole('button', { name: 'Make Faculty Admin' }))

    // The page is hidden from queries until the dialog has finished closing.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(admins()).findByText('Alice Nguyen')).toBeInTheDocument()
  })

  it('changes nothing when the confirmation is cancelled', async () => {
    const promote = jest.spyOn(employeesService, 'promoteToFacultyAdmin')
    const { user } = await renderPage()

    await user.click(screen.getByRole('button', { name: 'Make Carol Singh a faculty admin' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(promote).not.toHaveBeenCalled()
    expect(within(candidates()).getByText('Carol Singh')).toBeInTheDocument()
  })

  it('shows a refusal in the dialog and keeps it open', async () => {
    jest
      .spyOn(employeesService, 'promoteToFacultyAdmin')
      .mockRejectedValue(new ApiError(409, 'ENG-002 is already a faculty admin'))
    const { user } = await renderPage()

    await user.click(screen.getByRole('button', { name: 'Make Carol Singh a faculty admin' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Make Faculty Admin' }))

    expect(await within(dialog()).findByText('ENG-002 is already a faculty admin')).toBeInTheDocument()
  })

  it('filters by name, email or ID', async () => {
    const { user } = await renderPage()
    const filter = screen.getByLabelText('Filter by name, email or ID')

    await user.type(filter, 'eng-00')
    expect(within(candidates()).queryByText('Alice Nguyen')).not.toBeInTheDocument()
    expect(within(candidates()).getByText('Dave Kowalski')).toBeInTheDocument()

    await user.clear(filter)
    await user.type(filter, 'nobody at all')
    expect(within(candidates()).getByText('Nobody matches')).toBeInTheDocument()
  })

  it('is refused to every other faculty admin', async () => {
    renderApp({ route: '/team/admins', as: 'frank@acme.com' })

    expect(await screen.findByText('You do not have permission to view this page.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Faculty Admins' })).not.toBeInTheDocument()
  })
})
