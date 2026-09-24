import { render, screen } from '@testing-library/react'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the page heading, alone when nothing else is given', () => {
    const { container } = render(<PageHeader title="Settings" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('renders the subtitle, actions and children', () => {
    render(
      <PageHeader title="Previous Reports" subtitle="Approved and archived incidents." actions={<button type="button">Export</button>}>
        <p>Filters go here</p>
      </PageHeader>,
    )

    expect(screen.getByText('Approved and archived incidents.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getByText('Filters go here')).toBeInTheDocument()
  })
})
