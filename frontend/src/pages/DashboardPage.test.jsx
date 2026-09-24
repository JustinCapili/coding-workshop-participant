import { screen } from '@testing-library/react'
import { renderApp, renderWithProviders, seededUser } from '../test/renderApp'
import DashboardPage from './DashboardPage'

describe('DashboardPage', () => {
  it.each([
    ['an employee', 'alice@acme.com', 'Welcome, Alice'],
    ['an engineer', 'bob@acme.com', 'Welcome, Bob'],
    ['a faculty admin', 'frank@acme.com', 'Team overview'],
    ['an admin', 'admin@acme.inc', 'Organisation overview'],
  ])('gives %s their own dashboard', async (_, email, heading) => {
    renderApp({ route: '/dashboard', as: email })
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('treats a faculty admin without a scope as team-scoped', async () => {
    renderWithProviders(<DashboardPage />, { auth: { user: { ...seededUser('frank@acme.com'), scope: undefined } } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Team overview' })).toBeInTheDocument()
  })
})
