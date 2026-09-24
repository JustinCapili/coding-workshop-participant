import { screen } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as employeesService from '../../services/employeesService'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import CreateEngineerPage from './CreateEngineerPage'

jest.mock('../../services/config', () => ({ USE_MOCKS: false }))

const frank = seededUser('frank@acme.com')
const created = { employeeId: 'ENG-004', email: 'new.eng@acme.inc', name: 'New Eng', role: 'ENGINEER', facultyAdminId: 'FA-001' }

const emailField = () => screen.getByLabelText(/employee email/i)
// Anchored: the promote card's "Existing employee ID" would match too.
const idField = () => screen.getByLabelText(/^employee id/i)
const passwordField = () => screen.getByLabelText(/temporary password/i)
const createButton = () => screen.getByRole('button', { name: 'Create engineer' })

async function renderPage() {
  const refresh = jest.fn().mockResolvedValue(frank)
  const result = renderWithProviders(<CreateEngineerPage />, { auth: { user: frank, refresh } })
  await screen.findByText('Bob Martinez')
  return { ...result, refresh }
}

async function fillIn(user, { email = 'new.eng@acme.inc', employeeId = 'ENG-004', password = 'temp-pass-1' } = {}) {
  if (email) await user.type(emailField(), email)
  if (employeeId) await user.type(idField(), employeeId)
  if (password) await user.type(passwordField(), password)
}

beforeEach(() => {
  jest.spyOn(employeesService, 'listEngineers').mockResolvedValue([seededUser('bob@acme.com'), seededUser('carol@acme.com')])
  jest.spyOn(employeesService, 'createEngineer').mockResolvedValue(created)
})

afterEach(() => jest.restoreAllMocks())

describe('CreateEngineerPage against the real backend', () => {
  it("loads the admin's team and asks for an email, an employee ID and a temporary password", async () => {
    await renderPage()

    expect(employeesService.listEngineers).toHaveBeenCalledWith({ facultyAdminId: 'FA-001' })
    expect(screen.getByText(/or create a new engineer account on your team/)).toBeInTheDocument()
    expect(screen.getByText('They sign in with this email.')).toBeInTheDocument()
    expect(screen.getByText('Must be unique across all staff, e.g. ENG-004.')).toBeInTheDocument()
    expect(screen.getByText('Shown here so you can pass it on. It is stored hashed.')).toBeInTheDocument()
    // Shown as plain text so the admin can read it out.
    expect(passwordField()).toHaveAttribute('type', 'text')
  })

  it('checks all three fields before creating anything', async () => {
    const { user } = await renderPage()

    await user.click(createButton())
    expect(screen.getByText('Enter a valid employee email')).toBeInTheDocument()
    expect(screen.getByText('Employee ID is required')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()

    await fillIn(user, { employeeId: '   ', password: 'short' })
    await user.click(createButton())
    expect(screen.queryByText('Enter a valid employee email')).not.toBeInTheDocument()
    expect(screen.getByText('Employee ID is required')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(employeesService.createEngineer).not.toHaveBeenCalled()
  })

  it('asks for an @acme.inc address for the new account', async () => {
    const { user } = await renderPage()

    await fillIn(user, { email: 'new.eng@acme.com' })
    await user.click(createButton())
    expect(screen.getByText('Use your @acme.inc email address')).toBeInTheDocument()
    expect(employeesService.createEngineer).not.toHaveBeenCalled()

    await user.clear(emailField())
    await user.type(emailField(), 'new.eng@acme.inc')
    expect(screen.queryByText('Use your @acme.inc email address')).not.toBeInTheDocument()
  })

  it('still refuses a short password once the ID is filled in', async () => {
    const { user } = await renderPage()

    await fillIn(user, { password: 'short' })
    await user.click(createButton())
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(employeesService.createEngineer).not.toHaveBeenCalled()
  })

  it('creates the engineer on the admin’s team, then clears the form and reloads the list', async () => {
    const notify = jest.fn()
    const refresh = jest.fn().mockResolvedValue(frank)
    const { user } = renderWithProviders(<CreateEngineerPage />, { auth: { user: frank, refresh }, notify })
    await screen.findByText('Bob Martinez')

    await fillIn(user)
    await user.click(createButton())

    expect(await screen.findByText(/granted engineer permissions/)).toHaveTextContent(
      'New Eng (new.eng@acme.inc) granted engineer permissions.',
    )
    expect(employeesService.createEngineer).toHaveBeenCalledWith({
      email: 'new.eng@acme.inc',
      employeeId: 'ENG-004',
      password: 'temp-pass-1',
      facultyAdminId: 'FA-001',
    })
    expect(notify).toHaveBeenCalledWith('Created new.eng@acme.inc')
    expect(refresh).toHaveBeenCalled()
    expect(employeesService.listEngineers).toHaveBeenCalledTimes(2)
    expect(emailField()).toHaveValue('')
    expect(idField()).toHaveValue('')
    expect(passwordField()).toHaveValue('')
    expect(screen.queryByText('Employee ID is required')).not.toBeInTheDocument()
  })

  it.each([
    ['employee ID', idField],
    ['temporary password', passwordField],
  ])('shows a refusal from the backend until the %s is edited', async (_, field) => {
    employeesService.createEngineer.mockRejectedValue(new ApiError(409, 'Employee ID ENG-004 is already taken'))
    const { user } = await renderPage()

    await fillIn(user)
    await user.click(createButton())
    expect(await screen.findByText('Employee ID ENG-004 is already taken')).toBeInTheDocument()

    await user.type(field(), '5')
    expect(screen.queryByText('Employee ID ENG-004 is already taken')).not.toBeInTheDocument()
  })

  it('promotes an existing employee by their cleaned-up ID and reloads the team', async () => {
    const promoted = { employeeId: 'EMP-37FB73AFBC', email: 'sam@acme.com', name: 'Sam', role: 'ENGINEER', facultyAdminId: 'FA-001', promoted: true }
    const promoteEmployee = jest.spyOn(employeesService, 'promoteEmployee').mockResolvedValue(promoted)
    const notify = jest.fn()
    const { user } = renderWithProviders(<CreateEngineerPage />, { auth: { user: frank, refresh: jest.fn() }, notify })
    await screen.findByText('Bob Martinez')

    await user.type(screen.getByLabelText(/existing employee id/i), ' emp-37fb73afbc ')
    await user.click(screen.getByRole('button', { name: 'Promote to engineer' }))

    expect(await screen.findByText(/is now an engineer on your team/)).toHaveTextContent(
      'Sam (sam@acme.com) is now an engineer on your team.',
    )
    expect(promoteEmployee).toHaveBeenCalledWith({ employeeId: 'EMP-37FB73AFBC', facultyAdminId: 'FA-001' })
    expect(notify).toHaveBeenCalledWith('sam@acme.com is now an engineer')
    expect(employeesService.listEngineers).toHaveBeenCalledTimes(2)
    expect(employeesService.createEngineer).not.toHaveBeenCalled()
  })

  it('shows the backend refusing a promotion', async () => {
    jest.spyOn(employeesService, 'promoteEmployee').mockRejectedValue(new ApiError(404, 'No employee EMP-NOPE'))
    const { user } = await renderPage()

    await user.type(screen.getByLabelText(/existing employee id/i), 'EMP-NOPE')
    await user.click(screen.getByRole('button', { name: 'Promote to engineer' }))

    expect(await screen.findByText('No employee EMP-NOPE')).toBeInTheDocument()
  })
})
