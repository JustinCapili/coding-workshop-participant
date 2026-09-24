import { screen } from '@testing-library/react'
import { renderApp } from '../test/renderApp'

describe('NotFoundPage', () => {
  it('answers an unknown route for a signed-in user and links back to the dashboard', async () => {
    const { user } = renderApp({ route: '/no/such/page', as: 'alice@acme.com' })

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /go to dashboard/i }))
    expect(await screen.findByRole('heading', { name: 'Welcome, Alice' })).toBeInTheDocument()
  })
})
