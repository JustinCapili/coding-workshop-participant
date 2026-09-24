import { screen, waitFor, within } from '@testing-library/react'
import { employees, reports } from '../../services/mock/fixtures'
import { commit, getDb } from '../../services/mock/mockStore'
import { renderApp, renderWithProviders } from '../../test/renderApp'
import AppShell from './AppShell'

const SESSION_KEY = 'acme-incident-session'

async function renderShell(email, route = '/dashboard') {
  const result = renderApp({ route, as: email })
  await screen.findByRole('banner')
  return result
}

async function openAccountMenu(user) {
  await user.click(screen.getByRole('button', { name: 'Account menu' }))
  return screen.findByRole('menu')
}

/** The sidebar is drawn twice; whichever is not hidden from assistive tech is the one in use. */
function mobileDrawerIsOpen() {
  return screen.getByRole('navigation', { name: 'Main navigation' }).closest('.MuiDrawer-modal') !== null
}

afterEach(() => jest.restoreAllMocks())

describe('AppShell', () => {
  it.each([
    ['alice@acme.com', 'Employee'],
    ['bob@acme.com', 'Engineer'],
    ['frank@acme.com', 'Faculty Admin'],
    ['admin@acme.inc', 'Admin'],
  ])('shows %s their role, "%s", in the header', async (email, label) => {
    await renderShell(email)
    expect(within(screen.getByRole('banner')).getByText(label)).toBeInTheDocument()
  })

  it('shows the branding as a link home and a "Mock data" chip in mock mode', async () => {
    await renderShell('alice@acme.com', '/settings')
    const banner = screen.getByRole('banner')

    expect(within(banner).getByText('Mock data')).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'ACME Incident Reports' })).toHaveAttribute('href', '/dashboard')
  })

  it('renders the page inside the shell next to the sidebar', async () => {
    await renderShell('bob@acme.com')

    expect(screen.getByRole('main')).toContainElement(await screen.findByRole('heading', { name: 'Welcome, Bob' }))
    // A permanent sidebar for desktop and a closed drawer for mobile (hidden, so it has no name).
    expect(screen.getAllByRole('navigation', { hidden: true })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Previous Reports' })).toBeInTheDocument()
  })

  describe('account menu', () => {
    it('shows who is signed in, their role and their employee ID', async () => {
      const { user } = await renderShell('frank@acme.com')
      const menu = await openAccountMenu(user)

      expect(within(menu).getByText('Frank Delgado')).toBeInTheDocument()
      expect(within(menu).getByText('frank@acme.com · Faculty Admin')).toBeInTheDocument()
      expect(within(menu).getByText('Employee ID FA-001')).toBeInTheDocument()
      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Settings',
        'Reset demo data',
        'Log out',
      ])
    })

    it('closes on Escape without doing anything', async () => {
      const { user } = await renderShell('alice@acme.com')
      await openAccountMenu(user)

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Welcome, Alice' })).toBeInTheDocument()
    })

    it('Settings opens the settings page', async () => {
      const { user } = await renderShell('alice@acme.com')
      await openAccountMenu(user)

      await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('Log out signs out and goes to the login page', async () => {
      const { user } = await renderShell('alice@acme.com')
      await openAccountMenu(user)

      await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    })

    // Frank's page is admin-only: remembering it would greet Alice with "You do not have permission".
    it('Log out forgets the page, so the next person to sign in starts on their own dashboard', async () => {
      const { user } = await renderShell('frank@acme.com', '/team/open-cases')
      await screen.findByRole('heading', { level: 1, name: 'Current Open Cases' })
      await openAccountMenu(user)
      await user.click(screen.getByRole('menuitem', { name: 'Log out' }))

      await user.click(await screen.findByRole('button', { name: 'Employee · alice@acme.com' }))
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Alice' })).toBeInTheDocument()
    })

    it('Reset demo data throws away demo changes and reloads the dashboard', async () => {
      // jsdom cannot navigate, and says so on console.error.
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
      const { user } = await renderShell('alice@acme.com')
      getDb().reports.push({ ...reports[0], reportId: 'RPT-9999' })
      getDb().employees.splice(0, 1)
      commit()
      await openAccountMenu(user)

      await user.click(screen.getByRole('menuitem', { name: 'Reset demo data' }))
      await waitFor(() => expect(getDb().reports).toHaveLength(reports.length))
      expect(getDb().employees).toHaveLength(employees.length)
      await waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('navigation') })),
      )
    })
  })

  describe('mobile navigation drawer', () => {
    it('opens from the menu button and closes once an entry is chosen', async () => {
      const { user } = await renderShell('bob@acme.com')
      expect(mobileDrawerIsOpen()).toBe(false)

      await user.click(screen.getByRole('button', { name: 'Open navigation' }))
      expect(mobileDrawerIsOpen()).toBe(true)

      await user.click(screen.getByRole('link', { name: 'Common Cases' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Common Cases' })).toBeInTheDocument()
      await waitFor(() => expect(mobileDrawerIsOpen()).toBe(false))
    })

    it('closes on Escape', async () => {
      const { user } = await renderShell('bob@acme.com')

      await user.click(screen.getByRole('button', { name: 'Open navigation' }))
      await user.keyboard('{Escape}')
      await waitFor(() => expect(mobileDrawerIsOpen()).toBe(false))
    })
  })

  it('leaves out the sidebar and its menu button for a role that has no entries', () => {
    renderWithProviders(<AppShell />, {
      auth: { user: { employeeId: 'X-1', name: 'Jo Visitor', email: 'jo@acme.com', role: 'VISITOR' } },
    })

    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { hidden: true })).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('JV')).toBeInTheDocument()
  })
})
