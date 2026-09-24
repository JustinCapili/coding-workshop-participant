import { screen } from '@testing-library/react'
import { renderApp } from './test/renderApp'

const NO_PERMISSION = 'You do not have permission to view this page.'

describe('App routes', () => {
  it('serves /login to a signed-out visitor, without the app shell', async () => {
    renderApp({ route: '/login' })

    expect(await screen.findByRole('heading', { name: 'Incident Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('redirects / to the dashboard', async () => {
    renderApp({ route: '/', as: 'alice@acme.com' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Alice' })).toBeInTheDocument()
  })

  it('serves / to a signed-out visitor as the landing page, not the login form', async () => {
    renderApp({ route: '/' })

    expect(await screen.findByRole('heading', { level: 1, name: 'See something? Say something.' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/employee email/i)).not.toBeInTheDocument()
  })

  it.each(['/dashboard', '/settings', '/team/open-cases', '/no/such/page'])(
    'sends a signed-out visitor from %s to the login page',
    async (route) => {
      renderApp({ route })
      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    },
  )

  it.each([
    ['/dashboard', 'alice@acme.com', 'Welcome, Alice'],
    ['/reports/new', 'alice@acme.com', 'Create Incident Report'],
    ['/settings', 'alice@acme.com', 'Settings'],
    ['/common-cases', 'alice@acme.com', 'Common Cases'],
    ['/reports/RPT-1001', 'alice@acme.com', 'Projector in Room 204 not powering on'],
    ['/reports/previous', 'bob@acme.com', 'Previous Reports'],
    ['/inventory/request', 'bob@acme.com', 'Request Inventory'],
    ['/reports/previous', 'frank@acme.com', 'Previous Reports'],
    ['/team/engineers/new', 'frank@acme.com', 'Create Engineer'],
    ['/team/open-cases', 'frank@acme.com', 'Current Open Cases'],
    ['/team/open-cases', 'admin@acme.inc', 'Current Open Cases'],
    ['/team/admins', 'admin@acme.inc', 'Faculty Admins'],
  ])('serves %s to %s', async (route, email, heading) => {
    renderApp({ route, as: email })

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.queryByText(NO_PERMISSION)).not.toBeInTheDocument()
  })

  it.each([
    ['/reports/previous', 'alice@acme.com'],
    ['/inventory/request', 'alice@acme.com'],
    ['/team/engineers/new', 'alice@acme.com'],
    ['/team/engineers/new', 'bob@acme.com'],
    ['/team/open-cases', 'bob@acme.com'],
    ['/team/admins', 'alice@acme.com'],
    ['/team/admins', 'bob@acme.com'],
    ['/team/admins', 'frank@acme.com'],
  ])('refuses %s to %s', async (route, email) => {
    renderApp({ route, as: email })

    expect(await screen.findByText(NO_PERMISSION)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('answers an unknown route with the not-found page inside the shell', async () => {
    renderApp({ route: '/team/nowhere', as: 'frank@acme.com' })

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
