import { screen } from '@testing-library/react'
import AddIcon from '@mui/icons-material/Add'
import { renderWithProviders } from '../../test/renderApp'
import ActionCard from './ActionCard'

describe('ActionCard', () => {
  it('is a link to `to` showing its icon, title and description', async () => {
    const { user } = renderWithProviders(
      <ActionCard title="Create Incident Report" description="Tell us what is broken." to="/reports/new" icon={AddIcon} />,
      { path: '/dashboard', route: '/dashboard' },
    )

    const link = screen.getByRole('link', { name: /create incident report/i })
    expect(link).toHaveAttribute('href', '/reports/new')
    expect(screen.getByRole('heading', { name: 'Create Incident Report' })).toBeInTheDocument()
    expect(screen.getByText('Tell us what is broken.')).toBeInTheDocument()
    expect(screen.getByTestId('AddIcon')).toBeInTheDocument()

    await user.click(link)
    expect(screen.getByText('Navigated away')).toBeInTheDocument()
  })

  it('is a button calling onClick when there is no `to`, and has no icon unless given one', async () => {
    const onClick = jest.fn()
    const { user } = renderWithProviders(
      <ActionCard title="Previous report statuses" description="See where your reports are." onClick={onClick} />,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('AddIcon')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /previous report statuses/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
