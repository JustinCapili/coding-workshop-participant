import { render, screen } from '@testing-library/react'
import TodayIcon from '@mui/icons-material/Today'
import StatTile from './StatTile'

describe('StatTile', () => {
  it('shows the label, value, hint and icon', () => {
    render(<StatTile label="Incidents today" value={3} hint="Across your team" icon={TodayIcon} />)

    expect(screen.getByText('Incidents today')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Across your team')).toBeInTheDocument()
    expect(screen.getByTestId('TodayIcon')).toBeInTheDocument()
  })

  it('shows a placeholder instead of the value while loading, and no hint or icon unless given', () => {
    const { container } = render(<StatTile label="Open incidents" value={7} loading />)

    expect(screen.getByText('Open incidents')).toBeInTheDocument()
    expect(screen.queryByText('7')).not.toBeInTheDocument()
    expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('.MuiTypography-caption')).toBeNull()
  })
})
