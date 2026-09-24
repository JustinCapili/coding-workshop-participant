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

  describe('a set at a time, with pageSize', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      reportId: `RPT-${i + 1}`,
      title: `Report ${i + 1}`,
      location: 'Room 1',
      status: 'UNASSIGNED',
      updatedAt: new Date().toISOString(),
    }))
    const titles = () => screen.getAllByRole('heading').map((h) => h.textContent)

    it('shows the first set, then one more set per "Load more", until all are shown', async () => {
      const { user } = renderWithProviders(<ReportGrid reports={five} pageSize={2} />)

      expect(titles()).toEqual(['Report 1', 'Report 2'])
      expect(screen.getByText('Showing 2 of 5')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      expect(titles()).toEqual(['Report 1', 'Report 2', 'Report 3', 'Report 4'])
      expect(screen.getByText('Showing 4 of 5')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Load more' }))
      expect(titles()).toHaveLength(5)
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument()
    })

    it('has no "Load more" when everything fits in the first set', () => {
      renderWithProviders(<ReportGrid reports={five} pageSize={6} />)

      expect(titles()).toHaveLength(5)
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })

    it('shows every card at once without a pageSize', () => {
      renderWithProviders(<ReportGrid reports={five} />)

      expect(titles()).toHaveLength(5)
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })
  })
})
