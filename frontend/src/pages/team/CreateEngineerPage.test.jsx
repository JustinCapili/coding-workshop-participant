import { screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import * as employeesService from '../../services/employeesService'
import { getDb } from '../../services/mock/mockStore'
import { renderApp } from '../../test/renderApp'

const emailField = () => screen.getByLabelText(/employee email/i)
const grantButton = () => screen.getByRole('button', { name: 'Grant engineer permission' })
const teamList = () => screen.getByRole('heading', { name: /engineers/i }).parentElement

async function renderCreateEngineer(as = 'frank@acme.com') {
  const result = renderApp({ route: '/team/engineers/new', as })
  await screen.findByRole('heading', { level: 1, name: 'Create Engineer' })
  return result
}

async function grant(user, email) {
  await user.type(emailField(), email)
  await user.click(grantButton())
}

function successAlert() {
  return screen.queryAllByRole('alert').find((alert) => alert.classList.contains('MuiAlert-standardSuccess'))
}

afterEach(() => jest.restoreAllMocks())

describe('CreateEngineerPage (mock mode)', () => {
  it('explains the email-only promotion flow', async () => {
    await renderCreateEngineer()

    expect(screen.getByText(/or grant engineer permissions by email/)).toBeInTheDocument()
    expect(screen.getByText('An existing employee is promoted; an unknown email creates a new engineer record.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^employee id/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/temporary password/i)).not.toBeInTheDocument()
  })

  it("lists the faculty admin's own engineers", async () => {
    await renderCreateEngineer()

    expect(await screen.findByText('Bob Martinez')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your engineers 2' })).toBeInTheDocument()
    expect(screen.getByText('bob@acme.com · ENG-001')).toBeInTheDocument()
    expect(screen.getByText('Carol Singh')).toBeInTheDocument()
    expect(screen.queryByText('Dave Kowalski')).not.toBeInTheDocument()
  })

  it('shows an admin all engineers with the team each is on', async () => {
    await renderCreateEngineer('admin@acme.inc')

    expect(await screen.findByRole('heading', { name: 'All engineers 3' })).toBeInTheDocument()
    expect(screen.getByText('Dave Kowalski')).toBeInTheDocument()
    expect(within(teamList()).getAllByText('FA-001')).toHaveLength(2)
    expect(within(teamList()).getByText('FA-002')).toBeInTheDocument()
  })

  it('marks an engineer on no team for an admin', async () => {
    getDb().employees.find((e) => e.email === 'dave@acme.com').facultyAdminId = null
    await renderCreateEngineer('admin@acme.inc')

    const dave = await screen.findByText('Dave Kowalski')
    expect(within(dave.closest('li')).getByText('No team')).toBeInTheDocument()
  })

  it('asks for a valid email, on leaving the field or on submit', async () => {
    const createEngineer = jest.spyOn(employeesService, 'createEngineer')
    const { user } = await renderCreateEngineer()

    await user.click(emailField())
    await user.tab()
    expect(screen.getByText('Enter a valid employee email')).toBeInTheDocument()

    await grant(user, 'alice')
    expect(screen.getByText('Enter a valid employee email')).toBeInTheDocument()
    expect(createEngineer).not.toHaveBeenCalled()
  })

  it('promotes an employee, confirms it and adds them to the list', async () => {
    const { user } = await renderCreateEngineer()
    await screen.findByText('Bob Martinez')

    await grant(user, 'alice@acme.com')

    expect(await screen.findByText('alice@acme.com now has engineer permissions')).toBeInTheDocument()
    expect(successAlert()).toHaveTextContent('Alice Nguyen (alice@acme.com) granted engineer permissions.')
    expect(await screen.findByRole('heading', { name: 'Your engineers 3' })).toBeInTheDocument()
    expect(within(teamList()).getByText('Alice Nguyen')).toBeInTheDocument()
    expect(emailField()).toHaveValue('')
  })

  it("moves an engineer from another admin's team", async () => {
    const { user } = await renderCreateEngineer()

    await grant(user, 'dave@acme.com')
    await waitFor(() => expect(successAlert()).toHaveTextContent('Dave Kowalski (dave@acme.com) moved to your team.'))
  })

  it('creates an engineer record for an unknown email', async () => {
    const { user } = await renderCreateEngineer()

    await grant(user, 'new.person@acme.inc')
    await waitFor(() =>
      expect(successAlert()).toHaveTextContent('New Person (new.person@acme.inc) created as an engineer on your team.'),
    )
  })

  it('refuses to create an engineer record outside @acme.inc', async () => {
    const { user } = await renderCreateEngineer()

    await grant(user, 'new.person@acme.com')
    expect(await screen.findByText('email must be an @acme.inc address')).toBeInTheDocument()
    expect(successAlert()).toBeUndefined()
  })

  it('dismisses the confirmation from its close button', async () => {
    const { user } = await renderCreateEngineer()
    await grant(user, 'alice@acme.com')
    await waitFor(() => expect(successAlert()).toBeDefined())

    await user.click(within(successAlert()).getByRole('button', { name: 'Close' }))
    expect(successAlert()).toBeUndefined()
  })

  it.each([
    ['a faculty admin', 'grace@acme.com', 'grace@acme.com is a Faculty Admin and cannot be made an engineer'],
    ['an engineer already on the team', 'bob@acme.com', 'bob@acme.com is already an engineer on your team'],
  ])('refuses %s, until the email is edited', async (_, email, message) => {
    const { user } = await renderCreateEngineer()

    await grant(user, email)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(emailField()).toHaveValue(email)

    await user.type(emailField(), 'x')
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it('replaces an earlier confirmation with a new error', async () => {
    const { user } = await renderCreateEngineer()
    await grant(user, 'alice@acme.com')
    await waitFor(() => expect(successAlert()).toBeDefined())

    await grant(user, 'grace@acme.com')
    expect(await screen.findByText(/is a Faculty Admin/)).toBeInTheDocument()
    expect(successAlert()).toBeUndefined()
  })

  it('says so when the team has no engineers yet', async () => {
    jest.spyOn(employeesService, 'listEngineers').mockResolvedValue([])
    await renderCreateEngineer()

    expect(await screen.findByRole('heading', { name: 'No engineers yet' })).toBeInTheDocument()
    expect(screen.getByText('Add one with the form.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your engineers 0' })).toBeInTheDocument()
  })

  it('shows a loading state, then a failure to load the team with Retry', async () => {
    let failLoad
    jest
      .spyOn(employeesService, 'listEngineers')
      .mockReturnValueOnce(new Promise((resolve, reject) => (failLoad = reject)))
    const { user } = await renderCreateEngineer()

    expect(within(teamList()).getByRole('status')).toHaveTextContent('Loading…')
    failLoad(new ApiError(500, 'Boom'))
    expect(await screen.findByText('Boom')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Bob Martinez')).toBeInTheDocument()
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })
})

describe('CreateEngineerPage: promoting an existing employee by ID (mock mode)', () => {
  const promoteField = () => screen.getByLabelText(/existing employee id/i)
  const promoteButton = () => screen.getByRole('button', { name: 'Promote to engineer' })

  async function promote(user, id) {
    await user.type(promoteField(), id)
    await user.click(promoteButton())
  }

  it('offers the promote form first, saying where the ID is found and that the password stays', async () => {
    await renderCreateEngineer()

    expect(screen.getByRole('heading', { name: 'Promote an existing employee' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create a new engineer account' })).toBeInTheDocument()
    expect(
      screen.getByText("They'll find it in their account menu or on Settings. They keep their password."),
    ).toBeInTheDocument()
    expect(promoteField()).toHaveFocus()
  })

  it('asks for an ID before promoting anyone', async () => {
    const promoteEmployee = jest.spyOn(employeesService, 'promoteEmployee')
    const { user } = await renderCreateEngineer()

    await user.click(promoteButton())
    expect(screen.getByText("Enter the employee's ID")).toBeInTheDocument()
    await promote(user, '   ')
    expect(promoteEmployee).not.toHaveBeenCalled()
  })

  it('promotes alice by her ID, typed in any case, onto the team, keeping her account', async () => {
    const { user } = await renderCreateEngineer()
    await screen.findByText('Bob Martinez')

    await promote(user, ' emp-001 ')

    expect(await screen.findByText('alice@acme.com is now an engineer')).toBeInTheDocument()
    expect(successAlert()).toHaveTextContent('Alice Nguyen (alice@acme.com) is now an engineer on your team.')
    expect(promoteField()).toHaveValue('')
    expect(await within(teamList()).findByText('alice@acme.com · EMP-001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your engineers 3' })).toBeInTheDocument()
    expect(getDb().employees.find((e) => e.employeeId === 'EMP-001')).toMatchObject({
      role: 'ENGINEER',
      facultyAdminId: 'FA-001',
      email: 'alice@acme.com',
    })
  })

  it.each([
    ['EMP-999', 'No employee EMP-999'],
    ['ENG-001', 'ENG-001 is already an engineer'],
    ['FA-002', 'FA-002 is a faculty admin'],
  ])('refuses %s with "%s", until the ID is edited', async (id, message) => {
    const { user } = await renderCreateEngineer()

    await promote(user, id)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(successAlert()).toBeUndefined()

    await user.type(promoteField(), '0')
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it('lets the success message be closed', async () => {
    const { user } = await renderCreateEngineer()
    await promote(user, 'EMP-002')
    await screen.findByText(/is now an engineer on your team/)

    await user.click(within(successAlert()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByText(/is now an engineer on your team/)).not.toBeInTheDocument()
  })
})
