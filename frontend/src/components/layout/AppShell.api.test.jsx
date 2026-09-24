import { screen, within } from '@testing-library/react'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import AppShell from './AppShell'

jest.mock('../../services/config', () => ({ USE_MOCKS: false }))

describe('AppShell against the real backend', () => {
  it('shows no "Mock data" chip and no "Reset demo data" in the account menu', async () => {
    const { user } = renderWithProviders(<AppShell />, { auth: { user: seededUser('frank@acme.com') } })

    expect(within(screen.getByRole('banner')).queryByText('Mock data')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Settings', 'Log out'])
  })
})
