import { render, screen } from '@testing-library/react'
import StatusChip from './StatusChip'

describe('StatusChip', () => {
  it.each([
    ['UNASSIGNED', 'Unassigned', 'RadioButtonUncheckedIcon'],
    ['ASSIGNED', 'Assigned', 'PersonPinIcon'],
    ['IN_PROGRESS', 'In progress', 'BuildIcon'],
    ['SUBMITTED', 'Submitted', 'RateReviewIcon'],
    ['APPROVED', 'Approved', 'CheckCircleIcon'],
    ['ARCHIVED', 'Archived', 'Inventory2Icon'],
  ])('shows %s as "%s" with its own icon', (status, label, icon) => {
    render(<StatusChip status={status} />)

    const chip = screen.getByText(label).closest('.MuiChip-root')
    expect(chip).toContainElement(screen.getByTestId(icon))
  })

  it('outlines only the archived chip', () => {
    const { rerender } = render(<StatusChip status="ARCHIVED" />)
    expect(screen.getByText('Archived').closest('.MuiChip-root')).toHaveClass('MuiChip-outlined')

    rerender(<StatusChip status="APPROVED" />)
    expect(screen.getByText('Approved').closest('.MuiChip-root')).toHaveClass('MuiChip-filled', 'MuiChip-colorSuccess')
  })

  it('falls back to the raw status, a hollow icon and the default colour for an unknown status', () => {
    render(<StatusChip status="ON_HOLD" size="medium" />)

    const chip = screen.getByText('ON_HOLD').closest('.MuiChip-root')
    expect(chip).toHaveClass('MuiChip-colorDefault', 'MuiChip-sizeMedium')
    expect(chip).toContainElement(screen.getByTestId('RadioButtonUncheckedIcon'))
  })
})
