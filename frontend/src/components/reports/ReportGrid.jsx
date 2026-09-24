import Grid from '@mui/material/Grid'
import EmptyState from '../common/EmptyState'
import ErrorAlert from '../common/ErrorAlert'
import LoadingState from '../common/LoadingState'
import ReportCard from './ReportCard'

/**
 * Responsive grid of ReportCards with loading / error / empty handling.
 * `renderActions(report)` lets a page attach role-specific buttons to each card.
 */
export default function ReportGrid({
  reports,
  loading,
  error,
  onRetry,
  renderActions,
  showAuthor = false,
  emptyTitle = 'No reports',
  emptyDescription,
  emptyAction,
}) {
  if (loading && !reports) return <LoadingState label="Loading reports…" />
  if (error) return <ErrorAlert error={error} onRetry={onRetry} />
  if (!reports?.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }
  return (
    <Grid container spacing={2} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
      {reports.map((report) => (
        <Grid key={report.reportId} size={{ xs: 12, sm: 6, lg: 4 }}>
          <ReportCard report={report} showAuthor={showAuthor} actions={renderActions?.(report)} />
        </Grid>
      ))}
    </Grid>
  )
}
