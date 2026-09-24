import { render, screen } from '@testing-library/react'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('shows a default title and inbox icon with nothing else', () => {
    render(<EmptyState />)

    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument()
    expect(screen.getByTestId('InboxIcon')).toBeInTheDocument()
  })

  it('shows a custom title, description, icon and action', () => {
    render(
      <EmptyState
        title="No engineers yet"
        description="Add one with the form."
        icon={Inventory2Icon}
        action={<button type="button">Add engineer</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'No engineers yet' })).toBeInTheDocument()
    expect(screen.getByText('Add one with the form.')).toBeInTheDocument()
    expect(screen.getByTestId('Inventory2Icon')).toBeInTheDocument()
    expect(screen.queryByTestId('InboxIcon')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add engineer' })).toBeInTheDocument()
  })
})
