import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { Role } from '../../domain/roles'
import { renderWithProviders, seededUser } from '../../test/renderApp'
import RequireRole from './RequireRole'

function renderGated(user) {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
      <Route element={<RequireRole role={Role.ENGINEER} />}>
        <Route path="/reports/previous" element={<p>Previous reports page</p>} />
      </Route>
    </Routes>,
    { auth: { user }, route: '/reports/previous' },
  )
}

describe('RequireRole', () => {
  it('tells a user without the role they may not view the page, with a way back', async () => {
    const { user } = renderGated(seededUser('alice@acme.com'))

    expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission to view this page.')
    expect(screen.queryByText('Previous reports page')).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Back to dashboard' }))
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })

  it('refuses when nobody is signed in', () => {
    renderGated(null)
    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument()
  })

  it.each([
    ['an engineer', 'bob@acme.com'],
    ['a faculty admin, whose role inherits engineer', 'frank@acme.com'],
  ])('renders the page for %s', (_, email) => {
    renderGated(seededUser(email))

    expect(screen.getByText('Previous reports page')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('also asks `when`, if given, and refuses anyone it turns down', () => {
    const when = jest.fn((user) => user.email === 'frank@acme.com')
    const renderWhen = (email) =>
      renderWithProviders(
        <Routes>
          <Route element={<RequireRole role={Role.ENGINEER} when={when} />}>
            <Route path="/gated" element={<p>Gated page</p>} />
          </Route>
        </Routes>,
        { auth: { user: seededUser(email) }, route: '/gated' },
      )

    const { unmount } = renderWhen('bob@acme.com')
    expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument()
    unmount()

    renderWhen('frank@acme.com')
    expect(screen.getByText('Gated page')).toBeInTheDocument()
    expect(when).toHaveBeenCalledWith(seededUser('frank@acme.com'))
  })
})
