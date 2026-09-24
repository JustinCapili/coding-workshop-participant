import { screen, waitFor, within } from '@testing-library/react'
import * as employeesService from '../../services/employeesService'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import FacultyAdminsPage from './FacultyAdminsPage'

jest.mock('../../services/config', () => ({ USE_MOCKS: false }))

const admin = seededUser('admin@acme.inc')
const sam = { employeeId: 'EMP-37FB73AFBC', email: 'sam@acme.inc', name: 'Sam', role: 'EMPLOYEE', scope: 'TEAM' }

beforeEach(() => {
  jest.spyOn(employeesService, 'listEmployees').mockResolvedValue([sam])
  jest.spyOn(employeesService, 'listEngineers').mockResolvedValue([seededUser('bob@acme.com')])
  jest.spyOn(employeesService, 'listFacultyAdmins').mockResolvedValue([seededUser('frank@acme.com')])
  jest.spyOn(employeesService, 'promoteToFacultyAdmin').mockResolvedValue({ ...sam, role: 'FACULTY_ADMIN' })
})

afterEach(() => jest.restoreAllMocks())

describe('FacultyAdminsPage against the real backend', () => {
  it('lists every engineer, not one team, next to the plain employees', async () => {
    renderWithProviders(<FacultyAdminsPage />, { auth: { user: admin } })

    expect(await screen.findByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('Bob Martinez')).toBeInTheDocument()
    expect(employeesService.listEngineers).toHaveBeenCalledWith()
  })

  it('promotes by id as the signed-in admin, then says so and reloads both lists', async () => {
    const notify = jest.fn()
    const { user } = renderWithProviders(<FacultyAdminsPage />, { auth: { user: admin }, notify })
    await screen.findByText('Sam')

    await user.click(screen.getByRole('button', { name: 'Make Sam a faculty admin' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Make Faculty Admin' }))

    expect(employeesService.promoteToFacultyAdmin).toHaveBeenCalledWith({ employeeId: 'EMP-37FB73AFBC', viewer: admin })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('sam@acme.inc is now a faculty admin'))
    await waitFor(() => expect(employeesService.listEmployees).toHaveBeenCalledTimes(2))
    expect(employeesService.listFacultyAdmins).toHaveBeenCalledTimes(2)
  })
})
