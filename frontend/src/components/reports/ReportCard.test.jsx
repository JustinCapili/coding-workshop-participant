import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderApp'
import ReportCard from './ReportCard'

const report = {
  reportId: 'RPT-1001',
  title: 'Projector in Room 204 not powering on',
  location: 'Building A, Room 204',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  incidentType: 'IT',
  updatedAt: new Date().toISOString(),
  author: { name: 'Alice Nguyen' },
  assignees: [
    { assigneeId: 'ENG-001', employee: { name: 'Bob Martinez' } },
    { assigneeId: 'ENG-002', employee: { name: 'Carol Singh' } },
  ],
}

describe('ReportCard', () => {
  it('shows status, priority, title, location, id, type and assignee initials', () => {
    renderWithProviders(<ReportCard report={report} />)

    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Medium priority')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projector in Room 204 not powering on' })).toBeInTheDocument()
    expect(screen.getByText('Building A, Room 204')).toBeInTheDocument()
    expect(screen.getByText(/^RPT-1001 · IT · updated /)).toBeInTheDocument()
    expect(screen.getByText('BM')).toBeInTheDocument()
    expect(screen.getByText('CS')).toBeInTheDocument()
  })

  it('links to the report detail page', () => {
    renderWithProviders(<ReportCard report={report} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/reports/RPT-1001')
  })

  it('names the author only when asked to', () => {
    const { unmount } = renderWithProviders(<ReportCard report={report} />)
    expect(screen.queryByText(/Alice Nguyen/)).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<ReportCard report={report} showAuthor />)
    expect(screen.getByText(/^RPT-1001 · IT · Alice Nguyen · updated /)).toBeInTheDocument()
  })

  it('renders actions in a footer outside the link', () => {
    renderWithProviders(<ReportCard report={report} actions={<button type="button">Take case</button>} />)

    const button = screen.getByRole('button', { name: 'Take case' })
    expect(screen.getByRole('link')).not.toContainElement(button)
  })

  it('leaves out the type, priority and avatars a report does not have', () => {
    renderWithProviders(
      <ReportCard
        report={{ ...report, incidentType: undefined, priority: undefined, assignees: [], author: undefined }}
        showAuthor
      />,
    )

    expect(screen.getByText(/^RPT-1001 · updated /)).toBeInTheDocument()
    expect(screen.queryByText(/priority/)).not.toBeInTheDocument()
    expect(screen.queryByText('BM')).not.toBeInTheDocument()
  })
})
