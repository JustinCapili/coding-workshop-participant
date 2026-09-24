import { screen, within } from '@testing-library/react'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import SidebarNav from './SidebarNav'

function renderNav(email, route = '/dashboard') {
  const onNavigate = jest.fn()
  const result = renderWithProviders(<SidebarNav user={email && seededUser(email)} onNavigate={onNavigate} />, { route })
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  const links = () => within(nav).queryAllByRole('link').map((link) => link.textContent)
  return { ...result, nav, links, onNavigate }
}

describe('SidebarNav', () => {
  it('shows an employee only Dashboard and Common Cases', () => {
    const { nav, links } = renderNav('alice@acme.com')

    expect(links()).toEqual(['Dashboard', 'Common Cases'])
    expect(within(nav).queryByText('Engineer')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Team')).not.toBeInTheDocument()
  })

  it('adds an Engineer section with Previous Reports and Request Inventory for an engineer', () => {
    const { nav, links } = renderNav('bob@acme.com')

    expect(links()).toEqual(['Dashboard', 'Common Cases', 'Previous Reports', 'Request Inventory'])
    expect(within(nav).getByText('Engineer')).toBeInTheDocument()
    expect(within(nav).queryByText('Team')).not.toBeInTheDocument()
  })

  it('adds a Team section with Create Engineer and Current Open Cases for a faculty admin', () => {
    const { nav, links } = renderNav('frank@acme.com')

    expect(links()).toEqual([
      'Dashboard',
      'Common Cases',
      'Previous Reports',
      'Request Inventory',
      'Create Engineer',
      'Current Open Cases',
    ])
    expect(within(nav).getByText('Team')).toBeInTheDocument()
  })

  it('adds Faculty Admins to the Team section for admin@acme.inc only', () => {
    const { links } = renderNav('admin@acme.inc')

    expect(links()).toEqual([
      'Dashboard',
      'Common Cases',
      'Previous Reports',
      'Request Inventory',
      'Create Engineer',
      'Current Open Cases',
      'Faculty Admins',
    ])
    expect(screen.getByRole('link', { name: 'Faculty Admins' })).toHaveAttribute('href', '/team/admins')
  })

  it('shows nothing with nobody signed in', () => {
    const { links } = renderNav(null)
    expect(links()).toEqual([])
  })

  it('links each entry to its page', () => {
    renderNav('frank@acme.com')

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Common Cases' })).toHaveAttribute('href', '/common-cases')
    expect(screen.getByRole('link', { name: 'Previous Reports' })).toHaveAttribute('href', '/reports/previous')
    expect(screen.getByRole('link', { name: 'Request Inventory' })).toHaveAttribute('href', '/inventory/request')
    expect(screen.getByRole('link', { name: 'Create Engineer' })).toHaveAttribute('href', '/team/engineers/new')
    expect(screen.getByRole('link', { name: 'Current Open Cases' })).toHaveAttribute('href', '/team/open-cases')
  })

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/common-cases', 'Common Cases'],
    ['/reports/previous', 'Previous Reports'],
    ['/team/open-cases', 'Current Open Cases'],
    ['/team/engineers/new', 'Create Engineer'],
  ])('marks only the current page selected at %s', (route, label) => {
    renderNav('frank@acme.com', route)

    const selected = screen.getAllByRole('link').filter((link) => link.classList.contains('Mui-selected'))
    expect(selected.map((link) => link.textContent)).toEqual([label])
  })

  it('keeps a section selected on the pages beneath it, but Dashboard only on /dashboard itself', () => {
    const { unmount } = renderNav('frank@acme.com', '/team/open-cases/RPT-1001')
    expect(screen.getByRole('link', { name: 'Current Open Cases' })).toHaveClass('Mui-selected')
    unmount()

    renderNav('frank@acme.com', '/dashboard/extra')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveClass('Mui-selected')
  })

  it('selects nothing on a page outside the sidebar', () => {
    renderNav('frank@acme.com', '/settings')
    expect(document.querySelectorAll('.Mui-selected')).toHaveLength(0)
  })

  it('calls onNavigate when an entry is clicked', async () => {
    const { user, onNavigate } = renderNav('bob@acme.com')

    await user.click(screen.getByRole('link', { name: 'Previous Reports' }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Previous Reports' })).toHaveAttribute('aria-current', 'page')
  })
})
