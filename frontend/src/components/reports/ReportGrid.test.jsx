import { screen } from '@testing-library/react'
import { ApiError } from '../../services/apiError'
import { renderWithProviders } from '../../test/renderApp'
import ReportGrid from './ReportGrid'

const reports = [
  { reportId: 'RPT-1', title: 'First report', location: 'Room 1', status: 'UNASSIGNED', updatedAt: new Date().toISOString() },
  { reportId: 'RPT-2', title: 'Second report', location: 'Room 2', status: 'ASSIGNED', updatedAt: new Date().toISOString() },
]

describe('ReportGrid', () => {
  it('shows a loading state before the first load', () => {
    renderWithProviders(<ReportGrid loading />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading reports…')
  })

  it('keeps showing the cards while a reload is in flight', () => {
    renderWithProviders(<ReportGrid reports={reports} loading />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'First report' })).toBeInTheDocument()
  })

  it('shows the error with a Retry button that calls onRetry', async () => {
    const onRetry = jest.fn()
    const { user } = renderWithProviders(
      <ReportGrid reports={reports} error={new ApiError(500, 'Boom')} onRetry={onRetry} />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state with its title, description and action', () => {
    renderWithProviders(
      <ReportGrid
        reports={[]}
        emptyTitle="Nothing filed"
        emptyDescription="Your reports appear here."
        emptyAction={<button type="button">File one</button>}
      />,
    )

    expect(screen.getByText('Nothing filed')).toBeInTheDocument()
    expect(screen.getByText('Your reports appear here.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'File one' })).toBeInTheDocument()
  })

  it('uses "No reports" as the default empty title', () => {
    renderWithProviders(<ReportGrid />)

    expect(screen.getByText('No reports')).toBeInTheDocument()
  })

  it('renders a card per report with the actions the page supplies', () => {
    const renderActions = jest.fn((report) => <button type="button">Act on {report.reportId}</button>)
    renderWithProviders(<ReportGrid reports={reports} renderActions={renderActions} />)

    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['First report', 'Second report'])
    expect(screen.getByRole('button', { name: 'Act on RPT-1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Act on RPT-2' })).toBeInTheDocument()
    expect(renderActions).toHaveBeenCalledWith(reports[0])
  })
})
