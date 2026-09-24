import { render, screen } from '@testing-library/react'
import PriorityChip from './PriorityChip'

describe('PriorityChip', () => {
  it('renders nothing without a priority', () => {
    const { container } = render(<PriorityChip priority={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['LOW', 'Low priority', 'MuiChip-colorDefault'],
    ['MEDIUM', 'Medium priority', 'MuiChip-colorInfo'],
    ['HIGH', 'High priority', 'MuiChip-colorWarning'],
    ['CRITICAL', 'Critical priority', 'MuiChip-colorError'],
  ])('labels %s as "%s" in its colour', (priority, label, colorClass) => {
    render(<PriorityChip priority={priority} />)
    expect(screen.getByText(label).closest('.MuiChip-root')).toHaveClass(colorClass)
  })

  it('falls back to the raw value and the default colour for an unknown priority', () => {
    render(<PriorityChip priority="URGENT" />)
    expect(screen.getByText('URGENT priority').closest('.MuiChip-root')).toHaveClass('MuiChip-colorDefault')
  })

  it('passes other props through to the chip', () => {
    render(<PriorityChip priority="LOW" data-testid="chip" />)
    expect(screen.getByTestId('chip')).toHaveTextContent('Low priority')
  })
})
